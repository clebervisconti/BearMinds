// Perfis, consentimento, gate do responsável, exportação e deleção (spec 03 + 09).
import { Hono } from "hono";
import { z } from "zod";
import { db, newId, nowIso } from "../db.ts";
import { env } from "../env.ts";
import { verifyPassword, decryptPII } from "../lib/crypto.ts";
import {
  requireParent,
  csrfGuard,
  setActiveChild,
  ownChildOrThrow,
  destroySession,
  clearSessionCookie,
} from "../lib/session.ts";
import { readJson, badRequest, forbidden, notFound, unprocessable, conflict, type AppEnv } from "../lib/http.ts";
import { audit } from "../lib/audit.ts";
import {
  REQUIRED_CONSENTS,
  ALL_CONSENTS,
  MAX_CHILDREN,
  MIN_AGE,
  MAX_AGE,
  ageFromBirthYear,
  ageBandFromAge,
} from "../lib/domain.ts";
import type { Child, ConsentScope, ConsentState, MeResponse } from "../../shared/contracts.ts";

const app = new Hono<AppEnv>();
app.use("/api/me", csrfGuard);
app.use("/api/me/*", csrfGuard);
app.use("/api/children", csrfGuard);
app.use("/api/consents", csrfGuard);

// ---------- helpers ----------
interface ChildRow {
  id: string; display_name: string; birth_year: number; grade: string; age_band: string;
  institution_id: string | null; class_id: string | null; subjects_json: string | null;
  priority_subject: string | null; avatar_seed: string | null;
  kind: string | null; leaderboard_hidden: number | null;
}

function rowToChild(r: ChildRow): Child {
  return {
    id: r.id,
    display_name: r.display_name,
    birth_year: r.birth_year,
    grade: r.grade,
    age_band: r.age_band as Child["age_band"],
    institution_id: r.institution_id,
    class_id: r.class_id,
    subjects: r.subjects_json ? (JSON.parse(r.subjects_json) as string[]) : [],
    priority_subject: r.priority_subject,
    avatar_seed: r.avatar_seed,
    kind: (r.kind ?? "child") as Child["kind"],
    leaderboard_hidden: r.leaderboard_hidden === 1,
  };
}

function getChildren(parentId: string): Child[] {
  const rows = db
    .prepare(
      `SELECT id, display_name, birth_year, grade, age_band, institution_id, class_id,
              subjects_json, priority_subject, avatar_seed, kind, leaderboard_hidden
       FROM children WHERE parent_id = ? AND deleted_at IS NULL ORDER BY created_at`,
    )
    .all(parentId) as ChildRow[];
  return rows.map(rowToChild);
}

function consentStateFor(parentId: string, childId: string): ConsentState[] {
  return ALL_CONSENTS.map((scope) => {
    const row = db
      .prepare(
        `SELECT granted, revoked_at, policy_version FROM consents
         WHERE parent_id = ? AND child_id = ? AND scope = ? ORDER BY granted_at DESC LIMIT 1`,
      )
      .get(parentId, childId, scope) as
      | { granted: number; revoked_at: string | null; policy_version: string }
      | undefined;
    return {
      scope,
      granted: !!row && row.granted === 1 && !row.revoked_at,
      policy_version: row?.policy_version ?? env.policyVersion,
    };
  });
}

function grantConsent(parentId: string, childId: string, scope: ConsentScope): void {
  db.prepare(
    `INSERT INTO consents (id, parent_id, child_id, scope, granted, policy_version, granted_at)
     VALUES (?, ?, ?, ?, 1, ?, ?)`,
  ).run(newId(), parentId, childId, scope, env.policyVersion, nowIso());
}

function revokeConsent(parentId: string, childId: string, scope: ConsentScope): void {
  db.prepare(
    `UPDATE consents SET revoked_at = ?
     WHERE parent_id = ? AND child_id = ? AND scope = ? AND revoked_at IS NULL`,
  ).run(nowIso(), parentId, childId, scope);
}

function activeChildId(parentId: string, sessionActive: string | null): string | null {
  if (sessionActive) return sessionActive;
  const first = db
    .prepare("SELECT id FROM children WHERE parent_id = ? AND deleted_at IS NULL ORDER BY created_at LIMIT 1")
    .get(parentId) as { id: string } | undefined;
  return first?.id ?? null;
}

