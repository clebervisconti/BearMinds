// Painel do responsável (spec 08 — versão P1-lite). Visibilidade, nunca vigilância:
// jamais expõe entradas em texto livre da criança nem erros por questão em tempo real.
import { Hono } from "hono";
import { db } from "../db.ts";
import { requireParent, ownChildOrThrow } from "../lib/session.ts";
import { notFound, type AppEnv } from "../lib/http.ts";
import { currentStreak, masteryBySubject } from "../gamify.ts";
import { provaCountdowns } from "../mastery/today.ts";
import { localDay } from "../lib/domain.ts";
import type { ParentSummary } from "../../shared/contracts.ts";

const app = new Hono<AppEnv>();

// GET /api/parent/summary?child_id
app.get("/api/parent/summary", requireParent, (c) => {
  const parentId = c.get("parentId");
  const childId = c.req.query("child_id") || c.get("activeChildId") || "";
  if (!childId) throw notFound("no_child", "Nenhum perfil ativo.");
  ownChildOrThrow(parentId, childId);

  // últimos 7 dias
  const since = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const activeDays = (db
    .prepare("SELECT COUNT(*) n FROM habit_log WHERE child_id = ? AND day >= ? AND learning_events > 0")
    .get(childId, since) as { n: number }).n;
  const reviews = (db
    .prepare("SELECT COUNT(*) n FROM study_sessions WHERE child_id = ? AND started_at >= ?")
    .get(childId, since + "T00:00:00Z") as { n: number }).n;

  const provas = provaCountdowns(childId).map((p) => ({
    title: p.title,
    date: p.exam_date,
    readiness: p.readiness,
    days_left: p.days_left,
  }));

  const summary: ParentSummary = {
    child_id: childId,
    week: { active_days: activeDays, reviews, streak: currentStreak(childId, localDay()) },
    provas,
    mastery_by_subject: masteryBySubject(childId),
  };
  return c.json(summary);
});

// GET /api/parent/mastery?child_id — grade de maestria por matéria (visão P1 simplificada).
app.get("/api/parent/mastery", requireParent, (c) => {
  const parentId = c.get("parentId");
  const childId = c.req.query("child_id") || c.get("activeChildId") || "";
  if (!childId) throw notFound("no_child", "Nenhum perfil ativo.");
  ownChildOrThrow(parentId, childId);
  return c.json({ mastery_by_subject: masteryBySubject(childId) });
});

export default app;
