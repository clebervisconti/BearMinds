import { env } from "../env.ts";
import { getSetting } from "../lib/settings.ts";
import type { ModelId } from "./provider.ts";

export type TaskKind = "decompose" | "resolve" | "lesson" | "explorable" | "quiz" | "math_check";
export type Provider = "local" | "gemini" | "claude";

export interface AiModel {
  id: string;
  label: string;
  provider: Provider;
  note?: string;
}

// Catálogo de modelos selecionáveis pelo admin. O Gemma local é o padrão.
export const AI_MODELS: AiModel[] = [
  { id: "mlx-community/gemma-3-4b-it-4bit", label: "Gemma 3 4B", provider: "local", note: "Local no HULK (MLX) · privado, sem custo de API" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "gemini", note: "Google · mais forte que o Gemma, uso de API" },
  { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite", provider: "gemini", note: "Google · rápido e barato" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "gemini", note: "Google · máxima qualidade, mais caro/lento" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", provider: "claude", note: "Anthropic" },
];

export const DEFAULT_MODEL: ModelId = env.modelContent; // env default = Gemma local

function providerConfigured(p: Provider): boolean {
  return p === "local" ? !!env.llmBaseUrl : p === "gemini" ? !!env.geminiApiKey : !!env.anthropicApiKey;
}

/** Modelos cujo provedor está configurado (chave/endpoint presente). */
export function availableModels(): (AiModel & { default: boolean })[] {
  return AI_MODELS.filter((m) => providerConfigured(m.provider)).map((m) => ({ ...m, default: m.id === DEFAULT_MODEL }));
}

/** Modelo ativo: escolha do admin (app_settings) se válida+disponível, senão o padrão (Gemma). */
export function activeModel(): ModelId {
  const sel = getSetting("ai_model");
  const selMeta = sel ? AI_MODELS.find((m) => m.id === sel) : undefined;
  if (sel && selMeta && providerConfigured(selMeta.provider)) return sel;
  const def = AI_MODELS.find((m) => m.id === DEFAULT_MODEL);
  if ((!def || providerConfigured(def.provider)) && DEFAULT_MODEL) return DEFAULT_MODEL;
  return availableModels()[0]?.id ?? DEFAULT_MODEL;
}

// Um único modelo para toda a geração (escolha do admin). `task`/`hard` mantidos por compat.
export function pickModel(_task: TaskKind, _opts?: { hard?: boolean }): ModelId {
  return activeModel();
}
