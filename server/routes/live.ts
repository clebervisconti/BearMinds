// Live games (Kahoot, spec 14.1), enquetes + Q&A (Slido, spec 14.2). Estado por polling.
import { Hono } from "hono";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { db, newId, nowIso } from "../db.ts";
import { requireParent, requireRole, csrfGuard, ownChildOrThrow, staffInstitutionOrThrow } from "../lib/session.ts";
import { readJson, badRequest, forbidden, notFound, conflict, type AppEnv } from "../lib/http.ts";
import { liveScore, pinFromBytes, LIVE_QUESTION_MS } from "../live/scoring.ts";
import { awardCoins } from "../gamify.ts";
import type { QuizQuestion } from "../../shared/contracts.ts";

const app = new Hono<AppEnv>();
app.use("/api/live/*", csrfGuard);
app.use("/api/polls/*", csrfGuard);
app.use("/api/qa/*", csrfGuard);
app.use("/api/admin/*", csrfGuard);

const STAFF = ["professor", "institution_admin"] as const;

// ---------- helpers de quiz (carrega as questões cacheadas do item) ----------
function quizForItem(itemId: string): { questions: QuizQuestion[]; courseId: string; institutionId: string } {
  const item = db
    .prepare(
      `SELECT i.payload_json, m.course_id, cs.institution_id FROM content_items i
       JOIN course_modules m ON m.id = i.module_id JOIN courses cs ON cs.id = m.course_id
       WHERE i.id = ? AND i.kind = 'quiz'`,
    )
    .get(itemId) as { payload_json: string | null; course_id: string; institution_id: string } | undefined;
  if (!item) throw notFound("item_not_found", "Item de quiz não encontrado.");
  const p = item.payload_json ? (JSON.parse(item.payload_json) as { bncc_code?: string }) : {};
  if (!p.bncc_code) throw badRequest("no_quiz", "Este quiz ainda não foi gerado.");
  const row = db
    .prepare("SELECT payload_json FROM generated_artifacts WHERE bncc_code = ? AND kind = 'quiz' AND safety_passed = 1 ORDER BY created_at DESC LIMIT 1")
    .get(p.bncc_code) as { payload_json: string } | undefined;
  if (!row) throw badRequest("no_quiz", "Quiz não disponível.");
  const quiz = JSON.parse(row.payload_json) as { questions: QuizQuestion[] };
  return { questions: quiz.questions.filter((q) => q.kind === "mcq" && q.options), courseId: item.course_id, institutionId: item.institution_id };
}

// ---------- Host: criar sessão ----------
app.post("/api/admin/live/start", requireParent, requireRole(...STAFF), async (c) => {
  const parentId = c.get("parentId");
  const { item_id } = await readJson(c, z.object({ item_id: z.string().min(1) }));
  const { questions, courseId, institutionId } = quizForItem(item_id);
  staffInstitutionOrThrow(parentId, institutionId);
  if (questions.length === 0) throw badRequest("no_mcq", "O quiz precisa de questões de múltipla escolha.");

  let pin = "";
  for (let i = 0; i < 6; i++) {
    pin = pinFromBytes(randomBytes(4));
    if (!db.prepare("SELECT 1 FROM live_sessions WHERE pin = ? AND state != 'ended'").get(pin)) break;
  }
  const id = newId();
  db.prepare(
    "INSERT INTO live_sessions (id, pin, item_id, course_id, host_parent, state, current_q, created_at) VALUES (?, ?, ?, ?, ?, 'lobby', -1, ?)",
  ).run(id, pin, item_id, courseId, parentId, nowIso());
  return c.json({ id, pin, total_questions: questions.length }, 201);
});

function hostSession(parentId: string, sessionId: string) {
  const s = db.prepare("SELECT * FROM live_sessions WHERE id = ?").get(sessionId) as LiveSession | undefined;
  if (!s) throw notFound("session_not_found", "Sessão não encontrada.");
  if (s.host_parent !== parentId) throw forbidden("not_host", "Você não é o host desta sessão.");
  return s;
}
interface LiveSession {
  id: string; pin: string; item_id: string; course_id: string; host_parent: string;
  state: string; current_q: number; q_started_at: string | null;
}

