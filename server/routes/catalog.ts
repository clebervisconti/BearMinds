// Catálogo: instituições, árvore (turma→disciplina→trimestre→tópicos BNCC), resolução de tópico.
// GETs são públicos (spec 01: /api/* exceto auth e catalog GET exigem parent).
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db.ts";
import { readJson, type AppEnv } from "../lib/http.ts";
import { csrfGuard } from "../lib/session.ts";
import { resolveTopic } from "../gen/resolve.ts";
import type { Institution, TopicNode } from "../../shared/contracts.ts";

const app = new Hono<AppEnv>();
app.use("/api/catalog/resolve-topic", csrfGuard);

// GET /api/catalog/institutions
app.get("/api/catalog/institutions", (c) => {
  const rows = db
    .prepare("SELECT id, name, kind, config_json FROM institutions WHERE active = 1 ORDER BY kind DESC, name")
    .all() as { id: string; name: string; kind: string; config_json: string }[];
  const out: Institution[] = rows.map((r) => {
    const cfg = JSON.parse(r.config_json) as {
      classes: Institution["classes"];
      subjects: Institution["subjects"];
      terms: string[];
    };
    return {
      id: r.id,
      name: r.name,
      kind: r.kind as Institution["kind"],
      classes: cfg.classes ?? [],
      subjects: cfg.subjects ?? [],
      terms: cfg.terms ?? ["t1", "t2", "t3"],
    };
  });
  return c.json({ institutions: out });
});

// GET /api/catalog/tree?institution=&class=&subject=&term=
app.get("/api/catalog/tree", (c) => {
  const institution = c.req.query("institution") || "bncc-padrao";
  const klass = c.req.query("class") || "";
  const subject = c.req.query("subject") || "";
  const term = c.req.query("term");

  let sql =
    `SELECT m.bncc_code, COALESCE(m.title, s.description) AS title, s.description, s.verified_at
     FROM curriculum_map m JOIN bncc_skills s ON s.code = m.bncc_code
     WHERE m.institution_id = ? AND m.class_id = ? AND m.subject_id = ?`;
  const params: unknown[] = [institution, klass, subject];
  if (term) {
    sql += " AND m.term = ?";
    params.push(term);
  }
  sql += " ORDER BY m.display_order, title";
  const rows = db.prepare(sql).all(...params) as {
    bncc_code: string; title: string; description: string; verified_at: string | null;
  }[];

  const hasCache = db.prepare(
    "SELECT 1 FROM generated_artifacts WHERE bncc_code = ? AND kind = 'lesson' LIMIT 1",
  );
  const atomCount = db.prepare("SELECT COUNT(*) n FROM knowledge_atoms WHERE bncc_code = ?");

  const topics: TopicNode[] = rows
    .filter((r) => r.verified_at) // só habilidades verificadas são servíveis (spec 02)
    .map((r) => ({
      bncc_code: r.bncc_code,
      title: r.title,
      description: r.description,
      has_cache: !!hasCache.get(r.bncc_code),
      atom_count: (atomCount.get(r.bncc_code) as { n: number }).n,
    }));

  return c.json({ topics });
});

// POST /api/catalog/resolve-topic {text, grade}
const resolveSchema = z.object({ text: z.string().trim().min(1).max(160), grade: z.string().max(8).optional() });

app.post("/api/catalog/resolve-topic", async (c) => {
  const { text, grade } = await readJson(c, resolveSchema);
  const candidates = await resolveTopic(text, grade);
  return c.json({ candidates });
});

export default app;
