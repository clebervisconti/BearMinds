// Trilha de auditoria (accountability LGPD — spec 03/09). Toda ação relevante entra aqui.
import { db, newId, nowIso } from "../db.ts";

const stmt = db.prepare(
  `INSERT INTO audit_log (id, at, actor, action, entity, detail_json) VALUES (?, ?, ?, ?, ?, ?)`,
);

export function audit(
  actor: string,
  action: string,
  entity?: string | null,
  detail?: Record<string, unknown>,
): void {
  stmt.run(newId(), nowIso(), actor, action, entity ?? null, detail ? JSON.stringify(detail) : null);
}
