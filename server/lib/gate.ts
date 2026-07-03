// Gate de validação por Sign in with Apple (allowlist). Camada OPCIONAL na frente de tudo,
// separada da auth do produto (parent email/senha). Ativa só com GATE_MODE=apple.
// Substitui o Cloudflare Access OTP: só e-mails do allowlist entram, via Apple.
import type { Hono, MiddlewareHandler } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { env } from "../env.ts";
import { appleAuthorizeUrl, appleExchangeCode, appleVerifyIdToken } from "./apple.ts";
import { logger } from "../logger.ts";
import type { AppEnv } from "./http.ts";

const GATE_COOKIE = "bm_gate";
const b64url = (b: Buffer) => b.toString("base64url");

export const gateEnabled = () => env.gateMode === "apple";

// ---- cookie assinado (HMAC) {email, exp} ----
function signCookie(payload: object): string {
  const p = b64url(Buffer.from(JSON.stringify(payload)));
  const mac = createHmac("sha256", env.gateCookieSecret).update(p).digest("base64url");
  return `${p}.${mac}`;
}
function verifyCookie(token: string | undefined): { email: string; exp: number } | null {
  if (!token) return null;
  const [p, mac] = token.split(".");
  if (!p || !mac) return null;
  const expected = createHmac("sha256", env.gateCookieSecret).update(p).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const o = JSON.parse(Buffer.from(p, "base64url").toString()) as { email: string; exp: number };
    if (o.exp < Date.now()) return null;
    return o;
  } catch {
    return null;
  }
}

// ---- state OAuth em memória (evita problemas de SameSite no form_post cross-site) ----
const states = new Map<string, { nonce: string; exp: number }>();
function putState(): { state: string; nonce: string } {
  const state = randomBytes(16).toString("hex");
  const nonce = randomBytes(16).toString("hex");
  states.set(state, { nonce, exp: Date.now() + 10 * 60_000 });
  return { state, nonce };
}
function takeState(state: string): { nonce: string } | null {
  const s = states.get(state);
  if (!s) return null;
  states.delete(state);
  if (s.exp < Date.now()) return null;
  return { nonce: s.nonce };
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of states) if (v.exp < now) states.delete(k);
}, 5 * 60_000).unref?.();

function allowed(email: string | undefined): boolean {
  return !!email && env.gateAllowlist.map((e) => e.toLowerCase()).includes(email.toLowerCase());
}

// ---- middleware: aplica ANTES de tudo (rotas + estático) quando o gate está ligado ----
export const gateMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!gateEnabled()) return next();
  const path = c.req.path;
  // sempre liberado: fluxo Apple, health e verificação de domínio da Apple
  if (
    path.startsWith("/api/auth/apple/") ||
    path === "/api/health" ||
    path.startsWith("/.well-known/")
  ) {
    return next();
  }
  const g = verifyCookie(getCookie(c, GATE_COOKIE));
  if (g && allowed(g.email)) return next();

  const accept = c.req.header("accept") || "";
  if (accept.includes("text/html")) return c.redirect("/api/auth/apple/login");
  return c.json(
    { error: { code: "gate", message: "Acesso restrito à validação. Entre com Apple." } },
    401,
  );
};

// ---- rotas do fluxo Apple ----
export function mountGate(app: Hono<AppEnv>): void {
  app.get("/api/auth/apple/login", (c) => {
    if (!gateEnabled()) return c.redirect("/");
    const { state, nonce } = putState();
    return c.redirect(appleAuthorizeUrl(state, nonce));
  });

  app.post("/api/auth/apple/callback", async (c) => {
    try {
      const form = await c.req.parseBody();
      const code = String(form.code || "");
      const state = String(form.state || "");
      const st = takeState(state);
      if (!st || !code) return c.html(page("Sessão expirada", "Tente entrar novamente."), 400);

      const { id_token } = await appleExchangeCode(code);
      const claims = await appleVerifyIdToken(id_token, st.nonce);
      if (!allowed(claims.email)) {
        logger.warn({ email: claims.email }, "gate: apple login negado (fora do allowlist)");
        return c.html(page("Acesso negado", "Esta conta Apple não está na lista de validação."), 403);
      }
      setCookie(c, GATE_COOKIE, signCookie({ email: claims.email, exp: Date.now() + 24 * 3600 * 1000 }), {
        httpOnly: true,
        secure: env.isProd,
        sameSite: "Lax",
        path: "/",
        maxAge: 24 * 3600,
      });
      logger.info({ email: claims.email }, "gate: apple login OK");
      return c.redirect("/");
    } catch (e) {
      logger.error({ err: String(e) }, "gate: callback apple falhou");
      return c.html(page("Erro no login", "Não foi possível validar com a Apple. Tente novamente."), 500);
    }
  });

  app.post("/api/auth/apple/logout", (c) => {
    deleteCookie(c, GATE_COOKIE, { path: "/" });
    return c.json({ ok: true });
  });
}

function page(title: string, msg: string): string {
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<div style="font-family:system-ui;max-width:420px;margin:15vh auto;text-align:center;color:#1a1e2b">
<div style="font-size:3rem">🐻</div><h2>${title}</h2><p style="color:#6b7280">${msg}</p>
<a href="/api/auth/apple/login" style="display:inline-block;margin-top:1rem;padding:.7rem 1.2rem;background:#111;color:#fff;border-radius:10px;text-decoration:none"> Entrar com Apple</a>
</div>`;
}