function buildMe(parentId: string, sessionActive: string | null): MeResponse {
  const parent = db
    .prepare("SELECT id, email, email_verified, COALESCE(role,'guardian') AS role, staff_institution_id FROM parents WHERE id = ?")
    .get(parentId) as { id: string; email: string; email_verified: number; role: MeResponse["parent"]["role"]; staff_institution_id: string | null };
  const children = getChildren(parentId);
  const active = activeChildId(parentId, sessionActive);
  const consents = active ? consentStateFor(parentId, active) : [];
  const missingRequired = active
    ? REQUIRED_CONSENTS.some((s) => !consents.find((c) => c.scope === s && c.granted))
    : false;
  return {
    parent: {
      id: parent.id,
      email: parent.email,
      email_verified: !!parent.email_verified,
      role: parent.role,
      staff_institution_id: parent.staff_institution_id,
    },
    children,
    consents,
    active_child_id: active,
    policy_version: env.policyVersion,
    needs_consent: children.length === 0 || missingRequired,
  };
}

// Deleção (soft) — reutilizada por /api/me/delete e revogação de 'account' (spec 02 §Rules).
function softDeleteAccount(parentId: string): void {
  const ts = nowIso();
  db.transaction(() => {
    db.prepare("UPDATE parents SET deleted_at = ? WHERE id = ?").run(ts, parentId);
    db.prepare("UPDATE children SET deleted_at = ? WHERE parent_id = ? AND deleted_at IS NULL").run(ts, parentId);
    db.prepare("UPDATE consents SET revoked_at = ? WHERE parent_id = ? AND revoked_at IS NULL").run(ts, parentId);
    db.prepare("DELETE FROM sessions WHERE parent_id = ?").run(parentId);
  })();
  audit(`parent:${parentId}`, "account_delete_requested", `parent:${parentId}`);
}

// ---------- GET /api/me ----------
app.get("/api/me", requireParent, (c) => {
  return c.json(buildMe(c.get("parentId"), c.get("activeChildId")));
});

// ---------- POST /api/children ----------
const childSchema = z.object({
  display_name: z.string().trim().min(1, "informe um apelido").max(40),
  birth_year: z.number().int().gte(1990).lte(new Date().getFullYear()),
  grade: z.string().trim().min(2).max(8),
  institution_id: z.string().max(60).nullish(),
  class_id: z.string().max(30).nullish(),
  subjects: z.array(z.string().max(40)).max(20).optional(),
  priority_subject: z.string().max(40).nullish(),
  avatar_seed: z.string().max(40).nullish(),
  consents: z
    .object({
      account: z.boolean(),
      ai_generation: z.boolean(),
      progress_tracking: z.boolean(),
      email_updates: z.boolean().optional(),
    })
    .strict(),
});

app.post("/api/children", requireParent, async (c) => {
  const parentId = c.get("parentId");
  const body = await readJson(c, childSchema);

  const count = db
    .prepare("SELECT COUNT(*) n FROM children WHERE parent_id = ? AND deleted_at IS NULL")
    .get(parentId) as { n: number };
  if (count.n >= MAX_CHILDREN) throw forbidden("max_children", `Limite de ${MAX_CHILDREN} perfis por conta.`);

  const age = ageFromBirthYear(body.birth_year);
  if (age < MIN_AGE) throw unprocessable("too_young", `O BearMinds atende estudantes a partir de ${MIN_AGE} anos.`);
  if (age > MAX_AGE) throw unprocessable("age_range", `O BearMinds atende estudantes de ${MIN_AGE} a ${MAX_AGE} anos.`);
  const age_band = ageBandFromAge(age);

  // Gate LGPD: os consentimentos obrigatórios devem vir concedidos (spec 03 §3.3).
  for (const s of REQUIRED_CONSENTS) {
    if (!body.consents[s]) throw forbidden("consent_required", "É necessário conceder os consentimentos obrigatórios.");
  }

  if (body.institution_id) {
    const inst = db.prepare("SELECT id FROM institutions WHERE id = ? AND active = 1").get(body.institution_id);
    if (!inst) throw badRequest("bad_institution", "Instituição inválida.");
    if (!body.class_id) throw badRequest("bad_class", "Selecione a turma da instituição.");
  }

  const childId = newId();
  db.transaction(() => {
    db.prepare(
      `INSERT INTO children (id, parent_id, display_name, birth_year, grade, age_band,
         institution_id, class_id, subjects_json, priority_subject, avatar_seed, created_at)
       VALUES (@id,@parent_id,@display_name,@birth_year,@grade,@age_band,
         @institution_id,@class_id,@subjects_json,@priority_subject,@avatar_seed,@created_at)`,
    ).run({
      id: childId,
      parent_id: parentId,
      display_name: body.display_name,
      birth_year: body.birth_year,
      grade: body.grade,
      age_band,
      institution_id: body.institution_id ?? null,
      class_id: body.class_id ?? null,
      subjects_json: body.subjects ? JSON.stringify(body.subjects) : null,
      priority_subject: body.priority_subject ?? null,
      avatar_seed: body.avatar_seed ?? null,
      created_at: nowIso(),
    });
    for (const s of ALL_CONSENTS) {
      if (body.consents[s as keyof typeof body.consents]) grantConsent(parentId, childId, s);
    }
  })();

  setActiveChild(c.get("sessionId"), childId);
  audit(`parent:${parentId}`, "child_create", `child:${childId}`, { age_band });
  return c.json(buildMe(parentId, childId), 201);
});

