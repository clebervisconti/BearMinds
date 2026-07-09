// Quick Updates + Checklists (spec 17.1): micro-lição de ~3min (1-2 perguntas) — o push diário que
// não é um curso — e listas de passos rastreáveis. A conclusão do item em si usa o endpoint genérico
// POST /api/learn/items/:id/progress (kind='quick_update'); aqui só o estado por-passo do checklist.
import { Hono } from "hono";
import { z } from "zod";
import { db, nowIso } from "../db.ts";
import { requireParent, csrfGuard, ownChildOrThrow } from "../lib/session.ts";
import { readJson, notFound, forbidden, type AppEnv } from "../lib/http.ts";

const app = new Hono<AppEnv>();
app.use("/api/learn/*", csrfGuard);

interface ItemRow { id: string; kind: string; module_id: string; course_id: string; payload_json: string | null }
function quickUpdateItem(itemId: string): ItemRow {
  const r = db.prepare(
    `SELECT i.id, i.kind, i.module_id, i.payload_json, m.course_id
     FROM content_items i JOIN course_modules m ON m.id = i.module_id WHERE i.id = ? AND i.status = 'published'`,
  ).get(itemId) as ItemRow | undefined;
  if (!r) throw notFound("item_not_found", "Item não encontrado.");
  if (r.kind !== "quick_update") throw notFound("not_quick_update", "Este item não é um Quick Update.");
  return r;
}

app.get("/api/learn/items/:id/checklist", requireParent, (c) => {
  const parentId = c.get("parentId");
  const childId = c.req.query("child_id") || c.get("activeChildId") || "";
  if (childId) ownChildOrThrow(parentId, childId);
  const item = quickUpdateItem(c.req.param("id"));
  const payload = item.payload_json ? JSON.parse(item.payload_json) as { checklist?: { label: string }[] } : {};
  const steps = payload.checklist ?? [];
  const done = new Set(
    (db.prepare("SELECT step_index FROM checklist_state WHERE item_id = ? AND child_id = ?").all(item.id, childId) as { step_index: number }[])
      .map((r) => r.step_index),
  );
  return c.json({ steps: steps.map((s, i) => ({ index: i, label: s.label, done: done.has(i) })) });
});

app.post("/api/learn/items/:id/checklist/:step/toggle", requireParent, async (c) => {
  const parentId = c.get("parentId");
  const { child_id } = await readJson(c, z.object({ child_id: z.string().min(1) }));
  ownChildOrThrow(parentId, child_id);
  const item = quickUpdateItem(c.req.param("id"));
  const enrolled = db.prepare("SELECT 1 FROM enrollments WHERE child_id = ? AND course_id = ?").get(child_id, item.course_id);
  if (!enrolled) throw forbidden("not_enrolled", "Inscreva-se no curso primeiro.");
  const step = Number(c.req.param("step"));
  const payload = item.payload_json ? JSON.parse(item.payload_json) as { checklist?: { label: string }[] } : {};
  const steps = payload.checklist ?? [];
  if (!Number.isInteger(step) || step < 0 || step >= steps.length) throw notFound("bad_step", "Passo inválido.");

  const existing = db.prepare("SELECT 1 FROM checklist_state WHERE item_id = ? AND child_id = ? AND step_index = ?").get(item.id, child_id, step);
  if (existing) {
    db.prepare("DELETE FROM checklist_state WHERE item_id = ? AND child_id = ? AND step_index = ?").run(item.id, child_id, step);
  } else {
    db.prepare("INSERT INTO checklist_state (item_id, child_id, step_index, done_at) VALUES (?, ?, ?, ?)").run(item.id, child_id, step, nowIso());
  }
  const doneCount = (db.prepare("SELECT COUNT(*) n FROM checklist_state WHERE item_id = ? AND child_id = ?").get(item.id, child_id) as { n: number }).n;
  return c.json({ done: !existing, all_done: doneCount === steps.length && steps.length > 0 });
});

export default app;
