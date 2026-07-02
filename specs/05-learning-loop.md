# 05 · Learning Loop (generation engine — the heart)

**Flow for `{bncc_code|topic, grade, child_id}`:**
```
resolve BNCC + grade_band + age_band
  → CACHE lookup (generated_artifacts) ─ HIT → serve ($0)
  → MISS: retriever (BM25 over corpus_chunks for bncc_code)
      → no support? REFUSE (never generate from model memory)
  → model router (flash-lite: decompose · flash: lesson/explorable/quiz · claude-haiku-4-5: hard math check)
  → generate JSON artifacts (lesson, explorable, quiz)
  → math self-check (if any computation) — fail ⇒ regenerate once ⇒ still fail ⇒ REFUSE
  → safety filter (minors) — fail ⇒ REFUSE
  → write cache + upsert knowledge_atoms → serve
```
Prompt templates (PT, production-ready) exist in `Projects/BearMinds/prototype/STARTER-CODE.md` — port them to `server/prompts/*.txt` verbatim, then adjust only per this spec.

## 5.1 The five artifacts/contracts

1. **decompose** `{topic, grade}` → `{bncc_code, atoms:[{id, text, prereq?}]}` — knowledge-atoms are the FSRS unit.
2. **lesson** (grounded mini-lesson) → JSON: `{warmup_question, sections:[{claim, explanation, source_id}], recap_questions[]}`. **Think-first rule:** `warmup_question` is a retrieval attempt shown BEFORE any content; every claim carries a `source_id` from retrieved chunks; if support is insufficient → `{refused: true, reason}`.
3. **explorable** → self-contained HTML/JS for `<iframe sandbox="allow-scripts">`: no network, no eval, no localStorage, ≤ 50 KB, manipulable variable(s) with visible cause→effect. One REAL exemplar hand-checked in P1 (frações equivalentes).
4. **quiz** (Socratic) → `{questions:[{prompt, kind: mcq|numeric|short, answer, hints:[h1,h2,h3], misconception_feedback{}}]}`. **The answer is never revealed on first miss** — hints escalate; feedback names the misconception; second retrieval attempt scheduled via FSRS.
5. **mathcheck** → verifies every numeric claim/answer step-by-step; returns `{ok, corrections[]}`.

## 5.2 Age-band rendering rules
| Band | Session | Tone | UI |
|---|---|---|---|
| 8–10 | 5–15 min | story/character-led, warm | big touch targets, tactile explorables, worked examples first |
| 11–14 | 15–25 min | peer-like, zero condescension | choice of path, identity/avatar, opt-in social later |
| 15–18 | 25–45 min | coach/analytics | mastery %, prova countdown, minimal gamification |
Rendering = same JSON + skin tokens + prompt `age_band` parameter (affects examples/voice, not facts).

## 5.3 Guardrails (non-negotiable, tested)
- Grounding-only: generation prompt includes ONLY retrieved chunks as knowledge; instruct REFUSE otherwise. Test: topic with empty corpus MUST return refusal, not content.
- Answer-withholding: automated test asserts quiz payload hints do not contain the literal answer string before hint 3.
- Cache integrity: artifacts enter cache only with `safety_passed=1` AND mathcheck ok.
- Language: PT default; `lang:'en'` for Maple Bear EN subjects (same grounding, English rendering).
- Cost budget: log `model_used` + token counts per generation to `audit_log`; alert if > US$0.05/lesson.

## 5.4 UX flow (child)
1. Topic chosen → "Antes de começar: o que você já sabe sobre isso?" (warmup retrieval, no grading, 30 s)
2. Lesson sections (short, one claim each, "por quê?" expandable)
3. Explorable ("mexa aqui e veja o que acontece")
4. Quiz (3–6 questions, hints ladder, celebratory feedback on mastery not on speed)
5. Close: "Voltamos a isso em 2 dias 👊" (FSRS scheduling visible — builds trust in the method)

## Acceptance criteria
- [ ] Cache hit path: 2nd request for same (code, grade_band, kind, age_band) returns in < 200 ms with no LLM call (log-proven).
- [ ] Refusal path proven by test (empty corpus topic).
- [ ] Mathcheck rejects a seeded wrong answer (test fixture).
- [ ] Explorable runs inside sandboxed iframe with network blocked (CSP test).
- [ ] Full loop (warmup → lesson → explorable → quiz) works on iPhone Safari installed PWA for "Frações equivalentes, 6º ano".
- [ ] p95 first-generation latency ≤ 25 s with progress UI ("preparando sua aula…" with mascot animation).
