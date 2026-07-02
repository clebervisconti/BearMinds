# 07 · Gamification (done right)

**Evidence base (deep-review 2026-07-02):** gamification reliably moves *motivation* (g≈0.65 K-12), not learning directly; novelty decays ~4 weeks; extrinsic rewards can crowd out intrinsic motivation (overjustification); streaks can be gamed by speed-running. Therefore: **game mechanics exist ONLY to deliver the proven techniques (daily retrieval + spacing) — never as the reward itself.** Design for week 5, not week 1.

## BUILD
1. **Sequência (streak) amarrada a aprendizagem real** — a day counts ONLY when ≥1 FSRS review is completed with rating ≥2 (a "learning event", from `habit_log`). Completing trivially easy content does NOT count. **Forgiving:** 1 auto "streak freeze" per week (Duolingo-style), restored weekly; missing 2+ days shows "recomeçar é de campeão", never shame.
2. **Progressão por maestria** — the child's "level" per subject = count of atoms in `review` state with retrievability ≥ 0.9. Level-ups celebrate durable memory ("Você LEMBRA de 12 coisas de frações!"), never points volume.
3. **Companheiro 🐻** — the mascot is the relatedness anchor (SDT): reacts to effort ("você tentou 3 vezes — é assim que o cérebro cresce"), personalizes greetings, holds the child's goals. Persona per age band (05 §5.2). P1: text + static poses (Nano Banana-generated set); voice/animation later.
4. **Autonomia** — child picks subject order, avatar, explorable to revisit; "modo desafio" opt-in (harder variants) — choice is the motivator.
5. **Celebration style** — effort- and mastery-referenced, specific ("mandou bem na 2ª tentativa — a dica te ajudou?"), brief, skippable.

## AVOID (explicitly out — do not implement even if requested casually)
- Competitive leaderboards between children.
- Points/XP for raw activity (time spent, lessons opened).
- Purchasable cosmetics/paywalled rewards aimed at the child (LGPD/ECA risk + dark pattern).
- Punitive streak loss (no "you lost your 40-day streak" full-screen).
- Notification pressure loops (P1 has no push at all).

## Data
`habit_log` (02) feeds streak; mastery levels computed from `mastery_state`. No extra tables needed in P1.

## Acceptance criteria
- [ ] A day with only lesson-reading (no review) does NOT increment the streak (test).
- [ ] Streak freeze consumed automatically on a 1-day gap; weekly restore tested with fake clock.
- [ ] Level derivation pure-function unit-tested; UI copy reviewed against the AVOID list.
- [ ] 8–10 band shows qualitative progress only (no numbers); 15–18 band shows minimal game surface (readiness % + streak, nothing else).
