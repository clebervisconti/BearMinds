# 04 · Onboarding, Institutions & Curriculum Catalog

**New requirement (2026-07-02):** the user journey starts by selecting the **institution**, then class/grade, then discipline — before reaching topics. The catalog must support (a) the default Brazilian public curriculum (BNCC), (b) school networks with their own structure (Maple Bear is the first), and (c) future custom schools — without code changes.

## 4.1 Institution model

Institutions live in the `institutions` table (02) with `config_json` describing their shape:

```jsonc
// seed/institutions.seed.json
[
  {
    "id": "bncc-padrao",
    "name": "Escola brasileira (BNCC)",       // the DEFAULT — most B2C users
    "kind": "default",
    "config": {
      "classes": [                              // class == grade for the default
        {"id":"4EF","label":"4º ano EF","grade_equiv":"4EF","age":"9–10"},
        {"id":"5EF","label":"5º ano EF","grade_equiv":"5EF","age":"10–11"},
        {"id":"6EF","label":"6º ano EF","grade_equiv":"6EF","age":"11–12"},
        {"id":"7EF","label":"7º ano EF","grade_equiv":"7EF","age":"12–13"},
        {"id":"8EF","label":"8º ano EF","grade_equiv":"8EF","age":"13–14"},
        {"id":"9EF","label":"9º ano EF","grade_equiv":"9EF","age":"14–15"},
        {"id":"1EM","label":"1ª série EM","grade_equiv":"1EM","age":"15–16"},
        {"id":"2EM","label":"2ª série EM","grade_equiv":"2EM","age":"16–17"},
        {"id":"3EM","label":"3ª série EM","grade_equiv":"3EM","age":"17–18"}
      ],
      "subjects": [
        {"id":"matematica","label":"Matemática","icon":"🔢","lang":"pt"},
        {"id":"portugues","label":"Português","icon":"📚","lang":"pt"},
        {"id":"ciencias","label":"Ciências","icon":"🔬","lang":"pt"},
        {"id":"geografia","label":"Geografia","icon":"🌍","lang":"pt"},
        {"id":"historia","label":"História","icon":"🏛️","lang":"pt"}
      ],
      "terms": ["t1","t2","t3"]
    }
  },
  {
    "id": "maple-bear",
    "name": "Maple Bear Canadian School",
    "kind": "network",
    "config": {
      // ported from legacy/public/assets/js/curriculum.js
      "classes": [ {"id":"y4","label":"Y4","grade_equiv":"3EF","age":"8–9"},
                   {"id":"y5","label":"Y5","grade_equiv":"4EF","age":"9–10"},
                   {"id":"y6","label":"Y6","grade_equiv":"5EF","age":"10–11"},
                   {"id":"y7","label":"Y7","grade_equiv":"6EF","age":"11–12"},
                   {"id":"y8","label":"Y8","grade_equiv":"7EF","age":"12–13"},
                   {"id":"y9","label":"Y9","grade_equiv":"8EF","age":"13–14"} ],
      "subjects": [ {"id":"portugues","label":"Português","icon":"📚","lang":"pt"},
                    {"id":"english","label":"English","icon":"🇬🇧","lang":"en"},
                    {"id":"math","label":"Math","icon":"🔢","lang":"en"},
                    {"id":"science","label":"Science","icon":"🔬","lang":"en"},
                    {"id":"geografia","label":"Geografia","icon":"🌍","lang":"pt"},
                    {"id":"historia","label":"História","icon":"🏛️","lang":"pt"},
                    {"id":"artes","label":"Artes","icon":"🎨","lang":"pt"} ],
      "terms": ["t1","t2","t3"]
    }
  }
]
```

**Key design point — everything resolves to BNCC:** `curriculum_map` links `{institution, class, subject, term}` → `bncc_code`s. The generation engine and mastery engine ONLY speak BNCC codes. `grade_equiv` bridges network classes (Y5) to BNCC grades (4EF). English-language Maple Bear subjects (Math/Science/English) map to the same BNCC codes but set `lang:'en'` on generation (prompt renders in English). P1 corpus covers Matemática 6º–9º; other subject nodes render as "em breve" exactly like the legacy app did.

## 4.2 Onboarding wizard (parent, after consent)

```
Step 1  Instituição   — cards: "Escola brasileira (BNCC)" (default, pre-selected) · "Maple Bear" · "Outra/não sei" → falls back to bncc-padrao
Step 2  Turma/Série   — from institution config (Y1–Y9 or 4ºEF–3ªEM); pre-filter by child birth_year with override
Step 3  Disciplinas   — multi-select of subjects the child wants help with (≥1); flag "prioridade" on one
Step 4  Próxima prova — optional: title + date + subject → creates prova_calendar entry ("A prova de Matemática é dia 15?")
Done    → child home
```
Editable later in child settings (parent mode). Store selections on the `children` row + `prova_calendar`.

## 4.3 Child navigation (the daily surface)

- **Home** = "Para revisar hoje" (FSRS queue, 06) + "Estudar algo novo" entry.
- "Estudar algo novo" → subject picker (only subjects selected in onboarding, others "em breve") → **topic entry**: free-text ("frações equivalentes") OR pick from the BNCC-derived topic list for that class/subject/term.
- Free-text topics resolve to a `bncc_code` server-side (`decompose` prompt); ambiguous → show 2–3 candidate skills to pick ("É isso que você vai estudar?").
- Breadcrumb mirrors the legacy pattern: Instituição → Turma → Disciplina → Trimestre → Atividade.

## 4.4 API
```
GET /api/catalog/institutions          → [{id,name,kind,classes,subjects,terms}]
GET /api/catalog/tree?institution=maple-bear&class=y5&subject=math&term=t2
    → {topics:[{bncc_code, title, has_cache, atom_count}]}
POST /api/catalog/resolve-topic        {text, grade} → {candidates:[{bncc_code, description, confidence}]}
```

## Acceptance criteria
- [ ] Adding a THIRD institution requires only a new entry in `institutions` + `curriculum_map` rows (proven by a test fixture school).
- [ ] Onboarding completes in ≤ 4 steps; child lands on Home with subjects chosen.
- [ ] Maple Bear Y5 child and BNCC 4º-ano child both resolve "frações equivalentes" to the same `bncc_code`.
- [ ] Topic list marks cached topics (instant) vs to-generate (spinner expectation ~10–20 s).
- [ ] All copy PT (child-facing tone per age band; parent-facing neutral).
