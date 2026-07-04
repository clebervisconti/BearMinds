# BearMinds — Spec Changelog

## 2026-07-04 — Tema CYBERSPHERE Design System (light) aplicado à plataforma inteira

- **Fonte da verdade:** skill `cs-branding` (o projeto claude.ai/design não é acessível em sessão headless
  — DesignSync exige login interativo). Tokens light oficiais aplicados.
- **Paleta (skin `formal` + `:root`, plataforma toda):** bg `#f5f5f5` (canvas) · surface `#ffffff` (cards) ·
  surface-2 `#ececec` · ink **Preto Neural `#1e1e1e`** · muted `#5f5f5f` · primary/accent **Verde Ascensão `#28d600`**
  (só FILL/regra) · primary-ink `#1e1e1e` (texto sobre verde = CTA CYBERSPHERE) · novo `--bm-link` `#1e1e1e`
  (texto interativo escuro) · success `#178000` (verde escuro legível) · border `#e2e2e2`.
- **Regra de marca no claro respeitada:** Verde nunca é texto no branco — só preenchimento (botões, logo,
  pílula de nav ativa, selo do certificado) e regra (sublinhado de link, borda inferior de aba/curso, barra
  de progresso). Links = escuro + sublinhado Verde. Todos os `color:var(--bm-primary)` de texto (8 inline +
  abas locais + badges live) trocados por `--bm-link`.
- **Tipografia:** Inter → **Plus Jakarta Sans** (títulos/CTAs/eyebrows, variable, self-hosted via
  `@fontsource-variable/plus-jakarta-sans`) + **Poppins** (corpo, `@fontsource/poppins` 300–700). Self-hosted
  para respeitar o CSP estrito (sem Google Fonts externo).
- **Cromo rebrandizado:** logo-mark (Verde), heros Conquistas/Comunidade (Preto Neural → verde-black), pílulas
  de ranking (monocromático escuro), avatares (indigo→verde-dark), página pública de certificado (selo Verde,
  títulos Preto Neural, regra verde). Skins infantis da Aula (8-10/11-14/15-18) **intocadas** (decisão do owner).
- Verificado: tsc/build verdes, preview desktop+mobile (tokens `#f5f5f5`/`#1e1e1e`/`#28d600` + Jakarta/Poppins
  confirmados), sem erros de console.

## 2026-07-04 — P5a ENTREGUE (spec 15): assessment core — banco, provas, tarefas, rubricas, desbloqueio

- **Migração v5 aditiva:** `events`, `bank_questions`, `exams`, `exam_attempts`, `rubrics`, `submissions`,
  `submission_reviews` + `availability_json` em módulos/itens + `assignment` como novo kind de item
  (rebuild seguro de `content_items` — nenhuma tabela a referencia; testado em DB populado, linhas preservadas).
- **Events stream** (`server/lib/events.ts`): emitido em enroll/item/módulo/curso/live/exam/submission; poda 12m no nightly.
- **Banco de questões** (`server/routes/bank.ts` + enrich): a IA gera rascunhos ao enriquecer uma lição
  (`persistQuestionsToBank`), professor cura/aprova (sign-off), editar aprovada versiona (antiga `retired`).
  UI `/admin/curso/:id/avaliacao` (aba Banco): filtro por status, criar mcq/tf/short/numeric, aprovar/aposentar.
- **Provas** (`server/exams/grade.ts` puro + rotas): pool = filtro BNCC + sorteio reproduzível por seed
  (`seededShuffle`, mulberry32), embaralha opções, cronometrada, auto-correção mcq/tf/numeric (short → professor),
  score→evento de prontidão. UI: aba Provas (criar/publicar/resultados por questão) + `/prova/:id` (aluno).
- **Tarefas + rubricas** (`server/lib/rubric.ts` puro + `server/routes/assignments.ts`): submissão texto
  (arquivo aluno fica p/ P5b — precisa de upload não-staff), rubrica de seções ponderadas reutilizável,
  **IA pré-análise do revisor** (resumo/cobertura/lacunas/suspeita-de-IA — sugestão, NUNCA nota).
  UI: `/admin/curso/:courseId/item/:itemId/entregas` + entrega inline na página do curso.
- **Motor de desbloqueio** (`server/lib/availability.ts` puro): árvore JSON `all/any/completed/module_mastered/
  exam_min/date_from`, resolver DB durável, 🔒 com motivo legível; preset "após item anterior" no editor;
  enforcement no course-view e no progresso/submissão.
