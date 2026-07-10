# 19 · Visão de Próxima Geração — Fronteira II: Afeto, Voz, Pares, Professor, Eficácia & Ciclo de Vida (v1.0 · 2026-07-10)

> **Documento de pesquisa e visão, não spec de implementação.** É a **Parte II** do [spec 18](18-next-gen-vision.md):
> aprofunda seis frentes que o 18 reconheceu mas não detalhou — **(A) afeto/ansiedade/motivação,
> (B) voz & multimodal, (C) aprendizagem entre pares segura, (D) copiloto do professor & autoria em escala,
> (E) learning analytics & dataset de eficácia, (F) retenção/ciclo de vida & hábito ético.** Onde o 18
> estabeleceu a âncora e o mapa de features, o 19 traz a evidência 2025–2026 e as implicações concretas de
> cada fronteira. Não substitui o 18; encaixa nele.
>
> **Fontes:** seis rodadas de pesquisa fresca 2025–2026 encomendadas à **CS AI Strategy squad** para este
> documento (uma por frente), somadas ao pacote de estratégia que embasou a plataforma. Evidências e links
> ao final. Onde esta visão conflitar com specs anteriores, ela **propõe** — a decisão de escopo/ordem
> continua sendo do owner e vira spec numerado quando aprovada.
>
> **Regra de ouro (inalterada):** nada aqui enfraquece os guardrails do spec 05 (grounding-only,
> answer-withholding, cache-integrity) nem os itens de LGPD do spec 09. Teste único de toda feature:
> **mantém o estudante fazendo o esforço cognitivo?** ("aprender, não colar").

---

## 19.0 O que mudou desde o spec 18 (leia primeiro): a moldura regulatória endureceu

Duas leis de 2025 reescrevem o que é *permitido*, não só o que é *bom*, num produto para menores — e ambas
**favorecem** o nosso posicionamento (zero SDK de terceiros, on-device, parent-fronted):

- **EU AI Act — proibição de inferência de emoção em educação (em vigor fev/2025):** sistemas que inferem
  emoção de estudantes em contexto educacional entram na categoria de **risco inaceitável**. É referência
  global; molda expectativa de investidor, escola e imprensa mesmo fora da UE.
- **Estatuto Digital da Criança e do Adolescente (Brasil, Lei sancionada em 17/set/2025):** deveres
  proativos de proteção sobre os provedores, **distinção &lt;12 vs 12–18**, **consentimento parental antes
  do tratamento** para a faixa mais nova, e restrição explícita a análise de emoção de menores. Soma-se ao
  **LGPD art. 14** ("melhor interesse") e ao **Enunciado CD/ANPD nº 1** — e a ANPD colocou **dados de
  crianças + edtech como prioridade de fiscalização 2024–2025**.

**Consequência de produto (transversal a tudo abaixo):** qualquer sinal afetivo/comportamental do estudante
é **interpretável, on-device, computa-e-descarta**, usado só para *oferecer ajuda*, nunca para pontuar,
ranquear, perfilar ou reportar ao pai como "emoção". Câmera/microfone/biometria para ler emoção de menor
está fora de questão. Nosso "zero SDK" deixa de ser só higiene: é **compliance por construção** e argumento
de venda.

---

## 19.1 As seis fronteiras (evidência → construir → fit)

Cada frente segue o padrão do 18: **Evidência · Construir · Fit (guardrail/LGPD/moat) · Não-fazer.**

### A. Afeto, ansiedade & motivação — a ansiedade de matemática é o problema brasileiro
**Evidência.** O *mindset de crescimento* esfriou: as revisões mais rigorosas de 2025 acham efeito ~zero no
geral, com ganho **só em alunos de baixo desempenho sob alta fidelidade** — é um *estilo de feedback*, não
uma feature-manchete. O que é acionável e forte: **73% dos jovens de 15 anos no Brasil estão abaixo do
nível 2 de matemática no PISA 2022** (média OCDE 31%), e a ansiedade de matemática deprime *e* é deprimida
pelo desempenho. A tríade com melhor suporte — **(1) reenquadrar erro como informação, (2) recuperação de
baixo risco/re-tentável (retrieval practice), (3) pausa breve de auto-regulação** antes de tarefa pesada —
é *idêntica* ao mecanismo anti-cola de scaffolding. SDT fecha a tese: recompensar o trabalho feito pelo
próprio aluno **satisfaz a necessidade de competência** — motivação e "não colar" são o *mesmo* objetivo de
design; pontos/streaks/moedas controladores arriscam o **efeito de sobrejustificação** (extrínseco expulsa
intrínseco).

**Construir.**
1. **Erro como informação, nunca punição:** resposta errada → "o que sua resposta nos diz" + escada de
   dica, jamais X vermelho + resposta certa. É o guardrail anti-cola *tornado visível*.
