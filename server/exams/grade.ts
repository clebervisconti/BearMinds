// Provas (spec 15.3): sorteio reproduzível por seed + auto-correção. Núcleo PURO (testável).

/** PRNG determinístico (mulberry32) a partir de uma string de seed. */
export function seededRng(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates determinístico. Não muta o array de entrada. */
export function seededShuffle<T>(arr: T[], seed: string): T[] {
  const rng = seededRng(seed);
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export type BankKind = "mcq" | "tf" | "short" | "numeric";

/** normaliza texto p/ comparação de resposta curta (minúsculas, sem acento/pontuação/espaços extras). */
export function normalizeShort(s: string): string {
  return s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w\s]/g, "").replace(/\s+/g, " ");
}

/** Corrige uma resposta contra o answer_json do banco. Retorna null se não auto-corrigível (short sem match exato → professor). */
export function gradeResponse(kind: BankKind, answer: unknown, response: unknown): boolean {
  switch (kind) {
    case "mcq":
      return typeof response === "number" && response === answer;
    case "tf":
      return typeof response === "boolean" && response === answer;
    case "numeric": {
      const a = answer as { value: number; tolerance?: number };
      return typeof response === "number" && Math.abs(response - a.value) <= (a.tolerance ?? 0);
    }
    case "short": {
      const accepted = (answer as { accepted: string[] }).accepted ?? [];
      const r = normalizeShort(String(response ?? ""));
      return accepted.some((x) => normalizeShort(x) === r);
    }
  }
}

/** short é auto-corrigível só quando bate; caso contrário fica pendente de revisão humana (spec 15.3). */
export function isAutoGradable(kind: BankKind): boolean {
  return kind === "mcq" || kind === "tf" || kind === "numeric";
}
