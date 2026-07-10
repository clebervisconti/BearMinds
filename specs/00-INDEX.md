# 🐻 BearMinds — Upgrade Specification Pack (v1.0 · 2026-07-02)

**Goal:** upgrade the current BearMinds app (static, Maple Bear-only content viewer, no backend) into the **BearMinds product**: a PT-first, BNCC-native, guardrailed AI study companion — PWA + API — ready to onboard the first 100 families.

**Source of truth upstream:** strategy pack in `/Volumes/STORAGE/Cyberlabs/Projects/BearMinds/` (memo, research, BUILD-KIT.md, STARTER-CODE.md) and the deep review of 2026-07-02 (`outputs/cs-ai-strategy/2026-07-02-bearminds-deep-review/`). These specs OPERATIONALIZE those documents — where they conflict, the specs win (they are newer).

---

## How to use this pack with Claude Code

1. Each file is a self-contained work package. Start a session with: *"Read specs/00-INDEX.md and specs/<NN-file>.md, then implement it"*.
2. Implement in the order below unless a file states otherwise — later specs depend on earlier ones.
3. Every spec ends with **Acceptance criteria** — the session is done when they pass.
4. The repo may be restructured (see 01): current `public/` static app remains live until Phase 1 cutover.

## File index & build order

| # | File | What it specifies | Phase |
|---|---|---|---|
| 01 | [01-architecture.md](01-architecture.md) | Target architecture, stack, repo layout, migration from the current static app | P1 |
| 02 | [02-data-model.md](02-data-model.md) | Full SQLite schema (auth, consent, institutions, curriculum, corpus, artifacts, mastery) | P1 |
| 03 | [03-auth-consent.md](03-auth-consent.md) | Parent login/registration, sessions, LGPD consent flows, child profiles | P1 |
| 04 | [04-onboarding-catalog.md](04-onboarding-catalog.md) | Institution selection, year/class/discipline/trimester navigation, BNCC mapping | P1 |
| 05 | [05-learning-loop.md](05-learning-loop.md) | Generation engine: grounded lesson + explorable + Socratic quiz, cache, guardrails | P1 |
| 06 | [06-mastery-fsrs.md](06-mastery-fsrs.md) | FSRS spaced repetition, "Para revisar hoje", prova calendar | P1 |
| 07 | [07-gamification.md](07-gamification.md) | Habit mechanics (done-right rules), mastery progression, companion | P1-lite / P2 |
| 08 | [08-parent-dashboard.md](08-parent-dashboard.md) | Parent view: activity, mastery, prova readiness | P2 |
| 09 | [09-lgpd-security.md](09-lgpd-security.md) | LGPD compliance checklist, security hardening, data deletion | P1 (gate) |
| 10 | [10-deployment.md](10-deployment.md) | Envs, build, VPS deploy (OLS + systemd + Cloudflare), rollback | P1 |
| 11 | [11-roadmap.md](11-roadmap.md) | Phases P1/P2/P3, acceptance metrics, kill criteria, launch checklist | all |
| 12 | [12-platform.md](12-platform.md) | Platform redesign — owner-fronted accounts, formal shell, coin economy, community | Redesign |
| 13 | [13-lms.md](13-lms.md) | LMS — admin/professor content pipeline, AI enrichment, enrollment, mastery-gated completion | P4a |
| 14 | [14-live-social.md](14-live-social.md) | Live learning, social (polls/Q&A/chat), coaching, certificates, moderation | P4b/P4c |
| 15 | [15-assessment-core.md](15-assessment-core.md) | Assessment core — events stream, question bank, exams, assignments/rubrics, unlock engine | P5a |
| 16 | [16-gestao-automacao.md](16-gestao-automacao.md) | Auto-matrícula, Duplicação, Boletim, Cronograma, Relatórios | P5b |
| 17 | [17-engajamento-pratica.md](17-engajamento-pratica.md) | Quick Updates/Checklists, exemplares de pares, autoavaliação, Readiness 2.0, Missions-lite | P5c |
| 18 | [18-next-gen-vision.md](18-next-gen-vision.md) | **Research & vision** — next-gen features, design standards & UX (evidence 2025–2026); gap analysis + sequencing (proposal, not impl spec) | vision |
| 19 | [19-next-gen-vision-frontier.md](19-next-gen-vision-frontier.md) | **Research & vision — Frontier II** — deepens spec 18 on 6 fronts: affect/anxiety, voice/multimodal, safe peer learning, teacher AI co-pilot, learning analytics & efficacy dataset, retention lifecycle; new 2025 regulatory frame (EU AI Act emotion ban, Digital ECA) (proposal, not impl spec) | vision |

## Current state → target state (one screen)

| Dimension | TODAY (v0 static) | TARGET (product) |
|---|---|---|
| App | Static HTML/JS, hash router, hand-authored `content-*.js` modules | Installable PWA (Vite + React + TS), age-banded skins |
| Backend | None | Hono/Node API on `:8787` behind OLS reverse proxy |
| Users | Anonymous, open | Parent-fronted accounts + child profiles (LGPD consent) |
| Institutions | Hardcoded Maple Bear (Y1–Y9) | **Institution catalog**: BNCC-padrão (default) + Maple Bear + extensible profiles |
| Content | Manually authored quiz/guide modules | AI-generated grounded lesson + explorable + Socratic quiz, cached per skill+grade+age band |
| Curriculum | `BM_CURRICULUM` JS object | DB-backed catalog mapped to BNCC skill codes |
| Memory | None | FSRS mastery engine per knowledge-atom, tied to exam dates |
| Payments | None | Out of scope until D90 gate (founding-member manual checkout: Pix/Stripe link) |

## Non-negotiable product rules (apply to every spec)

1. **Learn, not cheat** ("aprender, não colar"): the AI never hands the final answer first; think-first retrieval before content; layered Socratic hints.
2. **Grounding only**: generation cites the verified corpus per claim and REFUSES when unsupported. Nothing wrong enters the cache.
3. **LGPD-first**: parent-fronted account, separable/revocable consent, data minimization (child = apelido + birth year + grade only), zero third-party ad/analytics SDKs.
4. **Moat discipline**: LLM is a rented commodity behind `LLMProvider`; the value is the verified BNCC corpus + longitudinal mastery data.
5. **Gamification done right**: habit loops complete only via a real learning event; mastery-gated progression; no competitive leaderboards, no punitive streaks.
6. **Metrics that matter**: D7/D30 retention and mastery gain are primary; signups are vanity.

## Glossary
BNCC = Base Nacional Comum Curricular (Brazil's national curriculum). FSRS = Free Spaced Repetition Scheduler. PWA = Progressive Web App. LGPD = Lei Geral de Proteção de Dados. Knowledge-atom = smallest testable unit of a BNCC skill. Age bands: 8–10 · 11–14 · 15–18.
