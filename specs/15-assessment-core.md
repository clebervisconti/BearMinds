# 15 — P5a: Assessment Core (banco de questões, provas, tarefas, trilhas de desbloqueio)

> Origem: análise de gap Moodle + MindTickle (2026-07-04, ver CHANGELOG). Este spec cobre a **wave P5a**.
> P5b (gestão/automação) e P5c (engajamento/prática, incl. Missions) estão no backlog do `11-roadmap.md`
> e ganharão specs próprios (16/17) quando entrarem em desenvolvimento.

## 15.0 Objetivo e princípios

Fechar os maiores buracos funcionais do LMS: **estudantes não conseguem entregar trabalhos** e
**professores não conseguem aplicar provas**. Tudo construído sobre os aprendizados das plataformas de referência:

- **Moodle (roubar):** banco de questões desacoplado do quiz; árvore de condições de disponibilidade;
  camada genérica de conclusão; eventos estruturados alimentando relatórios.
- **Moodle (evitar):** 50 configurações por tela → **máx. ~5 visíveis + "avançado"**; agregação de notas
  confusa → **uma agregação padrão com prévia ao vivo**; UI inconsistente entre atividades → **UI kit único**.
- **MindTickle (roubar):** pools de questões com sorteio randomizado (anti-cola); rubricas = seções
  ponderadas; IA nos 3 pontos de alavanca (autoria/praticante/revisor) — sempre grounded + sign-off humano.
- **Guardrails do spec 05 e LGPD do spec 09: INALTERADOS.** IA nunca publica sem aprovação humana.

## 15.1 Events stream (fundação de relatórios)

Tabela única de eventos estruturados; TODO recurso novo emite. Relatórios/analytics são consumidores.

```sql
events(id, kind, actor_kind CHECK('child','parent','system'), actor_id,
       course_id, ref_kind, ref_id, payload_json, created_at)
-- índices: (kind, created_at), (course_id, created_at), (actor_kind, actor_id, created_at)
```
- `emitEvent(kind, actor, refs, payload)` helper em `server/lib/events.ts`; chamadas nos fluxos existentes
  de maior valor (enroll, item done, module complete, quiz score, live join/answer) + todos os novos (15.2–15.5).
- Sem PII no payload (ids apenas). Retenção: 12 meses (job nightly poda).
- NÃO construir dashboards genéricos agora — só o stream + 2 relatórios por curso (participação, conclusão) em P5b.

## 15.2 Banco de questões (desacoplado, IA preenche, professor cura)

A questão é entidade de primeira classe, reutilizável entre quizzes/provas — versionada e etiquetada.

```sql
bank_questions(id, course_id NULL,            -- NULL = banco BNCC global
  bncc_code NULL, tags_json,                  -- categorias = BNCC + tags livres
  kind CHECK('mcq','tf','short','numeric'),   -- 4 tipos no MVP (Moodle tem 16; começar enxuto)
  prompt, options_json NULL, answer_json,     -- answer_json: index/bool/aceitas[]/valor+tolerância
  explanation,                                -- feedback pós-resposta (socrático)
  difficulty CHECK(1..3),
  status CHECK('draft','approved','retired'),
  origin CHECK('ai','staff'), created_by, verified_by NULL, verified_at NULL,
  version INTEGER DEFAULT 1, replaced_by NULL, created_at)
```
- **IA → banco:** o pipeline de enriquecimento (spec 13) ganha um alvo novo: além de lesson+quiz,
  gera N questões `draft` no banco do curso (grounded nos chunks; mesmos guardrails de
  `sanitizeQuiz`/`groundingCheck`). Professor revisa/edita/aprova (`verified_by/verified_at` — mesmo padrão de sign-off).
- **Professor → banco:** CRUD manual no editor do curso (`/admin/curso/:id/banco`), com filtros por
  BNCC/tag/dificuldade/status. Editar questão aprovada cria **nova versão** (a antiga vira `retired`,
  `replaced_by` aponta) — tentativas antigas continuam íntegras.
- **Pool = filtro + sorteio:** não existe entidade "pool"; um pool é `{course_id, bncc_codes[], tags[], difficulty[], n}`
  resolvido em sorteio no momento do uso (prova) — o desenho mais simples que preserva o valor.

## 15.3 Provas (exams autorados, sorteio randomizado, auto-correção)

```sql
exams(id, course_id, title, description,
  pool_json,                    -- o filtro do 15.2 + n_questions
  duration_min, opens_at, due_at,
  attempts_allowed DEFAULT 1, shuffle INTEGER DEFAULT 1,
  status CHECK('draft','published','closed'), created_by, created_at)
exam_attempts(id, exam_id, child_id, seed,   -- seed → sorteio/embaralhamento reproduzível
  questions_json,               -- ids sorteados no início (imutável por tentativa)
  answers_json, score REAL NULL, started_at, submitted_at NULL,
  UNIQUE(exam_id, child_id, started_at))
```
- Fluxo aluno: prova aparece no curso (e no Timeline em P5b) dentro da janela `opens_at..due_at`;
  ao iniciar, sorteia questões do pool (só `approved`), embaralha opções por `seed`, cronometra
  `duration_min`; envio (ou tempo esgotado) → auto-correção de mcq/tf/numeric; `short` fica para o professor.
- Professor: cria prova em ~5 campos (título, pool, nº questões, janela, duração); vê resultados por
  questão (% acerto — detecta questão ruim) e por aluno; pode liberar 2ª tentativa individual (override simples).
