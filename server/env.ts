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

  // LLM
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  modelDefault: process.env.MODEL_DEFAULT || "gemini-2.5-flash-lite",
  modelContent: process.env.MODEL_CONTENT || "gemini-2.5-flash",
  modelMathHard: process.env.MODEL_MATH_HARD || "claude-haiku-4-5",

  // Segredos (dev gera efêmeros; produção exige)
  piiEncryptionKey: required("PII_ENCRYPTION_KEY", () => randomBytes(16).toString("hex")),
  sessionPepper: required("SESSION_PEPPER", () => randomBytes(16).toString("hex")),

  // E-mail (opcional)
  smtpUrl: process.env.SMTP_URL || "",
  emailFrom: process.env.EMAIL_FROM || "BearMinds <no-reply@bearminds.cybersphere.com.br>",
};

export const llmConfigured = Boolean(env.geminiApiKey || env.anthropicApiKey);
