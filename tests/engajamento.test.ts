// Testes P5b gap (grupos) + P5c (spec 17) + P5-r (paywall, correlação).
import { describe, it, expect, beforeAll } from "vitest";
import { db, newId, nowIso } from "../server/db.ts";
import { rollupReadiness } from "../server/lib/readiness.ts";
import { pearsonCorrelation } from "../server/lib/correlation.ts";
import { pruneExpiredMissions, MISSION_RETENTION_DAYS } from "../server/lib/missions.ts";
import { getSetting, setSetting } from "../server/lib/settings.ts";
import { scoreRubric } from "../server/lib/rubric.ts";

beforeAll(() => {
  db.prepare("INSERT OR IGNORE INTO institutions (id,name,kind,config_json) VALUES ('eng-inst','Eng Inst','school','{}')").run();
  db.prepare("INSERT OR IGNORE INTO parents (id,email,password_hash,created_at) VALUES ('eng-p1','eng-p1@x.com','h',?)").run(nowIso());
});

function makeCourse(): string {
  const id = newId();
  db.prepare("INSERT INTO courses (id,institution_id,subject_id,class_id,title,status,created_by,created_at) VALUES (?,'eng-inst','mat','6EF','Curso Eng','published','prof',?)").run(id, nowIso());
  return id;
}
function makeChild(): string {
  const id = newId();
  db.prepare("INSERT INTO children (id, parent_id, display_name, birth_year, grade, age_band, institution_id, created_at) VALUES (?, 'eng-p1', 'Aluno', 2013, '6EF', '11-14', 'eng-inst', ?)").run(id, nowIso());
  return id;
}
function enroll(childId: string, courseId: string): void {
  db.prepare("INSERT INTO enrollments (id,child_id,course_id,source,enrolled_at) VALUES (?,?,?, 'self', ?)").run(newId(), childId, courseId, nowIso());
}

describe("Grupos dentro do curso (spec 16.6)", () => {
  it("cria grupo e atribui alunos via enrollments.group_id", () => {
    const courseId = makeCourse();
    const child1 = makeChild();
    const child2 = makeChild();
    enroll(child1, courseId);
    enroll(child2, courseId);

    const groupId = newId();
    db.prepare("INSERT INTO course_groups (id, course_id, title, created_at) VALUES (?, ?, 'Turma A', ?)").run(groupId, courseId, nowIso());
    db.prepare("UPDATE enrollments SET group_id = ? WHERE course_id = ? AND child_id = ?").run(groupId, courseId, child1);

    const members = db.prepare("SELECT COUNT(*) n FROM enrollments WHERE group_id = ?").get(groupId) as { n: number };
    expect(members.n).toBe(1);
    const unassigned = db.prepare("SELECT COUNT(*) n FROM enrollments WHERE course_id = ? AND group_id IS NULL").get(courseId) as { n: number };
    expect(unassigned.n).toBe(1);
  });

  it("deletar grupo desatribui membros sem desmatricular", () => {
    const courseId = makeCourse();
    const child1 = makeChild();
    enroll(child1, courseId);
    const groupId = newId();
    db.prepare("INSERT INTO course_groups (id, course_id, title, created_at) VALUES (?, ?, 'Turma B', ?)").run(groupId, courseId, nowIso());
    db.prepare("UPDATE enrollments SET group_id = ? WHERE course_id = ? AND child_id = ?").run(groupId, courseId, child1);

    db.prepare("UPDATE enrollments SET group_id = NULL WHERE group_id = ?").run(groupId);
    db.prepare("DELETE FROM course_groups WHERE id = ?").run(groupId);

    const stillEnrolled = db.prepare("SELECT group_id FROM enrollments WHERE child_id = ? AND course_id = ?").get(child1, courseId) as { group_id: string | null };
    expect(stillEnrolled.group_id).toBeNull();
  });
});

