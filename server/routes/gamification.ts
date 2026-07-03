// Moedas, conquistas e leaderboard POR INSTITUIÇÃO (spec 12.3–12.4).
import { Hono } from "hono";
import { db } from "../db.ts";
import { requireParent, ownChildOrThrow } from "../lib/session.ts";
import { notFound, type AppEnv } from "../lib/http.ts";
import { coinBalance, weekCoins } from "../gamify.ts";
import type { CoinState, LeaderboardEntry } from "../../shared/contracts.ts";

const app = new Hono<AppEnv>();

// GET /api/coins?child_id
app.get("/api/coins", requireParent, (c) => {
  const parentId = c.get("parentId");
  const childId = c.req.query("child_id") || c.get("activeChildId") || "";
  if (!childId) throw notFound("no_child", "Nenhum perfil ativo.");
  ownChildOrThrow(parentId, childId);

  const ledger = db
    .prepare(
      "SELECT delta, reason, created_at FROM coin_ledger WHERE child_id = ? ORDER BY created_at DESC LIMIT 30",
    )
    .all(childId) as { delta: number; reason: string; created_at: string }[];
  const achievements = db
    .prepare("SELECT code, unlocked_at FROM achievements WHERE child_id = ? ORDER BY unlocked_at DESC")
    .all(childId) as { code: string; unlocked_at: string }[];

  const state: CoinState = {
    balance: coinBalance(childId),
    week: weekCoins(childId),
    ledger,
    achievements,
  };
  return c.json(state);
});

// GET /api/leaderboard?child_id — ranking semanal DENTRO da instituição do perfil (spec 12.4)
app.get("/api/leaderboard", requireParent, (c) => {
  const parentId = c.get("parentId");
  const childId = c.req.query("child_id") || c.get("activeChildId") || "";
  if (!childId) throw notFound("no_child", "Nenhum perfil ativo.");
  ownChildOrThrow(parentId, childId);

  const me = db
    .prepare("SELECT COALESCE(institution_id,'bncc-padrao') AS inst FROM children WHERE id = ?")
    .get(childId) as { inst: string } | undefined;
  if (!me) throw notFound("child_not_found", "Perfil não encontrado.");

  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const rows = db
    .prepare(
      `SELECT ch.id, ch.display_name, COALESCE(SUM(l.delta), 0) AS coins
       FROM children ch
       LEFT JOIN coin_ledger l ON l.child_id = ch.id AND l.created_at >= ?
       WHERE COALESCE(ch.institution_id,'bncc-padrao') = ?
         AND ch.deleted_at IS NULL AND ch.leaderboard_hidden = 0
       GROUP BY ch.id
       HAVING coins > 0
       ORDER BY coins DESC, ch.display_name
       LIMIT 20`,
    )
    .all(since, me.inst) as { id: string; display_name: string; coins: number }[];

  const entries: LeaderboardEntry[] = rows.map((r, i) => ({
    rank: i + 1,
    display_name: r.display_name, // apelido apenas — minimização (spec 12.4)
    coins: r.coins,
    me: r.id === childId,
  }));

  const myWeek = weekCoins(childId);
  const inList = entries.find((e) => e.me);
  const instName = db.prepare("SELECT name FROM institutions WHERE id = ?").get(me.inst) as
    | { name: string }
    | undefined;

  return c.json({
    institution: instName?.name ?? me.inst,
    entries,
    me: { rank: inList?.rank ?? null, coins: myWeek },
  });
});

export default app;
