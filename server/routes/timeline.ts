// Linha do tempo / Cronograma (spec 16.4).
import { Hono } from "hono";
import { db } from "../db.ts";
import { requireParent, ownChildOrThrow } from "../lib/session.ts";
import { badRequest, type AppEnv } from "../lib/http.ts";
import { resolverFor, evaluateAvailability, parseCond } from "../lib/availability.ts";

const app = new Hono<AppEnv>();

interface TimelineItem {
  id: string;
  title: string;
  kind: "assignment" | "exam";
  due_at: string;
  course_id: string;
  course_title: string;
  available: boolean;
  lock_reason: string | null;
}

app.get("/api/my/timeline", requireParent, (c) => {
  const parentId = c.get("parentId");
  const childId = c.req.query("child_id");
  if (!childId) throw badRequest("child_id_required", "Informe o child_id.");

  ownChildOrThrow(parentId, childId);

  const resolver = resolverFor(childId);

  // 1) Busca tarefas (content_items do tipo assignment) dos cursos matriculados
  const assignments = db.prepare(
    `SELECT i.id, i.title, i.payload_json, i.availability_json, cs.id AS course_id, cs.title AS course_title
     FROM content_items i
     JOIN course_modules m ON m.id = i.module_id
     JOIN courses cs ON cs.id = m.course_id
     JOIN enrollments e ON e.course_id = cs.id
     WHERE e.child_id = ? AND i.kind = 'assignment' AND i.status = 'published'`
  ).all(childId) as {
    id: string;
    title: string;
    payload_json: string | null;
    availability_json: string | null;
    course_id: string;
    course_title: string;
  }[];

  // Filtra as tarefas para encontrar as que têm due_at e que não estão concluídas
  const assignmentItems: TimelineItem[] = [];
  const doneStmt = db.prepare(
    "SELECT status FROM item_progress WHERE child_id = ? AND item_id = ?"
  );

  for (const asg of assignments) {
    // Verifica se já está concluída
    const statusRow = doneStmt.get(childId, asg.id) as { status: string } | undefined;
    if (statusRow?.status === "done") continue;

    let dueAt: string | null = null;
    try {
      const payload = JSON.parse(asg.payload_json || "{}");
      dueAt = payload.due_at || null;
    } catch {
      // payload inválido
    }

    if (!dueAt) continue; // Prazos definidos apenas

    const availRes = evaluateAvailability(parseCond(asg.availability_json), resolver);

    assignmentItems.push({
      id: asg.id,
      title: asg.title,
      kind: "assignment",
      due_at: dueAt,
      course_id: asg.course_id,
      course_title: asg.course_title,
      available: availRes.available,
      lock_reason: availRes.reason,
    });
  }

  // 2) Busca provas (exams) dos cursos matriculados
  const exams = db.prepare(
    // NB: a tabela `exams` NÃO tem coluna `availability_json` (o motor de desbloqueio
    // da spec 15.5 só cobre content_items/course_modules). Selecionar `x.availability_json`
    // aqui causava um 500 ("no such column"). Provas não têm árvore de bloqueio → sempre available.
    `SELECT x.id, x.title, x.due_at, cs.id AS course_id, cs.title AS course_title
     FROM exams x
     JOIN courses cs ON cs.id = x.course_id
     JOIN enrollments e ON e.course_id = cs.id
     WHERE e.child_id = ? AND x.status = 'published'`
  ).all(childId) as {
    id: string;
    title: string;
    due_at: string | null;
    course_id: string;
    course_title: string;
  }[];

  const examItems: TimelineItem[] = [];
  const examSubmittedStmt = db.prepare(
    "SELECT 1 FROM exam_attempts WHERE exam_id = ? AND child_id = ? AND submitted_at IS NOT NULL LIMIT 1"
  );

  for (const ex of exams) {
    if (!ex.due_at) continue; // Prazos definidos apenas

    // Verifica se já enviou alguma tentativa concluída
    const submitted = examSubmittedStmt.get(ex.id, childId) != null;
    if (submitted) continue;

    // Provas não têm motor de desbloqueio → sempre disponíveis.
    examItems.push({
      id: ex.id,
      title: ex.title,
      kind: "exam",
      due_at: ex.due_at,
      course_id: ex.course_id,
      course_title: ex.course_title,
      available: true,
      lock_reason: null,
    });
  }

  // 3) Combina as listas e ordena cronologicamente por due_at
  const timeline = [...assignmentItems, ...examItems].sort((a, b) => {
    return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
  });

  return c.json({ timeline });
});

export default app;
