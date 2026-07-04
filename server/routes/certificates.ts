// Certificados (spec 14.5): listar os do estudante + verificação pública por código.
import { Hono } from "hono";
import { db } from "../db.ts";
import { requireParent, ownChildOrThrow } from "../lib/session.ts";
import { notFound, type AppEnv } from "../lib/http.ts";

const app = new Hono<AppEnv>();

// Meus certificados (do estudante ativo).
app.get("/api/certificates", requireParent, (c) => {
  const parentId = c.get("parentId");
  const childId = c.req.query("child_id") || c.get("activeChildId") || "";
  if (childId) ownChildOrThrow(parentId, childId);
  const rows = db.prepare(
    `SELECT ct.code, ct.issued_at, cs.title AS course_title, cs.cover_emoji FROM certificates ct
     JOIN courses cs ON cs.id = ct.course_id WHERE ct.child_id = ? ORDER BY ct.issued_at DESC`,
  ).all(childId);
  return c.json({ certificates: rows });
});

// Verificação PÚBLICA (sem PII sensível: apelido + curso + instituição + data).
app.get("/api/cert/:code", (c) => {
  const row = db.prepare(
    `SELECT ct.code, ct.issued_at, ch.display_name AS student, cs.title AS course_title,
            i.name AS institution FROM certificates ct
     JOIN children ch ON ch.id = ct.child_id
     JOIN courses cs ON cs.id = ct.course_id
     LEFT JOIN institutions i ON i.id = cs.institution_id
     WHERE ct.code = ?`,
  ).get(c.req.param("code"));
  if (!row) throw notFound("cert_not_found", "Certificado não encontrado.");
  return c.json(row);
});

export default app;
