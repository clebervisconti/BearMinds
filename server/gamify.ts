// Gamificação "done right" (specs 07 + 12): mecânica só a serviço de recuperação + espaçamento.
// Streak amarrado a evento de aprendizagem real (revisão com rating ≥ 2), com 1 freeze/semana.
// Moedas/conquistas (spec 12.3): nascem SOMENTE de eventos de aprendizagem — nunca de tempo de tela.
import { db, newId, nowIso } from "./db.ts";
import { localDay } from "./lib/domain.ts";
import { provaCountdowns } from "./mastery/today.ts";
import type { ReviewResult } from "./mastery/fsrs.ts";

/** Um "learning event" = revisão com rating ≥ 2. Ler lição não conta (spec 07 §1). */
export function recordLearningEvent(childId: string, rating: number): boolean {
  if (rating < 2) return false;
  const day = localDay();
  db.prepare(
    `INSERT INTO habit_log (child_id, day, learning_events, freeze_used) VALUES (?, ?, 1, 0)
     ON CONFLICT(child_id, day) DO UPDATE SET learning_events = learning_events + 1`,
  ).run(childId, day);
  return true;
}

function prevDay(day: string): string {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Streak: dias consecutivos com evento, tolerando 1 gap por semana (freeze). Nunca punitivo. */
export function currentStreak(childId: string, today = localDay()): number {
  const rows = db
    .prepare("SELECT day FROM habit_log WHERE child_id = ? AND learning_events > 0")
    .all(childId) as { day: string }[];
  const days = new Set(rows.map((r) => r.day));
  if (days.size === 0) return 0;

  let cursor = today;
  // hoje ainda sem evento não quebra o streak — começa de ontem.
  if (!days.has(cursor)) cursor = prevDay(cursor);

  let streak = 0;
  let freezeAvailable = true;
  let sinceFreeze = 0;
  // limite de segurança contra loop (2 anos)
  for (let i = 0; i < 800; i++) {
    if (days.has(cursor)) {
      streak++;
      sinceFreeze++;
      if (sinceFreeze >= 7) freezeAvailable = true;
      cursor = prevDay(cursor);
    } else if (freezeAvailable && streak > 0) {
      freezeAvailable = false;
      sinceFreeze = 0;
      cursor = prevDay(cursor); // ponte sobre 1 dia perdido
    } else {
      break;
    }
  }
  return streak;
}

/** Nível por matéria = nº de atoms em 'review' com retrievability ≥ 0.9 (memória durável, spec 07 §2). */
export interface SubjectMastery {
  subject_id: string;
  remembered: number; // review + retrievability ≥ 0.9
  reviewing: number; // learning/relearning ou review < 0.9
  total: number;
}

export function masteryBySubject(childId: string): SubjectMastery[] {
  const child = db
    .prepare("SELECT institution_id, class_id FROM children WHERE id = ?")
    .get(childId) as { institution_id: string | null; class_id: string | null } | undefined;
  const institution = child?.institution_id ?? "bncc-padrao";

  // atoms do aluno (com mastery_state) e a que matéria pertencem via curriculum_map.
  const rows = db
    .prepare(
      `SELECT DISTINCT m.atom_id, m.state, m.retrievability, cm.subject_id
       FROM mastery_state m
       JOIN knowledge_atoms a ON a.id = m.atom_id
       JOIN curriculum_map cm ON cm.bncc_code = a.bncc_code AND cm.institution_id = ?
       WHERE m.child_id = ?`,
    )
    .all(institution, childId) as {
    atom_id: string;
    state: string;
    retrievability: number | null;
    subject_id: string;
  }[];

  const bySubject = new Map<string, SubjectMastery>();
  for (const r of rows) {
    let s = bySubject.get(r.subject_id);
    if (!s) {
      s = { subject_id: r.subject_id, remembered: 0, reviewing: 0, total: 0 };
      bySubject.set(r.subject_id, s);
    }
    s.total++;
    if (r.state === "review" && (r.retrievability ?? 0) >= 0.9) s.remembered++;
    else s.reviewing++;
  }
  return [...bySubject.values()];
}

// ============================================================
// MOEDAS & CONQUISTAS (spec 12.3) — regras anti-dark-pattern do
// spec 07 mantidas: moeda só por evento de aprendizagem real.
// ============================================================

export const COIN_RULES = {
  review: 10, // por revisão com rating ≥ 2
  reviewDailyCap: 12, // máx. revisões/dia que geram moeda (= cap da fila)
  atomMastered: 25, // primeira vez que um atom fica "lembrado"
  streakMilestone: 50, // marcos de streak (7 e 30 dias)
} as const;

/** Regra pura de moeda por revisão (testável): rating < 2 ou cap diário atingido ⇒ 0. */
export function coinsForReview(rating: number, reviewsCountedToday: number): number {
  if (rating < 2) return 0;
  if (reviewsCountedToday >= COIN_RULES.reviewDailyCap) return 0;
  return COIN_RULES.review;
}

export function awardCoins(childId: string, delta: number, reason: string, refId?: string): void {
  db.prepare(
    "INSERT INTO coin_ledger (id, child_id, delta, reason, ref_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(newId(), childId, delta, reason, refId ?? null, nowIso());
}

export function coinBalance(childId: string): number {
  return (db.prepare("SELECT COALESCE(SUM(delta),0) n FROM coin_ledger WHERE child_id = ?").get(childId) as { n: number }).n;
}

/** Moedas ganhas nos últimos 7 dias (base do leaderboard semanal). */
export function weekCoins(childId: string): number {
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  return (db
    .prepare("SELECT COALESCE(SUM(delta),0) n FROM coin_ledger WHERE child_id = ? AND created_at >= ?")
    .get(childId, since) as { n: number }).n;
}

/** Ranking semanal de uma instituição (spec 12.4): apelido apenas, exclui perfis ocultos. */
export function weeklyLeaderboard(institutionId: string, limit = 20): { id: string; display_name: string; coins: number }[] {
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  return db
    .prepare(
      `SELECT ch.id, ch.display_name, COALESCE(SUM(l.delta), 0) AS coins
       FROM children ch
       LEFT JOIN coin_ledger l ON l.child_id = ch.id AND l.created_at >= ?
       WHERE COALESCE(ch.institution_id,'bncc-padrao') = ?
         AND ch.deleted_at IS NULL AND ch.leaderboard_hidden = 0
       GROUP BY ch.id
       HAVING coins > 0
       ORDER BY coins DESC, ch.display_name
       LIMIT ?`,
    )
    .all(since, institutionId, limit) as { id: string; display_name: string; coins: number }[];
}

function reviewCoinsCountedToday(childId: string): number {
  const dayStart = `${localDay()}T00:00:00`;
  // created_at é UTC; o dia local (UTC-3) começa 03:00 UTC — aproximação simples e estável
  const sinceUtc = new Date(new Date(dayStart + "Z").getTime() + 3 * 3600 * 1000).toISOString();
  return (db
    .prepare("SELECT COUNT(*) n FROM coin_ledger WHERE child_id = ? AND reason = 'review' AND created_at >= ?")
    .get(childId, sinceUtc) as { n: number }).n;
}

const ACHIEVEMENT_TITLES: Record<string, string> = {
  first_lesson: "Primeira missão cumprida",
  streak_7: "7 dias seguidos estudando",
  streak_30: "30 dias seguidos estudando",
  atoms_10: "10 conceitos dominados",
  atoms_50: "50 conceitos dominados",
  prova_ready_80: "80% pronto para uma prova",
  module_complete: "Módulo concluído com maestria",
};

/** Desbloqueia (dedup por UNIQUE). Retorna true se foi um desbloqueio novo; grava notificação. */
export function unlockAchievement(parentId: string, childId: string, code: string): boolean {
  try {
    db.prepare("INSERT INTO achievements (id, child_id, code, unlocked_at) VALUES (?, ?, ?, ?)").run(
      newId(), childId, code, nowIso(),
    );
  } catch {
    return false; // já desbloqueada (UNIQUE child_id+code)
  }
  const title = ACHIEVEMENT_TITLES[code] ?? code;
  db.prepare(
    `INSERT INTO notifications (id, parent_id, child_id, kind, title, body, link, created_at)
     VALUES (?, ?, ?, 'achievement', ?, ?, '/conquistas', ?)`,
  ).run(newId(), parentId, childId, `🏅 Conquista: ${title}`, "Continue assim — consistência vence.", nowIso());
  return true;
}

export interface ReviewRewards {
  coins: number;
  unlocked: string[];
}

/** Processa recompensas após uma revisão FSRS (chamado pela rota /api/mastery/review). */
export function processReviewRewards(
  parentId: string,
  childId: string,
  atomId: string,
  rating: number,
  result: ReviewResult,
): ReviewRewards {
  let coins = 0;
  const unlocked: string[] = [];

  // 1) moeda por revisão (regra pura + cap diário)
  const counted = reviewCoinsCountedToday(childId);
  const c = coinsForReview(rating, counted);
  if (c > 0) {
    awardCoins(childId, c, "review", atomId);
    coins += c;
  }

  // 2) atom dominado pela 1ª vez (dedup pelo ledger)
  if (result.state === "review" && result.retrievability >= 0.9) {
    const seen = db
      .prepare("SELECT 1 FROM coin_ledger WHERE child_id = ? AND reason = 'atom_mastered' AND ref_id = ? LIMIT 1")
      .get(childId, atomId);
    if (!seen) {
      awardCoins(childId, COIN_RULES.atomMastered, "atom_mastered", atomId);
      coins += COIN_RULES.atomMastered;
    }
  }

  // 3) conquistas
  if (unlockAchievement(parentId, childId, "first_lesson")) unlocked.push("first_lesson");
  const streak = currentStreak(childId);
  if (streak >= 7 && unlockAchievement(parentId, childId, "streak_7")) {
    awardCoins(childId, COIN_RULES.streakMilestone, "streak_7");
    coins += COIN_RULES.streakMilestone;
    unlocked.push("streak_7");
  }
  if (streak >= 30 && unlockAchievement(parentId, childId, "streak_30")) {
    awardCoins(childId, COIN_RULES.streakMilestone, "streak_30");
    coins += COIN_RULES.streakMilestone;
    unlocked.push("streak_30");
  }
  const mastered = (db
    .prepare("SELECT COUNT(*) n FROM coin_ledger WHERE child_id = ? AND reason = 'atom_mastered'")
    .get(childId) as { n: number }).n;
  if (mastered >= 10 && unlockAchievement(parentId, childId, "atoms_10")) unlocked.push("atoms_10");
  if (mastered >= 50 && unlockAchievement(parentId, childId, "atoms_50")) unlocked.push("atoms_50");
  if (provaCountdowns(childId).some((p) => p.readiness >= 0.8)) {
    if (unlockAchievement(parentId, childId, "prova_ready_80")) unlocked.push("prova_ready_80");
  }

  return { coins, unlocked };
}
