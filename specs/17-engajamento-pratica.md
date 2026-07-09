# 17 — P5c: Engajamento & Prática (Quick Updates, Exemplares, Autoavaliação, Readiness 2.0, Missions-lite)

> Origem: planejamento da wave P5c (ver `11-roadmap.md` e `CHANGELOG.md`), última wave do backlog P5
> (Moodle + MindTickle gap analysis, 2026-07-04). Este spec cobre os 5 itens listados em P5c, na ordem de
> construção real: Readiness 2.0 primeiro (maior alavancagem — fecha o rollup sobre as evidências que P5a/b
> já produzem), depois os mecanismos de engajamento diário/social, Missions-lite por último (escopo LGPD
> dedicado, decisão do owner 2026-07-04).

---

## 17.1 Quick Updates + Checklists

Micro-lição de ~3 minutos — o push diário que não é um curso completo — com 1-2 perguntas e uma lista de
passos rastreáveis.

### Modelagem
`quick_update` é um novo `kind` de `content_items` (rebuild aditivo do CHECK, migração v8), com
`payload_json = { body: string, questions: [{ prompt, options: string[], correct: number }], checklist: [{ label }] }`.

```sql
CREATE TABLE IF NOT EXISTS checklist_state (
  item_id TEXT NOT NULL, child_id TEXT NOT NULL, step_index INTEGER NOT NULL, done_at TEXT NOT NULL,
  PRIMARY KEY (item_id, child_id, step_index)
);
```

### Funcionamento
- A conclusão do item em si reaproveita o endpoint genérico `POST /learn/items/:id/progress` — a nota
  (`score`) é a fração de perguntas certas (1 se não houver pergunta).
- Passos da checklist têm estado próprio, por aluno: `GET /learn/items/:id/checklist`,
  `POST /learn/items/:id/checklist/:step/toggle`.
- Autoria no editor do curso (`AdminCurso.tsx` → aba "Quick Update"): texto curto, 1 pergunta opcional
  (múltipla escolha), checklist linha-a-linha.

---

## 17.2 Exemplares de pares

A melhor mecânica social do MindTickle: o professor promove a melhor submissão de um aluno a conteúdo de
estudo para a turma. **Moderação obrigatória** (só o professor nomeia) + **consentimento do responsável**
antes de ficar visível — nunca automático.

```sql
CREATE TABLE IF NOT EXISTS peer_exemplars (
  id TEXT PRIMARY KEY, submission_id TEXT NOT NULL UNIQUE REFERENCES submissions(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL, child_id TEXT NOT NULL, promoted_by TEXT NOT NULL, note TEXT,
  consent_state TEXT DEFAULT 'pending' CHECK(consent_state IN ('pending','granted','denied')),
  consent_at TEXT, created_at TEXT NOT NULL
);
```

### Fluxo
1. Professor, numa submissão já corrigida (`status='returned'`), clica "🌟 Promover a exemplar"
   (`POST /admin/submissions/:id/promote-exemplar`) — cria a linha `pending` e notifica o responsável.
2. Responsável vê a proposta em Configurações (`GET /exemplars/pending`) e autoriza/recusa
   (`POST /exemplars/:id/consent`).
3. Só com `consent_state='granted'` o exemplar aparece para os colegas matriculados no curso
   (`GET /learn/courses/:id/exemplars`), com o nome do aluno e o texto da submissão.
4. Professor pode despromover a qualquer momento (`DELETE /admin/exemplars/:id`).

---

## 17.3 Auto-avaliação vs avaliação do professor

Metacognição — gap view entre a nota que o aluno se dá e a nota do professor na mesma tarefa. Ouro
pedagógico para teens (MindTickle não tem; construímos por cima do que P5a já tem).

```sql
CREATE TABLE IF NOT EXISTS submission_self_assessments (
  id TEXT PRIMARY KEY, submission_id TEXT NOT NULL UNIQUE REFERENCES submissions(id) ON DELETE CASCADE,
  child_id TEXT NOT NULL, rubric_scores_json TEXT, points REAL, reflection TEXT, created_at TEXT NOT NULL
);
```

