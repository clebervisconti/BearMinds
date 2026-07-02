# 01 · Architecture & Migration

## Target architecture

```
┌─ Client: PWA (Vite + React 18 + TS) ──────────────────────────┐
│  Age-banded UI (3 skins via CSS vars) · Service Worker         │
│  Screens: Onboarding · Home("Para revisar hoje") · Lição ·     │
│  Explorável(iframe sandbox) · Quiz · Perfil/Consent · Parent   │
└──────────────────────────┬─────────────────────────────────────┘
                           │ HTTPS (Cloudflare proxied, SSL Full-strict)
┌─ VPS (HostGator · OpenLiteSpeed) ─────────────────────────────┐
│  OLS serves dist/ (static)  +  reverse proxy /api/* → :8787   │
│  ┌─ API: Hono on Node 20 (single process, systemd) ─────────┐ │
│  │ auth/ (sessions, consent) · catalog/ (institutions,      │ │
│  │ curriculum) · generate/ (orchestrator) · mastery/ (FSRS) │ │
│  │ rag/ (BM25 retriever over verified corpus)               │ │
│  └───────────────────────────────────────────────────────────┘ │
│  SQLite (better-sqlite3) — Postgres only in Phase 2+           │
└──────────────────────────┬─────────────────────────────────────┘
                           │ LLMProvider abstraction (swappable)
        Gemini 2.5 flash-lite/flash (default) · Claude Haiku 4.5 (hard math)
```

## Stack (decided — do not relitigate in sessions)

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Vite + React 18 + TypeScript | PWA: `manifest.webmanifest`, `sw.js` (app-shell cache, NEVER caches `/api`), iOS meta tags |
| Styling | Tailwind + CSS variables per age-band skin | 3 skins = token swap, not rewrite |
| State | TanStack Query (server) + Zustand (UI) | |
| Backend | Hono on Node 20, port 8787 | one process, systemd unit `bearminds-api` |
| DB | SQLite via better-sqlite3 | file at `data/bearminds.db` (git-ignored); WAL mode |
| LLM | `server/llm/provider.ts` abstraction; drivers: `@google/genai`, `@anthropic-ai/sdk` | default `gemini-2.5-flash-lite`; lesson/quiz/explorable `gemini-2.5-flash`; hard math → `claude-haiku-4-5` |
| RAG | minisearch (BM25) over `corpus_chunks` | embeddings deferred to Phase 2 |
| SRS | `ts-fsrs` with default weights | per-child optimization deferred |
| Auth | httpOnly cookie sessions, bcrypt password hashing | no third-party auth in P1 (SIWA optional P2) |

## Repo layout (target)

```
BearMinds/
├─ specs/                       ← this pack
├─ legacy/                      ← move current public/ static app here (kept deployable)
├─ index.html  vite.config.ts  tsconfig.json  package.json  .env.example
├─ public/     manifest.webmanifest · sw.js · icons/
├─ src/
│  ├─ main.tsx  App.tsx  router.tsx
│  ├─ skins/         tokens-8-10.css · tokens-11-14.css · tokens-15-18.css
│  ├─ screens/       Onboarding · Home · Lesson · Explorable · Quiz · Parent · Consent
│  ├─ components/    LearningExperience.tsx (from STARTER-CODE) · …
│  └─ lib/           api.ts (typed client) · queries.ts
├─ server/
│  ├─ index.ts  db.ts (schema bootstrap + migrations)
│  ├─ routes/   auth.ts · catalog.ts · generate.ts · mastery.ts · parent.ts
│  ├─ llm/      provider.ts · router.ts
│  ├─ rag/      retriever.ts
│  └─ prompts/  decompose.txt · lesson.txt · explorable.txt · quiz.txt · mathcheck.txt
├─ seed/        bncc.seed.json · institutions.seed.json
└─ scripts/     deploy.sh (adapted) · seed-corpus.ts
```

## Migration plan from current static app

1. **Freeze v0**: move `public/` (current app) + `CONTENT_AUTHORING.md` + `scripts/register-content.py` into `legacy/`. Keep the existing rsync deploy working for it until cutover (see 10-deployment).
2. **Scaffold the product** at repo root from `Projects/BearMinds/prototype/STARTER-CODE.md` (paste-ready files: package.json, provider.ts, router.ts, generate.ts, LearningExperience.tsx, manifest, sw.js, seed).
3. **Port what's reusable from v0**: the Maple Bear curriculum tree (`legacy/public/assets/js/curriculum.js`) becomes the `maple-bear` institution profile seed (see 04); the authored Y5 Geografia module becomes seed corpus chunks for its BNCC codes.
4. **Cutover** (end of P1): `bearminds.cybersphere.com.br` root serves the new `dist/`; legacy app remains reachable at `/legacy/` for reference until removed.

## API surface (v1)

```
POST /api/auth/register        {email, password}                → parent + session
POST /api/auth/login           {email, password}                → session
POST /api/auth/logout
GET  /api/me                                                    → parent + children + consents
POST /api/children             {display_name, birth_year, grade, institution_id, class_id}
POST /api/consents             {child_id, scope, granted, policy_version}
GET  /api/catalog/institutions                                  → list + curriculum shape
GET  /api/catalog/tree?institution=&grade=                      → disciplines→units→topics (BNCC-coded)
POST /api/generate             {topic|bncc_code, grade, child_id} → {lesson, explorable, quiz} (cache-first)
POST /api/mastery/review       {child_id, atom_id, rating 1..4} → next due
GET  /api/mastery/today?child_id                                → review queue + prova countdown
POST /api/provas               {child_id, title, exam_date, bncc_codes[]}
GET  /api/parent/summary?child_id                               → activity + mastery (P2)
```
All responses typed in `src/lib/api.ts`; errors as `{error: {code, message}}`.

## Acceptance criteria
- [ ] `npm run dev` boots web (:5173) + API (:8787); `npm run build` emits `dist/`.
- [ ] Legacy app preserved under `legacy/` and still deployable.
- [ ] `LLMProvider` swap works by env var only (no code change).
- [ ] Service worker never caches `/api/*`; app installs to iOS home screen with icon + fullscreen.
- [ ] SQLite file excluded from git; schema bootstraps idempotently on first run.