2. **Prática de baixo risco por padrão:** todo item re-tentável, sem nota/rank, barra de maestria correndo.
   Retrieval reduz a interferência da ansiedade *e* é o aluno fazendo o esforço.
3. **Nudge de pausa de ~20s** (respiração) opcional antes de tarefa marcada como difícil; auto-iniciado,
   não registra nada sensível.
4. **Mindset como *estilo de feedback* dirigido** (elogio de estratégia/processo) preferencialmente a quem
   está travando — nunca pop-up motivacional avulso, nunca KPI de manchete.
5. **Detecção de dificuldade por sinal de interação, on-device** (pausas longas, tentativas repetidas,
   apagar-e-refazer) → só *oferece* ajuda (dica/pausa/item mais fácil). Nunca "score de emoção", nunca
   mostrado ao pai.

**Fit.** Guardrail: *central* (scaffolding dispara exatamente onde o aluno colaria). LGPD: computa-e-descarta,
sem rótulo afetivo persistido — dentro do EU AI Act + Estatuto Digital. Moat: neutro/ativos existentes.

**Não-fazer.** Câmera/mic/biometria de emoção; persistir/exportar rótulo afetivo; "seu filho ficou frustrado"
ao pai; pop-up de mindset como feature; X-vermelho-mais-resposta; streak/moeda por acerto cru;
engajamento/tempo-no-app como métrica de sucesso.

### B. Voz & multimodal — a decisão técnica é on-device Whisper (WASM)
**Evidência.** Agentes conversacionais de leitura *dialógica* (que fazem o aluno *falar*, não que leem para
ele) igualaram pais em ganho de compreensão/vocabulário num RCT 2025 — o ganho vem do **produzir fala**, não
do áudio. Voz é sobretudo **rampa de acesso** para 6–10 e para os ~49,5% abaixo da proficiência de leitura.
**Restrição decisiva:** a Web Speech API **não funciona em PWA instalado no iOS** (só na aba Safari) *e*
manda o áudio do menor para Google/Apple — inviável por LGPD/Estatuto. Caminho real e privado: **Whisper
on-device via WebAssembly** (`tiny`/`base` PT-BR), áudio nunca sai do aparelho; viabilidade em edge já
demonstrada (Whisper `tiny` rodando em Raspberry Pi, ~16% WER). `getUserMedia` (captura de mic) **funciona**
em PWA iOS após gesto do usuário — alimenta o WASM localmente.

**Construir.**
1. **Whisper on-device (WASM, PT-BR) como caminho de mic padrão**, cloud-ASR só opt-in com consentimento
   parental. Transcreve local, **guarda o texto, descarta o áudio**.
2. **Voz como *entrada* para quem trava no teclado** (6–10 e baixa leitura) — e a IA **elicia fala**
   (Socrático falado: "me explica como você pensou"), nunca *entrega* passo por áudio.
3. **Áudio sempre pareado a texto sincronizado na tela** (destaque karaokê): ouvir também treina leitura.
4. **"Mostre seu trabalho" por foto/manuscrito** como *intake do processo* — foto dos **próprios passos** do
   aluno; a IA critica o **raciocínio**, nunca emite a resposta (inverte o vetor de cola do photo-solver).
   Preferir não subir imagem; se inevitável, subir só o texto/LaTeX derivado, efêmero, sem rosto/nome.
5. **TTS read-aloud com destaque palavra-a-palavra** como default de acessibilidade para leitores jovens/
   com dificuldade — *compensatório*, saída-só, on-device quando possível.
6. **Sempre confirmar a transcrição** antes de avaliar (WER de fala infantil é alto): mostra o texto para o
   aluno corrigir.

**Fit.** Guardrail: forte (voz que *elicia*, não entrega). LGPD: on-device, sem áudio a terceiros — casa com
CSP estrito + zero SDK; planejar headers `COOP`/`COEP` + `wasm-unsafe-eval`/nonce para threads WASM.
Moat: acessibilidade amplia o público (baixa leitura).

