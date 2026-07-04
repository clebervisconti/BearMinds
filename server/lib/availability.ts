// Motor de desbloqueio (spec 15.5): árvore JSON de condições avaliada genericamente.
// Núcleo PURO (testável por tabela-verdade) + um resolver DB-backed por criança.
import { db } from "../db.ts";

export type Cond =
  | { all: Cond[] }
  | { any: Cond[] }
  | { type: "completed"; item_id: string; label?: string }
  | { type: "module_mastered"; module_id: string; label?: string }
  | { type: "exam_min"; exam_id: string; score: number; label?: string }
  | { type: "date_from"; iso: string };

/** Sinais resolvidos pelo caller — permite testar o motor sem banco. */
export interface AvailabilityResolver {
  isCompleted(itemId: string): boolean;
  isModuleMastered(moduleId: string): boolean;
  examBest(examId: string): number | null;   // melhor score submetido (0..1) ou null
  now: number;                                // Date.now() injetado
}

export interface AvailabilityResult {
  available: boolean;
  reason: string | null;   // motivo legível (PT) do primeiro bloqueio, p/ o 🔒
}

function leafReason(c: Cond): string {
  switch ((c as { type?: string }).type) {
    case "completed": return (c as { label?: string }).label || "Conclua a atividade anterior";
    case "module_mastered": return (c as { label?: string }).label || "Domine o módulo anterior";
    case "exam_min": return (c as { label?: string; score: number }).label || `Alcance ${Math.round((c as { score: number }).score * 100)}% na prova`;
    case "date_from": return `Disponível a partir de ${new Date((c as { iso: string }).iso).toLocaleDateString("pt-BR")}`;
    default: return "Requisito pendente";
  }
}

function ok(c: Cond, r: AvailabilityResolver): boolean {
  if ("all" in c) return c.all.every((x) => ok(x, r));
  if ("any" in c) return c.any.length === 0 || c.any.some((x) => ok(x, r));
  switch (c.type) {
    case "completed": return r.isCompleted(c.item_id);
    case "module_mastered": return r.isModuleMastered(c.module_id);
    case "exam_min": { const b = r.examBest(c.exam_id); return b !== null && b >= c.score; }
    case "date_from": return r.now >= new Date(c.iso).getTime();
  }
}

/** Primeiro requisito bloqueante (para a mensagem do cadeado). */
function firstBlocking(c: Cond, r: AvailabilityResolver): Cond | null {
  if ("all" in c) { for (const x of c.all) { if (!ok(x, r)) return firstBlocking(x, r) ?? x; } return null; }
  if ("any" in c) { if (c.any.length === 0 || c.any.some((x) => ok(x, r))) return null; return c.any[0]; }
  return ok(c, r) ? null : c;
}

/** Avalia a árvore. `cond` null/undefined ⇒ sempre disponível. */
export function evaluateAvailability(cond: Cond | null | undefined, r: AvailabilityResolver): AvailabilityResult {
  if (!cond) return { available: true, reason: null };
  if (ok(cond, r)) return { available: true, reason: null };
  const blocking = firstBlocking(cond, r);
  return { available: false, reason: blocking ? leafReason(blocking) : "Requisito pendente" };
}

/** Constrói o resolver real a partir do estado da criança (sinais duráveis). */
export function resolverFor(childId: string): AvailabilityResolver {
  return {
    isCompleted: (itemId) =>
      db.prepare("SELECT 1 FROM item_progress WHERE child_id = ? AND item_id = ? AND status = 'done'").get(childId, itemId) != null,
    // módulo dominado = já premiado no ledger (sinal durável de conclusão mastery-gated).
    isModuleMastered: (moduleId) =>
      db.prepare("SELECT 1 FROM coin_ledger WHERE child_id = ? AND reason = 'module_complete' AND ref_id = ?").get(childId, moduleId) != null,
    examBest: (examId) => {
      const row = db.prepare(
        "SELECT MAX(score) AS best FROM exam_attempts WHERE exam_id = ? AND child_id = ? AND submitted_at IS NOT NULL",
      ).get(examId, childId) as { best: number | null } | undefined;
      return row?.best ?? null;
    },
    now: Date.now(),
  };
}

/** Parse defensivo de `availability_json` (coluna TEXT). */
export function parseCond(json: string | null | undefined): Cond | null {
  if (!json) return null;
  try { return JSON.parse(json) as Cond; } catch { return null; }
}
