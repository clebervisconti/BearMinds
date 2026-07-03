#!/usr/bin/env bash
# BearMinds — Stop hook.
# CUTOVER FEITO (2026-07-03): o VPS já serve o PRODUTO novo (dist + API systemd),
# atrás do Cloudflare Access. Portanto o hook NÃO deve mais fazer rsync do app legado
# sobre o public_html (isso reverteria o cutover). Agora ele só versiona no GitHub.
# Deploy do produto no VPS = `bash scripts/deploy.sh` (manual ou via cron) — ver DEPLOY.md.
set -uo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

PROJECT="/Volumes/STORAGE/Cyberlabs/Web Apps/BearMinds"
cd "$PROJECT" 2>/dev/null || exit 0

# Só age num repo git com mudanças pendentes.
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0
[ -n "$(git status --porcelain)" ] || exit 0   # nada mudou → não commita

TS="$(date '+%Y-%m-%d %H:%M:%S')"

# Versiona no GitHub (SEM tocar no VPS — o produto no VPS é atualizado por scripts/deploy.sh).
git add -A
git -c user.name="Cleber Visconti" -c user.email="cleber.visconti@icloud.com" \
    commit -q -m "chore: auto-sync ${TS}

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>" || exit 0

if git push -q origin main 2>/dev/null; then
  printf '{"systemMessage":"✅ BearMinds: alterações versionadas no GitHub (VPS via scripts/deploy.sh)."}\n'
else
  printf '{"systemMessage":"⚠️ BearMinds: commit local feito, mas o git push falhou. Rode: git push origin main"}\n'
fi
exit 0
