# BearMinds — Spec Changelog

## 2026-07-03 — Platform redesign (spec 12): plataforma para estudantes 6–19

- **Pivô de produto (decisão do owner):** de app infantil parent-fronted para plataforma de estudos
  (Moodle/Mindtickle-like) para estudantes **6–19**. Novo spec: `12-platform.md`.
- **Conta owner-fronted:** o titular pode estudar (perfil `kind:'self'`, self-consent) e/ou criar perfis
  filho (fluxo LGPD art. 14 inalterado). SUPERSEDE spec 03 §3.4 (MIN_AGE 8→6; 6–7 clampa na banda '8-10').
- **Leaderboard POR INSTITUIÇÃO** (decisão do owner, 2026-07-03): SUPERSEDE o item "AVOID competitive
  leaderboards between children" do spec 07. Salvaguardas: apelido apenas, opt-out por perfil
  (`leaderboard_hidden`), top 20 + posição própria, nunca punitivo.
- **Comunidade aberta a todos os perfis** (decisão do owner) com salvaguardas: escopo por instituição,
  texto puro, sem DMs, apelido apenas, denúncia (`flagged`).
- **Shell formal** (skin `formal` padrão); skins infantis mantidas SÓ dentro da Aula de perfis child.
- Migração v2 (aditiva): `children.kind` + `children.leaderboard_hidden`, `notifications`, `coin_ledger`,
  `achievements`, `community_posts`, `community_replies`.
- Nenhum guardrail do spec 05 (grounding/answer-withholding/sandbox) foi alterado.

**Entregue (mesma data):** shell formal (sidebar desktop + bottom nav mobile), 7 áreas (Dashboard, Cursos,
Atividades, Comunidade, Conquistas, Notificações, Configurações), onboarding "Quem vai estudar?" (Eu mesmo /
Meu filho), economia de moedas + 6 badges + leaderboard por instituição, rotas
notifications/gamification/community, cliente tipado + hooks. Verificado: `tsc` limpo, **25 testes vitest**,
build 84.7 KB gzip, walkthrough no preview (self-onboarding → loop completo com 90 moedas + badge +
notificação → post na comunidade → leaderboard; fluxo filho com gate LGPD intacto e skin infantil SÓ na Aula).

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

### Cutover — GATED DEPLOY (LIVE em 2026-07-03)
O produto está no VPS, atrás do Cloudflare Access (só Cleber acessa, via OTP por e-mail):
- **Node 24.18.0** em `/usr/local/node24` (isolado; system node 20 intacto). `node:sqlite` OK.
- App em `/home/bearminds.cybersphere.com.br/app` (rsync do source → `npm ci` → build → seed). `.env` 0600 (secrets gerados; `GEMINI_API_KEY` injetado ⇒ geração completa).
- **systemd `bearminds-api`** (User=bearm4935, `HOST=127.0.0.1:8787`, enable+start). Cold start ~40s (tsx transpila no boot).
- **OLS**: `public_html` = `dist/` (snapshot do legado em `/home/backups/bearminds/`); `/api` via `.htaccess [P]` + extprocessor `127.0.0.1:8787` no vhost.conf. clebervisconti.com verificado intacto.
- **Cloudflare Access** app `15f2a97f-03cc-4244-9124-96986f0b4678` (policy allow `cleber.visconti@icloud.com`). Público → 302 p/ `clebervisconti.cloudflareaccess.com`.
- Verificado: health via proxy, GET+POST via proxy, CSP header, gate público 302.

**Para tornar PÚBLICO** (fim da validação): remover/relaxar a policy do Access app `15f2a97f…`.
**Rollback do cutover**: restaurar `public_html` do snapshot em `/home/backups/bearminds/<ts>/public_html` + `lswsctrl reload`.

### Pendências
- Validação humana E2E logando via OTP (só Cleber consegue).
- Corpus além de Matemática e explorables gerados por LLM (só o exemplar é hand-verified no P1).
- Opcional: pré-compilar TS→JS p/ restart rápido; cron do `scripts/deploy.sh` + `jobs:nightly` no VPS.
