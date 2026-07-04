// Testes P4b/P4c (spec 14): pontuação ao vivo, PIN, enquetes, Q&A, chat (sem aluno↔aluno),
// detecção de risco (coaching), certificados (verificação pública) e moderação.
import { describe, it, expect, beforeAll } from "vitest";
import { db, newId, nowIso } from "../server/db.ts";
import { liveScore, pinFromBytes, LIVE_BASE, LIVE_SPEED_MAX, LIVE_QUESTION_MS } from "../server/live/scoring.ts";
import { riskFlags } from "../server/routes/coaching.ts";

const INST = "ls-inst";
const GUARD = "ls-guardian";
const PROF = "ls-prof";
const CHILD1 = "ls-child1";
const CHILD2 = "ls-child2";
const COURSE = "ls-course";

beforeAll(() => {
  db.prepare("INSERT OR IGNORE INTO institutions (id,name,kind,config_json) VALUES (?, 'LS Inst','school','{}')").run(INST);
  db.prepare("INSERT OR IGNORE INTO parents (id,email,password_hash,created_at,role) VALUES (?,?,'h',?,'guardian')").run(GUARD, `${GUARD}@x.com`, nowIso());
  db.prepare("INSERT OR IGNORE INTO parents (id,email,password_hash,created_at,role,staff_institution_id) VALUES (?,?,'h',?,'professor',?)").run(PROF, `${PROF}@x.com`, nowIso(), INST);
  for (const ch of [CHILD1, CHILD2]) {
    db.prepare(
      "INSERT OR IGNORE INTO children (id,parent_id,display_name,birth_year,grade,age_band,institution_id,created_at) VALUES (?,?,?,?, '6EF','11-14',?,?)",
    ).run(ch, GUARD, ch === CHILD1 ? "Ana" : "Beto", 2014, INST, nowIso());
  }
  db.prepare(
    "INSERT OR IGNORE INTO courses (id,institution_id,subject_id,class_id,title,cover_emoji,status,created_by,created_at) VALUES (?,?,'mat','6EF','Frações','📘','published',?,?)",
  ).run(COURSE, INST, PROF, nowIso());
});

// ---------------- Pontuação ao vivo (Kahoot, spec 14.1) ----------------
describe("liveScore", () => {
  it("resposta errada não pontua", () => expect(liveScore(false, 100)).toBe(0));
  it("acerto instantâneo = base + bônus máximo", () => expect(liveScore(true, 0)).toBe(LIVE_BASE + LIVE_SPEED_MAX));
  it("acerto na trave (no fim da janela) ≈ só a base", () => expect(liveScore(true, LIVE_QUESTION_MS)).toBe(LIVE_BASE));
  it("mais rápido pontua mais que mais lento", () => {
    expect(liveScore(true, 2000)).toBeGreaterThan(liveScore(true, 15000));
  });
  it("clampa tempos negativos e além da janela", () => {
    expect(liveScore(true, -500)).toBe(LIVE_BASE + LIVE_SPEED_MAX);
    expect(liveScore(true, LIVE_QUESTION_MS * 5)).toBe(LIVE_BASE);
  });
});

describe("pinFromBytes", () => {
  it("gera exatamente 6 dígitos", () => {
    const pin = pinFromBytes(Buffer.from([1, 2, 3, 4]));
    expect(pin).toMatch(/^\d{6}$/);
  });
  it("é determinístico para os mesmos bytes", () => {
    expect(pinFromBytes(Buffer.from([9, 9, 9, 9]))).toBe(pinFromBytes(Buffer.from([9, 9, 9, 9])));
  });
  it("zeros à esquerda são preservados", () => {
    expect(pinFromBytes(Buffer.from([0, 0, 0, 0]))).toBe("000000");
  });
});

