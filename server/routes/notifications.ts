// Central de notificações (spec 12.6): persistentes (tabela) + derivadas (revisões devidas, prova ≤7d).
import { Hono } from "hono";
import { z } from "zod";
import { db, nowIso } from "../db.ts";
import { requireParent, csrfGuard, ownChildOrThrow } from "../lib/session.ts";
import { readJson, type AppEnv } from "../lib/http.ts";
import { provaCountdowns } from "../mastery/today.ts";
import type { AppNotification } from "../../shared/contracts.ts";

const app = new Hono<AppEnv>();
app.use("/api/notifications/*", csrfGuard);

interface NotifRow {
  id: string; kind: string; title: string; body: string | null; link: string | null;
  read_at: string | null; created_at: string;
}

// GET /api/notifications?child_id
app.get("/api/notifications", requireParent, (c) => {
  const parentId = c.get("parentId");
  const childId = c.req.query("child_id") || c.get("activeChildId") || "";
  if (childId) ownChildOrThrow(parentId, childId);

  const rows = db
    .prepare(
      `SELECT id, kind, title, body, link, read_at, created_at FROM notifications
       WHERE parent_id = ? ${childId ? "AND (child_id = ? OR child_id IS NULL)" : ""}
       ORDER BY created_at DESC LIMIT 50`,
    )
    .all(...(childId ? [parentId, childId] : [parentId])) as NotifRow[];

  const items: AppNotification[] = rows.map((r) => ({
    id: r.id,
    kind: r.kind as AppNotification["kind"],
    title: r.title,
    body: r.body ?? "",
    link: r.link ?? null,
    read: !!r.read_at,
    derived: false,
    at: r.created_at,
  }));

  // Derivadas (nunca gravadas; refletem o estado atual)
  if (childId) {
    const due = (db
      .prepare("SELECT COUNT(*) n FROM mastery_state WHERE child_id = ? AND due IS NOT NULL AND due <= ?")
      .get(childId, nowIso()) as { n: number }).n;
    if (due > 0) {
      items.unshift({
        id: null, kind: "reviews_due", derived: true, read: false, at: nowIso(), link: "/atividades",
        title: `${due} ${due === 1 ? "revisão esperando" : "revisões esperando"} hoje`,
        body: "Revisar no momento certo é o que fixa a memória.",
      });
    }
    for (const p of provaCountdowns(childId)) {
      if (p.days_left <= 7) {
        items.unshift({
          id: null, kind: "prova_soon", derived: true, read: false, at: nowIso(), link: "/atividades",
          title: `${p.title} ${p.days_left === 0 ? "é hoje" : `em ${p.days_left} dia${p.days_left === 1 ? "" : "s"}`}`,
          body: `Você está ${Math.round(p.readiness * 100)}% pronto.`,
        });
      }
    }
  }

  const unread = items.filter((i) => !i.read).length;
  return c.json({ items, unread });
});

// POST /api/notifications/read {ids?: string[], all?: boolean}
app.post("/api/notifications/read", requireParent, async (c) => {
  const parentId = c.get("parentId");
  const body = await readJson(
    c,
    z.object({ ids: z.array(z.string()).max(100).optional(), all: z.boolean().optional() }),
  );
  const ts = nowIso();
  if (body.all) {
    db.prepare("UPDATE notifications SET read_at = ? WHERE parent_id = ? AND read_at IS NULL").run(ts, parentId);
  } else {
    for (const id of body.ids ?? []) {
      db.prepare("UPDATE notifications SET read_at = ? WHERE id = ? AND parent_id = ?").run(ts, id, parentId);
    }
  }
  return c.json({ ok: true });
});

export default app;
