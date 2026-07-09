// Missions-lite (spec 17.5) — retenção limitada de mídia gravada (LGPD dedicado): poda o que passou
// de retention_until, best-effort, chamada pelo job nightly.
import { existsSync, unlinkSync } from "node:fs";
import { db } from "../db.ts";
import { logger } from "../logger.ts";

export const MISSION_RETENTION_DAYS = 180;

export function pruneExpiredMissions(now = new Date()): number {
  const rows = db.prepare(
    "SELECT ms.id, ms.file_id, f.path FROM mission_submissions ms LEFT JOIN files f ON f.id = ms.file_id WHERE ms.retention_until <= ?",
  ).all(now.toISOString()) as { id: string; file_id: string; path: string | null }[];

  let pruned = 0;
  for (const r of rows) {
    try {
      if (r.path && existsSync(r.path)) unlinkSync(r.path);
      db.prepare("DELETE FROM mission_reviews WHERE mission_submission_id = ?").run(r.id);
      db.prepare("DELETE FROM mission_submissions WHERE id = ?").run(r.id);
      if (r.file_id) db.prepare("DELETE FROM files WHERE id = ?").run(r.file_id);
      pruned++;
    } catch (e) {
      logger.error({ err: String(e), missionId: r.id }, "erro ao podar mission expirada");
    }
  }
  return pruned;
}
