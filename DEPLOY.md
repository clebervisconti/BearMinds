# BearMinds — Deployment (bearminds.cybersphere.com.br)

Infra existente (verificada): HostGator VPS `129.121.49.96` (SSH :22022, key auth) · CyberPanel/OpenLiteSpeed ·
Cloudflare zona `cybersphere.com.br` (record `bearminds`, proxied, SSL Full-strict).

> **Node 24 LTS** no VPS (não 20): o produto usa `node:sqlite`, que exige Node ≥ 22.5 (24 é LTS com a API
> estável). Isso elimina compilação nativa no deploy. Ver `specs/CHANGELOG.md`.

## 1. Setup do servidor (uma vez)

```bash
# via hostgator-vps-manager (SSH :22022, user site bearm4935)
# 1) Node 24 por nvm para o usuário do serviço
nvm install 24 && nvm alias default 24
# 2) app dir + data dir 0700
mkdir -p /home/bearminds.cybersphere.com.br/app && cd $_
git clone https://github.com/clebervisconti/BearMinds.git .
mkdir -p data && chmod 700 data
cp .env.example .env      # preencher segredos (abaixo)
npm ci && npm run build && npm run seed
# 3) systemd
sudo cp scripts/bearminds-api.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now bearminds-api
```

`.env` de produção (0600, nunca no git):
```
GEMINI_API_KEY=...            # mesma do opensquad (mapa de credenciais)
ANTHROPIC_API_KEY=...         # opcional (escala math)
PII_ENCRYPTION_KEY=$(openssl rand -hex 16)
SESSION_PEPPER=$(openssl rand -hex 16)
POLICY_VERSION=2026-07-01
NODE_ENV=production
HOST=127.0.0.1
PORT=8787
PUBLIC_ORIGIN=https://bearminds.cybersphere.com.br
```

## 2. OpenLiteSpeed (via hostgator-vps-manager)

Config **realmente aplicada** (docroot = `public_html`, `autoLoadHtaccess 1`):

- **dist/ → public_html:** `rsync -a --delete app/dist/ public_html/` (o cutover; snapshot antes).
- **Reverse proxy `/api`:** o OLS exige um *external app* nomeado com o alvo do `[P]`. Duas partes:
  1. No `vhost.conf`, um extprocessor:
     ```
     extprocessor 127.0.0.1:8787 {
       type      proxy
       address   127.0.0.1:8787
       maxConns  100
       initTimeout 60
       retryTimeout 0
       respBuffer 0
     }
     ```
  2. Em `public_html/.htaccess`:
     ```
     RewriteEngine On
     RewriteRule ^api/(.*)$ http://127.0.0.1:8787/api/$1 [P,L]
     RewriteCond %{REQUEST_FILENAME} !-f
     RewriteCond %{REQUEST_FILENAME} !-d
     RewriteRule ^ /index.html [L]
     ```
  > Sem o extprocessor nomeado, o `[P]` devolve **500** ("Proxy target is not defined on external application list").
- **WebSocket upgrade (P6, `server/ws/`, 2026-07-09):** o Node agora aceita upgrade de WS em `/ws/live/:pin`,
  `/ws/chat/channel/:courseId` e `/ws/chat/thread/:id` (tempo real de live games + chat, substitui polling).
  **Pendente de configurar no VPS** (não verificado nesta sessão, sem acesso ao servidor): o `extprocessor`
  acima faz proxy HTTP comum — para repassar o handshake de WebSocket é preciso confirmar/adicionar
  passthrough dos headers `Upgrade`/`Connection` no `[P]` do `.htaccess` (ou um `RewriteRule` dedicado para
  `^ws/`). **Se isso não for configurado, nada quebra** — o cliente detecta que a conexão WS não abre e cai
  automaticamente de volta para o polling já testado (spec 14/17, ver `src/lib/liveSocket.ts`). Configurar é
  opcional/incremental, não bloqueia o deploy.
- Editar `vhost.conf` afeta só este vhost, mas **faça backup e verifique clebervisconti.com** após `lswsctrl reload` (box compartilhado). Rollback = restaurar o backup + reload.
- **Let's Encrypt** já gerenciado pelo CyberPanel. O `context /.well-known/acme-challenge` do vhost fica fora do docroot — a renovação segue funcionando. (Se o gate do Cloudflare Access ficar muito tempo, garanta a renovação do cert origin p/ o SSL Full-strict.)
- **Firewalld:** 8787 NÃO exposto (só localhost + bind `HOST=127.0.0.1`). A API só é alcançável via proxy.
- **Headers para o estático** (o Node já os envia na API; para o dist/, adicionar no vhost/`.htaccess`):
  ```
  Header set Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
  Header set X-Frame-Options "DENY"
  Header set X-Content-Type-Options "nosniff"
  Header set Referrer-Policy "strict-origin"
  Header set Strict-Transport-Security "max-age=31536000; includeSubDomains"
  ```
- **Fallback SPA:** rotas não-arquivo → `index.html` (o React Router cuida do resto).

## 3. Deploy contínuo

**O app dir do VPS NÃO é um checkout git** — a fonte vai por **rsync-from-Mac**. Deploy normal (do Mac):

