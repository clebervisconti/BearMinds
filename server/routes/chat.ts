// Chat (spec 14.3): canal por curso + DM estudante↔staff (NUNCA aluno↔aluno). Polling.
import { Hono } from "hono";
import { z } from "zod";
import { db, newId, nowIso } from "../db.ts";
import { requireParent, csrfGuard, ownChildOrThrow, parentRole } from "../lib/session.ts";
import { readJson, badRequest, forbidden, notFound, type AppEnv } from "../lib/http.ts";
import { hub, chatChannel } from "../ws/hub.ts";

const app = new Hono<AppEnv>();
app.use("/api/chat/*", csrfGuard);

const STAFF_ROLES = ["professor", "tutor", "institution_admin", "platform_admin"];

interface CourseRow { id: string; institution_id: string; created_by: string; title: string }
function course(id: string): CourseRow {
  const row = db.prepare("SELECT id, institution_id, created_by, title FROM courses WHERE id = ?").get(id) as CourseRow | undefined;
  if (!row) throw notFound("course_not_found", "Curso não encontrado.");
  return row;
}

interface Access { isStaff: boolean; childId: string | null; name: string }
export function courseAccess(c: { get: (k: "parentId" | "activeChildId") => string | null }, courseId: string, childIdParam?: string | null): Access {
  const parentId = c.get("parentId")!;
  const cs = course(courseId);
  const me = parentRole(parentId);
  if (STAFF_ROLES.includes(me.role) && (me.role === "platform_admin" || me.institutionId === cs.institution_id)) {
    const p = db.prepare("SELECT email FROM parents WHERE id = ?").get(parentId) as { email: string };
    return { isStaff: true, childId: null, name: "Prof. " + (p.email.split("@")[0] || "equipe") };
  }
  // estudante: precisa estar matriculado
  const childId = childIdParam || c.get("activeChildId");
  if (!childId) throw forbidden("no_access", "Sem acesso ao chat deste curso.");
  ownChildOrThrow(parentId, childId);
  const enrolled = db.prepare("SELECT 1 FROM enrollments WHERE child_id = ? AND course_id = ?").get(childId, courseId);
  if (!enrolled) throw forbidden("not_enrolled", "Inscreva-se no curso para participar do chat.");
  const child = db.prepare("SELECT display_name FROM children WHERE id = ?").get(childId) as { display_name: string };
  return { isStaff: false, childId, name: child.display_name };
}

function ensureChannel(courseId: string): string {
  const row = db.prepare("SELECT id FROM chat_channels WHERE course_id = ?").get(courseId) as { id: string } | undefined;
  if (row) return row.id;
  const id = newId();
  db.prepare("INSERT INTO chat_channels (id, course_id, created_at) VALUES (?, ?, ?)").run(id, courseId, nowIso());
  return id;
}

function messagesSince(scope: "channel" | "thread", scopeId: string, since?: string) {
  const rows = db.prepare(
    `SELECT id, sender_child_id, sender_parent_id, sender_name, body, created_at FROM chat_messages
     WHERE scope = ? AND scope_id = ? AND deleted_at IS NULL ${since ? "AND created_at > ?" : ""}
     ORDER BY created_at LIMIT 200`,
  ).all(...(since ? [scope, scopeId, since] : [scope, scopeId]));
  return rows;
}

// ---------- Canal do curso ----------
app.get("/api/chat/course/:courseId/channel", requireParent, (c) => {
  courseAccess(c, c.req.param("courseId"), c.req.query("child_id"));
  const channelId = ensureChannel(c.req.param("courseId"));
  return c.json({ messages: messagesSince("channel", channelId, c.req.query("since")) });
});

app.post("/api/chat/course/:courseId/channel", requireParent, async (c) => {
  const access = courseAccess(c, c.req.param("courseId"), c.req.query("child_id"));
  const { body, child_id } = await readJson(c, z.object({ body: z.string().trim().min(1).max(1000), child_id: z.string().nullish() }));
  const channelId = ensureChannel(c.req.param("courseId"));
  const id = newId();
  db.prepare(
    "INSERT INTO chat_messages (id, scope, scope_id, sender_child_id, sender_parent_id, sender_name, body, created_at) VALUES (?, 'channel', ?, ?, ?, ?, ?, ?)",
  ).run(id, channelId, access.childId, access.isStaff ? c.get("parentId") : null, access.name, body, nowIso());
  hub.publish(chatChannel("channel", channelId));
  return c.json({ id }, 201);
});

// ---------- DM estudante↔staff ----------
// Estudante abre thread com a EQUIPE do curso (auto = criador do curso). Nunca com outro aluno.
app.post("/api/chat/thread", requireParent, async (c) => {
  const parentId = c.get("parentId");
  const { course_id, child_id } = await readJson(c, z.object({ course_id: z.string().min(1), child_id: z.string().min(1) }));
  const access = courseAccess(c, course_id, child_id);
  if (access.isStaff) throw badRequest("staff_use_admin", "Staff inicia DM pelo painel de coaching.");
  const cs = course(course_id);
  const staff = cs.created_by; // professor responsável
  const existing = db.prepare("SELECT id FROM chat_threads WHERE course_id = ? AND child_id = ? AND staff_parent_id = ?").get(course_id, child_id, staff) as { id: string } | undefined;
  if (existing) return c.json({ id: existing.id });
  const id = newId();
  db.prepare("INSERT INTO chat_threads (id, course_id, child_id, staff_parent_id, created_at) VALUES (?, ?, ?, ?, ?)").run(id, course_id, child_id, staff, nowIso());
  return c.json({ id }, 201);
});