// ---------- POST /api/me/self-profile (spec 12.1: o titular estuda) ----------
const selfSchema = z.object({
  display_name: z.string().trim().min(1).max(40).optional(),
  birth_year: z.number().int().gte(1990).lte(new Date().getFullYear()),
  grade: z.string().trim().min(2).max(8),
  institution_id: z.string().max(60).nullish(),
  class_id: z.string().max(30).nullish(),
  subjects: z.array(z.string().max(40)).max(20).optional(),
  priority_subject: z.string().max(40).nullish(),
});

app.post("/api/me/self-profile", requireParent, async (c) => {
  const parentId = c.get("parentId");
  const body = await readJson(c, selfSchema);

  const selfExists = db
    .prepare("SELECT id FROM children WHERE parent_id = ? AND kind = 'self' AND deleted_at IS NULL")
    .get(parentId);
  if (selfExists) throw conflict("self_exists", "Você já tem um perfil de estudos próprio.");

  const count = db
    .prepare("SELECT COUNT(*) n FROM children WHERE parent_id = ? AND deleted_at IS NULL")
    .get(parentId) as { n: number };
  if (count.n >= MAX_CHILDREN) throw forbidden("max_children", `Limite de ${MAX_CHILDREN} perfis por conta.`);

  const age = ageFromBirthYear(body.birth_year);
  if (age < MIN_AGE || age > MAX_AGE) {
    throw unprocessable("age_range", `O BearMinds atende estudantes de ${MIN_AGE} a ${MAX_AGE} anos.`);
  }
  const age_band = ageBandFromAge(age);

  if (body.institution_id) {
    const inst = db.prepare("SELECT id FROM institutions WHERE id = ? AND active = 1").get(body.institution_id);
    if (!inst) throw badRequest("bad_institution", "Instituição inválida.");
    if (!body.class_id) throw badRequest("bad_class", "Selecione a turma da instituição.");
  }

  const childId = newId();
  db.transaction(() => {
    db.prepare(
      `INSERT INTO children (id, parent_id, display_name, birth_year, grade, age_band,
         institution_id, class_id, subjects_json, priority_subject, kind, created_at)
       VALUES (@id,@parent_id,@display_name,@birth_year,@grade,@age_band,
         @institution_id,@class_id,@subjects_json,@priority_subject,'self',@created_at)`,
    ).run({
      id: childId,
      parent_id: parentId,
      display_name: body.display_name ?? "Estudante",
      birth_year: body.birth_year,
      grade: body.grade,
      age_band,
      institution_id: body.institution_id ?? null,
      class_id: body.class_id ?? null,
      subjects_json: body.subjects ? JSON.stringify(body.subjects) : null,
      priority_subject: body.priority_subject ?? null,
      created_at: nowIso(),
    });
    // Self-consent: o próprio titular consente pelos escopos obrigatórios (spec 12.1).
    for (const s of REQUIRED_CONSENTS) grantConsent(parentId, childId, s);
  })();

  setActiveChild(c.get("sessionId"), childId);
  audit(`parent:${parentId}`, "self_profile_create", `child:${childId}`, { age_band });
  return c.json(buildMe(parentId, childId), 201);
});

// ---------- POST /api/me/leaderboard-visibility (spec 12.4: opt-out) ----------
app.post("/api/me/leaderboard-visibility", requireParent, async (c) => {
  const parentId = c.get("parentId");
  const { child_id, hidden } = await readJson(
    c,
    z.object({ child_id: z.string().min(1), hidden: z.boolean() }),
  );
  ownChildOrThrow(parentId, child_id);
  db.prepare("UPDATE children SET leaderboard_hidden = ? WHERE id = ?").run(hidden ? 1 : 0, child_id);
  audit(`parent:${parentId}`, "leaderboard_visibility", `child:${child_id}`, { hidden });
  return c.json(buildMe(parentId, c.get("activeChildId")));
});

