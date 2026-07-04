// Pipeline de enriquecimento IA (spec 13.3): material do professor → chunks (escopo curso)
// → knowledge-atoms → lesson+quiz grounded — REUSANDO o motor e os guardrails existentes.
//
// Arquitetura-chave: cada item de conteúdo enriquecido ganha um "skill" sintético
// `CRS-<itemId>` em bncc_skills. Assim TODO o motor (retriever por código, decompose,
// generate, cache, FSRS por atom) funciona sem mudanças. O material do professor é a
// fonte confiável (verified na criação); o ARTEFATO gerado só chega ao aluno depois da
// aprovação humana do item (status 'published') — mesmo princípio de sign-off do corpus BNCC.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { unzipSync, strFromU8 } from "fflate";
import { db, newId, nowIso } from "../db.ts";
import { generate } from "./engine.ts";
import { rebuildIndex } from "../rag/retriever.ts";
import { logger } from "../logger.ts";
import type { AgeBand } from "../../shared/contracts.ts";

// ---------- extração de texto ----------
export function extractTextFromFile(path: string, mime: string): string {
  if (mime === "application/pdf") {
    try {
      return execFileSync("pdftotext", ["-layout", "-enc", "UTF-8", path, "-"], {
        maxBuffer: 32 * 1024 * 1024,
      }).toString("utf8");
    } catch (e) {
      throw new Error("Não foi possível extrair texto do PDF (pdftotext indisponível ou PDF sem texto).");
    }
  }
  if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const zip = unzipSync(readFileSync(path));
    const doc = zip["word/document.xml"];
    if (!doc) throw new Error("DOCX inválido (sem word/document.xml).");
    const xml = strFromU8(doc);
    // parágrafos → quebras de linha; remove tags
    return xml
      .replace(/<w:p[ >]/g, "\n<w:p ")
      .replace(/<[^>]+>/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
  // txt / md
  return readFileSync(path, "utf8");
}

/** Divide o texto em chunks ~700 chars respeitando parágrafos (mín. 200 p/ não pulverizar). */
export function chunkText(text: string, target = 700): string[] {
  const paras = text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length >= 40);
  const chunks: string[] = [];
  let cur = "";
  for (const p of paras) {
    if ((cur + " " + p).length > target && cur.length >= 200) {
      chunks.push(cur.trim());
      cur = p;
    } else {
      cur = cur ? `${cur} ${p}` : p;
    }
  }
  if (cur.trim().length >= 40) chunks.push(cur.trim());
  return chunks.slice(0, 120); // limite sano por item
}

// ---------- faixa etária a partir da turma do curso ----------
export function gradeToAgeBand(gradeEquiv: string): AgeBand {
  const m = /^(\d+)(EF|EM)$/.exec(gradeEquiv);
  if (!m) return "11-14";
  const n = Number(m[1]);
  if (m[2] === "EM") return "15-18";
  return n <= 5 ? "8-10" : "11-14";
}

export const skillCodeForItem = (itemId: string) => `CRS-${itemId}`;

/** Banco de questões (spec 15.2): persiste as questões geradas como `draft` p/ o professor curar.
 *  Idempotente por (course, bncc_code, origin='ai'): re-enriquecer substitui os drafts de IA. */
export function persistQuestionsToBank(
  courseId: string,
  bnccCode: string,
  questions: { kind: string; prompt: string; options?: string[]; answer_index?: number; answer_number?: number; accept?: string[]; explanation?: string }[],
  parentId: string,
): number {
  db.prepare("DELETE FROM bank_questions WHERE course_id = ? AND bncc_code = ? AND origin = 'ai' AND status = 'draft'").run(courseId, bnccCode);
  let n = 0;
  const ins = db.prepare(
    `INSERT INTO bank_questions (id, course_id, bncc_code, tags_json, kind, prompt, options_json, answer_json, explanation, difficulty, status, origin, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 2, 'draft', 'ai', ?, ?)`,
  );
  for (const q of questions) {
    let kind: string | null = null;
    let answer: unknown = null;
    let options: string[] | null = null;
    if (q.kind === "mcq" && q.options && typeof q.answer_index === "number") { kind = "mcq"; options = q.options; answer = q.answer_index; }
    else if (q.kind === "numeric" && typeof q.answer_number === "number") { kind = "numeric"; answer = { value: q.answer_number, tolerance: 0 }; }
    else if (q.kind === "short" && q.accept?.length) { kind = "short"; answer = { accepted: q.accept }; }
    if (!kind) continue;   // pula tipos que não mapeiam (ex.: precisa de checagem manual)
    ins.run(newId(), courseId, bnccCode, null, kind, q.prompt, options ? JSON.stringify(options) : null, JSON.stringify(answer), q.explanation ?? null, parentId, nowIso());
    n++;
  }
  return n;
}

