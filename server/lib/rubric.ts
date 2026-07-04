// Rubricas (spec 15.4): seções ponderadas, cada critério com níveis pontuados. Scorer PURO (testável).
export interface RubricLevel { label: string; points: number }
export interface RubricCriterion { label: string; levels: RubricLevel[] }
export interface RubricSection { title: string; weight: number; criteria: RubricCriterion[] }

/**
 * Pontua uma rubrica a partir das seleções do revisor.
 * selections[s][c] = índice do nível escolhido na seção s, critério c.
 * Retorna a fração 0..1 (média ponderada por seção) e os pontos (fração × maxPoints).
 */
export function scoreRubric(
  sections: RubricSection[],
  selections: number[][],
  maxPoints = 100,
): { fraction: number; points: number } {
  let weightSum = 0;
  let weighted = 0;
  sections.forEach((sec, si) => {
    const w = Math.max(0, sec.weight || 0);
    if (w === 0 || sec.criteria.length === 0) return;
    let got = 0;
    let max = 0;
    sec.criteria.forEach((cri, ci) => {
      const levels = cri.levels ?? [];
      if (levels.length === 0) return;
      const maxLevel = Math.max(...levels.map((l) => l.points));
      max += maxLevel;
      const pick = selections?.[si]?.[ci];
      if (typeof pick === "number" && pick >= 0 && pick < levels.length) got += levels[pick].points;
    });
    const raw = max > 0 ? got / max : 0;
    weightSum += w;
    weighted += w * raw;
  });
  const fraction = weightSum > 0 ? weighted / weightSum : 0;
  return { fraction, points: Math.round(fraction * maxPoints) };
}
