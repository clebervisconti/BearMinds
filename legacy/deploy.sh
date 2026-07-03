#!/usr/bin/env bash
# BearMinds — deploy: rsync public/ -> VPS docroot + reload OpenLiteSpeed.
set -euo pipefail

set -a; source ~/.env.hostgator; set +a
SSH_KEY=$(security find-generic-password -a "$USER" -s "hostgator-vps-ssh-key" -w)
SRC="$(cd "$(dirname "$0")" && pwd)/public/"
DEST="/home/bearminds.cybersphere.com.br/public_html/"
SSH_OPTS="-p ${HG_PORT} -i ${SSH_KEY} -o BatchMode=yes"

echo "▶ Enviando $SRC → ${HG_HOST}:${DEST}"
rsync -rz --delete --no-perms --no-owner --no-group \
  -e "ssh ${SSH_OPTS}" "$SRC" "root@${HG_HOST}:${DEST}"

echo "▶ Ajustando permissões e recarregando OLS"
ssh ${SSH_OPTS} "root@${HG_HOST}" '
  chown -R bearm4935:nobody /home/bearminds.cybersphere.com.br/public_html
  find /home/bearminds.cybersphere.com.br/public_html -type d -exec chmod 755 {} \;
  find /home/bearminds.cybersphere.com.br/public_html -type f -exec chmod 644 {} \;
  /usr/local/lsws/bin/lswsctrl reload >/dev/null 2>&1 && echo "  OLS recarregado"
'
echo "✅ Publicado: https://bearminds.cybersphere.com.br"