**Não-fazer.** TTS que **lê a resposta** (vetor de cola por áudio); Web Speech/cloud-ASR de menor;
photo-solver "foto→resposta"; persistir/subir áudio/foto crus; fluxo *só-voz* (exclui casa barulhenta e
quem prefere texto); ditado longo avaliado às cegas; latência de voz com >1s de silêncio (lê como "caiu a
ligação" — use pista "pensando").

### C. Aprendizagem entre pares — *segura por construção*: "Ensine o Bear"
**Evidência.** Colaboração/pares funciona com magnitude pequena-a-moderada (cooperativo d≈0,3–0,5;
**ensino recíproco d≈0,74**), e o mecanismo mais durável é **aprender ensinando (efeito protégé)** — maior
ganho justamente para os de **baixo desempenho** (a nossa história de equidade). Réplicas 2025 com um "aluno
IA" que erra de propósito: quem **diagnostica o erro do agente** ganha ~0,72 ponto (1–6) e projeta reprovação
28%→8%. Mas colaboração **falha sem responsabilidade individual** (efeito carona). E toda plataforma séria
para menores (Synthesis, Khan) **remove o canal livre de texto criança↔criança** — captura-se quase todo o
valor com *explicação* e *crítica de raciocínio*, sem chat social.

**Construir (as três formas *limitadas* e seguras).**
1. **"Ensine o Bear" (ensinar um protégé de IA) — feature-bandeira:** o aluno ensina um "colega" IA
   deliberadamente confuso; captura o efeito protégé com **zero exposição criança↔criança**. É a forma mais
   pura de "aprender ensinando" = "aprender, não colar".
2. **Revisão entre pares *assíncrona, anonimizada, do raciocínio*** — critica o **método/explicação** do
   colega por *chips de rubrica* ("clareza", "passo faltando"), nunca DM livre; **envie-antes-de-ver** a
   própria solução; **tudo passa por moderação IA + fila de denúncia** antes de ficar visível.
3. **Galeria de raciocínios / exemplares** anonimizados e curados (explicações exemplares, **não** respostas
   finais) para estudar e avaliar — read-only, puro aprendizado generativo. (Encaixa nos "exemplares de
   pares" do spec 17, deslocando o artefato de *resposta* para *raciocínio*.)
4. **"Aprender em família" / "meu filho me ensinou":** o pai/irmão co-resolve por template guiado — o
   **pagante** é o colaborador, some o risco criança↔desconhecido.

**Recomendação sobre a tensão central:** **NÃO** adicionar DM/Q&A aberto criança↔criança. O ganho de
colaboração é quase todo capturável por *substitutos de par* e superfícies *escopo-de-conteúdo*, sem o risco
de aliciamento/bullying/vazamento-de-resposta/LGPD. Mantém-se o piso atual (sem DM aluno↔aluno, apelido-only,
denúncia) e adiciona-se pares só nas 3 formas acima. Responsabilidade individual em toda superfície (a
explicação de cada aluno é registrada) — anti-carona e sinal auditável de "fez o esforço".

**Fit.** Guardrail: reforça (critica raciocínio, nunca troca resposta). LGPD/ECA: dentro do "melhor
interesse", sem canal de comunicação aberto, artefato pseudônimo sem série/cidade/contato. Moat: neutro.

**Não-fazer.** DM/Q&A aberto aluno↔aluno; expor resposta final de par (só depois do próprio envio, e só
raciocínio); score de *grupo* sem responsabilidade individual; perfil de menor descobrível; conteúdo de par
sem moderação; coletar grafo social além do artefato pseudônimo.

### D. Copiloto do professor & autoria em escala — o modelo de referência é o **Aila** (Oak)
**Evidência.** Professores que usam IA semanalmente economizam **~5,9 h/semana (~6 semanas/ano)**
(Walton/Gallup), reinvestidas em feedback/diferenciação — mas a adoção é fina (32% semanal) e o modo de falha
é o **viés de automação** (saída plausível-mas-errada passa batido). O **Aila** (Oak National Academy) é a
implementação de referência: geração **RAG sobre conteúdo aprovado** + detecção de ameaça na entrada +
**agente de moderação independente** + **revisão obrigatória do professor**, validado em **10.000+ lições**.
Itens gerados por IA podem igualar especialistas em psicometria; um **modelo "semáforo"** (publicar /
revisar / rejeitar, com confiança de alinhamento) auto-certifica parte e roteia o resto ao humano. Sobre
analytics: professores **confiam em resumos ancorados no dado** mas **desconfiam de sugestão prescritiva**
que extrapola o dado (LearnLens/CADA) — e não predizem bem os erros comuns da própria turma, então o
dashboard de fato **agrega informação**.

**Construir.**
1. **Copiloto = acelerador de rascunho** nos quatro trabalhos de maior retorno (preparo de aula,
   diferenciação, rascunho de item, rascunho de feedback) — **nunca** corretor autônomo. Passo de **diff/
   edição obrigatório** antes de chegar ao aluno; **taxa de edição** vira sinal de qualidade.
2. **Semáforo de sign-off:** rascunho alto-confiança/baixo-risco = aprovar em 1 clique; baixa-confiança ou
   tema sensível = revisão detalhada forçada; tóxico/fora-do-currículo = bloqueado. **Nunca auto-publicar.**
3. **Dashboard de equívocos da turma:** distratores **tagueados por equívoco + habilidade BNCC**; rollup
   "62% da turma confundiu média com mediana em EF07MA35". **Descritivo, não prescritivo** — remediação é
   opção que o professor dispara, nunca empurrada. Professor confirma/rejeita o equívoco (treina a tagging).
4. **Autoria RAG-sobre-corpus-BNCC-verificado como único caminho de geração**; todo rascunho carrega
   **proveniência + score de alinhamento BNCC + versão** (rascunho IA → edição do professor → aprovado vN).
5. **Superfície "chata de propósito"** (padrão Google Classroom): uma ação primária por tela, aprovar em 1
   clique, rápida no teclado, tolerante a mobile; **trust chip** em todo artefato ("rascunho de IA — precisa
   do seu sign-off", fonte, código BNCC, confiança).
6. **Métrica de tempo-economizado por professor** exibida ao professor *e* ao admin comprador — é o
   argumento de adoção/renovação B2B2C. Posicionar a cunha como **"compliance BNCC na caixa"** com
   **BNCC Computação 2026** (inclui desplugado) e **dashboard de cobertura** (o artefato que o coordenador
   mostra ao auditor; não-cumprimento arrisca Fundeb/VAAR).

**Fit.** Guardrail: sign-off humano sempre, IA nunca dá nota. Moat: cada rascunho aprovado + cada equívoco
confirmado **enriquece o corpus** e é o diferencial que nenhum LLM alugado reproduz.

**Não-fazer.** Auto-publicar conteúdo IA sem sign-off; nota atribuída por IA; comando prescritivo "faça isto"
como autoridade; geração *não-ancorada* no corpus BNCC; botão "aprovar tudo" (recria viés de automação);
edição sem versão/proveniência; superfície de professor sobre-carregada (fricção mata adoção); tratar o LLM
como o moat.

### E. Learning analytics & dataset de eficácia — a eficácia *provada* é moat sub-ofertado
**Evidência.** Só ~¼ das ferramentas edtech mais usadas tem *qualquer* pesquisa de impacto positivo — o
mercado 2025–26 migrou de "dashboard de engajamento" para **eficácia provada**. As **quatro faixas ESSA** são
a língua franca de compra: Tier 1 = RCT; Tier 2 = quase-experimento; Tier 3 = correlacional controlando
seleção; Tier 4 = **modelo lógico + estudo planejado**. RCT é caro/lento para startup; caminho realista =
**começar no Tier 4, depois dose-resposta** (mais uso → melhor resultado); um quase-experimento bem-feito é
"Efficacy Silver" (framework 5Es, Nature 2025). **Desenho centrado em evidência (ECD):** Competência (o que
mede) → Evidência (comportamentos que revelam) → Tarefa (atividades que emitem) — permite inferir maestria da
atividade comum, sem ansiedade de prova. Sobre padrões: **xAPI e Caliper são complementares**; Caliper é para
agregação institucional multi-vendor (overkill para um PWA parent-paid). Armadilhas: **Goodhart** (métrica
mostrada vira alvo e deixa de medir), e **Deep Knowledge Tracing** tem patologias documentadas ("wavy
transitions"; maestria *cai* após acerto) — número neural opaco mostrado ao usuário é inacionável e não
confiável.

**Construir.**
1. **Medir quatro sinais duráveis por knowledge-atom** (não um score): (a) **recall atrasado** nos
   intervalos do FSRS, (b) **transferência** (mesmo atom em template/contexto novo), (c) **calibração**
   (confiança × acerto — barato e alto valor), (d) **tempo-de-tarefa produtivo** (hesitação/edição/retry,
   não minutos crus).
2. **Adotar o *formato* do xAPI** (actor-verb-object-context com IDs de atom BNCC) como vocabulário interno
   de eventos — prepara um export para escola — mas **pular certificação Caliper/LMS** por ora.
3. **Formalizar uma regra de evidência escrita por atom** (quais eventos sobem/descem maestria e por quê),
   auditável — a defesa contra "IA que corrige no escuro". Modelo de evidência **interpretável e
   humano-autorado** (FSRS + grafo BNCC); LLM só gera item/dica, **nunca** pontua maestria em silêncio.
4. **Postura de eficácia:** publicar um **modelo lógico** agora = **ESSA Tier 4 imediato** ("nós medimos a
   nossa própria eficácia"); instrumentar o **dose-resposta** (aderência à revisão × ganho de maestria ×
   nota real de prova, desagregado por série/região, **reportando negativos**) para caminhar a Tier 3/Silver.
   A correlação predito×real (já no produto, spec 11) é o embrião disso.
5. **Superfície de transparência de eficácia para o pai:** trajetória de maestria por matéria, curva de
   retenção FSRS, **predito × real com banda de calibração**, "atoms para revisar" — tudo derivado, sem expor
   log bruto.

**Fit.** LGPD: analytics **first-party, self-hosted no VPS** (o event stream *é* o analytics), pseudônimo,
PII segregada, zero SDK — casa com Estatuto Digital (pai é o titular do consentimento). Moat: o dado
longitudinal + regras de evidência explícitas compõem o ativo difícil de copiar; **só reivindicar a faixa que
se tem** ("ajuda a aprender" Tier-4 ≠ "eleva nota X%" Tier-2+).

**Não-fazer.** Signups/DAU/streak como sucesso; certificação Caliper/LMS num PWA parent-paid; qualquer
GA/Firebase/SDK de terceiro sobre dado de menor; mostrar "score de conhecimento" neural opaco; reivindicar
"prova que eleva nota" sem Tier 2+; LLM como pontuador silencioso de maestria; otimizar a mesma métrica que
se mostra ao usuário (Goodhart); inferir traço além do atom.

### F. Retenção, ciclo de vida & hábito ético — dois loops (aluno engaja, **pai renova**)
**Evidência.** O *novelty cliff* é real (~3–4 semanas), e o que sobrevive é a "familiarização" — engajamento
que persiste **só quando há valor pedagógico real**. Apps de educação infantil churnam **~7,4%/mês** (2026);
drivers: **desengajamento da criança 36%, age-out 24%, alternativa escolar grátis 18%, preocupação com tela
14%, custo 8%**. A maior alavanca de renovação é **progresso visível ao pai** (pais que veem progresso têm
**2–3× mais chance de renovar**; cobertura multi-série multiplica LTV **3–5×** ao evitar age-out). Hábito
ético em menor: o "investimento" tem de ser **progresso real de aprendizagem, nunca custo afundado**; um RCT
2025 mostra que crianças têm inibição/gratificação-adiada ainda em formação — **urgência/countdown/autoplay/
recompensa-cintilante são desproporcionalmente manipulativos** para elas. Win-back que funciona: **pedir, não
culpar**; "notei que você sumiu" é documentadamente *inócuo* e desagradável.

**Construir (distinguindo os dois loops).**
1. **[Aluno] Pós-semana-3: virar a superfície de novidade para *competência visível*** — um "agora você
   consegue X" ancorado em objetivos BNCC, não em contagem de streak. Introduzir **capacidade nova (unidade/
   tier), não gimmick novo**, na janela do cliff.
2. **[Aluno] Streak-freeze silencioso e não-punitivo** (preserva competência, não é isca de aversão à
   perda); "investimento" = artefatos de aprendizagem (problemas resolvidos, notas salvas, maestria ganha),
   que também são o gancho de win-back depois.
3. **[Aluno] Vitória de capacidade real na semana 1** (o preditor de retenção); banir schedule de recompensa
   variável, autoplay e urgência na superfície da criança — **codificar como invariante de design**.
4. **[Pai] Digest semanal = instrumento central de renovação:** específico da criança, acionável, mostrando
   **resultado de aprendizagem + alinhamento BNCC/escola + prontidão de prova**, não minutos de vaidade.
   Enfrenta o churn "a escola dá de graça" (18%) enquadrando o valor como **BNCC-nativo, guardrailed,
   aprender-não-colar**.
5. **[Ambos] Escada anti-age-out (6–19) no roadmap** — 24% do churn e multiplicador 3–5× de LTV.
6. **[Ambos] Ciclo de vida pelo *calendário letivo brasileiro*, não pelo streak diário genérico:** temporadas
   por bimestre (sprints pré-prova) + rampa **ENEM/vestibular ago–nov** (ENEM 2026: **8 e 15 de novembro**);
   digest sazonal ("prova do 2º bimestre em X dias — aqui está a prontidão"); **aceitar quedas saudáveis** de
   férias (dez–jan) sem marcá-las como churn.
7. **[Pai] Win-back só no canal do pai (e-mail/painel)**, enquadrado como valor ("o que seu filho dominou por
   último; a próxima vitória está a 10 min"), **nunca** ping de culpa à criança; uma cadência respeitosa,
   opt-out honesto. (Vantagem: já não temos push SDK de terceiro nem push interruptivo — é força, não gap.)
8. **[Ambos] Detecção de risco por *sinal de produto*** (frequência caindo, progressão travada, falha
   repetida num conceito), armazenada ao mínimo, disparando **resgate pedagógico, não anúncio de churn-save**
   ("seu filho travou em frações; aqui vai um caminho mais curto"), roteado pelo digest do pai.

**Fit.** Guardrail/ética: sem loop de aversão à perda, sem slot-machine na criança; intensidade alinhada ao
risco real do aluno, não à urgência fabricada. LGPD: e-mail ao **pai titular do consentimento**; digest
agregado, sem log bruto; risco por minimização, sem perfilamento nem SDK de terceiro sobre a criança.

**Não-fazer.** Streak punitivo/streak-shaming/"você vai perder o XP" numa criança; recompensa variável/
autoplay/cintilância/countdown na superfície do menor; push/culpa dirigido à criança ("sentimos sua falta 😢");
"notei que você não entrou"; escassez/urgência falsa no e-mail do pai; fricção de cancelamento; vaidade
(minutos/streak) como história de renovação; marcar férias/gap de prova como churn; perfilamento
comportamental ou SDK de terceiro sobre dado de criança.

---

## 19.2 Adições ao "Definition of Done" (transversal, toda tela nova)

Somam-se ao checklist do 18 (tokens semânticos, WCAG 2.2 AA, Core Web Vitals, controle de maturidade):

- **Invariante anti-manipulação-infantil:** nenhuma superfície de menor usa recompensa variável, autoplay,
  countdown de urgência, ou aversão à perda. Saída graciosa sempre disponível.
- **Sinal afetivo/comportamental:** on-device, computa-e-descarta, só *oferece ajuda*; proibido persistir
  rótulo de emoção, expor ao pai, ou usar câmera/mic/biometria para inferir emoção (EU AI Act + Estatuto
  Digital).
- **Voz/áudio de menor:** transcrição on-device (WASM), texto guardado, áudio descartado; cloud-ASR só
  opt-in com consentimento; nunca TTS que leia a resposta.
- **Autoria/IA para professor:** RAG-sobre-corpus, proveniência + versão + score BNCC, semáforo de sign-off,
  sem "aprovar tudo", IA nunca dá nota.
- **Analytics:** first-party self-hosted, formato xAPI interno, regra de evidência escrita por atom, nenhum
  número neural opaco mostrado, nenhuma métrica exibida sendo também otimizada (firewall de Goodhart).
- **Consentimento por faixa etária:** modelo &lt;12 (consentimento parental prévio) vs 12–18 (Estatuto Digital)
  refletido na UI de consentimento.

---

## 19.3 Assinaturas de próxima geração (adendo ao 18.6)

Três novas assinaturas que, com as seis do 18.6, ninguém entrega ao estudante brasileiro:

7. **"Ensine o Bear"** — aprender ensinando um protégé de IA que erra de propósito: o efeito pedagógico mais
   durável (protégé), maior para os de baixo desempenho, com **zero** risco de canal criança↔criança.
8. **Voz privada de verdade** — tutoria falada com Whisper on-device: acesso para a criança e para a baixa
   leitura *sem* mandar áudio de menor a ninguém. O contrário do padrão de mercado (cloud-ASR).
9. **Eficácia que se prova sozinha** — modelo lógico público (ESSA Tier 4) + dose-resposta rumo a Silver,
   com transparência predito×real ao pai. Num mercado onde ¼ das ferramentas tem *qualquer* evidência, medir
   a própria eficácia honestamente **é** o moat de confiança e o argumento de compra.

---

## 19.4 Sequenciamento (encaixe no roadmap do spec 11, sem quebrar as ondas do 18.7)

O 18.7 já ordenou tutor Socrático + calibração + SRL + streaming (Onda N), responsável-como-produto (N+1),
profundidade da Aula (N+2), grafo/competência (N+3). O 19 **insere-se** assim:

- **Barato, faz junto com N (baixa complexidade, alto fit):** erro-como-informação + baixo-risco re-tentável
  + nudge de pausa (19.1-A); formato xAPI + regra de evidência por atom + **modelo lógico público ESSA Tier 4**
  (19.1-E); invariantes anti-manipulação-infantil como DoD (19.2).
- **Reforça N+1 (responsável):** digest semanal como **instrumento de renovação** + escada anti-age-out +
  ciclo de vida por calendário letivo BR + win-back só no canal do pai + resgate pedagógico por sinal de
  produto (19.1-F). Puxa direto o gate D90 de disposição a pagar.
- **Encaixa em N+2 (profundidade da Aula):** "Ensine o Bear" (19.1-C1) — bandeira de baixo risco e alto ROI;
  **voz on-device Whisper (WASM)** + "mostre seu trabalho" por foto do próprio passo (19.1-B); galeria de
  raciocínios (19.1-C3, evolui os exemplares do spec 17).
- **Onda B2B2C (cunha 2027, quando o gate abrir):** copiloto do professor com semáforo de sign-off +
  dashboard de equívocos + cobertura BNCC/Computação 2026 (19.1-D). Vende tempo-economizado (bottom-up) +
  compliance (top-down).
- **Fundação, ao lado de N+3:** métricas duráveis (recall atrasado, transferência, calibração) + dose-resposta
  rumo a Tier 3/Silver (19.1-E); revisão entre pares anonimizada do raciocínio (19.1-C2).

---

## 19.5 Anti-metas consolidadas (o que a pesquisa manda NÃO fazer)

Somando-se às anti-metas do 18.7: câmera/mic/biometria de emoção de menor; rótulo afetivo persistido/exposto
ao pai; Web Speech/cloud-ASR de menor; TTS que lê a resposta; photo-solver "foto→resposta"; DM/Q&A aberto
aluno↔aluno; score de grupo sem responsabilidade individual; auto-publicar conteúdo IA sem sign-off; IA que
dá nota; número neural opaco (DKT) mostrado; certificação Caliper/LMS num PWA parent-paid; SDK de analytics/
ads de terceiro sobre dado de criança; recompensa variável/autoplay/urgência/aversão-à-perda na superfície da
criança; win-back de culpa dirigido ao menor; reivindicar eficácia acima da faixa ESSA que se comprova.

---

## 19.6 Não-negociáveis preservados
Idênticos ao 18.8: grounding-only + recusa (05.3), answer-withholding, cache-integrity, explorável sandboxed
(CSP `default-src 'none'`), LGPD parent-fronted com consentimento separável/revogável e minimização, zero SDK
de terceiros, moat = corpus + maestria (LLM é commodity alugada), métricas que importam (D7/D30 + ganho de
maestria). Toda feature deste documento passa pelo teste único: *mantém o aluno fazendo o esforço?*

---

## Fontes (pesquisa 2025–2026 da CS AI Strategy squad — seis frentes)

**A · Afeto, ansiedade & motivação**
- Growth mindset — revisão estruturada, efeito ~zero exceto baixo desempenho (Gazmuri 2025, *Review of Education*): https://bera-journals.onlinelibrary.wiley.com/doi/10.1002/rev3.70066 · WWC/IES Growth Mindset report: https://ies.ed.gov/ncee/wwc/Docs/InterventionReports/WWC_GrowthMindset_IR_report.pdf
- Ansiedade de matemática — intervenções eficazes (Sidney et al. 2025, *Current Directions in Psych. Science*): https://journals.sagepub.com/doi/abs/10.1177/09637214241300111 · RCT relaxamento+habilidade 2025 (*J. Behavioral Education*): https://link.springer.com/article/10.1007/s10864-025-09605-8 · remediação por retrieval (*npj Science of Learning*): https://www.nature.com/articles/s41539-023-00188-5
- PISA 2022 Brasil — 73% abaixo do nível 2 em matemática (OCDE country note): https://www.oecd.org/en/publications/pisa-2022-results-volume-i-and-ii-country-notes_ed6fbcc5-en/brazil_61690648-en.html · Agência Brasil: https://agenciabrasil.ebc.com.br/en/educacao/noticia/2023-12/pisa-less-half-brazilian-students-know-basic-math-science
- SDT × gamificação / sobrejustificação (*TechTrends* 2024/25): https://link.springer.com/article/10.1007/s11528-024-00968-9
- Detecção de frustração *sensor-free* por log de interação (*UMUAI* 2024/25): https://link.springer.com/article/10.1007/s11257-024-09402-4

**B · Voz & multimodal**
- Leitura dialógica parent-vs-CA RCT 2025 (*BJET*): https://bera-journals.onlinelibrary.wiley.com/doi/10.1111/bjet.13615 · IA conversacional na literacia doméstica (rev. 2026, *Computers & Education: AI*): https://www.sciencedirect.com/science/article/pii/S2666920X2600010X
- Whisper on-device para fala infantil (arXiv 2507.14451, jul/2025): https://arxiv.org/abs/2507.14451 · whisper.cpp WASM (áudio fica no aparelho): https://ggml.ai/whisper.cpp/
- Web Speech **não** funciona em PWA instalado (What PWA Can Do Today): https://whatpwacando.today/speech-recognition/ · limites PWA iOS 2026 (MagicBell): https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide
- NN/g UX for Children: https://www.nngroup.com/reports/children-on-the-web/ · TTS/destaque palavra-a-palavra (acessibilidade 2025): https://www.accessibilitychecker.org/blog/text-to-speech-accessibility/

**C · Aprendizagem entre pares segura**
- Aprendizagem cooperativa — meta-análise 2025 (Frontiers, ES 0,459): https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2025.1508808/full
- Efeito protégé / teachable agents (Stanford AAA Lab): https://aaalab.stanford.edu/papers/Protege_Effect_Teachable_Agents.pdf · ensinar um LLM-protégé (ACL BEA 2025): https://aclanthology.org/2025.bea-1.19/
- Responsabilidade individual em colaboração (Wright State): https://www.wright.edu/sites/www.wright.edu/files/uploads/2017/Jan/event/Journal_individualaccountability.pdf
- NTIA Recommended Practices for Industry — Kids Online (2024): https://www.ntia.gov/report/2024/kids-online-health-and-safety/online-health-and-safety-for-children-and-youth/taskforce-guidance/recommended-practices-for-industry
- LGPD art. 14 "melhor interesse": https://lgpd-brasil.info/capitulo_02/artigo_14 · Enunciado ANPD dados de crianças/adolescentes: https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-divulga-enunciado-sobre-o-tratamento-de-dados-pessoais-de-criancas-e-adolescentes

**D · Copiloto do professor & autoria**
- Walton Family Foundation — AI Dividend (5,9 h/sem): https://www.waltonfamilyfoundation.org/the-ai-dividend-new-survey-shows-ai-is-helping-teachers-reclaim-valuable-time · Gallup (6 semanas/ano): https://news.gallup.com/poll/691967/three-teachers-weekly-saving-six-weeks-year.aspx
- Oak National Academy — guardrails do Aila: https://www.thenational.academy/blog/ailas-safety-guardrails-explained · o que aprenderam com 10.000+ lições: https://www.thenational.academy/blog/building-ai-that-s-safe-for-the-classroom-what-we-have-learned-with-aila
- LearnLens — professores confiam em resumo ancorado, desconfiam de prescrição (arXiv 2509.10582): https://arxiv.org/pdf/2509.10582 · distractor analysis: https://assess.com/distractor-analysis-test-items/
- Qualidade de provas geradas por IA (arXiv 2508.08314): https://arxiv.org/html/2508.08314v1
- BNCC Computação obrigatória 2026 (Fundação Lemann): https://fundacaolemann.org.br/noticias/bncc-computacao/ · implementação (Undime, out/2025): https://undime.org.br/noticia/25-10-2025-02-51-o-que-e-preciso-saber-sobre-a-implementacao-da-bncc-computacao-e-integracao-curricular-de-educacao-digital-e-midiatica · Plurall IA (SOMOS): https://blogsomoseducacao.com.br/plurall-ia/

**E · Learning analytics & eficácia**
- Faixas ESSA (Albert): https://www.albert.io/blog/what-essa-efficacy-data-means-for-schools/ · framework 5Es / "Efficacy Silver" (Nature HSSC 2025): https://www.nature.com/articles/s41599-025-05330-9 · EEF EdTech (evidência "mista", 2025): https://educationendowmentfoundation.org.uk/projects-and-evaluation/research-agenda-themes-priority-areas/research-agenda-theme-edtech
- Stealth assessment / ECD 2025 (Tandfonline): https://www.tandfonline.com/doi/full/10.1080/15391523.2025.2587551
- xAPI vs Caliper (1EdTech): https://www.imsglobal.org/initial-xapicaliper-comparison
- DKT — "wavy transitions" (Yeung & Yeung, arXiv 1806.02180): https://arxiv.org/abs/1806.02180 · FSRS benchmarks (open-spaced-repetition): https://github.com/open-spaced-repetition/free-spaced-repetition-scheduler
- Goodhart / specification gaming em métricas de IA (2025): https://explainx.ai/blog/specification-gaming-goodharts-law-ai-metrics

**F · Retenção, ciclo de vida & hábito ético**
- Churn de apps de educação infantil 2026 (RetentionCheck): https://retentioncheck.com/churn-benchmarks/kids-education-apps · problema de retenção edtech (Duolingo 55% vs 18,8%): https://loyalty.cx/edtech-retention-problem/
- Novelty effect × familiarização, longitudinal (Springer IJETHE): https://link.springer.com/article/10.1186/s41239-021-00314-6 · engajamento por SDT (Springer, *Educ Inf Technol* 2025): https://link.springer.com/article/10.1007/s10639-025-13834-9
- Design persuasivo × desengajamento de crianças, RCT 2025 (Wiley HBET): https://onlinelibrary.wiley.com/doi/full/10.1155/hbe2/8187768
- Calendário ENEM 2026 (8 e 15/nov): https://vestibulares.estrategia.com/portal/enem-e-vestibulares/enem/calendario-enem/ · engajamento familiar K-12 (EdTech Digest 2025): https://www.edtechdigest.com/2025/04/18/using-technology-to-drive-k-12-family-engagement/ · win-back "pedir, não culpar" (Optimove): https://www.optimove.com/blog/6-ways-to-re-engage-lapsed-users

**Moldura regulatória (transversal)**
- EU AI Act — proibição de inferência de emoção em educação (fev/2025), via rev. de affective computing (*Computers & Education: AI* 2025): https://www.sciencedirect.com/science/article/pii/S2666920X25001390
- Estatuto Digital da Criança e do Adolescente (Brasil, 17/set/2025) — Inside Privacy/Covington: https://www.insideprivacy.com/childrens-privacy/brazil-adopts-law-protecting-minors-online/ · ANPD adiciona proteção infantil à agenda de fiscalização: https://ppc.land/brazils-data-watchdog-adds-child-protection-to-enforcement-agenda/

> **Nota de proveniência:** algumas frentes retornaram preprints arXiv com datas de 2026 que não foram
> confirmados além do snippet de busca; esses foram **omitidos** aqui em favor de fontes primárias
> verificáveis (Walton, Gallup, Oak, Frontiers, Stanford, ACL, Nature, Yeung & Yeung, RetentionCheck, PISA/
> OCDE, leis). Figuras marcadas como "directional" nos briefs devem ser reconfirmadas antes de virar claim
> público.
