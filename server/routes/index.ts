import type { Hono } from "hono";
import { securityHeaders } from "../middleware/security.ts";
import { appVersion } from "../version.ts";
import { llmConfigured } from "../env.ts";
import { dbHealth } from "../db.ts";
import authRoutes from "./auth.ts";
import catalogRoutes from "./catalog.ts";
import generateRoutes from "./generate.ts";
import masteryRoutes from "./mastery.ts";
import parentRoutes from "./parent.ts";
import meRoutes from "./me.ts";

// Registro central de rotas. Cada spec adiciona seu módulo aqui.
export function mountRoutes(app: Hono) {
  app.use("*", securityHeaders);

  // Deploy gate (spec 10.3)
  app.get("/api/health", (c) =>
    c.json({
      ok: true,
      version: appVersion,
      db: dbHealth() ? "up" : "down",
      llm: llmConfigured ? "configured" : "unconfigured",
    }),
  );

  app.route("/", authRoutes);
  app.route("/", meRoutes);
  app.route("/", catalogRoutes);
  app.route("/", generateRoutes);
  app.route("/", masteryRoutes);
  app.route("/", parentRoutes);
}
