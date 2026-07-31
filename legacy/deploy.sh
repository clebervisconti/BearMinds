#!/usr/bin/env bash
# ==========================================================================
# ⛔ DESATIVADO — 2026-07-30. O VPS HostGator foi eliminado.
#
# Este script fazia rsync --delete para 129.121.49.96, que NAO e mais nosso.
# Aquele IP pode ter sido reatribuido a outro cliente: executar isto hoje
# enviaria arquivos para um servidor de terceiros. Por isso aborta em vez de
# apenas falhar.
#
# Onde as apps rodam agora: Cloudflare Tunnel a partir de HULK e B4TM4N,
# cada uma um servico launchd. Veja infra/docs/naming-standard.md no
# repositorio cyberlabs-infra.
# ==========================================================================
echo "ABORTADO: este deploy aponta para o VPS HostGator, que foi eliminado." >&2
echo "Veja o cabecalho deste arquivo." >&2
exit 1

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