describe("Quick Updates + Checklists (spec 17.1)", () => {
  it("kind 'quick_update' é aceito pelo CHECK de content_items", () => {
    const courseId = makeCourse();
    const modId = newId();
    db.prepare("INSERT INTO course_modules (id,course_id,title,display_order) VALUES (?,?, 'Mod', 1)").run(modId, courseId);
    const itemId = newId();
    const payload = { body: "Resuma em 1 frase.", questions: [{ prompt: "2+2?", options: ["3", "4"], correct: 1 }], checklist: [{ label: "Passo 1" }, { label: "Passo 2" }] };
    expect(() =>
      db.prepare("INSERT INTO content_items (id,module_id,kind,title,payload_json,display_order,status,created_at) VALUES (?,?,'quick_update','QU1',?,1,'published',?)")
        .run(itemId, modId, JSON.stringify(payload), nowIso()),
    ).not.toThrow();
  });

  it("checklist_state alterna passo por passo, por aluno", () => {
    const itemId = newId();
    const childId = makeChild();
    db.prepare("INSERT INTO checklist_state (item_id, child_id, step_index, done_at) VALUES (?, ?, 0, ?)").run(itemId, childId, nowIso());
    const done = db.prepare("SELECT COUNT(*) n FROM checklist_state WHERE item_id = ? AND child_id = ?").get(itemId, childId) as { n: number };
    expect(done.n).toBe(1);
    db.prepare("DELETE FROM checklist_state WHERE item_id = ? AND child_id = ? AND step_index = 0").run(itemId, childId);
    const doneAfter = db.prepare("SELECT COUNT(*) n FROM checklist_state WHERE item_id = ? AND child_id = ?").get(itemId, childId) as { n: number };
    expect(doneAfter.n).toBe(0);
  });
});

describe("Exemplares de pares (spec 17.2)", () => {
  it("promoção começa 'pending' e só fica visível quando 'granted'", () => {
    const courseId = makeCourse();
    const childId = makeChild();
    enroll(childId, courseId);
    const modId = newId();
    db.prepare("INSERT INTO course_modules (id,course_id,title,display_order) VALUES (?,?, 'Mod', 1)").run(modId, courseId);
    const itemId = newId();
    db.prepare("INSERT INTO content_items (id,module_id,kind,title,payload_json,display_order,status,created_at) VALUES (?,?,'assignment','Tarefa',?,1,'published',?)")
      .run(itemId, modId, JSON.stringify({ max_points: 100 }), nowIso());
    const subId = newId();
    db.prepare("INSERT INTO submissions (id,item_id,child_id,body_text,status,submitted_at) VALUES (?,?,?, 'ótima resposta', 'returned', ?)").run(subId, itemId, childId, nowIso());

    const exemplarId = newId();
    db.prepare("INSERT INTO peer_exemplars (id, submission_id, course_id, child_id, promoted_by, consent_state, created_at) VALUES (?, ?, ?, ?, 'eng-p1', 'pending', ?)")
      .run(exemplarId, subId, courseId, childId, nowIso());

    let visible = db.prepare("SELECT * FROM peer_exemplars WHERE course_id = ? AND consent_state = 'granted'").all(courseId);
    expect(visible).toHaveLength(0);

    db.prepare("UPDATE peer_exemplars SET consent_state = 'granted', consent_at = ? WHERE id = ?").run(nowIso(), exemplarId);
    visible = db.prepare("SELECT * FROM peer_exemplars WHERE course_id = ? AND consent_state = 'granted'").all(courseId);
    expect(visible).toHaveLength(1);
  });

  it("UNIQUE(submission_id) impede promover a mesma submissão duas vezes", () => {
    const courseId = makeCourse();
    const childId = makeChild();
    const modId = newId();
    db.prepare("INSERT INTO course_modules (id,course_id,title,display_order) VALUES (?,?, 'Mod', 1)").run(modId, courseId);
    const itemId = newId();
    db.prepare("INSERT INTO content_items (id,module_id,kind,title,payload_json,display_order,status,created_at) VALUES (?,?,'assignment','Tarefa2',?,1,'published',?)")
      .run(itemId, modId, JSON.stringify({ max_points: 100 }), nowIso());
    const subId = newId();
    db.prepare("INSERT INTO submissions (id,item_id,child_id,status,submitted_at) VALUES (?,?,?, 'returned', ?)").run(subId, itemId, childId, nowIso());
    db.prepare("INSERT INTO peer_exemplars (id, submission_id, course_id, child_id, promoted_by, consent_state, created_at) VALUES (?, ?, ?, ?, 'eng-p1', 'pending', ?)")
      .run(newId(), subId, courseId, childId, nowIso());
    expect(() =>
      db.prepare("INSERT INTO peer_exemplars (id, submission_id, course_id, child_id, promoted_by, consent_state, created_at) VALUES (?, ?, ?, ?, 'eng-p1', 'pending', ?)")
        .run(newId(), subId, courseId, childId, nowIso()),
    ).toThrow();
  });
});

