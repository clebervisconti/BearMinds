# BearMinds — Spec Changelog

Registro datado de onde a implementação divergiu das specs (regra do 11-roadmap).

## 2026-07-02 — Upgrade P1 (static v0 → produto PWA + API)

### Migração
- App estático v0 congelado em `legacy/` (public/, CONTENT_AUTHORING.md, scripts/register-content.py,
  deploy.sh, publish.sh). Ferramentas usam caminhos self-relative → passaram a mirar `legacy/public/`
  automaticamente. Produção segue servindo o app legado até o cutover (Stop hook e `legacy/deploy.sh`).

### Divergência de stack: SQLite driver (spec 01 §Stack)
- **Spec dizia:** `better-sqlite3`.
- **Realidade:** `better-sqlite3` (módulo nativo) **não compila** contra o V8 do Node 26
  (APIs `v8::...Value()` marcadas como deprecated → 6 erros de build; sem prebuild para o ABI do Node 26).
- **Decisão:** usar `node:sqlite` (SQLite embutido no Node, sem build nativo) atrás de um adaptador
  (`server/db.ts`) que preserva a API estilo better-sqlite3 (`prepare/run/get/all`, `pragma`,
  `transaction`). Nenhum código de rota muda; troca de driver fica isolada em `db.ts`.
- **Consequência para deploy (spec 10.2):** o Node do VPS sobe de **20 → 24 LTS** (Node ≥ 22.5 é
  requisito do `node:sqlite`; 24 é LTS com a API estável). Benefício: **zero compilação nativa** no
  deploy (não há binário para rebuildar). `package.json engines.node = ">=22.5"`.

### PWA icons
- Ícones gerados por `scripts/gen-icons.py` (PIL) — urso na cor da marca + anel verde. Determinístico,
  sem fontes de emoji. Variante maskable com safe-zone.

### Escopo entregue (P1)
- **01–02** scaffold + schema + seeds (10 habilidades Matemática 6º–9º verificadas, 2 instituições, 19 mapeamentos).
- **03** auth + consentimento LGPD (gate separável) + perfis + gate do responsável + export/deleção.
- **04** catálogo (instituições → turma → disciplina → trimestre → tópicos BNCC) + resolução de tópico livre.
- **05** motor de geração: cache-first, grounding→recusa, mathcheck, safety, log de custo; **exemplar hand-verified** de Frações Equivalentes (funciona sem chave de LLM).
- **06** FSRS por atom, "Para revisar hoje" (cap+interleaving), ancoragem à prova (readiness %).
- **07** streak por evento de aprendizagem real (1 freeze/semana) + níveis por maestria + mascote 🐻.
- **08** painel do responsável P1-lite (atividade, streak, prontidão, maestria por matéria).
- **09** headers CSP/HSTS, export/deleção, jobs noturnos (hard-delete 30d + métricas + coortes D1/D7/D30), páginas política/termos PT.
- **10** `scripts/deploy.sh` (build→rsync→restart→health gate→rollback) + `bearminds-api.service` + `DEPLOY.md`.
- Verificado: `tsc` limpo, `vite build` ok (78 KB gzip), **17 testes vitest verdes**, smoke E2E do backend (31 checks) e walkthrough do PWA no preview (register→consent→onboarding→lição→explorável→quiz).

### Pendências (não-P1 / requerem VPS)
- Cutover para servir o novo `dist/` (decisão a registrar em 11-roadmap) — produção ainda serve o app legado.
- Setup do Node 24 + systemd + OLS reverse proxy no VPS (via `hostgator-vps-manager`).
- Corpus além de Matemática e explorables gerados por LLM (só o exemplar é hand-verified no P1).
