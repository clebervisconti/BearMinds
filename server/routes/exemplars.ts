// Exemplares de pares (spec 17.2): professor promove as melhores submissões a conteúdo de estudo.
// Moderação obrigatória (staff nomeia) + consentimento do responsável (obrigatório antes de ficar visível
// aos colegas). Nunca automático.
import { Hono } from "hono";
import { z } from "zod";
import { db, newId, nowIso } from "../db.ts";
import {
  requireParent, requireRole, csrfGuard, ownChildOrThrow, staffInstitutionOrThrow,
} from "../lib/session.ts";
import { readJson, badRequest, notFound, forbidden, type AppEnv } from "../lib/http.ts";
import { audit } from "../lib/audit.ts";

const app = new Hono<AppEnv>();
app.use("/api/admin/*", csrfGuard);
app.use("/api/exemplars/*", csrfGuard);

const STAFF = ["professor", "tutor", "institution_admin"] as const;

function subCourse(submissionId: string): { sub: Record<string, unknown>; course_id: string; institution_id: string } {
  const sub = db.prepare(
    `SELECT s.*, m.course_id, cs.institution_id FROM submissions s
     JOIN content_items i ON i.id = s.item_id JOIN course_modules m ON m.id = i.module_id JOIN courses cs ON cs.id = m.course_id
     WHERE s.id = ?`,
  ).get(submissionId) as Record<string, unknown> | undefined;
  if (!sub) throw notFound("sub_not_found", "Submissão não encontrada.");
  return { sub, course_id: sub.course_id as string, institution_id: sub.institution_id as string };
}

// ---------- Staff: promover / listar / remover ----------
app.post("/api/admin/submissions/:id/promote-exemplar", requireParent, requireRole(...STAFF), async (c) => {
  const parentId = c.get("parentId");
  const { sub, course_id, institution_id } = subCourse(c.req.param("id"));
  staffInstitutionOrThrow(parentId, institution_id);
  if ((sub.status as string) !== "returned") throw badRequest("not_reviewed", "Só é possível promover uma submissão já avaliada.");
  const { note } = await readJson(c, z.object({ note: z.string().trim().max(600).nullish() }));

  const childId = sub.child_id as string;
  const id = newId();
  try {
    db.prepare(
      "INSERT INTO peer_exemplars (id, submission_id, course_id, child_id, promoted_by, note, consent_state, created_at) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)",
    ).run(id, sub.id as string, course_id, childId, parentId, note ?? null, nowIso());
  } catch {
    throw badRequest("already_promoted", "Esta submissão já foi promovida.");
  }
  const child = db.prepare("SELECT parent_id FROM children WHERE id = ?").get(childId) as { parent_id: string } | undefined;
  if (child) db.prepare(
    `INSERT INTO notifications (id, parent_id, child_id, kind, title, body, link, created_at)
     VALUES (?, ?, ?, 'system', '🌟 Sua tarefa pode virar exemplo', 'O professor quer destacar a tarefa do seu filho como exemplo de estudo para a turma. Sua autorização é necessária.', '/configuracoes', ?)`,
  ).run(newId(), child.parent_id, childId, nowIso());
  audit(`parent:${parentId}`, "exemplar_promote", `submission:${sub.id}`, { course_id });
  return c.json({ id }, 201);
});

app.get("/api/admin/courses/:id/exemplars", requireParent, requireRole(...STAFF), (c) => {
  const parentId = c.get("parentId");
  const courseId = c.req.param("id");
  const course = db.prepare("SELECT institution_id FROM courses WHERE id = ?").get(courseId) as { institution_id: string } | undefined;
  if (!course) throw notFound("course_not_found", "Curso não encontrado.");
  staffInstitutionOrThrow(parentId, course.institution_id);

  const rows = db.prepare(
    `SELECT e.id, e.note, e.consent_state, e.created_at, ch.display_name AS student, s.body_text
     FROM peer_exemplars e JOIN children ch ON ch.id = e.child_id JOIN submissions s ON s.id = e.submission_id
     WHERE e.course_id = ? ORDER BY e.created_at DESC`,
  ).all(courseId);
  return c.json({ exemplars: rows });
});

app.delete("/api/admin/exemplars/:id", requireParent, requireRole(...STAFF), (c) => {
  const parentId = c.get("parentId");
  const row = db.prepare("SELECT course_id FROM peer_exemplars WHERE id = ?").get(c.req.param("id")) as { course_id: string } | undefined;
  if (!row) throw notFound("exemplar_not_found", "Exemplar não encontrado.");
  const course = db.prepare("SELECT institution_id FROM courses WHERE id = ?").get(row.course_id) as { institution_id: string } | undefined;
  if (course) staffInstitutionOrThrow(parentId, course.institution_id);
  db.prepare("DELETE FROM peer_exemplars WHERE id = ?").run(c.req.param("id"));
  audit(`parent:${parentId}`, "exemplar_remove", `exemplar:${c.req.param("id")}`);
  return c.json({ ok: true });
});

// ---------- Responsável: consentir / negar ----------
app.get("/api/exemplars/pending", requireParent, (c) => {
  const parentId = c.get("parentId");
  const rows = db.prepare(
    `SELECT e.id, e.note, e.created_at, ch.display_name AS student, cs.title AS course_title
     FROM peer_exemplars e JOIN children ch ON ch.id = e.child_id JOIN courses cs ON cs.id = e.course_id
     WHERE ch.parent_id = ? AND e.consent_state = 'pending' ORDER BY e.created_at DESC`,
  ).all(parentId);
  return c.json({ pending: rows });
});

app.post("/api/exemplars/:id/consent", requireParent, async (c) => {
  const parentId = c.get("parentId");
  const row = db.prepare(
    `SELECT e.id, e.child_id FROM peer_exemplars e JOIN children ch ON ch.id = e.child_id WHERE e.id = ? AND ch.parent_id = ?`,
  ).get(c.req.param("id"), parentId) as { id: string; child_id: string } | undefined;
  if (!row) throw notFound("exemplar_not_found", "Exemplar não encontrado.");
  const { granted } = await readJson(c, z.object({ granted: z.boolean() }));
  db.prepare("UPDATE peer_exemplars SET consent_state = ?, consent_at = ? WHERE id = ?").run(granted ? "granted" : "denied", nowIso(), row.id);
  audit(`parent:${parentId}`, granted ? "exemplar_consent_grant" : "exemplar_consent_deny", `exemplar:${row.id}`);
  return c.json({ ok: true });
});

// ---------- Estudante: ver exemplares aprovados do curso ----------
app.get("/api/learn/courses/:id/exemplars", requireParent, (c) => {
  const parentId = c.get("parentId");
  const childId = c.req.query("child_id") || c.get("activeChildId") || "";
  if (!childId) throw notFound("no_child", "Nenhum perfil ativo.");
  ownChildOrThrow(parentId, childId);
  const courseId = c.req.param("id");
  const enrolled = db.prepare("SELECT 1 FROM enrollments WHERE child_id = ? AND course_id = ?").get(childId, courseId);
  if (!enrolled) throw forbidden("not_enrolled", "Inscreva-se no curso primeiro.");

  const rows = db.prepare(
    `SELECT e.id, e.note, e.created_at, ch.display_name AS student, s.body_text
     FROM peer_exemplars e JOIN children ch ON ch.id = e.child_id JOIN submissions s ON s.id = e.submission_id
     WHERE e.course_id = ? AND e.consent_state = 'granted' ORDER BY e.created_at DESC`,
  ).all(courseId);
  return c.json({ exemplars: rows });
});

export default app;
