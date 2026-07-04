// Carrega .env (sem dependência externa) e expõe a configuração tipada.
// IMPORTA ESTE MÓDULO ANTES de qualquer coisa que leia process.env.
import { readFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";

function loadDotEnv(file = ".env") {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) return;
  const raw = readFileSync(path, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    // remove aspas envolventes
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadDotEnv();

const isProd = process.env.NODE_ENV === "production";

function required(key: string, devFallback?: () => string): string {
  const v = process.env[key];
  if (v && v.length > 0) return v;
  if (!isProd && devFallback) {
    const generated = devFallback();
    // eslint-disable-next-line no-console
    console.warn(`⚠️  ${key} ausente — usando valor efêmero de DEV. Defina no .env para produção.`);
    return generated;
  }
  if (isProd) throw new Error(`Config obrigatória ausente em produção: ${key}`);
  return "";
}

export const env = {
  isProd,
  port: Number(process.env.PORT || 8787),
  databasePath: process.env.DATABASE_PATH || "./data/bearminds.db",
  publicOrigin: process.env.PUBLIC_ORIGIN || "http://localhost:5173",
  policyVersion: process.env.POLICY_VERSION || "2026-07-01",

  // LLM — padrão: Gemma local (MLX no HULK), OpenAI-compatible. Cloud (Gemini/Claude) só se configurado.
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  // Endpoint OpenAI-compatible do Gemma/MLX (base termina em /v1). Vazio = sem LLM local.
  llmBaseUrl: process.env.LLM_BASE_URL || "http://127.0.0.1:8081/v1",
  llmApiKey: process.env.LLM_API_KEY || "",                       // Bearer opcional (tunnel autenticado)
  llmCfClientId: process.env.LLM_CF_ACCESS_CLIENT_ID || "",       // Cloudflare Access service token (id)
  llmCfClientSecret: process.env.LLM_CF_ACCESS_CLIENT_SECRET || "", // Cloudflare Access service token (secret)
  llmTimeoutMs: Number(process.env.LLM_TIMEOUT_MS || 120000),
  modelDefault: process.env.MODEL_DEFAULT || "mlx-community/gemma-3-4b-it-4bit",
  modelContent: process.env.MODEL_CONTENT || "mlx-community/gemma-3-4b-it-4bit",
  modelMathHard: process.env.MODEL_MATH_HARD || "mlx-community/gemma-3-4b-it-4bit",

  // Segredos (dev gera efêmeros; produção exige)
  piiEncryptionKey: required("PII_ENCRYPTION_KEY", () => randomBytes(16).toString("hex")),
  sessionPepper: required("SESSION_PEPPER", () => randomBytes(16).toString("hex")),

  // E-mail (opcional)
  smtpUrl: process.env.SMTP_URL || "",
  emailFrom: process.env.EMAIL_FROM || "BearMinds <no-reply@bearminds.cybersphere.com.br>",

  // Gate de validação por Sign in with Apple (substitui o Cloudflare Access OTP).
  // GATE_MODE=apple liga; vazio/"off" desliga (produto público usa só a auth de parent).
  gateMode: process.env.GATE_MODE || "off",
  appleClientId: process.env.APPLE_CLIENT_ID || "com.cybersphere.bearminds.signin", // Services ID
  appleTeamId: process.env.APPLE_TEAM_ID || "Z5H2FL2237",
  appleKeyId: process.env.APPLE_KEY_ID || "",
  applePrivateKeyPath: process.env.APPLE_PRIVATE_KEY_PATH || "",
  appleRedirectUri:
    process.env.APPLE_REDIRECT_URI || "https://bearminds.cybersphere.com.br/api/auth/apple/callback",
  gateAllowlist: (process.env.GATE_ALLOWLIST || "cleber.visconti@icloud.com")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  // Só é obrigatório quando o gate Apple está ligado; senão usa efêmero (não quebra o boot em prod).
  gateCookieSecret:
    process.env.GATE_COOKIE_SECRET ||
    (process.env.GATE_MODE === "apple"
      ? required("GATE_COOKIE_SECRET", () => randomBytes(16).toString("hex"))
      : randomBytes(16).toString("hex")),
};

export const llmConfigured = Boolean(env.geminiApiKey || env.anthropicApiKey || env.llmBaseUrl);
