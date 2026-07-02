import type { AgeBand, ConsentScope } from "../../shared/contracts.ts";

export const REQUIRED_CONSENTS: ConsentScope[] = ["account", "ai_generation", "progress_tracking"];
export const ALL_CONSENTS: ConsentScope[] = [...REQUIRED_CONSENTS, "email_updates"];
export const MAX_CHILDREN = 4;
export const MIN_AGE = 8; // MEC desencoraja IA na primeira infância (spec 03 §3.4)

export function ageFromBirthYear(birthYear: number, now = new Date()): number {
  return now.getFullYear() - birthYear;
}

export function ageBandFromAge(age: number): AgeBand {
  if (age <= 10) return "8-10";
  if (age <= 14) return "11-14";
  return "15-18";
}

// Timezone do produto para "dia" de hábito/streak (spec 02/07).
export function localDay(date = new Date()): string {
  // America/Sao_Paulo (UTC-3, sem DST desde 2019).
  const saoPaulo = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  return saoPaulo.toISOString().slice(0, 10);
}
