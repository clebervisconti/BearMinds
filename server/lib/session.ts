// Sessões por cookie httpOnly + middleware de autenticação/consentimento (spec 03).
import type { MiddlewareHandler } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { db, newId, nowIso } from "../db.ts";
import { env } from "../env.ts";
import { newSessionId } from "./crypto.ts";
import { forbidden, unauthorized, type AppEnv } from "./http.ts";
import type { ConsentScope } from "../../shared/contracts.ts";

const COOKIE = "bm_session";
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias (sliding)

export function createSession(parentId: string, userAgent?: string): string {
  const id = newSessionId();
  db.prepare(
    `INSERT INTO sessions (id, parent_id, active_child_id, created_at, expires_at, user_agent)
     VALUES (?, ?, NULL, ?, ?, ?)`,
  ).run(id, parentId, nowIso(), new Date(Date.now() + TTL_MS).toISOString(), userAgent ?? null);
  return id;
}

export function setSessionCookie(c: Parameters<MiddlewareHandler>[0], id: string): void {
  setCookie(c, COOKIE, id, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: "Lax",
    path: "/",
    maxAge: TTL_MS / 1000,
  });
}

export function clearSessionCookie(c: Parameters<MiddlewareHandler>[0]): void {
  deleteCookie(c, COOKIE, { path: "/" });
}

export function destroySession(id: string): void {
  db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
}

interface SessionRow {
  id: string;
  parent_id: string;
  active_child_id: string | null;
  expires_at: string;
}

function loadSession(id: string): SessionRow | null {
  const row = db.prepare("SELECT id, parent_id, active_child_id, expires_at FROM sessions WHERE id = ?").get(id) as
    | SessionRow
    | undefined;
  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    destroySession(id);
    return null;
  }
  return row;
}

// Exige responsável autenticado. Popula c.var e faz sliding expiry.
export const requireParent: MiddlewareHandler<AppEnv> = async (c, next) => {
  const id = getCookie(c, COOKIE);
  const session = id ? loadSession(id) : null;
  if (!session) throw unauthorized();
  // sliding expiry
  db.prepare("UPDATE sessions SET expires_at = ? WHERE id = ?").run(
    new Date(Date.now() + TTL_MS).toISOString(),
    session.id,
  );
  c.set("sessionId", session.id);
  c.set("parentId", session.parent_id);
  c.set("activeChildId", session.active_child_id);
  await next();
};

// CSRF: cookie SameSite=Lax + header custom em rotas mutantes (spec 03 §Segurança).
export const csrfGuard: MiddlewareHandler = async (c, next) => {
  const method = c.req.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    if (c.req.header("X-BM-Client") !== "pwa") {
      throw forbidden("csrf", "Requisição bloqueada (origem não confiável).");
    }
  }
  await next();
};

export function setActiveChild(sessionId: string, childId: string | null): void {
  db.prepare("UPDATE sessions SET active_child_id = ? WHERE id = ?").run(childId, sessionId);
}

// Verifica se um child pertence ao responsável autenticado (e não foi deletado).
export function ownChildOrThrow(parentId: string, childId: string): void {
  const row = db
    .prepare("SELECT id FROM children WHERE id = ? AND parent_id = ? AND deleted_at IS NULL")
    .get(childId, parentId);
  if (!row) throw forbidden("not_your_child", "Perfil não encontrado para esta conta.");
}

// ---- Papéis de staff (spec 13.1) ----
export type StaffRole = "guardian" | "professor" | "tutor" | "institution_admin" | "platform_admin";

export function parentRole(parentId: string): { role: StaffRole; institutionId: string | null } {
  const row = db
    .prepare("SELECT COALESCE(role,'guardian') AS role, staff_institution_id FROM parents WHERE id = ?")
    .get(parentId) as { role: StaffRole; staff_institution_id: string | null } | undefined;
  return { role: row?.role ?? "guardian", institutionId: row?.staff_institution_id ?? null };
}

/** Exige um dos papéis (platform_admin sempre passa). Usar APÓS requireParent. */
export const requireRole = (...roles: StaffRole[]): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const { role } = parentRole(c.get("parentId"));
    if (role !== "platform_admin" && !roles.includes(role)) {
      throw forbidden("staff_only", "Você não tem permissão para esta área.");
    }
    await next();
  };

/** Escopo de instituição do staff: platform_admin acessa qualquer; demais só a própria. */
export function staffInstitutionOrThrow(parentId: string, institutionId: string): void {
  const { role, institutionId: mine } = parentRole(parentId);
  if (role === "platform_admin") return;
  if (!mine || mine !== institutionId) {
    throw forbidden("wrong_institution", "Este conteúdo pertence a outra instituição.");
  }
}

// Consentimento vigente (granted e não revogado) para um escopo/child.
export function hasConsent(parentId: string, childId: string, scope: ConsentScope): boolean {
  const row = db
    .prepare(
      `SELECT granted, revoked_at FROM consents
       WHERE parent_id = ? AND child_id = ? AND scope = ?
       ORDER BY granted_at DESC LIMIT 1`,
    )
    .get(parentId, childId, scope) as { granted: number; revoked_at: string | null } | undefined;
  return !!row && row.granted === 1 && !row.revoked_at;
}
