// Testes do LMS (spec 13): pipeline utils, escopo de staff, conclusão mastery-gated.
import { describe, it, expect, beforeAll } from "vitest";
import { db, newId, nowIso } from "../server/db.ts";
import { chunkText, gradeToAgeBand, skillCodeForItem } from "../server/gen/enrich.ts";
import { parentRole, staffInstitutionOrThrow } from "../server/lib/session.ts";
import { moduleComplete } from "../server/routes/learn.ts";

beforeAll(() => {
  db.prepare("INSERT OR IGNORE INTO institutions (id,name,kind,config_json) VALUES ('lms-inst','LMS Inst','school','{}')").run();
});

describe("chunkText (pipeline de enriquecimento)", () => {
  it("divide texto longo em chunks e ignora fragmentos curtos", () => {
    const para = "Frações equivalentes representam a mesma parte de um inteiro e são obtidas multiplicando numerador e denominador pelo mesmo número. ";
    const text = Array.from({ length: 12 }, () => para).join("\n\n") + "\n\nok"; // último é curto demais
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks.every((c) => c.length >= 40)).toBe(true);
    expect(chunks.some((c) => c.includes("ok") && c.length < 40)).toBe(false);
  });
  it("texto vazio → nenhum chunk", () => expect(chunkText("   ")).toHaveLength(0));
});

describe("gradeToAgeBand", () => {
  it("EF 1-5 → 8-10; EF 6-9 → 11-14; EM → 15-18", () => {
    expect(gradeToAgeBand("4EF")).toBe("8-10");
    expect(gradeToAgeBand("6EF")).toBe("11-14");
    expect(gradeToAgeBand("1EM")).toBe("15-18");
    expect(gradeToAgeBand("desconhecido")).toBe("11-14");
  });
});

describe("escopo de staff (spec 13.1)", () => {
  it("professor só acessa a própria instituição; platform_admin acessa qualquer", () => {
    const prof = newId(), admin = newId();
    db.prepare("INSERT INTO parents (id,email,password_hash,created_at,role,staff_institution_id) VALUES (?,?,'h',?,?,?)")
      .run(prof, `${prof}@x.com`, nowIso(), "professor", "lms-inst");
    db.prepare("INSERT INTO parents (id,email,password_hash,created_at,role) VALUES (?,?,'h',?,'platform_admin')")
      .run(admin, `${admin}@x.com`, nowIso());

    expect(parentRole(prof).role).toBe("professor");
    expect(() => staffInstitutionOrThrow(prof, "lms-inst")).not.toThrow();
    expect(() => staffInstitutionOrThrow(prof, "outra-escola")).toThrow();
    expect(() => staffInstitutionOrThrow(admin, "qualquer")).not.toThrow();
  });

  it("guardian é o papel padrão", () => {
    const g = newId();
    db.prepare("INSERT INTO parents (id,email,password_hash,created_at) VALUES (?,?,'h',?)").run(g, `${g}@x.com`, nowIso());
    expect(parentRole(g).role).toBe("guardian");
  });
});

describe("conclusão mastery-gated (spec 13.4) — o teste-chave", () => {
  function setup(masteredAll: boolean) {
    const child = newId();
    const itemId = newId();
    const code = skillCodeForItem(itemId);
    const items = [{
      id: itemId, kind: "lesson", title: "t",
      payload_json: JSON.stringify({ ai: true, bncc_code: code }),
      display_order: 1, duration_min: null,
    }];
    // atoms do item
    const a1 = `atom_${code}_1`, a2 = `atom_${code}_2`;
    db.prepare("INSERT OR IGNORE INTO knowledge_atoms (id,bncc_code,atom_text) VALUES (?,?,'x'),(?,?,'y')").run(a1, code, a2, code);
    // item feito
    db.prepare("INSERT INTO item_progress (child_id,item_id,status,updated_at) VALUES (?,?,'done',?)").run(child, itemId, nowIso());
    // mastery: a1 sempre dominado; a2 depende do cenário
    db.prepare(
      "INSERT INTO mastery_state (child_id,atom_id,stability,difficulty,state,reps,last_review,due) VALUES (?,?,200,5,'review',3,?,?)",
    ).run(child, a1, nowIso(), nowIso());
    db.prepare(
      "INSERT INTO mastery_state (child_id,atom_id,stability,difficulty,state,reps,last_review,due) VALUES (?,?,?,5,?,1,?,?)",
    ).run(child, a2, masteredAll ? 200 : 0.5, masteredAll ? "review" : "learning", nowIso(), nowIso());

    const backlog = [
      { id: a1, text: "x", state: "mastered" as const },
      { id: a2, text: "y", state: masteredAll ? ("mastered" as const) : ("reviewing" as const) },
    ];
    return { child, items, backlog };
  }

  it("itens done mas atom NÃO dominado → módulo NÃO conclui", () => {
    const { child, items, backlog } = setup(false);
    expect(moduleComplete(child, items as never, backlog)).toBe(false);
  });

  it("itens done + todos os atoms dominados → módulo conclui", () => {
    const { child, items, backlog } = setup(true);
    expect(moduleComplete(child, items as never, backlog)).toBe(true);
  });

  it("módulo sem itens publicados nunca conclui", () => {
    expect(moduleComplete("qq", [], [])).toBe(false);
  });
});

describe("matrícula (escopo por instituição)", () => {
  it("UNIQUE impede matrícula duplicada", () => {
    const child = newId(), course = newId();
    db.prepare("INSERT INTO courses (id,institution_id,subject_id,class_id,title,status,created_by,created_at) VALUES (?,?,'mat','6EF','C','published','p',?)")
      .run(course, "lms-inst", nowIso());
    db.prepare("INSERT INTO enrollments (id,child_id,course_id,source,enrolled_at) VALUES (?,?,?,'self',?)").run(newId(), child, course, nowIso());
    expect(() =>
      db.prepare("INSERT INTO enrollments (id,child_id,course_id,source,enrolled_at) VALUES (?,?,?,'self',?)").run(newId(), child, course, nowIso()),
    ).toThrow();
  });
});
