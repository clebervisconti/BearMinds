import { describe, it, expect } from "vitest";
import { db, nowIso } from "../server/db.ts";
import { hardDeleteExpired } from "../server/jobs/nightly.ts";

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString();
}

describe("hard-delete LGPD (janela de 30 dias, relógio falso)", () => {
  it("remove contas soft-deleted há > 30 dias e mantém as recentes/ativas", () => {
    // conta antiga (deletada há 40 dias) + filho + dados
    db.prepare("INSERT INTO parents (id,email,password_hash,created_at,deleted_at) VALUES ('p_old','old@x.com','h',?,?)").run(daysAgo(60), daysAgo(40));
    db.prepare("INSERT INTO children (id,parent_id,display_name,birth_year,grade,age_band,created_at) VALUES ('c_old','p_old','a',2014,'6EF','11-14',?)").run(daysAgo(60));
    db.prepare("INSERT INTO mastery_state (child_id,atom_id,state) VALUES ('c_old','x','new')").run();
    db.prepare("INSERT INTO habit_log (child_id,day,learning_events) VALUES ('c_old','2026-06-01',1)").run();

    // conta deletada há 10 dias (dentro da janela) — NÃO remove
    db.prepare("INSERT INTO parents (id,email,password_hash,created_at,deleted_at) VALUES ('p_recent','recent@x.com','h',?,?)").run(daysAgo(20), daysAgo(10));
    // conta ativa — NÃO remove
    db.prepare("INSERT INTO parents (id,email,password_hash,created_at) VALUES ('p_active','active@x.com','h',?)").run(daysAgo(5));

    const res = hardDeleteExpired(new Date());
    expect(res.parents).toBe(1);
    expect(res.children).toBe(1);

    expect(db.prepare("SELECT id FROM parents WHERE id='p_old'").get()).toBeUndefined();
    expect(db.prepare("SELECT id FROM children WHERE id='c_old'").get()).toBeUndefined();
    expect(db.prepare("SELECT child_id FROM mastery_state WHERE child_id='c_old'").get()).toBeUndefined();
    expect(db.prepare("SELECT child_id FROM habit_log WHERE child_id='c_old'").get()).toBeUndefined();

    expect(db.prepare("SELECT id FROM parents WHERE id='p_recent'").get()).toBeTruthy();
    expect(db.prepare("SELECT id FROM parents WHERE id='p_active'").get()).toBeTruthy();
  });
});
