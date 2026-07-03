// "Para revisar hoje" (spec 06.3): fila FSRS com cap + interleaving + ancoragem à prova.
import { db } from "../db.ts";
import { retrievabilityOf, getMasteryRow, type MasteryRow } from "./fsrs.ts";
import { exemplarFor } from "../gen/exemplars.ts";
import type { AgeBand, ProvaCountdown, ReviewItem, QuizQuestion } from "../../shared/contracts.ts";

const capFor = (ageBand: AgeBand) => (ageBand === "8-10" ? 6 : 12);

interface ProvaRow {
  id: string;
  title: string;
  subject_id: string | null;
  exam_date: string;
  bncc_codes: string;
}

export function upcomingProvas(childId: string, now = new Date()): ProvaRow[] {
  return (db
    .prepare(
      "SELECT id, title, subject_id, exam_date, bncc_codes FROM prova_calendar WHERE child_id = ? AND exam_date >= ? ORDER BY exam_date",
    )
    .all(childId, now.toISOString().slice(0, 10)) as ProvaRow[]);
}

/** Prontidão (0..1) = média de retrievability sobre os atoms das habilidades informadas. */
export function readinessForCodes(childId: string, codes: string[], now = new Date()): number {
  if (codes.length === 0) return 0;
  const placeholders = codes.map(() => "?").join(",");
  const atoms = db
    .prepare(`SELECT id FROM knowledge_atoms WHERE bncc_code IN (${placeholders})`)
    .all(...codes) as { id: string }[];
  if (atoms.length === 0) return 0;
  let sum = 0;
  for (const a of atoms) {
    const row = getMasteryRow(childId, a.id);
    sum += row ? retrievabilityOf(row, now) : 0;
  }
  return sum / atoms.length;
}

export function provaCountdowns(childId: string, now = new Date()): ProvaCountdown[] {
  return upcomingProvas(childId, now).map((p) => {
    const codes = JSON.parse(p.bncc_codes) as string[];
    const daysLeft = Math.ceil((new Date(p.exam_date + "T23:59:59Z").getTime() - now.getTime()) / 86400000);
    return {
      id: p.id,
      title: p.title,
      subject_id: p.subject_id,
      exam_date: p.exam_date,
      days_left: Math.max(0, daysLeft),
      readiness: readinessForCodes(childId, codes, now),
    };
  });
}

/** Data-limite de revisão de um atom por causa de prova (T-1) — ou undefined. */
export function examClampForCode(childId: string, bnccCode: string, now = new Date()): Date | undefined {
  for (const p of upcomingProvas(childId, now)) {
    const codes = JSON.parse(p.bncc_codes) as string[];
    if (codes.includes(bnccCode)) {
      const d = new Date(p.exam_date + "T12:00:00Z");
      d.setUTCDate(d.getUTCDate() - 1); // T-1
      return d;
    }
  }
  return undefined;
}

// Seleciona UMA questão de recuperação para o atom (do cache; rotaciona variantes por reps).
function questionForAtom(bnccCode: string, atomId: string, reps: number): QuizQuestion | null {
  const pool: QuizQuestion[] = [];
  const rows = db
    .prepare("SELECT payload_json FROM generated_artifacts WHERE bncc_code = ? AND kind = 'quiz' AND safety_passed = 1")
    .all(bnccCode) as { payload_json: string }[];
  for (const r of rows) {
    const quiz = JSON.parse(r.payload_json) as { questions: QuizQuestion[] };
    for (const q of quiz.questions ?? []) if (q.atom_id === atomId) pool.push(q);
  }
  if (pool.length === 0) {
    const ex = exemplarFor(bnccCode);
    if (ex) for (const q of ex.quiz.questions) if (q.atom_id === atomId) pool.push(q);
  }
  if (pool.length === 0) return null;
  return pool[reps % pool.length];
}

interface DueRow extends MasteryRow {
  bncc_code: string;
}

export function buildTodayQueue(childId: string, ageBand: AgeBand, now = new Date()): ReviewItem[] {
  const cap = capFor(ageBand);
  const due = db
    .prepare(
      `SELECT m.*, a.bncc_code AS bncc_code
       FROM mastery_state m JOIN knowledge_atoms a ON a.id = m.atom_id
       WHERE m.child_id = ? AND m.due IS NOT NULL AND m.due <= ?`,
    )
    .all(childId, now.toISOString()) as DueRow[];
  if (due.length === 0) return [];

  // proximidade de prova por code
  const provaProximity = new Map<string, number>();
  for (const p of upcomingProvas(childId, now)) {
    const codes = JSON.parse(p.bncc_codes) as string[];
    const days = Math.ceil((new Date(p.exam_date + "T23:59:59Z").getTime() - now.getTime()) / 86400000);
    for (const c of codes) provaProximity.set(c, Math.min(provaProximity.get(c) ?? Infinity, days));
  }

  const scored = due
    .map((r) => ({
      row: r,
      proximity: provaProximity.get(r.bncc_code) ?? Infinity,
      retr: retrievabilityOf(r, now),
    }))
    .sort((a, b) => a.proximity - b.proximity || a.retr - b.retr)
    .slice(0, cap);

  // interleaving: nunca > 2 consecutivos do mesmo bncc_code
  const ordered = interleave(scored.map((s) => s.row));

  const items: ReviewItem[] = [];
  for (const r of ordered) {
    const q = questionForAtom(r.bncc_code, r.atom_id, r.reps);
    if (!q) continue; // sem questão disponível → não dá pra revisar
    items.push({
      atom_id: r.atom_id,
      bncc_code: r.bncc_code,
      title: titleFor(r.bncc_code),
      question: q,
    });
  }
  return items;
}

function interleave(rows: DueRow[]): DueRow[] {
  const out: DueRow[] = [];
  const pool = [...rows];
  while (pool.length) {
    let idx = pool.findIndex(
      (r) =>
        !(
          out.length >= 2 &&
          out[out.length - 1].bncc_code === r.bncc_code &&
          out[out.length - 2].bncc_code === r.bncc_code
        ),
    );
    if (idx === -1) idx = 0;
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

function titleFor(code: string): string {
  const row = db.prepare("SELECT title FROM curriculum_map WHERE bncc_code = ? AND title IS NOT NULL LIMIT 1").get(code) as
    | { title: string }
    | undefined;
  return row?.title ?? code;
}
