// SQLite — conexão, schema idempotente e migrações aditivas (spec 02).
//
// Motor: `node:sqlite` (built-in, Node ≥ 22.5) atrás de um adaptador que preserva a
// API estilo better-sqlite3 (prepare/run/get/all + pragma + transaction). Motivo:
// better-sqlite3 (nativo) não compila contra o V8 do Node 26. node:sqlite não tem
// build nativo — mais robusto no dev e no deploy. Ver specs/CHANGELOG.md.
import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { nanoid } from "nanoid";
import { env } from "./env.ts";

// Carrega o builtin via require em runtime (opaco ao transform do Vite/Vitest, que ainda
// não reconhece `node:sqlite`). O import type acima é apagado na compilação.
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: typeof DatabaseSyncType;
};

mkdirSync(dirname(env.databasePath), { recursive: true });

type Row = Record<string, unknown>;
export interface Stmt {
  run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  get<T = Row>(...params: unknown[]): T | undefined;
  all<T = Row>(...params: unknown[]): T[];
}

const raw = new DatabaseSync(env.databasePath);
raw.exec("PRAGMA journal_mode = WAL");
raw.exec("PRAGMA foreign_keys = ON");
raw.exec("PRAGMA busy_timeout = 5000");

let txDepth = 0;

// Adaptador com a superfície mínima usada em todo o servidor.
export const db = {
  prepare(sql: string): Stmt {
    return raw.prepare(sql) as unknown as Stmt;
  },
  exec(sql: string): void {
    raw.exec(sql);
  },
  // Compat com db.pragma(): "x = v" → exec; "x" → get; opts.simple → valor escalar.
  pragma(stmt: string, opts?: { simple?: boolean }): unknown {
    if (stmt.includes("=")) {
      raw.exec(`PRAGMA ${stmt}`);
      return undefined;
    }
    const row = raw.prepare(`PRAGMA ${stmt}`).get() as Row | undefined;
    if (!row) return undefined;
    const val = Object.values(row)[0];
    return opts?.simple ? val : row;
  },
  // Retorna uma função que roda fn numa transação (SAVEPOINT se aninhada). Rollback em erro.
  transaction<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
    return (...args: A): R => {
      const nested = txDepth > 0;
      const sp = `bm_sp_${txDepth}`;
      raw.exec(nested ? `SAVEPOINT ${sp}` : "BEGIN");
      txDepth++;
      try {
        const r = fn(...args);
        txDepth--;
        raw.exec(nested ? `RELEASE ${sp}` : "COMMIT");
        return r;
      } catch (e) {
        txDepth--;
        raw.exec(nested ? `ROLLBACK TO ${sp}` : "ROLLBACK");
        throw e;
      }
    };
  },
};

export const newId = () => nanoid();
export const nowIso = () => new Date().toISOString();

