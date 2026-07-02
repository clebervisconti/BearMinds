# 03 · Auth & Consent (parent-fronted, LGPD)

**Principle:** the PARENT owns the account and consents; the CHILD uses the app under a profile. This is the legal architecture for minors' data in Brazil (LGPD art. 14 — best interest, specific and highlighted parental consent) and is non-negotiable.

## Flows

### 3.1 Parent registration
1. `POST /api/auth/register {email, password}` → validate email format, password ≥ 10 chars.
2. bcrypt(cost 12) hash; create parent; create session (httpOnly, Secure, SameSite=Lax cookie `bm_session`, 30-day sliding expiry).
3. Email verification (P1: signed link via SMTP relay or log-to-console in dev; do NOT block usage on verification in P1, but flag `email_verified`).
4. Immediately route to **consent screen** (3.3) — no child can be created before consent.

### 3.2 Login / logout / session
- `POST /api/auth/login` → constant-time compare; on success rotate session id.
- Rate-limit: 5 failed attempts / 15 min / email+IP (in-memory ok in P1).
- `POST /api/auth/logout` → delete session row + clear cookie.
- Middleware `requireParent` (all `/api/*` except auth/catalog GET); `requireChildScope` verifies `child_id` belongs to session parent.

### 3.3 LGPD consent screen (the gate)
UI in PT, plain language, one screen per LGPD requirement — **separable checkboxes, none pre-checked**:

| Scope | Copy (PT) | Required? |
|---|---|---|
| `account` | "Criar a conta e o perfil do meu filho (apelido, ano de nascimento e série — nada além disso)." | YES to proceed |
| `ai_generation` | "Gerar conteúdo de estudo com IA a partir dos tópicos que meu filho escolher." | YES to use the product |
| `progress_tracking` | "Acompanhar o progresso de aprendizagem para agendar as revisões certas." | YES to use FSRS |
| `email_updates` | "Receber por e-mail o resumo de progresso e lembretes de prova." | Optional |

- Each consent stored as its own row with `policy_version` (env `POLICY_VERSION`, e.g. `2026-07-01`).
- **Revocation UI** in parent settings: toggle each scope off at any time → `revoked_at` set; revoking `account` triggers the deletion path (02).
- Show links to `politica-de-privacidade` (static page, PT — draft copy in 09).
- If `policy_version` changes, re-prompt on next parent login (children keep working for 7-day grace).

### 3.4 Child profile creation
`POST /api/children {display_name, birth_year, grade, institution_id?, class_id?}`
- Compute `age_band` from birth_year: 8–10 / 11–14 / 15–18 (clamp; reject <8 in P1 — MEC guidance discourages AI products for early childhood).
- Max 4 children per parent (P1).
- Child selection: parent switches `active_child_id` on the session (`POST /api/me/active-child`). The child-facing UI NEVER shows parent controls (guard by a "parent gate": simple math challenge + password re-entry to exit child mode).

### 3.5 Child usage model (no child credentials)
- P1: single device assumption — the child uses the parent's device/session in child mode. No child passwords, no child email (minimization).
- P2 option: per-child PIN + device profiles.

## Security requirements
- Cookies: httpOnly + Secure + SameSite=Lax; session ids 128-bit random.
- CSRF: same-site cookie + custom header check (`X-BM-Client: pwa`) on mutating routes.
- Secrets in `.env` only (never committed): `PII_ENCRYPTION_KEY` (AES-256-GCM for parent name), `SESSION_PEPPER`, LLM keys.
- All auth events → `audit_log`.

## Screens (frontend)
1. `/entrar` — login + link to register. 2. `/criar-conta` — register. 3. `/consentimento` — the LGPD gate (blocks until required scopes granted). 4. `/perfis` — child picker (avatar grid) + "modo responsável" gate. 5. Parent settings — consents, e-mail, delete account.

## Acceptance criteria
- [ ] Cannot create a child before granting required consents; each consent is a separate DB row with policy version.
- [ ] Revoking `ai_generation` immediately blocks `/api/generate` for that child (403 with friendly PT message).
- [ ] Account deletion flow works end-to-end (soft delete → verified by test; hard-delete job unit-tested with fake clock).
- [ ] Child mode cannot reach parent settings without passing the parent gate.
- [ ] Session cookie flags verified in integration test; rate limiting proven by test.
