// Correlação pós-prova (P5-r, roadmap 11): prontidão prevista (FSRS) × desempenho real (nota da prova).
// Scorer PURO (testável) — Pearson sobre pares (predicted, actual), ambos em 0..1.
export interface CorrelationPoint { predicted: number; actual: number }

export function pearsonCorrelation(points: CorrelationPoint[]): number | null {
  const n = points.length;
  if (n < 2) return null;
  const meanX = points.reduce((a, p) => a + p.predicted, 0) / n;
  const meanY = points.reduce((a, p) => a + p.actual, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (const p of points) {
    const dx = p.predicted - meanX;
    const dy = p.actual - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  if (denX === 0 || denY === 0) return null;
  return num / Math.sqrt(denX * denY);
}
