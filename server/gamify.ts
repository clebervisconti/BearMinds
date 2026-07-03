// Gamificação "done right" (spec 07): mecânica só a serviço de recuperação + espaçamento.
// Streak amarrado a evento de aprendizagem real (revisão com rating ≥ 2), com 1 freeze/semana.
import { db, nowIso } from "./db.ts";
import { localDay } from "./lib/domain.ts";

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