// Staff abre/acha thread com um aluno específico (coaching).
app.post("/api/chat/thread/staff", requireParent, async (c) => {
  const parentId = c.get("parentId");
  const me = parentRole(parentId);
  if (!STAFF_ROLES.includes(me.role)) throw forbidden("staff_only", "Apenas equipe.");
  const { course_id, child_id } = await readJson(c, z.object({ course_id: z.string().min(1), child_id: z.string().min(1) }));
  const cs = course(course_id);
  if (me.role !== "platform_admin" && me.institutionId !== cs.institution_id) throw forbidden("wrong_institution", "Outra instituição.");
  const existing = db.prepare("SELECT id FROM chat_threads WHERE course_id = ? AND child_id = ? AND staff_parent_id = ?").get(course_id, child_id, parentId) as { id: string } | undefined;
  if (existing) return c.json({ id: existing.id });
  const id = newId();
  db.prepare("INSERT INTO chat_threads (id, course_id, child_id, staff_parent_id, created_at) VALUES (?, ?, ?, ?, ?)").run(id, course_id, child_id, parentId, nowIso());
  return c.json({ id }, 201);
});

interface ThreadRow { id: string; course_id: string; child_id: string; staff_parent_id: string }
export function threadAccess(parentId: string, activeChild: string | null, threadId: string, childParam?: string | null): { thread: ThreadRow; isStaff: boolean; childId: string | null; name: string } {
  const t = db.prepare("SELECT * FROM chat_threads WHERE id = ?").get(threadId) as ThreadRow | undefined;
  if (!t) throw notFound("thread_not_found", "Conversa não encontrada.");
  if (t.staff_parent_id === parentId) {
    const p = db.prepare("SELECT email FROM parents WHERE id = ?").get(parentId) as { email: string };
    return { thread: t, isStaff: true, childId: null, name: "Prof. " + (p.email.split("@")[0] || "equipe") };
  }
  const childId = childParam || activeChild;
  if (childId === t.child_id) {
    ownChildOrThrow(parentId, childId);
    const ch = db.prepare("SELECT display_name FROM children WHERE id = ?").get(childId) as { display_name: string };
    return { thread: t, isStaff: false, childId, name: ch.display_name };
  }
  throw forbidden("not_participant", "Você não participa desta conversa.");
}

app.get("/api/chat/thread/:id", requireParent, (c) => {
  threadAccess(c.get("parentId"), c.get("activeChildId"), c.req.param("id"), c.req.query("child_id"));
  return c.json({ messages: messagesSince("thread", c.req.param("id"), c.req.query("since")) });
});

app.post("/api/chat/thread/:id", requireParent, async (c) => {
  const acc = threadAccess(c.get("parentId"), c.get("activeChildId"), c.req.param("id"), c.req.query("child_id"));
  const { body } = await readJson(c, z.object({ body: z.string().trim().min(1).max(1000) }));
  const id = newId();
  db.prepare(
    "INSERT INTO chat_messages (id, scope, scope_id, sender_child_id, sender_parent_id, sender_name, body, created_at) VALUES (?, 'thread', ?, ?, ?, ?, ?, ?)",
  ).run(id, c.req.param("id"), acc.childId, acc.isStaff ? c.get("parentId") : null, acc.name, body, nowIso());
  hub.publish(chatChannel("thread", c.req.param("id")));
  return c.json({ id }, 201);
});

// Lista de threads do estudante ativo.
app.get("/api/chat/threads", requireParent, (c) => {
  const parentId = c.get("parentId");
  const childId = c.req.query("child_id") || c.get("activeChildId") || "";
  if (childId) ownChildOrThrow(parentId, childId);
  const rows = db.prepare(
    `SELECT t.id, t.course_id, cs.title AS course_title FROM chat_threads t JOIN courses cs ON cs.id = t.course_id
     WHERE t.child_id = ? ORDER BY t.created_at DESC`,
  ).all(childId);
  return c.json({ threads: rows });
});

// Caixa de entrada da EQUIPE (DMs em que sou o staff responsável) — spec 14.3.
app.get("/api/admin/chat/threads", requireParent, (c) => {
  const parentId = c.get("parentId");
  const me = parentRole(parentId);
  if (!STAFF_ROLES.includes(me.role)) throw forbidden("staff_only", "Apenas equipe.");
  const rows = db.prepare(
    `SELECT t.id, t.course_id, cs.title AS course_title, ch.display_name AS student,
            (SELECT body FROM chat_messages m WHERE m.scope='thread' AND m.scope_id=t.id AND m.deleted_at IS NULL ORDER BY m.created_at DESC LIMIT 1) AS last_body,
            (SELECT created_at FROM chat_messages m WHERE m.scope='thread' AND m.scope_id=t.id AND m.deleted_at IS NULL ORDER BY m.created_at DESC LIMIT 1) AS last_at
     FROM chat_threads t JOIN courses cs ON cs.id = t.course_id JOIN children ch ON ch.id = t.child_id
     WHERE t.staff_parent_id = ? ORDER BY COALESCE(last_at, t.created_at) DESC LIMIT 100`,
  ).all(parentId);
  return c.json({ threads: rows });
});

export default app;
