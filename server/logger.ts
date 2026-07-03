import pino from "pino";
import { env } from "./env.ts";

// Log estruturado JSON para journald (spec 10.5). Em dev, mais legível.
export const logger = pino({
  level: process.env.LOG_LEVEL || (env.isProd ? "info" : "debug"),
  base: { app: "bearminds-api" },
});
