// Rotas de autenticação do responsável (spec 03 §3.1–3.2).
import { Hono } from "hono";
import { z } from "zod";
import { db, newId, nowIso } from "../db.ts";
import { hashPassword, verifyPassword } from "../lib/crypto.ts";
import {
  createSession,
  setSessionCookie,
  clearSessionCookie,
  destroySession,
  requireParent,
  csrfGuard,
} from "../lib/session.ts";
import { readJson, badRequest, conflict, unauthorized, tooMany, type AppEnv } from "../lib/http.ts";
import { rateLimit, resetRateLimit } from "../lib/rateLimit.ts";
import { audit } from "../lib/audit.ts";

const app = new Hono<AppEnv>();
app.use("/api/auth/*", csrfGuard);

const clientIp = (c: { req: { header: (k: string) => string | undefined } }) =>
  c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "local";

const credsSchema = z.object({
  email: z.string().email("e-mail inválido").max(160),
  password: z.string().min(10, "a senha precisa de ao menos 10 caracteres").max(200),
});

// POST /api/auth/register
app.post("/api/auth/register", async (c) => {
  const { email, password } = await readJson(c, credsSchema);
  const normEmail = email.toLowerCase().trim();

  const ip = clientIp(c);
  const rl = rateLimit(`register:${ip}`, 10, 60 * 60);
  if (!rl.allowed) throw tooMany("Muitas tentativas. Tente novamente mais tarde.");

  const exists = db.prepare("SELECT id FROM parents WHERE email = ?").get(normEmail);
  if (exists) throw conflict("email_taken", "Já existe uma conta com este e-mail.");

  const id = newId();
  db.prepare(
    `INSERT INTO parents (id, email, email_verified, password_hash, created_at)
     VALUES (?, ?, 0, ?, ?)`,
  ).run(id, normEmail, await hashPassword(password), nowIso());

  const sid = createSession(id, c.req.header("user-agent"));
  setSessionCookie(c, sid);
  audit(`parent:${id}`, "register", `parent:${id}`, { email: normEmail });

  // Verificação de e-mail é não-bloqueante no P1 (spec 03 §3.1).
  return c.json({ parent: { id, email: normEmail, email_verified: false }, needs_consent: true }, 201);
});

// POST /api/auth/login
app.post("/api/auth/login", async (c) => {
  const { email, password } = await readJson(c, credsSchema);
  const normEmail = email.toLowerCase().trim();
  const ip = clientIp(c);
  const key = `login:${normEmail}:${ip}`;
  const rl = rateLimit(key, 5, 15 * 60); // 5 tentativas / 15 min
  if (!rl.allowed) throw tooMany("Muitas tentativas de login. Aguarde 15 minutos.");

  const parent = db
    .prepare("SELECT id, email, password_hash, email_verified FROM parents WHERE email = ? AND deleted_at IS NULL")
    .get(normEmail) as { id: string; email: string; password_hash: string; email_verified: number } | undefined;

  const ok = parent ? await verifyPassword(password, parent.password_hash) : false;
  if (!parent || !ok) {
    audit(`ip:${ip}`, "login_failed", null, { email: normEmail });
    throw unauthorized("E-mail ou senha incorretos.");
  }

  resetRateLimit(key);
  const sid = createSession(parent.id, c.req.header("user-agent"));
  setSessionCookie(c, sid);
  audit(`parent:${parent.id}`, "login", `parent:${parent.id}`);
  return c.json({
    parent: { id: parent.id, email: parent.email, email_verified: !!parent.email_verified },
  });
});

// POST /api/auth/logout
app.post("/api/auth/logout", requireParent, async (c) => {
  const sid = c.get("sessionId");
  destroySession(sid);
  clearSessionCookie(c);
  audit(`parent:${c.get("parentId")}`, "logout");
  return c.json({ ok: true });
});

export default app;
