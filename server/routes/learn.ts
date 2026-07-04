// Lado do estudante (spec 13.4): catálogo, matrícula, página do curso com Learning Backlog,
// progresso por item e CONCLUSÃO MASTERY-GATED do módulo (+100 moedas).
import { Hono } from "hono";
import { z } from "zod";
import { db, newId, nowIso } from "../db.ts";
import {
  requireParent, requireRole, csrfGuard, ownChildOrThrow, parentRole, staffInstitutionOrThrow,
} from "../lib/session.ts";
import { readJson, badRequest, forbidden, notFound, conflict, type AppEnv } from "../lib/http.ts";
import { getMasteryRow, retrievabilityOf } from "../mastery/fsrs.ts";
import { awardCoins, unlockAchievement } from "../gamify.ts";
import { audit } from "../lib/audit.ts";

const app = new Hono<AppEnv>();
app.use("/api/learn/*", csrfGuard);
app.use("/api/admin/*", csrfGuard);

function childInstitution(childId: string): string {
  const row = db
    .prepare("SELECT COALESCE(institution_id,'bncc-padrao') AS inst FROM children WHERE id = ? AND deleted_at IS NULL")
    .get(childId) as { inst: string } | undefined;
  if (!row) throw notFound("child_not_found", "Perfil não encontrado.");
  return row.inst;
}

// ---------- Catálogo ----------
app.get("/api/learn/catalog", requireParent, (c) => {
  const parentId = c.get("parentId");
  const childId = c.req.query("child_id") || c.get("activeChildId") || "";
  if (!childId) throw notFound("no_child", "Nenhum perfil ativo.");
  ownChildOrThrow(parentId, childId);
  const inst = childInstitution(childId);

  const rows = db
    .prepare(
      `SELECT cs.id, cs.title, cs.description, cs.cover_emoji, cs.subject_id, cs.class_id, cs.term, cs.year,
              (SELECT COUNT(*) FROM course_modules m WHERE m.course_id = cs.id) AS modules,
              (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = cs.id) AS enrolled_count,
              (SELECT e.id FROM enrollments e WHERE e.course_id = cs.id AND e.child_id = ?) AS my_enrollment,
              (SELECT e.completed_at FROM enrollments e WHERE e.course_id = cs.id AND e.child_id = ?) AS completed_at
       FROM courses cs WHERE cs.institution_id = ? AND cs.status = 'published'
       ORDER BY cs.created_at DESC`,
    )
    .all(childId, childId, inst) as Record<string, unknown>[];
  return c.json({ courses: rows.map((r) => ({ ...r, enrolled: !!r.my_enrollment })) });
});

// ---------- Matrícula (self) ----------
app.post("/api/learn/enroll", requireParent, async (c) => {
  const parentId = c.get("parentId");
  const { child_id, course_id } = await readJson(c, z.object({ child_id: z.string().min(1), course_id: z.string().min(1) }));
  ownChildOrThrow(parentId, child_id);
  const inst = childInstitution(child_id);
  const course = db
    .prepare("SELECT id, institution_id, status FROM courses WHERE id = ?")
    .get(course_id) as { id: string; institution_id: string; status: string } | undefined;
  if (!course || course.status !== "published") throw notFound("course_not_found", "Curso não disponível.");
  if (course.institution_id !== inst) throw forbidden("wrong_institution", "Este curso é de outra instituição.");
  const exists = db.prepare("SELECT id FROM enrollments WHERE child_id = ? AND course_id = ?").get(child_id, course_id);
  if (exists) throw conflict("already_enrolled", "Já inscrito neste curso.");
  db.prepare(
    "INSERT INTO enrollments (id, child_id, course_id, source, enrolled_at) VALUES (?, ?, ?, 'self', ?)",
  ).run(newId(), child_id, course_id, nowIso());
  audit(`child:${child_id}`, "enroll_self", `course:${course_id}`);
  return c.json({ ok: true }, 201);
});

