// Banco de questões (spec 15.2) + Provas (spec 15.3).
// Banco: desacoplado do quiz, BNCC+tags, versionado, IA preenche / professor cura.
// Provas: pool = filtro + sorteio reproduzível por seed; auto-correção; score → evidência de prontidão.
import { Hono } from "hono";
import { z } from "zod";
import { db, newId, nowIso } from "../db.ts";
import { requireParent, requireRole, csrfGuard, ownChildOrThrow, staffInstitutionOrThrow } from "../lib/session.ts";
import { readJson, badRequest, forbidden, notFound, conflict, type AppEnv } from "../lib/http.ts";
import { seededShuffle, gradeResponse, isAutoGradable, type BankKind } from "../exams/grade.ts";
import { emitEvent } from "../lib/events.ts";

const app = new Hono<AppEnv>();
app.use("/api/admin/bank/*", csrfGuard);
app.use("/api/admin/courses/*", csrfGuard);
app.use("/api/admin/exams/*", csrfGuard);
app.use("/api/exams/*", csrfGuard);

const STAFF = ["professor", "institution_admin"] as const;

interface CourseRow { id: string; institution_id: string }
function course(id: string): CourseRow {
  const r = db.prepare("SELECT id, institution_id FROM courses WHERE id = ?").get(id) as CourseRow | undefined;
  if (!r) throw notFound("course_not_found", "Curso não encontrado.");
  return r;
}
function staffCourse(parentId: string, courseId: string): CourseRow {
  const cs = course(courseId);
  staffInstitutionOrThrow(parentId, cs.institution_id);
  return cs;
}

// ============================================================
// BANCO DE QUESTÕES (spec 15.2)
// ============================================================
const questionInput = z.object({
  kind: z.enum(["mcq", "tf", "short", "numeric"]),
  prompt: z.string().trim().min(3).max(1000),
  options: z.array(z.string().trim().min(1).max(300)).min(2).max(6).nullish(),
  answer: z.unknown(),                    // index / bool / {value,tolerance} / {accepted:[]}
  explanation: z.string().max(1000).nullish(),
  bncc_code: z.string().max(40).nullish(),
  tags: z.array(z.string().max(40)).max(10).nullish(),
  difficulty: z.number().int().min(1).max(3).default(2),
});

function validateAnswer(kind: string, options: string[] | null | undefined, answer: unknown): void {
  if (kind === "mcq") {
    if (!options || options.length < 2) throw badRequest("bad_options", "MCQ precisa de ao menos 2 opções.");
    if (typeof answer !== "number" || answer < 0 || answer >= options.length) throw badRequest("bad_answer", "answer deve ser o índice da opção correta.");
  } else if (kind === "tf") {
    if (typeof answer !== "boolean") throw badRequest("bad_answer", "answer deve ser true/false.");
  } else if (kind === "numeric") {
    const a = answer as { value?: unknown };
    if (!a || typeof a.value !== "number") throw badRequest("bad_answer", "answer.numeric precisa de {value, tolerance}.");
  } else if (kind === "short") {
    const a = answer as { accepted?: unknown };
    if (!a || !Array.isArray(a.accepted) || a.accepted.length === 0) throw badRequest("bad_answer", "answer.short precisa de {accepted:[...]}.");
  }
}

app.get("/api/admin/courses/:courseId/bank", requireParent, requireRole(...STAFF), (c) => {
  staffCourse(c.get("parentId"), c.req.param("courseId"));
  const status = c.req.query("status");
  const bncc = c.req.query("bncc");
  const diff = c.req.query("difficulty");
  const where = ["course_id = ?"];
  const vals: unknown[] = [c.req.param("courseId")];
  if (status) { where.push("status = ?"); vals.push(status); }
  if (bncc) { where.push("bncc_code = ?"); vals.push(bncc); }
  if (diff) { where.push("difficulty = ?"); vals.push(Number(diff)); }
  const rows = db.prepare(
    `SELECT id, bncc_code, tags_json, kind, prompt, options_json, answer_json, explanation, difficulty, status, origin, verified_at, version
     FROM bank_questions WHERE ${where.join(" AND ")} ORDER BY status, created_at DESC LIMIT 500`,
  ).all(...vals) as Record<string, unknown>[];
  const questions = rows.map((r) => ({
    id: r.id, bncc_code: r.bncc_code, tags: r.tags_json ? JSON.parse(r.tags_json as string) : [],
    kind: r.kind, prompt: r.prompt, options: r.options_json ? JSON.parse(r.options_json as string) : null,
    answer: JSON.parse(r.answer_json as string), explanation: r.explanation, difficulty: r.difficulty,
    status: r.status, origin: r.origin, approved: !!r.verified_at, version: r.version,
  }));
  // contagem por status p/ o header do banco
  const counts = db.prepare("SELECT status, COUNT(*) n FROM bank_questions WHERE course_id = ? GROUP BY status").all(c.req.param("courseId")) as { status: string; n: number }[];
  return c.json({ questions, counts: Object.fromEntries(counts.map((x) => [x.status, x.n])) });
});

