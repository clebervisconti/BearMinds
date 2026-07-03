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

```
local:  git add -A && git commit && git push
VPS  :  cron (5 min) OU GitHub Actions dispatch → bash scripts/deploy.sh
```
`scripts/deploy.sh` (roda no VPS): snapshot → `git pull` → `npm ci` → `npm run build` → rsync `dist/` → `systemctl restart bearminds-api` → **health gate** (`/api/health` = `{ok:true}`) → rollback automático em falha.
Rollback manual: `bash scripts/deploy.sh --rollback`.

Cron sugerido (crontab do usuário do site):
```
*/5 * * * * cd /home/bearminds.cybersphere.com.br/app && bash scripts/deploy.sh >> data/deploy.log 2>&1
15 4 * * *  cd /home/bearminds.cybersphere.com.br/app && npm run jobs:nightly >> data/nightly.log 2>&1
30 4 * * *  sqlite3 /home/bearminds.cybersphere.com.br/app/data/bearminds.db ".backup '/home/backups/bearminds/nightly-$(date +\%F).db'"
```
(retenção de backups: 14 dias; material de chave NÃO vai no backup.)

## 4. Gate de testes enquanto valida
Cloudflare Access na frente do hostname até o lançamento da coorte-piloto (remover para público).

## 5. Cutover (fim do P1)
A raiz passa a servir o novo `dist/`. O app legado (`legacy/`) fica acessível em `/legacy/` para referência
e depois é removido. Registrar a decisão em `specs/11-roadmap.md`.
Até o cutover: **produção segue servindo o app v0** (`legacy/deploy.sh`, disparado pelo Stop hook).
