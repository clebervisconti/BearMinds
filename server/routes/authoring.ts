// Autoria de conteúdo (spec 13): cursos → módulos → itens + uploads. Staff apenas, escopo por instituição.
import { Hono } from "hono";
import { z } from "zod";
import { mkdirSync, createReadStream, existsSync, writeFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { db, newId, nowIso } from "../db.ts";
import {
  requireParent, requireRole, csrfGuard, parentRole, staffInstitutionOrThrow,
} from "../lib/session.ts";
import { readJson, badRequest, notFound, forbidden, type AppEnv } from "../lib/http.ts";
import { audit } from "../lib/audit.ts";

const app = new Hono<AppEnv>();
app.use("/api/admin/*", csrfGuard);

const UPLOAD_DIR = "data/uploads";
mkdirSync(UPLOAD_DIR, { recursive: true });

// ---------- helpers de escopo ----------
interface CourseRow {
  id: string; institution_id: string; subject_id: string; class_id: string; term: string | null;
  year: number | null; title: string; description: string | null; cover_emoji: string;
  status: string; created_by: string; created_at: string;
}
function courseOrThrow(id: string): CourseRow {
  const row = db.prepare("SELECT * FROM courses WHERE id = ?").get(id) as CourseRow | undefined;
  if (!row) throw notFound("course_not_found", "Curso não encontrado.");
  return row;
}
function courseOfModule(moduleId: string): CourseRow {
  const m = db.prepare("SELECT course_id FROM course_modules WHERE id = ?").get(moduleId) as { course_id: string } | undefined;
  if (!m) throw notFound("module_not_found", "Módulo não encontrado.");
  return courseOrThrow(m.course_id);
}
function courseOfItem(itemId: string): CourseRow {
  const i = db.prepare("SELECT module_id FROM content_items WHERE id = ?").get(itemId) as { module_id: string } | undefined;
  if (!i) throw notFound("item_not_found", "Item não encontrado.");
  return courseOfModule(i.module_id);
}

const STAFF = ["professor", "institution_admin"] as const;

// ---------- Cursos ----------
app.get("/api/admin/courses", requireParent, requireRole(...STAFF), (c) => {
  const me = parentRole(c.get("parentId"));
  const rows = (me.role === "platform_admin"
    ? db.prepare("SELECT * FROM courses ORDER BY created_at DESC LIMIT 100").all()
    : db.prepare("SELECT * FROM courses WHERE institution_id = ? ORDER BY created_at DESC LIMIT 100").all(me.institutionId)) as CourseRow[];
  const modCount = db.prepare("SELECT COUNT(*) n FROM course_modules WHERE course_id = ?");
  const enrCount = db.prepare("SELECT COUNT(*) n FROM enrollments WHERE course_id = ?");
  return c.json({
    courses: rows.map((r) => ({
      ...r,
      modules: (modCount.get(r.id) as { n: number }).n,
      enrolled: (enrCount.get(r.id) as { n: number }).n,
    })),
  });
});

const courseSchema = z.object({
  institution_id: z.string().max(60),
  subject_id: z.string().max(40),
  class_id: z.string().max(30),
  term: z.string().max(10).nullish(),
  year: z.number().int().gte(2024).lte(2100).nullish(),
  title: z.string().trim().min(3).max(120),
  description: z.string().max(2000).nullish(),
  cover_emoji: z.string().max(8).nullish(),
});

app.post("/api/admin/courses", requireParent, requireRole(...STAFF), async (c) => {
  const parentId = c.get("parentId");
  const body = await readJson(c, courseSchema);
  staffInstitutionOrThrow(parentId, body.institution_id);
  const inst = db.prepare("SELECT id FROM institutions WHERE id = ? AND active = 1").get(body.institution_id);
  if (!inst) throw badRequest("bad_institution", "Instituição inválida.");

  const id = newId();
  db.prepare(
    `INSERT INTO courses (id, institution_id, subject_id, class_id, term, year, title, description, cover_emoji, status, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
  ).run(
    id, body.institution_id, body.subject_id, body.class_id, body.term ?? null, body.year ?? null,
    body.title, body.description ?? null, body.cover_emoji ?? "📘", parentId, nowIso(),
  );
  audit(`parent:${parentId}`, "course_create", `course:${id}`, { title: body.title });
  return c.json({ id }, 201);
});

// Detalhe completo (módulos + itens) para o editor.
app.get("/api/admin/courses/:id", requireParent, requireRole(...STAFF), (c) => {
  const course = courseOrThrow(c.req.param("id"));
  staffInstitutionOrThrow(c.get("parentId"), course.institution_id);
  const modules = db
    .prepare("SELECT * FROM course_modules WHERE course_id = ? ORDER BY display_order, title")
    .all(course.id) as Record<string, unknown>[];
  const itemsStmt = db.prepare(
    "SELECT id, kind, title, payload_json, source_file_id, display_order, duration_min, status FROM content_items WHERE module_id = ? ORDER BY display_order",
  );
  const jobStmt = db.prepare(
    "SELECT status, detail FROM enrich_jobs WHERE item_id = ? ORDER BY created_at DESC LIMIT 1",
  );
  return c.json({
    course,
    modules: modules.map((m) => ({
      ...m,
      items: (itemsStmt.all(m.id as string) as Record<string, unknown>[]).map((i) => ({
        ...i,
        enrich: jobStmt.get(i.id as string) ?? null,
      })),
    })),
  });
});

const coursePatch = z.object({
  title: z.string().trim().min(3).max(120).optional(),
  description: z.string().max(2000).nullish().optional(),
  cover_emoji: z.string().max(8).optional(),
  term: z.string().max(10).nullish().optional(),
  year: z.number().int().gte(2024).lte(2100).nullish().optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
});

app.patch("/api/admin/courses/:id", requireParent, requireRole(...STAFF), async (c) => {
  const parentId = c.get("parentId");
  const course = courseOrThrow(c.req.param("id"));
  staffInstitutionOrThrow(parentId, course.institution_id);
  const body = await readJson(c, coursePatch);
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(body)) {
    sets.push(`${k} = ?`);
    vals.push(v ?? null);
  }
  if (sets.length === 0) return c.json({ ok: true });
  db.prepare(`UPDATE courses SET ${sets.join(", ")} WHERE id = ?`).run(...vals, course.id);
  audit(`parent:${parentId}`, "course_update", `course:${course.id}`, body as Record<string, unknown>);
  return c.json({ ok: true });
});

// ---------- Módulos ----------
app.post("/api/admin/courses/:id/modules", requireParent, requireRole(...STAFF), async (c) => {
  const parentId = c.get("parentId");
  const course = courseOrThrow(c.req.param("id"));
  staffInstitutionOrThrow(parentId, course.institution_id);
  const body = await readJson(c, z.object({ title: z.string().trim().min(2).max(120), objectives: z.string().max(1000).nullish() }));
  const max = db.prepare("SELECT COALESCE(MAX(display_order),0) m FROM course_modules WHERE course_id = ?").get(course.id) as { m: number };
  const id = newId();
  db.prepare("INSERT INTO course_modules (id, course_id, title, objectives, display_order) VALUES (?, ?, ?, ?, ?)").run(
    id, course.id, body.title, body.objectives ?? null, max.m + 1,
  );
  return c.json({ id }, 201);
});

app.patch("/api/admin/modules/:id", requireParent, requireRole(...STAFF), async (c) => {
  const course = courseOfModule(c.req.param("id"));
  staffInstitutionOrThrow(c.get("parentId"), course.institution_id);
  const body = await readJson(c, z.object({
    title: z.string().trim().min(2).max(120).optional(),
    objectives: z.string().max(1000).nullish().optional(),
    display_order: z.number().int().min(0).optional(),
  }));
  const sets = Object.keys(body).map((k) => `${k} = ?`);
  if (sets.length) db.prepare(`UPDATE course_modules SET ${sets.join(", ")} WHERE id = ?`).run(...Object.values(body).map((v) => v ?? null), c.req.param("id"));
  return c.json({ ok: true });
});

// ---------- Itens ----------
const itemSchema = z.object({
  kind: z.enum(["video", "document", "lesson", "quiz", "game", "live"]),
  title: z.string().trim().min(2).max(140),
  payload: z.record(z.string(), z.unknown()).nullish(),
  source_file_id: z.string().nullish(),
  duration_min: z.number().int().min(1).max(600).nullish(),
});

// Vídeo por URL: só YouTube/Vimeo (CSP). Valida no servidor.
function validateVideoPayload(payload: Record<string, unknown> | null | undefined): void {
  const url = payload?.url as string | undefined;
  if (!url) return;
  const ok = /^https:\/\/(www\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com|vimeo\.com|player\.vimeo\.com)\//.test(url);
  if (!ok) throw badRequest("bad_video_url", "Só aceitamos vídeos do YouTube ou Vimeo (ou upload MP4).");
}

app.post("/api/admin/modules/:id/items", requireParent, requireRole(...STAFF), async (c) => {
  const parentId = c.get("parentId");
  const course = courseOfModule(c.req.param("id"));
  staffInstitutionOrThrow(parentId, course.institution_id);
  const body = await readJson(c, itemSchema);
  if (body.kind === "video") validateVideoPayload(body.payload as Record<string, unknown> | null);

  const max = db.prepare("SELECT COALESCE(MAX(display_order),0) m FROM content_items WHERE module_id = ?").get(c.req.param("id")) as { m: number };
  const id = newId();
  db.prepare(
    `INSERT INTO content_items (id, module_id, kind, title, payload_json, source_file_id, display_order, duration_min, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
  ).run(
    id, c.req.param("id"), body.kind, body.title,
    body.payload ? JSON.stringify(body.payload) : null,
    body.source_file_id ?? null, max.m + 1, body.duration_min ?? null, nowIso(),
  );
  audit(`parent:${parentId}`, "item_create", `item:${id}`, { kind: body.kind });
  return c.json({ id }, 201);
});

app.patch("/api/admin/items/:id", requireParent, requireRole(...STAFF), async (c) => {
  const course = courseOfItem(c.req.param("id"));
  staffInstitutionOrThrow(c.get("parentId"), course.institution_id);
  const body = await readJson(c, z.object({
    title: z.string().trim().min(2).max(140).optional(),
    payload: z.record(z.string(), z.unknown()).nullish().optional(),
    display_order: z.number().int().min(0).optional(),
    duration_min: z.number().int().min(1).max(600).nullish().optional(),
  }));
  if (body.payload !== undefined) validateVideoPayload(body.payload as Record<string, unknown> | null);
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (body.title !== undefined) { sets.push("title = ?"); vals.push(body.title); }
  if (body.payload !== undefined) { sets.push("payload_json = ?"); vals.push(body.payload ? JSON.stringify(body.payload) : null); }
  if (body.display_order !== undefined) { sets.push("display_order = ?"); vals.push(body.display_order); }
  if (body.duration_min !== undefined) { sets.push("duration_min = ?"); vals.push(body.duration_min ?? null); }
  if (sets.length) db.prepare(`UPDATE content_items SET ${sets.join(", ")} WHERE id = ?`).run(...vals, c.req.param("id"));
  return c.json({ ok: true });
});

// Aprovação = sign-off humano (spec 13.3). Vídeo/documento simples pode publicar direto.
app.post("/api/admin/items/:id/approve", requireParent, requireRole(...STAFF), async (c) => {
  const parentId = c.get("parentId");
  const course = courseOfItem(c.req.param("id"));
  staffInstitutionOrThrow(parentId, course.institution_id);
  db.prepare("UPDATE content_items SET status = 'published', verified_by = ?, verified_at = ? WHERE id = ?").run(
    parentId, nowIso(), c.req.param("id"),
  );
  audit(`parent:${parentId}`, "item_approve", `item:${c.req.param("id")}`);
  return c.json({ ok: true });
});

app.delete("/api/admin/items/:id", requireParent, requireRole(...STAFF), (c) => {
  const course = courseOfItem(c.req.param("id"));
  staffInstitutionOrThrow(c.get("parentId"), course.institution_id);
  db.prepare("DELETE FROM content_items WHERE id = ?").run(c.req.param("id"));
  return c.json({ ok: true });
});

// ---------- Upload (staff) ----------
const MIME_LIMITS: Record<string, number> = {
  "video/mp4": 200 * 1024 * 1024,
  "application/pdf": 20 * 1024 * 1024,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": 20 * 1024 * 1024,
  "text/plain": 5 * 1024 * 1024,
  "text/markdown": 5 * 1024 * 1024,
};
const EXT_OK = new Set([".mp4", ".pdf", ".docx", ".txt", ".md"]);

app.post("/api/admin/upload", requireParent, requireRole(...STAFF), async (c) => {
  const parentId = c.get("parentId");
  const body = await c.req.parseBody();
  const file = body.file;
  if (!(file instanceof File)) throw badRequest("no_file", "Envie um arquivo no campo 'file'.");

  const ext = extname(file.name).toLowerCase();
  const limit = MIME_LIMITS[file.type];
  if (!limit || !EXT_OK.has(ext)) {
    throw badRequest("bad_type", "Tipo não suportado. Aceitamos: MP4, PDF, DOCX, TXT, MD.");
  }
  if (file.size > limit) {
    throw badRequest("too_big", `Arquivo acima do limite (${Math.round(limit / 1024 / 1024)}MB).`);
  }

  const id = newId();
  const path = join(UPLOAD_DIR, `${id}${ext}`);
  writeFileSync(path, Buffer.from(await file.arrayBuffer()), { mode: 0o600 });
  db.prepare(
    "INSERT INTO files (id, owner_parent_id, kind, original_name, path, mime, size_bytes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(id, parentId, file.type.startsWith("video") ? "video" : "document", file.name.slice(0, 200), path, file.type, file.size, nowIso());
  audit(`parent:${parentId}`, "file_upload", `file:${id}`, { name: file.name, size: file.size });
  return c.json({ id, name: file.name, mime: file.type, size: file.size }, 201);
});

// ---------- Servir arquivo (qualquer usuário autenticado) ----------
app.get("/api/files/:id", requireParent, (c) => {
  const f = db.prepare("SELECT * FROM files WHERE id = ?").get(c.req.param("id")) as
    | { id: string; path: string; mime: string; original_name: string; size_bytes: number }
    | undefined;
  if (!f || !existsSync(f.path)) throw notFound("file_not_found", "Arquivo não encontrado.");

  const stat = statSync(f.path);
  const range = c.req.header("range");
  const inline = f.mime === "application/pdf" || f.mime.startsWith("video/");
  const headers: Record<string, string> = {
    "Content-Type": f.mime,
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(f.original_name)}"`,
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
  };

  // Range requests p/ <video> (seek)
  if (range) {
    const m = /bytes=(\d+)-(\d*)/.exec(range);
    if (m) {
      const start = Number(m[1]);
      const end = m[2] ? Number(m[2]) : stat.size - 1;
      const stream = createReadStream(f.path, { start, end });
      return new Response(stream as unknown as ReadableStream, {
        status: 206,
        headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${stat.size}`, "Content-Length": String(end - start + 1) },
      });
    }
  }
  const stream = createReadStream(f.path);
  return new Response(stream as unknown as ReadableStream, {
    headers: { ...headers, "Content-Length": String(stat.size) },
  });
});

export default app;
