// Popula o SQLite com instituições, catálogo BNCC, corpus e atoms — idempotente.
// Uso: npm run seed
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { db, initDb } from "../db.ts";

initDb();

const read = (p: string) => JSON.parse(readFileSync(resolve(process.cwd(), p), "utf8"));

type Skill = {
  code: string; stage?: string; grade_band?: string; area?: string; component?: string;
  description: string; objects?: string; verified_by?: string; verified_at?: string;
  chunks?: { id: string; source_title?: string; source_ref?: string; content: string }[];
  atoms?: { id: string; atom_text: string; prereq_id?: string }[];
};

const bncc = read("seed/bncc.seed.json") as { skills: Skill[] };
const inst = read("seed/institutions.seed.json") as {
  institutions: { id: string; name: string; kind: string; locale?: string; config: unknown }[];
  curriculum_map: {
    institution_id: string; class_id: string; subject_id: string; term?: string;
    bncc_code: string; title?: string; display_order?: number;
  }[];
};

const upSkill = db.prepare(`INSERT OR REPLACE INTO bncc_skills
  (code, stage, grade_band, area, component, description, objects, verified_by, verified_at)
  VALUES (@code, @stage, @grade_band, @area, @component, @description, @objects, @verified_by, @verified_at)`);
const upChunk = db.prepare(`INSERT OR REPLACE INTO corpus_chunks
  (id, bncc_code, source_title, source_ref, content) VALUES (@id, @bncc_code, @source_title, @source_ref, @content)`);
const upAtom = db.prepare(`INSERT OR REPLACE INTO knowledge_atoms
  (id, bncc_code, atom_text, prereq_atom_id) VALUES (@id, @bncc_code, @atom_text, @prereq_atom_id)`);
const upInst = db.prepare(`INSERT OR REPLACE INTO institutions
  (id, name, kind, locale, active, config_json) VALUES (@id, @name, @kind, @locale, 1, @config_json)`);
const upMap = db.prepare(`INSERT OR REPLACE INTO curriculum_map
  (id, institution_id, class_id, subject_id, term, bncc_code, title, display_order)
  VALUES (@id, @institution_id, @class_id, @subject_id, @term, @bncc_code, @title, @display_order)`);

const run = db.transaction(() => {
  let nSkills = 0, nChunks = 0, nAtoms = 0, nInst = 0, nMap = 0;

  for (const s of bncc.skills) {
    upSkill.run({
      code: s.code, stage: s.stage ?? null, grade_band: s.grade_band ?? null,
      area: s.area ?? null, component: s.component ?? null, description: s.description,
      objects: s.objects ?? null, verified_by: s.verified_by ?? null, verified_at: s.verified_at ?? null,
    });
    nSkills++;
    for (const ch of s.chunks ?? []) {
      upChunk.run({
        id: ch.id, bncc_code: s.code, source_title: ch.source_title ?? null,
        source_ref: ch.source_ref ?? null, content: ch.content,
      });
      nChunks++;
    }
    for (const a of s.atoms ?? []) {
      upAtom.run({ id: a.id, bncc_code: s.code, atom_text: a.atom_text, prereq_atom_id: a.prereq_id ?? null });
      nAtoms++;
    }
  }

  for (const i of inst.institutions) {
    upInst.run({
      id: i.id, name: i.name, kind: i.kind, locale: i.locale ?? "pt-BR",
      config_json: JSON.stringify(i.config),
    });
    nInst++;
  }
  for (const m of inst.curriculum_map) {
    const id = `${m.institution_id}:${m.class_id}:${m.subject_id}:${m.term ?? ""}:${m.bncc_code}`;
    upMap.run({
      id, institution_id: m.institution_id, class_id: m.class_id, subject_id: m.subject_id,
      term: m.term ?? null, bncc_code: m.bncc_code, title: m.title ?? null,
      display_order: m.display_order ?? 0,
    });
    nMap++;
  }

  return { nSkills, nChunks, nAtoms, nInst, nMap };
});

const r = run();
console.log("✅ Seed concluído (idempotente):");
console.log(`   • instituições: ${r.nInst}`);
console.log(`   • curriculum_map: ${r.nMap}`);
console.log(`   • bncc_skills: ${r.nSkills}`);
console.log(`   • corpus_chunks: ${r.nChunks}`);
console.log(`   • knowledge_atoms: ${r.nAtoms}`);
