// Motor FSRS (spec 06) — memória por knowledge-atom, retenção-alvo 0.90.
import { fsrs, generatorParameters, createEmptyCard, Rating, State, type Card } from "ts-fsrs";
import { db, nowIso } from "../db.ts";

const engine = fsrs(generatorParameters({ request_retention: 0.9 }));

const STATE_TEXT = ["new", "learning", "review", "relearning"] as const;
export type MasteryStateText = (typeof STATE_TEXT)[number];
const textToState = (t: string): State => Math.max(0, STATE_TEXT.indexOf(t as MasteryStateText)) as State;

export interface MasteryRow {
  child_id: string;
  atom_id: string;
  stability: number;
  difficulty: number;
  retrievability: number | null;
  state: string;
  reps: number;
  lapses: number;
  last_review: string | null;
  due: string | null;
}

export function getMasteryRow(childId: string, atomId: string): MasteryRow | undefined {
  return db.prepare("SELECT * FROM mastery_state WHERE child_id = ? AND atom_id = ?").get(childId, atomId) as
    | MasteryRow
    | undefined;
}

function rowToCard(row: MasteryRow): Card {
  return {
    due: row.due ? new Date(row.due) : new Date(),
    stability: row.stability,
    difficulty: row.difficulty || 5,
    elapsed_days: 0,
    scheduled_days: 0,
    reps: row.reps,
    lapses: row.lapses,
    state: textToState(row.state),
    last_review: row.last_review ? new Date(row.last_review) : undefined,
  };
}

/** Retrievability atual (0..1) de um atom — base da "prontidão" (readiness). */
export function retrievabilityOf(row: MasteryRow, now = new Date()): number {
  if (!row.last_review || row.state === "new") return 0;
  const r = engine.get_retrievability(rowToCard(row), now, false) as unknown as number;
  return typeof r === "number" ? r : 0;
}

export interface ReviewResult {
  due: string;
  state: MasteryStateText;
  retrievability: number;
}

/** Aplica uma revisão (rating 1..4) e reagenda o atom. Opcionalmente comprime p/ uma prova. */
export function reviewAtom(
  childId: string,
  atomId: string,
  rating: 1 | 2 | 3 | 4,
  opts?: { examClampDue?: Date },
  now = new Date(),
): ReviewResult {
  const existing = getMasteryRow(childId, atomId);
  const card = existing ? rowToCard(existing) : createEmptyCard(now);
  const record = engine.repeat(card, now) as unknown as Record<number, { card: Card }>;
  const next = record[rating].card;

  // Ancoragem à prova (spec 06.2): se a próxima revisão cair depois da prova, puxa p/ antes.
  let due = next.due;
  if (opts?.examClampDue && due.getTime() > opts.examClampDue.getTime()) {
    due = opts.examClampDue;
  }

  const stateText = STATE_TEXT[next.state] as MasteryStateText;
  const retr = engine.get_retrievability(next, now, false) as unknown as number;

  db.prepare(
    `INSERT OR REPLACE INTO mastery_state
      (child_id, atom_id, stability, difficulty, retrievability, state, reps, lapses, last_review, due)
     VALUES (@child_id,@atom_id,@stability,@difficulty,@retrievability,@state,@reps,@lapses,@last_review,@due)`,
  ).run({
    child_id: childId,
    atom_id: atomId,
    stability: next.stability,
    difficulty: next.difficulty,
    retrievability: typeof retr === "number" ? retr : null,
    state: stateText,
    reps: next.reps,
    lapses: next.lapses,
    last_review: now.toISOString(),
    due: due.toISOString(),
  });

  return { due: due.toISOString(), state: stateText, retrievability: typeof retr === "number" ? retr : 1 };
}

/** Garante uma linha 'new' para um atom (ao estudar algo novo). Não altera se já existir. */
export function ensureMasteryRow(childId: string, atomId: string): void {
  const exists = getMasteryRow(childId, atomId);
  if (exists) return;
  db.prepare(
    `INSERT INTO mastery_state (child_id, atom_id, stability, difficulty, state, reps, lapses)
     VALUES (?, ?, 0, 5, 'new', 0, 0)`,
  ).run(childId, atomId);
}

export { Rating, State };
