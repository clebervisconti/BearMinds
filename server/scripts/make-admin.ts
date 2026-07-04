// Bootstrap do primeiro platform_admin (spec 13.1).
// Uso: npm run make-admin -- email@exemplo.com
import { db, initDb } from "../db.ts";

initDb();

const email = process.argv[2]?.toLowerCase().trim();
if (!email) {
  console.error("Uso: npm run make-admin -- <email de uma conta existente>");
  process.exit(1);
}

const row = db.prepare("SELECT id, role FROM parents WHERE email = ? AND deleted_at IS NULL").get(email) as
  | { id: string; role: string }
  | undefined;
if (!row) {
  console.error(`❌ Conta não encontrada: ${email} (registre-se primeiro no app).`);
  process.exit(1);
}

db.prepare("UPDATE parents SET role = 'platform_admin' WHERE id = ?").run(row.id);
console.log(`✅ ${email} agora é platform_admin (antes: ${row.role || "guardian"}).`);
