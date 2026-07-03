import { describe, it, expect } from "vitest";
import {
  sanitizeQuiz,
  groundingCheck,
  validateExplorable,
  applyMathCorrections,
} from "../server/gen/guardrails.ts";
import type { Lesson, Quiz, Explorable } from "../shared/contracts.ts";

describe("answer-withholding (sanitizeQuiz)", () => {
  it("remove a resposta das duas primeiras dicas e garante 3 dicas", () => {
    const quiz: Quiz = {
      questions: [
        {
          id: "q1",
          atom_id: "a1",
          kind: "mcq",
          prompt: "Equivalente a 1/2?",
          options: ["2/4", "1/3"],
          answer_index: 0,
          hints: ["A resposta é 2/4 mesmo", "quase 2/4"] as unknown as [string, string, string],
          explanation: "…",
        },
      ],
    };
    const out = sanitizeQuiz(quiz);
    const q = out.questions[0];
    expect(q.hints).toHaveLength(3);
    expect(q.hints[0].toLowerCase()).not.toContain("2/4");
    expect(q.hints[1].toLowerCase()).not.toContain("2/4");
  });
});

describe("grounding (groundingCheck)", () => {
  const base: Lesson = {
    refused: false,
    reason: null,
    warmup_question: "?",
    sections: [{ claim: "x", explanation: "y", source_id: "chunk_1" }],
    recap_questions: [],
    companion_note: "",
  };
  it("aceita seções com source_id válido", () => {
    const out = groundingCheck(base, new Set(["chunk_1"]));
    expect(out.refused).toBe(false);
    expect(out.sections).toHaveLength(1);
  });
  it("RECUSA quando nenhuma seção tem source_id válido (corpus vazio)", () => {
    const out = groundingCheck(base, new Set(["outro"]));
    expect(out.refused).toBe(true);
  });
});

describe("explorable sandbox-safe (validateExplorable)", () => {
  const mk = (js: string): Explorable => ({ title: "t", instruction: "i", html: "<div></div>", css: "", js });
  it("rejeita fetch/localStorage/URL externa", () => {
    expect(validateExplorable(mk("fetch('http://x')")).ok).toBe(false);
    expect(validateExplorable(mk("localStorage.setItem('a',1)")).ok).toBe(false);
    expect(validateExplorable(mk("var i = new Image(); i.src='https://x.com/a.png'")).ok).toBe(false);
    expect(validateExplorable(mk("eval('1+1')")).ok).toBe(false);
  });
  it("aceita DOM puro", () => {
    expect(validateExplorable(mk("document.getElementById('x').textContent='oi'")).ok).toBe(true);
  });
});

describe("mathcheck (applyMathCorrections)", () => {
  it("corrige o answer_index quando o verificador reprova", () => {
    const quiz: Quiz = {
      questions: [
        { id: "q1", atom_id: "a1", kind: "mcq", prompt: "?", options: ["a", "b"], answer_index: 0, hints: ["", "", ""], explanation: "" },
      ],
    };
    const out = applyMathCorrections(quiz, [{ question_id: "q1", ok: false, corrected_answer_index: 1 }]);
    expect(out.questions[0].answer_index).toBe(1);
  });
});
