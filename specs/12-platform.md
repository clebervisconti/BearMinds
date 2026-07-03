# 12 · Platform Redesign — "uma plataforma para todo estudante" (v1.0 · 2026-07-03)

**Decisão do owner (2026-07-03):** BearMinds deixa de ser um app exclusivamente infantil/parent-fronted e
vira uma **plataforma de estudos para estudantes de 6 a 19 anos**, inspirada em Moodle 4 / Mindtickle:
formal-mas-amigável, calma (não busy/estressante), um lugar bom para passar horas estudando, jogando e
colaborando. Este spec SUPERSEDE partes dos specs 03 e 07 (marcadas abaixo).

## 12.1 Modelo de conta (owner-fronted)

- A pessoa se registra como **titular da conta** (account owner).
- O titular pode criar **até 5 perfis de estudante**:
  - **"Eu mesmo"** (`kind:'self'`, máx. 1): o próprio titular estuda. Consentimentos auto-concedidos
    (self-consent) na criação — sem o gate LGPD infantil.
  - **"Meu filho(a)"** (`kind:'child'`): fluxo LGPD art. 14 EXISTENTE inalterado (consentimento
    separável, não pré-marcado, revogável).
- Idades aceitas: **6–19** (MIN_AGE 8→6; supersede spec 03 §3.4). Bandas de idade inalteradas
  ('8-10', '11-14', '15-18'); 6–7 clampa em '8-10', 19 clampa em '15-18' → cache de geração intacto.
- O gate do responsável (senha + desafio) continua protegendo Configurações quando o perfil ativo é child.

## 12.2 Arquitetura de informação (o shell)

Desktop: **sidebar esquerda** (logo, navegação, moedas, sino, troca de perfil).
Mobile: top bar (sino + moedas) + **bottom nav**: Início · Cursos · Atividades · Comunidade · Mais.

| Área | Rota | Conteúdo |
|---|---|---|
| **Dashboard** | `/` | saudação, continuar estudando, revisões de hoje, timeline de provas, atividade semanal, streak/moedas, últimas conquistas |
| **Cursos** | `/cursos` | cards por disciplina (progresso de maestria, atoms lembrados/total, continuar) → tópicos |
| **Atividades** | `/atividades` | fila de revisão, histórico de sessões, provas (listar + adicionar) |
| **Comunidade** | `/comunidade` | mural por instituição: posts + respostas + denunciar |
| **Conquistas** | `/conquistas` | saldo/extrato de moedas, badges, **leaderboard da instituição** |
| **Notificações** | `/notificacoes` | persistentes (conquistas, respostas) + derivadas (revisões devidas, prova ≤7d) |
| **Configurações** | `/configuracoes` | conta, perfis (adicionar filho/eu), consentimentos, visibilidade no leaderboard, exportar/excluir |

**Design:** skin `formal` padrão (indigo/slate calmo, espaço em branco generoso, bordas sutis).
Skins infantis ('8-10'/'11-14') aplicadas **somente dentro da Aula/Quiz** quando o perfil ativo é child.
Mascote 🐻 só aparece nas lições das bandas infantis.

## 12.3 Economia de moedas (estende spec 07 — regras anti-dark-pattern mantidas)

Moedas nascem SOMENTE de eventos de aprendizagem (nunca de tempo de tela ou abrir lição):
- **+10** por revisão com rating ≥ 2 (cap diário = 12 revisões → máx 120/dia)
- **+25** quando um atom atinge "lembrado" pela primeira vez (state review & retrievability ≥ 0.9)
- **+50** marcos de streak (7 e 30 dias)

Badges (`achievements.code`): `first_lesson`, `streak_7`, `streak_30`, `atoms_10`, `atoms_50`, `prova_ready_80`.
Desbloqueio grava notificação. Moedas não compram nada no P1 (sem loja; risco LGPD/ECA — mantido do spec 07).

