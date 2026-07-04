// Administração (spec 13): convites de staff, instituições (platform_admin) e visão geral.
import { Hono } from "hono";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { db, newId, nowIso } from "../db.ts";
import { env } from "../env.ts";
import {
  requireParent, requireRole, csrfGuard, parentRole, createSession, setSessionCookie,
} from "../lib/session.ts";
import { readJson, badRequest, forbidden, notFound, conflict, type AppEnv } from "../lib/http.ts";
import { hashPassword } from "../lib/crypto.ts";
import { audit } from "../lib/audit.ts";
import { setSetting } from "../lib/settings.ts";
import { activeModel, availableModels, DEFAULT_MODEL } from "../llm/router.ts";

const app = new Hono<AppEnv>();
app.use("/api/admin/*", csrfGuard);
app.use("/api/invites/*", csrfGuard);

// ---------- Visão geral ----------
app.get("/api/admin/overview", requireParent, requireRole("professor", "tutor", "institution_admin"), (c) => {
  const { role, institutionId } = parentRole(c.get("parentId"));
  const scope = role === "platform_admin" ? null : institutionId;
  const q = (sql: string) =>
    (scope
      ? db.prepare(sql.replace("/*W*/", "WHERE institution_id = ?")).get(scope)
      : db.prepare(sql.replace("/*W*/", "")).get()) as { n: number };

  const courses = q("SELECT COUNT(*) n FROM courses /*W*/");
  const published = (scope
    ? db.prepare("SELECT COUNT(*) n FROM courses WHERE institution_id = ? AND status='published'").get(scope)
    : db.prepare("SELECT COUNT(*) n FROM courses WHERE status='published'").get()) as { n: number };
  const students = (scope
    ? db.prepare("SELECT COUNT(*) n FROM children WHERE COALESCE(institution_id,'bncc-padrao') = ? AND deleted_at IS NULL").get(scope)
    : db.prepare("SELECT COUNT(*) n FROM children WHERE deleted_at IS NULL").get()) as { n: number };
  const pending = (scope
    ? db.prepare(
        `SELECT COUNT(*) n FROM content_items i JOIN course_modules m ON m.id=i.module_id
         JOIN courses cs ON cs.id=m.course_id WHERE i.status='pending_review' AND cs.institution_id = ?`,
      ).get(scope)
    : db.prepare("SELECT COUNT(*) n FROM content_items WHERE status='pending_review'").get()) as { n: number };

  return c.json({
    role, institution_id: scope,
    courses: courses.n, published: published.n, students: students.n, pending_review: pending.n,
  });
});

// ---------- Convites ----------
const inviteSchema = z.object({
  email: z.string().email().max(160),
  role: z.enum(["professor", "tutor", "institution_admin", "platform_admin"]),
  institution_id: z.string().max(60).nullish(),
});

