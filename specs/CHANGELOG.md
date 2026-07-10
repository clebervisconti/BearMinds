# BearMinds — Spec Changelog

## 2026-07-10 — Visão de próxima geração, Fronteira II (spec 19)

- **Novo documento `specs/19-next-gen-vision-frontier.md`** (research/vision, não impl spec): **Parte II do
  spec 18** — aprofunda seis frentes que o 18 reconheceu mas não detalhou. Continuação da tarefa agendada
  `bearminds-cd` (mandato permanente de pesquisar features/design/UX de próxima geração para o público-alvo).
- **Método:** encomendou à CS AI Strategy squad **seis rodadas de pesquisa fresca 2025–2026** (uma por
  frente), com síntese evidência → construir → fit (guardrail/LGPD/moat) → não-fazer, e curadoria de fontes
  (preprints arXiv com datas 2026 não-verificáveis foram omitidos em favor de fontes primárias).
- **As seis frentes:** **(A) afeto/ansiedade/motivação** — mindset é estilo de feedback dirigido (efeito ~0
  no geral), a tríade erro-como-informação + retrieval de baixo risco + pausa é *idêntica* ao scaffolding
  anti-cola; 73% dos jovens BR abaixo do nível 2 em Mat. (PISA 2022); afeto por sinal de interação on-device,
  computa-e-descarta. **(B) voz & multimodal** — decisão técnica: **Whisper on-device (WASM)** porque Web
  Speech não roda em PWA iOS instalado *e* mandaria áudio de menor a terceiros; "mostre seu trabalho" por
  foto do próprio passo. **(C) pares seguros** — recomendação: **nada de DM aluno↔aluno**; bandeira
  **"Ensine o Bear"** (protégé de IA que erra de propósito) + revisão anonimizada do raciocínio + família.
  **(D) copiloto do professor** — modelo Aila (Oak): RAG-sobre-corpus + semáforo de sign-off + dashboard de
  equívocos descritivo (não prescritivo); ~5,9 h/sem economizadas; cunha "compliance BNCC na caixa". **(E)
  analytics & eficácia** — postura **ESSA Tier 4** (modelo lógico público) → dose-resposta rumo a Silver;
  ECD (Competência/Evidência/Tarefa); formato xAPI interno (Caliper é overkill); DKT "wavy" nunca exposto.
  **(F) retenção/ciclo de vida** — dois loops (aluno engaja / **pai renova**); novelty cliff ~4 semanas →
  virar para competência visível; digest = instrumento de renovação; ciclo pelo calendário letivo BR
  (ENEM 8 e 15/nov); win-back só no canal do pai, sem culpa à criança.
- **Nova moldura regulatória 2025 (transversal, favorece nosso posicionamento):** EU AI Act proíbe inferência
  de emoção em educação (fev/2025); Estatuto Digital da Criança e do Adolescente (BR, 17/set/2025) — &lt;12 vs
  12–18, consentimento parental prévio. Vira adições ao Definition of Done (§19.2) + anti-metas (§19.5).
- **Encaixe no roadmap:** §19.4 insere cada frente nas ondas já ordenadas pelo 18.7 sem quebrá-las; 3 novas
  assinaturas somam-se às 6 do 18.6. **Preserva** todos os guardrails (05) e LGPD (09). Registrado no
  `00-INDEX.md`. Nenhuma mudança de código de app.

## 2026-07-10 — Visão de próxima geração: pesquisa de features, design & UX (spec 18)

- **Novo documento `specs/18-next-gen-vision.md`** (research/vision, não impl spec): consolida o que
  precisamos desenvolver para uma plataforma de aprendizagem de próxima geração completa e inovadora,
  focada no público-alvo (estudantes BR 6–19, pagador = responsável, beachhead 8–14 Mat. 6º–9º).
- **Método:** reusou o pacote de estratégia da CS AI Strategy squad (memo + deep-review 2026-07-02) e
  encomendou à squad **duas rodadas de pesquisa fresca 2025–2026** — (1) features de plataformas de
  próxima geração, (2) padrões de design & UX para edtech jovem. Ambas com evidência causal e fontes.
