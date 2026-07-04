// Coaching / tutoria (spec 14.4): alunos em risco + anotações + atalho de DM.
import { Hono } from "hono";
import { z } from "zod";
import { db, newId, nowIso } from "../db.ts";
import { requireParent, requireRole, csrfGuard, parentRole } from "../lib/session.ts";
import { readJson, notFound, type AppEnv } from "../lib/http.ts";
import { currentStreak } from "../gamify.ts";
import { provaCountdowns } from "../mastery/today.ts";

const app = new Hono<AppEnv>();
app.use("/api/admin/coaching/*", csrfGuard);

const STAFF = ["professor", "tutor", "institution_admin"] as const;

export interface RiskFlags {
  streak_broken: boolean;
  low_readiness: boolean;
  inactive_7d: boolean;
}

/** Detecção pura de risco (spec 14.4) — testável. */
export function riskFlags(input: { streak: number; hasHistory: boolean; lastActivityDaysAgo: number | null; minReadiness: number | null }): RiskFlags {
  return {
    streak_broken: input.hasHistory && input.streak === 0,
    low_readiness: input.minReadiness !== null && input.minReadiness < 0.6,
    inactive_7d: input.lastActivityDaysAgo !== null && input.lastActivityDaysAgo >= 7,
  };
}

app.get("/api/admin/coaching", requireParent, requireRole(...STAFF), (c) => {
  const me = parentRole(c.get("parentId"));
  const inst = me.role === "platform_admin" ? c.req.query("institution") || null : me.institutionId;
  const students = (inst
    ? db.prepare("SELECT id, display_name, grade FROM children WHERE COALESCE(institution_id,'bncc-padrao') = ? AND deleted_at IS NULL ORDER BY display_name LIMIT 300").all(inst)
    : db.prepare("SELECT id, display_name, grade FROM children WHERE deleted_at IS NULL ORDER BY display_name LIMIT 300").all()) as { id: string; display_name: string; grade: string }[];

  const now = Date.now();
  const out = students.map((s) => {
    const last = db.prepare("SELECT MAX(started_at) d FROM study_sessions WHERE child_id = ?").get(s.id) as { d: string | null };
    const hasHistory = !!last.d;
    const lastDays = last.d ? Math.floor((now - new Date(last.d).getTime()) / 86400000) : null;
    const provas = provaCountdowns(s.id);
    const minReadiness = provas.length ? Math.min(...provas.map((p) => p.readiness)) : null;
    const flags = riskFlags({ streak: currentStreak(s.id), hasHistory, lastActivityDaysAgo: lastDays, minReadiness });
    const atRisk = flags.streak_broken || flags.low_readiness || flags.inactive_7d;
    const notes = (db.prepare("SELECT COUNT(*) n FROM tutor_notes WHERE child_id = ?").get(s.id) as { n: number }).n;
    return {
      id: s.id, display_name: s.display_name, grade: s.grade,
      last_activity_days: lastDays, min_readiness: minReadiness, at_risk: atRisk, flags, notes,
    };
  });
  // ordena: em risco primeiro
  out.sort((a, b) => Number(b.at_risk) - Number(a.at_risk));
  return c.json({ students: out });
});

app.get("/api/admin/coaching/:childId/notes", requireParent, requireRole(...STAFF), (c) => {
  const rows = db.prepare(
    "SELECT n.id, n.body, n.created_at, p.email AS author FROM tutor_notes n JOIN parents p ON p.id = n.tutor_parent_id WHERE n.child_id = ? ORDER BY n.created_at DESC LIMIT 50",
  ).all(c.req.param("childId"));
  return c.json({ notes: rows });
});

app.post("/api/admin/coaching/:childId/notes", requireParent, requireRole(...STAFF), async (c) => {
  const parentId = c.get("parentId");
  const { body } = await readJson(c, z.object({ body: z.string().trim().min(1).max(1000) }));
  const child = db.prepare("SELECT id FROM children WHERE id = ? AND deleted_at IS NULL").get(c.req.param("childId"));
  if (!child) throw notFound("child_not_found", "Aluno não encontrado.");
  const id = newId();
  db.prepare("INSERT INTO tutor_notes (id, tutor_parent_id, child_id, body, created_at) VALUES (?, ?, ?, ?, ?)").run(id, parentId, c.req.param("childId"), body, nowIso());
  return c.json({ id }, 201);
});

export default app;
