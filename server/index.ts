// Bootstrap da API BearMinds (Hono sobre Node). IMPORTAR env PRIMEIRO.
import { env } from "./env.ts";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { logger } from "./logger.ts";
import { initDb } from "./db.ts";
import { mountRoutes } from "./routes/index.ts";
import { appVersion } from "./version.ts";

// 1) Sobe o schema do SQLite (idempotente) antes de aceitar tráfego.
initDb();

const app = new Hono();

// 2) Rotas da API + headers de segurança.
mountRoutes(app);

// 3) Em produção, o Node também pode servir o dist/ (SPA) — no VPS o OLS faz isso,
//    mas isto mantém `npm start` autossuficiente e o health check simples.
const distDir = "./dist";
const serveDist = env.isProd && existsSync(distDir);
if (serveDist) {
  app.use("/*", serveStatic({ root: distDir }));
  // Fallback SPA: qualquer rota não-API e não-arquivo → index.html.
  app.get("*", async (c) => {
    if (c.req.path.startsWith("/api/")) return c.notFound();
    try {
      const html = await readFile(`${distDir}/index.html`, "utf8");
      return c.html(html);
    } catch {
      return c.notFound();
    }
  });
}

serve({ fetch: app.fetch, port: env.port }, (info) => {
  logger.info(
    { port: info.port, version: appVersion, env: env.isProd ? "prod" : "dev", serveDist },
    `BearMinds API on :${info.port}`,
  );
});