- **Âncora:** é a *pedagogia* da IA, não a presença dela, que gera aprendizagem (Kestin/Harvard ~2×/h com
  guardrails; "faster completion, less learning" + preguiça metacognitiva quando a IA entrega resposta;
  Khanmigo sem diferença vs. controle → rótulo "tutor de IA" não é moat). Isso reordena prioridades para
  metacognição, calibração de confiança e scaffolding Socrático — tudo nativo do nosso moat.
- **Conteúdo:** personas do público-alvo · inventário do estado atual · gap analysis de features em 7 temas
  (SRL/metacognição, tutoria, experiência do responsável, adaptação/grafo BNCC, avaliação/anti-cola
  arquitetural, habilidades da era da IA, gamificação SDT) com tabela top-12 priorizada e recorte de MVP ·
  padrões de design (tokens semânticos estilo Wonder Blocks, tipografia/dislexia, calm tech, design por
  banda etária) · padrões de UX (tutor de IA, gamificação SDT, onboarding ético, mobile/PWA, WCAG 2.2 AA,
  LGPD art. 14) · 6 apostas de "próxima geração" · sequenciamento encaixado no roadmap (spec 11) +
  anti-metas explícitas.
- **Preserva** todos os guardrails (05) e LGPD (09); teste único de toda feature: "mantém o aluno fazendo o
  esforço?". Registrado no `00-INDEX.md`. Nenhuma mudança de código de app neste documento.

## 2026-07-09 — P6 iniciado: WebSockets para live games + chat (push-to-refetch, fallback automático)

- **Reconsideração da sessão anterior:** P6 tinha sido marcado como "não iniciado, deliberadamente" (gated
  por D90). Reavaliando item a item: WebSockets é código puro sem decisão de negócio pendente — só faltava
  coragem de engenharia, não o gate de escala. Vídeo CDN (custo/infra) e PBL/ENEM/B2B (conteúdo/vendas)
  continuam de fora — esses SIM dependem de decisão do owner ou não são engenharia.
- **Design "push-to-refetch"** (`server/ws/hub.ts` + `server/ws/server.ts`): o WebSocket só avisa
  `{"type":"update"}` — o cliente refaz o MESMO fetch REST que já usava no polling. Zero lógica de
  autorização/serialização duplicada (ex.: esconder a resposta certa antes do "reveal" em live games
  continua garantido pelo endpoint REST já testado, não reimplementado no socket).
- **Autenticação no handshake**: `sessionFromCookieHeader` (novo em `server/lib/session.ts`) reusa a mesma
  tabela `sessions` fora do ciclo de request do Hono. Autorização por canal reusa `courseAccess`/`threadAccess`
  já existentes em `chat.ts` (exportadas, não duplicadas) + checagem direta de `live_sessions` por pin.
- **Canais**: `/ws/live/:pin` (publica em `next`/`join`/`answer` de `live.ts`), `/ws/chat/channel/:courseId` e
  `/ws/chat/thread/:id` (publica no envio de mensagem em `chat.ts`). Enquetes/Q&A ficam em polling (fora do
  escopo textual do roadmap, que cita só "live games/chat").
- **Degradação automática e seguro** (`src/lib/liveSocket.ts`, hook `useRealtimeChannel`): se a WS não
  conectar — cenário esperado em produção até o proxy reverso do VPS ser configurado para passthrough de
  `Upgrade`/`Connection`, não verificável sem acesso ao servidor — o cliente cai de volta ao polling já
  testado (`LivePlay.tsx`, `LiveHost.tsx`, `CursoInteragir.tsx`). Nenhuma funcionalidade pode quebrar por
  causa disso; documentado com instruções para o owner em `DEPLOY.md`.
- **Verificação além dos testes unitários**: smoke test real de ponta a ponta — servidor com a camada WS
  anexada, cliente `ws` autentica via registro real, conecta a `/ws/live/:pin`, dispara uma mutação REST real
  (`POST /api/live/join`) e confirma o recebimento do push pelo socket. Também confirmado: upgrade sem
  cookie → 401; upgrade autenticado mas canal inexistente → 403.
- Verificado: `tsc --noEmit`/`vite build` verdes, **109 testes vitest** (+6 em `tests/websocket-hub.test.ts`,
  hub de pub/sub puro). Guardrails (05)/LGPD (09) inalterados.

## 2026-07-09 — P5 completo (P5b gap + P5c ENTREGUE, spec 17) + P5-r parcial (paywall manual, correlação)

