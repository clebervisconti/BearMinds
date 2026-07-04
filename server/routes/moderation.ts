// Moderação (spec 14.6): fila de conteúdo denunciado (flagged) + ocultar/restaurar.
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db.ts";
import { requireParent, requireRole, csrfGuard } from "../lib/session.ts";
import { readJson, badRequest, notFound, type AppEnv } from "../lib/http.ts";
import { audit } from "../lib/audit.ts";

const app = new Hono<AppEnv>();
app.use("/api/admin/moderation/*", csrfGuard);
app.use("/api/admin/moderation", csrfGuard);

const TABLES: Record<string, { table: string; label: string; body: string }> = {
  post: { table: "community_posts", label: "Publicação", body: "title" },
  reply: { table: "community_replies", label: "Resposta", body: "body" },
  qa: { table: "qa_questions", label: "Pergunta (Q&A)", body: "body" },
  message: { table: "chat_messages", label: "Mensagem de chat", body: "body" },
};

app.get("/api/admin/moderation", requireParent, requireRole("institution_admin"), (c) => {
  const items: Record<string, unknown>[] = [];
  for (const [kind, t] of Object.entries(TABLES)) {
    const rows = db.prepare(
      `SELECT id, ${t.body} AS body, created_at FROM ${t.table} WHERE flagged = 1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 50`,
    ).all() as { id: string; body: string; created_at: string }[];
    for (const r of rows) items.push({ kind, label: t.label, id: r.id, body: r.body, created_at: r.created_at });
  }
  items.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  return c.json({ items, count: items.length });
});

app.post("/api/admin/moderation/hide", requireParent, requireRole("institution_admin"), async (c) => {
  const { kind, id } = await readJson(c, z.object({ kind: z.enum(["post", "reply", "qa", "message"]), id: z.string().min(1) }));
  const t = TABLES[kind];
  if (!t) throw badRequest("bad_kind", "Tipo inválido.");
  const r = db.prepare(`UPDATE ${t.table} SET deleted_at = ? WHERE id = ?`).run(new Date().toISOString(), id);
  if (Number(r.changes) === 0) throw notFound("not_found", "Conteúdo não encontrado.");
  audit(`parent:${c.get("parentId")}`, "moderation_hide", `${kind}:${id}`);
  return c.json({ ok: true });
});

app.post("/api/admin/moderation/restore", requireParent, requireRole("institution_admin"), async (c) => {
  const { kind, id } = await readJson(c, z.object({ kind: z.enum(["post", "reply", "qa", "message"]), id: z.string().min(1) }));
  const t = TABLES[kind];
  if (!t) throw badRequest("bad_kind", "Tipo inválido.");
  db.prepare(`UPDATE ${t.table} SET flagged = 0 WHERE id = ?`).run(id);
  audit(`parent:${c.get("parentId")}`, "moderation_restore", `${kind}:${id}`);
  return c.json({ ok: true });
});

export default app;
