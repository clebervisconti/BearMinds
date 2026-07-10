# 18 · Visão de Próxima Geração — Pesquisa de Features, Design & UX (v1.0 · 2026-07-10)

> **Documento de pesquisa e visão, não spec de implementação.** Consolida o que precisamos
> desenvolver — features, padrões de design e experiência do usuário — para termos uma plataforma
> de aprendizagem de próxima geração **completa e inovadora**, sempre focada no nosso público-alvo.
>
> **Fontes:** (1) o pacote de estratégia da CS AI Strategy squad (`memo.md`, deep-review 2026-07-02,
> pesquisas de pedagogia/gamificação/competição) que embasou toda a estratégia da plataforma;
> (2) duas rodadas de pesquisa fresca 2025–2026 encomendadas à squad para este documento — *features
> de plataformas de próxima geração* e *padrões de design & UX para edtech jovem* (evidências e fontes
> ao final). Onde esta visão conflitar com specs anteriores, ela **propõe** — a decisão de escopo/ordem
> continua sendo do owner e vira spec numerado quando aprovada.
>
> **Regra de ouro (inegociável):** nada aqui enfraquece os guardrails do spec 05 (grounding-only,
> answer-withholding, cache-integrity) nem os itens de LGPD do spec 09. Toda feature nova é julgada por
> uma única pergunta: **mantém o estudante fazendo o esforço cognitivo?** ("aprender, não colar").

---

## 18.0 A âncora que disciplina tudo (leia primeiro)

A descoberta mais importante de 2025 para um produto "aprender, não colar":
**é a pedagogia da IA, não a presença da IA, que determina se há aprendizagem.**

- **Kestin et al. (Harvard, *Scientific Reports*, jun/2025, n=194):** um tutor de IA *projetado com
  guardrails* (scaffolding que desaparece, sem entregar resposta) produziu ~**2× de aprendizagem por
  hora** vs. aula ativa, com maior engajamento. O ganho veio do *design do guardrail*, não do LLM.
- **A armadilha a evitar:** múltiplos estudos 2025 ("Faster Completion, Less Learning"; Bastani PNAS)
  mostram que IA que **entrega resposta acelera a tarefa mas reduz o conhecimento durável** e induz
  **"preguiça metacognitiva"** — o aluno terceiriza planejamento, monitoramento e reflexão para a IA.
- **O contra-exemplo comercial:** um estudo do próprio Khanmigo achou ganhos, mas **sem diferença
  significativa vs. controle** — ou seja, "tutor de IA" como rótulo **não é moat**; o guardrail + a
  integração curricular (BNCC) + os dados longitudinais de maestria são.

**Consequência estratégica:** o nosso posicionamento é a *única* configuração com evidência causal
positiva. Isso reordena as prioridades — as apostas de maior alavancagem são **metacognição, calibração
de confiança e scaffolding Socrático**, todas nativas do nosso moat (o corpus BNCC verificado + os dados
de maestria por aluno), não features de me-too.

---

## 18.1 Público-alvo (para quem estamos desenhando)

Reafirmando a estratégia (memo/deep-review) e traduzindo em personas de design. O **pagador é o
responsável**; o **usuário** é o estudante 6–19; a **escola** é aliada, não concorrente.

| Persona | Quem | O que valoriza | Implicação de produto |
|---|---|---|---|
| **Responsável pagante** (beachhead) | Pai/mãe de aluno de escola privada, filho 8–14, Mat. 6º–9º | Tranquilidade, alinhamento à escola, "aprende de verdade", previsão de prova | Digest semanal, previsão de prontidão, transparência do que a IA fez, consentimento LGPD claro |
| **Criança 8–10** | Leitor em desenvolvimento, motor fino imaturo, sessão 5–15 min | Acolhimento, vitória rápida, lúdico | Alvos grandes, ícone+rótulo, narração, mascote, celebração rica, progresso qualitativo (sem números) |
| **Tween 11–14** (núcleo de uso) | Autoconfiante mas com leitura/paciência menores que adulto | Autonomia, identidade, não ser tratado como criança | Escolha de trilha/avatar, social opt-in local, scaffolding disponível mas não forçado |
| **Teen 15–18** | Quase-adulto, foco ENEM/vestibular, sessão 25–45 min | Ser tratado como dono da própria experiência, dados, eficiência | Densidade adulta, paleta madura, mínimo de game, prontidão % + contagem regressiva; **NÃO** infantilizar |
| **Estudante "eu mesmo"** (perfil self) | O próprio titular estuda (universitário/adulto) | Autonomia total, sem gate infantil | Shell formal puro; skins infantis nunca aparecem |
| **Professor / escola** (cunha B2B2C, 2027+) | Rede privada que já usa Plurall/Geekie | Autoria com BNCC, analytics de erro, economia de tempo | Item bank BNCC, sign-off humano, dashboard de equívocos — *complementar*, não competir em autoria |

