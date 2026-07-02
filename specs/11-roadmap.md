# 11 · Roadmap, Milestones & Kill Criteria

## Phase P1 — "The learning loop lives" (2–4 weeks)
Build order (each = one or a few Claude Code sessions):
1. **01+02**: scaffold from STARTER-CODE, schema, seeds (institutions + BNCC Matemática 6º–9º, ≥8 verified skills).
2. **03**: auth + consent + child profiles + parent gate.
3. **04**: onboarding wizard + catalog + topic resolution.
4. **05**: generation engine + cache + guardrails + ONE hand-verified explorable (frações equivalentes).
5. **06**: FSRS + "Para revisar hoje" + prova calendar.
6. **07-lite**: streak-by-learning-event + mastery levels + mascot poses.
7. **08-lite**: parent summary screen.
8. **09**: LGPD/security checklist ALL GREEN (launch gate).
9. **10**: prod deploy + health gate + Cloudflare Access while testing.

**Definition of done (P1):** a warm-cohort family can register → consent → onboard (institution/class/subjects/prova) → child completes the full loop on iPhone PWA → next day sees "Para revisar hoje" → parent sees readiness %.

## Phase P2 — retention & payment (weeks 5–12, gated by metrics)
- Founding-member paywall (manual Pix/Stripe link — no full billing system), annual-prepaid preferred.
- Parent dashboard full (08), e-mail digests, post-prova correlation.
- Corpus expansion: complete Matemática 6º–9º; add Português OR Ciências (pick by cohort demand).
- Explorable library growth (target: 1 per 3 skills); per-child FSRS optimization.
- Native app (Expo) ONLY if push-driven review retention is proven necessary.

## Phase P3 — scale & mission (months 4–12, gated by D90)
- Private Ensino Médio expansion (ENEM anchoring) · B2B lighthouse school pilot (school license R$68–110/aluno/ano benchmark) · freemium tier as funnel · equity/B2G exploration 2027+ (school connectivity dependent).

## Launch metrics (from growth plan — measure from day 1 via 09 §9.3)
| Gate | Metric | PASS | PIVOT | KILL |
|---|---|---|---|---|
| D30 | active families (≥2×/week) | ≥15, D7 ≥40% | 8–14 | <8 → iterate loop, pause acquisition |
| D60 | D30 retention + visible mastery gain | D30 ≥25% AND gain | one of two | neither → pedagogy thesis wrong |
| D90 | founding members paying R$24,90–39,90 | ≥20 | 8–19 | <8 → price/packaging test or B2B pivot |
| always | product = raw generation without corpus/mastery | — | — | AUTO-KILL (commodity) |

## Competitive tripwires (from deep-review 2026-07-02 — check monthly)
- Astra AI ships BNCC tagging / parent dashboard → differentiation rests on prova-specific generation + trust; accelerate corpus verification visible-proof UI.
- Khanmigo opens consumer plan in Brazil (US$4/mo) → price-ceiling shock; respond with annual family plan + prova-readiness differentiation.
- Toda Matéria / Arco / Plurall launches B2C exam companion → evaluate B2B pivot earlier.

## Working agreements for Claude Code sessions
- One spec file per session scope; end by running that spec's acceptance criteria.
- Never weaken guardrails (05 §5.3) or LGPD items (09) for velocity — they gate launch.
- Product copy in PT; code/comments in English; keep `specs/` updated when reality diverges (spec-first edits).
- Update `specs/CHANGELOG.md` (create on first change) with dated entries.
