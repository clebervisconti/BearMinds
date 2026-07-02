// Abstração model-agnostic (moat: LLM é commodity alugada atrás desta interface).
// Drivers: Gemini (@google/genai) e Claude (@anthropic-ai/sdk). Clientes lazy —
// importar este módulo nunca falha por falta de chave; só a chamada real exige a chave.
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import { env } from "../env.ts";

export type ModelId = string;

export interface LLMRequest {
  model: ModelId;
  system: string;
  user: string;
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
}
export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
}
export interface LLMResponse {
  text: string;
  model: ModelId;
  usage: LLMUsage;
}

interface Driver {
  matches(model: ModelId): boolean;
  complete(req: LLMRequest): Promise<LLMResponse>;
}

class GeminiDriver implements Driver {
  private client?: GoogleGenAI;
  private get c(): GoogleGenAI {
    if (!this.client) {
      if (!env.geminiApiKey) throw new Error("GEMINI_API_KEY ausente — geração indisponível.");
      this.client = new GoogleGenAI({ apiKey: env.geminiApiKey });
    }
    return this.client;
  }
  matches(m: ModelId) {
    return m.startsWith("gemini");
  }
  async complete(req: LLMRequest): Promise<LLMResponse> {
    const res = await this.c.models.generateContent({
      model: req.model,
      contents: `${req.system}\n\n${req.user}`,
      config: {
        maxOutputTokens: req.maxTokens ?? 2048,
        temperature: req.temperature ?? 0.4,
        responseMimeType: req.json ? "application/json" : "text/plain",
      },
    });
    const u = res.usageMetadata;
    return {
      text: res.text ?? "",
      model: req.model,
      usage: {
        inputTokens: u?.promptTokenCount ?? 0,
        outputTokens: u?.candidatesTokenCount ?? 0,
      },
    };
  }
}

class ClaudeDriver implements Driver {
  private client?: Anthropic;
  private get c(): Anthropic {
    if (!this.client) {
      if (!env.anthropicApiKey) throw new Error("ANTHROPIC_API_KEY ausente — escalonamento indisponível.");
      this.client = new Anthropic({ apiKey: env.anthropicApiKey });
    }
    return this.client;
  }
  matches(m: ModelId) {
    return m.startsWith("claude");
  }
  async complete(req: LLMRequest): Promise<LLMResponse> {
    const msg = await this.c.messages.create({
      model: req.model,
      system: req.system + (req.json ? "\nResponda SOMENTE com JSON válido, sem cercas de código." : ""),
      max_tokens: req.maxTokens ?? 2048,
      temperature: req.temperature ?? 0.4,
      messages: [{ role: "user", content: req.user }],
    });
    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    return {
      text,
      model: req.model,
      usage: { inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens },
    };
  }
}

const drivers: Driver[] = [new GeminiDriver(), new ClaudeDriver()];

export async function llm(req: LLMRequest): Promise<LLMResponse> {
  const driver = drivers.find((d) => d.matches(req.model));
  if (!driver) throw new Error(`Sem driver para o modelo ${req.model}`);
  return driver.complete(req);
}

// Extrai JSON de uma resposta que pode vir cercada por ```json ... ```.
export function parseJSON<T>(text: string): T {
  let clean = text.trim();
  clean = clean.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  // fallback: pega do primeiro { ou [ até o último } ou ]
  if (!(clean.startsWith("{") || clean.startsWith("["))) {
    const s = clean.search(/[[{]/);
    const e = Math.max(clean.lastIndexOf("}"), clean.lastIndexOf("]"));
    if (s !== -1 && e !== -1 && e > s) clean = clean.slice(s, e + 1);
  }
  return JSON.parse(clean) as T;
}
