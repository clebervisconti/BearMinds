# 11 · Roadmap, Milestones & Kill Criteria

> **Reconciliado 2026-07-04.** A numeração real do produto seguiu P1 → redesign (spec 12) → P4 (LMS).
> Este documento reflete o que foi entregue e o que resta. As metas de lançamento e tripwires seguem válidas.

## Fases entregues

### P1 — "The learning loop lives" (spec pack 01–11) ✅ 2026-07-02
Scaffold + schema + seeds (BNCC Matemática 6º–9º) · auth/consentimento LGPD + perfis · onboarding + catálogo +
resolução de tópico · **motor de geração grounded** (lição + explorável + quiz) com guardrails + exemplar
hand-verified (frações equivalentes) · FSRS + "Para revisar hoje" + prova · gamificação-lite · painel do
responsável · checklist LGPD/segurança · deploy no VPS + health gate.
**DoD:** família registra → consente → onboarda → criança faz o loop no PWA iPhone → dia seguinte vê revisões.

### Redesign — plataforma para estudantes 6–19 (spec 12) ✅ 2026-07-03
Conta owner-fronted (perfil "eu mesmo" + filhos) · shell formal (dashboard, cursos, atividades, comunidade,
conquistas, notificações, config) · economia de moedas + leaderboard **por instituição** · comunidade.
Seguido no mesmo dia por um **UI professional pass** (referências UMGC/D2L + MIT/Olympus): top nav, dashboard
2 colunas, tipografia Inter, elevação.

### P4a — LMS: administração, professores, conteúdo (spec 13) ✅ 2026-07-04
Papéis invite-only · área /admin (cursos→módulos→itens, upload, embeds) · **pipeline de enriquecimento IA**
(material do professor → lição+quiz grounded → aprovação humana) · matrícula · Learning Backlog (Inteli) ·
**conclusão mastery-gated** (+100 moedas).

### P4b + P4c — aprendizagem ao vivo, social, coaching, certificados (spec 14) ✅ 2026-07-04
Live games estilo Kahoot (PIN, tempo, pódio; polling) · enquetes + Q&A com upvote (Slido) · chat (canais por
curso + DM estudante↔staff) · dashboard de tutoria (alunos em risco + anotações) · certificados na conclusão
(+ verificação pública) · dashboard de moderação (fila de denúncias).

> **P5 re-planejado em 2026-07-04** a partir da análise de gap **Moodle + MindTickle** (o que roubar, o que
> evitar — detalhes no CHANGELOG). O que JÁ superamos e não reconstruímos: FSRS por atom (mais fino que o
> reforço adaptativo por tópico do MindTickle), autoria IA grounded com sign-off humano, conclusão
> mastery-gated, live games/enquetes/Q&A, chat com DM só aluno↔staff, coaching em risco, certificados
> verificáveis, LGPD parent-fronted.

### P5a — Assessment core (spec 15) ✅ 2026-07-04
1. **Events stream** (Moodle): tabela de eventos estruturados alimentando todos os relatórios futuros.
2. **Banco de questões** (Moodle, a joia): desacoplado do quiz, BNCC+tags, versionado; **IA preenche
   (pipeline enrich), professor cura/aprova**; pools = filtro + sorteio.
3. **Provas**: autoradas pelo professor, sorteio randomizado por pool (anti-cola), cronometradas,
   auto-correção; score → evidência de prontidão (fecha a correlação predito × real).
4. **Tarefas + Rubricas** (MindTickle): submissões texto/arquivo, rubricas de seções ponderadas
   (reutilizáveis por tarefas/missions/coaching), **IA como pré-análise do revisor** — nunca nota automática.
5. **Motor de desbloqueio** (Moodle availability tree + MindTickle sequential unlock): árvore JSON de
   condições em módulos/itens, 3 presets no editor, 🔒 com motivo legível.
6. **Gamificação por faixa etária** (fix): 8-10 = progresso pessoal + agregado da turma (sem ranking
   individual público); 11+ = leaderboard da instituição como está. Decisão do owner 2026-07-04.
