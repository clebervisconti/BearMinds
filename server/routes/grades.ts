// Boletim (Gradebook-lite) (spec 16.3).
import { Hono } from "hono";
import { db } from "../db.ts";
import { requireParent, requireRole, ownChildOrThrow, staffInstitutionOrThrow } from "../lib/session.ts";
import { notFound, badRequest, type AppEnv } from "../lib/http.ts";

const app = new Hono<AppEnv>();

interface StudentRow {
  id: string;
  display_name: string;
  grade: string;
  class_id: string | null;
}

interface ActivityItem {
  id: string;
  title: string;
  kind: "assignment" | "exam";
  max_points: number;
}

// ---------- GET /api/admin/courses/:id/gradebook (Professor / Admin) ----------
app.get("/api/admin/courses/:id/gradebook", requireParent, requireRole("professor", "tutor", "institution_admin"), (c) => {
  const courseId = c.req.param("id");
  const parentId = c.get("parentId");

  const course = db.prepare("SELECT institution_id FROM courses WHERE id = ?").get(courseId) as { institution_id: string } | undefined;
  if (!course) throw notFound("course_not_found", "Curso não encontrado.");

  staffInstitutionOrThrow(parentId, course.institution_id);

  // 1) Alunos matriculados
  const students = db.prepare(
    `SELECT c.id, c.display_name, c.grade, c.class_id 
     FROM children c 
     JOIN enrollments e ON e.child_id = c.id 
     WHERE e.course_id = ? AND c.deleted_at IS NULL 
     ORDER BY c.display_name`
  ).all(courseId) as StudentRow[];

  // 2) Atividades avaliativas (Tarefas e Provas)
  // Tarefas (content_items com tipo assignment)
  const assignments = db.prepare(
    `SELECT i.id, i.title, i.payload_json 
     FROM content_items i 
     JOIN course_modules m ON m.id = i.module_id 
     WHERE m.course_id = ? AND i.kind = 'assignment' AND i.status = 'published'`
  ).all(courseId) as { id: string; title: string; payload_json: string | null }[];

  // Provas (exams publicados)
  const exams = db.prepare(
    `SELECT id, title FROM exams WHERE course_id = ? AND status = 'published'`
  ).all(courseId) as { id: string; title: string }[];

  const activities: ActivityItem[] = [];

  // Mapeia configurações de max_points das tarefas
  const taskMaxPoints: Record<string, number> = {};
  for (const asg of assignments) {
    let max = 100;
    try {
      const payload = JSON.parse(asg.payload_json || "{}");
      max = Number(payload.max_points || 100);
    } catch {
      // payload inválido
    }
    taskMaxPoints[asg.id] = max;
    activities.push({ id: asg.id, title: asg.title, kind: "assignment", max_points: max });
  }

  for (const ex of exams) {
    activities.push({ id: ex.id, title: ex.title, kind: "exam", max_points: 100 });
  }

  // 3) Notas de Tarefas (reviews de submissão)
  const taskScoresRows = db.prepare(
    `SELECT sub.child_id, sub.item_id, MAX(rev.points) AS points 
     FROM submission_reviews rev 
     JOIN submissions sub ON sub.id = rev.submission_id 
     JOIN content_items i ON i.id = sub.item_id 
     JOIN course_modules m ON m.id = i.module_id 
     WHERE m.course_id = ? 
     GROUP BY sub.child_id, sub.item_id`
  ).all(courseId) as { child_id: string; item_id: string; points: number }[];

  const taskScores: Record<string, Record<string, number>> = {}; // child_id -> item_id -> normalized_score (0..1)
  for (const row of taskScoresRows) {
    if (!taskScores[row.child_id]) taskScores[row.child_id] = {};
    const max = taskMaxPoints[row.item_id] || 100;
    taskScores[row.child_id][row.item_id] = max > 0 ? row.points / max : 0;
  }

  // 4) Notas de Provas (exam attempts)
  const examScoresRows = db.prepare(
    `SELECT ea.child_id, ea.exam_id, MAX(ea.score) AS score 
     FROM exam_attempts ea 
     JOIN exams e ON e.id = ea.exam_id 
     WHERE e.course_id = ? AND ea.submitted_at IS NOT NULL 
     GROUP BY ea.child_id, ea.exam_id`
  ).all(courseId) as { child_id: string; exam_id: string; score: number }[];

  const examScores: Record<string, Record<string, number>> = {}; // child_id -> exam_id -> score (0..1)
  for (const row of examScoresRows) {
    if (!examScores[row.child_id]) examScores[row.child_id] = {};
    examScores[row.child_id][row.exam_id] = row.score;
  }

  // 5) Compila as notas de cada aluno
  const gradebook = students.map((std) => {
    const studentGrades: Record<string, number | null> = {};
    let sum = 0;
    let count = 0;

    for (const act of activities) {
      let score: number | null = null;
      if (act.kind === "assignment") {
        score = taskScores[std.id]?.[act.id] ?? null;
      } else {
        score = examScores[std.id]?.[act.id] ?? null;
      }

      studentGrades[act.id] = score;
      if (score !== null) {
        sum += score;
        count++;
      }
    }

    return {
      id: std.id,
      display_name: std.display_name,
      grade: std.grade,
      class_id: std.class_id,
      grades: studentGrades,
      average: count > 0 ? sum / count : null,
    };
  });

  return c.json({
    activities,
    students: gradebook,
  });
});

