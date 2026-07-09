// Missions-lite (spec 17.5): gravar áudio/vídeo "explique o conceito" / fluência de leitura / prática
// de idiomas. IA faz pré-análise (NUNCA nota) sobre o transcript digitado pelo aluno — este produto não
// tem transcrição automática de fala (ASR) configurada; o aluno digita um resumo/transcrição ao enviar.
// Professor avalia por rubrica assistindo/ouvindo o arquivo original. Escopo LGPD dedicado (spec 09):
// consentimento próprio de mídia (scope 'media_recording'), nunca pública, revisão só professor,
// retenção limitada (MISSION_RETENTION_DAYS, poda no nightly).
import { Hono } from "hono";
import { z } from "zod";
import { mkdirSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { db, newId, nowIso } from "../db.ts";
import {
  requireParent, requireRole, csrfGuard, ownChildOrThrow, hasConsent, staffInstitutionOrThrow,
} from "../lib/session.ts";
import { readJson, badRequest, forbidden, notFound, type AppEnv } from "../lib/http.ts";
import { evaluateAvailability, resolverFor, parseCond } from "../lib/availability.ts";
import { scoreRubric, type RubricSection } from "../lib/rubric.ts";
import { emitEvent } from "../lib/events.ts";
import { MISSION_RETENTION_DAYS } from "../lib/missions.ts";
import { llm } from "../llm/provider.ts";
import { pickModel } from "../llm/router.ts";
import { llmConfigured } from "../env.ts";

const app = new Hono<AppEnv>();
app.use("/api/learn/*", csrfGuard);
app.use("/api/admin/*", csrfGuard);

const STAFF = ["professor", "tutor", "institution_admin"] as const;
const UPLOAD_DIR = "data/uploads";
mkdirSync(UPLOAD_DIR, { recursive: true });

const MIME_LIMITS: Record<string, number> = {
  "audio/mpeg": 20 * 1024 * 1024,
  "audio/mp4": 20 * 1024 * 1024,
  "audio/webm": 20 * 1024 * 1024,
  "audio/wav": 20 * 1024 * 1024,
  "video/mp4": 100 * 1024 * 1024,
  "video/webm": 100 * 1024 * 1024,
};
const EXT_OK = new Set([".mp3", ".m4a", ".webm", ".wav", ".mp4"]);

app.post("/api/learn/missions/upload", requireParent, async (c) => {
  const parentId = c.get("parentId");
  const body = await c.req.parseBody();
  const file = body.file;
  const childId = body.child_id;
  if (typeof childId !== "string" || !childId) throw badRequest("no_child", "Informe o child_id.");
  ownChildOrThrow(parentId, childId);
  if (!hasConsent(parentId, childId, "media_recording")) {
    throw forbidden("consent_required", "Autorize a gravação de mídia nas configurações antes de enviar.");
  }
  if (!(file instanceof File)) throw badRequest("no_file", "Envie um arquivo no campo 'file'.");
  const ext = extname(file.name).toLowerCase();
  const limit = MIME_LIMITS[file.type];
  if (!limit || !EXT_OK.has(ext)) throw badRequest("bad_type", "Tipo não suportado. Aceitamos áudio (MP3/M4A/WEBM/WAV) ou vídeo (MP4/WEBM).");
  if (file.size > limit) throw badRequest("too_big", `Arquivo acima do limite (${Math.round(limit / 1024 / 1024)}MB).`);

  const id = newId();
  const path = join(UPLOAD_DIR, `${id}${ext}`);
  writeFileSync(path, Buffer.from(await file.arrayBuffer()), { mode: 0o600 });
  db.prepare(
    "INSERT INTO files (id, owner_parent_id, kind, original_name, path, mime, size_bytes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(id, parentId, file.type.startsWith("video") ? "video" : "audio", file.name.slice(0, 200), path, file.type, file.size, nowIso());
  return c.json({ id, name: file.name, mime: file.type }, 201);
});

interface ItemRow { id: string; kind: string; module_id: string; course_id: string; payload_json: string | null; availability_json: string | null; mod_avail: string | null }
function missionItem(itemId: string): ItemRow {
  const r = db.prepare(
    `SELECT i.id, i.kind, i.module_id, i.payload_json, i.availability_json, m.course_id, m.availability_json AS mod_avail
     FROM content_items i JOIN course_modules m ON m.id = i.module_id WHERE i.id = ? AND i.status = 'published'`,
  ).get(itemId) as ItemRow | undefined;
  if (!r) throw notFound("item_not_found", "Missão não encontrada.");
  if (r.kind !== "mission") throw badRequest("not_mission", "Este item não é uma Mission.");
  return r;
}

app.post("/api/learn/items/:id/mission", requireParent, async (c) => {
  const parentId = c.get("parentId");
  const { child_id, file_id, transcript } = await readJson(c, z.object({
    child_id: z.string().min(1),
    file_id: z.string().min(1),
    transcript: z.string().max(8000).nullish(),
  }));
  ownChildOrThrow(parentId, child_id);
  if (!hasConsent(parentId, child_id, "media_recording")) throw forbidden("consent_required", "Autorize a gravação de mídia antes de enviar.");
  const item = missionItem(c.req.param("id"));
  const enrolled = db.prepare("SELECT 1 FROM enrollments WHERE child_id = ? AND course_id = ?").get(child_id, item.course_id);
  if (!enrolled) throw forbidden("not_enrolled", "Inscreva-se no curso primeiro.");
  const resolver = resolverFor(child_id);
  if (!evaluateAvailability(parseCond(item.mod_avail), resolver).available || !evaluateAvailability(parseCond(item.availability_json), resolver).available) {
    throw forbidden("locked", "Esta missão ainda está bloqueada.");
  }
  const file = db.prepare("SELECT id FROM files WHERE id = ? AND owner_parent_id = ?").get(file_id, parentId);
  if (!file) throw notFound("file_not_found", "Arquivo não encontrado.");

  const now = nowIso();
  const retentionUntil = new Date(Date.now() + MISSION_RETENTION_DAYS * 86400000).toISOString();
  db.prepare(
    `INSERT INTO mission_submissions (id, item_id, child_id, file_id, transcript, status, consent_at, retention_until, submitted_at)
     VALUES (?, ?, ?, ?, ?, 'submitted', ?, ?, ?)
     ON CONFLICT(item_id, child_id) DO UPDATE SET file_id = excluded.file_id, transcript = excluded.transcript,
       status = 'submitted', ai_preanalysis_json = NULL, consent_at = excluded.consent_at,
       retention_until = excluded.retention_until, submitted_at = excluded.submitted_at`,
  ).run(newId(), item.id, child_id, file_id, transcript ?? null, now, retentionUntil, now);
  db.prepare(
    `INSERT INTO item_progress (child_id, item_id, status, attempts, updated_at) VALUES (?, ?, 'done', 1, ?)
     ON CONFLICT(child_id, item_id) DO UPDATE SET status='done', attempts = attempts + 1, updated_at = excluded.updated_at`,
  ).run(child_id, item.id, now);
  emitEvent("mission_submission", { kind: "child", id: child_id }, { course_id: item.course_id, ref_kind: "item", ref_id: item.id });
  return c.json({ ok: true, retention_until: retentionUntil }, 201);
});

app.get("/api/learn/items/:id/mission", requireParent, (c) => {
  const parentId = c.get("parentId");
  const childId = c.req.query("child_id") || c.get("activeChildId") || "";
  if (childId) ownChildOrThrow(parentId, childId);
  const item = missionItem(c.req.param("id"));
  const sub = db.prepare(
    "SELECT id, file_id, transcript, status, retention_until, submitted_at FROM mission_submissions WHERE item_id = ? AND child_id = ?",
  ).get(item.id, childId) as Record<string, unknown> | undefined;
  if (!sub) return c.json({ submission: null });
  const review = db.prepare("SELECT points, feedback, created_at FROM mission_reviews WHERE mission_submission_id = ? ORDER BY created_at DESC LIMIT 1").get(sub.id as string);
  return c.json({ submission: { ...sub, review: review ?? null } });
});

function staffMission(parentId: string, missionSubId: string): { sub: Record<string, unknown>; course_id: string } {
  const sub = db.prepare(
    `SELECT ms.*, m.course_id, i.payload_json FROM mission_submissions ms
     JOIN content_items i ON i.id = ms.item_id JOIN course_modules m ON m.id = i.module_id WHERE ms.id = ?`,
  ).get(missionSubId) as Record<string, unknown> | undefined;
  if (!sub) throw notFound("sub_not_found", "Submissão não encontrada.");
  const course = db.prepare("SELECT institution_id FROM courses WHERE id = ?").get(sub.course_id as string) as { institution_id: string } | undefined;
  if (course) staffInstitutionOrThrow(parentId, course.institution_id);
  return { sub, course_id: sub.course_id as string };
}

app.get("/api/admin/items/:id/mission-submissions", requireParent, requireRole(...STAFF), (c) => {
  const parentId = c.get("parentId");
  const item = db.prepare("SELECT m.course_id FROM content_items i JOIN course_modules m ON m.id = i.module_id WHERE i.id = ?").get(c.req.param("id")) as { course_id: string } | undefined;
  if (!item) throw notFound("item_not_found", "Item não encontrado.");
  const course = db.prepare("SELECT institution_id FROM courses WHERE id = ?").get(item.course_id) as { institution_id: string } | undefined;
  if (course) staffInstitutionOrThrow(parentId, course.institution_id);
  const rows = db.prepare(
    `SELECT ms.id, ms.child_id, ch.display_name AS student, ms.file_id, ms.transcript, ms.status, ms.submitted_at, ms.retention_until,
            (SELECT points FROM mission_reviews r WHERE r.mission_submission_id = ms.id ORDER BY r.created_at DESC LIMIT 1) AS points
     FROM mission_submissions ms JOIN children ch ON ch.id = ms.child_id WHERE ms.item_id = ? ORDER BY ms.submitted_at DESC`,
  ).all(c.req.param("id"));
  return c.json({ submissions: rows });
});

app.post("/api/admin/mission-submissions/:id/ai-preanalysis", requireParent, requireRole(...STAFF), async (c) => {
  const parentId = c.get("parentId");
  const { sub } = staffMission(parentId, c.req.param("id"));
  if (!llmConfigured) throw badRequest("no_llm", "IA indisponível (sem chave de modelo).");
  const transcript = (sub.transcript as string | null)?.slice(0, 6000) ?? "";
  if (!transcript.trim()) throw badRequest("no_transcript", "Sem transcrição digitada pelo aluno para analisar. Este produto não faz transcrição automática de áudio/vídeo.");
  const payload = sub.payload_json ? JSON.parse(sub.payload_json as string) as { prompt?: string } : {};
  const system = "Você é assistente de um professor brasileiro (K-12) avaliando uma missão de fala/leitura gravada. O aluno digitou uma transcrição/resumo do que gravou. Analise de forma objetiva e CURTA. NUNCA atribua nota — apenas ajude o professor a preparar a correção. Responda em JSON com: {summary: string (1-2 frases), coverage: string[] (o que a fala cobre bem em relação ao pedido), gaps: string[] (o que falta), keywords_found: string[] (palavras-chave do tema presentes no texto)}. Português.";
  const user = `PEDIDO DA MISSÃO:\n${payload.prompt ?? "(não informado)"}\n\nTRANSCRIÇÃO DIGITADA PELO ALUNO:\n${transcript}`;
  let assist: unknown;
  try {
    const res = await llm({ model: pickModel("quiz"), system, user, json: true, maxTokens: 500, temperature: 0.2 });
    assist = JSON.parse(res.text);
  } catch {
    throw badRequest("ai_failed", "A IA não conseguiu analisar agora. Tente de novo.");
  }
  db.prepare("UPDATE mission_submissions SET ai_preanalysis_json = ? WHERE id = ?").run(JSON.stringify(assist), sub.id as string);
  return c.json({ ai_preanalysis: assist });
});

app.post("/api/admin/mission-submissions/:id/review", requireParent, requireRole(...STAFF), async (c) => {
  const parentId = c.get("parentId");
  const { sub } = staffMission(parentId, c.req.param("id"));
  const b = await readJson(c, z.object({
    feedback: z.string().trim().min(1).max(4000),
    rubric_id: z.string().nullish(),
    selections: z.array(z.array(z.number().int())).nullish(),
    points: z.number().min(0).max(1000).nullish(),
  }));
  let points = b.points ?? null;
  let rubricScores: unknown = null;
  if (b.rubric_id && b.selections) {
    const rub = db.prepare("SELECT sections_json FROM rubrics WHERE id = ?").get(b.rubric_id) as { sections_json: string } | undefined;
    if (!rub) throw notFound("rubric_not_found", "Rubrica não encontrada.");
    const payload = sub.payload_json ? JSON.parse(sub.payload_json as string) as { max_points?: number } : {};
    const scored = scoreRubric(JSON.parse(rub.sections_json) as RubricSection[], b.selections, payload.max_points ?? 100);
    points = scored.points;
    rubricScores = { rubric_id: b.rubric_id, selections: b.selections, fraction: scored.fraction };
  }
  db.prepare(
    "INSERT INTO mission_reviews (id, mission_submission_id, reviewer_parent_id, rubric_scores_json, points, feedback, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(newId(), sub.id as string, parentId, rubricScores ? JSON.stringify(rubricScores) : null, points, b.feedback, nowIso());
  db.prepare("UPDATE mission_submissions SET status = 'reviewed' WHERE id = ?").run(sub.id as string);
  const child = db.prepare("SELECT parent_id FROM children WHERE id = ?").get(sub.child_id as string) as { parent_id: string } | undefined;
  if (child) db.prepare(
    `INSERT INTO notifications (id, parent_id, child_id, kind, title, body, link, created_at) VALUES (?, ?, ?, 'system', '🎙️ Missão avaliada', 'O professor devolveu sua missão com feedback.', '/atividades', ?)`,
  ).run(newId(), child.parent_id, sub.child_id as string, nowIso());
  return c.json({ ok: true, points });
});

export default app;
