// Config chave→valor da plataforma (app_settings). Cache em memória invalidado no set.
import { db, nowIso } from "../db.ts";

const cache = new Map<string, string | null>();

export function getSetting(key: string): string | null {
  if (cache.has(key)) return cache.get(key) ?? null;
  const row = db.prepare("SELECT value FROM app_settings WHERE key = ?").get(key) as { value: string } | undefined;
  const val = row?.value ?? null;
  cache.set(key, val);
  return val;
}

export function setSetting(key: string, value: string): void {
  db.prepare(
    "INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
  ).run(key, value, nowIso());
  cache.set(key, value);
}