// ---------------- Enquetes (Slido, spec 14.2) ----------------
describe("enquetes — apuração e um voto por aluno", () => {
  it("INSERT OR REPLACE mantém um voto por aluno; tally reflete a troca", () => {
    const poll = newId();
    db.prepare("INSERT INTO polls (id,course_id,created_by,question,options_json,open,created_at) VALUES (?,?,?,?,?,1,?)")
      .run(poll, COURSE, PROF, "Cor favorita?", JSON.stringify(["Azul", "Verde"]), nowIso());
    db.prepare("INSERT OR REPLACE INTO poll_votes (poll_id,child_id,choice) VALUES (?,?,0)").run(poll, CHILD1);
    db.prepare("INSERT OR REPLACE INTO poll_votes (poll_id,child_id,choice) VALUES (?,?,1)").run(poll, CHILD2);
    db.prepare("INSERT OR REPLACE INTO poll_votes (poll_id,child_id,choice) VALUES (?,?,1)").run(poll, CHILD1); // troca de voto

    const tally = [0, 1].map((i) => (db.prepare("SELECT COUNT(*) n FROM poll_votes WHERE poll_id=? AND choice=?").get(poll, i) as { n: number }).n);
    expect(tally).toEqual([0, 2]);              // ninguém em Azul; ambos em Verde
    const total = tally.reduce((a, b) => a + b, 0);
    expect(total).toBe(2);                       // 2 alunos, nunca 3
  });
});

// ---------------- Q&A (Slido) — ordenação ----------------
describe("Q&A — ordena respondidas por último e mais votadas no topo", () => {
  it("answered ASC, votes DESC", () => {
    const cId = newId();
    const q1 = newId(), q2 = newId(), q3 = newId();
    const mk = (id: string, answered: number, t: string) =>
      db.prepare("INSERT INTO qa_questions (id,course_id,child_id,body,answered,created_at) VALUES (?,?,?,?,?,?)").run(id, cId, CHILD1, "?", answered, t);
    mk(q1, 0, "2026-01-01T00:00:00Z"); // aberta, 2 votos
    mk(q2, 0, "2026-01-02T00:00:00Z"); // aberta, 0 votos
    mk(q3, 1, "2026-01-03T00:00:00Z"); // respondida
    db.prepare("INSERT INTO qa_votes (question_id,child_id) VALUES (?,?),(?,?)").run(q1, CHILD1, q1, CHILD2);

    const rows = db.prepare(
      `SELECT q.id, (SELECT COUNT(*) FROM qa_votes v WHERE v.question_id=q.id) AS votes
       FROM qa_questions q WHERE q.course_id=? AND q.deleted_at IS NULL
       ORDER BY q.answered ASC, votes DESC, q.created_at DESC`,
    ).all(cId) as { id: string; votes: number }[];
    expect(rows.map((r) => r.id)).toEqual([q1, q2, q3]); // mais votada aberta → aberta → respondida
  });
});

// ---------------- Chat: nunca aluno↔aluno (spec 14.3) ----------------
describe("chat — DM sempre conecta um aluno a um membro da equipe", () => {
  it("thread iniciada pelo aluno aponta para o staff criador do curso (nunca outro aluno)", () => {
    // fluxo do endpoint: staff = courses.created_by
    const staff = (db.prepare("SELECT created_by FROM courses WHERE id=?").get(COURSE) as { created_by: string }).created_by;
    expect(staff).toBe(PROF);
    const tId = newId();
    db.prepare("INSERT INTO chat_threads (id,course_id,child_id,staff_parent_id,created_at) VALUES (?,?,?,?,?)").run(tId, COURSE, CHILD1, staff, nowIso());

    // invariante estrutural: o outro lado é SEMPRE um parent da equipe, jamais uma criança
    const t = db.prepare("SELECT child_id, staff_parent_id FROM chat_threads WHERE id=?").get(tId) as { child_id: string; staff_parent_id: string };
    const staffRole = (db.prepare("SELECT role FROM parents WHERE id=?").get(t.staff_parent_id) as { role: string } | undefined)?.role;
    expect(staffRole).toBe("professor");
    expect(db.prepare("SELECT 1 FROM children WHERE id=?").get(t.staff_parent_id)).toBeUndefined(); // staff_parent_id não é uma criança
    expect(t.child_id).toBe(CHILD1);
  });

  it("UNIQUE(course, child, staff) impede threads duplicadas", () => {
    const staff = PROF;
    const first = newId();
    db.prepare("INSERT INTO chat_threads (id,course_id,child_id,staff_parent_id,created_at) VALUES (?,?,?,?,?)").run(first, COURSE, CHILD2, staff, nowIso());
    expect(() =>
      db.prepare("INSERT INTO chat_threads (id,course_id,child_id,staff_parent_id,created_at) VALUES (?,?,?,?,?)").run(newId(), COURSE, CHILD2, staff, nowIso()),
    ).toThrow();
  });
});

