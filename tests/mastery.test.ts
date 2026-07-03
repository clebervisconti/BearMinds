import { describe, it, expect, beforeAll } from "vitest";
import { db, nowIso } from "../server/db.ts";
import { reviewAtom, getMasteryRow } from "../server/mastery/fsrs.ts";
import { currentStreak, recordLearningEvent } from "../server/gamify.ts";

beforeAll(() => {
  db.prepare("INSERT OR REPLACE INTO knowledge_atoms (id, bncc_code, atom_text) VALUES ('t_atom','EFTEST','x')").run();
});

describe("FSRS reviewAtom (spec 06.1)", () => {
  it("cria estado e agenda no futuro", () => {
    const child = "child_fsrs_1";
    const r = reviewAtom(child, "t_atom", 3);
    expect(new Date(r.due).getTime()).toBeGreaterThan(Date.now());
    const row = getMasteryRow(child, "t_atom");
    expect(row?.reps).toBe(1);
    expect(["learning", "review"]).toContain(r.state);
  });

  it("respeita a ancoragem à prova (clampa due para antes do exame)", () => {
    const child = "child_fsrs_2";
    reviewAtom(child, "t_atom", 3); // primeiro review
    const clamp = new Date(Date.now() + 2 * 86400000); // T-... 2 dias
    const r = reviewAtom(child, "t_atom", 4, { examClampDue: clamp }); // Easy agendaria longe
    expect(new Date(r.due).getTime()).toBeLessThanOrEqual(clamp.getTime());
  });
});

describe("streak por evento de aprendizagem (spec 07)", () => {
  it("rating < 2 NÃO conta como learning event", () => {
    expect(recordLearningEvent("child_streak_x", 1)).toBe(false);
    const row = db.prepare("SELECT * FROM habit_log WHERE child_id = 'child_streak_x'").get();
    expect(row).toBeUndefined();
  });

  it("conta dias consecutivos e tolera 1 gap (freeze)", () => {
    const child = "child_streak_1";
    const day = (offset: number) => {
      const d = new Date(Date.now() - offset * 86400000 - 3 * 3600 * 1000);
      return d.toISOString().slice(0, 10);
    };
    // hoje, ontem, anteontem presentes → streak 3
    for (const off of [0, 1, 2]) {
      db.prepare("INSERT OR REPLACE INTO habit_log (child_id, day, learning_events) VALUES (?, ?, 1)").run(child, day(off));
    }
    expect(currentStreak(child, day(0))).toBe(3);

    // gap de 1 dia (falta off=1), presentes off 0,2,3 → o freeze cobre o buraco e mantém
    // os 3 dias de estudo conectados (sem o freeze o streak quebraria em 1).
    const child2 = "child_streak_2";
    for (const off of [0, 2, 3]) {
      db.prepare("INSERT OR REPLACE INTO habit_log (child_id, day, learning_events) VALUES (?, ?, 1)").run(child2, day(off));
    }
    expect(currentStreak(child2, day(0))).toBe(3);

    // sem o freeze disponível, um 2º gap quebra o streak (off 0, 2, 4 → só 0 e 2 conectados = 2)
    const child3 = "child_streak_3";
    for (const off of [0, 2, 4]) {
      db.prepare("INSERT OR REPLACE INTO habit_log (child_id, day, learning_events) VALUES (?, ?, 1)").run(child3, day(off));
    }
    expect(currentStreak(child3, day(0))).toBe(2);
  });
});
