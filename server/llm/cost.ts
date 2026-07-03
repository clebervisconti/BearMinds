import type { LLMUsage, ModelId } from "./provider.ts";

// Preços aproximados (US$/1M tokens), verificados jun/2026 (BUILD-KIT §3).
// Usado para o log de custo por geração e o alerta de orçamento (spec 05.3: > US$0.05/lição).
const PRICING: { match: (m: string) => boolean; in: number; out: number }[] = [
  { match: (m) => m.includes("flash-lite"), in: 0.1, out: 0.4 },
  { match: (m) => m.includes("flash"), in: 0.3, out: 2.5 },
  { match: (m) => m.includes("haiku"), in: 1.0, out: 5.0 },
  { match: (m) => m.includes("claude"), in: 1.0, out: 5.0 },
];

export function costUsd(model: ModelId, usage: LLMUsage): number {
  const p = PRICING.find((x) => x.match(model)) ?? { in: 0.5, out: 3.0 };
  return (usage.inputTokens / 1e6) * p.in + (usage.outputTokens / 1e6) * p.out;
}

export const COST_ALERT_USD = 0.05;
