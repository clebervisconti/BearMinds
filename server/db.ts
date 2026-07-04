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

-- ===== PLATFORM v2 (spec 12): notificações, moedas, conquistas, comunidade =====
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL,
  child_id TEXT,
  kind TEXT NOT NULL,                         -- 'achievement' | 'reply' | 'system'
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS coin_ledger (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,                       -- 'review' | 'atom_mastered' | 'streak_7' | 'streak_30'
  ref_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS achievements (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL,
  code TEXT NOT NULL,                         -- first_lesson | streak_7 | streak_30 | atoms_10 | atoms_50 | prova_ready_80
  unlocked_at TEXT NOT NULL,
  UNIQUE(child_id, code)
);

CREATE TABLE IF NOT EXISTS community_posts (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL,
  institution_id TEXT NOT NULL,
  subject_id TEXT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  flagged INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS community_replies (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES community_posts(id),
  child_id TEXT NOT NULL,
  body TEXT NOT NULL,
  flagged INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  deleted_at TEXT
);

-- ===== LMS v3 (spec 13): convites, cursos, conteúdo, matrícula =====
CREATE TABLE IF NOT EXISTS invites (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('professor','tutor','institution_admin','platform_admin')),
  institution_id TEXT,
  token TEXT UNIQUE NOT NULL,
  invited_by TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id),
  subject_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  term TEXT,                                  -- t1|t2|t3|s1|s2|anual
  year INTEGER,
  title TEXT NOT NULL,
  description TEXT,
  cover_emoji TEXT DEFAULT '📘',
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS course_modules (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id),
  title TEXT NOT NULL,
  objectives TEXT,
  display_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS content_items (
  id TEXT PRIMARY KEY,
  module_id TEXT NOT NULL REFERENCES course_modules(id),
  kind TEXT NOT NULL CHECK(kind IN ('video','document','lesson','quiz','game','live','assignment')),
  title TEXT NOT NULL,
  payload_json TEXT,                          -- por kind: {url}|{file_id}|{lesson}|{quiz}|{assignment}|…
  source_file_id TEXT,
  display_order INTEGER DEFAULT 0,
  duration_min INTEGER,
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft','pending_review','published')),
  verified_by TEXT, verified_at TEXT,         -- sign-off humano (mesmo padrão do corpus BNCC)
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  owner_parent_id TEXT NOT NULL,
  kind TEXT NOT NULL,                         -- 'video' | 'document' | 'source'
  original_name TEXT NOT NULL,
  path TEXT NOT NULL,
  mime TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS enrollments (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL,
  course_id TEXT NOT NULL REFERENCES courses(id),
  source TEXT NOT NULL CHECK(source IN ('self','assigned')),
  assigned_by TEXT,
  enrolled_at TEXT NOT NULL,
  completed_at TEXT,
  UNIQUE(child_id, course_id)
);

CREATE TABLE IF NOT EXISTS item_progress (
  child_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  status TEXT DEFAULT 'todo' CHECK(status IN ('todo','doing','done')),
  score REAL,
  attempts INTEGER DEFAULT 0,
  updated_at TEXT,
  PRIMARY KEY (child_id, item_id)
);

CREATE TABLE IF NOT EXISTS enrich_jobs (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  status TEXT DEFAULT 'queued' CHECK(status IN ('queued','running','review','done','error')),
  detail TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

-- ===== LIVE & SOCIAL v4 (spec 14): games ao vivo, enquetes, Q&A, chat, coaching, certificados =====
CREATE TABLE IF NOT EXISTS live_sessions (
  id TEXT PRIMARY KEY,
  pin TEXT UNIQUE NOT NULL,
  item_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  host_parent TEXT NOT NULL,
  state TEXT DEFAULT 'lobby' CHECK(state IN ('lobby','question','reveal','ended')),
  current_q INTEGER DEFAULT -1,
  q_started_at TEXT,
  created_at TEXT NOT NULL,
  ended_at TEXT
);
CREATE TABLE IF NOT EXISTS live_players (
  session_id TEXT NOT NULL,
  child_id TEXT NOT NULL,
  nickname TEXT NOT NULL,
  score INTEGER DEFAULT 0,
  joined_at TEXT NOT NULL,
  PRIMARY KEY (session_id, child_id)
);
CREATE TABLE IF NOT EXISTS live_answers (
  session_id TEXT NOT NULL,
  child_id TEXT NOT NULL,
  q_index INTEGER NOT NULL,
  choice INTEGER,
  correct INTEGER,
  ms INTEGER,
  delta INTEGER,
  PRIMARY KEY (session_id, child_id, q_index)
);

CREATE TABLE IF NOT EXISTS polls (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  question TEXT NOT NULL,
  options_json TEXT NOT NULL,
  open INTEGER DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS poll_votes (
  poll_id TEXT NOT NULL,
  child_id TEXT NOT NULL,
  choice INTEGER NOT NULL,
  PRIMARY KEY (poll_id, child_id)
);

CREATE TABLE IF NOT EXISTS qa_questions (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  child_id TEXT NOT NULL,
  body TEXT NOT NULL,
  answered INTEGER DEFAULT 0,
  flagged INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS qa_votes (
  question_id TEXT NOT NULL,
  child_id TEXT NOT NULL,
  PRIMARY KEY (question_id, child_id)
);

CREATE TABLE IF NOT EXISTS chat_channels (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS chat_threads (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  child_id TEXT NOT NULL,
  staff_parent_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(course_id, child_id, staff_parent_id)
);
CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK(scope IN ('channel','thread')),
  scope_id TEXT NOT NULL,
  sender_child_id TEXT,
  sender_parent_id TEXT,
  sender_name TEXT NOT NULL,
  body TEXT NOT NULL,
  flagged INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS tutor_notes (
  id TEXT PRIMARY KEY,
  tutor_parent_id TEXT NOT NULL,
  child_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS certificates (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  issued_at TEXT NOT NULL,
  UNIQUE(child_id, course_id)
);

-- ===== ASSESSMENT CORE v5 (spec 15): events, banco de questões, provas, tarefas, rubricas =====
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  actor_kind TEXT NOT NULL CHECK(actor_kind IN ('child','parent','system')),
  actor_id TEXT,
  course_id TEXT,
  ref_kind TEXT,
  ref_id TEXT,
  payload_json TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bank_questions (
  id TEXT PRIMARY KEY,
  course_id TEXT,                                        -- NULL = banco BNCC global
  bncc_code TEXT,
  tags_json TEXT,
  kind TEXT NOT NULL CHECK(kind IN ('mcq','tf','short','numeric')),
  prompt TEXT NOT NULL,
  options_json TEXT,                                     -- mcq: string[]
  answer_json TEXT NOT NULL,                             -- index / bool / {accepted:[]} / {value,tolerance}
  explanation TEXT,
  difficulty INTEGER DEFAULT 2 CHECK(difficulty BETWEEN 1 AND 3),
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft','approved','retired')),
  origin TEXT NOT NULL CHECK(origin IN ('ai','staff')),
  created_by TEXT NOT NULL,
  verified_by TEXT,
  verified_at TEXT,
  version INTEGER DEFAULT 1,
  replaced_by TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS exams (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  pool_json TEXT NOT NULL,                               -- {bncc_codes:[],tags:[],difficulty:[],n}
  duration_min INTEGER,
  opens_at TEXT,
  due_at TEXT,
  attempts_allowed INTEGER DEFAULT 1,
  shuffle INTEGER DEFAULT 1,
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft','published','closed')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS exam_attempts (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL,
  child_id TEXT NOT NULL,
  seed TEXT NOT NULL,
  questions_json TEXT NOT NULL,                          -- ids sorteados (imutável na tentativa)
  answers_json TEXT,
  score REAL,
  started_at TEXT NOT NULL,
  submitted_at TEXT
);

CREATE TABLE IF NOT EXISTS rubrics (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  title TEXT NOT NULL,
  sections_json TEXT NOT NULL,                           -- [{title,weight,criteria:[{label,levels:[{label,points}]}]}]
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  child_id TEXT NOT NULL,
  body_text TEXT,
  file_id TEXT,
  status TEXT DEFAULT 'submitted' CHECK(status IN ('draft','submitted','returned','resubmitted')),
  submitted_at TEXT NOT NULL,
  UNIQUE(item_id, child_id)
);
CREATE TABLE IF NOT EXISTS submission_reviews (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  reviewer_parent_id TEXT NOT NULL,
  rubric_scores_json TEXT,
  points REAL,
  feedback TEXT,
  ai_assist_json TEXT,                                   -- pré-análise IA (só p/ o professor)
  created_at TEXT NOT NULL
);

-- ===== CONFIG DA PLATAFORMA v6 (chave→valor; ex.: modelo de IA ativo) =====
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
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
CREATE INDEX IF NOT EXISTS idx_notif_parent ON notifications(parent_id, read_at);
CREATE INDEX IF NOT EXISTS idx_coins_child ON coin_ledger(child_id, created_at);
CREATE INDEX IF NOT EXISTS idx_posts_inst ON community_posts(institution_id, created_at);
CREATE INDEX IF NOT EXISTS idx_replies_post ON community_replies(post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_courses_inst ON courses(institution_id, status);
CREATE INDEX IF NOT EXISTS idx_modules_course ON course_modules(course_id, display_order);
CREATE INDEX IF NOT EXISTS idx_items_module ON content_items(module_id, display_order);
CREATE INDEX IF NOT EXISTS idx_enroll_child ON enrollments(child_id);
CREATE INDEX IF NOT EXISTS idx_enroll_course ON enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_iprog_child ON item_progress(child_id);
CREATE INDEX IF NOT EXISTS idx_invites_token ON invites(token);
CREATE INDEX IF NOT EXISTS idx_ejobs_item ON enrich_jobs(item_id, status);
CREATE INDEX IF NOT EXISTS idx_live_pin ON live_sessions(pin);
CREATE INDEX IF NOT EXISTS idx_qa_course ON qa_questions(course_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chatmsg_scope ON chat_messages(scope, scope_id, created_at);
CREATE INDEX IF NOT EXISTS idx_threads_child ON chat_threads(child_id);
CREATE INDEX IF NOT EXISTS idx_certs_code ON certificates(code);
CREATE INDEX IF NOT EXISTS idx_events_kind ON events(kind, created_at);
CREATE INDEX IF NOT EXISTS idx_events_course ON events(course_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_actor ON events(actor_kind, actor_id, created_at);
CREATE INDEX IF NOT EXISTS idx_bankq_course ON bank_questions(course_id, status);
CREATE INDEX IF NOT EXISTS idx_bankq_code ON bank_questions(bncc_code, status);
CREATE INDEX IF NOT EXISTS idx_exams_course ON exams(course_id, status);
CREATE INDEX IF NOT EXISTS idx_attempts_exam ON exam_attempts(exam_id, child_id);
CREATE INDEX IF NOT EXISTS idx_subs_item ON submissions(item_id);
CREATE INDEX IF NOT EXISTS idx_subs_child ON submissions(child_id);
CREATE INDEX IF NOT EXISTS idx_subrev_sub ON submission_reviews(submission_id);
`;

// ---- Migrações versionadas (aditivas). Bump SCHEMA_VERSION ao adicionar. ----
const SCHEMA_VERSION = 6;
let initialized = false;

function ensureColumns(table: string, defs: Record<string, string>): void {
  const cols = (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);
  for (const [name, ddl] of Object.entries(defs)) {
    if (!cols.includes(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${ddl}`);
  }
}

export function initDb(): void {
  if (initialized) return;
  db.exec(SCHEMA);
  const version = db.pragma("user_version", { simple: true }) as number;
  if (version < 2) {
    // v2 (spec 12): perfis self + opt-out do leaderboard.
    ensureColumns("children", {
      kind: "TEXT DEFAULT 'child'",
      leaderboard_hidden: "INTEGER DEFAULT 0",
    });
  }
  if (version < 3) {
    // v3 (spec 13): papéis de staff + escopo de curso no corpus/atoms.
    ensureColumns("parents", {
      role: "TEXT DEFAULT 'guardian'",
      staff_institution_id: "TEXT",
    });
    ensureColumns("corpus_chunks", { course_id: "TEXT" });
    ensureColumns("knowledge_atoms", { course_id: "TEXT" });
  }
  if (version < 5) {
    // v5 (spec 15): motor de desbloqueio — árvore de condições em módulos/itens.
    ensureColumns("course_modules", { availability_json: "TEXT" });
    ensureColumns("content_items", { availability_json: "TEXT" });
    // 'assignment' como novo kind (spec 15.4). O CHECK antigo bloqueia → rebuild da tabela
    // (nenhuma outra tabela referencia content_items, então é seguro; feito só se o CHECK estiver desatualizado).
    const ciSql = (db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='content_items'").get() as { sql: string } | undefined)?.sql ?? "";
    if (!ciSql.includes("'assignment'")) {
      db.pragma("foreign_keys = OFF");
      db.exec(`
        CREATE TABLE content_items_new (
          id TEXT PRIMARY KEY,
          module_id TEXT NOT NULL REFERENCES course_modules(id),
          kind TEXT NOT NULL CHECK(kind IN ('video','document','lesson','quiz','game','live','assignment')),
          title TEXT NOT NULL,
          payload_json TEXT,
          source_file_id TEXT,
          display_order INTEGER DEFAULT 0,
          duration_min INTEGER,
          status TEXT DEFAULT 'draft' CHECK(status IN ('draft','pending_review','published')),
          verified_by TEXT, verified_at TEXT,
          created_at TEXT NOT NULL,
          availability_json TEXT
        );
        INSERT INTO content_items_new (id,module_id,kind,title,payload_json,source_file_id,display_order,duration_min,status,verified_by,verified_at,created_at,availability_json)
          SELECT id,module_id,kind,title,payload_json,source_file_id,display_order,duration_min,status,verified_by,verified_at,created_at,availability_json FROM content_items;
        DROP TABLE content_items;
        ALTER TABLE content_items_new RENAME TO content_items;
        CREATE INDEX IF NOT EXISTS idx_items_module ON content_items(module_id, display_order);
      `);
      db.pragma("foreign_keys = ON");
    }
  }
  if (version < SCHEMA_VERSION) db.pragma(`user_version = ${SCHEMA_VERSION}`);
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