app.post("/api/admin/courses/:courseId/bank", requireParent, requireRole(...STAFF), async (c) => {
  const parentId = c.get("parentId");
  staffCourse(parentId, c.req.param("courseId"));
  const b = await readJson(c, questionInput);
  validateAnswer(b.kind, b.options, b.answer);
  const id = newId();
  db.prepare(
    `INSERT INTO bank_questions (id, course_id, bncc_code, tags_json, kind, prompt, options_json, answer_json, explanation, difficulty, status, origin, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 'staff', ?, ?)`,
  ).run(id, c.req.param("courseId"), b.bncc_code ?? null, b.tags ? JSON.stringify(b.tags) : null, b.kind, b.prompt,
    b.options ? JSON.stringify(b.options) : null, JSON.stringify(b.answer), b.explanation ?? null, b.difficulty, parentId, nowIso());
  return c.json({ id }, 201);
});

// Editar questão APROVADA cria nova versão (a antiga vira 'retired'); questão draft edita in-place.
app.patch("/api/admin/bank/:id", requireParent, requireRole(...STAFF), async (c) => {
  const parentId = c.get("parentId");
  const q = db.prepare("SELECT * FROM bank_questions WHERE id = ?").get(c.req.param("id")) as Record<string, unknown> | undefined;
  if (!q) throw notFound("q_not_found", "Questão não encontrada.");
  if (q.course_id) staffCourse(parentId, q.course_id as string);
  const b = await readJson(c, questionInput);
  validateAnswer(b.kind, b.options, b.answer);
  if (q.status === "approved") {
    const nid = newId();
    db.prepare(
      `INSERT INTO bank_questions (id, course_id, bncc_code, tags_json, kind, prompt, options_json, answer_json, explanation, difficulty, status, origin, created_by, version, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 'staff', ?, ?, ?)`,
    ).run(nid, q.course_id, b.bncc_code ?? null, b.tags ? JSON.stringify(b.tags) : null, b.kind, b.prompt,
      b.options ? JSON.stringify(b.options) : null, JSON.stringify(b.answer), b.explanation ?? null, b.difficulty, parentId, Number(q.version) + 1, nowIso());
    db.prepare("UPDATE bank_questions SET status = 'retired', replaced_by = ? WHERE id = ?").run(nid, q.id);
    return c.json({ id: nid, versioned: true });
  }
  db.prepare(
    "UPDATE bank_questions SET kind=?, prompt=?, options_json=?, answer_json=?, explanation=?, bncc_code=?, tags_json=?, difficulty=? WHERE id=?",
  ).run(b.kind, b.prompt, b.options ? JSON.stringify(b.options) : null, JSON.stringify(b.answer), b.explanation ?? null,
    b.bncc_code ?? null, b.tags ? JSON.stringify(b.tags) : null, b.difficulty, q.id);
  return c.json({ id: q.id, versioned: false });
});

app.post("/api/admin/bank/:id/approve", requireParent, requireRole(...STAFF), (c) => {
  const parentId = c.get("parentId");
  const q = db.prepare("SELECT course_id, status FROM bank_questions WHERE id = ?").get(c.req.param("id")) as { course_id: string | null; status: string } | undefined;
  if (!q) throw notFound("q_not_found", "Questão não encontrada.");
  if (q.course_id) staffCourse(parentId, q.course_id);
  db.prepare("UPDATE bank_questions SET status = 'approved', verified_by = ?, verified_at = ? WHERE id = ?").run(parentId, nowIso(), c.req.param("id"));
  return c.json({ ok: true });
});

app.delete("/api/admin/bank/:id", requireParent, requireRole(...STAFF), (c) => {
  const parentId = c.get("parentId");
  const q = db.prepare("SELECT course_id FROM bank_questions WHERE id = ?").get(c.req.param("id")) as { course_id: string | null } | undefined;
  if (!q) throw notFound("q_not_found", "Questão não encontrada.");
  if (q.course_id) staffCourse(parentId, q.course_id);
  db.prepare("UPDATE bank_questions SET status = 'retired' WHERE id = ?").run(c.req.param("id"));
  return c.json({ ok: true });
});

