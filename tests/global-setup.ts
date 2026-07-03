import { rmSync } from "node:fs";

// Zera o banco de teste antes de toda a suíte.
export default function setup() {
  for (const suffix of ["", "-shm", "-wal"]) {
    try {
      rmSync(`./data/test-bearminds.db${suffix}`);
    } catch {
      /* inexistente */
    }
  }
}
