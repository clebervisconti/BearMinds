// Auto-avaliação vs avaliação do professor (spec 17.3): metacognição — o aluno se avalia com a MESMA
// rubrica antes/depois da correção; o gap entre autoavaliação e nota do professor é ouro pedagógico.
import { Hono } from "hono";
import { z } from "zod";
import { db, newId, nowIso } from "../db.ts";
import { requireParent, requireRole, csrfGuard, ownChildOrThrow, staffInstitutionOrThrow } from "../lib/session.ts";
import { readJson, badRequest, notFound, type AppEnv } from "../lib/http.ts";
import { scoreRubric, type RubricSection } from "../lib/rubric.ts";

const app = new Hono<AppEnv>();
app.use("/api/learn/*", csrfGuard);
app.use("/api/admin/*", csrfGuard);

const STAFF = ["professor", "tutor", "institution_admin"] as const;

app.post("/api/learn/submissions/:id/self-assess", requireParent, async (c) => {
  const parentId = c.get("parentId");
  const sub = db.prepare(
    `SELECT s.id, s.child_id, s.item_id, i.payload_json FROM submissions s JOIN content_items i ON i.id = s.item_id WHERE s.id = ?`,
  ).get(c.req.param("id")) as { id: string; child_id: string; item_id: string; payload_json: string | null } | undefined;
  if (!sub) throw notFound("sub_not_found", "Submissão não encontrada.");
  ownChildOrThrow(parentId, sub.child_id);

  const b = await readJson(c, z.object({
    rubric_id: z.string().nullish(),
    selections: z.array(z.array(z.number().int())).nullish(),
    points: z.number().min(0).max(1000).nullish(),
    reflection: z.string().trim().max(2000).nullish(),
  }));
  let points = b.points ?? null;
  let rubricScores: unknown = null;
  if (b.rubric_id && b.selections) {
    const rub = db.prepare("SELECT sections_json FROM rubrics WHERE id = ?").get(b.rubric_id) as { sections_json: string } | undefined;
    if (!rub) throw notFound("rubric_not_found", "Rubrica não encontrada.");
    const payload = sub.payload_json ? JSON.parse(sub.payload_json) as { max_points?: number } : {};
    const scored = scoreRubric(JSON.parse(rub.sections_json) as RubricSection[], b.selections, payload.max_points ?? 100);
    points = scored.points;
    rubricScores = { rubric_id: b.rubric_id, selections: b.selections, fraction: scored.fraction };
  }
  if (points === null) throw badRequest("no_score", "Informe uma pontuação (direto ou via rubrica).");

  db.prepare(
    `INSERT INTO submission_self_assessments (id, submission_id, child_id, rubric_scores_json, points, reflection, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(submission_id) DO UPDATE SET rubric_scores_json = excluded.rubric_scores_json,
       points = excluded.points, reflection = excluded.reflection, created_at = excluded.created_at`,
  ).run(newId(), sub.id, sub.child_id, rubricScores ? JSON.stringify(rubricScores) : null, points, b.reflection ?? null, nowIso());
  return c.json({ ok: true, points });
});

app.get("/api/learn/submissions/:id/self-assess", requireParent, (c) => {
  const parentId = c.get("parentId");
  const sub = db.prepare("SELECT id, child_id FROM submissions WHERE id = ?").get(c.req.param("id")) as { id: string; child_id: string } | undefined;
  if (!sub) throw notFound("sub_not_found", "Submissão não encontrada.");
  ownChildOrThrow(parentId, sub.child_id);
  const row = db.prepare("SELECT points, reflection, created_at FROM submission_self_assessments WHERE submission_id = ?").get(sub.id);
  return c.json({ self_assessment: row ?? null });
});

// ---------- Staff: visão do gap agregado por curso ----------
app.get("/api/admin/courses/:id/self-assessment-gap", requireParent, requireRole(...STAFF), (c) => {
  const parentId = c.get("parentId");
  const courseId = c.req.param("id");
  const course = db.prepare("SELECT institution_id FROM courses WHERE id = ?").get(courseId) as { institution_id: string } | undefined;
  if (!course) throw notFound("course_not_found", "Curso não encontrado.");
  staffInstitutionOrThrow(parentId, course.institution_id);

  const rows = db.prepare(
    `SELECT s.id AS submission_id, ch.display_name AS student, i.title AS item_title,
            sa.points AS self_points, i.payload_json,
            (SELECT points FROM submission_reviews r WHERE r.submission_id = s.id ORDER BY r.created_at DESC LIMIT 1) AS teacher_points
     FROM submissions s
     JOIN content_items i ON i.id = s.item_id
     JOIN course_modules m ON m.id = i.module_id
     JOIN children ch ON ch.id = s.child_id
     JOIN submission_self_assessments sa ON sa.submission_id = s.id
     WHERE m.course_id = ?
     ORDER BY sa.created_at DESC`,
  ).all(courseId) as { submission_id: string; student: string; item_title: string; self_points: number; payload_json: string | null; teacher_points: number | null }[];

  const withGap = rows
    .filter((r) => r.teacher_points !== null)
    .map((r) => {
      let max = 100;
      try { max = Number((r.payload_json ? JSON.parse(r.payload_json) : {}).max_points || 100); } catch { /* payload inválido */ }
      const selfFrac = max > 0 ? r.self_points / max : 0;
      const teacherFrac = max > 0 ? (r.teacher_points as number) / max : 0;
      return {
        submission_id: r.submission_id, student: r.student, item_title: r.item_title,
        self_fraction: selfFrac, teacher_fraction: teacherFrac, gap: selfFrac - teacherFrac, // >0 = superestimou
      };
    });

  const avgGap = withGap.length > 0 ? withGap.reduce((a, r) => a + r.gap, 0) / withGap.length : null;
  return c.json({ submissions: withGap, average_gap: avgGap, pending_teacher_review: rows.length - withGap.length });
});

export default app;
