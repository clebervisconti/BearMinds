// POST /api/generate — motor de aprendizagem (spec 05). Auth + consentimento + cache + guardrails.
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db.ts";
import { requireParent, csrfGuard, ownChildOrThrow, hasConsent } from "../lib/session.ts";
import { readJson, forbidden, notFound, badRequest, type AppEnv } from "../lib/http.ts";
import { generate } from "../gen/engine.ts";
import { getVerifiedSkill } from "../gen/engine.ts";
import { resolveTopic } from "../gen/resolve.ts";
import type { AgeBand, Lang } from "../../shared/contracts.ts";

const app = new Hono<AppEnv>();
app.use("/api/generate", csrfGuard);

const schema = z
  .object({
    child_id: z.string().min(1),
    bncc_code: z.string().max(20).optional(),
    topic: z.string().trim().max(160).optional(),
    grade: z.string().max(8).optional(),
    lang: z.enum(["pt", "en"]).optional(),
  })
  .refine((b) => b.bncc_code || b.topic, { message: "informe bncc_code ou topic" });

interface ChildRow {
  id: string;
  grade: string;
  age_band: AgeBand;
}

app.post("/api/generate", requireParent, async (c) => {
  const parentId = c.get("parentId");
  const body = await readJson(c, schema);
  ownChildOrThrow(parentId, body.child_id);

  // Consentimento ai_generation é obrigatório (spec 03) — bloqueia com 403 amigável.
  if (!hasConsent(parentId, body.child_id, "ai_generation")) {
    throw forbidden(
      "ai_consent_required",
      "A geração de conteúdo com IA está desativada para este perfil. O responsável pode reativar nas configurações.",
    );
  }

  const child = db
    .prepare("SELECT id, grade, age_band FROM children WHERE id = ? AND deleted_at IS NULL")
    .get(body.child_id) as ChildRow | undefined;
  if (!child) throw notFound("child_not_found", "Perfil não encontrado.");

  // Resolve o código BNCC.
  let bnccCode = body.bncc_code;
  if (!bnccCode) {
    const candidates = await resolveTopic(body.topic!, body.grade || child.grade);
    if (candidates.length === 0) {
      throw notFound("not_in_corpus", "Não encontramos esse tópico no nosso material verificado (ainda).");
    }
    bnccCode = candidates[0].bncc_code;
  }
  if (!getVerifiedSkill(bnccCode)) {
    throw badRequest("bad_code", "Código BNCC inválido ou não verificado.");
  }

  const bundle = await generate({
    bnccCode,
    gradeBand: body.grade || child.grade,
    ageBand: child.age_band,
    lang: body.lang ?? "pt",
    topicText: body.topic,
    childId: child.id,
    parentId,
  });

  return c.json(bundle);
});

export default app;
