# 02 · Data Model (SQLite, LGPD-first)

Extends the BUILD-KIT §4 schema with the **institutions/curriculum catalog** (new requirement: user selects institution → class → discipline). All timestamps ISO-8601 UTC strings. All ids: `nanoid()`.

```sql
PRAGMA journal_mode = WAL;

-- ===== AUTH & CONSENT (parent-fronted) =====
CREATE TABLE IF NOT EXISTS parents (
  id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, email_verified INTEGER DEFAULT 0,
  password_hash TEXT NOT NULL,               -- bcrypt, cost 12
  full_name_enc TEXT,                        -- AES-256-GCM w/ PII_ENCRYPTION_KEY; nullable
  created_at TEXT NOT NULL, deleted_at TEXT);

CREATE TABLE IF NOT EXISTS children (
  id TEXT PRIMARY KEY, parent_id TEXT NOT NULL REFERENCES parents(id),
  display_name TEXT NOT NULL,                -- apelido only (minimization)
  birth_year INTEGER NOT NULL, grade TEXT NOT NULL,          -- e.g. '6EF', '1EM'
  age_band TEXT NOT NULL CHECK(age_band IN ('8-10','11-14','15-18')),
  institution_id TEXT REFERENCES institutions(id),           -- NULL = BNCC padrão
  class_id TEXT,                             -- institution-specific class (e.g. 'y5')
  avatar_seed TEXT, created_at TEXT NOT NULL, deleted_at TEXT);

CREATE TABLE IF NOT EXISTS consents (
  id TEXT PRIMARY KEY, parent_id TEXT NOT NULL, child_id TEXT NOT NULL,
  scope TEXT NOT NULL CHECK(scope IN ('account','ai_generation','progress_tracking','email_updates')),
  granted INTEGER NOT NULL, policy_version TEXT NOT NULL,
  granted_at TEXT NOT NULL, revoked_at TEXT);                -- separable & revocable

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY, parent_id TEXT NOT NULL, active_child_id TEXT,
  created_at TEXT NOT NULL, expires_at TEXT NOT NULL, user_agent TEXT);

-- ===== INSTITUTIONS & CURRICULUM CATALOG (new) =====
CREATE TABLE IF NOT EXISTS institutions (
  id TEXT PRIMARY KEY,                       -- 'bncc-padrao' | 'maple-bear' | future
  name TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('default','network','school')),
  locale TEXT DEFAULT 'pt-BR', active INTEGER DEFAULT 1, config_json TEXT);
    -- config_json: {classes:[{id,label,grade_equiv,age}], subjects:[{id,label,lang,icon}], terms:[t1,t2,t3]}

CREATE TABLE IF NOT EXISTS curriculum_map (
  id TEXT PRIMARY KEY, institution_id TEXT NOT NULL REFERENCES institutions(id),
  class_id TEXT NOT NULL, subject_id TEXT NOT NULL, term TEXT,
  bncc_code TEXT NOT NULL REFERENCES bncc_skills(code),
  display_order INTEGER DEFAULT 0);
    -- maps an institution's class/subject/term to BNCC skill codes
    -- 'bncc-padrao' maps grades directly (class_id == grade)

-- ===== BNCC CORPUS (moat #1) =====
CREATE TABLE IF NOT EXISTS bncc_skills (
  code TEXT PRIMARY KEY,                     -- e.g. 'EF06MA07'
  stage TEXT, grade_band TEXT, area TEXT, component TEXT,
  description TEXT NOT NULL, objects TEXT,
  verified_by TEXT, verified_at TEXT);       -- verification = human sign-off; unverified skills NOT servable

CREATE TABLE IF NOT EXISTS corpus_chunks (
  id TEXT PRIMARY KEY, bncc_code TEXT NOT NULL REFERENCES bncc_skills(code),
  source_title TEXT, source_ref TEXT, content TEXT NOT NULL, embedding BLOB);

-- ===== GENERATED ARTIFACTS (cache ⇒ reuse cost $0) =====
CREATE TABLE IF NOT EXISTS generated_artifacts (
  id TEXT PRIMARY KEY, bncc_code TEXT NOT NULL, grade_band TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('lesson','explorable','quiz')),
  age_band TEXT NOT NULL, payload_json TEXT NOT NULL, citations_json TEXT,
  model_used TEXT NOT NULL, safety_passed INTEGER DEFAULT 0, created_at TEXT NOT NULL,
  UNIQUE(bncc_code, grade_band, kind, age_band));

-- ===== MASTERY (moat #2, FSRS D-S-R) =====
CREATE TABLE IF NOT EXISTS knowledge_atoms (
  id TEXT PRIMARY KEY, bncc_code TEXT NOT NULL, atom_text TEXT NOT NULL, prereq_atom_id TEXT);

CREATE TABLE IF NOT EXISTS mastery_state (
  child_id TEXT NOT NULL, atom_id TEXT NOT NULL,
  stability REAL DEFAULT 0, difficulty REAL DEFAULT 5, retrievability REAL,
  state TEXT DEFAULT 'new' CHECK(state IN ('new','learning','review','relearning')),
  reps INTEGER DEFAULT 0, lapses INTEGER DEFAULT 0, last_review TEXT, due TEXT,
  PRIMARY KEY (child_id, atom_id));

CREATE TABLE IF NOT EXISTS study_sessions (
  id TEXT PRIMARY KEY, child_id TEXT NOT NULL, bncc_code TEXT,
  started_at TEXT, ended_at TEXT, duration_sec INTEGER, rating INTEGER);  -- FSRS rating 1..4

CREATE TABLE IF NOT EXISTS prova_calendar (
  id TEXT PRIMARY KEY, child_id TEXT NOT NULL, title TEXT,
  exam_date TEXT NOT NULL, bncc_codes TEXT NOT NULL);        -- JSON array

-- ===== GAMIFICATION (07) =====
CREATE TABLE IF NOT EXISTS habit_log (
  child_id TEXT NOT NULL, day TEXT NOT NULL,                 -- 'YYYY-MM-DD' local America/Sao_Paulo
  learning_events INTEGER DEFAULT 0, freeze_used INTEGER DEFAULT 0,
  PRIMARY KEY (child_id, day));

-- ===== AUDIT (LGPD accountability) =====
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY, at TEXT NOT NULL, actor TEXT NOT NULL,
  action TEXT NOT NULL, entity TEXT, detail_json TEXT);
```