## 12.4 Leaderboard (SUPERSEDE spec 07 "AVOID leaderboards")

Decisão do owner: leaderboard **existe**, mas **escopado por instituição de ensino** (nunca global),
ranqueando **moedas da semana**. Salvaguardas:
- Exibe **apenas o apelido** (minimização); nada de e-mail/nome real.
- `children.leaderboard_hidden` — o responsável (ou o self) pode ocultar o perfil a qualquer momento.
- Top 20 + a própria posição; sem "você caiu N posições" (nunca punitivo).

## 12.5 Comunidade (todos os perfis, com salvaguardas)

Decisão do owner: aberta a todos os perfis, incl. crianças. Regras P1:
- **Escopo por instituição** (mural da escola/rede); sem DMs; texto puro (sem imagens/links clicáveis).
- Autor exibido como **apelido** apenas. zod: título ≤120, corpo ≤2000.
- Botão **denunciar** → `flagged=1` (fila de moderação = consulta SQL no P1; dashboard de moderação = P2).
- Entrada do usuário é DADO (nunca instrução) — sanitizada na renderização (texto puro).

## 12.6 Notificações

Sem push no P1 (limite PWA iOS). Central in-app:
- **Persistentes** (tabela `notifications`): conquista desbloqueada, resposta ao seu post.
- **Derivadas** (calculadas ao abrir): N revisões esperando hoje; prova em ≤7 dias.
- Sino no shell com contador de não-lidas; marcar como lida.

## 12.7 Dados (migração v2 — aditiva)

```sql
ALTER TABLE children ADD COLUMN kind TEXT DEFAULT 'child';            -- 'self' | 'child'
ALTER TABLE children ADD COLUMN leaderboard_hidden INTEGER DEFAULT 0;
CREATE TABLE notifications (id, parent_id, child_id, kind, title, body, link, read_at, created_at);
CREATE TABLE coin_ledger (id, child_id, delta, reason, ref_id, created_at);
CREATE TABLE achievements (id, child_id, code, unlocked_at, UNIQUE(child_id, code));
CREATE TABLE community_posts (id, child_id, institution_id, subject_id, title, body, flagged, created_at, deleted_at);
CREATE TABLE community_replies (id, post_id, child_id, body, flagged, created_at, deleted_at);
```

## 12.8 API (v2)

```
POST /api/me/self-profile        {display_name?, birth_year, grade, institution_id?, class_id?, subjects[]} → me
GET  /api/notifications?child_id → {items:[{id?,kind,title,body,link,read,derived}], unread}
POST /api/notifications/read     {ids[] | all:true}
GET  /api/coins?child_id         → {balance, week, ledger[], achievements[]}
GET  /api/leaderboard?child_id   → {institution, entries:[{rank,display_name,coins,me?}], me:{rank,coins}}
GET  /api/community/posts?child_id&subject= → {posts:[…]}   (institution do perfil)
POST /api/community/posts        {child_id, subject_id?, title, body}
GET  /api/community/posts/:id    → {post, replies}
POST /api/community/posts/:id/replies {child_id, body}
POST /api/community/report       {kind:'post'|'reply', id}
```

## Acceptance criteria
- [ ] Titular cria perfil "eu mesmo" (self-consent) E perfil filho (gate LGPD) na mesma conta.
- [ ] Shell formal em todas as áreas; skin infantil aparece SÓ dentro da Aula de um perfil child.
- [ ] Moedas: revisão rating<2 não gera moeda; cap diário respeitado; badge única por código (testes).
- [ ] Leaderboard: só perfis da MESMA instituição; `leaderboard_hidden` some da lista (teste).
- [ ] Comunidade: post/resposta exibem apenas apelido (teste de não-vazamento de PII).
- [ ] Notificações derivadas refletem revisões devidas + prova ≤7d; persistentes marcam lida.
- [ ] Loop de aprendizagem completo funciona idêntico ao P1 (nenhum guardrail do spec 05 enfraquecido).