// ---------- POST /api/consents ----------
const consentSchema = z.object({
  child_id: z.string().min(1),
  scope: z.enum(["account", "ai_generation", "progress_tracking", "email_updates"]),
  granted: z.boolean(),
});

app.post("/api/consents", requireParent, async (c) => {
  const parentId = c.get("parentId");
  const { child_id, scope, granted } = await readJson(c, consentSchema);
  ownChildOrThrow(parentId, child_id);

  // Revogar 'account' dispara o caminho de deleção (spec 03 §3.3).
  if (scope === "account" && !granted) {
    softDeleteAccount(parentId);
    destroySession(c.get("sessionId"));
    clearSessionCookie(c);
    return c.json({ deleted: true });
  }

  if (granted) grantConsent(parentId, child_id, scope);
  else revokeConsent(parentId, child_id, scope);
  audit(`parent:${parentId}`, granted ? "consent_grant" : "consent_revoke", `child:${child_id}`, { scope });
  return c.json({ consents: consentStateFor(parentId, child_id) });
});

// ---------- POST /api/me/active-child ----------
app.post("/api/me/active-child", requireParent, async (c) => {
  const parentId = c.get("parentId");
  const { child_id } = await readJson(c, z.object({ child_id: z.string().min(1) }));
  ownChildOrThrow(parentId, child_id);
  setActiveChild(c.get("sessionId"), child_id);
  return c.json(buildMe(parentId, child_id));
});

// ---------- POST /api/me/verify-password (gate do responsável — spec 03 §3.4) ----------
app.post("/api/me/verify-password", requireParent, async (c) => {
  const parentId = c.get("parentId");
  const { password } = await readJson(c, z.object({ password: z.string().min(1).max(200) }));
  const row = db.prepare("SELECT password_hash FROM parents WHERE id = ?").get(parentId) as
    | { password_hash: string }
    | undefined;
  const ok = row ? await verifyPassword(password, row.password_hash) : false;
  if (!ok) throw forbidden("bad_password", "Senha incorreta.");
  return c.json({ ok: true });
});

// ---------- GET /api/me/export (portabilidade LGPD art. 18 — spec 09) ----------
app.get("/api/me/export", requireParent, (c) => {
  const parentId = c.get("parentId");
  const p = db
    .prepare("SELECT id, email, email_verified, full_name_enc, created_at FROM parents WHERE id = ?")
    .get(parentId) as { id: string; email: string; email_verified: number; full_name_enc: string | null; created_at: string };
  const childRows = db.prepare("SELECT * FROM children WHERE parent_id = ?").all(parentId) as { id: string }[];
  const childIds = childRows.map((r) => r.id);
  const inClause = childIds.length ? `(${childIds.map(() => "?").join(",")})` : "(NULL)";

  const dump = {
    exported_at: nowIso(),
    parent: {
      id: p.id,
      email: p.email,
      email_verified: !!p.email_verified,
      full_name: p.full_name_enc ? safeDecrypt(p.full_name_enc) : null,
      created_at: p.created_at,
    },
    children: childRows,
    consents: db.prepare("SELECT * FROM consents WHERE parent_id = ?").all(parentId),
    provas: db.prepare(`SELECT * FROM prova_calendar WHERE child_id IN ${inClause}`).all(...childIds),
    study_sessions: db.prepare(`SELECT * FROM study_sessions WHERE child_id IN ${inClause}`).all(...childIds),
    mastery_state: db.prepare(`SELECT * FROM mastery_state WHERE child_id IN ${inClause}`).all(...childIds),
    habit_log: db.prepare(`SELECT * FROM habit_log WHERE child_id IN ${inClause}`).all(...childIds),
  };
  audit(`parent:${parentId}`, "data_export", `parent:${parentId}`);
  c.header("Content-Disposition", 'attachment; filename="bearminds-meus-dados.json"');
  return c.json(dump);
});

function safeDecrypt(enc: string): string | null {
  try {
    return decryptPII(enc);
  } catch {
    return null;
  }
}

// ---------- POST /api/me/delete ----------
app.post("/api/me/delete", requireParent, async (c) => {
  const parentId = c.get("parentId");
  softDeleteAccount(parentId);
  destroySession(c.get("sessionId"));
  clearSessionCookie(c);
  return c.json({ deleted: true });
});

export default app;
