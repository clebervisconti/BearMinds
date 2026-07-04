// ⚠️ DESTRUTIVO — zera TODOS os usuários e dados de usuário, deixando só UMA conta platform_admin.
// Mantém dados de referência/seed (institutions, BNCC, corpus, currículo, cache de geração, métricas).
// Uso (rodar NO VPS, onde vive o SESSION_PEPPER de produção):
//   ADMIN_EMAIL=... ADMIN_PW=... npx tsx server/scripts/reset-to-admin.ts --yes
// A senha vem por env (nunca em argv/log). Sempre faça snapshot do DB antes.
import { db, initDb, newId, nowIso } from "../db.ts";
import { hashPassword } from "../lib/crypto.ts";

// Tabelas de REFERÊNCIA/seed que NÃO são dados de usuário — preservadas.
const KEEP = new Set([
  "institutions", "bncc_skills", "corpus_chunks", "knowledge_atoms",
  "curriculum_map", "generated_artifacts", "metrics_daily",
]);

async function main() {
  if (!process.argv.includes("--yes")) {
    console.error("Recusado: passe --yes para confirmar a operação destrutiva.");
    process.exit(1);
  }
  const email = (process.env.ADMIN_EMAIL || "").toLowerCase().trim();
  const pw = process.env.ADMIN_PW || "";
  if (!email || !pw) {
    console.error("Defina ADMIN_EMAIL e ADMIN_PW no ambiente.");
    process.exit(1);
  }

  initDb();
  const hash = await hashPassword(pw);   // usa o SESSION_PEPPER de produção

  const tables = (db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
  ).all() as { name: string }[]).map((t) => t.name);

  db.pragma("foreign_keys = OFF");
  const wipe = db.transaction(() => {
    for (const t of tables) {
      if (KEEP.has(t)) continue;
      db.prepare(`DELETE FROM ${t}`).run();
    }
    db.prepare(
      `INSERT INTO parents (id, email, email_verified, password_hash, created_at, role)
       VALUES (?, ?, 1, ?, ?, 'platform_admin')`,
    ).run(newId(), email, hash, nowIso());
  });
  wipe();
  db.pragma("foreign_keys = ON");

  const parents = (db.prepare("SELECT COUNT(*) n FROM parents").get() as { n: number }).n;
  const children = (db.prepare("SELECT COUNT(*) n FROM children").get() as { n: number }).n;
  const wiped = tables.filter((t) => !KEEP.has(t)).length;
  console.log(`✅ Reset concluído. Tabelas de usuário zeradas: ${wiped}. parents=${parents} (admin ${email}, platform_admin), children=${children}.`);
  console.log(`   Preservado: ${[...KEEP].join(", ")}.`);
  process.exit(0);
}

main().catch((e) => { console.error("Falhou:", e); process.exit(1); });