// ---------------- Coaching: detecção de risco (spec 14.4) ----------------
describe("riskFlags", () => {
  it("streak quebrado só conta com histórico", () => {
    expect(riskFlags({ streak: 0, hasHistory: true, lastActivityDaysAgo: 1, minReadiness: 0.9 }).streak_broken).toBe(true);
    expect(riskFlags({ streak: 0, hasHistory: false, lastActivityDaysAgo: null, minReadiness: null }).streak_broken).toBe(false);
  });
  it("prontidão < 60% aciona; ≥ 60% não", () => {
    expect(riskFlags({ streak: 5, hasHistory: true, lastActivityDaysAgo: 0, minReadiness: 0.59 }).low_readiness).toBe(true);
    expect(riskFlags({ streak: 5, hasHistory: true, lastActivityDaysAgo: 0, minReadiness: 0.6 }).low_readiness).toBe(false);
  });
  it("inatividade ≥ 7 dias aciona", () => {
    expect(riskFlags({ streak: 5, hasHistory: true, lastActivityDaysAgo: 7, minReadiness: 0.9 }).inactive_7d).toBe(true);
    expect(riskFlags({ streak: 5, hasHistory: true, lastActivityDaysAgo: 6, minReadiness: 0.9 }).inactive_7d).toBe(false);
  });
  it("aluno saudável não tem nenhuma flag", () => {
    const f = riskFlags({ streak: 4, hasHistory: true, lastActivityDaysAgo: 1, minReadiness: 0.85 });
    expect(f.streak_broken || f.low_readiness || f.inactive_7d).toBe(false);
  });
});

// ---------------- Certificados (spec 14.5) ----------------
describe("certificados — verificação pública sem PII sensível", () => {
  it("a verificação pública devolve apelido + curso + instituição, nunca e-mail/ano de nascimento", () => {
    const code = "BM-TEST0001";
    db.prepare("INSERT OR IGNORE INTO certificates (id,child_id,course_id,code,issued_at) VALUES (?,?,?,?,?)").run(newId(), CHILD1, COURSE, code, nowIso());
    const row = db.prepare(
      `SELECT ct.code, ct.issued_at, ch.display_name AS student, cs.title AS course_title, i.name AS institution
       FROM certificates ct JOIN children ch ON ch.id=ct.child_id JOIN courses cs ON cs.id=ct.course_id
       LEFT JOIN institutions i ON i.id=cs.institution_id WHERE ct.code=?`,
    ).get(code) as Record<string, unknown>;
    expect(row.student).toBe("Ana");
    expect(row.course_title).toBe("Frações");
    expect(row.institution).toBe("LS Inst");
    expect(Object.keys(row)).not.toContain("email");
    expect(Object.keys(row)).not.toContain("birth_year");
  });

  it("UNIQUE(child, course) impede certificado duplicado", () => {
    db.prepare("INSERT OR IGNORE INTO certificates (id,child_id,course_id,code,issued_at) VALUES (?,?,?,?,?)").run(newId(), CHILD2, COURSE, "BM-UNIQ0002", nowIso());
    expect(() =>
      db.prepare("INSERT INTO certificates (id,child_id,course_id,code,issued_at) VALUES (?,?,?,?,?)").run(newId(), CHILD2, COURSE, "BM-UNIQ0003", nowIso()),
    ).toThrow();
  });
});

// ---------------- Moderação (spec 14.6) ----------------
describe("moderação — ocultar/restaurar conteúdo denunciado", () => {
  it("a fila mostra flagged & não-deletado; ocultar remove; restaurar limpa a denúncia", () => {
    const post = newId();
    db.prepare("INSERT INTO community_posts (id,child_id,institution_id,title,body,flagged,created_at) VALUES (?,?,?,?,?,1,?)")
      .run(post, CHILD1, INST, "titulo", "corpo", nowIso());
    const inQueue = () => db.prepare("SELECT COUNT(*) n FROM community_posts WHERE flagged=1 AND deleted_at IS NULL AND id=?").get(post) as { n: number };

    expect(inQueue().n).toBe(1);                                   // aparece na fila
    db.prepare("UPDATE community_posts SET deleted_at=? WHERE id=?").run(nowIso(), post); // ocultar
    expect(inQueue().n).toBe(0);                                   // sai da fila (oculto)

    // restaurar: limpar denúncia (e des-ocultar para o teste)
    db.prepare("UPDATE community_posts SET flagged=0, deleted_at=NULL WHERE id=?").run(post);
    expect(inQueue().n).toBe(0);                                   // não volta à fila (denúncia limpa)
    expect((db.prepare("SELECT flagged FROM community_posts WHERE id=?").get(post) as { flagged: number }).flagged).toBe(0);
  });
});
