// Grupos dentro do curso (spec 16.6): turmas paralelas compartilhando um só conteúdo.
import { Hono } from "hono";
import { z } from "zod";
import { db, newId, nowIso } from "../db.ts";
import { requireParent, requireRole, csrfGuard, staffInstitutionOrThrow } from "../lib/session.ts";
import { readJson, badRequest, notFound, type AppEnv } from "../lib/http.ts";
import { audit } from "../lib/audit.ts";

const app = new Hono<AppEnv>();
app.use("/api/admin/courses/*", csrfGuard);
app.use("/api/admin/groups/*", csrfGuard);

const STAFF = ["professor", "tutor", "institution_admin"] as const;

function courseOrThrow(courseId: string): { institution_id: string } {
  const c = db.prepare("SELECT institution_id FROM courses WHERE id = ?").get(courseId) as { institution_id: string } | undefined;
  if (!c) throw notFound("course_not_found", "Curso não encontrado.");
  return c;
}

app.get("/api/admin/courses/:id/groups", requireParent, requireRole(...STAFF), (c) => {
  const courseId = c.req.param("id");
  const parentId = c.get("parentId");
  const course = courseOrThrow(courseId);
  staffInstitutionOrThrow(parentId, course.institution_id);

  const groups = db.prepare(
    `SELECT g.id, g.title, g.created_at, COUNT(e.id) AS members
     FROM course_groups g LEFT JOIN enrollments e ON e.group_id = g.id
     WHERE g.course_id = ? GROUP BY g.id ORDER BY g.created_at`
  ).all(courseId) as { id: string; title: string; created_at: string; members: number }[];

  const unassigned = (db.prepare(
    "SELECT COUNT(*) n FROM enrollments WHERE course_id = ? AND group_id IS NULL"
  ).get(courseId) as { n: number }).n;

  return c.json({ groups, unassigned });
});

app.post("/api/admin/courses/:id/groups", requireParent, requireRole(...STAFF), async (c) => {
  const courseId = c.req.param("id");
  const parentId = c.get("parentId");
  const course = courseOrThrow(courseId);
  staffInstitutionOrThrow(parentId, course.institution_id);
  const { title } = await readJson(c, z.object({ title: z.string().trim().min(2).max(80) }));

  const id = newId();
  db.prepare("INSERT INTO course_groups (id, course_id, title, created_at) VALUES (?, ?, ?, ?)").run(id, courseId, title, nowIso());
  audit(`parent:${parentId}`, "group_create", `group:${id}`, { course_id: courseId, title });
  return c.json({ id }, 201);
});

app.delete("/api/admin/groups/:groupId", requireParent, requireRole(...STAFF), (c) => {
  const groupId = c.req.param("groupId");
  const parentId = c.get("parentId");
  const group = db.prepare("SELECT course_id FROM course_groups WHERE id = ?").get(groupId) as { course_id: string } | undefined;
  if (!group) throw notFound("group_not_found", "Grupo não encontrado.");
  const course = courseOrThrow(group.course_id);
  staffInstitutionOrThrow(parentId, course.institution_id);

  db.prepare("UPDATE enrollments SET group_id = NULL WHERE group_id = ?").run(groupId);
  db.prepare("DELETE FROM course_groups WHERE id = ?").run(groupId);
  audit(`parent:${parentId}`, "group_delete", `group:${groupId}`, { course_id: group.course_id });
  return c.json({ ok: true });
});

app.post("/api/admin/groups/:groupId/assign", requireParent, requireRole(...STAFF), async (c) => {
  const groupId = c.req.param("groupId");
  const parentId = c.get("parentId");
  const group = db.prepare("SELECT course_id FROM course_groups WHERE id = ?").get(groupId) as { course_id: string } | undefined;
  if (!group) throw notFound("group_not_found", "Grupo não encontrado.");
  const course = courseOrThrow(group.course_id);
  staffInstitutionOrThrow(parentId, course.institution_id);
  const { child_ids } = await readJson(c, z.object({ child_ids: z.array(z.string()).min(1).max(200) }));

  if (child_ids.length === 0) throw badRequest("empty", "Selecione ao menos um aluno.");
  const upd = db.prepare("UPDATE enrollments SET group_id = ? WHERE course_id = ? AND child_id = ?");
  let assigned = 0;
  for (const childId of child_ids) {
    const r = upd.run(groupId, group.course_id, childId);
    assigned += Number(r.changes);
  }
  return c.json({ assigned });
});

// Remove um aluno do grupo (volta a "sem grupo", sem desmatricular).
app.post("/api/admin/courses/:id/groups/unassign", requireParent, requireRole(...STAFF), async (c) => {
  const courseId = c.req.param("id");
  const parentId = c.get("parentId");
  const course = courseOrThrow(courseId);
  staffInstitutionOrThrow(parentId, course.institution_id);
  const { child_id } = await readJson(c, z.object({ child_id: z.string().min(1) }));
  db.prepare("UPDATE enrollments SET group_id = NULL WHERE course_id = ? AND child_id = ?").run(courseId, child_id);
  return c.json({ ok: true });
});

export default app;
