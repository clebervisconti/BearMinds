# 🐻 BearMinds

Plataforma de estudos do **Maple Bear Canadian School**. Web app estático, responsivo
(iPhone/Android Safari & Chrome, tablets e desktop), sem build e sem backend.

**Produção:** https://bearminds.cybersphere.com.br

O aluno navega: **Ano letivo → Turma Maple (Y1–Y9) → Disciplina → Trimestre → Atividade**
(Guia de Estudos + Quiz Interativo com correção na hora).

---

## Estrutura

```
public/
├── index.html                              # shell do app
└── assets/
    ├── css/style.css                       # tema Maple Bear (vermelho/branco), responsivo
    └── js/
        ├── curriculum.js                   # anos, turmas, disciplinas, trimestres
        ├── app.js                          # router (hash) + telas + motor do quiz/guia
        └── content-<ano>-<turma>-<disc>.js # módulos de conteúdo (1 arquivo por disciplina)
```

A navegação é **data-driven**: um nó (ano/turma/disciplina/trimestre) só fica habilitado
se existir conteúdo registrado em `window.BM_CONTENT` com a chave
`"<ano>.<turma>.<disciplina>.<trimestre>"`. Os demais aparecem como **“em breve”**.

## Como adicionar um novo conteúdo

1. Crie `public/assets/js/content-<ano>-<turma>-<disciplina>.js` seguindo
   `CONTENT_AUTHORING.md` (e o exemplo `content-2026-y5-geografia.js`):
   ```js
   window.BM_CONTENT = window.BM_CONTENT || {};
   window.BM_CONTENT["2026.y6.historia.t1"] = { title, subtitle, intro, activities:[…] };
   ```
2. Rode `./publish.sh`. Pronto — ele **registra o `<script>` automaticamente** em
   `index.html` (via `scripts/register-content.py`, entre os marcadores `BM:CONTENT`) e
   faz o deploy. O nó passa a aparecer habilitado; os demais ficam "em breve".

> Não edite o bloco `<!-- BM:CONTENT -->` do index à mão — ele é gerado.
> Disciplinas e idioma seguem a metodologia bilíngue (PT: Português, Geografia, História,
> Artes · EN: English, Math, Science), definidos em `curriculum.js`.

### Geração automática pelo agente
O subagente **maplebear-student** (em `ai-workspace/agents/maplebear-student/`) gera os
PDFs/quiz **e publica aqui** automaticamente a cada pedido de material de estudo — ele
escreve o `content-*.js` e roda `publish.sh`. Schema em `CONTENT_AUTHORING.md`.

## Deploy

`./deploy.sh` envia `public/` para o VPS via rsync e recarrega o OpenLiteSpeed.

- **Origem:** OpenLiteSpeed/CyberPanel num VPS HostGator atrás do Cloudflare
  (host/porta SSH e docroot configurados localmente, fora do repositório).
- **Borda:** Cloudflare (zona `cybersphere.com.br`), registro A `bearminds` **proxied**,
  SSL **Full (strict)** com certificado Let's Encrypt na origem.
- **DNS:** `bearminds.cybersphere.com.br` → Cloudflare → origem.

Teste local: `cd public && python3 -m http.server 8080` e abra `http://localhost:8080`.
