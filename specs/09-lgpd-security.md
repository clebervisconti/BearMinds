# 09 · LGPD & Security (gate for launch — nothing ships without this)

**Context:** children's data is ANPD's stated enforcement priority; LGPD art. 14 requires specific, highlighted, separable parental consent in the child's best interest. The MEC AI referential (Apr 2026) + CNE AI directives (May 2026) additionally expect human oversight, transparency, and no high-risk uses. Compliance here is a MOAT (competitors skip it), not overhead.

## 9.1 Compliance checklist (block launch until all ✅)
- [ ] Parent-fronted accounts only; no child registration path exists.
- [ ] Consent: separable, un-prechecked, versioned, revocable in-app (03 §3.3) — screenshots archived per policy_version.
- [ ] Data minimization: child = apelido + birth_year + grade (+ institution/class). Prove by schema review — no other child field exists.
- [ ] PII encryption: parent full name AES-256-GCM; key in `.env` (0600), never in git; DB file readable by service user only.
- [ ] Deletion: in-app account deletion, soft→hard path (02) with 30-day window; documented in the privacy policy.
- [ ] Access/portability: parent can export their data (JSON dump endpoint `GET /api/me/export`).
- [ ] Zero third-party trackers: no analytics/ads SDKs; self-hosted metrics only (see 9.3). CSP forbids third-party origins.
- [ ] AI transparency page: what is generated, what is stored, models used, human-review policy — plain PT (MEC referential alignment).
- [ ] No high-risk AI uses: no facial recognition, no automated grading decisions affecting the child without human review, no emotional inference.
- [ ] Privacy policy + terms (PT) published at `/politica-de-privacidade` and `/termos`; policy_version bumps re-prompt consent.
- [ ] Incident response note: who to notify (ANPD/users) and within what window; contact e-mail live.

## 9.2 Security hardening
- Transport: Cloudflare proxied, SSL Full (strict); HSTS on; API only via reverse proxy (port 8787 firewalled to localhost).
- Headers: CSP (`default-src 'self'`; iframe sandbox for explorables; no inline script except Vite hashes), X-Frame-Options DENY (app), Referrer-Policy strict-origin.
- Input: zod validation on every route; SQL only via prepared statements (better-sqlite3 default).
- Sessions/rate limits per 03; bcrypt cost 12; secrets via `.env` (0600) — never committed (`.gitignore` includes `.env`, `data/`).
- Backups: nightly `sqlite3 .backup` to `/home/backups/bearminds/` (VPS), 14-day retention, key material NOT in backup.
- Dependency hygiene: `npm audit` in CI; renovate/dependabot monthly.
- LLM-specific: prompt-injection containment (user text is data, never system prompt; retrieved chunks delimited; output JSON-validated); generated explorable sandboxed (05 §5.3); model keys server-side only.

## 9.3 Privacy-preserving metrics (needed for D7/D30!)
Self-hosted counters only: daily active children, learning events, retention cohorts — computed from `study_sessions`/`habit_log` by a nightly job into `metrics_daily` (aggregates, no per-child export). This powers the growth-plan dashboards without third-party analytics.

## Acceptance criteria
- [ ] Checklist 9.1 fully green, with evidence linked (tests, screenshots, policy files in repo).
- [ ] `curl` security-header audit passes; explorable iframe cannot fetch external URL (test).
- [ ] Export endpoint returns complete parent-scoped data; deletion verified end-to-end.
- [ ] Cohort metrics job produces D1/D7/D30 tables from seeded fixtures.
