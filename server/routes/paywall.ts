// Founding-member paywall (P5-r, roadmap 11): link de pagamento MANUAL (Pix/Stripe), sem integração
// de gateway — o owner cola um link de pagamento avulso/anual-prepago; após confirmar o pagamento FORA
// do sistema, marca manualmente o responsável como founding member. Sem processamento de cartão/PIX
// dentro do produto (não há credencial de gateway configurada nesta base).
import { Hono } from "hono";
import { z } from "zod";
import { db, nowIso } from "../db.ts";
import { requireParent, requireRole, csrfGuard } from "../lib/session.ts";
import { readJson, notFound, type AppEnv } from "../lib/http.ts";
import { getSetting, setSetting } from "../lib/settings.ts";
import { audit } from "../lib/audit.ts";

const app = new Hono<AppEnv>();
app.use("/api/admin/paywall*", csrfGuard);

app.get("/api/paywall", requireParent, (c) => {
  const parentId = c.get("parentId");
  const parent = db.prepare("SELECT founding_member_at FROM parents WHERE id = ?").get(parentId) as { founding_member_at: string | null } | undefined;
  return c.json({
    link: getSetting("founding_member_link"),
    price_label: getSetting("founding_member_price_label"),
    is_founding_member: !!parent?.founding_member_at,
  });
});

app.get("/api/admin/paywall", requireParent, requireRole("platform_admin"), (c) => {
  const count = (db.prepare("SELECT COUNT(*) n FROM parents WHERE founding_member_at IS NOT NULL").get() as { n: number }).n;
  return c.json({
    link: getSetting("founding_member_link"),
    price_label: getSetting("founding_member_price_label"),
    founding_members_count: count,
  });
});

app.post("/api/admin/paywall", requireParent, requireRole("platform_admin"), async (c) => {
  const parentId = c.get("parentId");
  const { link, price_label } = await readJson(c, z.object({
    link: z.string().trim().url().max(500),
    price_label: z.string().trim().min(1).max(80),
  }));
  setSetting("founding_member_link", link);
  setSetting("founding_member_price_label", price_label);
  audit(`parent:${parentId}`, "paywall_config_update", "app_settings:founding_member", { price_label });
  return c.json({ ok: true });
});

app.get("/api/admin/paywall/members", requireParent, requireRole("platform_admin"), (c) => {
  const rows = db.prepare(
    "SELECT id, email, founding_member_at FROM parents WHERE founding_member_at IS NOT NULL ORDER BY founding_member_at DESC",
  ).all();
  return c.json({ members: rows });
});

app.post("/api/admin/parents/:id/founding-member", requireParent, requireRole("platform_admin"), async (c) => {
  const targetId = c.req.param("id");
  const parentId = c.get("parentId");
  const target = db.prepare("SELECT id FROM parents WHERE id = ?").get(targetId);
  if (!target) throw notFound("parent_not_found", "Responsável não encontrado.");
  const { granted } = await readJson(c, z.object({ granted: z.boolean() }));
  db.prepare("UPDATE parents SET founding_member_at = ? WHERE id = ?").run(granted ? nowIso() : null, targetId);
  audit(`parent:${parentId}`, granted ? "founding_member_grant" : "founding_member_revoke", `parent:${targetId}`);
  return c.json({ ok: true });
});

// Marca a si mesmo (fluxo simples: platform_admin busca por e-mail e confirma).
app.post("/api/admin/paywall/mark-by-email", requireParent, requireRole("platform_admin"), async (c) => {
  const parentId = c.get("parentId");
  const { email, granted } = await readJson(c, z.object({ email: z.string().trim().email(), granted: z.boolean() }));
  const target = db.prepare("SELECT id FROM parents WHERE email = ?").get(email.toLowerCase()) as { id: string } | undefined;
  if (!target) throw notFound("parent_not_found", "Nenhum responsável com este e-mail.");
  db.prepare("UPDATE parents SET founding_member_at = ? WHERE id = ?").run(granted ? nowIso() : null, target.id);
  audit(`parent:${parentId}`, granted ? "founding_member_grant" : "founding_member_revoke", `parent:${target.id}`, { via: "email" });
  return c.json({ ok: true, id: target.id });
});

export default app;
