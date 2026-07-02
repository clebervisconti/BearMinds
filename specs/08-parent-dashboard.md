# 08 · Parent Dashboard (P2 — light version ships in P1)

**Who pays and why:** the parent. The dashboard is where the value proposition ("tranquilidade + alinhado à escola + aprender, não colar") becomes visible — it directly supports willingness-to-pay at the D90 gate.

## P1-lite (ship with the MVP)
Single screen in parent mode (`/responsavel`):
- Per child: last-7-days activity (days with learning events, from `habit_log`), atoms reviewed, current streak.
- Prova panel: upcoming provas + readiness % (same calc as 06 §6.2) — THE headline number.
- Consent panel (03) + "adicionar prova" shortcut.
- Weekly e-mail digest (if `email_updates` granted): 5-line PT summary; plain HTML; unsubscribe link.

## P2 (full)
- Mastery map per subject (atoms grid: 🟢 lembra / 🟡 revisando / ⚪ novo), trend over weeks.
- "O que estudar em casa" suggestions (weakest 3 atoms before the next prova).
- Post-prova correlation: predicted readiness vs parent-reported result — shown honestly ("nossa previsão foi 72%, a nota veio 7,5") — this transparency IS the trust moat and the future efficacy dataset.
- Multi-child comparison NEVER (no sibling leaderboards).

## Principles
- Visibility, not surveillance: parents see progress and readiness — never chat logs or per-question mistakes in real time (11–14+ bands; 8–10 may show session summaries). The child is told what the parent can see (trust both ways).
- All copy PT, plain, non-technical ("ele lembra de 12 de 18 pontos da prova" — not "retrievability 0.67").

## API
```
GET /api/parent/summary?child_id → {week:{active_days,reviews,streak}, provas:[{title,date,readiness}]}
GET /api/parent/mastery?child_id&subject → atoms grid (P2)
```

## Acceptance criteria
- [ ] P1-lite screen renders with seeded data; readiness matches 06 formula.
- [ ] E-mail digest renders and respects consent + unsubscribe.
- [ ] No route exposes child free-text inputs to the parent UI (privacy test).