- Migração v5 aditiva. Guardrails (05) e LGPD (09) inalterados.

### P5b — Gestão & automação (spec 16) ✅ 2026-07-09
1. **Regras de auto-matrícula** (MindTickle): predicados sobre perfil ("série=7EF E escola=X → série Y") —
   política uma vez, zero matrícula manual.
2. **Duplicação de curso / rollover de período** (Moodle, o recurso mais usado por professores).
3. **Gradebook-lite**: UMA agregação padrão (média aritmética) com prévia na tela, visão
   professor + aluno + responsável.
4. **Calendário/Timeline** (Moodle, o recurso mais usado por alunos): prazos derivados automaticamente dos
   itens (due de tarefas/provas), bloco "o que vence em seguida" no Dashboard.
5. **Relatórios por curso** (consumidores do events stream): participação, conclusão, médias.
6. **Grupos dentro do curso** (turmas paralelas com um só conteúdo).
- Importar itens entre cursos e export CSV do boletim **ficaram fora** desta wave (não implementados) —
  candidatos a um polish futuro, não bloqueiam nada em produção.

### P5c — Engajamento & prática (spec 17) ✅ 2026-07-09
1. **Quick Updates + Checklists** (MindTickle): micro-lição de 3 min com 1-2 perguntas; listas de passos
   rastreáveis — o push diário que não é um curso.
2. **Exemplares de pares** (MindTickle, a melhor mecânica social): professor promove as melhores
   submissões a conteúdo de estudo (moderação obrigatória, consentimento do responsável).
3. **Auto-avaliação vs avaliação do professor** (metacognição — ouro pedagógico para teens): gap view.
4. **Readiness 2.0** (MindTickle Readiness Index → BNCC): prontidão = rollup ponderado 40/30/30 —
   conhecimento (FSRS) + habilidade (rubricas) + execução (provas); dashboard professor/responsável.
5. **Missions-lite**: gravar áudio/vídeo "explique o conceito"/fluência de leitura/idiomas; **IA pré-analisa
   uma transcrição digitada pelo aluno** (este produto não tem ASR/transcrição automática de fala
   configurada — limitação honesta, documentada no spec 17), professor avalia por rubrica ouvindo/assistindo
   o arquivo. Escopo LGPD dedicado: consentimento próprio de mídia (`media_recording`), nunca pública,
   revisão só professor, retenção limitada (poda automática no nightly).
- IA nos 3 pontos de alavanca em todas as waves (autoria/praticante/revisor) — sempre grounded + sign-off.

### Fixes transversais (lições dos reviews Moodle/MindTickle — aplicar em toda tela nova)
- Máx. ~5 configurações visíveis por tela; resto atrás de "avançado". Defaults opinativos > configurabilidade.
- UMA agregação de notas padrão com prévia ao vivo. UI kit único entre tipos de atividade.
- Conteúdo bloqueado = visível com 🔒 + motivo (não oculto). Sem lockdown browser (teatro de segurança).

## Resta (futuro, gated por métricas)

### P5-r — retenção & pagamento (parcial, gated by metrics — ver launch metrics abaixo)
- ✅ **Founding-member paywall — link MANUAL** (2026-07-09): sem gateway de pagamento integrado (nenhuma
  credencial Stripe/Pix configurada nesta base). O owner cola um link de pagamento avulso + preço em
  Administração; após confirmar o pagamento FORA do sistema, marca o e-mail do responsável como founding
  member. Isso NÃO é checkout automatizado — é o "manual" que o roadmap sempre previu, não um MVP incompleto
  de algo maior.
- ✅ **Correlação pós-prova (predito × real)** (2026-07-09): dashboard por curso comparando a prontidão FSRS
  atual com a nota real de prova (Pearson). **Limitação de MVP documentada**: usa o estado FSRS ATUAL do
  aluno (não há snapshot histórico do estado no momento exato da prova) — é um diagnóstico agregado, não um
  replay exato do passado.
