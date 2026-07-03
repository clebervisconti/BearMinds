import type { MiddlewareHandler } from "hono";
import { env } from "../env.ts";

// Cabeçalhos de segurança (spec 09.2). Aplicados a todas as respostas da API
// e, quando o Node serve o dist/ (npm start), também ao HTML do app.
// Em produção o OLS deve replicar estes headers para os assets estáticos.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  // Tailwind/Vite podem injetar <style> inline no build → permitido só para estilos.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  // Exploráveis rodam em <iframe sandbox srcDoc> (mesma origem, sem rede) — spec 05.
  "frame-src 'self'",
  "child-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "manifest-src 'self'",
].join("; ");

export const securityHeaders: MiddlewareHandler = async (c, next) => {
  await next();
  c.header("Content-Security-Policy", CSP);
  c.header("X-Frame-Options", "DENY");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "strict-origin");
  c.header("Cross-Origin-Opener-Policy", "same-origin");
  c.header("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  if (env.isProd) {
    c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
};
