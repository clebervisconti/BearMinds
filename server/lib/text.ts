// Utilidades de texto PT (normalização p/ matching de tópicos e respostas curtas).
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP = new Set([
  "o","a","os","as","de","do","da","dos","das","e","em","um","uma","para","por","com","que",
  "no","na","nos","nas","ao","aos","the","of","to","and","in","a","an","is",
]);

export function tokens(s: string): string[] {
  return normalize(s)
    .split(" ")
    .filter((t) => t.length > 1 && !STOP.has(t));
}