- ⏳ **Não construído** (fora do alcance de uma sessão de código — dependem de dados reais, credenciais
  externas ou decisão de negócio do owner, não de mais código): digests por e-mail (nenhum provedor SMTP
  configurado em `.env`); completar corpus Matemática 6º–9º + Português/Ciências (autoria de conteúdo, não
  código); biblioteca de exploráveis; otimização FSRS per-child (precisa de dados reais de uso —
  os parâmetros atuais são fixos e não há coorte para calibrar); app nativo Expo (gated "só se necessário").

### P6 — escala & infra (months 4–12, gated by D90 — **gate não atingido, nenhum usuário real ainda**)
Todo o P6 é explicitamente gated pela métrica D90 da tabela abaixo, que não existe neste ambiente de
desenvolvimento (zero usuários reais/pagantes). A disciplina de "kill criteria" deste roadmap segue valendo
para decidir SE vale a pena manter/expandir cada item — mas onde o item é puro código sem decisão de negócio
pendente, construir agora (2026-07-09) é razoável; só falta o gate de escala para justificar o RISCO de trocar
algo já testado, não a viabilidade técnica:
- ✅ **WebSockets** (substitui o polling dos live games/chat, `server/ws/`): construído como
  **"push-to-refetch"** — o socket só avisa "algo mudou"; o cliente refaz o MESMO fetch REST já testado (zero
  lógica de autorização/serialização duplicada, incluindo esconder a resposta antes do reveal em live games).
  **Degradação automática e segura**: se o proxy reverso de produção (OpenLiteSpeed) não repassar o upgrade de
  WebSocket — não verificado nesta sessão, sem acesso ao VPS — o cliente cai de volta ao polling testado sem
  quebrar nada. Verificado com um round-trip real (registro → WS conecta → mutação REST → push recebido pelo
  socket), não só testes unitários do hub. **Pendente do owner**: confirmar/configurar o `extprocessor` +
  passthrough de `Upgrade`/`Connection` no vhost do VPS para a WS realmente funcionar em produção (ver DEPLOY.md).
- ❌ **Vídeo self-hosted / HLS / CDN — DECIDIDO CONTRA** (2026-07-11, decisão do owner): sem hospedagem própria
  de vídeo. A plataforma continua alavancando **embeds YouTube/Vimeo** (já implementado, `CursoPage.tsx`
  `embedUrl()`) + upload direto ≤200MB p/ MP4 pontual (já implementado, `authoring.ts`). Este item sai do
  roadmap — não é mais "gated", é encerrado.
- ⏳ Projetos PBL/metaprojetos completos (Inteli) · Ensino Médio (ENEM) · piloto B2B lighthouse — conteúdo/vendas,
  não engenharia.

## Launch metrics (medir desde o dia 1 via 09 §9.3)
| Gate | Metric | PASS | PIVOT | KILL |
|---|---|---|---|---|
| D30 | famílias ativas (≥2×/sem) | ≥15, D7 ≥40% | 8–14 | <8 → iterar loop, pausar aquisição |
| D60 | retenção D30 + ganho de maestria visível | D30 ≥25% AND ganho | um dos dois | nenhum → tese pedagógica errada |
| D90 | founding members pagando R$24,90–39,90 | ≥20 | 8–19 | <8 → teste de preço/pacote ou pivô B2B |
| always | produto = geração crua sem corpus/maestria | — | — | AUTO-KILL (commodity) |

## Competitive tripwires (checar mensal)
- Astra AI com tagging BNCC / painel de responsável → acelerar prova de verificação de corpus na UI.
- Khanmigo com plano consumer no Brasil (US$4/mês) → responder com plano família anual + prontidão de prova.
- Toda Matéria / Arco / Plurall lançam companion de exame B2C → avaliar pivô B2B mais cedo.

## Working agreements (sessões Claude Code)
- Um spec por escopo; terminar rodando os acceptance criteria do spec.
- Nunca enfraquecer guardrails (05 §5.3) nem itens LGPD (09) por velocidade.
- Copy PT; código/comentários EN; manter `specs/` atualizado (spec-first) + `specs/CHANGELOG.md` datado.
