// Jobs noturnos (spec 02 §Rules, 09.3). Rodar por cron: `npm run jobs:nightly`.
//  1) Hard-delete de contas soft-deleted há > 30 dias (+ dependências).
//  2) Métricas diárias agregadas (sem export por criança).
//  3) Coortes de retenção D1/D7/D30 a partir de study_sessions.
import { db, nowIso } from "../db.ts";
import { logger } from "../logger.ts";
import { pruneEvents } from "../lib/events.ts";
import { pruneExpiredMissions } from "../lib/missions.ts";

const DELETION_WINDOW_DAYS = 30;

export interface HardDeleteResult {
  parents: number;
  children: number;
}

/** Remove definitivamente responsáveis/crianças soft-deleted antes do cutoff, com dependências. */
export function hardDeleteExpired(now = new Date()): HardDeleteResult {
  const cutoff = new Date(now.getTime() - DELETION_WINDOW_DAYS * 86400000).toISOString();

  const parents = db
    .prepare("SELECT id FROM parents WHERE deleted_at IS NOT NULL AND deleted_at <= ?")
    .all(cutoff) as { id: string }[];
  const parentIds = new Set(parents.map((p) => p.id));

  // filhos elegíveis: de pais expirados OU o próprio filho soft-deleted há > cutoff
  const children = db
    .prepare(
      `SELECT id, parent_id FROM children
       WHERE (deleted_at IS NOT NULL AND deleted_at <= ?)
          OR parent_id IN (SELECT id FROM parents WHERE deleted_at IS NOT NULL AND deleted_at <= ?)`,
    )
    .all(cutoff, cutoff) as { id: string; parent_id: string }[];
  const childIds = children.map((c) => c.id);

  const run = db.transaction(() => {
    for (const cid of childIds) {
      db.prepare("DELETE FROM mastery_state WHERE child_id = ?").run(cid);
      db.prepare("DELETE FROM study_sessions WHERE child_id = ?").run(cid);
      db.prepare("DELETE FROM habit_log WHERE child_id = ?").run(cid);
      db.prepare("DELETE FROM prova_calendar WHERE child_id = ?").run(cid);
      db.prepare("DELETE FROM consents WHERE child_id = ?").run(cid);
      db.prepare("DELETE FROM children WHERE id = ?").run(cid);
    }
    for (const pid of parentIds) {
      db.prepare("DELETE FROM consents WHERE parent_id = ?").run(pid);
      db.prepare("DELETE FROM sessions WHERE parent_id = ?").run(pid);
      db.prepare("DELETE FROM parents WHERE id = ?").run(pid);
    }
  });
  run();
  return { parents: parentIds.size, children: childIds.length };
}

/** Agrega métricas de um dia (America/Sao_Paulo) em metrics_daily. */
export function computeDailyMetrics(day: string): void {
  const start = `${day}T00:00:00.000Z`;
  const end = `${day}T23:59:59.999Z`;
  const active = (db
    .prepare("SELECT COUNT(DISTINCT child_id) n FROM study_sessions WHERE started_at BETWEEN ? AND ?")
    .get(start, end) as { n: number }).n;
  const events = (db
    .prepare("SELECT COALESCE(SUM(learning_events),0) n FROM habit_log WHERE day = ?")
    .get(day) as { n: number }).n;
  db.prepare(
    `INSERT INTO metrics_daily (day, active_children, learning_events, computed_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(day) DO UPDATE SET active_children = excluded.active_children,
       learning_events = excluded.learning_events, computed_at = excluded.computed_at`,
  ).run(day, active, events, nowIso());
}

/** Retenção por coorte: dos que começaram até N dias atrás, quantos voltaram em D1/D7/D30. */
export function computeCohorts(now = new Date()): { d1: number; d7: number; d30: number } {
  const firsts = db
    .prepare("SELECT child_id, MIN(date(started_at)) AS d0 FROM study_sessions GROUP BY child_id")
    .all() as { child_id: string; d0: string }[];

  const windows: Record<"d1" | "d7" | "d30", { returned: number; eligible: number }> = {
    d1: { returned: 0, eligible: 0 },
    d7: { returned: 0, eligible: 0 },
    d30: { returned: 0, eligible: 0 },
  };
  const activeOn = db.prepare(
    "SELECT 1 FROM study_sessions WHERE child_id = ? AND date(started_at) > ? AND date(started_at) <= date(?, '+' || ? || ' days') LIMIT 1",
  );
  const todayStr = now.toISOString().slice(0, 10);

  for (const f of firsts) {
    for (const [k, days] of [["d1", 1], ["d7", 7], ["d30", 30]] as const) {
      // elegível se já se passaram `days` desde o início
      const eligibleUntil = new Date(f.d0 + "T00:00:00Z");
      eligibleUntil.setUTCDate(eligibleUntil.getUTCDate() + days);
      if (eligibleUntil.toISOString().slice(0, 10) > todayStr) continue;
      windows[k].eligible++;
      const hit = activeOn.get(f.child_id, f.d0, f.d0, days);
      if (hit) windows[k].returned++;
    }
  }
  const pct = (w: { returned: number; eligible: number }) => (w.eligible ? w.returned / w.eligible : 0);
  return { d1: pct(windows.d1), d7: pct(windows.d7), d30: pct(windows.d30) };
}

export function runNightly(now = new Date()): void {
  const yesterday = new Date(now.getTime() - 24 * 3600 * 1000 - 3 * 3600 * 1000).toISOString().slice(0, 10);
  const del = hardDeleteExpired(now);
  computeDailyMetrics(yesterday);
  computeDailyMetrics(new Date(now.getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10));
  const cohorts = computeCohorts(now);
  const prunedEvents = pruneEvents(365);   // retenção do events stream (spec 15.1)
  const prunedMissions = pruneExpiredMissions(now);   // retenção limitada de mídia (spec 17.5, LGPD)

  // Otimização do banco de dados (SQLite PRAGMA optimize)
  try {
    db.exec("PRAGMA optimize;");
  } catch (e) {
    logger.error({ err: String(e) }, "erro ao rodar PRAGMA optimize");
  }

  logger.info({ del, cohorts, prunedEvents, prunedMissions }, "nightly job concluído");
}

// Executado diretamente (cron) → roda e sai.
if (import.meta.url === `file://${process.argv[1]}`) {
  runNightly();
  // eslint-disable-next-line no-console
  console.log("✅ Nightly job concluído.");
  process.exit(0);
}
