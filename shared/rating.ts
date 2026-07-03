// Mapeamento desempenho no quiz → rating FSRS 1..4 (spec 06.1). Pura e testável.
// wrong após dicas → 1 (Again) · correto após 2-3 dicas → 2 (Hard) ·
// correto com ≤1 dica → 3 (Good) · correto rápido, sem dicas → 4 (Easy)
export function ratingFrom(
  hintsUsed: number,
  wrongTries: number,
  elapsedMs: number,
  gaveUp: boolean,
): 1 | 2 | 3 | 4 {
  if (gaveUp) return 1;
  if (hintsUsed === 0 && wrongTries === 0 && elapsedMs < 20000) return 4;
  if (hintsUsed <= 1 && wrongTries <= 1) return 3;
  return 2;
}
