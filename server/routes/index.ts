import type { Hono } from "hono";
import type { AppEnv } from "../lib/http.ts";
import { securityHeaders } from "../middleware/security.ts";
import { appVersion } from "../version.ts";
import { llmConfigured } from "../env.ts";
import { dbHealth, getDbDetailedHealth } from "../db.ts";
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
import bankRoutes from "./bank.ts";
import assignmentRoutes from "./assignments.ts";
import gradesRoutes from "./grades.ts";
import timelineRoutes from "./timeline.ts";
import groupsRoutes from "./groups.ts";
import quickUpdateRoutes from "./quickupdates.ts";
import exemplarRoutes from "./exemplars.ts";
import selfAssessRoutes from "./selfassess.ts";
import readinessRoutes from "./readiness.ts";
import missionRoutes from "./missions.ts";
import paywallRoutes from "./paywall.ts";
import correlationRoutes from "./correlation.ts";

// Registro central de rotas. Cada spec adiciona seu módulo aqui.
export function mountRoutes(app: Hono<AppEnv>) {
  app.use("*", securityHeaders);

  // Deploy gate (spec 10.3)
  app.get("/api/health", (c) => {
    const dbDetail = getDbDetailedHealth();
    return c.json({
      ok: dbDetail.status === "up",
      version: appVersion,
      db: dbDetail.status,
      db_detail: dbDetail,
      llm: llmConfigured ? "configured" : "unconfigured",
      otel: process.env.OTEL_ENABLED === "true" ? "active" : "disabled",
    });
  });

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
  app.route("/", bankRoutes);
  app.route("/", assignmentRoutes);
  app.route("/", gradesRoutes);
  app.route("/", timelineRoutes);
  app.route("/", groupsRoutes);
  app.route("/", quickUpdateRoutes);
  app.route("/", exemplarRoutes);
  app.route("/", selfAssessRoutes);
  app.route("/", readinessRoutes);
  app.route("/", missionRoutes);
  app.route("/", paywallRoutes);
  app.route("/", correlationRoutes);
}