describe("Auto-avaliação vs avaliação do professor (spec 17.3)", () => {
  it("calcula o gap entre autoavaliação e nota do professor", () => {
    const sections = [{ title: "Conteúdo", weight: 1, criteria: [{ label: "Cobertura", levels: [{ label: "baixo", points: 0 }, { label: "alto", points: 100 }] }] }];
    const selfScore = scoreRubric(sections, [[1]], 100); // aluno se dá nota máxima
    const teacherScore = scoreRubric(sections, [[0]], 100); // professor discorda
    expect(selfScore.points).toBe(100);
    expect(teacherScore.points).toBe(0);
    const gap = selfScore.fraction - teacherScore.fraction;
    expect(gap).toBeCloseTo(1); // superestimou ao máximo
  });

  it("UNIQUE(submission_id) — reenvio de autoavaliação faz upsert, não duplica", () => {
    const courseId = makeCourse();
    const childId = makeChild();
    const modId = newId();
    db.prepare("INSERT INTO course_modules (id,course_id,title,display_order) VALUES (?,?, 'Mod', 1)").run(modId, courseId);
    const itemId = newId();
    db.prepare("INSERT INTO content_items (id,module_id,kind,title,payload_json,display_order,status,created_at) VALUES (?,?,'assignment','T3',?,1,'published',?)")
      .run(itemId, modId, JSON.stringify({ max_points: 100 }), nowIso());
    const subId = newId();
    db.prepare("INSERT INTO submissions (id,item_id,child_id,status,submitted_at) VALUES (?,?,?, 'submitted', ?)").run(subId, itemId, childId, nowIso());

    db.prepare(
      `INSERT INTO submission_self_assessments (id, submission_id, child_id, points, reflection, created_at) VALUES (?, ?, ?, 50, 'v1', ?)
       ON CONFLICT(submission_id) DO UPDATE SET points = excluded.points, reflection = excluded.reflection`,
    ).run(newId(), subId, childId, nowIso());
    db.prepare(
      `INSERT INTO submission_self_assessments (id, submission_id, child_id, points, reflection, created_at) VALUES (?, ?, ?, 70, 'v2', ?)
       ON CONFLICT(submission_id) DO UPDATE SET points = excluded.points, reflection = excluded.reflection`,
    ).run(newId(), subId, childId, nowIso());

    const rows = db.prepare("SELECT points, reflection FROM submission_self_assessments WHERE submission_id = ?").all(subId) as { points: number; reflection: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0].points).toBe(70);
  });
});

describe("Readiness 2.0 rollup (spec 17.4)", () => {
  it("combina as 3 dimensões com os pesos padrão", () => {
    const r = rollupReadiness({ knowledge: 1, skill: 1, execution: 1 });
    expect(r).toBeCloseTo(1);
    const zero = rollupReadiness({ knowledge: 0, skill: 0, execution: 0 });
    expect(zero).toBeCloseTo(0);
  });

  it("redistribui o peso quando uma dimensão falta", () => {
    // só conhecimento disponível ⇒ vira 100% do peso
    const r = rollupReadiness({ knowledge: 0.8, skill: null, execution: null });
    expect(r).toBeCloseTo(0.8);
  });

  it("retorna null se nenhuma dimensão tiver dado", () => {
    expect(rollupReadiness({ knowledge: null, skill: null, execution: null })).toBeNull();
  });

  it("pondera 40/30/30 quando as 3 dimensões existem", () => {
    const r = rollupReadiness({ knowledge: 1, skill: 0, execution: 0 });
    expect(r).toBeCloseTo(0.4);
  });
});