interface EnrichInput {
  itemId: string;
  courseId: string;
  parentId: string;
  text: string; // texto-fonte já extraído
}

/** Executa o pipeline completo para um item (chamado em background pela rota). */
export async function runEnrich(input: EnrichInput, jobId: string): Promise<void> {
  const setJob = (status: string, detail?: string) =>
    db.prepare("UPDATE enrich_jobs SET status = ?, detail = ?, updated_at = ? WHERE id = ?").run(
      status, detail ?? null, nowIso(), jobId,
    );

  try {
    setJob("running", "extraindo e indexando o material");
    const item = db
      .prepare(
        `SELECT i.id, i.title, i.kind, m.course_id, cs.institution_id, cs.class_id, cs.subject_id
         FROM content_items i JOIN course_modules m ON m.id = i.module_id JOIN courses cs ON cs.id = m.course_id
         WHERE i.id = ?`,
      )
      .get(input.itemId) as { id: string; title: string; course_id: string; institution_id: string; class_id: string } | undefined;
    if (!item) throw new Error("Item não encontrado.");

    const code = skillCodeForItem(item.id);
    const chunks = chunkText(input.text);
    if (chunks.length === 0) throw new Error("O material não tem texto suficiente para enriquecer.");

    // grade_equiv da turma via config da instituição
    const inst = db.prepare("SELECT config_json FROM institutions WHERE id = ?").get(item.institution_id) as
      | { config_json: string }
      | undefined;
    const cfg = inst ? (JSON.parse(inst.config_json) as { classes?: { id: string; grade_equiv: string }[] }) : {};
    const gradeEquiv = cfg.classes?.find((cl) => cl.id === item.class_id)?.grade_equiv ?? item.class_id;
    const ageBand = gradeToAgeBand(gradeEquiv);

    db.transaction(() => {
      // skill sintético (material do professor = fonte confiável na criação)
      db.prepare(
        `INSERT OR REPLACE INTO bncc_skills (code, stage, grade_band, area, component, description, verified_by, verified_at)
         VALUES (?, 'CURSO', ?, 'curso', ?, ?, ?, ?)`,
      ).run(code, gradeEquiv, item.course_id, `${item.title} (material do professor)`, `parent:${input.parentId}`, nowIso());
      // limpa chunks anteriores deste item e regrava
      db.prepare("DELETE FROM corpus_chunks WHERE bncc_code = ?").run(code);
      const ins = db.prepare(
        "INSERT INTO corpus_chunks (id, bncc_code, course_id, source_title, source_ref, content) VALUES (?, ?, ?, ?, ?, ?)",
      );
      chunks.forEach((content, i) =>
        ins.run(`chunk_${code}_${i + 1}`, code, item.course_id, item.title, `material do professor, trecho ${i + 1}`, content),
      );
      // atoms e cache antigos deste item são regenerados
      db.prepare("DELETE FROM knowledge_atoms WHERE bncc_code = ?").run(code);
      db.prepare("DELETE FROM generated_artifacts WHERE bncc_code = ?").run(code);
    })();
    db.prepare("UPDATE knowledge_atoms SET course_id = ? WHERE bncc_code = ?").run(item.course_id, code);
    rebuildIndex();

    setJob("running", "gerando lição e quiz com IA (grounded no material)");
    // Reusa o motor inteiro: decompose→atoms, lesson, quiz, mathcheck, guardrails, cache.
    const bundle = await generate({
      bnccCode: code,
      gradeBand: gradeEquiv,
      ageBand,
      lang: "pt",
      topicText: item.title,
      childId: `staff:${input.parentId}`,
      parentId: input.parentId,
    });
    if (bundle.lesson.refused) {
      throw new Error(`A IA recusou por falta de base no material: ${bundle.lesson.reason ?? ""}`);
    }
    db.prepare("UPDATE knowledge_atoms SET course_id = ? WHERE bncc_code = ?").run(item.course_id, code);
    persistQuestionsToBank(item.course_id, code, bundle.quiz.questions, input.parentId);

    // item aponta para o artefato; aguarda aprovação humana
    const payload = { ai: true, bncc_code: code, grade_band: gradeEquiv, age_band: ageBand, lang: "pt" };
    db.prepare("UPDATE content_items SET payload_json = ?, status = 'pending_review' WHERE id = ?").run(
      JSON.stringify(payload), item.id,
    );
    setJob("review", `pronto para revisão: ${bundle.quiz.questions.length} questões, ${bundle.atoms.length} conceitos`);
  } catch (e) {
    logger.error({ err: String(e), jobId }, "enrich falhou");
    setJob("error", String((e as Error).message ?? e).slice(0, 400));
  }
}
