// Resolução de tópico livre → código(s) BNCC. Keyword (determinístico, sempre) + LLM (se houver chave).
import { readFileSync } from "node:fs";
import { db } from "../db.ts";
import { llm, parseJSON } from "../llm/provider.ts";
import { pickModel } from "../llm/router.ts";
import { llmConfigured } from "../env.ts";
import { tokens } from "../lib/text.ts";
import { logger } from "../logger.ts";
import type { TopicCandidate } from "../../shared/contracts.ts";

const prompt = (f: string) => readFileSync(new URL(`../prompts/${f}`, import.meta.url), "utf8");

interface SkillRow {
  code: string;
  description: string;
  area: string;
}
function verifiedSkills(): SkillRow[] {
  return db
    .prepare("SELECT code, description, area FROM bncc_skills WHERE verified_at IS NOT NULL")
    .all() as SkillRow[];
}
function titleFor(code: string): string {
  const row = db
    .prepare("SELECT title FROM curriculum_map WHERE bncc_code = ? AND title IS NOT NULL LIMIT 1")
    .get(code) as { title: string } | undefined;
  return row?.title ?? code;
}

export function keywordCandidates(text: string): TopicCandidate[] {
  const q = tokens(text);
  if (q.length === 0) return [];
  return verifiedSkills()
    .map((s) => {
      const hay = new Set(tokens(`${s.description} ${s.area} ${titleFor(s.code)}`));
      const overlap = q.filter((t) => hay.has(t)).length;
      return { s, score: overlap / q.length };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => ({
      bncc_code: x.s.code,
      description: x.s.description,
      title: titleFor(x.s.code),
      confidence: Math.min(1, x.score),
    }));
}

export async function resolveTopic(text: string, grade?: string): Promise<TopicCandidate[]> {
  const keyword = keywordCandidates(text);
  if (!llmConfigured) return keyword;
  try {
    const skills = verifiedSkills();
    const catalog = skills.map((s) => `${s.code} — ${s.description}`).join("\n");
    const res = await llm({
      model: pickModel("resolve"),
      json: true,
      system: prompt("resolve.txt")
        .replace("{{catalog}}", catalog)
        .replace("{{grade}}", grade ?? "")
        .replace("{{topic}}", text),
      user: "Retorne os candidatos.",
      maxTokens: 400,
    });
    const parsed = parseJSON<{ candidates: TopicCandidate[] }>(res.text);
    const valid = (parsed.candidates ?? [])
      .filter((cand) => skills.some((s) => s.code === cand.bncc_code))
      .map((cand) => ({ ...cand, title: titleFor(cand.bncc_code) }));
    if (valid.length) return valid.slice(0, 3);
  } catch (e) {
    logger.warn({ err: String(e) }, "resolveTopic LLM falhou; usando keyword");
  }
  return keyword;
}
