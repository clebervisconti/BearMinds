#!/usr/bin/env bash
# BearMinds — Stop hook.
# Quando há mudanças pendentes: registra conteúdo, commita + push no GitHub e
# publica no VPS (rsync + reload OLS). Se nada mudou, sai em silêncio (sem deploy).
set -uo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

PROJECT="/Volumes/STORAGE/Cyberlabs/Apps/BearMinds"
cd "$PROJECT" 2>/dev/null || exit 0

# Só age num repo git com mudanças pendentes.
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0
[ -n "$(git status --porcelain)" ] || exit 0   # nada mudou → não commita nem publica

TS="$(date '+%Y-%m-%d %H:%M:%S')"

# 1) Registra módulos de conteúdo (atualiza index.html se preciso)
python3 scripts/register-content.py >/dev/null 2>&1 || true

# 2) Versiona no GitHub
git add -A
git -c user.name="Cleber Visconti" -c user.email="cleber.visconti@icloud.com" \
    commit -q -m "chore: auto-sync ${TS}

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>" || exit 0

if ! git push -q origin main 2>/dev/null; then
  printf '{"systemMessage":"⚠️ BearMinds: commit local feito, mas o git push falhou. Rode manualmente: git push origin main"}\n'
  exit 0
fi

# 3) Publica no VPS (rsync + reload OpenLiteSpeed)
if bash deploy.sh >/dev/null 2>&1; then
  printf '{"systemMessage":"✅ BearMinds sincronizado: GitHub + VPS publicados."}\n'
else
  printf '{"systemMessage":"⚠️ BearMinds: GitHub OK, mas o deploy no VPS falhou. Rode manualmente: ./deploy.sh"}\n'
fi
exit 0
