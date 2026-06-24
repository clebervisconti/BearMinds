# BearMinds — Autoria de módulos de conteúdo

Como gerar um módulo publicável no site. Exemplo canônico completo:
`public/assets/js/content-2026-y5-geografia.js`.

## 1. Nome do arquivo
```
public/assets/js/content-<anoLetivo>-<turma>-<disciplinaId>.js
```
Ex.: `content-2026-y5-geografia.js`, `content-2026-y6-math.js`.

## 2. Chave de registro (define onde aparece no site)
```js
window.BM_CONTENT = window.BM_CONTENT || {};
window.BM_CONTENT["<anoLetivo>.<turma>.<disciplinaId>.<trimestre>"] = { … };
```
- **anoLetivo**: ano civil, ex. `2026`.
- **turma**: `y1`…`y9` (minúsculo).
- **disciplinaId** (igual ao `curriculum.js`):
  `portugues` · `english` · `math` · `science` · `geografia` · `historia` · `artes`
- **trimestre**: `t1` · `t2` · `t3`.

Ex.: `"2026.y5.geografia.t2"`. Um mesmo arquivo pode registrar mais de uma chave
(ex.: trimestres diferentes), mas o padrão é 1 chave por arquivo.

## 3. Forma do módulo
```js
{
  title:    "Geografia · Recuperação",          // título no hub de atividades
  subtitle: "O Homem, a Natureza e o Espaço…",   // aparece também no card do trimestre
  intro:    "Escolha por onde começar…",         // texto opcional (callout)
  activities: [ /* guide e/ou quiz */ ]
}
```

### Atividade tipo "guide" (📖 Guia de Estudos)
```js
{
  id:"guia", type:"guide", icon:"📖",
  title:"Guia de Estudos", subtitle:"(gerado dinamicamente pelo nº de temas)",
  themes:[
    {
      icon:"🤝",
      title:"1. Nome do tema",
      concept:"Parágrafo do conceito central. <b>negrito</b> e emojis são permitidos.",
      points:[ "Ponto-chave 1 (HTML ok)", "Ponto-chave 2" ],   // viram bullets 🍁
      trick:"🧠 Truque/mnemônico (opcional).",
      validation:{ q:"Pergunta para conferir.", a:"Resposta (revelada por botão)." }  // opcional
    }
  ]
}
```

### Atividade tipo "quiz" (🏆 Quiz Interativo)
```js
{
  id:"quiz", type:"quiz", icon:"🏆",
  title:"Quiz Interativo", subtitle:"(gerado: nº de perguntas)",
  passMark:0.7,                 // opcional (default 0.7)
  questions:[ … ]               // tipos abaixo
}
```
Tipos de questão:
```js
// múltipla escolha — answer = índice (0-based) da opção correta
{ type:"mc", tag:"Tema", q:"Pergunta?", opts:["A","B","C","D"], answer:1,
  good:"Feedback de acerto.", bad:"Feedback de erro." }

// verdadeiro/falso — answer = true|false
{ type:"vf", tag:"Tema", q:"Afirmação.", answer:true, good:"…", bad:"…" }

// completar lacuna — accept = lista de respostas aceitas (case-insensitive, "contém")
{ type:"gap", tag:"Tema", q:"Complete: ___.", accept:["resposta","variação"], good:"…", bad:"…" }

// ligar colunas — cada linha tem options[] e a answer correta (string)
{ type:"match", tag:"Tema", q:"Ligue:",
  rows:[ { left:"Item 🛬", options:["X","Y"], answer:"X" } ],
  good:"…", bad:"…" }
```

## 4. Publicar
Depois de gravar o arquivo `content-*.js`, rode (registra no index + deploy):
```
bash "/Volumes/STORAGE/Cyberlabs/Apps/BearMinds/publish.sh"
```
O nó (ano/turma/disciplina/trimestre) passa a aparecer habilitado em
https://bearminds.cybersphere.com.br — os demais continuam "em breve".

## Regras
- Idioma segue a metodologia: PT (Português, Geografia, História, Artes) · EN (English, Math, Science).
- Sem conteúdo além do escopo fornecido pelo usuário.
- Aspas dentro de strings: use `“ ”` (aspas curvas) para evitar quebrar o JS, como no exemplo.