- **Objetivo da sessão:** fechar o backlog P5 inteiro e avançar P5-r/P6 até onde código sozinho resolve —
  sem fingir que dados reais, credenciais externas (Stripe/Pix, SMTP) ou decisões de negócio do owner
  (D90, custo de infra) já existem. Ver `11-roadmap.md` para o que ficou explicitamente fora e por quê.
- **Migração v8 aditiva** (`server/db.ts`): `course_groups`, `checklist_state`, `peer_exemplars`,
  `submission_self_assessments`, `mission_submissions`, `mission_reviews` + `enrollments.group_id` +
  `parents.founding_member_at` + rebuild aditivo de `content_items.kind` (+`quick_update`,+`mission`) e
  `consents.scope` (+`media_recording`) — mesma técnica de rebuild usada na v5. Testado em DB fresco (seed
  v0→v8 num `tsx server/scripts/seed.ts` limpo) e em runtime real (boot do servidor + `/api/health` +
  endpoint autenticado 401 correto).
- **P5b gap fechado — Grupos dentro do curso** (spec 16.6, `server/routes/groups.ts`): turmas paralelas
  compartilhando um só conteúdo; aba "Grupos" em `AdminGestao.tsx`.
- **P5c ENTREGUE (spec 17 novo)**:
  - **Quick Updates + Checklists** (`quickupdates.ts`): micro-lição + 1 pergunta opcional + passos
    rastreáveis; conclusão reaproveita `POST /learn/items/:id/progress`. Autoria em `AdminCurso.tsx`.
  - **Exemplares de pares** (`exemplars.ts`): promoção pelo professor → pendente → consentimento do
    responsável (Configurações) → visível só depois de `granted`, nunca automático.
  - **Auto-avaliação vs professor** (`selfassess.ts` + `lib/rubric.ts` reusado): aluno se autoavalia com a
    mesma rubrica; gap view por curso (`GET .../self-assessment-gap`) para o professor.
  - **Readiness 2.0** (`lib/readiness.ts` puro + `readiness.ts`): rollup 40/30/30 conhecimento (FSRS,
    reusa `readinessForCodes` de 06) + habilidade (rubricas) + execução (provas); dimensão sem dado
    redistribui peso em vez de zerar.
  - **Missions-lite** (`missions.ts` + `lib/missions.ts`): grava áudio/vídeo, **IA pré-analisa a
    transcrição digitada pelo aluno** (honesto: sem ASR configurado, nenhuma transcrição automática de fala
    neste produto). Escopo LGPD dedicado — novo `ConsentScope='media_recording'` (opt-in em Configurações,
    NUNCA no onboarding geral), retenção de 180 dias com poda automática no nightly
    (`pruneExpiredMissions`, chamado de `runNightly`), revisão só pelo professor (`AdminMissoes.tsx`).
- **P5-r parcial** (`paywall.ts`, `correlation.ts` + `lib/correlation.ts`): founding-member paywall com
  **link de pagamento manual** (Pix/Stripe — sem gateway integrado, sem credencial no `.env`; o owner cola o
  link + marca founding members por e-mail depois de confirmar o pagamento fora do sistema — exatamente o
  "manual" que o roadmap sempre previu) + correlação pós-prova (Pearson, prontidão FSRS atual × nota real,
  limitação de MVP documentada no spec 17 e na UI).
- **P6 não iniciado, deliberadamente**: WebSockets/CDN de vídeo/ENEM/B2B seguem gated pela métrica D90 —
  não há usuários reais neste ambiente para justificar o risco de regressão de migrar o polling testado de
  P4b/c, e os demais itens são conteúdo/vendas, não engenharia.
- Verificado: `tsc --noEmit`/`vite build` verdes, **103 testes vitest** (+23 novos em `tests/engajamento.test.ts`
  — grupos, quick updates, exemplares, gap de autoavaliação, rollup de readiness, poda de missions,
  consentimento `media_recording`, paywall, correlação de Pearson). Smoke test real: seed limpo v0→v8,
  boot do servidor, `/api/health` ok, endpoint público real retornando dados, endpoint autenticado 401
  correto. Guardrails (05)/LGPD (09) inalterados; LGPD estendida com o escopo dedicado de Missions.

## 2026-07-09 — P5b ENTREGUE (spec 16): gestão & automação — UI completa sobre o backend

