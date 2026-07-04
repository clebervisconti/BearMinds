// Tarefas (spec 15.4): submissões texto/arquivo + rubricas ponderadas + IA como pré-análise do revisor.
// A IA NUNCA dá nota — só sugere ao professor. Grounded na submissão + instruções.
import { Hono } from "hono";
import { z } from "zod";
import { db, newId, nowIso } from "../db.ts";
import { requireParent, requireRole, csrfGuard, ownChildOrThrow, staffInstitutionOrThrow } from "../lib/session.ts";
import { readJson, badRequest, forbidden, notFound, conflict, type AppEnv } from "../lib/http.ts";
import { scoreRubric, type RubricSection } from "../lib/rubric.ts";
import { evaluateAvailability, resolverFor, parseCond } from "../lib/availability.ts";
import { emitEvent } from "../lib/events.ts";
import { llm } from "../llm/provider.ts";
import { pickModel } from "../llm/router.ts";
import { llmConfigured } from "../env.ts";

const app = new Hono<AppEnv>();
app.use("/api/admin/courses/*", csrfGuard);
app.use("/api/admin/rubrics/*", csrfGuard);
app.use("/api/admin/submissions/*", csrfGuard);
app.use("/api/learn/*", csrfGuard);

const STAFF = ["professor", "institution_admin"] as const;

function staffCourse(parentId: string, courseId: string): void {
  const cs = db.prepare("SELECT institution_id FROM courses WHERE id = ?").get(courseId) as { institution_id: string } | undefined;
  if (!cs) throw notFound("course_not_found", "Curso não encontrado.");
  staffInstitutionOrThrow(parentId, cs.institution_id);
}

// ---------- Rubricas ----------
const rubricInput = z.object({
  title: z.string().trim().min(2).max(140),
  sections: z.array(z.object({
    title: z.string().trim().min(1).max(120),
    weight: z.number().min(0).max(100),
    criteria: z.array(z.object({
      label: z.string().trim().min(1).max(200),
      levels: z.array(z.object({ label: z.string().max(80), points: z.number().min(0).max(100) })).min(2).max(6),
    })).min(1).max(12),
  })).min(1).max(10),
});

app.get("/api/admin/courses/:courseId/rubrics", requireParent, requireRole(...STAFF), (c) => {
  staffCourse(c.get("parentId"), c.req.param("courseId"));
  const rows = db.prepare("SELECT id, title, sections_json FROM rubrics WHERE course_id = ? ORDER BY created_at DESC").all(c.req.param("courseId")) as { id: string; title: string; sections_json: string }[];
  return c.json({ rubrics: rows.map((r) => ({ id: r.id, title: r.title, sections: JSON.parse(r.sections_json) })) });
});