// ---------- GET /api/my/grades (Estudante / Responsável) ----------
app.get("/api/my/grades", requireParent, (c) => {
  const parentId = c.get("parentId");
  const childId = c.req.query("child_id");
  if (!childId) throw badRequest("child_id_required", "Informe o child_id.");

  ownChildOrThrow(parentId, childId);

  // 1) Cursos matriculados
  const enrolledCourses = db.prepare(
    `SELECT id, title, cover_emoji FROM courses 
     WHERE id IN (SELECT course_id FROM enrollments WHERE child_id = ?)`
  ).all(childId) as { id: string; title: string; cover_emoji: string }[];

  const result = enrolledCourses.map((course) => {
    // 2) Atividades do curso
    // Tarefas
    const assignments = db.prepare(
      `SELECT i.id, i.title, i.payload_json 
       FROM content_items i 
       JOIN course_modules m ON m.id = i.module_id 
       WHERE m.course_id = ? AND i.kind = 'assignment' AND i.status = 'published'`
    ).all(course.id) as { id: string; title: string; payload_json: string | null }[];

    // Provas
    const exams = db.prepare(
      `SELECT id, title FROM exams WHERE course_id = ? AND status = 'published'`
    ).all(course.id) as { id: string; title: string }[];

    const studentGrades: Record<string, { title: string; score: number | null }> = {};
    let sum = 0;
    let count = 0;

    // Notas de tarefas
    const taskScores = db.prepare(
      `SELECT MAX(rev.points) AS points 
       FROM submission_reviews rev 
       JOIN submissions sub ON sub.id = rev.submission_id 
       WHERE sub.item_id = ? AND sub.child_id = ?`
    );

    for (const asg of assignments) {
      let max = 100;
      try {
        const payload = JSON.parse(asg.payload_json || "{}");
        max = Number(payload.max_points || 100);
      } catch {
        // payload inválido
      }

      const row = taskScores.get(asg.id, childId) as { points: number | null } | undefined;
      const score = (row && row.points !== null && max > 0) ? row.points / max : null;
      
      studentGrades[asg.id] = { title: asg.title, score };
      if (score !== null) {
        sum += score;
        count++;
      }
    }

    // Notas de provas
    const examScores = db.prepare(
      `SELECT MAX(score) AS score 
       FROM exam_attempts 
       WHERE exam_id = ? AND child_id = ? AND submitted_at IS NOT NULL`
    );

    for (const ex of exams) {
      const row = examScores.get(ex.id, childId) as { score: number | null } | undefined;
      const score = row?.score ?? null;

      studentGrades[ex.id] = { title: ex.title, score };
      if (score !== null) {
        sum += score;
        count++;
      }
    }

    return {
      id: course.id,
      title: course.title,
      cover_emoji: course.cover_emoji,
      grades: studentGrades,
      average: count > 0 ? sum / count : null,
    };
  });

  return c.json({ courses: result });
});

export default app;
