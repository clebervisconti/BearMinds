// Motor de geração (spec 05): cache-first → grounding → router → gerar → mathcheck → safety → cache.
import { readFileSync } from "node:fs";
import { db, nowIso } from "../db.ts";
import { retrieve, contextBlock, type Chunk } from "../rag/retriever.ts";
import { llm, parseJSON } from "../llm/provider.ts";
import { pickModel } from "../llm/router.ts";
import { costUsd, COST_ALERT_USD } from "../llm/cost.ts";
import { llmConfigured } from "../env.ts";
import { audit } from "../lib/audit.ts";
import { logger } from "../logger.ts";
import { AppError } from "../lib/http.ts";
import {
  groundingCheck,
  sanitizeQuiz,
  validateExplorable,
  applyMathCorrections,
  type MathCheckResult,
} from "./guardrails.ts";
import { exemplarFor } from "./exemplars.ts";
import type {
  Lesson, Quiz, Explorable, AgeBand, Lang, GenerateBundle, Citation,
} from "../../shared/contracts.ts";

const P = (f: string) => readFileSync(new URL(`../prompts/${f}`, import.meta.url), "utf8");
const langInstruction = (lang: Lang) =>
  lang === "en" ? "Write everything in clear, age-appropriate English." : "Escreva tudo em português do Brasil.";

// lang entra na chave de cache sem alterar o schema (grade_band = '6EF' | '6EF:en').
const cacheGrade = (gradeBand: string, lang: Lang) => (lang === "en" ? `${gradeBand}:en` : gradeBand);

interface Skill {
  code: string;
  description: string;
  area: string;
}
export function getVerifiedSkill(code: string): Skill | null {
  return (
    (db
      .prepare("SELECT code, description, area FROM bncc_skills WHERE code = ? AND verified_at IS NOT NULL")
      .get(code) as Skill | undefined) ?? null
  );
}

function titleFor(code: string, fallback: string): string {
  const row = db
    .prepare("SELECT title FROM curriculum_map WHERE bncc_code = ? AND title IS NOT NULL LIMIT 1")
    .get(code) as { title: string } | undefined;
  return row?.title ?? fallback;
}

function atomsFromDb(code: string): { id: string; text: string }[] {
  return db.prepare("SELECT id, atom_text AS text FROM knowledge_atoms WHERE bncc_code = ?").all(code) as {
    id: string;
    text: string;
  }[];
}

function upsertAtoms(code: string, atoms: { id: string; text: string; prereq_id?: string | null }[]): void {
  const stmt = db.prepare(
    "INSERT OR REPLACE INTO knowledge_atoms (id, bncc_code, atom_text, prereq_atom_id) VALUES (?, ?, ?, ?)",
  );
  db.transaction(() => {
    for (const a of atoms) stmt.run(a.id, code, a.text, a.prereq_id ?? null);
  })();
}

async function ensureAtoms(skill: Skill, ctx: string): Promise<{ id: string; text: string }[]> {
  const existing = atomsFromDb(skill.code);
  if (existing.length) return existing;
  if (!llmConfigured) return [];
  const res = await llm({
    model: pickModel("decompose"),
    json: true,
    system: P("decompose.txt")
      .replace("{{skill_code}}", skill.code)
      .replace("{{skill_description}}", skill.description)
      .replace("{{chunks}}", ctx),
    user: "Gere os knowledge-atoms.",
    maxTokens: 600,
  });
  const parsed = parseJSON<{ atoms: { text: string; prereq_index: number | null }[] }>(res.text);
  const ids = parsed.atoms.map((_, i) => `atom_${skill.code}_${i + 1}`);
  upsertAtoms(
    skill.code,
    parsed.atoms.map((a, i) => ({
      id: ids[i],
      text: a.text,
      prereq_id: a.prereq_index != null ? ids[a.prereq_index] ?? null : null,
    })),
  );
  return atomsFromDb(skill.code);
}

// ---------- cache ----------
function readArtifact(code: string, gradeBand: string, kind: "lesson" | "explorable" | "quiz", ageBand: AgeBand) {
  return db
    .prepare(
      `SELECT payload_json, citations_json FROM generated_artifacts
       WHERE bncc_code = ? AND grade_band = ? AND kind = ? AND age_band = ? AND safety_passed = 1`,
    )
    .get(code, gradeBand, kind, ageBand) as { payload_json: string; citations_json: string | null } | undefined;
}

