// Testes P5a (spec 15): motor de desbloqueio, sorteio/correção de prova, rubrica, banco de questões.
import { describe, it, expect, beforeAll } from "vitest";
import { db, newId, nowIso } from "../server/db.ts";
import { evaluateAvailability, type AvailabilityResolver, type Cond } from "../server/lib/availability.ts";
import { seededShuffle, seededRng, gradeResponse, isAutoGradable, normalizeShort } from "../server/exams/grade.ts";
import { scoreRubric, type RubricSection } from "../server/lib/rubric.ts";
import { persistQuestionsToBank } from "../server/gen/enrich.ts";

// resolver fake p/ testar o motor de desbloqueio sem banco
function resolver(over: Partial<AvailabilityResolver> = {}): AvailabilityResolver {
  return {
    isCompleted: () => false,
    isModuleMastered: () => false,
    examBest: () => null,
    now: Date.parse("2026-07-04T12:00:00Z"),
    ...over,
  };
}

// ---------------- Motor de desbloqueio (spec 15.5) ----------------
describe("evaluateAvailability", () => {
  it("condição nula ⇒ sempre disponível", () => {
    expect(evaluateAvailability(null, resolver()).available).toBe(true);
    expect(evaluateAvailability(undefined, resolver()).available).toBe(true);
  });
  it("completed depende do resolver", () => {
    const c: Cond = { type: "completed", item_id: "i1", label: "Faça a Aula 1" };
    expect(evaluateAvailability(c, resolver({ isCompleted: (id) => id === "i1" })).available).toBe(true);
    const blocked = evaluateAvailability(c, resolver({ isCompleted: () => false }));
    expect(blocked.available).toBe(false);
    expect(blocked.reason).toBe("Faça a Aula 1");        // motivo legível p/ o 🔒
  });
  it("module_mastered", () => {
    const c: Cond = { type: "module_mastered", module_id: "m1" };
    expect(evaluateAvailability(c, resolver({ isModuleMastered: (m) => m === "m1" })).available).toBe(true);
    expect(evaluateAvailability(c, resolver()).available).toBe(false);
  });
  it("exam_min: precisa de score >= limiar", () => {
    const c: Cond = { type: "exam_min", exam_id: "e1", score: 0.8 };
    expect(evaluateAvailability(c, resolver({ examBest: () => 0.79 })).available).toBe(false);
    expect(evaluateAvailability(c, resolver({ examBest: () => 0.8 })).available).toBe(true);
    expect(evaluateAvailability(c, resolver({ examBest: () => null })).available).toBe(false);
  });
  it("date_from", () => {
    const past: Cond = { type: "date_from", iso: "2026-01-01T00:00:00Z" };
    const future: Cond = { type: "date_from", iso: "2027-01-01T00:00:00Z" };
    expect(evaluateAvailability(past, resolver()).available).toBe(true);
    expect(evaluateAvailability(future, resolver()).available).toBe(false);
  });
  it("all exige todos; any exige um", () => {
    const all: Cond = { all: [{ type: "completed", item_id: "a" }, { type: "completed", item_id: "b" }] };
    expect(evaluateAvailability(all, resolver({ isCompleted: (id) => id === "a" })).available).toBe(false);
    expect(evaluateAvailability(all, resolver({ isCompleted: () => true })).available).toBe(true);
    const any: Cond = { any: [{ type: "completed", item_id: "a" }, { type: "completed", item_id: "b" }] };
    expect(evaluateAvailability(any, resolver({ isCompleted: (id) => id === "b" })).available).toBe(true);
    expect(evaluateAvailability(any, resolver()).available).toBe(false);
  });
  it("any vazio ⇒ disponível (sem requisitos)", () => {
    expect(evaluateAvailability({ any: [] }, resolver()).available).toBe(true);
  });
});

// ---------------- Sorteio + correção de prova (spec 15.3) ----------------
describe("seededShuffle / seededRng", () => {
  it("mesmo seed ⇒ mesma ordem (reproduzível na tentativa)", () => {
    const arr = ["q1", "q2", "q3", "q4", "q5"];
    expect(seededShuffle(arr, "exam:child:0")).toEqual(seededShuffle(arr, "exam:child:0"));
  });
  it("seeds diferentes ⇒ ordens (quase sempre) diferentes — dois alunos, sorteios distintos", () => {
    const arr = Array.from({ length: 20 }, (_, i) => `q${i}`);
    expect(seededShuffle(arr, "exam:ana:0")).not.toEqual(seededShuffle(arr, "exam:beto:0"));
  });
  it("não muta o array original e preserva os elementos", () => {
    const arr = ["a", "b", "c"];
    const out = seededShuffle(arr, "x");
    expect(arr).toEqual(["a", "b", "c"]);
    expect([...out].sort()).toEqual(["a", "b", "c"]);
  });
  it("rng é determinístico e em [0,1)", () => {
    const r = seededRng("s"); const v = r();
    expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1);
    expect(seededRng("s")()).toBe(v);
  });
});