app.post("/api/admin/invites", requireParent, requireRole("institution_admin"), async (c) => {
  const parentId = c.get("parentId");
  const me = parentRole(parentId);
  const body = await readJson(c, inviteSchema);

  // institution_admin só convida professor/tutor para a PRÓPRIA instituição.
  let institutionId = body.institution_id ?? me.institutionId;
  if (me.role !== "platform_admin") {
    if (body.role === "institution_admin" || body.role === "platform_admin") {
      throw forbidden("role_too_high", "Apenas o administrador da plataforma convida gestores.");
    }
    institutionId = me.institutionId;
  }
  if (body.role !== "platform_admin" && !institutionId) {
    throw badRequest("institution_required", "Informe a instituição do convite.");
  }
  if (institutionId) {
    const inst = db.prepare("SELECT id FROM institutions WHERE id = ?").get(institutionId);
    if (!inst) throw badRequest("bad_institution", "Instituição inválida.");
  }

  const token = randomBytes(16).toString("hex");
  const id = newId();
  db.prepare(
    `INSERT INTO invites (id, email, role, institution_id, token, invited_by, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id, body.email.toLowerCase().trim(), body.role, institutionId ?? null, token, parentId,
    new Date(Date.now() + 7 * 86400000).toISOString(), nowIso(),
  );
  audit(`parent:${parentId}`, "invite_create", `invite:${id}`, { role: body.role, institution: institutionId });
  return c.json({ id, token, link: `${env.publicOrigin}/convite/${token}` }, 201);
});

app.get("/api/admin/invites", requireParent, requireRole("institution_admin"), (c) => {
  const me = parentRole(c.get("parentId"));
  const rows = (me.role === "platform_admin"
    ? db.prepare("SELECT id, email, role, institution_id, expires_at, accepted_at, created_at FROM invites ORDER BY created_at DESC LIMIT 50").all()
    : db.prepare("SELECT id, email, role, institution_id, expires_at, accepted_at, created_at FROM invites WHERE institution_id = ? ORDER BY created_at DESC LIMIT 50").all(me.institutionId)) as Record<string, unknown>[];
  return c.json({ invites: rows });
});

interface InviteRow {
  id: string; email: string; role: string; institution_id: string | null;
  expires_at: string; accepted_at: string | null;
}
function validInvite(token: string): InviteRow {
  const inv = db
    .prepare("SELECT id, email, role, institution_id, expires_at, accepted_at FROM invites WHERE token = ?")
    .get(token) as InviteRow | undefined;
  if (!inv) throw notFound("invite_not_found", "Convite não encontrado.");
  if (inv.accepted_at) throw conflict("invite_used", "Este convite já foi utilizado.");
  if (new Date(inv.expires_at).getTime() < Date.now()) throw conflict("invite_expired", "Este convite expirou.");
  return inv;
}

// Público: dados do convite para a tela de aceite.
app.get("/api/invites/:token", (c) => {
  const inv = validInvite(c.req.param("token"));
  const inst = inv.institution_id
    ? (db.prepare("SELECT name FROM institutions WHERE id = ?").get(inv.institution_id) as { name: string } | undefined)
    : undefined;
  return c.json({ email: inv.email, role: inv.role, institution: inst?.name ?? null });
});

// Público: aceitar — cria a conta staff (ou aplica papel se a conta do e-mail já existir + senha confere).
app.post("/api/invites/accept", async (c) => {
  const { token, password } = await readJson(
    c,
    z.object({ token: z.string().min(10), password: z.string().min(10).max(200) }),
  );
  const inv = validInvite(token);

  let parentId: string;
  const existing = db
    .prepare("SELECT id FROM parents WHERE email = ? AND deleted_at IS NULL")
    .get(inv.email) as { id: string } | undefined;
  if (existing) {
    // conta já existe → exigir login normal; aqui só aplicamos papel se a senha conferir
    const { verifyPassword } = await import("../lib/crypto.ts");
    const row = db.prepare("SELECT password_hash FROM parents WHERE id = ?").get(existing.id) as { password_hash: string };
    if (!(await verifyPassword(password, row.password_hash))) {
      throw forbidden("bad_password", "Já existe conta com este e-mail — informe a senha dela para vincular o papel.");
    }
    parentId = existing.id;
  } else {
    parentId = newId();
    db.prepare(
      "INSERT INTO parents (id, email, email_verified, password_hash, created_at) VALUES (?, ?, 1, ?, ?)",
    ).run(parentId, inv.email, await hashPassword(password), nowIso());
  }

  db.prepare("UPDATE parents SET role = ?, staff_institution_id = ? WHERE id = ?").run(
    inv.role, inv.institution_id, parentId,
  );
  db.prepare("UPDATE invites SET accepted_at = ? WHERE id = ?").run(nowIso(), inv.id);

  const sid = createSession(parentId, c.req.header("user-agent"));
  setSessionCookie(c, sid);
  audit(`parent:${parentId}`, "invite_accept", `invite:${inv.id}`, { role: inv.role });
  return c.json({ ok: true, role: inv.role });
});

// ---------- Instituições (platform_admin) ----------
const instSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{3,40}$/, "id em kebab-case"),
  name: z.string().trim().min(2).max(80),
  kind: z.enum(["default", "network", "school"]),
  config: z.object({
    classes: z.array(z.object({ id: z.string(), label: z.string(), grade_equiv: z.string(), age: z.string() })).min(1),
    subjects: z.array(z.object({ id: z.string(), label: z.string(), icon: z.string(), lang: z.enum(["pt", "en"]) })).min(1),
    terms: z.array(z.string()).min(1),
  }),
});

app.post("/api/admin/institutions", requireParent, requireRole("platform_admin"), async (c) => {
  const body = await readJson(c, instSchema);
  const exists = db.prepare("SELECT id FROM institutions WHERE id = ?").get(body.id);
  if (exists) throw conflict("institution_exists", "Já existe instituição com este id.");
  db.prepare("INSERT INTO institutions (id, name, kind, locale, active, config_json) VALUES (?, ?, ?, 'pt-BR', 1, ?)").run(
    body.id, body.name, body.kind, JSON.stringify(body.config),
  );
  audit(`parent:${c.get("parentId")}`, "institution_create", `institution:${body.id}`);
  return c.json({ id: body.id }, 201);
});

// ---------- Alunos da instituição (matrícula assinada usa esta lista) ----------
app.get("/api/admin/students", requireParent, requireRole("professor", "institution_admin"), (c) => {
  const me = parentRole(c.get("parentId"));
  const inst = me.role === "platform_admin" ? c.req.query("institution") || null : me.institutionId;
  if (!inst) throw badRequest("institution_required", "Informe a instituição.");
  const rows = db
    .prepare(
      `SELECT id, display_name, grade, class_id, kind FROM children
       WHERE COALESCE(institution_id,'bncc-padrao') = ? AND deleted_at IS NULL ORDER BY display_name LIMIT 200`,
    )
    .all(inst) as Record<string, unknown>[];
  return c.json({ students: rows });
});

// ---------- Modelo de IA (platform_admin) — escolha o modelo, padrão = Gemma local ----------
app.get("/api/admin/ai-model", requireParent, requireRole("platform_admin"), (c) => {
  return c.json({
    current: activeModel(),
    default: DEFAULT_MODEL,
    options: availableModels(),
  });
});

app.post("/api/admin/ai-model", requireParent, requireRole("platform_admin"), async (c) => {
  const { model } = await readJson(c, z.object({ model: z.string().min(1) }));
  const avail = availableModels();
  if (!avail.some((m) => m.id === model)) {
    throw badRequest("model_unavailable", "Modelo indisponível (provedor não configurado).");
  }
  setSetting("ai_model", model);
  audit(`parent:${c.get("parentId")}`, "set_ai_model", model);
  return c.json({ ok: true, current: model });
});

export default app;