### Funcionamento
- Aluno se autoavalia a qualquer momento após entregar (mesma rubrica do professor, se houver, ou nota
  direta) + uma reflexão curta: `POST /learn/submissions/:id/self-assess` (upsert — reenviar substitui).
- Visão do professor por curso: `GET /admin/courses/:id/self-assessment-gap` — lista
  `gap = fração_aluno − fração_professor` (positivo = superestimou) + gap médio da turma. Só entra na lista
  quando a submissão já tem NOTA DO PROFESSOR — antes disso fica em `pending_teacher_review`.
- UI: bloco "🪞 Como você avalia sua entrega?" dentro do card de tarefa do aluno (`CursoPage.tsx`); aba
  "Autoavaliação" em Gestão do curso (`AdminGestao.tsx`).

---

## 17.4 Readiness 2.0

Prontidão = **rollup ponderado de evidências heterogêneas** por aluno/curso — a tradução do "Readiness
Index" do MindTickle para o vocabulário BNCC, mas fechando a lacuna que eles não tinham: FSRS por atom já é
mais fino que o reforço por tópico deles.

### Cálculo (`server/lib/readiness.ts`, puro/testável)
Três dimensões, cada uma 0..1, pesos padrão **40/30/30**:
- **Conhecimento** — `readinessForCodes` (spec 06, já existente): retrievability FSRS média sobre os atoms
  dos códigos BNCC referenciados pelos itens `lesson`/`quiz` publicados do curso.
- **Habilidade** — média das notas de rubrica das tarefas corrigidas (`submission_reviews`) do aluno no curso.
- **Execução** — média das melhores notas de prova (`exam_attempts.score`) do aluno no curso.

Dimensão sem dado (aluno ainda não fez nenhuma prova, por ex.) é excluída e o peso é redistribuído entre as
demais; sem nenhuma dimensão, `overall = null` (não "zero" — zero seria enganoso).

### Endpoints
- `GET /admin/courses/:id/readiness` (staff) — rollup por aluno + média da turma.
- `GET /my/readiness?child_id=` (responsável/aluno) — rollup por curso matriculado.
- UI: aba "Readiness" em Gestão do curso.

---

## 17.5 Missions-lite

Gravar áudio/vídeo "explique o conceito", fluência de leitura (6-10), prática de idiomas — a assinatura do
MindTickle traduzida para escola. **Construído por último**, conforme decisão do owner (2026-07-04), por
causa do escopo LGPD dedicado.

### Escopo LGPD dedicado (decisão do owner, spec 09 estendido)
- **Consentimento próprio de mídia**, separado dos demais: novo `ConsentScope = 'media_recording'`
  (CHECK rebuild aditivo em `consents`, migração v8) — **não** é pedido no onboarding geral; o responsável
  concede sob demanda em Configurações, só quando o estudante for de fato usar Missions.
- **Nunca pública**: o arquivo só é acessível autenticado (`/api/files/:id`, já exige `requireParent`) e só
  aparece para o professor da turma via a fila de correção.
- **Revisão só professor**: sem exemplares de pares para Missions nesta wave (a mecânica de consentimento de
  17.2 é para texto de tarefa; mídia gravada de estudante NÃO reusa esse fluxo).
- **Retenção limitada**: `retention_until` (180 dias por padrão, `MISSION_RETENTION_DAYS`) gravado no envio;
  poda automática no nightly (`pruneExpiredMissions`, `server/lib/missions.ts`) — remove o arquivo em disco
  + as linhas de `mission_submissions`/`mission_reviews`.

### IA — limitação honesta (sem ASR)
Este produto **não tem transcrição automática de fala (ASR) configurada** — a IA local (Gemma via MLX) é
só texto. Por isso a "pré-análise da IA" roda sobre uma **transcrição/resumo que o próprio aluno digita** ao
enviar, não sobre o áudio/vídeo. O professor sempre assiste/ouve o arquivo original para avaliar de verdade;
a IA é só apoio de preparação (nunca nota — mesmo padrão de 15.4/17.3).

