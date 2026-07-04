# 14 · Aprendizagem ao vivo, social, coaching e certificados (P4b + P4c · 2026-07-04)

Fecha a visão do owner: aulas ao vivo gamificadas (Kahoot), interação em tempo real (Slido), chat interno,
tutoria/coaching e certificados que comprovam a conclusão mastery-gated.

**Decisões do owner (mantidas):** live games e chat = **polling** (1–2s, escala de sala; WebSockets = P6) ·
chat = **canais por curso + DM só estudante↔staff** (nunca aluno↔aluno) · vídeo = embeds + upload (P4a).

## 14.1 Live games (Kahoot-style)

Professor inicia uma sessão a partir de um item `quiz` publicado → recebe um **PIN de 6 dígitos**. Alunos
entram pelo PIN (apelido). O host controla o ritmo: `lobby → question → reveal → … → ended`.
- **Pontuação:** acerto = 600 base + bônus de velocidade (até +400, proporcional ao tempo restante). Erro = 0.
- **Pódio** ao final (top 5) + moedas por participação (rating→moeda reusa a economia existente).
- **Estado por polling:** `GET /api/live/:pin/state?since=` retorna a fase e a pergunta atual (sem revelar a
  resposta antes do reveal — a resposta correta só vai no estado `reveal`).

Tabelas: `live_sessions` (id, pin, item_id, host_parent, state, current_q, q_started_at, created_at),
`live_players` (session_id, child_id, nickname, score, joined_at), `live_answers`
(session_id, child_id, q_index, choice, correct, ms, delta).

## 14.2 Slido (enquetes + Q&A com upvote)

- **Enquetes:** item `poll` (payload = pergunta + opções). Aluno vota 1×; resultado em barras ao vivo.
  `polls` (id, item_id, question, options_json, open), `poll_votes` (poll_id, child_id, choice) UNIQUE.
- **Q&A do curso:** quadro de perguntas por curso; alunos postam e dão **upvote**; staff marca respondida.
  `qa_questions` (id, course_id, child_id, body, answered, created_at), `qa_votes` (question_id, child_id) UNIQUE.

## 14.3 Chat (canais + DM staff)

- **Canal por curso:** todos os matriculados + staff do curso. `chat_channels` (id, course_id).
- **DM estudante↔staff:** thread privada entre um aluno e um membro da equipe. `chat_threads`
  (id, course_id, child_id, staff_parent_id). **Nunca** aluno↔aluno (salvaguarda de menores).
- `chat_messages` (id, scope 'channel'|'thread', scope_id, sender_child_id, sender_parent_id, body, created_at).
- Polling `GET /api/chat/...?since=`. Texto puro; denúncia reusa `flagged`? (mensagens = moderação por report).

## 14.4 Coaching / tutoria (Inteli: professor-orientador)

Dashboard `/admin/coaching` (tutor, professor, institution_admin): alunos da instituição com **sinais de risco**:
- streak quebrado (sem evento há ≥2 dias), prontidão média < 60% nas provas, inatividade ≥ 7 dias.
- Anotações de acompanhamento (`tutor_notes`) + atalho para DM com o aluno.
Cálculo reusa `currentStreak`, `provaCountdowns`, `study_sessions`.

## 14.5 Certificados (P4c)

Ao concluir um curso (todos os módulos mastery-gated), emite-se um **certificado** com código público.
`certificates` (id, child_id, course_id, code, issued_at). Página pública `/certificado/:code` (verificável,
sem PII além do apelido + curso + instituição + data). Impressão via CSS.

## 14.6 Moderação (P4c)

Dashboard `/admin/moderacao` (institution_admin+): fila de conteúdo `flagged` (posts, respostas, mensagens de
chat, perguntas de Q&A). Ações: **ocultar** (`deleted_at`) ou **restaurar** (`flagged=0`). Audit em toda ação.

## Acceptance criteria
- [ ] Host cria sessão live (PIN); aluno entra e responde; pontuação = acerto + bônus de velocidade; pódio (teste da fórmula).
- [ ] Estado live não revela a resposta antes do `reveal` (teste).
- [ ] Enquete tabula votos únicos por aluno; Q&A ordena por upvotes (teste).
- [ ] Chat: aluno NÃO consegue abrir DM com outro aluno (só staff) — 403 (teste).
- [ ] Coaching lista aluno "em risco" quando streak quebrado / prontidão < 60% / inativo ≥7d (teste).
- [ ] Concluir curso emite 1 certificado com código; `/certificado/:code` mostra dados sem PII sensível (teste).
- [ ] Moderação oculta/restaura conteúdo denunciado; guardian recebe 403 (teste).
- [ ] E2E: professor roda um Kahoot com 1 aluno → pódio; aluno abre chat do curso; tutor vê aluno em risco.
