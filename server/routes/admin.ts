// Administração (spec 13): convites de staff, instituições (platform_admin) e visão geral.
import { Hono } from "hono";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { db, newId, nowIso } from "../db.ts";
import { env } from "../env.ts";
import {
  requireParent, requireRole, csrfGuard, parentRole, createSession, setSessionCookie,
  staffInstitutionOrThrow,
} from "../lib/session.ts";
import { readJson, badRequest, forbidden, notFound, conflict, type AppEnv } from "../lib/http.ts";
import { hashPassword } from "../lib/crypto.ts";
import { audit } from "../lib/audit.ts";
import { setSetting } from "../lib/settings.ts";
import { activeModel, availableModels, DEFAULT_MODEL } from "../llm/router.ts";

const app = new Hono<AppEnv>();
app.use("/api/admin/*", csrfGuard);
app.use("/api/invites/*", csrfGuard);

// ---------- Visão geral ----------
app.get("/api/admin/overview", requireParent, requireRole("professor", "tutor", "institution_admin"), (c) => {
  const { role, institutionId } = parentRole(c.get("parentId"));
  const scope = role === "platform_admin" ? null : institutionId;
  const q = (sql: string) =>
    (scope
      ? db.prepare(sql.replace("/*W*/", "WHERE institution_id = ?")).get(scope)
      : db.prepare(sql.replace("/*W*/", "")).get()) as { n: number };

  const courses = q("SELECT COUNT(*) n FROM courses /*W*/");
  const published = (scope
    ? db.prepare("SELECT COUNT(*) n FROM courses WHERE institution_id = ? AND status='published'").get(scope)
    : db.prepare("SELECT COUNT(*) n FROM courses WHERE status='published'").get()) as { n: number };
  const students = (scope
    ? db.prepare("SELECT COUNT(*) n FROM children WHERE COALESCE(institution_id,'bncc-padrao') = ? AND deleted_at IS NULL").get(scope)
    : db.prepare("SELECT COUNT(*) n FROM children WHERE deleted_at IS NULL").get()) as { n: number };
  const pending = (scope
    ? db.prepare(
        `SELECT COUNT(*) n FROM content_items i JOIN course_modules m ON m.id=i.module_id
         JOIN courses cs ON cs.id=m.course_id WHERE i.status='pending_review' AND cs.institution_id = ?`,
      ).get(scope)
    : db.prepare("SELECT COUNT(*) n FROM content_items WHERE status='pending_review'").get()) as { n: number };

  return c.json({
    role, institution_id: scope,
    courses: courses.n, published: published.n, students: students.n, pending_review: pending.n,
  });
});

// ---------- Convites ----------
const inviteSchema = z.object({
  email: z.string().email().max(160),
  role: z.enum(["professor", "tutor", "institution_admin", "platform_admin"]),
  institution_id: z.string().max(60).nullish(),
});

