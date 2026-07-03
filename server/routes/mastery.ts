// Rotas de maestria (spec 06): review, "para revisar hoje", calendário de provas.
import { Hono } from "hono";
import { z } from "zod";
import { db, newId, nowIso } from "../db.ts";
import { requireParent, csrfGuard, ownChildOrThrow, hasConsent } from "../lib/session.ts";
import { readJson, forbidden, notFound, type AppEnv } from "../lib/http.ts";
import { reviewAtom } from "../mastery/fsrs.ts";
import { buildTodayQueue, provaCountdowns, examClampForCode } from "../mastery/today.ts";
import { recordLearningEvent, currentStreak } from "../gamify.ts";
import { audit } from "../lib/audit.ts";
import type { AgeBand, TodayResponse } from "../../shared/contracts.ts";

const app = new Hono<AppEnv>();
app.use("/api/mastery/*", csrfGuard);
app.use("/api/provas", csrfGuard);
app.use("/api/provas/*", csrfGuard);

function requireProgressConsent(parentId: string, childId: string) {
  if (!hasConsent(parentId, childId, "progress_tracking")) {
    throw forbidden(
      "progress_consent_required",
      "O acompanhamento de progresso está desativado para este perfil.",
    );
  }
}

// POST /api/mastery/review {child_id, atom_id, rating}
const reviewSchema = z.object({
  child_id: z.string().min(1),
  atom_id: z.string().min(1),
  rating: z.number().int().min(1).max(4),
  duration_sec: z.number().int().min(0).max(3600).optional(),
});

app.post("/api/mastery/review", requireParent, async (c) => {
  const parentId = c.get("parentId");
  const { child_id, atom_id, rating, duration_sec } = await readJson(c, reviewSchema);
  ownChildOrThrow(parentId, child_id);
  requireProgressConsent(parentId, child_id);

  const atom = db.prepare("SELECT bncc_code FROM knowledge_atoms WHERE id = ?").get(atom_id) as
    | { bncc_code: string }
    | undefined;
  if (!atom) throw notFound("atom_not_found", "Item de estudo não encontrado.");

  const examClampDue = examClampForCode(child_id, atom.bncc_code);
  const result = reviewAtom(child_id, atom_id, rating as 1 | 2 | 3 | 4, { examClampDue });

  const counted = recordLearningEvent(child_id, rating);
  db.prepare(
    `INSERT INTO study_sessions (id, child_id, bncc_code, atom_id, started_at, ended_at, duration_sec, rating)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(newId(), child_id, atom.bncc_code, atom_id, nowIso(), nowIso(), duration_sec ?? null, rating);

  return c.json({
    due: result.due,
    state: result.state,
    retrievability: result.retrievability,
    counted_as_learning_event: counted,
    streak: currentStreak(child_id),
  });
});

// GET /api/mastery/today?child_id
app.get("/api/mastery/today", requireParent, (c) => {
  const parentId = c.get("parentId");
  const childId = c.req.query("child_id") || c.get("activeChildId") || "";
  if (!childId) throw notFound("no_child", "Nenhum perfil ativo.");
  ownChildOrThrow(parentId, childId);

  const child = db.prepare("SELECT age_band FROM children WHERE id = ?").get(childId) as
    | { age_band: AgeBand }
    | undefined;
  const ageBand = child?.age_band ?? "11-14";

  const resp: TodayResponse = {
    reviews: buildTodayQueue(childId, ageBand),
    provas: provaCountdowns(childId),
    streak: currentStreak(childId),
    cap: ageBand === "8-10" ? 6 : 12,
  };
  return c.json(resp);
});

// POST /api/provas {child_id, title, exam_date, bncc_codes[], subject_id?}
const provaSchema = z.object({
  child_id: z.string().min(1),
  title: z.string().trim().min(1).max(80),
  subject_id: z.string().max(40).nullish(),
  exam_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data no formato AAAA-MM-DD"),
  bncc_codes: z.array(z.string().max(20)).min(1).max(40),
});

app.post("/api/provas", requireParent, async (c) => {
  const parentId = c.get("parentId");
  const body = await readJson(c, provaSchema);
  ownChildOrThrow(parentId, body.child_id);
  const id = newId();
  db.prepare(
    `INSERT INTO prova_calendar (id, child_id, title, subject_id, exam_date, bncc_codes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, body.child_id, body.title, body.subject_id ?? null, body.exam_date, JSON.stringify(body.bncc_codes), nowIso());
  audit(`parent:${parentId}`, "prova_create", `child:${body.child_id}`, { exam_date: body.exam_date });
  return c.json({ id, ...body }, 201);
});

// GET /api/provas?child_id
app.get("/api/provas", requireParent, (c) => {
  const parentId = c.get("parentId");
  const childId = c.req.query("child_id") || c.get("activeChildId") || "";
  if (!childId) throw notFound("no_child", "Nenhum perfil ativo.");
  ownChildOrThrow(parentId, childId);
  return c.json({ provas: provaCountdowns(childId) });
});

// POST /api/provas/:id/result {rating} — "como foi?" pós-prova (spec 06.2)
app.post("/api/provas/:id/result", requireParent, async (c) => {
  const parentId = c.get("parentId");
  const id = c.req.param("id");
  const { rating } = await readJson(c, z.object({ rating: z.number().int().min(1).max(5) }));
  const prova = db.prepare("SELECT child_id FROM prova_calendar WHERE id = ?").get(id) as
    | { child_id: string }
    | undefined;
  if (!prova) throw notFound("prova_not_found", "Prova não encontrada.");
  ownChildOrThrow(parentId, prova.child_id);
  db.prepare("UPDATE prova_calendar SET result_rating = ? WHERE id = ?").run(rating, id);
  return c.json({ ok: true });
});

export default app;
