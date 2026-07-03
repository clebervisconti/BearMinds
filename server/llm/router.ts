import { env } from "../env.ts";
import type { ModelId } from "./provider.ts";

export type TaskKind = "decompose" | "resolve" | "lesson" | "explorable" | "quiz" | "math_check";

// Roteamento de modelo por tarefa (spec 05). Ids vêm do .env → troca sem código.
export function pickModel(task: TaskKind, opts?: { hard?: boolean }): ModelId {
  switch (task) {
    case "decompose":
    case "resolve":
      return env.modelDefault; // barato (flash-lite)
    case "lesson":
    case "explorable":
    case "quiz":
      return env.modelContent; // flash
    case "math_check":
      return opts?.hard ? env.modelMathHard : env.modelContent; // claude-haiku-4-5 se difícil
  }
}