// ============================================================
// PROVAS (spec 15.3)
// ============================================================
interface PoolFilter { bncc_codes?: string[] | null; tags?: string[] | null; difficulty?: number[] | null; n: number }

/** IDs de questões APROVADAS que casam o pool (sem sorteio). */
function poolCandidates(courseId: string, pool: PoolFilter): string[] {
  const where = ["course_id = ?", "status = 'approved'"];
  const vals: unknown[] = [courseId];
  if (pool.bncc_codes?.length) { where.push(`bncc_code IN (${pool.bncc_codes.map(() => "?").join(",")})`); vals.push(...pool.bncc_codes); }
  if (pool.difficulty?.length) { where.push(`difficulty IN (${pool.difficulty.map(() => "?").join(",")})`); vals.push(...pool.difficulty); }
  const rows = db.prepare(`SELECT id, tags_json FROM bank_questions WHERE ${where.join(" AND ")}`).all(...vals) as { id: string; tags_json: string | null }[];
  if (pool.tags?.length) {
    const want = new Set(pool.tags);
    return rows.filter((r) => { const t = r.tags_json ? (JSON.parse(r.tags_json) as string[]) : []; return t.some((x) => want.has(x)); }).map((r) => r.id);
  }
  return rows.map((r) => r.id);
}

const poolSchema = z.object({
  bncc_codes: z.array(z.string()).nullish(),
  tags: z.array(z.string()).nullish(),
  difficulty: z.array(z.number().int().min(1).max(3)).nullish(),
  n: z.number().int().min(1).max(50),
});
const examInput = z.object({
  title: z.string().trim().min(2).max(140),
  description: z.string().max(1000).nullish(),
  pool: poolSchema,
  duration_min: z.number().int().min(1).max(300).nullish(),
  opens_at: z.string().nullish(),
  due_at: z.string().nullish(),
  attempts_allowed: z.number().int().min(1).max(5).default(1),
});

app.get("/api/admin/courses/:courseId/exams", requireParent, requireRole(...STAFF), (c) => {
  staffCourse(c.get("parentId"), c.req.param("courseId"));
  const rows = db.prepare("SELECT id, title, pool_json, duration_min, opens_at, due_at, attempts_allowed, status FROM exams WHERE course_id = ? ORDER BY created_at DESC").all(c.req.param("courseId")) as Record<string, unknown>[];
  const exams = rows.map((e) => {
    const pool = JSON.parse(e.pool_json as string) as PoolFilter;
    const available = poolCandidates(c.req.param("courseId"), pool).length;
    const attempts = (db.prepare("SELECT COUNT(DISTINCT child_id) n FROM exam_attempts WHERE exam_id = ?").get(e.id) as { n: number }).n;
    return { id: e.id, title: e.title, pool, duration_min: e.duration_min, opens_at: e.opens_at, due_at: e.due_at, attempts_allowed: e.attempts_allowed, status: e.status, pool_available: available, students_attempted: attempts };
  });
  return c.json({ exams });
});

app.post("/api/admin/courses/:courseId/exams", requireParent, requireRole(...STAFF), async (c) => {
  const parentId = c.get("parentId");
  staffCourse(parentId, c.req.param("courseId"));
  const b = await readJson(c, examInput);
  if (poolCandidates(c.req.param("courseId"), b.pool).length < b.pool.n) throw badRequest("pool_too_small", "O pool aprovado tem menos questões do que o nº pedido. Aprove mais questões no banco.");
  const id = newId();
  db.prepare(
    "INSERT INTO exams (id, course_id, title, description, pool_json, duration_min, opens_at, due_at, attempts_allowed, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)",
  ).run(id, c.req.param("courseId"), b.title, b.description ?? null, JSON.stringify(b.pool), b.duration_min ?? null, b.opens_at ?? null, b.due_at ?? null, b.attempts_allowed, parentId, nowIso());
  return c.json({ id }, 201);
});

app.patch("/api/admin/exams/:id", requireParent, requireRole(...STAFF), async (c) => {
  const parentId = c.get("parentId");
  const e = db.prepare("SELECT course_id FROM exams WHERE id = ?").get(c.req.param("id")) as { course_id: string } | undefined;
  if (!e) throw notFound("exam_not_found", "Prova não encontrada.");
  staffCourse(parentId, e.course_id);
  const b = await readJson(c, z.object({ status: z.enum(["draft", "published", "closed"]) }));
  db.prepare("UPDATE exams SET status = ? WHERE id = ?").run(b.status, c.req.param("id"));
  return c.json({ ok: true });
});