- **Integração com prontidão (spec 06):** score da prova emite evidência para os atoms/BNCC cobertos —
  a prontidão predita ganha correlação com resultado real (item que já era meta do P5 original).
- Anti-cola pragmático: sorteio por pool + embaralhamento + janela. SEM lockdown browser (teatro de segurança).

## 15.4 Tarefas (assignments) + Rubricas

Novo `kind:'assignment'` em `content_items` (contrato existente de item — nada de sistema paralelo).

```sql
-- payload_json do item: { instructions, due_at, accept:['text','file'], rubric_id NULL, max_points }
submissions(id, item_id, child_id, body_text NULL, file_id NULL,   -- files do spec 13 (≤20MB)
  status CHECK('draft','submitted','returned','resubmitted'),
  submitted_at, UNIQUE(item_id, child_id))
submission_reviews(id, submission_id, reviewer_parent_id,
  rubric_scores_json NULL, points REAL NULL, feedback,
  ai_assist_json NULL,        -- pré-análise IA mostrada ao professor (nunca ao aluno direto)
  created_at)
rubrics(id, course_id, title,
  sections_json,              -- [{title, weight, criteria:[{label, levels:[{label,points}]}]}]
  created_by, created_at)     -- reutilizável: assignments (15.4), missions (P5c), coaching (spec 14)
```
- Fluxo aluno: abre a tarefa → escreve texto e/ou anexa arquivo → `submitted`. Professor devolve
  (`returned`) com feedback ± rubrica; aluno pode reenviar (`resubmitted`) se o professor permitir.
- **IA como assistente do revisor (padrão MindTickle):** ao abrir uma submissão, o professor pode pedir
  pré-análise — resumo, cobertura dos critérios da rubrica, indícios de colagem de IA — **sugestão**,
  nunca nota automática. Grounded na submissão + instruções; professor decide tudo.
- Rubrica: pontuação = Σ(seção.weight × nível escolhido); prévia ao vivo do total no editor (lição do gradebook Moodle).
- Conclusão do item: `submitted` marca `item_progress='done'` (participação); a nota é dimensão separada.

## 15.5 Motor de desbloqueio (availability tree)

Árvore JSON de condições, avaliada genericamente, em `course_modules.availability_json` e
`content_items.availability_json` (colunas novas, NULL = sempre disponível).

```ts
type Cond =
  | { all: Cond[] } | { any: Cond[] }
  | { type: "completed"; item_id: string }
  | { type: "module_mastered"; module_id: string }          // conclusão mastery-gated existente
  | { type: "exam_min"; exam_id: string; score: number }
  | { type: "date_from"; iso: string };
```
- `evaluateAvailability(cond, childId)` puro em `server/lib/availability.ts` (+ testes de tabela-verdade).
- UI: item/módulo bloqueado aparece com 🔒 + motivo legível ("Complete a Missão 1 para desbloquear") —
  visível-mas-bloqueado motiva mais que oculto (default Moodle).
- Editor: SEM builder de árvore complexo no MVP — 3 presets no editor do item/módulo
  (sequencial ao anterior / após dominar módulo X / a partir de data), que geram o JSON. "Avançado" = editar JSON.
- Isto substitui e generaliza o "sequential unlocking" do MindTickle.

## 15.6 Gamificação por faixa etária (fix transversal — decisão do owner 2026-07-04)

- `age_band '8-10'` (inclui 6–7 clampados): Conquistas mostra **progresso pessoal** (moedas, medalhas,
  streak, evolução semanal vs. semana anterior) + **agregado da turma** ("sua turma dominou 34 conceitos
  esta semana"). SEM ranking individual público.
- `11-14` e `15-18`: leaderboard da instituição como está (opt-out `leaderboard_hidden` mantido).
- Backend inalterado (dados já existem); mudança é de apresentação em `Conquistas.tsx` + endpoint
  `leaderboard` ganha modo `class_aggregate`.

## 15.7 Migração v5 (aditiva, padrão estabelecido)

`events`, `bank_questions`, `exams`, `exam_attempts`, `submissions`, `submission_reviews`, `rubrics`
(IF NOT EXISTS) + `ensureColumns`: `course_modules.availability_json`, `content_items.availability_json`.
Índices: `idx_events_kind`, `idx_events_course`, `idx_bankq_course`, `idx_attempts_exam`, `idx_subs_item`.

## 15.8 Critérios de aceite

1. Professor faz upload de material → IA gera 10 questões `draft` no banco → professor aprova 8, edita 2 →
   cria prova (pool BNCC, 5 questões, 20 min) → publica.
2. Dois alunos iniciam a mesma prova → recebem sorteios diferentes → auto-correção ao enviar →
   professor vê % de acerto por questão.
3. Professor cria tarefa com rubrica (2 seções ponderadas) → aluno envia texto+PDF → professor pede
   pré-análise IA → devolve com feedback e nota de rubrica → aluno vê feedback.
4. Módulo 2 configurado "após dominar Módulo 1" → aluno com Módulo 1 incompleto vê 🔒 com motivo →
   ao dominar, desbloqueia sem ação do professor.
5. Perfil 8-10 não vê ranking individual; perfil 12 vê o leaderboard normal.
6. Guardian recebe 403 em TODAS as rotas novas de admin; IA nunca publica questão sem `verified_by`.
7. tsc + build + vitest verdes (novos testes: availability truth-table, sorteio por seed reproduzível,
   pontuação de rubrica, versão de questão preserva tentativas antigas).