describe("gradeResponse", () => {
  it("mcq compara índice", () => {
    expect(gradeResponse("mcq", 2, 2)).toBe(true);
    expect(gradeResponse("mcq", 2, 1)).toBe(false);
  });
  it("tf compara booleano", () => {
    expect(gradeResponse("tf", true, true)).toBe(true);
    expect(gradeResponse("tf", false, true)).toBe(false);
  });
  it("numeric respeita a tolerância", () => {
    expect(gradeResponse("numeric", { value: 10, tolerance: 0.5 }, 10.4)).toBe(true);
    expect(gradeResponse("numeric", { value: 10, tolerance: 0.5 }, 10.6)).toBe(false);
    expect(gradeResponse("numeric", { value: 10 }, 10)).toBe(true);
  });
  it("short normaliza acento/caixa/pontuação", () => {
    expect(gradeResponse("short", { accepted: ["São Paulo"] }, "sao paulo")).toBe(true);
    expect(gradeResponse("short", { accepted: ["fração"] }, "Fracao!")).toBe(true);
    expect(gradeResponse("short", { accepted: ["a"] }, "b")).toBe(false);
  });
  it("normalizeShort é estável", () => {
    expect(normalizeShort("   Á É í ")).toBe("a e i");
  });
  it("só mcq/tf/numeric são auto-corrigíveis", () => {
    expect(isAutoGradable("mcq")).toBe(true);
    expect(isAutoGradable("short")).toBe(false);
  });
});

// ---------------- Rubrica (spec 15.4) ----------------
describe("scoreRubric", () => {
  const sections: RubricSection[] = [
    { title: "Conteúdo", weight: 2, criteria: [{ label: "corretude", levels: [{ label: "ruim", points: 0 }, { label: "ok", points: 1 }, { label: "ótimo", points: 2 }] }] },
    { title: "Clareza", weight: 1, criteria: [{ label: "clareza", levels: [{ label: "ruim", points: 0 }, { label: "boa", points: 2 }] }] },
  ];
  it("nota máxima em tudo ⇒ 100% dos pontos", () => {
    const r = scoreRubric(sections, [[2], [1]], 100);
    expect(r.fraction).toBeCloseTo(1); expect(r.points).toBe(100);
  });
  it("nota mínima ⇒ 0", () => {
    expect(scoreRubric(sections, [[0], [0]], 100).points).toBe(0);
  });
  it("média ponderada: seção de peso 2 (100%) + peso 1 (0%) = 2/3", () => {
    const r = scoreRubric(sections, [[2], [0]], 100);
    expect(r.fraction).toBeCloseTo(2 / 3);
    expect(r.points).toBe(67);
  });
  it("seleção fora do range é ignorada (conta como 0)", () => {
    expect(scoreRubric(sections, [[99], [1]], 100).fraction).toBeCloseTo((2 * 0 + 1 * 1) / 3);
  });
});

// ---------------- Banco de questões: IA preenche + versionamento (spec 15.2) ----------------
describe("banco de questões", () => {
  const COURSE = "assess-course";
  beforeAll(() => {
    db.prepare("INSERT OR IGNORE INTO institutions (id,name,kind,config_json) VALUES ('assess-inst','A','school','{}')").run();
    db.prepare("INSERT OR IGNORE INTO parents (id,email,password_hash,created_at,role,staff_institution_id) VALUES ('assess-prof','p@x.com','h',?,'professor','assess-inst')").run(nowIso());
    db.prepare("INSERT OR IGNORE INTO courses (id,institution_id,subject_id,class_id,title,status,created_by,created_at) VALUES (?, 'assess-inst','mat','6EF','C','published','assess-prof',?)").run(COURSE, nowIso());
  });

  it("persistQuestionsToBank insere mcq/numeric/short como draft e é idempotente", () => {
    const qs = [
      { kind: "mcq", prompt: "2+2?", options: ["3", "4"], answer_index: 1, explanation: "soma" },
      { kind: "numeric", prompt: "3*3?", answer_number: 9 },
      { kind: "short", prompt: "capital?", accept: ["brasília"] },
      { kind: "essay", prompt: "disserte" },   // não mapeia → ignorada
    ];
    const n1 = persistQuestionsToBank(COURSE, "BNCC-X", qs, "assess-prof");
    expect(n1).toBe(3);
    // re-rodar substitui os drafts de IA (idempotente), não duplica
    const n2 = persistQuestionsToBank(COURSE, "BNCC-X", qs, "assess-prof");
    expect(n2).toBe(3);
    const count = (db.prepare("SELECT COUNT(*) n FROM bank_questions WHERE course_id=? AND bncc_code='BNCC-X' AND origin='ai'").get(COURSE) as { n: number }).n;
    expect(count).toBe(3);
  });

  it("editar questão aprovada cria nova versão e aposenta a antiga (tentativas antigas ficam íntegras)", () => {
    const id = newId();
    db.prepare("INSERT INTO bank_questions (id,course_id,kind,prompt,options_json,answer_json,status,origin,created_by,version,created_at) VALUES (?,?,'mcq','v1?',?,?,'approved','staff','assess-prof',1,?)")
      .run(id, COURSE, JSON.stringify(["a", "b"]), JSON.stringify(0), nowIso());
    // simula o efeito do PATCH sobre uma questão aprovada
    const nid = newId();
    db.prepare("INSERT INTO bank_questions (id,course_id,kind,prompt,options_json,answer_json,status,origin,created_by,version,created_at) VALUES (?,?,'mcq','v2?',?,?,'draft','staff','assess-prof',2,?)")
      .run(nid, COURSE, JSON.stringify(["a", "b"]), JSON.stringify(1), nowIso());
    db.prepare("UPDATE bank_questions SET status='retired', replaced_by=? WHERE id=?").run(nid, id);

    const old = db.prepare("SELECT status, replaced_by FROM bank_questions WHERE id=?").get(id) as { status: string; replaced_by: string };
    expect(old.status).toBe("retired");
    expect(old.replaced_by).toBe(nid);
    const neu = db.prepare("SELECT version, prompt FROM bank_questions WHERE id=?").get(nid) as { version: number; prompt: string };
    expect(neu.version).toBe(2);
    expect(neu.prompt).toBe("v2?");
  });
});
