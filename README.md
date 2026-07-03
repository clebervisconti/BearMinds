# 🐻 BearMinds

Companheiro de estudos com IA, **PT-first, BNCC-native e guardrailed**. PWA instalável + API Hono/Node.
Princípio de produto: **"aprender, não colar"** — a IA nunca entrega a resposta pronta; ela ancora o
conteúdo num corpus BNCC verificado e recusa quando não há base.

> Upgrade do app estático v0 (congelado em `legacy/`) para o produto P1. Specs em `specs/`.

## Stack
- **Front:** Vite + React 18 + TypeScript, PWA (service worker que **nunca** cacheia `/api`), 3 skins por faixa etária via CSS vars.
- **Back:** Hono sobre Node **24** (LTS), porta 8787. `node:sqlite` atrás de um adaptador (ver `specs/CHANGELOG.md`).
- **LLM:** abstração `server/llm/provider.ts` (Gemini + Claude), trocável por env. Default `gemini-2.5-flash-lite`.
- **RAG:** BM25 (`minisearch`) sobre `corpus_chunks`, grounding obrigatório.
- **Memória:** FSRS (`ts-fsrs`) por knowledge-atom, ancorada à data real da prova.
- **Auth:** sessões por cookie httpOnly, bcrypt, consentimento LGPD separável/revogável.

## Rodar localmente
```bash
npm install
cp .env.example .env        # opcional: GEMINI_API_KEY habilita geração além do exemplar
npm run seed                # popula BNCC + instituições (idempotente)
npm run dev                 # web :5173 + API :8787
```
> **Nota (máquina do Cleber):** a porta 8787 é usada por outro serviço local. Rode com `PORT=8790 npm run dev`
> (o proxy do Vite acompanha). Em produção o 8787 é livre.

Sem chave de LLM o app já funciona no tópico **"Frações equivalentes" (EF06MA07)** — um exemplar
hand-verified (lição + explorável interativo + quiz) que serve de referência e garante o loop completo.

## Comandos
| Comando | O quê |
|---|---|
| `npm run dev` | web + API em watch |
| `npm run build` | emite `dist/` (PWA) |
| `npm start` | API em produção (serve `dist/` também) |
| `npm run seed` | cria/popula o SQLite |
| `npm test` | vitest (guardrails, rating FSRS, mastery, hard-delete LGPD) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run jobs:nightly` | hard-delete 30d + métricas + coortes |

## Estrutura
```
src/        PWA (screens/, components/, lib/, styles/skins.css)
server/     API (routes/, gen/ [engine+guardrails+exemplars], llm/, rag/, mastery/, lib/, jobs/, prompts/)
shared/     contratos TS + rating FSRS (server ⇄ client)
seed/       bncc.seed.json · institutions.seed.json
scripts/    deploy.sh · bearminds-api.service · gen-icons.py
legacy/     app v0 congelado (ainda em produção até o cutover)
specs/      pacote de especificação + CHANGELOG
tests/      vitest
```

## Guardrails (inegociáveis — spec 05/09)
- **Grounding-only:** geração cita `source_id` por afirmação; corpus vazio ⇒ **recusa** (testado).
- **Answer-withholding:** dicas 1–2 nunca contêm a resposta (testado).
- **Cache-integrity:** só entra no cache com `safety_passed=1` e mathcheck ok.
- **Explorável sandboxed:** `<iframe sandbox>` + CSP `default-src 'none'`; sem rede/eval/storage (validado + testado).
- **LGPD:** conta do responsável, consentimento separável/revogável, minimização (apelido+ano+série),
  export/deleção (soft→hard 30d), zero SDK de terceiros, headers CSP/HSTS.

Deploy: ver [`DEPLOY.md`](DEPLOY.md).