function writeArtifact(
  code: string,
  gradeBand: string,
  kind: "lesson" | "explorable" | "quiz",
  ageBand: AgeBand,
  payload: unknown,
  citations: Citation[] | null,
  modelUsed: string,
): void {
  db.prepare(
    `INSERT OR REPLACE INTO generated_artifacts
       (id, bncc_code, grade_band, kind, age_band, payload_json, citations_json, model_used, safety_passed, created_at)
     VALUES ((SELECT id FROM generated_artifacts WHERE bncc_code=? AND grade_band=? AND kind=? AND age_band=?),
       ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
  ).run(
    code, gradeBand, kind, ageBand,
    code, gradeBand, kind, ageBand,
    JSON.stringify(payload), citations ? JSON.stringify(citations) : null, modelUsed, nowIso(),
  );
}

function readBundleFromCache(
  code: string, gradeBand: string, ageBand: AgeBand, lang: Lang, skill: Skill,
): GenerateBundle | null {
  const cg = cacheGrade(gradeBand, lang);
  const lessonRow = readArtifact(code, cg, "lesson", ageBand);
  const quizRow = readArtifact(code, cg, "quiz", ageBand);
  if (!lessonRow || !quizRow) return null;
  const explRow = readArtifact(code, cg, "explorable", ageBand);
  return {
    bncc_code: code,
    grade: gradeBand,
    grade_band: gradeBand,
    age_band: ageBand,
    lang,
    title: titleFor(code, skill.description),
    cached: true,
    lesson: JSON.parse(lessonRow.payload_json) as Lesson,
    quiz: JSON.parse(quizRow.payload_json) as Quiz,
    explorable: explRow ? (JSON.parse(explRow.payload_json) as Explorable) : null,
    citations: lessonRow.citations_json ? (JSON.parse(lessonRow.citations_json) as Citation[]) : [],
    atoms: atomsFromDb(code),
  };
}

// ---------- safety (menores) ----------
const UNSAFE = [/\bviol[êe]ncia expl/i, /sexual/i, /suic[íi]dio/i, /drogas?\b/i, /arma de fogo/i];
function safetyOk(text: string): boolean {
  return !UNSAFE.some((re) => re.test(text));
}

// ---------- mathcheck ----------
async function runMathChecks(quiz: Quiz, usage: { cost: number }): Promise<Quiz> {
  const needing = quiz.questions.filter((q) => q.needs_math_check);
  if (needing.length === 0 || !llmConfigured) return quiz;
  const results: MathCheckResult[] = [];
  for (const q of needing) {
    try {
      const res = await llm({
        model: pickModel("math_check", { hard: false }),
        json: true,
        system: P("mathcheck.txt").replace("{{question}}", JSON.stringify(q)),
        user: "Verifique.",
        maxTokens: 500,
      });
      usage.cost += costUsd(res.model, res.usage);
      const chk = parseJSON<{
        ok: boolean; corrected_answer_index: number | null; corrected_answer_number: number | null;
      }>(res.text);
      results.push({
        question_id: q.id,
        ok: chk.ok !== false,
        corrected_answer_index: chk.corrected_answer_index,
        corrected_answer_number: chk.corrected_answer_number,
      });
    } catch (e) {
      logger.warn({ err: String(e), q: q.id }, "mathcheck falhou; mantém resposta original");
    }
  }
  return applyMathCorrections(quiz, results);
}

// ---------- pipeline principal ----------
export async function generate(params: {
  bnccCode: string;
  gradeBand: string;
  ageBand: AgeBand;
  lang: Lang;
  topicText?: string;
  childId: string;
  parentId: string;
}): Promise<GenerateBundle> {
  const skill = getVerifiedSkill(params.bnccCode);
  if (!skill) throw new AppError(404, "not_in_corpus", "Tópico fora do corpus BNCC verificado (P1).");

  // 1) CACHE
  const cached = readBundleFromCache(params.bnccCode, params.gradeBand, params.ageBand, params.lang, skill);
  if (cached) {
    bumpMetric("cache_hits");
    return cached;
  }

  // 2) GROUNDING
  const chunks: Chunk[] = retrieve(params.bnccCode, params.topicText || skill.description);
  if (chunks.length === 0) {
    return refusedBundle(params, skill, "Ainda não temos material verificado para este tópico.");
  }
  const ctx = contextBlock(chunks);
  const validIds = new Set(chunks.map((ch) => ch.id));
  const citations: Citation[] = chunks.map((ch) => ({ id: ch.id, ref: `${ch.source_title}, ${ch.source_ref}` }));

  const usage = { cost: 0 };
  let modelUsed = "exemplar";

  let lesson: Lesson;
  let quiz: Quiz;
  let explorable: Explorable | null = null;
  let atoms: { id: string; text: string }[];

  const exemplar = exemplarFor(params.bnccCode);
  if (exemplar) {
    // Caminho hand-verified (garantido, sem LLM).
    upsertAtoms(params.bnccCode, exemplar.atoms);
    atoms = atomsFromDb(params.bnccCode);
    lesson = groundingCheck(exemplar.lesson, validIds);
    quiz = sanitizeQuiz(exemplar.quiz);
    explorable = validateExplorable(exemplar.explorable).ok ? exemplar.explorable : null;
  } else if (llmConfigured) {
    atoms = await ensureAtoms(skill, ctx);
    const li = langInstruction(params.lang);
    const base = (f: string) =>
      P(f)
        .replace(/{{age_band}}/g, params.ageBand)
        .replace(/{{lang_instruction}}/g, li)
        .replace(/{{skill_code}}/g, skill.code)
        .replace(/{{skill_description}}/g, skill.description)
        .replace(/{{chunks}}/g, ctx);

    // lição
    const lessonRes = await llm({ model: pickModel("lesson"), json: true, system: base("lesson.txt"), user: `Habilidade: ${skill.code}` });
    modelUsed = lessonRes.model;
    usage.cost += costUsd(lessonRes.model, lessonRes.usage);
    lesson = groundingCheck(parseJSON<Lesson>(lessonRes.text), validIds);
    if (lesson.refused) {
      audit(`child:${params.childId}`, "generate_refused", `skill:${skill.code}`, { reason: lesson.reason });
      return refusedBundle(params, skill, lesson.reason ?? "Sem base suficiente.");
    }

    // quiz
    const atomsList = atoms.map((a) => `- ${a.id}: ${a.text}`).join("\n");
    const quizRes = await llm({
      model: pickModel("quiz"),
      json: true,
      system: base("quiz.txt").replace("{{atoms}}", atomsList || "- (nenhum atom)"),
      user: `Habilidade: ${skill.code}`,
    });
    usage.cost += costUsd(quizRes.model, quizRes.usage);
    quiz = sanitizeQuiz(normalizeQuizAtoms(parseJSON<Quiz>(quizRes.text), atoms));
    quiz = await runMathChecks(quiz, usage);

    // explorável (best-effort; descarta se inseguro)
    try {
      const explRes = await llm({ model: pickModel("explorable"), json: true, system: base("explorable.txt"), user: `Habilidade: ${skill.code}`, maxTokens: 3000 });
      usage.cost += costUsd(explRes.model, explRes.usage);
      const cand = parseJSON<Explorable>(explRes.text);
      if (validateExplorable(cand).ok) explorable = cand;
    } catch (e) {
      logger.warn({ err: String(e) }, "explorable falhou; seguindo sem");
    }
  } else {
    throw new AppError(503, "llm_unavailable", "Geração indisponível: configure a chave do modelo (GEMINI_API_KEY).");
  }

  // 3) SAFETY
  const blob = JSON.stringify({ lesson, quiz });
  if (!safetyOk(blob)) {
    return refusedBundle(params, skill, "Conteúdo bloqueado pelo filtro de segurança.");
  }

  // 4) CACHE WRITE (só entra com safety ok)
  const cg = cacheGrade(params.gradeBand, params.lang);
  writeArtifact(params.bnccCode, cg, "lesson", params.ageBand, lesson, citations, modelUsed);
  writeArtifact(params.bnccCode, cg, "quiz", params.ageBand, quiz, citations, modelUsed);
  if (explorable) writeArtifact(params.bnccCode, cg, "explorable", params.ageBand, explorable, citations, modelUsed);

  // 5) LOG DE CUSTO (spec 05.3)
  bumpMetric("generations");
  audit(`child:${params.childId}`, "generate", `skill:${skill.code}`, {
    model: modelUsed, cost_usd: Number(usage.cost.toFixed(5)), age_band: params.ageBand, lang: params.lang,
  });
  if (usage.cost > COST_ALERT_USD) {
    logger.warn({ code: skill.code, cost: usage.cost }, `custo de geração acima de US$${COST_ALERT_USD}`);
  }

  return {
    bncc_code: params.bnccCode,
    grade: params.gradeBand,
    grade_band: params.gradeBand,
    age_band: params.ageBand,
    lang: params.lang,
    title: titleFor(params.bnccCode, skill.description),
    cached: false,
    lesson,
    quiz,
    explorable,
    citations,
    atoms,
  };
}

function normalizeQuizAtoms(quiz: Quiz, atoms: { id: string }[]): Quiz {
  const ids = new Set(atoms.map((a) => a.id));
  const fallback = atoms[0]?.id ?? null;
  return {
    questions: (quiz.questions ?? []).map((q, i) => ({
      ...q,
      id: q.id || `q${i + 1}`,
      atom_id: q.atom_id && ids.has(q.atom_id) ? q.atom_id : fallback,
    })),
  };
}

function refusedBundle(
  params: { bnccCode: string; gradeBand: string; ageBand: AgeBand; lang: Lang },
  skill: Skill,
  reason: string,
): GenerateBundle {
  return {
    bncc_code: params.bnccCode,
    grade: params.gradeBand,
    grade_band: params.gradeBand,
    age_band: params.ageBand,
    lang: params.lang,
    title: titleFor(params.bnccCode, skill.description),
    cached: false,
    lesson: { refused: true, reason, warmup_question: "", sections: [], recap_questions: [], companion_note: "" },
    quiz: { questions: [] },
    explorable: null,
    citations: [],
    atoms: [],
  };
}

// contador diário simples (métricas privacy-preserving — spec 09.3)
function bumpMetric(field: "generations" | "cache_hits"): void {
  const day = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
  db.prepare(
    `INSERT INTO metrics_daily (day, ${field}, computed_at) VALUES (?, 1, ?)
     ON CONFLICT(day) DO UPDATE SET ${field} = ${field} + 1`,
  ).run(day, nowIso());
}