## Rules
- **Deletion path (LGPD art. 18):** deleting a parent soft-deletes (`deleted_at`) parent + children, revokes consents, then a nightly job hard-deletes rows older than 30 days and their `mastery_state`/`study_sessions`/`habit_log`. Aggregated, anonymized stats may be retained.
- **PII inventory:** parent email + optional encrypted name. Child = apelido + birth_year + grade only. NOTHING else about the child. No IP logging beyond standard OLS rotation.
- **Migrations:** `server/db.ts` applies `CREATE TABLE IF NOT EXISTS` + a `schema_version` pragma table; additive migrations only during P1.
- **Seeds:** `seed/bncc.seed.json` (≥ 8 verified Matemática 6º–9º skills to start) and `seed/institutions.seed.json` (`bncc-padrao` + `maple-bear` — see 04).

## Acceptance criteria
- [ ] `npm run seed` creates DB, seeds both institutions + BNCC skills + corpus chunks idempotently.
- [ ] FK integrity on; deleting a parent cascades per the deletion path above (test included).
- [ ] A child can be created with `institution_id = 'maple-bear', class_id = 'y5'` AND with plain `bncc-padrao` + grade.
- [ ] `generated_artifacts` UNIQUE constraint proves cache-hit path (second generate call returns cached row, `model_used` unchanged).
