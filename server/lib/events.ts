// Events stream (spec 15.1): tabela única de eventos estruturados que alimenta relatórios e analytics.
// Regra: SEM PII no payload (só ids). Todo recurso novo emite; consumidores (relatórios) leem daqui.
import { db, newId, nowIso } from "../db.ts";

export type Actor =
  | { kind: "child"; id: string }
  | { kind: "parent"; id: string }
  | { kind: "system"; id?: null };

export interface EventRefs {
  course_id?: string | null;
  ref_kind?: string | null;   // 'item' | 'module' | 'exam' | 'submission' | 'live' | ...
  ref_id?: string | null;
}

/** Emite um evento. Best-effort: nunca deixa uma falha de telemetria quebrar o fluxo de negócio. */
export function emitEvent(kind: string, actor: Actor, refs: EventRefs = {}, payload?: Record<string, unknown>): void {
  try {
    db.prepare(
      `INSERT INTO events (id, kind, actor_kind, actor_id, course_id, ref_kind, ref_id, payload_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      newId(),
      kind,
      actor.kind,
      actor.kind === "system" ? null : actor.id,
      refs.course_id ?? null,
      refs.ref_kind ?? null,
      refs.ref_id ?? null,
      payload ? JSON.stringify(payload) : null,
      nowIso(),
    );
  } catch {
    /* telemetria é best-effort */
  }
}

/** Contagem de eventos de um curso por kind (base dos relatórios de participação — spec 15.1). */
export function courseEventCounts(courseId: string, since?: string): Record<string, number> {
  const rows = db.prepare(
    `SELECT kind, COUNT(*) n FROM events WHERE course_id = ? ${since ? "AND created_at >= ?" : ""} GROUP BY kind`,
  ).all(...(since ? [courseId, since] : [courseId])) as { kind: string; n: number }[];
  return Object.fromEntries(rows.map((r) => [r.kind, r.n]));
}

/** Poda de retenção (spec 15.1): eventos com mais de `days` dias (chamado pelo job nightly). */
export function pruneEvents(days = 365): number {
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  const r = db.prepare("DELETE FROM events WHERE created_at < ?").run(cutoff);
  return Number(r.changes);
}
