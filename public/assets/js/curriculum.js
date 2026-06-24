/* ============================================================
   BearMinds — Estrutura curricular (data-driven)
   ------------------------------------------------------------
   Para LIBERAR um novo conteúdo, basta registrar uma chave em
   window.BM_CONTENT no formato "<ano>.<turma>.<disciplina>.<trimestre>"
   (ver content-2026-y5-geografia.js). A navegação habilita
   automaticamente qualquer nó que tenha conteúdo registrado.
   ============================================================ */
window.BM_CURRICULUM = {
  // Anos letivos
  years: [
    { id: "2026", label: "2026" }
  ],

  // Turmas Maple (Y1 a Y9)
  classes: [
    { id: "y1", label: "Y1", age: "5–6 anos" },
    { id: "y2", label: "Y2", age: "6–7 anos" },
    { id: "y3", label: "Y3", age: "7–8 anos" },
    { id: "y4", label: "Y4", age: "8–9 anos" },
    { id: "y5", label: "Y5", age: "9–10 anos" },
    { id: "y6", label: "Y6", age: "10–11 anos" },
    { id: "y7", label: "Y7", age: "11–12 anos" },
    { id: "y8", label: "Y8", age: "12–13 anos" },
    { id: "y9", label: "Y9", age: "13–14 anos" }
  ],

  // Disciplinas (metodologia bilíngue Maple Bear)
  // lang: "pt" (Português) | "en" (English)
  subjects: [
    { id: "portugues",  label: "Português",  icon: "📚", lang: "pt" },
    { id: "english",    label: "English",    icon: "🇬🇧", lang: "en" },
    { id: "math",       label: "Math",       icon: "🔢", lang: "en" },
    { id: "science",    label: "Science",    icon: "🔬", lang: "en" },
    { id: "geografia",  label: "Geografia",  icon: "🌍", lang: "pt" },
    { id: "historia",   label: "História",   icon: "🏛️", lang: "pt" },
    { id: "artes",      label: "Artes",      icon: "🎨", lang: "pt" }
  ],

  // Trimestres
  trimesters: [
    { id: "t1", label: "1º Trimestre" },
    { id: "t2", label: "2º Trimestre" },
    { id: "t3", label: "3º Trimestre" }
  ]
};