// ---- Schema (CREATE TABLE IF NOT EXISTS — aditivo apenas no P1) ----
const SCHEMA = /* sql */ `
-- ===== AUTH & CONSENT (parent-fronted) =====
CREATE TABLE IF NOT EXISTS parents (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  email_verified INTEGER DEFAULT 0,
  password_hash TEXT NOT NULL,               -- bcrypt, cost 12
  full_name_enc TEXT,                        -- AES-256-GCM (PII_ENCRYPTION_KEY); nullable
  created_at TEXT NOT NULL,
  deleted_at TEXT
);

-- ===== INSTITUTIONS & CURRICULUM CATALOG =====
CREATE TABLE IF NOT EXISTS institutions (
  id TEXT PRIMARY KEY,                        -- 'bncc-padrao' | 'maple-bear' | future
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('default','network','school')),
  locale TEXT DEFAULT 'pt-BR',
  active INTEGER DEFAULT 1,
  config_json TEXT
);

-- ===== BNCC CORPUS (moat #1) =====
CREATE TABLE IF NOT EXISTS bncc_skills (
  code TEXT PRIMARY KEY,                      -- e.g. 'EF06MA07'
  stage TEXT, grade_band TEXT, area TEXT, component TEXT,
  description TEXT NOT NULL, objects TEXT,
  verified_by TEXT, verified_at TEXT          -- verificação = sign-off humano; sem isso NÃO é servível
);

CREATE TABLE IF NOT EXISTS children (
  id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL REFERENCES parents(id),
  display_name TEXT NOT NULL,                 -- apelido apenas (minimização)
  birth_year INTEGER NOT NULL,
  grade TEXT NOT NULL,                        -- e.g. '6EF', '1EM'
  age_band TEXT NOT NULL CHECK(age_band IN ('8-10','11-14','15-18')),
  institution_id TEXT REFERENCES institutions(id),   -- NULL = BNCC padrão
  class_id TEXT,                              -- classe da instituição (e.g. 'y5')
  subjects_json TEXT,                         -- disciplinas escolhidas no onboarding
  priority_subject TEXT,
  avatar_seed TEXT,
  created_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS consents (
  id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL,
  child_id TEXT NOT NULL,
  scope TEXT NOT NULL CHECK(scope IN ('account','ai_generation','progress_tracking','email_updates')),
  granted INTEGER NOT NULL,
  policy_version TEXT NOT NULL,
  granted_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL,
  active_child_id TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  user_agent TEXT
);

CREATE TABLE IF NOT EXISTS curriculum_map (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id),
  class_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  term TEXT,
  bncc_code TEXT NOT NULL REFERENCES bncc_skills(code),
  title TEXT,                                 -- rótulo do tópico exibido ao aluno
  display_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS corpus_chunks (
  id TEXT PRIMARY KEY,
  bncc_code TEXT NOT NULL REFERENCES bncc_skills(code),
  source_title TEXT, source_ref TEXT,
  content TEXT NOT NULL,
  embedding BLOB
);

-- ===== GENERATED ARTIFACTS (cache ⇒ reuso custo $0) =====
CREATE TABLE IF NOT EXISTS generated_artifacts (
  id TEXT PRIMARY KEY,
  bncc_code TEXT NOT NULL,
  grade_band TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('lesson','explorable','quiz')),
  age_band TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  citations_json TEXT,
  model_used TEXT NOT NULL,
  safety_passed INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE(bncc_code, grade_band, kind, age_band)
);

-- ===== MASTERY (moat #2, FSRS D-S-R) =====
CREATE TABLE IF NOT EXISTS knowledge_atoms (
  id TEXT PRIMARY KEY,
  bncc_code TEXT NOT NULL,
  atom_text TEXT NOT NULL,
  prereq_atom_id TEXT
);

CREATE TABLE IF NOT EXISTS mastery_state (
  child_id TEXT NOT NULL,
  atom_id TEXT NOT NULL,
  stability REAL DEFAULT 0,
  difficulty REAL DEFAULT 5,
  retrievability REAL,
  state TEXT DEFAULT 'new' CHECK(state IN ('new','learning','review','relearning')),
  reps INTEGER DEFAULT 0,
  lapses INTEGER DEFAULT 0,
  last_review TEXT,
  due TEXT,
  PRIMARY KEY (child_id, atom_id)
);

CREATE TABLE IF NOT EXISTS study_sessions (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL,
  bncc_code TEXT,
  atom_id TEXT,
  started_at TEXT, ended_at TEXT,
  duration_sec INTEGER,
  rating INTEGER                              -- FSRS rating 1..4
);

CREATE TABLE IF NOT EXISTS prova_calendar (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL,
  title TEXT,
  subject_id TEXT,
  exam_date TEXT NOT NULL,
  bncc_codes TEXT NOT NULL,                   -- JSON array
  result_rating INTEGER,                      -- "como foi?" 1..5 (pós-prova)
  created_at TEXT
);

-- ===== GAMIFICATION (07) =====
CREATE TABLE IF NOT EXISTS habit_log (
  child_id TEXT NOT NULL,
  day TEXT NOT NULL,                          -- 'YYYY-MM-DD' local America/Sao_Paulo
  learning_events INTEGER DEFAULT 0,
  freeze_used INTEGER DEFAULT 0,
  PRIMARY KEY (child_id, day)
);

-- ===== AUDIT (LGPD accountability) =====
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  entity TEXT,
  detail_json TEXT
);

-- ===== METRICS (privacy-preserving, agregados — spec 09.3) =====
CREATE TABLE IF NOT EXISTS metrics_daily (
  day TEXT PRIMARY KEY,
  active_children INTEGER DEFAULT 0,
  learning_events INTEGER DEFAULT 0,
  generations INTEGER DEFAULT 0,
  cache_hits INTEGER DEFAULT 0,
  computed_at TEXT
);

-- ===== ÍNDICES =====
CREATE INDEX IF NOT EXISTS idx_children_parent ON children(parent_id);
CREATE INDEX IF NOT EXISTS idx_consents_lookup ON consents(parent_id, child_id, scope);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_curmap_lookup ON curriculum_map(institution_id, class_id, subject_id, term);
CREATE INDEX IF NOT EXISTS idx_curmap_code ON curriculum_map(bncc_code);
CREATE INDEX IF NOT EXISTS idx_chunks_code ON corpus_chunks(bncc_code);
CREATE INDEX IF NOT EXISTS idx_atoms_code ON knowledge_atoms(bncc_code);
CREATE INDEX IF NOT EXISTS idx_mastery_due ON mastery_state(child_id, due);
CREATE INDEX IF NOT EXISTS idx_study_child ON study_sessions(child_id);
CREATE INDEX IF NOT EXISTS idx_prova_child ON prova_calendar(child_id, exam_date);
`;

// ---- Migrações versionadas (aditivas). Bump SCHEMA_VERSION ao adicionar. ----
const SCHEMA_VERSION = 1;
let initialized = false;

export function initDb(): void {
  if (initialized) return;
  db.exec(SCHEMA);
  const row = db.pragma("user_version", { simple: true }) as number;
  if (row < SCHEMA_VERSION) {
    // Futuras migrações aditivas entram aqui, guardadas por versão.
    db.pragma(`user_version = ${SCHEMA_VERSION}`);
  }
  initialized = true;
}

export function dbHealth(): boolean {
  try {
    db.prepare("SELECT 1").get();
    return true;
  } catch {
    return false;
  }
}

// Auto-inicializa ao importar, garantindo que o schema exista para qualquer consumidor.
initDb();