// ---------- Matrícula (assigned, staff) ----------
app.post("/api/admin/courses/:id/assign", requireParent, requireRole("professor", "institution_admin"), async (c) => {
  const parentId = c.get("parentId");
  const course = db
    .prepare("SELECT id, institution_id FROM courses WHERE id = ?")
    .get(c.req.param("id")) as { id: string; institution_id: string } | undefined;
  if (!course) throw notFound("course_not_found", "Curso não encontrado.");
  staffInstitutionOrThrow(parentId, course.institution_id);
  const { child_ids } = await readJson(c, z.object({ child_ids: z.array(z.string()).min(1).max(200) }));

  let added = 0;
  const ins = db.prepare(
    "INSERT OR IGNORE INTO enrollments (id, child_id, course_id, source, assigned_by, enrolled_at) VALUES (?, ?, ?, 'assigned', ?, ?)",
  );
  for (const cid of child_ids) {
    const child = db
      .prepare("SELECT COALESCE(institution_id,'bncc-padrao') AS inst FROM children WHERE id = ? AND deleted_at IS NULL")
      .get(cid) as { inst: string } | undefined;
    if (!child || child.inst !== course.institution_id) continue; // escopo: só alunos da mesma instituição
    const r = ins.run(newId(), cid, course.id, parentId, nowIso());
    added += Number(r.changes);
  }
  audit(`parent:${parentId}`, "enroll_assign", `course:${course.id}`, { count: added });
  return c.json({ assigned: added });
});

// ---------- Backlog / conclusão ----------
interface ItemRow {
  id: string; kind: string; title: string; payload_json: string | null;
  display_order: number; duration_min: number | null;
}

function atomsForItems(items: ItemRow[]): { code: string; itemId: string }[] {
  const codes: { code: string; itemId: string }[] = [];
  for (const i of items) {
    const p = i.payload_json ? (JSON.parse(i.payload_json) as { bncc_code?: string; ai?: boolean }) : {};
    if (p.bncc_code) codes.push({ code: p.bncc_code, itemId: i.id });
  }
  return codes;
}

interface AtomState { id: string; text: string; state: "new" | "reviewing" | "mastered" }

function moduleBacklog(childId: string, items: ItemRow[]): AtomState[] {
  const out: AtomState[] = [];
  for (const { code } of atomsForItems(items)) {
    const atoms = db.prepare("SELECT id, atom_text AS text FROM knowledge_atoms WHERE bncc_code = ?").all(code) as { id: string; text: string }[];
    for (const a of atoms) {
      const row = getMasteryRow(childId, a.id);
      let state: AtomState["state"] = "new";
      if (row && row.state !== "new") {
        state = row.state === "review" && retrievabilityOf(row) >= 0.9 ? "mastered" : "reviewing";
      }
      out.push({ id: a.id, text: a.text, state });
    }
  }
  return out;
}

/** Conclusão mastery-gated (spec 13.4): itens publicados done + todos os atoms dominados. */
export function moduleComplete(childId: string, items: ItemRow[], backlog: AtomState[]): boolean {
  if (items.length === 0) return false;
  const doneStmt = db.prepare("SELECT status FROM item_progress WHERE child_id = ? AND item_id = ?");
  const allDone = items.every((i) => (doneStmt.get(childId, i.id) as { status: string } | undefined)?.status === "done");
  const allMastered = backlog.every((a) => a.state === "mastered");
  return allDone && allMastered;
}

// ---------- Página do curso ----------
app.get("/api/learn/courses/:id", requireParent, (c) => {
  const parentId = c.get("parentId");
  const childId = c.req.query("child_id") || c.get("activeChildId") || "";
  if (!childId) throw notFound("no_child", "Nenhum perfil ativo.");
  ownChildOrThrow(parentId, childId);
  const inst = childInstitution(childId);

  const course = db
    .prepare("SELECT * FROM courses WHERE id = ? AND status = 'published'")
    .get(c.req.param("id")) as Record<string, unknown> | undefined;
  if (!course || course.institution_id !== inst) throw notFound("course_not_found", "Curso não disponível.");
  const enrollment = db
    .prepare("SELECT id, source, completed_at FROM enrollments WHERE child_id = ? AND course_id = ?")
    .get(childId, course.id as string);

  const modules = db
    .prepare("SELECT id, title, objectives, display_order FROM course_modules WHERE course_id = ? ORDER BY display_order")
    .all(course.id as string) as { id: string; title: string; objectives: string | null; display_order: number }[];
  const itemsStmt = db.prepare(
    `SELECT id, kind, title, payload_json, display_order, duration_min FROM content_items
     WHERE module_id = ? AND status = 'published' ORDER BY display_order`,
  );
  const progStmt = db.prepare("SELECT status, score FROM item_progress WHERE child_id = ? AND item_id = ?");

  const out = modules.map((m) => {
    const items = itemsStmt.all(m.id) as ItemRow[];
    const backlog = moduleBacklog(childId, items);
    return {
      ...m,
      complete: moduleComplete(childId, items, backlog),
      backlog,
      items: items.map((i) => ({
        id: i.id,
        kind: i.kind,
        title: i.title,
        duration_min: i.duration_min,
        payload: i.payload_json ? JSON.parse(i.payload_json) : null,
        progress: (progStmt.get(childId, i.id) as { status: string; score: number | null } | undefined) ?? { status: "todo", score: null },
      })),
    };
  });

  return c.json({ course, enrolled: !!enrollment, completed_at: (enrollment as { completed_at?: string } | undefined)?.completed_at ?? null, modules: out });
});

