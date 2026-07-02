# 10 · Deployment (bearminds.cybersphere.com.br)

**Infra (existing, verified):** HostGator VPS `129.121.49.96` (SSH port 22022, key auth) · CyberPanel/OpenLiteSpeed · Cloudflare zone `cybersphere.com.br` (id `cbb665dcd1447268f6fe8b0437d1fcc6`), record `bearminds` proxied, SSL Full (strict). Deploy pipeline patterns from skills: `cs-app-deployment` (orchestrator), `hostgator-vps-manager` (origin), `cloudflare-manager` (edge). The legacy static deploy (`legacy/deploy.sh`, rsync to OLS docroot) keeps working until cutover.

## 10.1 Environments
| Env | Where | Notes |
|---|---|---|
| dev | Mac, `npm run dev` (web :5173 + API :8787) | `.env` from `.env.example`; phone test via same-LAN IP or `cloudflared tunnel` |
| prod | VPS | OLS vhost serves `dist/`; `/api/*` reverse-proxied to `127.0.0.1:8787`; API as systemd |

## 10.2 Server setup (once — via hostgator-vps-manager patterns)
1. Node 20 via nvm for service user; app dir `/home/bearminds.cybersphere.com.br/app/`; data dir `…/app/data/` (0700).
2. systemd unit `bearminds-api.service`: `ExecStart=node --import tsx server/index.ts` (or built JS), `Restart=always`, `EnvironmentFile=/home/…/app/.env`, `User=` site user (never root).
3. OLS: docroot → `app/dist/`; context `/api/` → proxy `http://127.0.0.1:8787` (websocket off); Let's Encrypt cert already managed by CyberPanel.
4. Firewalld: 8787 NOT exposed publicly.
5. Snapshot rule (house rule): before any prod change, snapshot to `/home/backups/bearminds/<TIMESTAMP>/`.

## 10.3 Deploy flow (every release)
```
local:  npm run build && git add -A && git commit && git push
VPS  :  cron (5 min) or GH Actions dispatch →
        git pull → npm ci --omit=dev → npm run build →
        rsync dist/ → docroot → systemctl restart bearminds-api →
        curl -f https://bearminds.cybersphere.com.br/api/health || rollback
```
- `GET /api/health` returns `{ok, version (git sha), db:'up', llm:'configured'}` — the deploy gate.
- Rollback: keep previous `dist/` + git tag; `deploy.sh --rollback` restores both and restarts.
- DB migrations run on API boot (additive only in P1); backup before restart (nightly + pre-deploy).

## 10.4 Config (`.env.example` — commit this, never `.env`)
```
GEMINI_API_KEY=            # same key as opensquad (see credential map)
ANTHROPIC_API_KEY=         # optional; enables claude-haiku-4-5 escalation
MODEL_DEFAULT=gemini-2.5-flash-lite
MODEL_CONTENT=gemini-2.5-flash
MODEL_MATH_HARD=claude-haiku-4-5
PII_ENCRYPTION_KEY=        # openssl rand -hex 16
SESSION_PEPPER=            # openssl rand -hex 16
POLICY_VERSION=2026-07-01
SMTP_URL=                  # optional in P1 (email digest/verification)
PORT=8787
```

## 10.5 Observability (P1-appropriate)
- API logs: pino JSON to journald (`journalctl -u bearminds-api`); request id per call; token/cost log per generation (05 §5.3).
- Uptime: Cloudflare health notification or simple cron curl → e-mail on failure.
- Optional gate while testing: Cloudflare Access in front of the hostname until warm-cohort launch (remove for public).

## Acceptance criteria
- [ ] Fresh clone → `deploy.sh` → live site + green `/api/health` in one run.
- [ ] Rollback restores previous version in < 2 min (rehearsed once).
- [ ] Reboot test: VPS restart brings API up automatically (systemd enabled).
- [ ] `.env` absent from git history; 8787 unreachable externally (nmap check).
- [ ] Legacy app still reachable until cutover decision recorded in 11-roadmap.