- **Gamificação por faixa etária** (spec 15.6): 8-10 vê agregado da turma (sem ranking individual), 11+ inalterado.
- **Fixes transversais aplicados:** ~5 campos por tela + avançado; 1 agregação com prévia (rubrica); bloqueado = visível com motivo.
- Verificado: tsc/build verdes, **76 testes vitest** (+23: availability truth-table, seed reproduzível,
  gradeResponse, rubrica ponderada, versionamento, persist-to-bank idempotente), migração v5 em DB populado,
  E2E no preview (endpoints vazios limpos, guardian 403 em banco/rubricas, Conquistas age-banded). Guardrails (05)/LGPD (09) inalterados.

## 2026-07-04 — P5 re-planejado: análise de gap Moodle + MindTickle → spec 15 + backlog P5a/b/c

- **Pesquisa (2 análises paralelas):** Moodle (github.com/moodle/moodle + docs — taxonomia de 23 activity
  modules, banco de questões 2-eixos tipo×comportamento, availability tree JSON, completion genérica,
  gradebook, roles-em-contexto, cohorts/grupos, events→relatórios, calendar auto-derivado) e MindTickle
  (github deles = só forks de infra, zero produto; pesquisa via produto/docs/reviews — Series→Modules,
  Quick Updates/Checklists, reforço espaçado adaptativo, Missions/role-plays com pré-análise IA + rubrica
  humana, coaching scorecards, Readiness Index = rollup ponderado de evidências, regras de auto-assignment,
  IA nos 3 pontos de alavanca: autoria/praticante/revisor).
- **O que JÁ superamos (não reconstruir):** FSRS por atom > reforço por tópico do MindTickle; autoria IA
  grounded + sign-off; mastery-gate; live/enquetes/Q&A; DM só aluno↔staff; coaching em risco; certificados.
- **Novo spec `15-assessment-core.md` (P5a):** events stream · banco de questões desacoplado (IA preenche,
  professor cura, versões, pools por filtro+sorteio) · provas (sorteio randomizado anti-cola, cronômetro,
  auto-correção, score→prontidão) · tarefas com submissões + rubricas ponderadas reutilizáveis + IA
  pré-análise do revisor (nunca nota automática) · motor de desbloqueio (árvore JSON, 3 presets, 🔒 com
  motivo) · gamificação por faixa etária (8-10 sem ranking individual público — decisão do owner) ·
  migração v5 aditiva.
- **Backlog P5b/P5c no `11-roadmap.md`:** P5b = auto-matrícula por regras, rollover de curso, gradebook-lite
  (1 agregação + prévia), calendário/timeline, relatórios, grupos; P5c = quick updates/checklists,
  exemplares de pares, auto-avaliação vs professor, Readiness 2.0 (rollup BNCC), Missions-lite (áudio/vídeo
  com escopo LGPD dedicado — planejar agora, construir por último; decisão do owner). P5-r (pagamento/retenção)
  inalterado, em paralelo.
- **Fixes transversais (anti-complaints):** ~5 configurações por tela + "avançado"; defaults opinativos;
  UI kit único; bloqueado = visível com motivo; sem lockdown browser.
- Decisões do owner (2026-07-04): wave inicial = P5a; Missions planejada agora com consent scope, build em
  P5c; gamificação age-banded = sim; pipeline vive em specs + roadmap (sem GitHub Issues).
- Guardrails (05) e LGPD (09) inalterados em todas as waves.

## 2026-07-04 — P4b/P4c: aprendizagem ao vivo & social (spec 14) — Kahoot, Slido, chat, coaching, certificados, moderação

- **Novo spec `14-live-social.md`** e **`11-roadmap.md` reconciliado** (P1→redesign→P4a→P4b/P4c entregues; P5/P6 futuros).
- **Live games (Kahoot, 14.1):** sessão por PIN a partir de um item de quiz publicado; host controla o ritmo
  (lobby → pergunta → revelar → pódio); pontuação `base 600 + bônus de velocidade até 400` (`server/live/scoring.ts`,
  puro/testável); estado por **polling** (decisão do owner) que **nunca revela a resposta antes do reveal**;
  moedas de participação no fim. Console do professor `/admin/live/:itemId`; jogo do aluno `/live` (PIN → responder
  cronometrado → pódio).
- **Enquetes & Q&A (Slido, 14.2):** enquetes com apuração ao vivo (um voto por aluno, `INSERT OR REPLACE`);
  Q&A com upvote, ordenado por `answered ASC, votes DESC`; staff cria enquete e marca respondida.
