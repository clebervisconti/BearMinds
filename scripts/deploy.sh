#!/usr/bin/env bash
# BearMinds — deploy do PRODUTO no VPS (spec 10.3).
# Roda NO VPS (via cron ou GitHub Actions): git pull → build → rsync dist → restart API → health gate.
# Uso:  bash scripts/deploy.sh            # deploy
#       bash scripts/deploy.sh --rollback # restaura o dist anterior + restart
set -euo pipefail

APP_DIR="${APP_DIR:-/home/bearminds.cybersphere.com.br/app}"
DOCROOT="${DOCROOT:-/home/bearminds.cybersphere.com.br/public_html}"
BACKUP_DIR="${BACKUP_DIR:-/home/backups/bearminds}"
HEALTH_URL="${HEALTH_URL:-https://bearminds.cybersphere.com.br/api/health}"
SERVICE="${SERVICE:-bearminds-api}"

ts="$(date '+%Y%m%d-%H%M%S')"

rollback() {
  echo "↩️  Rollback: restaurando dist anterior…"
  last="$(ls -1dt "$BACKUP_DIR"/*/dist 2>/dev/null | head -1 || true)"
  [ -n "$last" ] || { echo "❌ Sem backup para rollback."; exit 1; }
  rsync -a --delete "$last/" "$DOCROOT/"
  sudo systemctl restart "$SERVICE"
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

echo "▶ Pull + build"
git pull --ff-only
npm ci
npm run build

echo "▶ Publicando dist/ no docroot"
rsync -a --delete "$APP_DIR/dist/" "$DOCROOT/"

echo "▶ Migrações (bootstrap) + restart da API"
# o schema sobe no boot da API (idempotente); systemd mantém Restart=always
sudo systemctl restart "$SERVICE"

echo "▶ Health gate"
for i in 1 2 3 4 5; do
  sleep 2
  if curl -fsS "$HEALTH_URL" | grep -q '"ok":true'; then
    echo "✅ Deploy OK: $(curl -fsS "$HEALTH_URL")"
    exit 0
  fi
done
echo "❌ Health check falhou — iniciando rollback."
rollback
exit 1
