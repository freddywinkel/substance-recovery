---
name: Anchor Logboek editor & option-list mirroring
description: Durable constraints when editing the Anchor Logs.tsx logbook (clearing optional fields; keeping option lists in sync with trackers)
---

# Anchor Logboek (Logs.tsx): two recurring constraints

## 1. A single-select chip cannot clear an optional field
The local `ChipSingle` in `Logs.tsx` only ever emits the clicked option — it
never emits empty and re-clicking the selected chip is a no-op.

**Why it matters:** for an OPTIONAL field, code like
`onChange={v => patch({ field: v || null })}` looks like it clears but the
null branch is unreachable, so the user can never unset the field (or its
dependents) from the logbook.

**How to apply:** when an editable logbook field must be clearable, render custom
toggle buttons that emit null when the active option is re-clicked
(`draft.x === opt ? null : opt`) and null out dependent fields in the same patch.

## 2. Logbook option lists are hand-mirrored from the tracker pages
`Logs.tsx` keeps its own copies of the option/enum lists (situations, actions,
substances, outcomes…) that must match the source-of-truth enums in the tracker
pages (`CravingTracker.tsx` OUTCOME_ACTIONS, `TrekTracker.tsx` TREK_ACTIONS,
etc.). They are NOT imported, so they drift silently.

**Why it matters:** a value the trackers can persist but the logbook list omits
renders as "—" in summaries and is uneditable. Craving + Desire (Trek) logs share
the `CravingLog` shape and appear together under the same logbook category, so the
logbook action list must be the UNION of both trackers' action values.

**How to apply:** whenever you add/rename an option in any tracker, update the
mirrored list in `Logs.tsx` in lockstep, and add the new English label to the
`optNl` map in `translations.ts` (logbook labels are localized via `tOpt`, which
falls back to the raw string when a key is missing — see the i18n trap note).

## 3. One `CravingLog` store, two log types, overloaded legacy fields
TREK (active) and CRAVING (passive) are the SAME `CravingLog` IndexedDB store,
split in the logbook by `cravingType === "active"`. Several fields were historically
overloaded and pre-split records still carry that shape:
- active TREK stored its triggers in `situationPresets` (analytics `topSituations`
  reads `situationPresets`), and crammed the "other need" free text into
  `thoughtFreeText`.
- passive CRAVING crammed the "other onset" free text into `thoughtFreeText`.

**Why it matters:** reading only the new dedicated fields (`triggers`, `needOther`,
`onsetOther`) silently hides data on legacy records; surfacing `thoughtFreeText`
unconditionally double-displays it as "thoughts".

**How to apply:** keep TrekTracker writing triggers into BOTH `triggers` and
`situationPresets` (analytics depends on the latter). On read, fall back
(`triggers?.length ? triggers : situationPresets`; `needOther ?? thoughtFreeText`)
and only show free text as "thoughts" once the dedicated field is defined. Migrate
legacy fields into their dedicated homes when a record is opened for edit, so a save
disambiguates it permanently.

## 4. Detail-row order must mirror each tracker's actual question order
The detail view renders EVERY row in array order with no empty-row filtering, so the
order of the `*Steps()` return arrays in `Logs.tsx` IS the order the user sees. It
must match the order questions are asked in each tracker (walk `STEP_ORDER`, then the
fields top-to-bottom inside each `step === "..."` JSX block).

**Why it matters:** the arrays were authored independently and drifted — e.g. craving
`confidence` rendered dead-last AFTER `outcome` though it's asked early. Within-step
field placement is non-obvious and easy to get wrong: CravingTracker's `onset` step
holds onsetType → intensity → confidence → location; the `trigger` step holds
situation → physical → buildup; `inner` is only emotions → thoughts. Do NOT trust an
explore-subagent's step-assignment summary here (it mislabeled which step held
confidence/location) — read the tracker render directly.

**How to apply:** reorder array ELEMENTS only — never touch row `id`, label key, or
summary expr (the edit view resolves by `id`, not index, so reordering is display-only
and safe). Put `note` before `outcome` for anxiety/boredom (note captured in the last
step, outcomeAfter on the done screen); keep note last for trek/craving (note never
captured there). Trek's done screen captures nothing, so its `outcome`(cravingOutcome)
+`note` rows are always "—". Relapse already matches its flow (`help`/`needs` are
legacy fields, not in the current flow).
