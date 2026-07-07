# 16 — P5b: Gestão & Automação (Auto-matrícula, Duplicação, Boletim, Cronograma, Relatórios)

> Origem: planejamento da wave P5b (ver `11-roadmap.md` e `CHANGELOG.md`).
> Este spec define as fundações administrativas, automatização de matrículas, gerenciamento de cursos (duplicação), boletim centralizado, painel de prazos (Timeline) e relatórios básicos.

---

## 16.1 Regras de auto-matrícula (Auto-enrollment rules)

Para evitar que administradores tenham que matricular alunos manualmente em cada curso, o sistema suportará regras automáticas baseadas no perfil do estudante.

### Modelagem
```sql
CREATE TABLE IF NOT EXISTS enrollment_rules (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  grade TEXT,                         -- e.g. '6EF', NULL = todas as séries da escola
  class_id TEXT,                      -- e.g. 'y5', NULL = todas as turmas
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_enrules_lookup ON enrollment_rules(institution_id, grade, class_id);
```

### Funcionamento
1.  Sempre que um aluno for criado (`POST /api/children`) ou atualizado (`PATCH /api/children/:id`), o sistema avaliará se o perfil atende a alguma regra ativa em `enrollment_rules`.
2.  Se houver correspondência e o aluno não estiver matriculado (`enrollments`), uma matrícula (`enrollments`) com `source = 'assigned'` e `assigned_by = 'system'` é inserida automaticamente.
3.  As regras de auto-matrícula podem ser criadas, listadas e deletadas por administradores (`institution_admin`+) na rota do curso:
    *   `POST /api/admin/courses/:id/enrollment-rules`
    *   `GET /api/admin/courses/:id/enrollment-rules`
    *   `DELETE /api/admin/enrollment-rules/:ruleId`

---

## 16.2 Duplicação de curso (Course duplication)

Permite ao professor clonar a estrutura de um curso existente (módulos, itens de conteúdo, e configurações de disponibilidade) para utilizá-lo com outra turma ou ano letivo.

### Funcionamento
*   **Endpoint:** `POST /api/admin/courses/:id/duplicate` (acesso: `professor`+)
*   **Corpo:** `{ title: string, class_id: string }`
*   **Comportamento:**
    1.  Clona a linha de `courses` com o novo `title`, a nova `class_id` e define o status como `'draft'`.
    2.  Busca todos os módulos (`course_modules`) do curso de origem.
    3.  Clona cada módulo associando-o ao novo curso clonado.
    4.  Busca todos os itens de conteúdo (`content_items`) vinculados a cada módulo.
    5.  Clona cada item associando-o ao módulo clonado correspondente.
    6.  As datas absolutas em `availability_json` (tipo `date_from`) são mantidas (ou limpas se necessário, no MVP elas serão copiadas diretamente).
    7.  Retorna o ID do novo curso clonado.

---

## 16.3 Boletim (Gradebook-lite)

Centraliza as notas e progresso de todas as atividades avaliativas do curso (Tarefas/Assignments e Provas/Exams), gerando uma média ponderada com prévia na tela.

### Agregação de Notas
1.  Itens avaliativos elegíveis:
    *   **Provas (`exams`):** Nota da melhor tentativa (`exam_attempts.score`, que varia de 0 a 100%).
    *   **Tarefas (`content_items` do tipo `'assignment'`):** Nota da avaliação da rubrica (`submission_reviews.points` dividido por `max_points` do item).
2.  Média do aluno no curso:
    *   Média aritmética simples das notas de todas as atividades avaliativas concluídas (submetidas/avaliadas) pelo aluno no curso.
3.  **Endpoints:**
    *   **Professor/Admin:** `GET /api/admin/courses/:id/gradebook`
        Retorna a lista de alunos matriculados, notas detalhadas por atividade (Exames e Tarefas) e a média final consolidada.
    *   **Estudante/Responsável:** `GET /api/my/grades?child_id=:childId`
        Retorna o boletim individual do estudante para todos os seus cursos ativos, listando as notas obtidas e a média atual.

---

## 16.4 Cronograma / Linha do tempo (Timeline)

Centraliza os prazos e entregáveis pendentes de todos os cursos do estudante, ajudando-o a se organizar.

### Funcionamento
*   **Endpoint:** `GET /api/my/timeline?child_id=:childId`
*   Retorna a lista de atividades pendentes (Tarefas e Provas) com prazo (`due_at` ou `due`), ordenadas por data de vencimento.
*   **Filtros de Visibilidade:**
    1.  O item ou exame deve estar disponível para o aluno (motor de desbloqueio `evaluateAvailability` deve retornar `available=true`).
    2.  O aluno não deve ter concluído o item (isto é, `item_progress.status != 'done'` para tarefas e `exam_attempts.submitted_at IS NULL` para exames).
    3.  Deve ter data de vencimento definida.

---

## 16.5 Relatórios por curso (Course reports)

Agrega dados estruturados emitidos pelo `events` stream para exibir métricas consolidadas sobre o engajamento e performance da turma.

### Métricas
*   **Participação:** Alunos ativos nos últimos 7 dias (baseado em eventos `study_session_start` ou logins) dividido pelo total de matriculados.
*   **Conclusão:** Percentual de progresso médio dos módulos (`item_progress` finalizados/total).
*   **Performance:** Média das notas de exames e tarefas do curso.
*   **Endpoint:** `GET /api/admin/courses/:id/reports` (acesso: `professor`+)

---

## 16.6 Critérios de Aceite (P5b)

1.  **Regra de Matrícula:** Criar uma regra vinculando `série=6EF` ao `Curso de Frações` → Cadastrar um estudante na série `6EF` → Verificar se ele foi matriculado automaticamente no curso.
2.  **Duplicação:** Duplicar o `Curso de Frações` para a turma `A` → O novo curso clonado deve possuir cópias exatas dos módulos e itens de conteúdo (com IDs novos), com status em `draft`.
3.  **Boletim:** Aluno realiza uma prova e obtém nota 80%, e submete uma tarefa avaliada com 10/10 (100%) → O boletim do professor e do aluno deve mostrar a nota de cada item e a média consolidada de 90%.
4.  **Timeline:** Criar uma tarefa com `due_at` para daqui a 3 dias e uma prova → Entrar com o perfil do estudante → Verificar se a lista do Dashboard exibe esses dois itens ordenados.
5.  **Relatórios:** Disparar eventos no events stream simulando acessos e conclusões → O endpoint de relatórios do professor deve consolidar o número de acessos e médias da turma.