**Realidades brasileiras que o design precisa respeitar:** 98% dos 9–17 online via **celular**
(phone-first PWA cobre a maioria); ~49,5% dos estudantes não atingem proficiência mínima de leitura
(**linguagem simples por padrão, em toda a plataforma**, não só na banda infantil); conectividade
irregular (**offline é feature, não luxo**); PT-BR ~30% mais longo que EN (componentes flexíveis).

---

## 18.2 Estado atual (o que já temos — para os gaps ficarem honestos)

A plataforma já é um LMS maduro. **Já entregue e em produção** (specs 01–16):

- **Loop de aprendizagem grounded** think-first: warmup → lição (claim+fonte) → explorável sandboxed →
  quiz Socrático (hints escalonados, resposta retida) → fecho FSRS com citações visíveis. Recusa quando
  o corpus não sustenta. Guardrails testados.
- **Maestria/memória:** FSRS por knowledge-atom ancorado à data real da prova; "para revisar hoje".
- **Plataforma 6–19:** conta owner-fronted + perfis self/child (LGPD art. 14), shell formal calmo
  (CYBERSPHERE light) + 3 skins infantis só dentro da Aula; 7 áreas (Dashboard, Cursos, Atividades,
  Comunidade, Conquistas, Notificações, Config).
- **LMS/autoria:** /admin (cursos→módulos→itens), pipeline de **enriquecimento IA → sign-off humano**,
  matrícula, conclusão mastery-gated.
- **Avaliação (P5a):** banco de questões versionado (IA gera rascunho, professor aprova), provas com
  sorteio por seed + auto-correção, tarefas + rubricas (IA como pré-análise, nunca nota), motor de
  desbloqueio (árvore de disponibilidade), events stream, gamificação age-banded.
- **Ao vivo & social:** jogos estilo Kahoot, enquetes/Q&A, chat (canal do curso + DM só aluno↔staff),
  coaching de risco, certificados verificáveis, moderação.
- **Gestão (P5b):** auto-matrícula por regra, duplicação de curso, boletim, cronograma, relatórios.
- **Gamificação "done right":** moedas só de eventos de aprendizagem, streak amarrado a review real +
  freeze semanal, badges por maestria, leaderboard **por instituição** (opt-out), sem dark patterns.
- **IA:** provider abstrato (Gemma local default no HULK via túnel; Gemini/Claude opcionais),
  RAG BM25 sobre corpus BNCC, seletor de modelo na Administração.

**Leitura honesta:** a *fundação pedagógica* e o *LMS* estão fortes e à frente de muitos concorrentes.
Os gaps de "próxima geração" estão em três frentes — **(a) metacognição/SRL como camada explícita,
(b) profundidade da experiência de tutoria (multimodal, interativa, streaming), e (c) a experiência do
responsável como produto de valor pago.** É onde a pesquisa aponta a maior alavancagem *e* o maior
alinhamento com o moat.

---

## 18.3 Visão de features (gap analysis por tema)

Cada tema: **Temos → Gap → Construir**, com a evidência e o ajuste ao guardrail. Ordenados por
alavancagem estratégica (não por facilidade).

### A. Metacognição & autorregulação (SRL) — *maior alavancagem, mais defensável*
A pesquisa é inequívoca: o suporte metacognitivo é o **antídoto documentado** para o dano de dependência
de IA, e é movido exatamente pelo ativo que os concorrentes não têm — **dados longitudinais de maestria**.

- **Temos:** FSRS, rating por atom, prontidão de prova, painel do responsável.
- **Gap:** o aluno não *reflete*, não *calibra confiança*, não *vê o próprio gap* entre o que acha que
  sabe e o que os dados dizem. Khanmigo/Duolingo largamente não entregam isso.
- **Construir:**
  1. **Calibração de confiança** — antes de ver a correção, o aluno declara confiança (1–5); a UI mostra
     o gap. Evidência causal (CHI 2025): ajuda *especialmente os superconfiantes* a recalibrar e melhora
     a aprendizagem. É anti-cola nativo (maestria fingida fica visível nos dados).
  2. **Espelho cognitivo (self vs. actual):** "você se avaliou 4/5; seus dados dizem 2/5 em frações
     equivalentes." Explora o moat diretamente.
  3. **Scaffolds de SRL:** prompts de reflexão pós-sessão, definição de meta e planejador de estudo leve.
     Sem eles, o aluno *perde* SRL em ambientes de IA (BJET 2025); com eles, melhora.

