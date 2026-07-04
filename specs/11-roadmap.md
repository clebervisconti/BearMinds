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

### P5 — retenção & pagamento (weeks 5–12, gated by metrics)
- Founding-member paywall (Pix/Stripe link manual), anual-prepago preferido.
- Correlação pós-prova (predito × real) · digests por e-mail.
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
