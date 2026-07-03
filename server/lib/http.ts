// Helpers HTTP: erros tipados {error:{code,message}}, validação zod, tipo do contexto Hono.
import type { Context } from "hono";
import type { z } from "zod";

export interface Vars {
  parentId: string;
  sessionId: string;
  activeChildId: string | null;
  childId: string;
}
export type AppEnv = { Variables: Vars };

export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (code: string, msg: string) => new AppError(400, code, msg);
export const unauthorized = (msg = "Faça login para continuar.") =>
  new AppError(401, "unauthorized", msg);
export const forbidden = (code: string, msg: string) => new AppError(403, code, msg);
export const notFound = (code: string, msg: string) => new AppError(404, code, msg);
export const conflict = (code: string, msg: string) => new AppError(409, code, msg);
export const tooMany = (msg: string) => new AppError(429, "rate_limited", msg);
export const unprocessable = (code: string, msg: string) => new AppError(422, code, msg);

// Parse + validação do corpo. Lança AppError formatado em caso de erro.
export async function readJson<T>(c: Context, schema: z.ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw badRequest("invalid_json", "Corpo da requisição inválido.");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw badRequest("validation", `${first.path.join(".") || "campo"}: ${first.message}`);
  }
  return parsed.data;
}
