import type { Hono } from "hono";
import type { AppEnv } from "../lib/http.ts";
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
import notificationRoutes from "./notifications.ts";
import gamificationRoutes from "./gamification.ts";
import communityRoutes from "./community.ts";
import adminRoutes from "./admin.ts";
import authoringRoutes from "./authoring.ts";
import enrichRoutes from "./enrich.ts";
import learnRoutes from "./learn.ts";
import liveRoutes from "./live.ts";
import chatRoutes from "./chat.ts";
import coachingRoutes from "./coaching.ts";
import certificateRoutes from "./certificates.ts";
import moderationRoutes from "./moderation.ts";

// Registro central de rotas. Cada spec adiciona seu módulo aqui.
export function mountRoutes(app: Hono<AppEnv>) {
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
  app.route("/", notificationRoutes);
  app.route("/", gamificationRoutes);
  app.route("/", communityRoutes);
  app.route("/", adminRoutes);
  app.route("/", authoringRoutes);
  app.route("/", enrichRoutes);
  app.route("/", learnRoutes);
  app.route("/", liveRoutes);
  app.route("/", chatRoutes);
  app.route("/", coachingRoutes);
  app.route("/", certificateRoutes);
  app.route("/", moderationRoutes);
}