// Resultados: % de acerto por questão + por aluno (spec 15.3).
app.get("/api/admin/exams/:id/results", requireParent, requireRole(...STAFF), (c) => {
  const parentId = c.get("parentId");
  const e = db.prepare("SELECT course_id, title FROM exams WHERE id = ?").get(c.req.param("id")) as { course_id: string; title: string } | undefined;
  if (!e) throw notFound("exam_not_found", "Prova não encontrada.");
  staffCourse(parentId, e.course_id);
  const attempts = db.prepare(
    `SELECT a.child_id, ch.display_name, a.score, a.submitted_at FROM exam_attempts a JOIN children ch ON ch.id = a.child_id
     WHERE a.exam_id = ? AND a.submitted_at IS NOT NULL ORDER BY a.score DESC`,
  ).all(c.req.param("id")) as { child_id: string; display_name: string; score: number; submitted_at: string }[];
  // % por questão
  const perQ: Record<string, { correct: number; total: number }> = {};
  const rows = db.prepare("SELECT answers_json FROM exam_attempts WHERE exam_id = ? AND submitted_at IS NOT NULL").all(c.req.param("id")) as { answers_json: string | null }[];
  for (const r of rows) {
    const graded = r.answers_json ? (JSON.parse(r.answers_json) as { qid: string; correct: boolean }[]) : [];
    for (const g of graded) { perQ[g.qid] ??= { correct: 0, total: 0 }; perQ[g.qid].total++; if (g.correct) perQ[g.qid].correct++; }
  }
  const perQuestion = Object.entries(perQ).map(([qid, s]) => {
    const q = db.prepare("SELECT prompt FROM bank_questions WHERE id = ?").get(qid) as { prompt: string } | undefined;
    return { qid, prompt: q?.prompt ?? "(removida)", pct: s.total ? Math.round((s.correct / s.total) * 100) : 0, total: s.total };
  }).sort((a, b) => a.pct - b.pct);
  return c.json({ title: e.title, attempts, per_question: perQuestion });
});

// ---------- Lado do estudante ----------
app.get("/api/exams", requireParent, (c) => {
  const parentId = c.get("parentId");
  const courseId = c.req.query("course_id") || "";
  const childId = c.req.query("child_id") || c.get("activeChildId") || "";
  if (childId) ownChildOrThrow(parentId, childId);
  const now = nowIso();
  const rows = db.prepare(
    "SELECT id, title, description, duration_min, opens_at, due_at, attempts_allowed FROM exams WHERE course_id = ? AND status = 'published' ORDER BY COALESCE(due_at, created_at)",
  ).all(courseId) as Record<string, unknown>[];
  const exams = rows.map((e) => {
    const used = (db.prepare("SELECT COUNT(*) n FROM exam_attempts WHERE exam_id = ? AND child_id = ? AND submitted_at IS NOT NULL").get(e.id, childId) as { n: number }).n;
    const best = (db.prepare("SELECT MAX(score) s FROM exam_attempts WHERE exam_id = ? AND child_id = ? AND submitted_at IS NOT NULL").get(e.id, childId) as { s: number | null }).s;
    const openNow = (!e.opens_at || (e.opens_at as string) <= now) && (!e.due_at || now <= (e.due_at as string));
    return { id: e.id, title: e.title, description: e.description, duration_min: e.duration_min, opens_at: e.opens_at, due_at: e.due_at, attempts_used: used, attempts_allowed: e.attempts_allowed, best_score: best, open_now: openNow, can_start: openNow && used < Number(e.attempts_allowed) };
  });
  return c.json({ exams });
});

