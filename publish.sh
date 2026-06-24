#!/usr/bin/env bash
# BearMinds — publica: registra os módulos de conteúdo no index.html e faz deploy.
# Use depois de adicionar/atualizar um public/assets/js/content-*.js
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"

echo "▶ Registrando módulos de conteúdo"
python3 "$HERE/scripts/register-content.py"

echo "▶ Publicando no VPS"
bash "$HERE/deploy.sh"
