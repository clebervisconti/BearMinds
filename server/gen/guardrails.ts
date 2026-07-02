// Guardrails puros e testáveis do motor de geração (spec 05 §5.3). Sem I/O, sem LLM.
import { normalize } from "../lib/text.ts";
import type { Lesson, Quiz, QuizQuestion, Explorable } from "../../shared/contracts.ts";

// ---------- Grounding: cada afirmação deve citar um source_id existente ----------
export function groundingCheck(lesson: Lesson, validSourceIds: Set<string>): Lesson {
  if (lesson.refused) return lesson;
  const sections = (lesson.sections ?? []).filter((s) => s.source_id && validSourceIds.has(s.source_id));
  if (sections.length === 0) {
    return {
      refused: true,
      reason: "Conteúdo sem base suficiente no material verificado.",
      warmup_question: "",
      sections: [],
      recap_questions: [],
      companion_note: "",
    };
  }
  return { ...lesson, sections };
}

// ---------- Answer-withholding: dicas 1 e 2 nunca contêm a resposta ----------
function answerStrings(q: QuizQuestion): string[] {
  const out: string[] = [];
  if (q.kind === "mcq" && q.options && typeof q.answer_index === "number") {
    const a = q.options[q.answer_index];
    if (a) out.push(a);
  }
  if (q.kind === "numeric" && typeof q.answer_number === "number") out.push(String(q.answer_number));
  if (q.kind === "short" && q.accept) out.push(...q.accept);
  return out.filter(Boolean);
}

const GENERIC_HINTS = [
  "Pense no primeiro passo: o que a pergunta está pedindo?",
  "Volte ao conceito principal — o que você já sabe que se aplica aqui?",
];

/** Garante 3 dicas e que as duas primeiras não revelem a resposta (invariante testado). */
export function sanitizeQuiz(quiz: Quiz): Quiz {
  const questions = (quiz.questions ?? []).map((q, qi) => {
    const answers = answerStrings(q).map(normalize).filter((a) => a.length >= 1);
    let hints = Array.isArray(q.hints) ? [...q.hints] : [];
    while (hints.length < 3) hints.push(GENERIC_HINTS[hints.length % GENERIC_HINTS.length]);
    hints = hints.slice(0, 3);
    // dicas 1 e 2 não podem conter a resposta literal
    for (let i = 0; i < 2; i++) {
      const hn = normalize(hints[i] ?? "");
      if (answers.some((a) => a.length >= 2 && hn.includes(a))) {
        hints[i] = GENERIC_HINTS[i % GENERIC_HINTS.length];
      }
    }
    return {
      ...q,
      id: q.id || `q${qi + 1}`,
      hints: [hints[0], hints[1], hints[2]] as [string, string, string],
      explanation: q.explanation || "",
    };
  });
  return { questions };
}

// ---------- Explorable sandbox-safe ----------
const FORBIDDEN = [
  /\bfetch\s*\(/i,
  /XMLHttpRequest/i,
  /WebSocket/i,
  /\beval\s*\(/i,
  /new\s+Function/i,
  /\bimport\s*\(/i,
  /localStorage/i,
  /sessionStorage/i,
  /indexedDB/i,
  /document\s*\.\s*cookie/i,
  /navigator\s*\.\s*sendBeacon/i,
  /https?:\/\//i, // sem recursos externos
  /<script\s+src/i,
];
export const EXPLORABLE_MAX_BYTES = 45 * 1024;

export function validateExplorable(e: Explorable): { ok: boolean; reason?: string } {
  const blob = `${e.html || ""}\n${e.css || ""}\n${e.js || ""}`;
  if (Buffer.byteLength(blob, "utf8") > EXPLORABLE_MAX_BYTES) {
    return { ok: false, reason: "explorable acima do limite de tamanho" };
  }
  for (const re of FORBIDDEN) {
    if (re.test(blob)) return { ok: false, reason: `explorable usa padrão proibido: ${re}` };
  }
  if (!e.js && !e.html) return { ok: false, reason: "explorable vazio" };
  return { ok: true };
}

// ---------- Correções do mathcheck ----------
export interface MathCheckResult {
  question_id: string;
  ok: boolean;
  corrected_answer_index?: number | null;
  corrected_answer_number?: number | null;
}

export function applyMathCorrections(quiz: Quiz, results: MathCheckResult[]): Quiz {
  const byId = new Map(results.map((r) => [r.question_id, r]));
  const questions = quiz.questions.map((q) => {
    const r = byId.get(q.id);
    if (!r || r.ok) return q;
    const next = { ...q };
    if (typeof r.corrected_answer_index === "number") next.answer_index = r.corrected_answer_index;
    if (typeof r.corrected_answer_number === "number") next.answer_number = r.corrected_answer_number;
    return next;
  });
  return { questions };
}
