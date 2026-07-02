// Retriever BM25 (minisearch) sobre corpus_chunks — grounding do motor de geração (spec 05).
// A recuperação é SEMPRE escopada por bncc_code: o modelo só pode citar chunks daquela
// habilidade. Se não há chunk para o code → sem grounding → o motor RECUSA.
import MiniSearch from "minisearch";
import { db } from "../db.ts";

export interface Chunk {
  id: string;
  bncc_code: string;
  source_title: string;
  source_ref: string;
  content: string;
}

let index: MiniSearch | null = null;

function buildIndex(): MiniSearch {
  const rows = db
    .prepare("SELECT id, bncc_code, source_title, source_ref, content FROM corpus_chunks")
    .all() as Chunk[];
  const ms = new MiniSearch({
    idField: "id",
    fields: ["content", "source_title"],
    storeFields: ["bncc_code", "source_ref", "source_title", "content"],
    searchOptions: { boost: { content: 2 }, fuzzy: 0.2, prefix: true },
  });
  ms.addAll(rows);
  index = ms;
  return ms;
}

export function rebuildIndex(): void {
  buildIndex();
}

/** Retorna os chunks que embasam `bnccCode`, ranqueados por relevância à `query`. */
export function retrieve(bnccCode: string, query: string, limit = 6): Chunk[] {
  const all = db
    .prepare("SELECT id, bncc_code, source_title, source_ref, content FROM corpus_chunks WHERE bncc_code = ?")
    .all(bnccCode) as Chunk[];
  if (all.length === 0) return [];
  if (!query || !query.trim()) return all.slice(0, limit);

  const idx = index ?? buildIndex();
  const ranked: Chunk[] = [];
  const seen = new Set<string>();
  for (const r of idx.search(query)) {
    if ((r as unknown as Chunk).bncc_code !== bnccCode) continue;
    const c = all.find((a) => a.id === r.id);
    if (c && !seen.has(c.id)) {
      ranked.push(c);
      seen.add(c.id);
    }
  }
  // garante grounding completo: acrescenta chunks do code não retornados pela busca
  for (const c of all) if (!seen.has(c.id)) ranked.push(c);
  return ranked.slice(0, limit);
}

/** Bloco de contexto formatado para o prompt, com source_id por chunk (grounding por claim). */
export function contextBlock(chunks: Chunk[]): string {
  return chunks
    .map((c) => `[source_id=${c.id}] ${c.content} (fonte: ${c.source_title}, ${c.source_ref})`)
    .join("\n");
}