### Modelagem
`mission` é um novo `kind` de `content_items` (mesmo rebuild do CHECK de 17.1),
`payload_json = { prompt, media_type: 'audio'|'video', max_points }`.

```sql
CREATE TABLE IF NOT EXISTS mission_submissions (
  id TEXT PRIMARY KEY, item_id TEXT NOT NULL, child_id TEXT NOT NULL, file_id TEXT NOT NULL,
  transcript TEXT, ai_preanalysis_json TEXT, status TEXT DEFAULT 'submitted' CHECK(status IN ('submitted','reviewed')),
  consent_at TEXT NOT NULL, retention_until TEXT NOT NULL, submitted_at TEXT NOT NULL, UNIQUE(item_id, child_id)
);
CREATE TABLE IF NOT EXISTS mission_reviews (
  id TEXT PRIMARY KEY, mission_submission_id TEXT NOT NULL REFERENCES mission_submissions(id) ON DELETE CASCADE,
  reviewer_parent_id TEXT NOT NULL, rubric_scores_json TEXT, points REAL, feedback TEXT, created_at TEXT NOT NULL
);
```

### Endpoints
- `POST /learn/missions/upload` (aluno) — multipart, mime allowlist (áudio ≤20MB, vídeo ≤100MB), **exige**
  `hasConsent(parentId, childId, 'media_recording')` (403 sem consentimento).
- `POST /learn/items/:id/mission` — registra a submissão (calcula `retention_until`), marca item concluído.
- `GET /learn/items/:id/mission` — vê própria submissão + feedback.
- `GET /admin/items/:id/mission-submissions`, `POST /admin/mission-submissions/:id/ai-preanalysis`,
  `POST /admin/mission-submissions/:id/review` (staff) — fila de correção (`AdminMissoes.tsx`).

---

## 17.6 Fixes transversais aplicados (spec 16, reaplicados aqui)

- ~5 campos por tela: formulários de autoria (Quick Update, Mission) seguem o padrão de `AddItem` existente.
- UMA agregação: Readiness usa uma única fórmula 40/30/30 documentada, sem configurabilidade por curso na
  wave 1.
- Bloqueado = visível com motivo: Quick Updates e Missions respeitam o motor de desbloqueio (spec 15.5) como
  todo item de conteúdo.

## 17.7 Critérios de Aceite (P5c)

1. **Quick Update**: professor cria um Quick Update com 1 pergunta e 2 passos de checklist → aluno responde,
   marca os passos, conclui → `item_progress.status='done'` com `score` = fração de acerto.
2. **Exemplar**: professor promove uma submissão corrigida → aparece "pending" para o responsável →
   responsável autoriza → exemplar some da fila e aparece para os colegas matriculados no curso.
3. **Autoavaliação**: aluno se autoavalia com 90/100 numa tarefa que o professor corrige com 60/100 →
   `GET .../self-assessment-gap` mostra gap +30pp para esse aluno.
4. **Readiness**: aluno com FSRS forte mas nenhuma prova feita → dimensão execução = null, overall = média
   só de conhecimento+habilidade (peso redistribuído, não penalizado por "prova zerada").
5. **Mission**: responsável NÃO concedeu `media_recording` → upload retorna 403 `consent_required`. Após
   conceder, aluno envia áudio + transcrição digitada → professor roda pré-análise da IA sobre o texto digitado
   (nunca sobre o áudio) → avalia por rubrica → nightly job poda a submissão após `retention_until`.

---

## 17.8 Fora de escopo desta wave (P5-r / P6, não confundir com P5c)

Itens do backlog original de "engajamento & prática" que na verdade pertencem a outras waves e **não** foram
tratados aqui: biblioteca de exploráveis e completar o corpus (P5-r, autoria de conteúdo — não é código),
app nativo Expo (P5-r, gated "só se necessário"), WebSockets/CDN de vídeo/ENEM/B2B (P6, gated por métricas
D90 que ainda não existem neste produto). Ver `11-roadmap.md`.
