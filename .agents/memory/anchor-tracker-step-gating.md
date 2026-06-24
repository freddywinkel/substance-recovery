---
name: Anchor tracker step gating
description: Convention for the per-step canProceed "Next/Save" gate in Anchor's multi-step trackers.
---

# Anchor tracker step "Next" gating

Each multi-step tracker (Craving, Trek, Anxiety, Boredom, Relapse) gates its footer
Next/Save button with a per-step `canProceed`. Keep all five consistent.

**Gate (block advance until answered):**
- single-selects that start `""`
- multi-selects that start `[]`
- conditional `Other` -> require its `*Other` text (e.g. `location === "Other"` needs `locationOther`)
- a free-text input that is an *alternative* to a chip (placeholder like "Or someone specific…",
  "Something else…") -> OR it with the chip: `chip !== "" || other.trim() !== ""`
  (Relapse `next` step: supportContact/nextStep). The `inner` step has TWO such free-texts:
  the inner OR gate must include `emotionOther` AND `thoughtFreeText` alongside the chips
  (Trek inner also has `physicalSensations`), or typing a custom emotion traps the user.

**Do NOT gate:**
- sliders (intensity/confidence, default 5)
- single-selects with a non-empty default (Relapse label, episodeDuration, amountCategory).
  TRAP: these are typed string-literal unions that do NOT include `""`, so a gate like
  `draft.label !== ""` is a TS2367 "no overlap" compile error AND a no-op (the field can
  never be empty / cleared). Don't gate them — the type system already guarantees a value.
- boolean toggles with a default (Anxiety urgencyHigh)
- free-text *notes/descriptions* that supplement a chip (e.g. Relapse trigger textarea
  "Describe the trigger…")
- any field explicitly marked `({t("common.optional")})`, or a whole step with a Skip button.
  NOTE: Anxiety `details` is the only skip-button step. Anxiety `body` has NO skip button and
  IS gated on `bodyLocations`; only its `bodyPrediction` textarea is `(optional)`/ungated.

**Why:** the user asked that you cannot advance a step until required questions are answered,
but default-valued and optional-marked controls already show/allow an answer; gating them
would trap users. The alternative-free-text OR rule prevents trapping people who type a
custom value instead of tapping a chip.

**How to apply:** when adding/editing a tracker step, update its `canProceed` switch.
Anxiety/Boredom/Trek/Craving use `useMemo`; Relapse uses a plain IIFE const (it does not
import `useMemo`).

**Optionality cues (keep in sync with the gate):** three mechanisms exist — match the
step's gate, don't invent a 4th:
- per-field `({t("common.optional")})` tag for an ungated field next to a gated one
  (Anxiety body/details, Boredom situation/urge, Relapse when/duration).
- per-step Skip button (`isOptional`) for a fully-ungated step (Anxiety details, Relapse before).
- a primary-tinted Info hint box reading `t("craving.inner.hint")` at the TOP of an
  OR-gated multi-question step (Trek + Craving `inner`): "you don't have to answer all of
  these… one is enough." The key is count-agnostic on purpose (Trek inner has 3 questions,
  Craving inner has 2) — do NOT reintroduce "all three"/"alle drie".