app.post("/api/admin/courses/:courseId/rubrics", requireParent, requireRole(...STAFF), async (c) => {
  const parentId = c.get("parentId");
  staffCourse(parentId, c.req.param("courseId"));
  const b = await readJson(c, rubricInput);
  const id = newId();
  db.prepare("INSERT INTO rubrics (id, course_id, title, sections_json, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(id, c.req.param("courseId"), b.title, JSON.stringify(b.sections), parentId, nowIso());
  return c.json({ id }, 201);
});

// ---------- Submissões (aluno) ----------
interface ItemRow { id: string; kind: string; module_id: string; course_id: string; payload_json: string | null; availability_json: string | null; mod_avail: string | null }
function assignmentItem(itemId: string): ItemRow {
  const r = db.prepare(
    `SELECT i.id, i.kind, i.module_id, i.payload_json, i.availability_json, m.course_id, m.availability_json AS mod_avail
     FROM content_items i JOIN course_modules m ON m.id = i.module_id WHERE i.id = ? AND i.status = 'published'`,
  ).get(itemId) as ItemRow | undefined;
  if (!r) throw notFound("item_not_found", "Tarefa não encontrada.");
  if (r.kind !== "assignment") throw badRequest("not_assignment", "Este item não é uma tarefa.");
  return r;
}

app.post("/api/learn/items/:id/submit", requireParent, async (c) => {
  const parentId = c.get("parentId");
  const { child_id, body_text, file_id } = await readJson(c, z.object({
    child_id: z.string().min(1),
    body_text: z.string().max(20000).nullish(),
    file_id: z.string().nullish(),
  }));
  ownChildOrThrow(parentId, child_id);
  const item = assignmentItem(c.req.param("id"));
  const enrolled = db.prepare("SELECT 1 FROM enrollments WHERE child_id = ? AND course_id = ?").get(child_id, item.course_id);
  if (!enrolled) throw forbidden("not_enrolled", "Inscreva-se no curso primeiro.");
  const resolver = resolverFor(child_id);
  if (!evaluateAvailability(parseCond(item.mod_avail), resolver).available || !evaluateAvailability(parseCond(item.availability_json), resolver).available) {
    throw forbidden("locked", "Esta tarefa ainda está bloqueada.");
  }
  if (!body_text?.trim() && !file_id) throw badRequest("empty", "Envie um texto ou um arquivo.");
  const existing = db.prepare("SELECT id, status FROM submissions WHERE item_id = ? AND child_id = ?").get(item.id, child_id) as { id: string; status: string } | undefined;
  if (existing && existing.status !== "returned") {
    db.prepare("UPDATE submissions SET body_text = ?, file_id = ?, status = ?, submitted_at = ? WHERE id = ?").run(body_text ?? null, file_id ?? null, existing.status === "returned" ? "resubmitted" : "submitted", nowIso(), existing.id);
  } else if (existing) {
    db.prepare("UPDATE submissions SET body_text = ?, file_id = ?, status = 'resubmitted', submitted_at = ? WHERE id = ?").run(body_text ?? null, file_id ?? null, nowIso(), existing.id);
  } else {
    db.prepare("INSERT INTO submissions (id, item_id, child_id, body_text, file_id, status, submitted_at) VALUES (?, ?, ?, ?, ?, 'submitted', ?)").run(newId(), item.id, child_id, body_text ?? null, file_id ?? null, nowIso());
  }
  // conclusão do item = entregou (participação); a nota é dimensão separada.
  db.prepare(
    `INSERT INTO item_progress (child_id, item_id, status, attempts, updated_at) VALUES (?, ?, 'done', 1, ?)
     ON CONFLICT(child_id, item_id) DO UPDATE SET status='done', attempts = attempts + 1, updated_at = excluded.updated_at`,
  ).run(child_id, item.id, nowIso());
  emitEvent("submission", { kind: "child", id: child_id }, { course_id: item.course_id, ref_kind: "item", ref_id: item.id });
  return c.json({ ok: true }, 201);
});

app.get("/api/learn/items/:id/submission", requireParent, (c) => {
  const parentId = c.get("parentId");
  const childId = c.req.query("child_id") || c.get("activeChildId") || "";
  if (childId) ownChildOrThrow(parentId, childId);
  const sub = db.prepare("SELECT id, body_text, file_id, status, submitted_at FROM submissions WHERE item_id = ? AND child_id = ?").get(c.req.param("id"), childId) as Record<string, unknown> | undefined;
  if (!sub) return c.json({ submission: null });
  const review = db.prepare("SELECT points, feedback, rubric_scores_json, created_at FROM submission_reviews WHERE submission_id = ? ORDER BY created_at DESC LIMIT 1").get(sub.id) as Record<string, unknown> | undefined;
  return c.json({ submission: { ...sub, review: review ? { points: review.points, feedback: review.feedback, created_at: review.created_at } : null } });
});

// ---------- Revisão (staff) ----------
app.get("/api/admin/items/:id/submissions", requireParent, requireRole(...STAFF), (c) => {
  const parentId = c.get("parentId");
  const item = db.prepare("SELECT m.course_id FROM content_items i JOIN course_modules m ON m.id = i.module_id WHERE i.id = ?").get(c.req.param("id")) as { course_id: string } | undefined;
  if (!item) throw notFound("item_not_found", "Item não encontrado.");
  staffCourse(parentId, item.course_id);
  const rows = db.prepare(
    `SELECT s.id, s.child_id, ch.display_name AS student, s.body_text, s.file_id, s.status, s.submitted_at,
            (SELECT points FROM submission_reviews r WHERE r.submission_id = s.id ORDER BY r.created_at DESC LIMIT 1) AS points
     FROM submissions s JOIN children ch ON ch.id = s.child_id WHERE s.item_id = ? ORDER BY s.submitted_at DESC`,
  ).all(c.req.param("id"));
  return c.json({ submissions: rows });
});

function subCourse(parentId: string, submissionId: string): { sub: Record<string, unknown>; course_id: string } {
  const sub = db.prepare(
    `SELECT s.*, m.course_id, i.payload_json FROM submissions s JOIN content_items i ON i.id = s.item_id JOIN course_modules m ON m.id = i.module_id WHERE s.id = ?`,
  ).get(submissionId) as Record<string, unknown> | undefined;
  if (!sub) throw notFound("sub_not_found", "Submissão não encontrada.");
  staffCourse(parentId, sub.course_id as string);
  return { sub, course_id: sub.course_id as string };
}

app.post("/api/admin/submissions/:id/review", requireParent, requireRole(...STAFF), async (c) => {
  const parentId = c.get("parentId");
  const { sub } = subCourse(parentId, c.req.param("id"));
  const b = await readJson(c, z.object({
    feedback: z.string().trim().min(1).max(4000),
    rubric_id: z.string().nullish(),
    selections: z.array(z.array(z.number().int())).nullish(),   // [seção][critério] = nível
    points: z.number().min(0).max(1000).nullish(),
  }));
  let points = b.points ?? null;
  let rubricScores: unknown = null;
  if (b.rubric_id && b.selections) {
    const rub = db.prepare("SELECT sections_json FROM rubrics WHERE id = ?").get(b.rubric_id) as { sections_json: string } | undefined;
    if (!rub) throw notFound("rubric_not_found", "Rubrica não encontrada.");
    const payload = sub.payload_json ? JSON.parse(sub.payload_json as string) as { max_points?: number } : {};
    const scored = scoreRubric(JSON.parse(rub.sections_json) as RubricSection[], b.selections, payload.max_points ?? 100);
    points = scored.points;
    rubricScores = { rubric_id: b.rubric_id, selections: b.selections, fraction: scored.fraction };
  }
  db.prepare("INSERT INTO submission_reviews (id, submission_id, reviewer_parent_id, rubric_scores_json, points, feedback, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
    newId(), sub.id, parentId, rubricScores ? JSON.stringify(rubricScores) : null, points, b.feedback, nowIso());
  db.prepare("UPDATE submissions SET status = 'returned' WHERE id = ?").run(sub.id);
  // notifica o responsável do aluno
  const child = db.prepare("SELECT parent_id FROM children WHERE id = ?").get(sub.child_id as string) as { parent_id: string } | undefined;
  if (child) db.prepare(
    `INSERT INTO notifications (id, parent_id, child_id, kind, title, body, link, created_at) VALUES (?, ?, ?, 'system', '📝 Tarefa avaliada', 'O professor devolveu sua tarefa com feedback.', '/atividades', ?)`,
  ).run(newId(), child.parent_id, sub.child_id as string, nowIso());
  return c.json({ ok: true, points });
});

// IA como PRÉ-ANÁLISE do revisor (spec 15.4) — sugestão, nunca nota. Só o professor vê.
app.post("/api/admin/submissions/:id/ai-review", requireParent, requireRole(...STAFF), async (c) => {
  const parentId = c.get("parentId");
  const { sub } = subCourse(parentId, c.req.param("id"));
  if (!llmConfigured) throw badRequest("no_llm", "IA indisponível (sem chave de modelo).");
  const text = (sub.body_text as string | null)?.slice(0, 8000) ?? "";
  if (!text.trim()) throw badRequest("no_text", "Sem texto para analisar (submissão é arquivo).");
  const payload = sub.payload_json ? JSON.parse(sub.payload_json as string) as { instructions?: string } : {};
  const system = "Você é assistente de correção de um professor brasileiro (K-12). Analise a submissão do aluno de forma objetiva e CURTA. NUNCA atribua nota — apenas ajude o professor. Responda em JSON com: {summary: string (1-2 frases), coverage: string[] (o que a submissão cobre bem), gaps: string[] (o que falta segundo as instruções), ai_suspicion: 'baixa'|'média'|'alta' (indícios de texto colado de IA — genérico, sem fontes, tom impessoal)}. Português.";
  const user = `INSTRUÇÕES DA TAREFA:\n${payload.instructions ?? "(não informadas)"}\n\nSUBMISSÃO DO ALUNO:\n${text}`;
  let assist: unknown;
  try {
    const res = await llm({ model: pickModel("quiz"), system, user, json: true, maxTokens: 600, temperature: 0.2 });
    assist = JSON.parse(res.text);
  } catch {
    throw badRequest("ai_failed", "A IA não conseguiu analisar agora. Tente de novo.");
  }
  db.prepare("UPDATE submission_reviews SET ai_assist_json = ? WHERE submission_id = ? AND ai_assist_json IS NULL").run(JSON.stringify(assist), sub.id);
  return c.json({ ai_assist: assist });
});

export default app;