// ---------- Host: avançar / revelar / encerrar ----------
app.post("/api/admin/live/:id/next", requireParent, requireRole(...STAFF), (c) => {
  const s = hostSession(c.get("parentId"), c.req.param("id"));
  const { questions } = quizForItem(s.item_id);
  if (s.state === "question") {
    db.prepare("UPDATE live_sessions SET state = 'reveal' WHERE id = ?").run(s.id);
    return c.json({ state: "reveal", current_q: s.current_q });
  }
  const next = s.current_q + 1;
  if (next >= questions.length) {
    db.prepare("UPDATE live_sessions SET state = 'ended', ended_at = ? WHERE id = ?").run(nowIso(), s.id);
    // moedas de participação (uma vez por sessão)
    const players = db.prepare("SELECT child_id, score FROM live_players WHERE session_id = ?").all(s.id) as { child_id: string; score: number }[];
    for (const p of players) if (p.score > 0) awardCoins(p.child_id, Math.min(60, Math.round(p.score / 100)), "live_game", s.id);
    return c.json({ state: "ended" });
  }
  db.prepare("UPDATE live_sessions SET state = 'question', current_q = ?, q_started_at = ? WHERE id = ?").run(next, nowIso(), s.id);
  return c.json({ state: "question", current_q: next });
});

app.get("/api/admin/live/:id/results", requireParent, requireRole(...STAFF), (c) => {
  const s = hostSession(c.get("parentId"), c.req.param("id"));
  const players = db.prepare("SELECT nickname, score FROM live_players WHERE session_id = ? ORDER BY score DESC").all(s.id);
  const answered = s.current_q >= 0
    ? (db.prepare("SELECT COUNT(*) n FROM live_answers WHERE session_id = ? AND q_index = ?").get(s.id, s.current_q) as { n: number }).n
    : 0;
  return c.json({ state: s.state, current_q: s.current_q, players, answered });
});

// ---------- Player: entrar por PIN ----------
app.post("/api/live/join", requireParent, async (c) => {
  const parentId = c.get("parentId");
  const { pin, child_id } = await readJson(c, z.object({ pin: z.string().length(6), child_id: z.string().min(1) }));
  ownChildOrThrow(parentId, child_id);
  const s = db.prepare("SELECT * FROM live_sessions WHERE pin = ? AND state != 'ended'").get(pin) as LiveSession | undefined;
  if (!s) throw notFound("session_not_found", "PIN inválido ou sessão encerrada.");
  const child = db.prepare("SELECT display_name FROM children WHERE id = ? AND deleted_at IS NULL").get(child_id) as { display_name: string } | undefined;
  if (!child) throw notFound("child_not_found", "Perfil não encontrado.");
  db.prepare("INSERT OR IGNORE INTO live_players (session_id, child_id, nickname, score, joined_at) VALUES (?, ?, ?, 0, ?)").run(s.id, child_id, child.display_name, nowIso());
  return c.json({ session_id: s.id });
});

