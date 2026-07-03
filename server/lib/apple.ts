// Sign in with Apple (web OAuth) — client_secret (ES256), authorize URL, code→token, id_token verify.
// Pura node:crypto (sem deps novas). Usado pelo gate de validação (server/lib/gate.ts).
import { readFileSync } from "node:fs";
import { createSign, createVerify, createPublicKey, type KeyObject, type JsonWebKey as NodeJWK } from "node:crypto";
import { env } from "../env.ts";

const APPLE_ISS = "https://appleid.apple.com";
const b64url = (b: Buffer) => b.toString("base64url");

function signES256(header: object, payload: object, keyPem: string): string {
  const data = `${b64url(Buffer.from(JSON.stringify(header)))}.${b64url(Buffer.from(JSON.stringify(payload)))}`;
  const sig = createSign("SHA256").update(data).end().sign({ key: keyPem, dsaEncoding: "ieee-p1363" });
  return `${data}.${b64url(sig)}`;
}

// client_secret exigido pela Apple: JWT ES256 assinado com a chave .p8 (val. ≤ 6 meses).
export function appleClientSecret(): string {
  const key = readFileSync(env.applePrivateKeyPath, "utf8");
  const now = Math.floor(Date.now() / 1000);
  return signES256(
    { alg: "ES256", kid: env.appleKeyId, typ: "JWT" },
    { iss: env.appleTeamId, iat: now, exp: now + 60 * 60, aud: APPLE_ISS, sub: env.appleClientId },
    key,
  );
}

export function appleAuthorizeUrl(state: string, nonce: string): string {
  const p = new URLSearchParams({
    response_type: "code",
    response_mode: "form_post",
    client_id: env.appleClientId,
    redirect_uri: env.appleRedirectUri,
    scope: "email",
    state,
    nonce,
  });
  return `${APPLE_ISS}/auth/authorize?${p.toString()}`;
}

export async function appleExchangeCode(code: string): Promise<{ id_token: string }> {
  const body = new URLSearchParams({
    client_id: env.appleClientId,
    client_secret: appleClientSecret(),
    code,
    grant_type: "authorization_code",
    redirect_uri: env.appleRedirectUri,
  });
  const res = await fetch(`${APPLE_ISS}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`apple token ${res.status}: ${await res.text()}`);
  return (await res.json()) as { id_token: string };
}

// JWKS da Apple (cache leve; recarrega se o kid não bater).
let jwksCache: { kid: string }[] | null = null;
async function applePublicKey(kid: string): Promise<KeyObject> {
  const fetchKeys = async () => {
    const r = await fetch(`${APPLE_ISS}/auth/keys`);
    jwksCache = ((await r.json()) as { keys: { kid: string }[] }).keys;
  };
  if (!jwksCache) await fetchKeys();
  let jwk = jwksCache!.find((k) => k.kid === kid);
  if (!jwk) {
    await fetchKeys();
    jwk = jwksCache!.find((k) => k.kid === kid);
  }
  if (!jwk) throw new Error("apple jwks: kid não encontrado");
  return createPublicKey({ key: jwk as unknown as NodeJWK, format: "jwk" });
}

export interface AppleClaims {
  sub: string;
  email?: string;
  email_verified?: boolean;
}

export async function appleVerifyIdToken(idToken: string, nonce: string): Promise<AppleClaims> {
  const [h, p, s] = idToken.split(".");
  if (!h || !p || !s) throw new Error("id_token malformado");
  const header = JSON.parse(Buffer.from(h, "base64url").toString()) as { kid: string };
  const payload = JSON.parse(Buffer.from(p, "base64url").toString()) as Record<string, unknown>;
  const key = await applePublicKey(header.kid);
  const ok = createVerify("SHA256").update(`${h}.${p}`).end().verify(key, Buffer.from(s, "base64url"));
  if (!ok) throw new Error("assinatura do id_token inválida");
  if (payload.iss !== APPLE_ISS) throw new Error("iss inválido");
  if (payload.aud !== env.appleClientId) throw new Error("aud inválido");
  if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) throw new Error("id_token expirado");
  if (nonce && payload.nonce !== nonce) throw new Error("nonce inválido");
  return {
    sub: String(payload.sub),
    email: payload.email ? String(payload.email) : undefined,
    email_verified: payload.email_verified === true || payload.email_verified === "true",
  };
}