```
bash scripts/deploy-push.sh
```
`scripts/deploy-push.sh` (roda no MAC; credenciais em runtime de `~/.env.hostgator` + chave SSH no Keychain):
snapshot (docroot + DB) → `rsync` da fonte Mac→VPS (exclui `node_modules/dist/data/.env/.git/.claude/legacy`) →
`chown` p/ o dono do site → build no VPS como o dono (o servidor roda **TS via tsx**, só o front builda) →
publica `dist/` no docroot com **`--exclude=.htaccess`** → `systemctl restart bearminds-api` →
**health gate por localhost** (`http://127.0.0.1:8787/api/health` = `{ok:true}`) → rollback automático em falha.

`scripts/deploy.sh` (roda NO VPS): a metade server-side — build → publica dist (preserva `.htaccess`) → restart →
health gate localhost → rollback. **Não faz `git pull`** a menos que `APP_DIR` seja um checkout git.
Rollback manual: `bash scripts/deploy.sh --rollback`.

⚠️ **Regras críticas** (aprendidas 2026-07-04): (a) o `.htaccess` do docroot tem o reverse-proxy `[P]` `/api`→127.0.0.1:8787
+ SPA fallback e **vive só no VPS** — todo `rsync --delete` para o docroot PRECISA de `--exclude='.htaccess'`;
(b) o health gate é **localhost**, nunca a URL pública (Cloudflare Access devolve 302 → falso negativo/rollback eterno);
(c) `node:sqlite` exige **Node 24** (`/usr/local/node24/bin` no PATH).

Cron/jobs (crontab do usuário do site — o `deploy.sh` server-side só é útil se a fonte for atualizada por CI/git):
```
15 4 * * *  cd /home/bearminds.cybersphere.com.br/app && export PATH=/usr/local/node24/bin:$PATH && npm run jobs:nightly >> data/nightly.log 2>&1
30 4 * * *  sqlite3 /home/bearminds.cybersphere.com.br/app/data/bearminds.db ".backup '/home/backups/bearminds/nightly-$(date +\%F).db'"
```
(retenção de backups: 14 dias; material de chave NÃO vai no backup.)

## 4. Gate de validação — Sign in with Apple (substitui o Cloudflare Access OTP)

Gate por SIWA (allowlist), no app (padrão dos outros apps do Cleber). Ativa com `GATE_MODE=apple`.
Feito via API: **App ID `com.cybersphere.bearminds` (id A4P34RAX77) + capability Sign in with Apple**.

**Portal-only (Apple não tem API — Cleber faz, ~5 min):**
1. **Identifiers → Services IDs → +** → `com.cybersphere.bearminds.signin` (desc "BearMinds SignIn").
2. Editar o Services ID → habilitar **Sign in with Apple → Configure**:
   - Primary App ID: `com.cybersphere.bearminds`
   - Domains: `bearminds.cybersphere.com.br`  ·  Return URLs: `https://bearminds.cybersphere.com.br/api/auth/apple/callback`
   - Apple gera um **domain association file** → me passe o conteúdo; eu hospedo em `/.well-known/apple-developer-domain-association.txt` (o gate libera `/.well-known/`).
3. **Keys → +** → nome "BearMinds SIWA" → habilitar **Sign in with Apple → Configure** → Primary App ID `com.cybersphere.bearminds` → **Register** → **Download `.p8` (uma vez!)** → salvar em `~/.private_keys/AuthKey_<KEYID>.p8` (0600). Anotar o **Key ID**.
4. Me entregue o **Key ID** (o `.p8` fica só no seu Mac / VPS, nunca no git).

**Depois (eu faço):** copio o `.p8` p/ o VPS (`/var/lib/bearminds/apple-signin-key.p8`, 0600, owner bearm4935),
preencho o `.env`:
```
GATE_MODE=apple
APPLE_CLIENT_ID=com.cybersphere.bearminds.signin
APPLE_TEAM_ID=Z5H2FL2237
APPLE_KEY_ID=<key id>
APPLE_PRIVATE_KEY_PATH=/var/lib/bearminds/apple-signin-key.p8
APPLE_REDIRECT_URI=https://bearminds.cybersphere.com.br/api/auth/apple/callback
GATE_ALLOWLIST=cleber.visconti@icloud.com
GATE_COOKIE_SECRET=<openssl rand -hex 16>
```
e **mudo o OLS p/ mandar TUDO ao Node** (o gate precisa cobrir o estático):
`RewriteRule ^(.*)$ http://127.0.0.1:8787/$1 [P,L]` no `.htaccess` (o Node serve dist + api quando prod).
Então **removo o Cloudflare Access** app `15f2a97f…` e testo o fluxo Apple.

Rollback do gate: `GATE_MODE=off` + restart → volta a exigir só a auth de parent (produto público).

### Cloudflare Access (mecanismo anterior — a remover no cutover do Apple)
Enquanto o SIWA não sobe, o hostname segue atrás do Cloudflare Access (app `15f2a97f…`, OTP).

## 5. Cutover (fim do P1)
A raiz passa a servir o novo `dist/`. O app legado (`legacy/`) fica acessível em `/legacy/` para referência
e depois é removido. Registrar a decisão em `specs/11-roadmap.md`.
Até o cutover: **produção segue servindo o app v0** (`legacy/deploy.sh`, disparado pelo Stop hook).
