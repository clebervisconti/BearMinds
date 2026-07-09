// Readiness 2.0 (spec 17.4): dashboard professor/responsável — prontidão = rollup ponderado de
// conhecimento (FSRS) + habilidade (rubricas) + execução (provas), por curso e por aluno.
import { Hono } from "hono";
import { db } from "../db.ts";
import { requireParent, requireRole, ownChildOrThrow, staffInstitutionOrThrow } from "../lib/session.ts";
import { badRequest, notFound, type AppEnv } from "../lib/http.ts";
import { readinessForCodes } from "../mastery/today.ts";
import { rollupReadiness } from "../lib/readiness.ts";

const app = new Hono<AppEnv>();

function courseBnccCodes(courseId: string): string[] {
  const rows = db.prepare(
    `SELECT payload_json FROM content_items i JOIN course_modules m ON m.id = i.module_id
     WHERE m.course_id = ? AND i.status = 'published' AND i.payload_json IS NOT NULL`,
  ).all(courseId) as { payload_json: string }[];
  const codes = new Set<string>();
  for (const r of rows) {
    try {
      const p = JSON.parse(r.payload_json) as { bncc_code?: string };
      if (p.bncc_code) codes.add(p.bncc_code);
    } catch { /* payload inválido */ }
  }
  return [...codes];
}

function skillFraction(childId: string, courseId: string): number | null {
  const rows = db.prepare(
    `SELECT sub.item_id, MAX(rev.points) AS points, i.payload_json
     FROM submission_reviews rev
     JOIN submissions sub ON sub.id = rev.submission_id
     JOIN content_items i ON i.id = sub.item_id
     JOIN course_modules m ON m.id = i.module_id
     WHERE m.course_id = ? AND sub.child_id = ? GROUP BY sub.item_id`,
  ).all(courseId, childId) as { item_id: string; points: number; payload_json: string | null }[];
  if (rows.length === 0) return null;
  let sum = 0;
  for (const r of rows) {
    let max = 100;
    try { max = Number((r.payload_json ? JSON.parse(r.payload_json) : {}).max_points || 100); } catch { /* payload inválido */ }
    sum += max > 0 ? r.points / max : 0;
  }
  return sum / rows.length;
}

function executionFraction(childId: string, courseId: string): number | null {
  const row = db.prepare(
    `SELECT AVG(best) AS avg FROM (
       SELECT MAX(ea.score) AS best FROM exam_attempts ea JOIN exams e ON e.id = ea.exam_id
       WHERE e.course_id = ? AND ea.child_id = ? AND ea.submitted_at IS NOT NULL GROUP BY ea.exam_id
     )`,
  ).get(courseId, childId) as { avg: number | null } | undefined;
  return row?.avg ?? null;
}

function studentReadiness(childId: string, courseId: string, codes: string[]) {
  const knowledge = codes.length > 0 ? readinessForCodes(childId, codes) : null;
  const skill = skillFraction(childId, courseId);
  const execution = executionFraction(childId, courseId);
  return {
    knowledge, skill, execution,
    overall: rollupReadiness({ knowledge, skill, execution }),
  };
}

const STAFF = ["professor", "tutor", "institution_admin"] as const;

app.get("/api/admin/courses/:id/readiness", requireParent, requireRole(...STAFF), (c) => {
  const parentId = c.get("parentId");
  const courseId = c.req.param("id");
  const course = db.prepare("SELECT institution_id FROM courses WHERE id = ?").get(courseId) as { institution_id: string } | undefined;
  if (!course) throw notFound("course_not_found", "Curso não encontrado.");
  staffInstitutionOrThrow(parentId, course.institution_id);

  const codes = courseBnccCodes(courseId);
  const students = db.prepare(
    `SELECT c.id, c.display_name FROM children c JOIN enrollments e ON e.child_id = c.id WHERE e.course_id = ? AND c.deleted_at IS NULL ORDER BY c.display_name`,
  ).all(courseId) as { id: string; display_name: string }[];

  const rows = students.map((s) => ({ id: s.id, display_name: s.display_name, ...studentReadiness(s.id, courseId, codes) }));
  const overallVals = rows.map((r) => r.overall).filter((v): v is number => v !== null);
  const courseAverage = overallVals.length > 0 ? overallVals.reduce((a, v) => a + v, 0) / overallVals.length : null;

  return c.json({ students: rows, course_average: courseAverage });
});

app.get("/api/my/readiness", requireParent, (c) => {
  const parentId = c.get("parentId");
  const childId = c.req.query("child_id");
  if (!childId) throw badRequest("child_id_required", "Informe o child_id.");
  ownChildOrThrow(parentId, childId);

  const courses = db.prepare(
    `SELECT id, title, cover_emoji FROM courses WHERE id IN (SELECT course_id FROM enrollments WHERE child_id = ?)`,
  ).all(childId) as { id: string; title: string; cover_emoji: string }[];

  const result = courses.map((course) => {
    const codes = courseBnccCodes(course.id);
    return { id: course.id, title: course.title, cover_emoji: course.cover_emoji, ...studentReadiness(childId, course.id, codes) };
  });
  return c.json({ courses: result });
});

export default app;
