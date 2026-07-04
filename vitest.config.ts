import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: "./tests/global-setup.ts",
    // Um único processo → a conexão SQLite de teste é aberta uma vez.
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    env: {
      NODE_ENV: "test",
      DATABASE_PATH: "./data/test-bearminds.db",
      PII_ENCRYPTION_KEY: "00000000000000000000000000000000",
      SESSION_PEPPER: "11111111111111111111111111111111",
      LLM_BASE_URL: "", // testes offline: sem LLM (nem cloud nem local) → caminhos de fallback determinísticos
    },
    include: ["tests/**/*.test.ts"],
  },
});
