---
name: Anchor i18n missing-key trap
description: Why Anchor PWA rendered raw dotted translation keys and how to avoid regressions
---

# Anchor i18n: refactor-to-t() without adding keys renders raw dotted keys

`artifacts/anchor/src/lib/translations.ts` uses flat maps with fallback
`dict[key] ?? en[key] ?? key`. A missing key therefore renders as the literal
dotted string (e.g. "breath.title") in BOTH `en` and `nl` — it is NOT a
Dutch-only bug.

**Root cause pattern:** a refactor that swaps hardcoded English JSX for
`t("key")` calls is only half done unless the same keys are added to every map
(`en`, `nl`, and `optNl` where option translations apply). The "Add Dutch
language support" work introduced ~186 `t()` references without defining them.

**Why:** the key-as-fallback hides the failure from typecheck — there is no
compile error for an unresolved translation key, so missing keys ship silently.

**How to apply / recover:**
- Original English is recoverable from git: tools were hardcoded at the file's
  creation commit (find via `git log --diff-filter=A -- <file>`), then diff
  `git diff -U0 <creation> HEAD -- <file>` to map each `t("key")` back to its
  removed English literal. Numeric/sequential keys (s0..s3, msg0..msg11,
  i0..i11) map by order.
- Dynamic keys like `t(\`craving.risk.${r}\`)` need one entry per enumerated
  value (low/medium/high) and are NOT caught by a static key scan — enumerate
  them manually.
- Verify with a key-coverage script: walk `src/`, regex
  `\bt\(\s*["'\`]([^"'\`]+)["'\`]\s*\)`, diff against quoted keys in
  translations.ts; expect 0 missing. Then screenshot a tool/help/journal page
  (app defaults to `nl`) to confirm no dotted strings.
- Consistency debt: parallel key namespaces exist (`bb.*` vs `breath.*`,
  `sc.*` vs `compassion.*`) from earlier refactors — match whichever the
  component actually references; do not assume one canonical prefix.

## Copy/tense passes must include parallel placeholder & sub keys on the same screen
A wording/tense consistency pass that only touches `*.q.*` and `*.step.*` keys is
incomplete. Each tracker screen also renders parallel free-text keys —
`*_other_placeholder`, `*_sub`, `*_other` — that show on the SAME screen and can
carry the opposite tense. Example: fixing `craving.q.onset` to present tense left
`craving.onset.other_placeholder` ("Describe how it started…") past tense, visible
when "Other" is selected on the same onset step (and reused on the trigger step).
**Why:** these keys are namespaced separately from the question they sit under, so a
key-by-key edit of just `q.*`/`step.*` misses them. **How to apply:** for any copy
pass, grep the whole key family for the screen (prefix + `_placeholder`/`_sub`/`_other`)
and review each, in both `en` and `nl`, before considering the screen consistent.
