// Exemplar hand-verified (spec 05 §5.1: "One REAL exemplar hand-checked in P1 — frações equivalentes").
// Conteúdo curado por humano: zero risco de alucinação. Serve como fallback garantido quando não há
// chave de LLM e como o explorável de referência do produto. As citações apontam para chunks reais.
import type { Lesson, Explorable, Quiz } from "../../shared/contracts.ts";

export interface Exemplar {
  lesson: Lesson;
  explorable: Explorable;
  quiz: Quiz;
  atoms: { id: string; text: string }[];
}

const fracoesEquivalentes: Exemplar = {
  atoms: [
    { id: "atom_EF06MA07_1", text: "Reconhecer que duas frações são equivalentes quando representam a mesma parte do inteiro." },
    { id: "atom_EF06MA07_2", text: "Obter uma fração equivalente multiplicando numerador e denominador pelo mesmo número." },
    { id: "atom_EF06MA07_3", text: "Simplificar uma fração dividindo numerador e denominador pelo mesmo número." },
    { id: "atom_EF06MA07_4", text: "Comparar frações com denominadores diferentes usando um denominador comum." },
  ],
  lesson: {
    refused: false,
    reason: null,
    warmup_question: "Antes de começar: o que você acha que significa duas frações serem “equivalentes”? 🤔",
    sections: [
      {
        claim: "Frações equivalentes representam a mesma parte do inteiro.",
        explanation: "Por exemplo, 1/2 e 2/4 cobrem exatamente o mesmo tanto de uma barra.",
        source_id: "chunk_EF06MA07_1",
      },
      {
        claim: "Para achar uma equivalente, multiplique o numerador e o denominador pelo mesmo número.",
        explanation: "1/2 vira 2/4 (×2/2) e 3/6 (×3/3). Todas valem o mesmo.",
        source_id: "chunk_EF06MA07_1",
      },
      {
        claim: "Para comparar frações diferentes, use um denominador comum.",
        explanation: "1/2 = 3/6 e 2/3 = 4/6; como 4 > 3, então 2/3 é maior que 1/2.",
        source_id: "chunk_EF06MA07_2",
      },
    ],
    recap_questions: ["Por que 1/2 e 2/4 são equivalentes?", "Como você simplifica 6/8?"],
    companion_note: "🐻 Mandou bem tentando pensar antes de ler — é assim que o cérebro cresce!",
  },
  explorable: {
    title: "Barras de frações equivalentes",
    instruction: "Arraste o controle e veja: multiplicar em cima e embaixo pelo mesmo número não muda o tanto pintado.",
    html: `<div class="wrap">
  <div class="row"><span class="lbl" id="lblA">1/2</span><div class="bar" id="barA"></div></div>
  <div class="row"><span class="lbl" id="lblB">2/4</span><div class="bar" id="barB"></div></div>
  <label class="ctrl">Multiplicar por <b id="kv">2</b>
    <input id="k" type="range" min="1" max="6" value="2" step="1" aria-label="multiplicador">
  </label>
  <p class="eq" id="eq">1/2 = 2/4 — a mesma parte pintada! ✅</p>
</div>`,
    css: `.wrap{font-family:system-ui;padding:10px;color:#1a1e2b}
.row{display:flex;align-items:center;gap:8px;margin:8px 0}
.lbl{width:56px;font-weight:700;text-align:right}
.bar{flex:1;display:flex;height:34px;border:2px solid #1a1e2b;border-radius:6px;overflow:hidden}
.cell{flex:1;border-right:1px solid #9aa}
.cell:last-child{border-right:0}
.on{background:#34c77b}
.ctrl{display:block;margin:14px 0;font-weight:600}
.ctrl input{width:100%;height:34px}
.eq{font-weight:700;background:#eef1fa;padding:8px;border-radius:8px;text-align:center}`,
    js: `var num=1,den=2;
function draw(bar,parts,filled){bar.innerHTML="";for(var i=0;i<parts;i++){var d=document.createElement("div");d.className="cell"+(i<filled?" on":"");bar.appendChild(d);}}
function render(k){
  draw(document.getElementById("barA"),den,num);
  draw(document.getElementById("barB"),den*k,num*k);
  document.getElementById("lblB").textContent=(num*k)+"/"+(den*k);
  document.getElementById("kv").textContent=k;
  document.getElementById("eq").textContent="1/2 = "+(num*k)+"/"+(den*k)+" — a mesma parte pintada! ✅";
}
var slider=document.getElementById("k");
slider.addEventListener("input",function(){render(parseInt(slider.value,10)||1);});
render(2);`,
    success_check: "As duas barras pintam sempre o mesmo tanto, mesmo com números diferentes.",
  },
  quiz: {
    questions: [
      {
        id: "q1",
        atom_id: "atom_EF06MA07_1",
        kind: "mcq",
        prompt: "Qual fração é equivalente a 1/2?",
        options: ["2/4", "1/3", "3/4", "2/3"],
        answer_index: 0,
        needs_math_check: true,
        hints: [
          "Frações equivalentes representam a mesma parte do inteiro.",
          "Tente multiplicar o número de cima e o de baixo pelo mesmo valor.",
          "Multiplique 1 e 2 por 2 — o que você obtém?",
        ],
        misconception_feedback: { "1/3": "1/3 é menor que 1/2. Elas pintam partes diferentes." },
        explanation: "Multiplicando 1/2 por 2/2 obtemos 2/4, que representa a mesma parte.",
      },
      {
        id: "q2",
        atom_id: "atom_EF06MA07_2",
        kind: "numeric",
        prompt: "Multiplicando o numerador e o denominador de 2/3 por 4, qual será o novo denominador?",
        answer_number: 12,
        needs_math_check: true,
        hints: [
          "Você multiplica o de baixo pelo mesmo número do de cima.",
          "O denominador é o número de baixo da fração.",
          "Calcule 3 × 4.",
        ],
        explanation: "3 × 4 = 12, então 2/3 é equivalente a 8/12.",
      },
      {
        id: "q3",
        atom_id: "atom_EF06MA07_3",
        kind: "mcq",
        prompt: "Simplificando 6/8 (dividindo em cima e embaixo por 2), obtemos:",
        options: ["3/4", "2/4", "6/4", "3/8"],
        answer_index: 0,
        needs_math_check: true,
        hints: [
          "Simplificar é dividir o de cima e o de baixo pelo mesmo número.",
          "Tente dividir 6 e 8 por 2.",
          "6 ÷ 2 e 8 ÷ 2 dão quais números?",
        ],
        misconception_feedback: { "2/4": "Parece que você dividiu só um dos números. Divida os dois por 2." },
        explanation: "6 ÷ 2 = 3 e 8 ÷ 2 = 4, então 6/8 = 3/4.",
      },
      {
        id: "q4",
        atom_id: "atom_EF06MA07_4",
        kind: "mcq",
        prompt: "Qual é maior: 1/2 ou 2/3?",
        options: ["1/2", "2/3", "são iguais"],
        answer_index: 1,
        needs_math_check: true,
        hints: [
          "Escreva as duas frações com o mesmo denominador.",
          "Um denominador comum de 2 e 3 é 6.",
          "1/2 = 3/6 e 2/3 = 4/6 — qual numerador é maior?",
        ],
        explanation: "1/2 = 3/6 e 2/3 = 4/6. Como 4 > 3, então 2/3 é maior.",
      },
    ],
  },
};

const EXEMPLARS: Record<string, Exemplar> = {
  EF06MA07: fracoesEquivalentes,
};

export function exemplarFor(bnccCode: string): Exemplar | null {
  return EXEMPLARS[bnccCode] ?? null;
}
