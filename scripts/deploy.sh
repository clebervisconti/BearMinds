#!/usr/bin/env bash
# BearMinds — deploy do PRODUTO, parte que roda NO VPS (spec 10.3).
# Publica a fonte JÁ PRESENTE em APP_DIR (colocada lá por `scripts/deploy-push.sh` via rsync,
# por um checkout git, ou por um runner de CI): build → publica dist → restart API → health gate.
#
# NÃO faz `git pull` a menos que APP_DIR seja um checkout git (o app dir de produção é populado
# por rsync-from-Mac, não é um clone). Preserva SEMPRE o `.htaccess` do docroot (reverse-proxy /api).
#
# Uso:  bash scripts/deploy.sh            # build + publica + restart + health gate
#       bash scripts/deploy.sh --rollback # restaura o dist anterior + restart
set -euo pipefail

APP_DIR="${APP_DIR:-/home/bearminds.cybersphere.com.br/app}"
DOCROOT="${DOCROOT:-/home/bearminds.cybersphere.com.br/public_html}"
BACKUP_DIR="${BACKUP_DIR:-/home/backups/bearminds}"
# Health SEMPRE no localhost: a URL pública fica atrás do Cloudflare Access (302 → falso negativo).
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:8787/api/health}"
SERVICE="${SERVICE:-bearminds-api}"
NODE_BIN="${NODE_BIN:-/usr/local/node24/bin}"   # node:sqlite exige Node ≥ 22.5 (produção usa Node 24)
export PATH="$NODE_BIN:$PATH"

ts="$(date '+%Y%m%d-%H%M%S')"

# Restart resiliente: usa sudo só se não formos root.
restart_service() {
  if [ "$(id -u)" = "0" ]; then systemctl restart "$SERVICE"; else sudo systemctl restart "$SERVICE"; fi
}

rollback() {
  echo "↩️  Rollback: restaurando dist anterior…"
  last="$(ls -1dt "$BACKUP_DIR"/*/dist 2>/dev/null | head -1 || true)"
  [ -n "$last" ] || { echo "❌ Sem backup para rollback."; exit 1; }
  # --exclude=.htaccess: o proxy /api do docroot vive só no VPS, nunca no dist.
  rsync -a --delete --exclude='.htaccess' "$last/" "$DOCROOT/"
  restart_service
  echo "✅ Rollback aplicado ($last)."
}

if [ "${1:-}" = "--rollback" ]; then rollback; exit 0; fi

cd "$APP_DIR"

echo "▶ Snapshot do dist atual + DB (pré-deploy)"
mkdir -p "$BACKUP_DIR/$ts"
[ -d "$DOCROOT" ] && rsync -a "$DOCROOT/" "$BACKUP_DIR/$ts/dist/" || true
[ -f "$APP_DIR/data/bearminds.db" ] && sqlite3 "$APP_DIR/data/bearminds.db" ".backup '$BACKUP_DIR/$ts/bearminds.db'" || true
# retenção 14 dias
find "$BACKUP_DIR" -maxdepth 1 -type d -mtime +14 -exec rm -rf {} + 2>/dev/null || true

echo "▶ Atualizar fonte + build"
if [ -d "$APP_DIR/.git" ]; then
  git pull --ff-only
else
  echo "  (sem .git — fonte já colocada por rsync/CI; pulando git pull)"
fi
# npm ci só quando o lockfile mudou (evita reinstalar node_modules a cada deploy).
if [ ! -e node_modules/.package-lock.json ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  echo "  package-lock mudou → npm ci"
  npm ci
fi
# O servidor roda TS direto (tsx/esm) — só o front precisa de build.
npm run build

echo "▶ Publicando dist/ no docroot (preservando .htaccess)"
rsync -a --delete --exclude='.htaccess' "$APP_DIR/dist/" "$DOCROOT/"

echo "▶ Migrações (bootstrap) + restart da API"
# o schema sobe no boot da API (idempotente); systemd mantém Restart=always
restart_service

echo "▶ Health gate (localhost; a API sobe via tsx — cold start pode levar ~40s)"
for i in $(seq 1 30); do
  sleep 3
  if curl -fsS "$HEALTH_URL" 2>/dev/null | grep -q '"ok":true'; then
    echo "✅ Deploy OK: $(curl -fsS "$HEALTH_URL")"
    exit 0
  fi
done
echo "❌ Health check falhou — iniciando rollback."
rollback
exit 1
