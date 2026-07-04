#!/usr/bin/env bash
# BearMinds — deploy do PRODUTO a partir do MAC (o fluxo real e verificado, 2026-07-04).
# O app dir do VPS NÃO é um checkout git → a fonte vai por rsync-from-Mac. Este script:
#   snapshot → rsync fonte Mac→VPS → build no VPS (como o dono) → publica dist (preserva .htaccess)
#   → restart → health gate por localhost → rollback automático em falha.
#
# Credenciais em runtime (NUNCA embutidas): ~/.env.hostgator + chave SSH no Keychain.
# Uso:  bash scripts/deploy-push.sh
set -euo pipefail

# --- credenciais (referência, não segredo) ---
set -a; source ~/.env.hostgator; set +a
SSH_KEY="$(security find-generic-password -a "$USER" -s "hostgator-vps-ssh-key" -w)"
SSH="ssh -p ${HG_PORT} -i ${SSH_KEY} -o ConnectTimeout=20"
TARGET="${HG_USER}@${HG_HOST}"

APP="/home/bearminds.cybersphere.com.br/app"
DOC="/home/bearminds.cybersphere.com.br/public_html"
OWNER="bearm4935"                 # dono do site (o serviço roda como ele)
NODE_BIN="/usr/local/node24/bin"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "▶ 1/6 Snapshot (docroot + DB) no VPS"
$SSH "$TARGET" "
  BK=/home/backups/bearminds/\$(date +%Y%m%d-%H%M%S)-predeploy
  mkdir -p \"\$BK\"
  rsync -a $DOC/ \"\$BK/public_html/\"
  [ -f $APP/data/bearminds.db ] && /usr/bin/sqlite3 $APP/data/bearminds.db \".backup '\$BK/bearminds.db'\" || true
  echo \"  snapshot: \$BK\"
"

echo "▶ 2/6 rsync da fonte Mac→VPS (exclui node_modules/dist/data/.env/.git/.claude/legacy)"
rsync -az --delete \
  --exclude='.git' --exclude='node_modules' --exclude='dist' \
  --exclude='data' --exclude='.env' --exclude='.env.*' \
  --exclude='.claude' --exclude='legacy' --exclude='.DS_Store' \
  -e "$SSH" "$REPO_ROOT/" "$TARGET:$APP/"
$SSH "$TARGET" "chown -R $OWNER:$OWNER $APP"

echo "▶ 3/6 Build no VPS (como $OWNER; o servidor roda TS via tsx — só o front builda)"
$SSH "$TARGET" "runuser -u $OWNER -- bash -lc 'cd $APP && export PATH=$NODE_BIN:\$PATH && \
  { [ ! -e node_modules/.package-lock.json ] || [ package-lock.json -nt node_modules/.package-lock.json ]; } && npm ci; \
  npm run build'"

echo "▶ 4/6 Publica dist→docroot (preserva .htaccess) + restart"
$SSH "$TARGET" "
  runuser -u $OWNER -- rsync -a --delete --exclude='.htaccess' $APP/dist/ $DOC/
  systemctl restart bearminds-api
"

echo "▶ 5/6 Health gate (localhost:8787 — a URL pública fica atrás do CF Access)"
if ! $SSH "$TARGET" '
  for i in $(seq 1 25); do
    sleep 3
    H=$(curl -fsS http://127.0.0.1:8787/api/health 2>/dev/null || true)
    echo "$H" | grep -q "\"ok\":true" && { echo "  OK: $H"; exit 0; }
  done
  echo "  FALHOU"; exit 1
'; then
  echo "▶ 6/6 ❌ Health falhou — rollback"
  $SSH "$TARGET" "bash $APP/scripts/deploy.sh --rollback"
  exit 1
fi

echo "▶ 6/6 ✅ Deploy OK. Verificação rápida da migração:"
$SSH "$TARGET" "runuser -u $OWNER -- bash -lc 'export PATH=$NODE_BIN:\$PATH && node --input-type=module -e \"
  import { createRequire } from \\\"module\\\";
  const db = new (createRequire(import.meta.url)(\\\"node:sqlite\\\").DatabaseSync)(\\\"$APP/data/bearminds.db\\\");
  console.log(\\\"  DB user_version:\\\", db.prepare(\\\"PRAGMA user_version\\\").get().user_version);
\"'"