interface DrawQ { id: string; kind: BankKind; prompt: string; options: string[] | null }
app.post("/api/exams/:id/start", requireParent, async (c) => {
  const parentId = c.get("parentId");
  const { child_id } = await readJson(c, z.object({ child_id: z.string().min(1) }));
  ownChildOrThrow(parentId, child_id);
  const e = db.prepare("SELECT * FROM exams WHERE id = ? AND status = 'published'").get(c.req.param("id")) as Record<string, unknown> | undefined;
  if (!e) throw notFound("exam_not_found", "Prova não disponível.");
  const now = nowIso();
  if ((e.opens_at && (e.opens_at as string) > now) || (e.due_at && now > (e.due_at as string))) throw badRequest("closed_window", "Fora da janela da prova.");
  const used = (db.prepare("SELECT COUNT(*) n FROM exam_attempts WHERE exam_id = ? AND child_id = ? AND submitted_at IS NOT NULL").get(e.id, child_id) as { n: number }).n;
  if (used >= Number(e.attempts_allowed)) throw conflict("no_attempts", "Você já usou todas as tentativas.");
  // reaproveita tentativa em aberto, se houver
  const open = db.prepare("SELECT id, seed, questions_json FROM exam_attempts WHERE exam_id = ? AND child_id = ? AND submitted_at IS NULL").get(e.id, child_id) as { id: string; seed: string; questions_json: string } | undefined;
  const pool = JSON.parse(e.pool_json as string) as PoolFilter;
  let attemptId: string, seed: string, qids: string[];
  if (open) { attemptId = open.id; seed = open.seed; qids = JSON.parse(open.questions_json); }
  else {
    const candidates = poolCandidates(e.course_id as string, pool);
    if (candidates.length < pool.n) throw badRequest("pool_too_small", "Prova indisponível (banco insuficiente).");
    seed = `${e.id}:${child_id}:${used}`;
    qids = seededShuffle(candidates, seed).slice(0, pool.n);
    attemptId = newId();
    db.prepare("INSERT INTO exam_attempts (id, exam_id, child_id, seed, questions_json, started_at) VALUES (?, ?, ?, ?, ?, ?)").run(attemptId, e.id, child_id, seed, JSON.stringify(qids), now);
    emitEvent("exam_start", { kind: "child", id: child_id }, { course_id: e.course_id as string, ref_kind: "exam", ref_id: e.id as string });
  }
  // devolve as questões SEM a resposta; embaralha opções por seed
  const questions: DrawQ[] = qids.map((qid) => {
    const q = db.prepare("SELECT id, kind, prompt, options_json FROM bank_questions WHERE id = ?").get(qid) as { id: string; kind: BankKind; prompt: string; options_json: string | null } | undefined;
    const opts = q?.options_json ? (JSON.parse(q.options_json) as string[]) : null;
    return { id: qid, kind: (q?.kind ?? "mcq"), prompt: q?.prompt ?? "(removida)", options: opts ? seededShuffle(opts, `${seed}:${qid}`) : null };
  });
  return c.json({ attempt_id: attemptId, duration_min: e.duration_min, questions });
});

app.post("/api/exams/:id/attempts/:attemptId/submit", requireParent, async (c) => {
  const parentId = c.get("parentId");
  const { child_id, answers } = await readJson(c, z.object({
    child_id: z.string().min(1),
    answers: z.array(z.object({ qid: z.string(), response: z.unknown() })),
  }));
  ownChildOrThrow(parentId, child_id);
  const a = db.prepare("SELECT * FROM exam_attempts WHERE id = ? AND exam_id = ? AND child_id = ?").get(c.req.param("attemptId"), c.req.param("id"), child_id) as Record<string, unknown> | undefined;
  if (!a) throw notFound("attempt_not_found", "Tentativa não encontrada.");
  if (a.submitted_at) throw conflict("already_submitted", "Prova já enviada.");
  const qids: string[] = JSON.parse(a.questions_json as string);
  const byId = new Map(answers.map((x) => [x.qid, x.response]));
  const graded: { qid: string; correct: boolean }[] = [];
  let auto = 0, autoCount = 0;
  for (const qid of qids) {
    const q = db.prepare("SELECT kind, answer_json FROM bank_questions WHERE id = ?").get(qid) as { kind: BankKind; answer_json: string } | undefined;
    if (!q) continue;
    const correct = gradeResponse(q.kind, JSON.parse(q.answer_json), byId.get(qid));
    graded.push({ qid, correct });
    if (isAutoGradable(q.kind)) { autoCount++; if (correct) auto++; }
  }
  const score = autoCount ? auto / autoCount : 0;   // 0..1 sobre as auto-corrigíveis
  db.prepare("UPDATE exam_attempts SET answers_json = ?, score = ?, submitted_at = ? WHERE id = ?").run(JSON.stringify(graded), score, nowIso(), a.id);
  const exam = db.prepare("SELECT course_id, pool_json FROM exams WHERE id = ?").get(c.req.param("id")) as { course_id: string; pool_json: string };
  const pool = JSON.parse(exam.pool_json) as PoolFilter;
  // score → evidência de prontidão (spec 15.3): evento consumível pela correlação predito×real (P5-r)
  emitEvent("exam_submit", { kind: "child", id: child_id }, { course_id: exam.course_id, ref_kind: "exam", ref_id: c.req.param("id") }, { score, bncc_codes: pool.bncc_codes ?? [] });
  return c.json({ score, graded_count: autoCount, needs_manual: graded.length - autoCount });
});

export default app;