app.post("/api/admin/invites", requireParent, requireRole("institution_admin"), async (c) => {
  const parentId = c.get("parentId");
  const me = parentRole(parentId);
  const body = await readJson(c, inviteSchema);

  // institution_admin só convida professor/tutor para a PRÓPRIA instituição.
  let institutionId = body.institution_id ?? me.institutionId;
  if (me.role !== "platform_admin") {
    if (body.role === "institution_admin" || body.role === "platform_admin") {
      throw forbidden("role_too_high", "Apenas o administrador da plataforma convida gestores.");
    }
    institutionId = me.institutionId;
  }
  if (body.role !== "platform_admin" && !institutionId) {
    throw badRequest("institution_required", "Informe a instituição do convite.");
  }
  if (institutionId) {
    const inst = db.prepare("SELECT id FROM institutions WHERE id = ?").get(institutionId);
    if (!inst) throw badRequest("bad_institution", "Instituição inválida.");
  }

  const token = randomBytes(16).toString("hex");
  const id = newId();
  db.prepare(
    `INSERT INTO invites (id, email, role, institution_id, token, invited_by, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id, body.email.toLowerCase().trim(), body.role, institutionId ?? null, token, parentId,
    new Date(Date.now() + 7 * 86400000).toISOString(), nowIso(),
  );
  audit(`parent:${parentId}`, "invite_create", `invite:${id}`, { role: body.role, institution: institutionId });
  return c.json({ id, token, link: `${env.publicOrigin}/convite/${token}` }, 201);
});

app.get("/api/admin/invites", requireParent, requireRole("institution_admin"), (c) => {
  const me = parentRole(c.get("parentId"));
  const rows = (me.role === "platform_admin"
    ? db.prepare("SELECT id, email, role, institution_id, expires_at, accepted_at, created_at FROM invites ORDER BY created_at DESC LIMIT 50").all()
    : db.prepare("SELECT id, email, role, institution_id, expires_at, accepted_at, created_at FROM invites WHERE institution_id = ? ORDER BY created_at DESC LIMIT 50").all(me.institutionId)) as Record<string, unknown>[];
  return c.json({ invites: rows });
});

interface InviteRow {
  id: string; email: string; role: string; institution_id: string | null;
  expires_at: string; accepted_at: string | null;
}
function validInvite(token: string): InviteRow {
  const inv = db
    .prepare("SELECT id, email, role, institution_id, expires_at, accepted_at FROM invites WHERE token = ?")
    .get(token) as InviteRow | undefined;
  if (!inv) throw notFound("invite_not_found", "Convite não encontrado.");
  if (inv.accepted_at) throw conflict("invite_used", "Este convite já foi utilizado.");
  if (new Date(inv.expires_at).getTime() < Date.now()) throw conflict("invite_expired", "Este convite expirou.");
  return inv;
}

// Público: dados do convite para a tela de aceite.
app.get("/api/invites/:token", (c) => {
  const inv = validInvite(c.req.param("token"));
  const inst = inv.institution_id
    ? (db.prepare("SELECT name FROM institutions WHERE id = ?").get(inv.institution_id) as { name: string } | undefined)
    : undefined;
  return c.json({ email: inv.email, role: inv.role, institution: inst?.name ?? null });
});

// Público: aceitar — cria a conta staff (ou aplica papel se a conta do e-mail já existir + senha confere).
app.post("/api/invites/accept", async (c) => {
  const { token, password } = await readJson(
    c,
    z.object({ token: z.string().min(10), password: z.string().min(10).max(200) }),
  );
  const inv = validInvite(token);

  let parentId: string;
  const existing = db
    .prepare("SELECT id FROM parents WHERE email = ? AND deleted_at IS NULL")
    .get(inv.email) as { id: string } | undefined;
  if (existing) {
    // conta já existe → exigir login normal; aqui só aplicamos papel se a senha conferir
    const { verifyPassword } = await import("../lib/crypto.ts");
    const row = db.prepare("SELECT password_hash FROM parents WHERE id = ?").get(existing.id) as { password_hash: string };
    if (!(await verifyPassword(password, row.password_hash))) {
      throw forbidden("bad_password", "Já existe conta com este e-mail — informe a senha dela para vincular o papel.");
    }
    parentId = existing.id;
  } else {
    parentId = newId();
    db.prepare(
      "INSERT INTO parents (id, email, email_verified, password_hash, created_at) VALUES (?, ?, 1, ?, ?)",
    ).run(parentId, inv.email, await hashPassword(password), nowIso());
  }

  db.prepare("UPDATE parents SET role = ?, staff_institution_id = ? WHERE id = ?").run(
    inv.role, inv.institution_id, parentId,
  );
  db.prepare("UPDATE invites SET accepted_at = ? WHERE id = ?").run(nowIso(), inv.id);

  const sid = createSession(parentId, c.req.header("user-agent"));
  setSessionCookie(c, sid);
  audit(`parent:${parentId}`, "invite_accept", `invite:${inv.id}`, { role: inv.role });
  return c.json({ ok: true, role: inv.role });
});

// ---------- Instituições (platform_admin) ----------
const instSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{3,40}$/, "id em kebab-case"),
  name: z.string().trim().min(2).max(80),
  kind: z.enum(["default", "network", "school"]),
  config: z.object({
    classes: z.array(z.object({ id: z.string(), label: z.string(), grade_equiv: z.string(), age: z.string() })).min(1),
    subjects: z.array(z.object({ id: z.string(), label: z.string(), icon: z.string(), lang: z.enum(["pt", "en"]) })).min(1),
    terms: z.array(z.string()).min(1),
  }),
});

app.post("/api/admin/institutions", requireParent, requireRole("platform_admin"), async (c) => {
  const body = await readJson(c, instSchema);
  const exists = db.prepare("SELECT id FROM institutions WHERE id = ?").get(body.id);
  if (exists) throw conflict("institution_exists", "Já existe instituição com este id.");
  db.prepare("INSERT INTO institutions (id, name, kind, locale, active, config_json) VALUES (?, ?, ?, 'pt-BR', 1, ?)").run(
    body.id, body.name, body.kind, JSON.stringify(body.config),
  );
  audit(`parent:${c.get("parentId")}`, "institution_create", `institution:${body.id}`);
  return c.json({ id: body.id }, 201);
});

// ---------- Alunos da instituição (matrícula assinada usa esta lista) ----------
app.get("/api/admin/students", requireParent, requireRole("professor", "institution_admin"), (c) => {
  const me = parentRole(c.get("parentId"));
  const inst = me.role === "platform_admin" ? c.req.query("institution") || null : me.institutionId;
  if (!inst) throw badRequest("institution_required", "Informe a instituição.");
  const rows = db
    .prepare(
      `SELECT id, display_name, grade, class_id, kind FROM children
       WHERE COALESCE(institution_id,'bncc-padrao') = ? AND deleted_at IS NULL ORDER BY display_name LIMIT 200`,
    )
    .all(inst) as Record<string, unknown>[];
  return c.json({ students: rows });
});

// ---------- Modelo de IA (platform_admin) — escolha o modelo, padrão = Gemma local ----------
app.get("/api/admin/ai-model", requireParent, requireRole("platform_admin"), (c) => {
  return c.json({
    current: activeModel(),
    default: DEFAULT_MODEL,
    options: availableModels(),
  });
});

app.post("/api/admin/ai-model", requireParent, requireRole("platform_admin"), async (c) => {
  const { model } = await readJson(c, z.object({ model: z.string().min(1) }));
  const avail = availableModels();
  if (!avail.some((m) => m.id === model)) {
    throw badRequest("model_unavailable", "Modelo indisponível (provedor não configurado).");
  }
  setSetting("ai_model", model);
  audit(`parent:${c.get("parentId")}`, "set_ai_model", model);
  return c.json({ ok: true, current: model });
});

// ---------- Auto-matrícula Rules (spec 16.1) ----------
const enrollmentRuleSchema = z.object({
  grade: z.string().max(30).nullish(),
  class_id: z.string().max(60).nullish(),
});

app.post("/api/admin/courses/:id/enrollment-rules", requireParent, requireRole("institution_admin"), async (c) => {
  const courseId = c.req.param("id");
  const parentId = c.get("parentId");
  const body = await readJson(c, enrollmentRuleSchema);

  const course = db.prepare("SELECT institution_id FROM courses WHERE id = ?").get(courseId) as { institution_id: string } | undefined;
  if (!course) throw notFound("course_not_found", "Curso não encontrado.");

  staffInstitutionOrThrow(parentId, course.institution_id);

  const id = newId();
  db.prepare(
    `INSERT INTO enrollment_rules (id, course_id, institution_id, grade, class_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, courseId, course.institution_id, body.grade ?? null, body.class_id ?? null, nowIso());

  audit(`parent:${parentId}`, "enrollment_rule_create", `rule:${id}`, { course_id: courseId, grade: body.grade, class_id: body.class_id });

  return c.json({ id }, 201);
});

app.get("/api/admin/courses/:id/enrollment-rules", requireParent, requireRole("professor", "tutor", "institution_admin"), (c) => {
  const courseId = c.req.param("id");
  const parentId = c.get("parentId");

  const course = db.prepare("SELECT institution_id FROM courses WHERE id = ?").get(courseId) as { institution_id: string } | undefined;
  if (!course) throw notFound("course_not_found", "Curso não encontrado.");

  staffInstitutionOrThrow(parentId, course.institution_id);

  const rules = db.prepare(
    "SELECT id, grade, class_id, created_at FROM enrollment_rules WHERE course_id = ? ORDER BY created_at DESC"
  ).all(courseId) as Record<string, unknown>[];

  return c.json({ rules });
});

app.delete("/api/admin/enrollment-rules/:ruleId", requireParent, requireRole("institution_admin"), (c) => {
  const ruleId = c.req.param("ruleId");
  const parentId = c.get("parentId");

  const rule = db.prepare("SELECT id, course_id, institution_id FROM enrollment_rules WHERE id = ?").get(ruleId) as { id: string; course_id: string; institution_id: string } | undefined;
  if (!rule) throw notFound("rule_not_found", "Regra não encontrada.");

  staffInstitutionOrThrow(parentId, rule.institution_id);

  db.prepare("DELETE FROM enrollment_rules WHERE id = ?").run(ruleId);
  audit(`parent:${parentId}`, "enrollment_rule_delete", `rule:${ruleId}`, { course_id: rule.course_id });

  return c.json({ ok: true });
});

// ---------- Duplicação de Curso (spec 16.2) ----------
const duplicateCourseSchema = z.object({
  title: z.string().min(2).max(100),
  class_id: z.string().min(1).max(60),
});

app.post("/api/admin/courses/:id/duplicate", requireParent, requireRole("professor", "tutor", "institution_admin"), async (c) => {
  const courseId = c.req.param("id");
  const parentId = c.get("parentId");
  const body = await readJson(c, duplicateCourseSchema);

  interface CourseRow {
    id: string; institution_id: string; subject_id: string; class_id: string;
    title: string; cover_emoji: string; status: string; created_by: string; created_at: string;
  }
  const course = db.prepare("SELECT * FROM courses WHERE id = ?").get(courseId) as CourseRow | undefined;
  if (!course) throw notFound("course_not_found", "Curso de origem não encontrado.");

  staffInstitutionOrThrow(parentId, course.institution_id);

  const newCourseId = newId();

  db.transaction(() => {
    // 1) Clona a linha do curso com status draft
    db.prepare(
      `INSERT INTO courses (id, institution_id, subject_id, class_id, title, cover_emoji, status, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?)`
    ).run(
      newCourseId,
      course.institution_id,
      course.subject_id,
      body.class_id,
      body.title,
      course.cover_emoji,
      parentId,
      nowIso()
    );

    // 2) Clona os módulos
    interface ModuleRow { id: string; title: string; objectives: string | null; display_order: number; availability_json: string | null; }
    const modules = db.prepare("SELECT id, title, objectives, display_order, availability_json FROM course_modules WHERE course_id = ?").all(courseId) as ModuleRow[];

    const checkItems = db.prepare(
      `SELECT id, module_id, kind, title, payload_json, source_file_id, display_order, duration_min, status, availability_json, verified_by, verified_at, created_at 
       FROM content_items WHERE module_id = ?`
    );

    const insertModule = db.prepare(
      `INSERT INTO course_modules (id, course_id, title, objectives, display_order, availability_json)
       VALUES (?, ?, ?, ?, ?, ?)`
    );

    const insertItem = db.prepare(
      `INSERT INTO content_items (id, module_id, kind, title, payload_json, source_file_id, display_order, duration_min, status, availability_json, verified_by, verified_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)`
    );

    for (const mod of modules) {
      const newModuleId = newId();
      insertModule.run(
        newModuleId,
        newCourseId,
        mod.title,
        mod.objectives,
        mod.display_order,
        mod.availability_json
      );

      // 3) Clona os content items do módulo
      interface ItemRow {
        id: string; module_id: string; kind: string; title: string; payload_json: string | null;
        source_file_id: string | null; display_order: number; duration_min: number | null;
        status: string; availability_json: string | null; verified_by: string | null;
        verified_at: string | null; created_at: string;
      }
      const items = checkItems.all(mod.id) as ItemRow[];
      for (const item of items) {
        insertItem.run(
          newId(),
          newModuleId,
          item.kind,
          item.title,
          item.payload_json,
          item.source_file_id,
          item.display_order,
          item.duration_min,
          item.availability_json,
          item.verified_by,
          item.verified_at,
          nowIso()
        );
      }
    }
  })();

  audit(`parent:${parentId}`, "course_duplicate", `course:${courseId}`, { new_course_id: newCourseId });

  return c.json({ id: newCourseId }, 201);
});

// ---------- Relatórios por Curso (spec 16.5) ----------
app.get("/api/admin/courses/:id/reports", requireParent, requireRole("professor", "tutor", "institution_admin"), (c) => {
  const courseId = c.req.param("id");
  const parentId = c.get("parentId");

  const course = db.prepare("SELECT institution_id FROM courses WHERE id = ?").get(courseId) as { institution_id: string } | undefined;
  if (!course) throw notFound("course_not_found", "Curso não encontrado.");

  staffInstitutionOrThrow(parentId, course.institution_id);

  // 1) Participação: alunos ativos (eventos com actor_kind = child) nos últimos 7 dias
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const activeStudents = (db.prepare(
    `SELECT COUNT(DISTINCT actor_id) AS n FROM events 
     WHERE course_id = ? AND actor_kind = 'child' AND created_at >= ?`
  ).get(courseId, sevenDaysAgo) as { n: number }).n;

  const totalStudents = (db.prepare(
    "SELECT COUNT(*) AS total FROM enrollments WHERE course_id = ?"
  ).get(courseId) as { total: number }).total;

  const participationRate = totalStudents > 0 ? activeStudents / totalStudents : 0;

  // 2) Conclusão média: percentual médio de conclusão de itens do curso por aluno matriculado
  // Total de itens publicados no curso
  const totalItems = (db.prepare(
    `SELECT COUNT(*) AS n FROM content_items i 
     JOIN course_modules m ON m.id = i.module_id 
     WHERE m.course_id = ? AND i.status = 'published'`
  ).get(courseId) as { n: number }).n;

  let averageCompletion = 0;
  if (totalStudents > 0 && totalItems > 0) {
    const completedItems = (db.prepare(
      `SELECT COUNT(*) AS n FROM item_progress ip 
       JOIN content_items i ON i.id = ip.item_id 
       JOIN course_modules m ON m.id = i.module_id 
       WHERE m.course_id = ? AND ip.status = 'done' 
         AND ip.child_id IN (SELECT child_id FROM enrollments WHERE course_id = ?)`
    ).get(courseId, courseId) as { n: number }).n;

    averageCompletion = completedItems / (totalItems * totalStudents);
  }

  // 3) Desempenho médio (Provas + Tarefas):
  // Média de nota de provas (melhor tentativa por aluno/prova)
  const avgExams = (db.prepare(
    `SELECT AVG(best_score) AS n FROM (
       SELECT MAX(ea.score) AS best_score 
       FROM exam_attempts ea 
       JOIN exams e ON e.id = ea.exam_id 
       WHERE e.course_id = ? AND ea.submitted_at IS NOT NULL 
       GROUP BY ea.child_id, ea.exam_id
     )`
  ).get(courseId) as { n: number | null }).n ?? 0;

  // Média de nota de tarefas (melhor review de submissão por aluno/tarefa)
  const subRows = db.prepare(
    `SELECT sub.child_id, sub.item_id, MAX(rev.points) AS points, item.payload_json 
     FROM submission_reviews rev 
     JOIN submissions sub ON sub.id = rev.submission_id 
     JOIN content_items item ON item.id = sub.item_id 
     JOIN course_modules m ON m.id = item.module_id 
     WHERE m.course_id = ? 
     GROUP BY sub.child_id, sub.item_id`
  ).all(courseId) as { child_id: string; item_id: string; points: number; payload_json: string }[];

  let totalPointsNormalized = 0;
  let totalTasksEvaluated = 0;

  for (const row of subRows) {
    try {
      const payload = JSON.parse(row.payload_json || "{}");
      const maxPoints = Number(payload.max_points || 100);
      if (maxPoints > 0) {
        totalPointsNormalized += (row.points / maxPoints);
        totalTasksEvaluated++;
      }
    } catch {
      // payload_json inválido
    }
  }

  const avgAssignments = totalTasksEvaluated > 0 ? totalPointsNormalized / totalTasksEvaluated : 0;

  return c.json({
    active_students_7d: activeStudents,
    total_students: totalStudents,
    participation_rate: participationRate,
    average_completion: averageCompletion,
    average_exam_score: avgExams,
    average_assignment_score: avgAssignments,
  });
});

export default app;