- **Chat (14.3):** canal por curso (aluno+staff) **+ DM privada estudante↔staff** — **nunca aluno↔aluno**
  (thread do aluno sempre aponta para o staff criador do curso; caixa de entrada do staff em `/admin/coaching`).
- **Coaching/tutoria (14.4):** painel de alunos **em risco** (streak quebrado / prontidão < 60% / inativo 7d+,
  `riskFlags` puro), anotações de acompanhamento, DM.
- **Certificados (14.5):** emitidos na conclusão do curso; **verificação PÚBLICA** `/certificado/:code`
  (sem PII sensível — apelido + curso + instituição + data). Listados em Conquistas.
- **Moderação (14.6):** fila de conteúdo denunciado (`flagged`) com ocultar (`deleted_at`) / restaurar — institution_admin+.
- Migração v4 (aditiva): `live_sessions`, `live_players`, `live_answers`, `polls`, `poll_votes`, `qa_questions`,
  `qa_votes`, `chat_channels`, `chat_threads`, `chat_messages`, `tutor_notes`, `certificates` (+ índices).
- **Reuso:** mesmo motor de quiz cacheado (grounding), FSRS/prontidão, moedas/streak, sessões/CSRF, AppShell/tokens.
  Guardrails do spec 05 inalterados. Verificado: tsc/build verdes, **53 testes vitest** (+19: scoring, PIN, tally,
  ordenação Q&A, chat sem aluno↔aluno, riskFlags, certificado sem PII, moderação), E2E no preview
  (PIN entry autenticado, verificação pública, endpoints vazios limpos, guardian 403 em coaching/moderação/inbox).
- **Futuro (P5/P6):** WebSockets no lugar do polling, vídeo self-hosted/HLS, PBL (Inteli), pagamento/retenção.

## 2026-07-04 — P4a: LMS (spec 13) — administração, professores e pipeline de conteúdo

- **Novo spec `13-lms.md`:** papéis invite-only (guardian/professor/tutor/institution_admin/platform_admin),
  cursos por instituição+disciplina+período, módulos com Learning Backlog (Inteli), itens (video/document/lesson/
  quiz/game/live), **pipeline de enriquecimento IA** (upload → chunks por curso → atoms → geração grounded →
  aprovação humana), matrícula self/assigned, **conclusão de módulo mastery-gated** (+100 moedas).
- Pesquisa: Inteli (metaprojetos/backlog/tríade/papéis duais), Kahoot (live PIN/pódio — P4b), Slido (enquetes/Q&A — P4b).
- Decisões do owner: staff invite-only; vídeo = embeds + MP4 ≤200MB; chat = canais + DM estudante↔staff (P4b);
  live games polling (P4b). CSP `frame-src` estendido só p/ youtube-nocookie + player.vimeo.
- Migração v3 (aditiva): `parents.role` + `parents.staff_institution_id`, `invites`, `courses`, `course_modules`,
  `content_items`, `files`, `enrollments`, `item_progress`, `corpus_chunks.course_id`, `knowledge_atoms.course_id`.
- Guardrails do spec 05 inalterados; conteúdo de professor passa pelo MESMO sign-off humano (verified_at).

**Entregue (mesma data):** papéis + convites (invite-only, bootstrap `npm run make-admin`), área /admin
(overview, editor de curso→módulo→item, upload MP4/PDF/DOCX/TXT/MD, enriquecer com IA + fila de revisão/aprovação,
matrícula assinada, pessoas & convites, instituições), pipeline `server/gen/enrich.ts` (skill sintético `CRS-<item>`
reusa TODO o motor: retriever/decompose/generate/guardrails/FSRS), lado do estudante (catálogo, /curso/:id com
missões + Learning Backlog 🟢🟡⚪, player vídeo/documento/lição, conclusão mastery-gated +100 moedas + badge),
CSP frame-src p/ youtube-nocookie+vimeo, media-src self. Verificado: tsc/build verdes, **34 testes vitest**
(incl. o teste-chave: itens done + atoms não dominados ⇒ NÃO conclui), E2E no preview: admin cria/publica curso →
aluna se inscreve → player → "Módulo concluído com maestria +100" → guardian 403 em /api/admin.
Pendente P4a: testar pipeline IA completo no VPS (tem GEMINI_API_KEY); P4b: live games, chat, tutores.

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
