# 13 · LMS — Administração, Professores, Conteúdo e Cursos (v1.0 · 2026-07-04)

**Visão do owner:** administradores e professores publicam conteúdo (vídeo, documento, quiz, jogos) por disciplina e
período (trimestre/semestre/ano); a plataforma **pesquisa, explora e enriquece** o conteúdo com IA; estudantes se
inscrevem ou são designados a cursos; a conclusão de um módulo **garante aprendizado real** (mastery-gated); tutores/
coaching, chat interno e sessões ao vivo completam a experiência.

**Referências incorporadas:** Inteli (metaprojetos + Learning Backlog → nossos knowledge-atoms; tríade Encontros/
Autoestudo/Desenvolvimento; professor-orientador→tutor, professor-instrutor→professor; avaliação por demonstração →
conclusão mastery-gated) · Kahoot (live game com PIN, tempo, pódio) · Slido (enquetes, word cloud, Q&A com upvote).

**Decisões do owner (2026-07-04):** staff invite-only · vídeo = embeds YouTube/Vimeo + upload MP4 ≤200MB · chat =
canais por curso + DM só estudante↔staff · live games = polling MVP.

## 13.1 Papéis

| Papel | Quem | Pode |
|---|---|---|
| `guardian` | responsável/estudante (padrão) | tudo que já existe (perfis, estudar, comunidade) |
| `professor` | docente convidado | criar/editar cursos da SUA instituição, enriquecer com IA, aprovar/publicar, matricular alunos |
| `tutor` | orientador/coach (P4b) | ver progresso de alunos designados, DM com aluno |
| `institution_admin` | gestor da escola | tudo do professor + convidar staff + gerenciar alunos da instituição |
| `platform_admin` | Cleber/equipe | tudo + CRUD de instituições + convites de institution_admin |

Convites: token 128-bit single-use, 7 dias, e-mail + papel + instituição. Aceite em `/convite/<token>` (registro
pré-aprovado). Bootstrap: `npm run make-admin -- email@x.com`.

## 13.2 Modelo de cursos

`courses` (instituição + disciplina + turma + período: `year` + `term` t1/t2/t3/s1/s2/anual) → `course_modules`
(missões ordenadas, com objetivos) → `content_items` (kind: `video` | `document` | `lesson` | `quiz` | `game` | `live`).
Status de curso: draft → published → archived. Item: draft → pending_review → published.

**Learning Backlog (Inteli):** cada módulo expõe seus knowledge-atoms como checklist visível
(🟢 dominado / 🟡 revisando / ⚪ novo), alimentado pelo `mastery_state` FSRS existente.

## 13.3 Pipeline de enriquecimento IA (diferencial)

```
professor envia (PDF/DOCX/TXT/MD | texto | link de vídeo)
  → extração de texto (pdftotext / unzip docx / direto)
  → chunking → corpus_chunks (escopo course_id)          ← RAG BM25 existente
  → decompose → knowledge_atoms (escopo course_id)       ← prompt existente
  → geração grounded: lesson + quiz (+ explorable)       ← motor + guardrails EXISTENTES
  → fila de revisão do professor (editar/regenerar/aprovar)
  → aprovar = verified_by/verified_at (sign-off humano) → published
```
Nada chega ao aluno sem aprovação humana (mesmo princípio do corpus BNCC). Jobs em `enrich_jobs`
(queued/running/review/done/error) com polling de status.

## 13.4 Matrícula e player

- Catálogo: cursos `published` da instituição do perfil. `enrollments.source`: `self` (aluno se inscreve) ou
  `assigned` (professor/admin designa por turma ou aluno).
- Player: vídeo (embed youtube-nocookie/vimeo OU `<video>` de upload) · documento (viewer/download autenticado) ·
  lesson/quiz → **LearningExperience existente** (think-first + FSRS + moedas). `item_progress` por item.
- **Conclusão mastery-gated do módulo:** todos os itens `done` **E** todos os atoms do módulo "lembrados"
  (state review & retrievability ≥ 0.9). Conclusão → +100 moedas + badge `module_complete`.

## 13.5 Segurança

- Upload só staff; MIME+extensão+tamanho validados (vídeo ≤200MB, doc ≤20MB); servidos por rota autenticada;
  nunca executáveis; arquivos em `data/uploads/` (0700).
- CSP `frame-src` estendido SOMENTE para `youtube-nocookie.com` e `player.vimeo.com`.
- Toda ação de staff → `audit_log`. Escopo de instituição imposto no servidor (professor não toca curso de outra).

## 13.6 P4b (planejado; não nesta fase)
Live games Kahoot-style (PIN, tempo, pódio; polling 1–2s) · enquetes/word cloud/Q&A upvote (Slido) · chat (canais por
curso + threads estudante↔staff) · dashboard de tutores (alunos em risco: streak quebrado, prontidão <60%, inatividade).

## Acceptance criteria (P4a)
- [ ] Convite cria professor da instituição certa; guardian recebe 403 em `/api/admin/*` (teste).
- [ ] Professor cria curso→módulo→itens; upload rejeita MIME/tamanho inválidos (teste).
- [ ] Pipeline: texto vira chunks escopados por curso; artifact gerado NÃO publica sem aprovação (teste).
- [ ] Aluno só vê catálogo da própria instituição; matrícula self e assigned funcionam (teste).
- [ ] Módulo NÃO conclui com itens done mas atoms não-lembrados; conclui quando dominados (+100 moedas) (teste).
- [ ] E2E no preview: admin → professor → conteúdo → aluno → conclusão mastery-gated.
