// Correlação pós-prova (P5-r, roadmap 11): prontidão prevista × desempenho real, acelerada pelas
// provas do P5a. LIMITAÇÃO de MVP: a prontidão "prevista" usa o estado FSRS ATUAL do aluno (não há
// snapshot histórico do estado no momento da prova) — funciona como diagnóstico agregado de quão bem
// a retrievability prediz desempenho em prova, não como replay exato do passado.
import { Hono } from "hono";
import { db } from "../db.ts";
import { requireParent, requireRole, staffInstitutionOrThrow } from "../lib/session.ts";
import { notFound, type AppEnv } from "../lib/http.ts";
import { readinessForCodes } from "../mastery/today.ts";
import { pearsonCorrelation, type CorrelationPoint } from "../lib/correlation.ts";

const app = new Hono<AppEnv>();
const STAFF = ["professor", "tutor", "institution_admin"] as const;

app.get("/api/admin/courses/:id/prediction-correlation", requireParent, requireRole(...STAFF), (c) => {
  const parentId = c.get("parentId");
  const courseId = c.req.param("id");
  const course = db.prepare("SELECT institution_id FROM courses WHERE id = ?").get(courseId) as { institution_id: string } | undefined;
  if (!course) throw notFound("course_not_found", "Curso não encontrado.");
  staffInstitutionOrThrow(parentId, course.institution_id);

  const exams = db.prepare("SELECT id, pool_json FROM exams WHERE course_id = ? AND status IN ('published','closed')").all(courseId) as { id: string; pool_json: string }[];
  const attempts = db.prepare(
    `SELECT ea.exam_id, ea.child_id, ea.score FROM exam_attempts ea
     JOIN exams e ON e.id = ea.exam_id WHERE e.course_id = ? AND ea.submitted_at IS NOT NULL`,
  ).all(courseId) as { exam_id: string; child_id: string; score: number }[];

  const poolCodes = new Map<string, string[]>();
  for (const e of exams) {
    try {
      const pool = JSON.parse(e.pool_json) as { bncc_codes?: string[] };
      poolCodes.set(e.id, pool.bncc_codes ?? []);
    } catch { poolCodes.set(e.id, []); }
  }

  const points: (CorrelationPoint & { child_id: string; exam_id: string })[] = [];
  for (const a of attempts) {
    const codes = poolCodes.get(a.exam_id) ?? [];
    if (codes.length === 0) continue;
    const predicted = readinessForCodes(a.child_id, codes);
    points.push({ predicted, actual: a.score, child_id: a.child_id, exam_id: a.exam_id });
  }

  return c.json({
    points,
    correlation: pearsonCorrelation(points),
    n: points.length,
    note: "Prontidão prevista usa o estado FSRS atual do aluno (aproximação — sem snapshot histórico no momento da prova).",
  });
});

export default app;