// ---------- Player/Host: estado (polling) — NÃO revela resposta antes do reveal ----------
app.get("/api/live/:pin/state", requireParent, (c) => {
  const s = db.prepare("SELECT * FROM live_sessions WHERE pin = ? ORDER BY created_at DESC LIMIT 1").get(c.req.param("pin")) as LiveSession | undefined;
  if (!s) throw notFound("session_not_found", "Sessão não encontrada.");
  const { questions } = quizForItem(s.item_id);
  const total = questions.length;
  const childId = c.req.query("child_id") || c.get("activeChildId") || "";

  let question: unknown = null;
  let answered = false;
  if ((s.state === "question" || s.state === "reveal") && s.current_q >= 0 && s.current_q < total) {
    const q = questions[s.current_q];
    question = {
      index: s.current_q,
      prompt: q.prompt,
      options: q.options,
      // resposta só no reveal:
      answer_index: s.state === "reveal" ? q.answer_index : undefined,
      started_at: s.q_started_at,
      window_ms: LIVE_QUESTION_MS,
    };
    if (childId) {
      answered = !!db.prepare("SELECT 1 FROM live_answers WHERE session_id = ? AND child_id = ? AND q_index = ?").get(s.id, childId, s.current_q);
    }
  }
  const players = db.prepare("SELECT nickname, score, child_id FROM live_players WHERE session_id = ? ORDER BY score DESC LIMIT 5").all(s.id);
  return c.json({ state: s.state, current_q: s.current_q, total, question, answered, podium: s.state === "ended" ? players : undefined, players_count: (db.prepare("SELECT COUNT(*) n FROM live_players WHERE session_id = ?").get(s.id) as { n: number }).n });
});

// ---------- Player: responder ----------
app.post("/api/live/:pin/answer", requireParent, async (c) => {
  const parentId = c.get("parentId");
  const s = db.prepare("SELECT * FROM live_sessions WHERE pin = ? AND state = 'question'").get(c.req.param("pin")) as LiveSession | undefined;
  if (!s) throw badRequest("not_open", "Nenhuma pergunta aberta.");
  const { child_id, choice } = await readJson(c, z.object({ child_id: z.string().min(1), choice: z.number().int().min(0).max(9) }));
  ownChildOrThrow(parentId, child_id);
  const player = db.prepare("SELECT 1 FROM live_players WHERE session_id = ? AND child_id = ?").get(s.id, child_id);
  if (!player) throw forbidden("not_joined", "Entre na sessão primeiro.");
  const already = db.prepare("SELECT 1 FROM live_answers WHERE session_id = ? AND child_id = ? AND q_index = ?").get(s.id, child_id, s.current_q);
  if (already) throw conflict("already_answered", "Você já respondeu.");

  const { questions } = quizForItem(s.item_id);
  const q = questions[s.current_q];
  const correct = choice === q.answer_index;
  const ms = s.q_started_at ? Date.now() - new Date(s.q_started_at).getTime() : LIVE_QUESTION_MS;
  const delta = liveScore(correct, ms);
  db.prepare("INSERT INTO live_answers (session_id, child_id, q_index, choice, correct, ms, delta) VALUES (?, ?, ?, ?, ?, ?, ?)").run(s.id, child_id, s.current_q, choice, correct ? 1 : 0, ms, delta);
  if (delta > 0) db.prepare("UPDATE live_players SET score = score + ? WHERE session_id = ? AND child_id = ?").run(delta, s.id, child_id);
  return c.json({ ok: true, delta });
});

// ============================================================
// ENQUETES (Slido, spec 14.2)
// ============================================================
app.post("/api/admin/polls", requireParent, requireRole(...STAFF), async (c) => {
  const parentId = c.get("parentId");
  const body = await readJson(c, z.object({
    course_id: z.string().min(1),
    question: z.string().trim().min(3).max(200),
    options: z.array(z.string().trim().min(1).max(80)).min(2).max(6),
  }));
  const course = db.prepare("SELECT institution_id FROM courses WHERE id = ?").get(body.course_id) as { institution_id: string } | undefined;
  if (!course) throw notFound("course_not_found", "Curso não encontrado.");
  staffInstitutionOrThrow(parentId, course.institution_id);
  const id = newId();
  db.prepare("INSERT INTO polls (id, course_id, created_by, question, options_json, open, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)").run(id, body.course_id, parentId, body.question, JSON.stringify(body.options), nowIso());
  return c.json({ id }, 201);
});

