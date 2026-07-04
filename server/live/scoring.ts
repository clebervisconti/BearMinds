// Pontuação Kahoot-style (spec 14.1) — pura e testável.
export const LIVE_BASE = 600;
export const LIVE_SPEED_MAX = 400;
export const LIVE_QUESTION_MS = 20_000; // janela padrão da pergunta

/** Acerto = base + bônus de velocidade proporcional ao tempo restante; erro = 0. */
export function liveScore(correct: boolean, ms: number, windowMs = LIVE_QUESTION_MS): number {
  if (!correct) return 0;
  const remaining = Math.max(0, Math.min(windowMs, windowMs - ms));
  const bonus = Math.round((remaining / windowMs) * LIVE_SPEED_MAX);
  return LIVE_BASE + bonus;
}

/** PIN de 6 dígitos a partir de bytes aleatórios (evita Math.random). */
export function pinFromBytes(bytes: Uint8Array): string {
  let n = 0;
  for (let i = 0; i < 4; i++) n = (n * 256 + (bytes[i] ?? 0)) >>> 0;
  return String(n % 1_000_000).padStart(6, "0");
}
