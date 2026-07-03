// Testes da plataforma v2 (spec 12): moedas, conquistas, leaderboard por instituição, comunidade sem PII.
import { describe, it, expect, beforeAll } from "vitest";
import { db, newId, nowIso } from "../server/db.ts";
import {
  coinsForReview,
  COIN_RULES,
  awardCoins,
  processReviewRewards,
  weeklyLeaderboard,
  coinBalance,
} from "../server/gamify.ts";
import { reviewAtom } from "../server/mastery/fsrs.ts";

function mkParent(id: string) {
  db.prepare("INSERT OR IGNORE INTO parents (id,email,password_hash,created_at) VALUES (?,?, 'h', ?)").run(
    id, `${id}@x.com`, nowIso(),
  );
}
function mkChild(id: string, parentId: string, opts?: { inst?: string | null; hidden?: number; name?: string }) {
  mkParent(parentId);
  db.prepare(
    `INSERT OR IGNORE INTO children (id,parent_id,display_name,birth_year,grade,age_band,institution_id,leaderboard_hidden,created_at)
     VALUES (?,?,?,2012,'8EF','11-14',?,?,?)`,
  ).run(id, parentId, opts?.name ?? id, opts?.inst ?? null, opts?.hidden ?? 0, nowIso());
}

beforeAll(() => {
  db.prepare("INSERT OR IGNORE INTO knowledge_atoms (id,bncc_code,atom_text) VALUES ('p_atom','EFP','x')").run();
  for (const inst of ["maple-bear", "bncc-padrao"]) {
    db.prepare("INSERT OR IGNORE INTO institutions (id,name,kind,config_json) VALUES (?,?, 'network', '{}')").run(inst, inst);
  }
});

describe("regra de moedas por revisão (spec 12.3)", () => {
  it("rating < 2 não gera moeda", () => expect(coinsForReview(1, 0)).toBe(0));
  it("rating ≥ 2 gera 10", () => expect(coinsForReview(3, 0)).toBe(COIN_RULES.review));
  it("cap diário zera a partir da 12ª", () => {
    expect(coinsForReview(4, COIN_RULES.reviewDailyCap - 1)).toBe(COIN_RULES.review);
    expect(coinsForReview(4, COIN_RULES.reviewDailyCap)).toBe(0);
  });
});

describe("processReviewRewards (dedup + conquistas + notificações)", () => {
  it("premia revisão, conquista first_lesson única e notifica", () => {
    const p = "pp1", ch = "pc1";
    mkChild(ch, p);
    const r1 = reviewAtom(ch, "p_atom", 3);
    const rw1 = processReviewRewards(p, ch, "p_atom", 3, r1);
    expect(rw1.coins).toBeGreaterThanOrEqual(COIN_RULES.review);
    expect(rw1.unlocked).toContain("first_lesson");

    const r2 = reviewAtom(ch, "p_atom", 3);
    const rw2 = processReviewRewards(p, ch, "p_atom", 3, r2);
    expect(rw2.unlocked).not.toContain("first_lesson"); // única

    const notifs = db.prepare("SELECT COUNT(*) n FROM notifications WHERE parent_id = ? AND kind='achievement'").get(p) as { n: number };
    expect(notifs.n).toBeGreaterThanOrEqual(1);
  });

  it("rating 1 não gera moeda de revisão", () => {
    const p = "pp2", ch = "pc2";
    mkChild(ch, p);
    const before = coinBalance(ch);
    const r = reviewAtom(ch, "p_atom", 1);
    processReviewRewards(p, ch, "p_atom", 1, r);
    const ledger = db
      .prepare("SELECT COUNT(*) n FROM coin_ledger WHERE child_id = ? AND reason='review'")
      .get(ch) as { n: number };
    expect(ledger.n).toBe(0);
    expect(coinBalance(ch)).toBe(before);
  });
});

describe("leaderboard por instituição (spec 12.4)", () => {
  it("escopa por instituição e respeita leaderboard_hidden", () => {
    mkChild("lb_a1", "lbp1", { inst: "maple-bear", name: "Ana" });
    mkChild("lb_a2", "lbp1", { inst: "maple-bear", name: "Beto" });
    mkChild("lb_hidden", "lbp2", { inst: "maple-bear", hidden: 1, name: "Oculto" });
    mkChild("lb_other", "lbp2", { inst: null, name: "OutraEscola" }); // bncc-padrao

    awardCoins("lb_a1", 30, "review");
    awardCoins("lb_a2", 10, "review");
    awardCoins("lb_hidden", 99, "review");
    awardCoins("lb_other", 50, "review");

    const board = weeklyLeaderboard("maple-bear");
    const names = board.map((b) => b.display_name);
    expect(names).toContain("Ana");
    expect(names).toContain("Beto");
    expect(names).not.toContain("Oculto"); // opt-out
    expect(names).not.toContain("OutraEscola"); // outra instituição
    expect(board[0].display_name).toBe("Ana"); // 30 > 10
  });
});

describe("comunidade sem PII (spec 12.5)", () => {
  it("posts expõem apenas o apelido (nunca e-mail/parent)", () => {
    mkChild("cm_c1", "cmp1", { inst: "maple-bear", name: "Duda" });
    db.prepare(
      "INSERT INTO community_posts (id,child_id,institution_id,title,body,created_at) VALUES (?,?,?,?,?,?)",
    ).run(newId(), "cm_c1", "maple-bear", "Dica de frações", "Usem as barrinhas!", nowIso());

    // a MESMA query da rota (join por apelido)
    const rows = db
      .prepare(
        `SELECT p.id, p.title, p.body, ch.display_name AS author
         FROM community_posts p JOIN children ch ON ch.id = p.child_id
         WHERE p.institution_id = 'maple-bear' AND p.deleted_at IS NULL`,
      )
      .all() as Record<string, unknown>[];
    expect(rows.length).toBeGreaterThanOrEqual(1);
    for (const r of rows) {
      const keys = Object.keys(r);
      expect(keys).not.toContain("email");
      expect(keys).not.toContain("parent_id");
      expect(keys).not.toContain("child_id");
    }
    expect(rows.find((r) => r.author === "Duda")).toBeTruthy();
  });
});

describe("migração v2", () => {
  it("children tem kind + leaderboard_hidden; kind default 'child'", () => {
    const cols = (db.prepare("PRAGMA table_info(children)").all() as { name: string }[]).map((c) => c.name);
    expect(cols).toContain("kind");
    expect(cols).toContain("leaderboard_hidden");
    mkChild("mg_c1", "mgp1");
    const row = db.prepare("SELECT kind FROM children WHERE id='mg_c1'").get() as { kind: string };
    expect(row.kind).toBe("child");
  });
});
