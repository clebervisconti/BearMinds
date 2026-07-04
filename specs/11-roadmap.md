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

## Resta (futuro, gated por métricas)

> **P5 re-planejado em 2026-07-04** a partir da análise de gap **Moodle + MindTickle** (o que roubar, o que
> evitar — detalhes no CHANGELOG). O que JÁ superamos e não reconstruímos: FSRS por atom (mais fino que o
> reforço adaptativo por tópico do MindTickle), autoria IA grounded com sign-off humano, conclusão
> mastery-gated, live games/enquetes/Q&A, chat com DM só aluno↔staff, coaching em risco, certificados
> verificáveis, LGPD parent-fronted.

### P5a — Assessment core (spec 15) — PRÓXIMA WAVE
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

### P5b — Gestão & automação (spec 16, a escrever)
1. **Regras de auto-matrícula** (MindTickle): predicados sobre perfil ("série=7EF E escola=X → série Y") —
   política uma vez, zero matrícula manual.
2. **Duplicação de curso / rollover de período** (Moodle, o recurso mais usado por professores) +
   importar itens entre cursos.
3. **Gradebook-lite**: categorias/pesos, UMA agregação padrão com prévia ao vivo (anti-complaint Moodle),
   visão professor + aluno + responsável, export CSV.
4. **Calendário/Timeline** (Moodle, o recurso mais usado por alunos): prazos derivados automaticamente dos
   itens (due de tarefas/provas), bloco "o que vence em seguida" no Dashboard.
5. **Relatórios por curso** (consumidores do events stream): participação, conclusão, % acerto por questão.
6. **Grupos dentro do curso** (turmas paralelas com um só conteúdo).

### P5c — Engajamento & prática (spec 17, a escrever)
1. **Quick Updates + Checklists** (MindTickle): micro-lição de 3 min com 1-2 perguntas; listas de passos
   rastreáveis — o push diário que não é um curso.
2. **Exemplares de pares** (MindTickle, a melhor mecânica social): professor promove as melhores
   submissões a conteúdo de estudo (moderação obrigatória, consentimento).
3. **Auto-avaliação vs avaliação do professor** (metacognição — ouro pedagógico para teens): gap view.
4. **Readiness 2.0** (MindTickle Readiness Index → BNCC): prontidão = rollup ponderado de evidências
   heterogêneas por competência — conhecimento (FSRS) + habilidade (rubricas) + execução (provas);
   dashboard professor/responsável.
5. **Missions-lite** (MindTickle, assinatura deles traduzida p/ escola): gravar áudio/vídeo "explique o
   conceito", **fluência de leitura (6-10)**, prática de idiomas; IA transcreve + pré-analisa (ritmo,
   palavras-chave), professor avalia por rubrica. **Escopo LGPD dedicado** (decisão do owner 2026-07-04):
   consentimento próprio de mídia, nunca pública, revisão só professor, retenção limitada. Construir por último.
- IA nos 3 pontos de alavanca em todas as waves (autoria/praticante/revisor) — sempre grounded + sign-off.

### Fixes transversais (lições dos reviews Moodle/MindTickle — aplicar em toda tela nova)
- Máx. ~5 configurações visíveis por tela; resto atrás de "avançado". Defaults opinativos > configurabilidade.
- UMA agregação de notas padrão com prévia ao vivo. UI kit único entre tipos de atividade.
- Conteúdo bloqueado = visível com 🔒 + motivo (não oculto). Sem lockdown browser (teatro de segurança).

### P5-r — retenção & pagamento (inalterado, gated by metrics, corre em paralelo às waves)
- Founding-member paywall (Pix/Stripe link manual), anual-prepago preferido.
- Correlação pós-prova (predito × real) — *acelerada pelo P5a item 3* · digests por e-mail.
- Corpus: completar Matemática 6º–9º; adicionar Português OU Ciências (por demanda de coorte).
- Biblioteca de exploráveis (alvo: 1 por 3 skills) · otimização FSRS per-child.
- App nativo (Expo) SÓ se retenção por push provar-se necessária.

### P6 — escala & infra (months 4–12, gated by D90)
- **WebSockets** (substitui o polling dos live games/chat) quando a escala exigir.
- **Vídeo self-hosted / HLS / CDN** (hoje: embeds YouTube/Vimeo + upload ≤200MB — decisão do owner).
- Projetos PBL/metaprojetos completos (Inteli) · Ensino Médio (ENEM) · piloto B2B lighthouse.

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