describe("Missions-lite (spec 17.5)", () => {
  it("retention_until é calculado a partir de MISSION_RETENTION_DAYS", () => {
    const now = Date.now();
    const retention = new Date(now + MISSION_RETENTION_DAYS * 86400000);
    const days = Math.round((retention.getTime() - now) / 86400000);
    expect(days).toBe(MISSION_RETENTION_DAYS);
  });

  it("kind 'mission' é aceito pelo CHECK de content_items", () => {
    const courseId = makeCourse();
    const modId = newId();
    db.prepare("INSERT INTO course_modules (id,course_id,title,display_order) VALUES (?,?, 'Mod', 1)").run(modId, courseId);
    expect(() =>
      db.prepare("INSERT INTO content_items (id,module_id,kind,title,payload_json,display_order,status,created_at) VALUES (?,?,'mission','Missão 1',?,1,'published',?)")
        .run(newId(), modId, JSON.stringify({ prompt: "Explique frações", media_type: "audio", max_points: 100 }), nowIso()),
    ).not.toThrow();
  });

  it("pruneExpiredMissions remove submissões com retention_until vencido", () => {
    const itemId = newId();
    const childId = makeChild();
    const fileId = newId();
    const expired = new Date(Date.now() - 86400000).toISOString(); // ontem
    db.prepare("INSERT INTO files (id, owner_parent_id, kind, original_name, path, mime, size_bytes, created_at) VALUES (?, 'eng-p1', 'audio', 'x.mp3', '/nonexistent/x.mp3', 'audio/mpeg', 100, ?)")
      .run(fileId, nowIso());
    db.prepare(
      "INSERT INTO mission_submissions (id, item_id, child_id, file_id, status, consent_at, retention_until, submitted_at) VALUES (?, ?, ?, ?, 'submitted', ?, ?, ?)",
    ).run(newId(), itemId, childId, fileId, nowIso(), expired, nowIso());

    const pruned = pruneExpiredMissions(new Date());
    expect(pruned).toBeGreaterThanOrEqual(1);
    const remaining = db.prepare("SELECT COUNT(*) n FROM mission_submissions WHERE item_id = ?").get(itemId) as { n: number };
    expect(remaining.n).toBe(0);
  });

  it("mantém submissões dentro do prazo de retenção", () => {
    const itemId = newId();
    const childId = makeChild();
    const fileId = newId();
    const future = new Date(Date.now() + 86400000).toISOString();
    db.prepare("INSERT INTO files (id, owner_parent_id, kind, original_name, path, mime, size_bytes, created_at) VALUES (?, 'eng-p1', 'audio', 'y.mp3', '/nonexistent/y.mp3', 'audio/mpeg', 100, ?)")
      .run(fileId, nowIso());
    db.prepare(
      "INSERT INTO mission_submissions (id, item_id, child_id, file_id, status, consent_at, retention_until, submitted_at) VALUES (?, ?, ?, ?, 'submitted', ?, ?, ?)",
    ).run(newId(), itemId, childId, fileId, nowIso(), future, nowIso());

    pruneExpiredMissions(new Date());
    const remaining = db.prepare("SELECT COUNT(*) n FROM mission_submissions WHERE item_id = ?").get(itemId) as { n: number };
    expect(remaining.n).toBe(1);
  });
});

describe("Consentimento media_recording (spec 17.5, LGPD dedicado)", () => {
  it("scope 'media_recording' é aceito pelo CHECK de consents", () => {
    const childId = makeChild();
    expect(() =>
      db.prepare("INSERT INTO consents (id, parent_id, child_id, scope, granted, policy_version, granted_at) VALUES (?, 'eng-p1', ?, 'media_recording', 1, 'v1', ?)")
        .run(newId(), childId, nowIso()),
    ).not.toThrow();
  });
});

describe("Founding-member paywall (P5-r)", () => {
  it("app_settings guarda link e price_label (roundtrip)", () => {
    setSetting("founding_member_link", "https://pay.example.com/bearminds");
    setSetting("founding_member_price_label", "R$ 197/ano");
    expect(getSetting("founding_member_link")).toBe("https://pay.example.com/bearminds");
    expect(getSetting("founding_member_price_label")).toBe("R$ 197/ano");
  });

  it("marca e desmarca founding_member_at em parents", () => {
    const pid = "eng-p1";
    db.prepare("UPDATE parents SET founding_member_at = ? WHERE id = ?").run(nowIso(), pid);
    let row = db.prepare("SELECT founding_member_at FROM parents WHERE id = ?").get(pid) as { founding_member_at: string | null };
    expect(row.founding_member_at).not.toBeNull();
    db.prepare("UPDATE parents SET founding_member_at = NULL WHERE id = ?").run(pid);
    row = db.prepare("SELECT founding_member_at FROM parents WHERE id = ?").get(pid) as { founding_member_at: string | null };
    expect(row.founding_member_at).toBeNull();
  });
});

describe("Correlação pós-prova: pearsonCorrelation (P5-r)", () => {
  it("correlação perfeita positiva ⇒ 1", () => {
    const r = pearsonCorrelation([{ predicted: 0.2, actual: 0.2 }, { predicted: 0.5, actual: 0.5 }, { predicted: 0.9, actual: 0.9 }]);
    expect(r).toBeCloseTo(1);
  });

  it("correlação perfeita negativa ⇒ -1", () => {
    const r = pearsonCorrelation([{ predicted: 0.1, actual: 0.9 }, { predicted: 0.5, actual: 0.5 }, { predicted: 0.9, actual: 0.1 }]);
    expect(r).toBeCloseTo(-1);
  });

  it("menos de 2 pontos ⇒ null", () => {
    expect(pearsonCorrelation([])).toBeNull();
    expect(pearsonCorrelation([{ predicted: 0.5, actual: 0.5 }])).toBeNull();
  });

  it("variância zero (todos os valores iguais) ⇒ null", () => {
    expect(pearsonCorrelation([{ predicted: 0.5, actual: 0.3 }, { predicted: 0.5, actual: 0.7 }])).toBeNull();
  });
});