- **Frontend das 5 features do P5b** (o backend + testes já existiam desde o commit anterior; faltava a UI):
- **Cliente tipado** (`src/lib/api.ts`): `adminGradebook`, `adminCourseReports`, `adminEnrollmentRules`,
  `adminCreateEnrollmentRule`, `adminDeleteEnrollmentRule`, `adminDuplicateCourse`, `myGrades`, `myTimeline`
  + tipos `Gradebook`/`CourseReports`/`EnrollmentRule`/`GradeCourse`/`TimelineItem`. Hooks `useTimeline`/`useMyGrades`.
- **Área de gestão do curso** (`AdminGestao.tsx`, rota `/admin/curso/:id/gestao`, botão "📊 Gestão" no editor):
  4 abas —
  1. **Boletim** (16.3): tabela alunos × atividades (provas 📝 + tarefas 🗂) com % por item e média consolidada
     colorida por faixa; colunas/linhas sticky, scroll horizontal.
  2. **Relatórios** (16.5): cards de participação 7d, conclusão média, média em provas e em tarefas.
  3. **Auto-matrícula** (16.1): lista/cria/remove regras (série + turma, em branco = todas); criação restrita a
     `institution_admin`/`platform_admin` (professor só visualiza).
  4. **Duplicar** (16.2): clona o curso em rascunho (novo título + turma) e navega ao curso clonado.
- **Dashboard do estudante**: bloco **"O que vence em seguida"** (16.4 — tarefas/provas com prazo, ordenadas,
  🔒 quando bloqueado, clique abre prova/curso) + card **"Boletim"** no trilho direito (média por curso, cor por faixa).
- **Fixes transversais respeitados**: ~5 campos por tela; 1 agregação de nota padrão (média aritmética) com prévia
  na própria tela; bloqueado = visível com motivo (🔒 + `lock_reason`).
- Verificado: tsc/build verdes, **80 testes vitest** (inclui os 4 de `gestao.test.ts`). Guardrails (05)/LGPD (09) inalterados.

## 2026-07-04 — IA migrada do Gemini API para Gemma local (MLX no HULK)

- **Toda a IA do BearMinds** (decompose, resolve, lição, explorável, quiz, math-check, pré-análise de tarefas)
  passa a usar **`mlx-community/gemma-3-4b-it-4bit`** rodando via `mlx_lm server` no HULK (Mac mini), em vez do Gemini API.
- **Driver novo** `OpenAICompatDriver` (`server/llm/provider.ts`): fala o endpoint OpenAI-compatible do MLX
  (`/v1/chat/completions`), sem SDK. Casa modelos `mlx-*`/`gemma`/`local-*`. Auth opcional: Bearer ou **Cloudflare
  Access service token** (headers `CF-Access-Client-Id`/`Secret`). Env: `LLM_BASE_URL`, `LLM_API_KEY`,
  `LLM_CF_ACCESS_CLIENT_ID/SECRET`, `LLM_TIMEOUT_MS`. `MODEL_*` default = gemma. `llmConfigured` passa a valer p/ endpoint local.
- **Conectividade prod (VPS→HULK):** o Gemma já era exposto pelo túnel Cloudflare `agentos` em
  `mlx.cybersphere.com.br → localhost:8081`, protegido por **Cloudflare Access** (não-aberto). Criado um service
  token dedicado **`bearminds-gemma`** e adicionado à política da app (sem afetar o llmviz). O `.env` do VPS aponta
  `LLM_BASE_URL=https://mlx.cybersphere.com.br/v1` + os headers do token; `GEMINI_API_KEY` comentado.
- **Guardrails (05) inalterados** — grounding, answer-withholding, math-check continuam; só o backend do modelo mudou.
  `parseJSON` já trata as cercas ```json que o Gemma às vezes devolve.
- **Trade-off aceito pelo owner:** gemma-3-4b-it-4bit é bem menor que o gemini-2.5-flash (qualidade/consistência de
  JSON menor) e a IA passa a depender do HULK+túnel estarem no ar (mlx-watchdog mantém o Gemma vivo). Sem fallback cloud.
- Verificado: tsc/build/76 testes verdes (testes offline via `LLM_BASE_URL=""`), chamada real em produção
  (VPS→Cloudflare→HULK) retornou resposta do Gemma (~1.1s).

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
