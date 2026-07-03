// Primitivas de segurança: hash de senha (bcrypt+pepper), AES-256-GCM p/ PII, ids de sessão.
import bcrypt from "bcryptjs";
import { createHash, createCipheriv, createDecipheriv, randomBytes, createHmac } from "node:crypto";
import { env } from "../env.ts";

const BCRYPT_COST = 12;

// Pré-hash com HMAC(pepper) evita o truncamento de 72 bytes do bcrypt e adiciona pepper.
function pepper(pw: string): string {
  return createHmac("sha256", env.sessionPepper).update(pw).digest("hex");
}

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pepper(pw), BCRYPT_COST);
}

export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(pepper(pw), hash);
  } catch {
    return false;
  }
}

// Chave AES-256 derivada por SHA-256 do material de env (aceita qualquer comprimento de hex).
const AES_KEY = createHash("sha256").update(env.piiEncryptionKey).digest();

export function encryptPII(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", AES_KEY, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

export function decryptPII(enc: string): string {
  const raw = Buffer.from(enc, "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ct = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", AES_KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

export function newSessionId(): string {
  return randomBytes(16).toString("hex"); // 128-bit
}
