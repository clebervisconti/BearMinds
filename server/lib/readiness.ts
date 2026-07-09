// Readiness 2.0 (spec 17.4): rollup ponderado de evidências heterogêneas por competência —
// conhecimento (FSRS retrievability) + habilidade (rubricas) + execução (provas). Scorer PURO (testável).
export interface ReadinessInputs {
  knowledge: number | null; // 0..1 — média de retrievability dos atoms do curso
  skill: number | null;     // 0..1 — média das notas de rubrica (tarefas)
  execution: number | null; // 0..1 — média das notas de provas
}

export const READINESS_WEIGHTS = { knowledge: 0.4, skill: 0.3, execution: 0.3 };

/** Combina as 3 dimensões disponíveis, redistribuindo o peso das que faltam. null se nenhuma tiver dado. */
export function rollupReadiness(inputs: ReadinessInputs): number | null {
  const dims: { v: number; w: number }[] = [];
  if (inputs.knowledge !== null) dims.push({ v: inputs.knowledge, w: READINESS_WEIGHTS.knowledge });
  if (inputs.skill !== null) dims.push({ v: inputs.skill, w: READINESS_WEIGHTS.skill });
  if (inputs.execution !== null) dims.push({ v: inputs.execution, w: READINESS_WEIGHTS.execution });
  if (dims.length === 0) return null;
  const totalW = dims.reduce((a, d) => a + d.w, 0);
  return dims.reduce((a, d) => a + d.v * (d.w / totalW), 0);
}
