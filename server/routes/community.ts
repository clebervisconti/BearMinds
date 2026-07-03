// Comunidade por instituição (spec 12.5): posts + respostas + denúncia. Texto puro, apelido apenas,
// sem DMs. Entrada do usuário é DADO — renderização como texto puro no client.
import { Hono } from "hono";
import { z } from "zod";
import { db, newId, nowIso } from "../db.ts";
import { requireParent, csrfGuard, ownChildOrThrow } from "../lib/session.ts";
import { readJson, notFound, forbidden, type AppEnv } from "../lib/http.ts";
import { audit } from "../lib/audit.ts";
import type { CommunityPost, CommunityReply } from "../../shared/contracts.ts";

const app = new Hono<AppEnv>();
app.use("/api/community/*", csrfGuard);

function institutionOf(childId: string): string {
  const row = db
    .prepare("SELECT COALESCE(institution_id,'bncc-padrao') AS inst FROM children WHERE id = ? AND deleted_at IS NULL")
    .get(childId) as { inst: string } | undefined;
  if (!row) throw notFound("child_not_found", "Perfil não encontrado.");
  return row.inst;
}

function requireChild(c: { get: (k: "parentId" | "activeChildId") => string | null }, q?: string): { parentId: string; childId: string } {
  const parentId = c.get("parentId")!;
  const childId = q || c.get("activeChildId") || "";
  if (!childId) throw notFound("no_child", "Nenhum perfil ativo.");
  return { parentId, childId };
}

// GET /api/community/posts?child_id&subject
app.get("/api/community/posts", requireParent, (c) => {
  const { parentId, childId } = requireChild(c, c.req.query("child_id"));
  ownChildOrThrow(parentId, childId);
  const inst = institutionOf(childId);
  const subject = c.req.query("subject");

  let sql = `SELECT p.id, p.subject_id, p.title, p.body, p.created_at, ch.display_name AS author,
                    (SELECT COUNT(*) FROM community_replies r WHERE r.post_id = p.id AND r.deleted_at IS NULL) AS replies
             FROM community_posts p JOIN children ch ON ch.id = p.child_id
             WHERE p.institution_id = ? AND p.deleted_at IS NULL`;
  const params: unknown[] = [inst];
  if (subject) {
    sql += " AND p.subject_id = ?";
    params.push(subject);
  }
  sql += " ORDER BY p.created_at DESC LIMIT 50";

  const posts = db.prepare(sql).all(...params) as CommunityPost[];
  return c.json({ posts });
});

// POST /api/community/posts {child_id, subject_id?, title, body}
const postSchema = z.object({
  child_id: z.string().min(1),
  subject_id: z.string().max(40).nullish(),
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(1).max(2000),
});

app.post("/api/community/posts", requireParent, async (c) => {
  const parentId = c.get("parentId");
  const body = await readJson(c, postSchema);
  ownChildOrThrow(parentId, body.child_id);
  const inst = institutionOf(body.child_id);

  const id = newId();
  db.prepare(
    `INSERT INTO community_posts (id, child_id, institution_id, subject_id, title, body, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, body.child_id, inst, body.subject_id ?? null, body.title, body.body, nowIso());
  audit(`child:${body.child_id}`, "community_post", `post:${id}`);
  return c.json({ id }, 201);
});

// GET /api/community/posts/:id (mesma instituição do perfil ativo)
app.get("/api/community/posts/:id", requireParent, (c) => {
  const { parentId, childId } = requireChild(c, c.req.query("child_id"));
  ownChildOrThrow(parentId, childId);
  const inst = institutionOf(childId);
  const id = c.req.param("id");

  const post = db
    .prepare(
      `SELECT p.id, p.subject_id, p.title, p.body, p.created_at, ch.display_name AS author
       FROM community_posts p JOIN children ch ON ch.id = p.child_id
       WHERE p.id = ? AND p.institution_id = ? AND p.deleted_at IS NULL`,
    )
    .get(id, inst) as CommunityPost | undefined;
  if (!post) throw notFound("post_not_found", "Publicação não encontrada.");

  const replies = db
    .prepare(
      `SELECT r.id, r.body, r.created_at, ch.display_name AS author
       FROM community_replies r JOIN children ch ON ch.id = r.child_id
       WHERE r.post_id = ? AND r.deleted_at IS NULL ORDER BY r.created_at`,
    )
    .all(id) as CommunityReply[];

  return c.json({ post, replies });
});

// POST /api/community/posts/:id/replies {child_id, body}
const replySchema = z.object({ child_id: z.string().min(1), body: z.string().trim().min(1).max(2000) });

app.post("/api/community/posts/:id/replies", requireParent, async (c) => {
  const parentId = c.get("parentId");
  const postId = c.req.param("id");
  const body = await readJson(c, replySchema);
  ownChildOrThrow(parentId, body.child_id);
  const inst = institutionOf(body.child_id);

  const post = db
    .prepare(
      `SELECT p.id, p.title, p.child_id, ch.parent_id AS author_parent
       FROM community_posts p JOIN children ch ON ch.id = p.child_id
       WHERE p.id = ? AND p.institution_id = ? AND p.deleted_at IS NULL`,
    )
    .get(postId, inst) as { id: string; title: string; child_id: string; author_parent: string } | undefined;
  if (!post) throw notFound("post_not_found", "Publicação não encontrada.");

  const id = newId();
  db.prepare(
    "INSERT INTO community_replies (id, post_id, child_id, body, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(id, postId, body.child_id, body.body, nowIso());

  // Notifica o autor do post (persistente) — sem expor quem além do apelido.
  if (post.child_id !== body.child_id) {
    db.prepare(
      `INSERT INTO notifications (id, parent_id, child_id, kind, title, body, link, created_at)
       VALUES (?, ?, ?, 'reply', ?, ?, '/comunidade', ?)`,
    ).run(
      newId(), post.author_parent, post.child_id,
      `💬 Nova resposta em: ${post.title.slice(0, 60)}`, body.body.slice(0, 120), nowIso(),
    );
  }
  return c.json({ id }, 201);
});

// POST /api/community/report {kind, id} — denúncia marca flagged (fila de moderação P1 = SQL)
app.post("/api/community/report", requireParent, async (c) => {
  const parentId = c.get("parentId");
  const { kind, id } = await readJson(
    c,
    z.object({ kind: z.enum(["post", "reply"]), id: z.string().min(1) }),
  );
  const table = kind === "post" ? "community_posts" : "community_replies";
  const r = db.prepare(`UPDATE ${table} SET flagged = 1 WHERE id = ?`).run(id);
  if (Number(r.changes) === 0) throw notFound("not_found", "Conteúdo não encontrado.");
  audit(`parent:${parentId}`, "community_report", `${kind}:${id}`);
  return c.json({ ok: true });
});

export default app;
