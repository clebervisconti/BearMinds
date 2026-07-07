// Motor de auto-matrícula baseado em regras (spec 16.1).
import { db, newId, nowIso } from "../db.ts";
import { logger } from "../logger.ts";

/**
 * Avalia as regras de auto-matrícula para um estudante e realiza as inscrições correspondentes.
 */
export function evaluateAutoEnroll(
  childId: string,
  institutionId: string | null,
  grade: string,
  classId: string | null,
): void {
  const targetInst = institutionId || "bncc-padrao";
  
  try {
    // Busca regras que coincidem com o perfil do estudante.
    // Regra combina se:
    // 1) A instituição bate exatamente.
    // 2) A série (grade) bate OU é NULL (se aplica a todas as séries).
    // 3) A turma (class_id) bate OU é NULL (se aplica a todas as turmas).
    const rules = db.prepare(
      `SELECT course_id FROM enrollment_rules
       WHERE institution_id = ?
         AND (grade = ? OR grade IS NULL)
         AND (class_id = ? OR class_id IS NULL)`,
    ).all(targetInst, grade, classId ?? null) as { course_id: string }[];

    if (rules.length === 0) return;

    const checkEnroll = db.prepare(
      "SELECT 1 FROM enrollments WHERE child_id = ? AND course_id = ?",
    );
    const insertEnroll = db.prepare(
      `INSERT OR IGNORE INTO enrollments (id, child_id, course_id, source, assigned_by, enrolled_at)
       VALUES (?, ?, ?, 'assigned', 'system', ?)`,
    );

    // Executa as matrículas em lote dentro de uma transação
    db.transaction(() => {
      for (const r of rules) {
        const exists = checkEnroll.get(childId, r.course_id);
        if (!exists) {
          insertEnroll.run(newId(), childId, r.course_id, nowIso());
          logger.info(
            { childId, courseId: r.course_id, institutionId: targetInst },
            "estudante auto-matriculado via regra",
          );
        }
      }
    })();
  } catch (err) {
    logger.error(
      { err: String(err), childId, institutionId, grade, classId },
      "erro ao executar auto-matrícula",
    );
  }
}
