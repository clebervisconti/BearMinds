import "./instrumentation.ts";
import { env } from "./env.ts";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { shutdownTelemetry } from "./instrumentation.ts";
import { closeDb } from "./db.ts";
import { serveStatic } from "@hono/node-server/serve-static";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { logger } from "./logger.ts";
import { initDb } from "./db.ts";
import { mountRoutes } from "./routes/index.ts";
import { appVersion } from "./version.ts";
import { AppError, type AppEnv } from "./lib/http.ts";
import { gateMiddleware, mountGate, gateEnabled } from "./lib/gate.ts";
import { attachWebSocketServer } from "./ws/server.ts";

// 1) Sobe o schema do SQLite (idempotente) antes de aceitar tráfego.
initDb();

const app = new Hono<AppEnv>();

// Erros tipados → {error:{code,message}}; erros inesperados → 500 genérico (sem vazar detalhe).
app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json({ error: { code: err.code, message: err.message } }, err.status as 400);
  }
  logger.error({ err: String(err), path: c.req.path }, "unhandled error");
  return c.json({ error: { code: "internal", message: "Algo deu errado. Tente novamente." } }, 500);
});

app.notFound((c) => c.json({ error: { code: "not_found", message: "Rota não encontrada." } }, 404));

// Gate de validação (Sign in with Apple) — ANTES de tudo. Inerte se GATE_MODE != apple.
mountGate(app);
app.use("*", gateMiddleware);

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

const server = serve({ fetch: app.fetch, port: env.port, hostname: process.env.HOST || undefined }, (info) => {
  logger.info(
    { port: info.port, version: appVersion, env: env.isProd ? "prod" : "dev", serveDist, gate: gateEnabled() ? "apple" : "off" },
    `BearMinds API on :${info.port}`,
  );
});

// P6 (roadmap 11): tempo real para live games + chat, com fallback automático a polling no cliente
// se o upgrade de WebSocket não passar pelo proxy reverso (ver server/ws/server.ts).
attachWebSocketServer(server);

function gracefulShutdown(signal: string) {
  logger.info({ signal }, `Recebido sinal ${signal}. Iniciando shutdown gracioso...`);
  
  server.close(async (err) => {
    if (err) {
      logger.error({ err }, "Erro ao encerrar servidor HTTP");
    } else {
      logger.info("Servidor HTTP encerrado.");
    }
    
    try {
      closeDb();
      logger.info("Conexão do SQLite fechada com sucesso.");
    } catch (e) {
      logger.error({ err: String(e) }, "Erro ao fechar o banco de dados");
    }
    
    await shutdownTelemetry();
    logger.info("Observabilidade finalizada.");
    process.exit(err ? 1 : 0);
  });
  
  // Timeout de escape caso sockets permaneçam travados
  setTimeout(() => {
    logger.error("Shutdown forçado por timeout (10s).");
    process.exit(1);
  }, 10000).unref();
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
