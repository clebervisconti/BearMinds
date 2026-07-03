import { execSync } from "node:child_process";

// SHA curto do git para o /api/health (deploy gate). Cai para env ou 'dev'.
export const appVersion: string = (() => {
  if (process.env.BEARMINDS_VERSION) return process.env.BEARMINDS_VERSION;
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "dev";
  }
})();