app.get("/api/polls", requireParent, (c) => {
  const courseId = c.req.query("course_id") || "";
  const childId = c.req.query("child_id") || c.get("activeChildId") || "";
  const rows = db.prepare("SELECT id, question, options_json, open FROM polls WHERE course_id = ? ORDER BY created_at DESC LIMIT 20").all(courseId) as { id: string; question: string; options_json: string; open: number }[];
  const out = rows.map((p) => {
    const options = JSON.parse(p.options_json) as string[];
    const tally = options.map((_, i) => (db.prepare("SELECT COUNT(*) n FROM poll_votes WHERE poll_id = ? AND choice = ?").get(p.id, i) as { n: number }).n);
    const mine = childId ? (db.prepare("SELECT choice FROM poll_votes WHERE poll_id = ? AND child_id = ?").get(p.id, childId) as { choice: number } | undefined) : undefined;
    return { id: p.id, question: p.question, options, open: !!p.open, tally, my_choice: mine?.choice ?? null, total: tally.reduce((a, b) => a + b, 0) };
  });
  return c.json({ polls: out });
});

app.post("/api/polls/:id/vote", requireParent, async (c) => {
  const parentId = c.get("parentId");
  const { child_id, choice } = await readJson(c, z.object({ child_id: z.string().min(1), choice: z.number().int().min(0).max(5) }));
  ownChildOrThrow(parentId, child_id);
  const poll = db.prepare("SELECT options_json, open FROM polls WHERE id = ?").get(c.req.param("id")) as { options_json: string; open: number } | undefined;
  if (!poll || !poll.open) throw badRequest("closed", "Enquete encerrada.");
  if (choice >= (JSON.parse(poll.options_json) as string[]).length) throw badRequest("bad_choice", "Opção inválida.");
  db.prepare("INSERT OR REPLACE INTO poll_votes (poll_id, child_id, choice) VALUES (?, ?, ?)").run(c.req.param("id"), child_id, choice);
  return c.json({ ok: true });
});

// ============================================================
// Q&A (Slido) — perguntas do curso com upvote
// ============================================================
app.get("/api/qa", requireParent, (c) => {
  const courseId = c.req.query("course_id") || "";
  const childId = c.req.query("child_id") || c.get("activeChildId") || "";
  const rows = db.prepare(
    `SELECT q.id, q.body, q.answered, q.created_at, ch.display_name AS author,
            (SELECT COUNT(*) FROM qa_votes v WHERE v.question_id = q.id) AS votes,
            (SELECT 1 FROM qa_votes v WHERE v.question_id = q.id AND v.child_id = ?) AS voted
     FROM qa_questions q JOIN children ch ON ch.id = q.child_id
     WHERE q.course_id = ? AND q.deleted_at IS NULL
     ORDER BY q.answered ASC, votes DESC, q.created_at DESC LIMIT 50`,
  ).all(childId, courseId);
  return c.json({ questions: rows });
});

app.post("/api/qa", requireParent, async (c) => {
  const parentId = c.get("parentId");
  const body = await readJson(c, z.object({ course_id: z.string().min(1), child_id: z.string().min(1), body: z.string().trim().min(3).max(400) }));
  ownChildOrThrow(parentId, body.child_id);
  const id = newId();
  db.prepare("INSERT INTO qa_questions (id, course_id, child_id, body, created_at) VALUES (?, ?, ?, ?, ?)").run(id, body.course_id, body.child_id, body.body, nowIso());
  return c.json({ id }, 201);
});

app.post("/api/qa/:id/vote", requireParent, async (c) => {
  const parentId = c.get("parentId");
  const { child_id } = await readJson(c, z.object({ child_id: z.string().min(1) }));
  ownChildOrThrow(parentId, child_id);
  db.prepare("INSERT OR IGNORE INTO qa_votes (question_id, child_id) VALUES (?, ?)").run(c.req.param("id"), child_id);
  return c.json({ ok: true });
});

app.post("/api/admin/qa/:id/answered", requireParent, requireRole(...STAFF), (c) => {
  db.prepare("UPDATE qa_questions SET answered = 1 WHERE id = ?").run(c.req.param("id"));
  return c.json({ ok: true });
});

export default app;