// ---------- Progresso de item + recompensa de conclusão ----------
app.post("/api/learn/items/:id/progress", requireParent, async (c) => {
  const parentId = c.get("parentId");
  const { child_id, status, score } = await readJson(
    c,
    z.object({ child_id: z.string().min(1), status: z.enum(["doing", "done"]), score: z.number().min(0).max(1).nullish() }),
  );
  ownChildOrThrow(parentId, child_id);

  const item = db
    .prepare(
      `SELECT i.id, i.module_id, m.course_id, cs.institution_id
       FROM content_items i JOIN course_modules m ON m.id = i.module_id JOIN courses cs ON cs.id = m.course_id
       WHERE i.id = ? AND i.status = 'published'`,
    )
    .get(c.req.param("id")) as { id: string; module_id: string; course_id: string; institution_id: string } | undefined;
  if (!item) throw notFound("item_not_found", "Item não encontrado.");
  const enrolled = db.prepare("SELECT id FROM enrollments WHERE child_id = ? AND course_id = ?").get(child_id, item.course_id);
  if (!enrolled) throw forbidden("not_enrolled", "Inscreva-se no curso primeiro.");

  db.prepare(
    `INSERT INTO item_progress (child_id, item_id, status, score, attempts, updated_at) VALUES (?, ?, ?, ?, 1, ?)
     ON CONFLICT(child_id, item_id) DO UPDATE SET status = excluded.status,
       score = COALESCE(excluded.score, item_progress.score), attempts = attempts + 1, updated_at = excluded.updated_at`,
  ).run(child_id, item.id, status, score ?? null, nowIso());

  // conclusão do módulo (mastery-gated) + recompensas com dedup por ledger
  let moduleCompleted = false;
  let courseCompleted = false;
  if (status === "done") {
    const items = db
      .prepare("SELECT id, kind, title, payload_json, display_order, duration_min FROM content_items WHERE module_id = ? AND status = 'published'")
      .all(item.module_id) as ItemRow[];
    const backlog = moduleBacklog(child_id, items);
    if (moduleComplete(child_id, items, backlog)) {
      moduleCompleted = true;
      const seen = db
        .prepare("SELECT 1 FROM coin_ledger WHERE child_id = ? AND reason = 'module_complete' AND ref_id = ? LIMIT 1")
        .get(child_id, item.module_id);
      if (!seen) {
        awardCoins(child_id, 100, "module_complete", item.module_id);
        unlockAchievement(parentId, child_id, "module_complete");
      }
      // curso completo = todos os módulos completos
      const mods = db.prepare("SELECT id FROM course_modules WHERE course_id = ?").all(item.course_id) as { id: string }[];
      const allModules = mods.every((m) => {
        const its = db
          .prepare("SELECT id, kind, title, payload_json, display_order, duration_min FROM content_items WHERE module_id = ? AND status = 'published'")
          .all(m.id) as ItemRow[];
        if (its.length === 0) return true;
        return moduleComplete(child_id, its, moduleBacklog(child_id, its));
      });
      if (allModules) {
        courseCompleted = true;
        db.prepare("UPDATE enrollments SET completed_at = COALESCE(completed_at, ?) WHERE child_id = ? AND course_id = ?").run(
          nowIso(), child_id, item.course_id,
        );
        // Certificado (spec 14.5) — dedup por UNIQUE(child_id, course_id).
        try {
          const code = `BM-${newId().slice(0, 8).toUpperCase()}`;
          db.prepare("INSERT INTO certificates (id, child_id, course_id, code, issued_at) VALUES (?, ?, ?, ?, ?)").run(
            newId(), child_id, item.course_id, code, nowIso(),
          );
          db.prepare(
            `INSERT INTO notifications (id, parent_id, child_id, kind, title, body, link, created_at)
             VALUES (?, ?, ?, 'achievement', '📜 Certificado emitido!', 'Você concluiu um curso com maestria.', '/conquistas', ?)`,
          ).run(newId(), parentId, child_id, nowIso());
        } catch { /* já emitido */ }
      }
    }
  }
  return c.json({ ok: true, module_completed: moduleCompleted, course_completed: courseCompleted });
});

export default app;
