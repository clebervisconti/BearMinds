// Rotas do pipeline de enriquecimento (spec 13.3): disparar, acompanhar, pré-visualizar.
import { Hono } from "hono";
import { z } from "zod";
import { db, newId, nowIso } from "../db.ts";
import { requireParent, requireRole, csrfGuard, staffInstitutionOrThrow } from "../lib/session.ts";
import { readJson, badRequest, notFound, type AppEnv } from "../lib/http.ts";
import { extractTextFromFile, runEnrich, skillCodeForItem } from "../gen/enrich.ts";
import { llmConfigured } from "../env.ts";
import type { Lesson, Quiz, Explorable, Citation } from "../../shared/contracts.ts";

const app = new Hono<AppEnv>();
app.use("/api/admin/*", csrfGuard);

const STAFF = ["professor", "institution_admin"] as const;

function itemCourse(itemId: string) {
  const row = db
    .prepare(
      `SELECT i.id, i.source_file_id, i.payload_json, m.course_id, cs.institution_id
       FROM content_items i JOIN course_modules m ON m.id = i.module_id JOIN courses cs ON cs.id = m.course_id
       WHERE i.id = ?`,
    )
    .get(itemId) as { id: string; source_file_id: string | null; payload_json: string | null; course_id: string; institution_id: string } | undefined;
  if (!row) throw notFound("item_not_found", "Item não encontrado.");
  return row;
}

// POST /api/admin/items/:id/enrich {text?} — texto colado OU arquivo-fonte do item
app.post("/api/admin/items/:id/enrich", requireParent, requireRole(...STAFF), async (c) => {
  const parentId = c.get("parentId");
  const item = itemCourse(c.req.param("id"));
  staffInstitutionOrThrow(parentId, item.institution_id);
  if (!llmConfigured) {
    throw badRequest("llm_unavailable", "Enriquecimento com IA requer GEMINI_API_KEY configurada no servidor.");
  }
  const { text } = await readJson(c, z.object({ text: z.string().max(400_000).nullish() }));

  let source = (text ?? "").trim();
  if (!source && item.source_file_id) {
    const f = db.prepare("SELECT path, mime FROM files WHERE id = ?").get(item.source_file_id) as
      | { path: string; mime: string }
      | undefined;
    if (!f) throw notFound("file_not_found", "Arquivo-fonte não encontrado.");
    source = extractTextFromFile(f.path, f.mime);
  }
  if (source.length < 200) {
    throw badRequest("no_source", "Envie um arquivo-fonte ou cole um texto com pelo menos 200 caracteres.");
  }

  const jobId = newId();
  db.prepare(
    "INSERT INTO enrich_jobs (id, item_id, course_id, status, created_by, created_at) VALUES (?, ?, ?, 'queued', ?, ?)",
  ).run(jobId, item.id, item.course_id, parentId, nowIso());

  // roda em background (in-process); o cliente acompanha por polling
  setImmediate(() => {
    void runEnrich({ itemId: item.id, courseId: item.course_id, parentId, text: source }, jobId);
  });
  return c.json({ job_id: jobId }, 202);
});

// GET /api/admin/jobs/:id
app.get("/api/admin/jobs/:id", requireParent, requireRole(...STAFF), (c) => {
  const job = db.prepare("SELECT id, item_id, status, detail, updated_at FROM enrich_jobs WHERE id = ?").get(c.req.param("id"));
  if (!job) throw notFound("job_not_found", "Job não encontrado.");
  return c.json(job);
});

// GET /api/admin/items/:id/preview — o artefato gerado, como o aluno verá (fila de revisão)
app.get("/api/admin/items/:id/preview", requireParent, requireRole(...STAFF), (c) => {
  const item = itemCourse(c.req.param("id"));
  staffInstitutionOrThrow(c.get("parentId"), item.institution_id);
  const payload = item.payload_json ? (JSON.parse(item.payload_json) as { bncc_code?: string; grade_band?: string; age_band?: string }) : {};
  const code = payload.bncc_code ?? skillCodeForItem(item.id);

  const read = (kind: string) =>
    db
      .prepare(
        "SELECT payload_json, citations_json FROM generated_artifacts WHERE bncc_code = ? AND kind = ? AND safety_passed = 1 ORDER BY created_at DESC LIMIT 1",
      )
      .get(code, kind) as { payload_json: string; citations_json: string | null } | undefined;

  const lessonRow = read("lesson");
  const quizRow = read("quiz");
  if (!lessonRow || !quizRow) throw notFound("not_generated", "Nada gerado ainda para este item.");
  const explRow = read("explorable");
  const atoms = db.prepare("SELECT id, atom_text AS text FROM knowledge_atoms WHERE bncc_code = ?").all(code);

  return c.json({
    bncc_code: code,
    lesson: JSON.parse(lessonRow.payload_json) as Lesson,
    quiz: JSON.parse(quizRow.payload_json) as Quiz,
    explorable: explRow ? (JSON.parse(explRow.payload_json) as Explorable) : null,
    citations: lessonRow.citations_json ? (JSON.parse(lessonRow.citations_json) as Citation[]) : [],
    atoms,
  });
});

export default app;