### B. Experiência de tutoria (a Aula de próxima geração)
- **Temos:** loop think-first, quiz com hint ladder, explorável (1 exemplar), citações no fecho.
- **Gap:** hints são por-questão, não um **tutor conversacional Socrático**; entrada é texto/toque
  (difícil para matemática no celular 8–14); só 1 explorável real; sem streaming; refusal existe mas
  pode ser mais caloroso/acionável.
- **Construir:**
  1. **Tutor Socrático com escada de dicas + atrito no "revelar":** dica 1 (empurrão) → dica 2 (parcial)
     → "mostrar um passo" → último recurso "revelar resposta" com confirmação ("tenta mais uma?"). 68%
     dos alunos preferem Socrático a chatbot que entrega resposta. **UI estruturada por botões** ("estou
     travado", "explica de outro jeito", "dá uma dica") acima de chat aberto — menor latência, melhor
     para quem não digita bem, menos superfície de off-topic/refusal.
  2. **"Mostre seu trabalho" (multimodal):** captura por foto/desenho do passo manuscrito; a IA critica
     o **raciocínio**, não a resposta. Inverte o vetor de cola dos photo-solvers (Photomath/MathGPT) em
     ferramenta de aprendizagem — a primitiva anti-cola por excelência. Escopo LGPD dedicado (mídia).
  3. **Streaming + estados de latência calmos:** para o LLM local (~1s+), streaming token-a-token é
     percebido como ~40% mais rápido; skeleton imediato, indicador "pensando" suave (nunca spinner de
     pânico), botão de interromper. Alvo de sensação < 1s para preservar o fluxo.
  4. **Mais tipos interativos/manipuláveis** (Brilliant/Synthesis como norte): biblioteca de exploráveis
     (alvo já no roadmap: 1 por 3 skills), problemas manipuláveis com causa→efeito visível.
  5. **Refusal/out-of-corpus de primeira classe:** "Não encontrei isso no nosso material" · "Não posso
     ajudar com isso" · "Vamos tentar de novo?" — sempre com próxima ação, nunca beco sem saída, nunca
     vergonha para a criança.

### C. Experiência do responsável (monetiza o moat — pista larga e vazia)
85% dos pais avaliam o acompanhamento cross-app ≤5/10; **nenhum player domina** o digest+previsão do pai
brasileiro. É onde a disposição a pagar mora, e reforça o guardrail (visibilidade do pai desincentiva
cola).
- **Temos:** painel P1-lite (atividade 7d, prontidão), boletim, cronograma.
- **Gap:** não há **digest semanal proativo**, "o que fazer esta semana", **previsão de prontidão** como
  produto, nem transparência de "o tutor orientou, não resolveu".
- **Construir:** digest semanal (5 linhas, PT plano, respeita consentimento) · bloco "o que estudar em
  casa" (3 atoms mais fracos antes da próxima prova) · **previsão de prontidão por competência BNCC** ·
  correlação pós-prova (predito × real) mostrada honestamente — a transparência *é* o moat de confiança e
  o dataset de eficácia futuro · resumo "o que a IA fez" (orientou/não entregou).

### D. Adaptação & trilha (acima do FSRS)
- **Temos:** FSRS (retenção) + BNCC como estrutura + dados longitudinais (o moat).
- **Gap:** sem **grafo de conhecimento** que fixe pré-requisitos e faça progressão mastery-gated por
  dependência; sem seleção adaptativa de próximo item.
- **Construir:** **grafo de conhecimento BNCC** (skills → knowledge-atoms com pré-requisitos) alimentando
  progressão travada por maestria real (padrão Squirrel AI: 64–75% dos alunos acima da média do professor).
  **Cautela cética:** Deep Knowledge Tracing (DKT) tem "wavy transitions" (maestria oscila irracionalmente)
  e evidência majoritariamente offline (AUC), não ganho de sala — usar DKT, se usar, como *sinal interno*,
  nunca como número exibido ao pai/aluno. Nosso stack interpretável (FSRS + grafo BNCC) é mais defensável.

### E. Avaliação & anti-cola arquitetural
- **Temos:** banco de questões versionado, provas com sorteio, rubricas, auto-correção MCQ/numérico.
- **Gap:** correção de resposta aberta por IA com rubrica (formativa); anti-cola por *arquitetura* em vez
  de teatro.
- **Construir:** **correção rubric-bound de resposta aberta** (85–92% de concordância com humano *quando
  há rubrica* — só formativo/baixo risco, humano decide o que conta) · **anti-cola arquitetural** =
  (1) tutor nunca emite resposta final, (2) "mostre seu trabalho" torna o *processo* o artefato avaliado,
  (3) calibração + gap self/actual tornam maestria fingida visível, (4) flag de conteúdo colado externo
  para revisão do professor. **Nada de lockdown de navegador / vigilância** (teatro de segurança).

### F. Habilidades da era da IA (vento regulatório 2026)
BNCC Computação obrigatória em 2026 (Pensamento Computacional, Mundo Digital, Cultura Digital) = **necessidade
curricular mandatória, não atendida, com orçamento** — um presente de timing e argumento de *compliance*
para escolas privadas.
- **Construir:** micro-trilha de **letramento em IA / avaliação crítica da IA** ("verifique a IA":
  detectar alucinação, checar fontes) — ~50% da Gen Z pontua mal em avaliar limites da IA. Nosso tutor,
  que mostra as fontes BNCC e convida o aluno a conferir, **ensina "não colar" pelo exemplo**. Alinhado a
  UNESCO AI Competency Framework + referencial MEC 2026. Prompting fica como sub-skill menor (verificação > prompt-craft).

### G. Engajamento sem patologia (SDT)
- **Temos:** moedas de aprendizagem, streak com freeze, badges de maestria, leaderboard por instituição opt-out.
- **Gap:** a gamificação move autonomia/relacionamento mas **quase não move competência** — e leaderboard
  absoluto pode *prejudicar* (especialmente meninas e quem não valoriza competição).
- **Construir/ajustar:** investir deliberadamente em **visualizar competência** (anéis de maestria por
  skill, "agora você consegue X", progresso antes→depois) já que a mecânica sozinha não constrói isso ·
  social **opt-in, local/relativo ou cooperativo** (não ranking global absoluto) com saída fácil · streak
  como *ferramenta de hábito reversível*, nunca dívida · recompensas **informacionais** (marcam maestria),
  não **controladoras**. Desenhar para a **semana 5**, não a semana 1 (efeito novidade decai ~4 semanas).

### Top features a considerar (priorizadas — recorte da pesquisa)
| # | Feature | Evidência | Fit moat/guardrail | Complexidade |
|---|---|---|---|---|
| 1 | Tutor Socrático conversacional + escada de dicas com atrito no revelar | **Alta** (Harvard ~2×/h) | Núcleo da tese | Média |
| 2 | Calibração de confiança + gap self/actual | **Alta** (causal, CHI 2025) | Nativo do moat; anti-cola | Média |
| 3 | Scaffolds de SRL (reflexão, meta, planejador) | **Alta** (antídoto à preguiça metacognitiva) | Antídoto à dependência | Baixa-Média |
| 4 | Experiência do responsável (digest + "o que fazer" + previsão de prontidão) | Média (demanda forte) | Monetiza o moat | Média |
| 5 | "Mostre seu trabalho" (foto/manuscrito coach do passo) | Média-Alta | Inverte vetor de cola | Alta |
| 6 | Grafo de conhecimento BNCC → progressão travada por maestria | Média-Alta | *É* o moat | Alta |
| 7 | Correção rubric-bound de resposta aberta (formativa, humano decide) | Média-Alta | Forte (só formativo) | Média |
| 8 | Streaming + estados de latência/refusal calmos | Média (percepção +40%) | UX de confiança | Baixa-Média |
| 9 | Micro-trilha de letramento/verificação de IA (BNCC Computação 2026) | Média (mandato) | Compliance; "não colar" por exemplo | Média |
| 10 | Anéis de maestria / "agora você consegue X" (competência visível) | Média-Alta | Retenção intrínseca | Baixa-Média |
| 11 | Tipos interativos/manipuláveis (biblioteca de exploráveis) | Média | Engajamento sem extrínseco | Alta |
| 12 | Anti-cola arquitetural (flag de paste externo + moderação) | Média | Arquitetural, não teatro | Média |

**Recorte de MVP recomendado (semanas, não trimestres):** **#1 + #2 + #3 + #8** — tutor Socrático +
calibração/gap + scaffolds de SRL + streaming. É o menor conjunto que (a) tem a evidência causal mais
forte, (b) é 100% nativo do moat, (c) é defensavelmente "não colar" e (d) é shippável em complexidade
baixa-média sobre o que já existe.

---

## 18.4 Padrões de Design (o sistema visual)

### D1. Sistema de design tokenizado, semântico, multi-camada
Referência: **Wonder Blocks** (Khan Academy) — tokens em três domínios (Core → Semânticos → Componente),
com uma "escala de intensidade" acessível por conceito. Mapear ao BearMinds:
- **Tokens base** (rampa CYBERSPHERE: Preto Neural `#1e1e1e`, Verde Ascensão `#28d600`, canvas `#f5f5f5`).
- **Tokens semânticos** (`--surface-calm`, `--accent-progress`, `--state-mastered`/`--state-reviewing`/
  `--state-new`) — cor por *propósito*, não por hex.
- **Skins de banda** (`8-10`, `11-14`, `15-18`) remapeiam **só** um pequeno conjunto de tokens
  expressivos, e **só dentro da Aula**. O shell fica fixo. (Já é a arquitetura atual — formalizar os
  tokens semânticos é o próximo passo.)

### D2. Tipografia para legibilidade & dislexia
Evidência (British Dyslexia Association, revisada 2024): **nenhuma fonte especializada (ex. OpenDyslexic)
supera uma sans-serif bem desenhada.** O que importa é **espaçamento, tamanho, contraste e medida de
linha**. Nosso par **Plus Jakarta Sans + Poppins** é adequado (boa altura-x, aberturas abertas).
- **Construir:** tokens de espaçamento/medida — linha de **~50–75 caracteres**, entrelinha ~1,5–1,6,
  **alinhado à esquerda** (nunca justificado); **modo de leitura** com espaçamento aumentado (toggle),
  *não* troca de fonte. Nunca dimensionar botões/labels pela string EN (PT-BR +30%).

### D3. Cor, contraste, elevação, movimento — "calmo"
Tema claro com acento restrito (nossa regra: **verde só preenchimento/regra, nunca texto no branco**) está
alinhado à evidência. Escala de espaçamento 4/8px, **elevação baixa e suave** (calmo ≠ sombra pesada),
**movimento como feedback, não decoração** (150–250ms, sempre sob `prefers-reduced-motion`). Nortes:
Brilliant (um conceito por tela) e Apple Books (calma tipográfica) para a Aula; Google Classroom
(denso, legível, "chato de propósito") para a superfície admin/responsável.

### D4. Design por banda etária (capacidade, não estética)
- **6–7 (edge):** pré/início de leitura → **narração/voz + ícones**, sem fluxos que dependam de digitar;
  alvos ~2cm, gestos grossos (tocar/arrastar), instruções explícitas.
- **8–10:** leitura lenta/literal → uma ação primária por tela, **ícone + rótulo** (nunca só ícone),
  alvos grandes, erros perdoadores, tom lúdico. É onde o skin infantil rende mais.
- **11–14:** zona de transição → mais maduro que 8–10, mais simples que adulto; **mais autonomia**
  (trilha, avatar, meta) com scaffolding disponível, não forçado.
- **15–18:** quase-adulto → densidade adulta, paleta madura, **mínimo hand-holding**; NN/g desmente o
  mito do "teen quer piscante" — eles *desconfiam* de excesso de glitz. Não infantilizar.
- **Mecanismo anti-infantilização (a regra-mãe):** **shell calmo e neutro + skins confinados à Aula**
  (já temos) + um **controle de "maturidade/intensidade"** por usuário (mascote, celebração, tom, avatar)
  que o teen abaixa e a criança deixa rico — **autonomia como alavanca**, não nosso palpite.

### D5. Calm technology (é um app de estudar horas)
- **Nada infinito:** unidades finitas com fim claro; sem autoplay-next, sem scroll infinito; pontos de
  saída suaves.
- **Modo foco:** esconde chrome de gamificação/notificações/social durante a lição; XP/streak só nos
  limites naturais (fim de sessão), nunca no meio da tarefa.
- **Defaults saudáveis:** meta diária modesta por padrão (mas escolhível, estilo Duolingo); avisos de
  pausa em sessões longas; sem timers-surpresa (ou timers ajustáveis — WCAG 2.2.1).
- **Redução de ansiedade:** layouts previsíveis, feedback de erro não punitivo (nada de vermelho pesado),
  estados perdoadores.

---

## 18.5 Padrões de UX

### U1. Interação com o tutor de IA
Socrático por padrão; **atrito no "revelar"**; **botões estruturados > chat aberto** (menor latência,
melhor para 6–14); **mostrar fontes/grounding** ("com base na Lição 3.2") como sinal de confiança e
fronteira de escopo; **streaming** + estado "pensando" calmo + interromper; **refusal/out-of-corpus**
caloroso e acionável em PT. (Detalhe de features em 18.3-B.)

### U2. Gamificação SDT (autonomia / competência / relacionamento)
- **Competência** (o problema difícil): anéis de maestria, "agora você consegue X", progresso antes→depois,
  dificuldade adaptativa que sobe com o aluno.
- **Autonomia:** escolher tópico, definir a própria meta, avatar/skin, opt-in social. **Escolha é a
  alavanca mais forte** da literatura.
- **Relacionamento sem toxicidade:** leaderboard **opt-in, relativo/local ou cooperativo**, com exclusão
  fácil. Nunca ranking global absoluto (prejudica os de baixo e as meninas).
- **Streak sem patologia:** freeze/perdão por padrão, sem cópia de culpa, "a vida acontece"; streak nunca
  é a métrica primária de progresso.
- **Moedas/badges sem overjustification:** recompensa **informacional** (marca maestria), não controladora;
  nunca pay-to-win, nunca atrelada a dinheiro real da criança (LGPD/ECA).

### U3. Onboarding & formação de hábito (o "Hook" ético)
- **Primeira sessão entrega valor real** (um "aprendi/fiz algo") em 24–48h — o job do onboarding é
  *compromisso*, não tour. **Empty states ensinam a próxima ação** e mostram a recompensa.
- **Hook ético:** gatilhos gentis e puláveis, recompensa informacional/celebratória, "investimento" =
  progresso real de aprendizagem (nunca custo afundado manipulador). Barra mais alta por serem crianças.
- **Onboarding progressivo por banda:** 8–10 recebe primeira lição narrada e guiada; 15–18 recebe
  "pula o tour, escolhe a matéria, vai".

### U4. Mobile / PWA
- **Instalável** (prompt *após* o primeiro valor, não no cold; no iOS a instalação é a porta para
  qualquer notificação). **Offline** (App Shell + cache; sincroniza progresso ao reconectar).
- **Bottom nav no app do aluno** (75% da interação é polegar; zona de alcance é a base) — sidebar/top
  só na superfície densa do responsável/admin. Ações destrutivas nos cantos difíceis.
- **Notificações sem push** (limite iOS + CSP estrito, sem SDK terceiro): superfícies in-app "enquanto
  você esteve fora", lembrete via **canal do responsável** (e-mail/painel), widget de streak na home.
  On-brand com o design calmo (sem interrupção).
- **Orçamento de performance:** Core Web Vitals — **LCP < 2,5s, INP < 200ms, CLS < 0,1** (INP é o mais
  reprovado em 2025–26). Budget de JS/peso imposto no CI; agressivo para Android médio usado por horas.

### U5. Acessibilidade (WCAG 2.2 AA + neurodiversidade + PT)
Checklist operacional (adotar como Definition of Done de toda tela nova):
- Contraste ≥ 4,5:1 texto / ≥ 3:1 UI; **nunca significado só por cor** (certo/errado, estado de skill,
  progresso = ícone + texto + forma); paleta color-blind-safe testada.
- Alvos ≥ 24×24px (mín. WCAG); superfícies infantis ≥ 44–48px com espaçamento generoso.
- `prefers-reduced-motion` honrado; movimento pausável (2.2.2/2.3.3).
- **Timers ajustáveis/removíveis; sem contagem regressiva default** em lição/quiz (2.2.1).
- Autenticação **sem teste de função cognitiva** (2.3.7/3.3.8) — importa no gate do responsável.
- HTML semântico, headings/landmarks, controles rotulados; **live regions** anunciam streaming do tutor e
  atualização de XP/progresso educadamente.
- `lang="pt-BR"` (pronúncia do leitor de tela); **linguagem simples por padrão**; layout sobrevive a
  +30% de string PT sem truncar; texto redimensionável a 200%; **modo foco/redução de distração**.

### U6. Confiança & segurança (LGPD art. 14 como diferencial visível)
- Consentimento parental **específico e em destaque** (não enterrado, não pré-marcado) — passo de
  onboarding de primeira classe. Modelo de idade que lida com consentimento parental (<16) *e* consentimento
  próprio do adolescente (16–18).
- **Aviso para a criança** em forma acessível (ilustrado/narrado), separado do **aviso legal do pai**.
- **Painel de privacidade em PT plano:** o que é coletado, por quê, exportar, excluir (art. 18).
- **"Por que estou vendo isto?"** em qualquer recomendação/nudge da IA. **Minimização de dados como
  argumento de venda** exibido na UI (nosso "zero SDK de terceiros" é diferencial real).

---

## 18.6 As apostas de "próxima geração" (o que nos torna inovadores)

Seis assinaturas que, combinadas, ninguém entrega hoje para o estudante brasileiro — e todas puxam do
moat (corpus BNCC verificado + dados longitudinais de maestria):

1. **O tutor que se recusa a colar** — Socrático, grounded, com "mostre seu trabalho" que transforma o
   vetor de cola (foto-resolve) em coaching de raciocínio. *É a única configuração com evidência causal positiva.*
2. **O espelho metacognitivo** — calibração de confiança + gap self/actual. Cura documentada da
   dependência de IA, movida pelo dado que só nós temos.
3. **A previsão de prontidão que o pai paga para ver** — prontidão por competência BNCC + correlação
   predito×real honesta = confiança + dataset de eficácia.
4. **Maestria durável, não pontos** — grafo BNCC + FSRS + progressão travada por maestria real; "agora
   você consegue X" no lugar de volume de XP.
5. **Compliance como feature** — BNCC Computação 2026 + letramento de IA "verifique a IA" ensinado pelo
   exemplo (o tutor mostra as fontes).
6. **Calmo por design, acessível por construção, brasileiro por dentro** — anti-attention-economy,
   WCAG 2.2 AA, PT-nativo com linguagem simples, offline-first — num mercado onde os concorrentes são
   EN-first, genéricos, ou barulhentos.

---

## 18.7 Recomendação de sequenciamento (encaixe no roadmap)

Sem quebrar as ondas já planejadas (spec 11). Cada onda entrega valor isolado e é *gated by metrics*.

- **Onda N (MVP de próxima geração — semanas):** tutor Socrático conversacional (18.3-B1) + calibração de
  confiança + gap self/actual (18.3-A1/A2) + scaffolds de SRL (18.3-A3) + streaming/estados calmos
  (18.3-B3). Fecha spec 17 (P5c: auto-avaliação, Readiness 2.0) com a ciência mais forte primeiro.
- **Onda N+1 (responsável como produto):** digest semanal + "o que fazer esta semana" + previsão de
  prontidão por competência + correlação pós-prova (18.3-C). Puxa o gate D90 de disposição a pagar.
- **Onda N+2 (profundidade da Aula):** "mostre seu trabalho" multimodal (escopo LGPD dedicado) +
  biblioteca de exploráveis manipuláveis + micro-trilha de letramento de IA (18.3-B2/B4/F).
- **Onda N+3 (estrutura & competência visível):** grafo de conhecimento BNCC + anéis de maestria +
  correção rubric-bound formativa (18.3-D/E/G). Onda de fundação, mais pesada.
- **Transversal, toda tela nova:** tokens semânticos (D1), checklist de acessibilidade U5 como DoD,
  padrões de UX U1–U6, orçamento de Core Web Vitals no CI, controle de maturidade/intensidade.

**Anti-metas (o que a pesquisa manda NÃO fazer):** ranking global absoluto; streak de aversão à perda como
loop primário; badges/pontos por atividade crua; DKT exposto como número ao pai/aluno; correção somativa
automática por IA; lockdown de navegador; qualquer push interruptivo; troca de fonte "para dislexia".

---

## 18.8 Não-negociáveis preservados
Grounding-only + recusa (05.3), answer-withholding, cache-integrity, explorável sandboxed (CSP
`default-src 'none'`), LGPD parent-fronted com consentimento separável/revogável e minimização, zero SDK
de terceiros, moat = corpus + maestria (LLM é commodity alugada), métricas que importam (D7/D30 + ganho
de maestria). **Toda feature deste documento passa pelo teste único:** *mantém o aluno fazendo o esforço?*

---

## Fontes (pesquisa 2025–2026 da CS AI Strategy squad)

**Pedagogia / tutoria de IA / metacognição**
- Kestin et al. (Harvard, *Scientific Reports*, 2025) — AI tutoring ~2× learning/hour: https://www.nature.com/articles/s41598-025-97652-6
- "Faster Completion, Less Learning" (arXiv 2605.21629) · Fan et al. "Metacognitive laziness" (BJET): https://bera-journals.onlinelibrary.wiley.com/doi/epdf/10.1111/bjet.13544 · Metacognitive Laziness Scale (SAGE 2026): https://journals.sagepub.com/doi/10.1177/20965311261450994
- Calibração metacognitiva (CHI 2025): https://dl.acm.org/doi/full/10.1145/3706598.3713960 · "The cognitive mirror" (Frontiers 2025): https://www.frontiersin.org/journals/education/articles/10.3389/feduc.2025.1697554/full · Suporte metacognitivo em GenAI (BJET, Xu 2025): https://bera-journals.onlinelibrary.wiley.com/doi/10.1111/bjet.13599
- Khanmigo — dados de 1 ano / 68% preferência Socrático: https://edrus.org/khan-academys-khanmigo-after-one-year-what-the-data-actually-shows-about-ai-tutoring-in-schools/

**Adaptação / avaliação / anti-cola**
- Squirrel AI (grafo de conhecimento; TIME Best Inventions 2025): https://time.com/collections/best-inventions-2025/7318298/squirrel-ai-intelligent-adaptive-learning-system/ · Revisão sistemática de DKT: https://www.preprints.org/manuscript/202510.1845
- Correção rubric-bound (RubiSCoT, arXiv 2510.17309; CoTAL, arXiv 2504.02323): https://arxiv.org/html/2510.17309v1 · "Mostre seu trabalho" multimodal (MMTutorBench, arXiv 2510.23477): https://arxiv.org/html/2510.23477
- Retrieval practice (Frontiers 2025): https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2025.1632206/full

**Gamificação / SDT / streaks / leaderboards**
- Gamificação & SDT — autonomia/relacionamento, competência mínima (Springer ETR&D 2024): https://link.springer.com/article/10.1007/s11423-023-10337-7 · Leaderboards em educação (JCAL 2024): https://onlinelibrary.wiley.com/doi/10.1111/jcal.13077 · Leaderboards e engajamento de meninas (2025): https://link.springer.com/article/10.1007/s12528-025-09438-4
- Streak Duolingo (freeze / retenção): https://medium.com/@salamprem49/duolingo-streak-system-detailed-breakdown-design-flow-886f591c953f

**Design / UX / acessibilidade / PWA**
- NN/g UX for Children / Teens / physical & cognitive development: https://www.nngroup.com/reports/children-on-the-web/ · https://www.nngroup.com/reports/teenagers-on-the-web/ · https://www.nngroup.com/articles/kids-cognition/
- Wonder Blocks / sistema de cor Khan Academy: https://www.designsystems.com/about-wonder-blocks-khan-academys-design-system-and-the-story-behind-it/ · https://blog.khanacademy.org/how-we-rebuilt-khan-academys-color-system-from-the-ground-up/
- Dislexia — espaçamento > fonte (PMC): https://pmc.ncbi.nlm.nih.gov/articles/PMC7188700/ · Localização PT-BR (+30%): https://techinbrazil.com/localizing-your-software-or-application-for-brazil
- Calm Tech Institute: https://www.calmtech.institute/calm-tech-principles · Designing Calm (UXmatters 2025): https://www.uxmatters.com/mt/archives/2025/05/designing-calm-ux-principles-for-reducing-users-anxiety.php
- WCAG 2.2: https://www.w3.org/TR/WCAG22/ · Critérios para neurodivergentes: https://www.pivotalaccessibility.com/2025/03/essential-wcag-2-2-success-criteria-for-neurodiverse-users/
- Streaming/latência (percepção +40%): https://thefrontkit.com/blogs/what-is-streaming-ui-in-ai-applications · PWA iOS 2026: https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide · Thumb zone: https://www.junoschool.org/article/thumb-zone-design-one-handed-use/ · Core Web Vitals 2026: https://www.digitalapplied.com/blog/core-web-vitals-2026-inp-lcp-cls-optimization-guide

**LGPD / Brasil / competição**
- LGPD Art. 14 (dados de crianças): https://lgpd-brasil.info/capitulo_02/artigo_14 · InternetLab (consentimento parental): https://revista.internetlab.org.br/lei-geral-de-protecao-de-dados-e-a-tutela-dos-dados-pessoais-de-criancas-e-adolescentes-a-efetividade-do-consentimento-dos-pais-ou-responsaveis-legais/
- BNCC Computação obrigatória 2026 (Fundação Lemann): https://fundacaolemann.org.br/noticias/bncc-computacao/ · Undime: https://undime.org.br/noticia/25-10-2025-02-51-o-que-e-preciso-saber-sobre-a-implementacao-da-bncc-computacao-e-integracao-curricular-de-educacao-digital-e-midiatica
- AI literacy como competência-núcleo (WEF 2025): https://www.weforum.org/stories/2025/05/why-ai-literacy-is-now-a-core-competency-in-education/
- Concorrentes BR: Jovens Gênios (BNCC + IA 2026): https://www.jovensgenios.com/post/bncc-computa%C3%A7%C3%A3o-e-intelig%C3%AAncia-artificial-o-que-muda-a-partir-de-2026 · Geekie: https://www.geekie.com.br/ · Letrus: https://www.letrus.com/
