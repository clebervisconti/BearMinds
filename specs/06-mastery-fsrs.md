# 06 · Mastery Engine (FSRS) & "Para revisar hoje"

**Purpose:** moat #2. Track per-child memory at the knowledge-atom level, schedule reviews with FSRS, and anchor everything to the child's REAL prova date. This is what free chatbots don't do.

## 6.1 Engine
- Library: `ts-fsrs`, default weights, target retention **0.90**. Per-child weight optimization = Phase 2.
- Unit: `knowledge_atom` (from decompose). Rating scale 1–4 (Again/Hard/Good/Easy) derived from quiz outcomes:
  - wrong even after hints → 1 · correct after 2–3 hints → 2 · correct after ≤1 hint → 3 · correct fast, no hints → 4
- Every quiz answer → `POST /api/mastery/review {child_id, atom_id, rating}` → ts-fsrs computes next `due`, update `mastery_state`, append `study_sessions`.

## 6.2 Prova-anchored scheduling (the differentiator)
- When a `prova_calendar` entry exists, atoms tagged with its `bncc_codes` get **exam-aware review**: compress the FSRS schedule so the last review lands T-1/T-2 days before `exam_date`; if FSRS `due` falls after the exam, override to `min(due, exam_date - 1d)`.
- Home shows countdown: "Prova de Matemática em 6 dias — você está 72% pronto" (readiness = mean retrievability over the prova's atoms, computed live).
- After exam day, ask the child/parent: "Como foi?" (1–5) → store on prova row (P2: correlate with predicted readiness — the efficacy dataset).

## 6.3 "Para revisar hoje" (home screen)
- Query: atoms with `due <= now` for active child, ordered by (prova proximity, retrievability asc), cap 12/day (8–10 band: cap 6).
- Each review item = ONE retrieval question (from the cached quiz pool for that atom; rotate variants). No re-reading before answering — retrieval first, then feedback.
- Interleaving rule: never serve > 2 consecutive atoms of the same bncc_code when the queue has variety.
- Empty state: "Tudo revisado! 🐻" + gentle pointer to "Estudar algo novo" (never guilt).
- NO PUSH in P1 (PWA/iOS limits). Optional parent e-mail digest (respect `email_updates` consent): "3 revisões esperando o João hoje".

## 6.4 Mastery visibility
- Child (11–14, 15–18): per-subject mastery bars from mean retrievability; per-atom detail on tap. 8–10: qualitative ("O urso lembra com você: 🟢🟢🟡").
- Parent: see 08.

## Acceptance criteria
- [ ] Quiz outcome writes an FSRS review and re-schedules the atom (unit tests over rating mapping incl. lapse path).
- [ ] Prova compression proven: atom due after exam gets pulled before it (fake clock test).
- [ ] Daily queue respects cap + interleaving; deterministic given fixed clock/seed.
- [ ] Readiness % changes after a review session and matches mean retrievability formula.
- [ ] A full week of simulated usage (script) produces sane schedule (no atom starvation, no > cap days).
