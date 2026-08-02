# Anchor registration contract

Status: canonical product contract for registration `dataVersion: 3`,
`contentVersion: registration-v3`, and active-draft version 3.

This document replaces the conflicting registration briefs in `attached_assets`.
Those files remain historical input, but they are not independently authoritative.

## Product boundary

Anchor is an offline self-reflection and coping companion. Registration screens do
not diagnose a condition, determine whether a symptom is safe, or replace medical,
addiction, crisis, or emergency care. Safety-sensitive wording must make that
boundary visible without using alarmist language.

## Shared rules

1. Every question is either visibly required or genuinely skippable. Copy and
   progression gates must never disagree.
2. An unanswered value is `null` or absent in legacy/top-level compatibility data.
   A current v3 canonical answer envelope contains every contracted key and stores
   unanswered optional values explicitly as `null`; the documented Craving/Trek
   History note is an optional post-save extension. Unanswered must never be
   converted into `0`, `false`, `none`, `no concern`, or a midpoint measurement.
3. `unknown` is a real answer, distinct from unanswered.
   `none` is also a deliberate answer, not a synonym for unanswered. A pre-v2
   preselected Relapse `none` is unproven; deployed-v2 singular `none` is deliberate
   because that release had a separate `unanswered` sentinel. V3 stores the complete
   canonical concern array.
4. Registration records distinguish:
   - `occurredAt`: when the experience or event happened;
   - `startedAt`: when the form was opened;
   - `completedAt`: when the record was committed.
   The legacy `timestamp` remains a compatibility alias for `occurredAt`.
5. A selected coping action is an intention until the person confirms that it was
   attempted. Analytics may describe selections and reported outcomes, but may not
   claim that an action caused an outcome.
6. Every reported `used` outcome offers the same optional support/relapse route.
7. Starting another registration while one is active requires an explicit choice:
   resume the existing draft, discard it, or continue after preserving it.
8. Saves are idempotent. A failed refresh after a successful database write must
   not create a second record on retry.
9. Visible answers must survive save, reload, export/import, History, and migration.
   Current v3 imports require a complete, type-correct canonical answer envelope;
   explicit null remains authoritative and is never backfilled from an alias.
   Known current option IDs are validated by the active UI catalogs. Import also
   preserves well-formed unknown stable IDs for forward compatibility; acceptance
   of such an ID is not evidence that it belongs to the current reviewed catalog.
10. Core answers are read-only in History to preserve an audit trail. Notes may be
    edited. A materially incorrect record is deleted and entered again.
    History, Home, sobriety calculations, and Insights count only completed
    Craving/Relapse records; a draft is form state, not a completed registration.
11. Trek targets and needs are unordered plural answers. `substances` and
    `needTypes` are authoritative whenever present; list order never creates a
    primary answer. New Trek records write blank compatibility placeholders for
    `primarySubstance` and `needType`; they are never populated or inferred from
    array order. Legacy scalar aliases may be read only as compatibility fallback
    for pre-contract records.
12. V1/v2 records and active drafts retain their original version evidence while
    narrow migrations recover only meanings known to have been omitted or encoded
    differently by those releases. V3 never uses a legacy scalar to replace a
    missing/null canonical answer. Saved and active Trek records share one retired
    taxonomy map; Relapse v2 default, safety, timing, and follow-up migrations are
    version-aware.

## Terminology

- `trek`: **Planned or active urge** — planning, seeking, or moving toward a
  substance or behaviour.
- `craving`: **Urge or craving** — an urge that arose without current planning or
  active seeking.

These are operational routing labels, not clinical categories. The interface must
not call either state passive, imply blame, or claim that the categories are
diagnostically validated.

The shared target question is: **“Is this connected to a substance or behaviour?”**
It is optional in Trek and Craving. Relapse uses **“What was involved?”** and allows
the person to skip it. Substance-only concepts such as withdrawal, route, tolerance,
or overdose must not be applied to behavioural targets.

## Flow contracts

### Planned or active urge (Trek)

- Capture the form that movement toward acting is taking, optional
  intensity/confidence, immediacy, context, inner experience, underlying needs,
  optional targets, chosen next action, whether the action was attempted, and
  reported use outcome.
- Approach form and immediacy are separate axes. Approach form describes an
  observable route (for example mental rehearsal, arranging access, moving toward,
  or automatic routine). It must not encode stage, motive, or trigger/context.
  Immediacy describes only how close the situation is to action. Motive belongs in
  needs; context belongs in triggers.
- Selection caps are visible before interaction. Once a cap is reached, unselected
  options are disabled; an existing answer is never silently removed.
- The done message reflects the reported outcome, not the selected intention.

Legacy active drafts and saved records are normalized for current readers. Retired
planning/thinking, active seeking, and routine values map to the corresponding
approach form; boredom and emotional-escape values move to Stimulation and Escape
needs; social pressure moves to the trigger field; retired planning stages map to
the corresponding immediacy level. Historical saved values remain translatable in
both languages.

| Retired Trek value | Canonical destination on resume |
| --- | --- |
| Planning or thinking about it | `approach-mental-rehearsal` |
| Actively seeking it | `approach-checking-availability` |
| Ritual / habit | `approach-automatic-routine` |
| Boredom-driven | need `Stimulation`; approach form remains unanswered |
| Emotional escape | need `Escape`; approach form remains unanswered |
| Social pressure | trigger `Social pressure`; approach form remains unanswered |
| Just thinking about it | `immediacy-thoughts-only` |
| Getting money or resources | `immediacy-steps-started` |
| On my way there | `immediacy-access-close` |
| About to act | `immediacy-about-to-act` |

### Urge or craving

- Capture onset, optional intensity/confidence, situation and buildup, inner
  experience, optional target, chosen next action, action-attempt status, use
  outcome, and optional later intensity/outcome.
- Tools open before the outcome question and provide a reliable return route.
- `unknown` remains stored as `unknown`.

### Anxiety

- Capture type, optional intensity, body location (not “body sensation”), optional
  prediction/context/linked states/reassurance patterns/triggers, explicit urgency,
  reaction, and optional later outcome.
- Urgency is tri-state until intentionally answered. “I need help now” shows human
  and emergency routes as well as self-help tools.
- Reassurance includes a red-flag caveat for new, severe, different, or medically
  concerning symptoms.

### Boredom or restlessness

- Capture one or two restlessness descriptions, optional intensity, stimulation
  needs, classification check, situation, optional urge, relevant rescue choices,
  action, and optional later outcome.
- Craving/anxiety conversion is an explicit action. The Boredom classification is
  saved first, its context is preserved, and the destination does not silently
  overwrite it.
- Social contact, loneliness, and exhaustion receive distinct next-step copy.
- Suggestions linked to a person’s recovery target are excluded where appropriate
  (for example, gaming is not suggested when gaming is the selected target).
- Opening the delay tool is not completion evidence. Stopping early records no
  completed duration. When the full timer actually elapses, completion is written
  idempotently to the Boredom record and canonical answer and survives reload/retry.

### Relapse or return to behaviour

- Capture an optional self-chosen label, actual occurrence time, optional duration,
  optional targets, context/lead-up, support, immediate next step, explicit safety
  check, what was needed, post-save stabilization actions, and optional 0-10 emotion
  after. Numeric zero is a real emotion answer; null is unanswered.
- Safety is never preselected and progression requires an answer. It is a
  multi-select: `none` is exclusive, simultaneous concerns remain complete, and all
  relevant routes can render together. Immediate danger to self/others routes to
  112. Suicide-related support that is not described as immediate danger includes
  113 without conflating it with 112. Substance-specific urgent warnings are shown
  only for relevant substance targets.
- V3 occurrence time is exact and authoritative; the broad relative label is
  derived. Legacy broad-time answers are not replaced with save time when no
  independently supported exact occurrence exists. The v2 prefilled `just-now`
  value and self-label default remain unproven in canonical history.
- The flow is resumable. Canned/custom alternatives cannot coexist, an amount cannot
  survive without a visible target, and compatibility primary scalars cannot create
  an invisible v3 answer.

## Insights contract

- Insights display only fields that were actually answered.
- History, Home, and Insights use completed records only and read stable canonical
  answer IDs before any version-scoped legacy fallback.
- Percentages disclose their denominator and are not shown for tiny or absent data.
- “Success rate,” causal effectiveness, invented severity scores, and ranking a
  relapse as intensity 10 are prohibited.
- The attention summary is based only on an explicit Anxiety urgency answer or one
  or more explicit Relapse concerns. It never infers attention/severity from
  intensity, `highRiskFlag`, reported outcome, or a selected/attempted action.
- Home uses neutral completed-registration activity facts rather than a synthetic
  0-100 risk score.
- Frequencies count one logical answer once. Legacy duplicate aliases are
  normalized before aggregation.
- History and Insights resolve known current stable IDs to English or Dutch labels.
  Well-formed unknown IDs preserved for forward compatibility can fall back to a
  humanized label; that fallback is not reviewed catalog copy. Literal user text is
  never translated as though it were an option ID.

## Content governance

- English and Dutch must receive semantic review, not only key-parity checks. The
  qualified bilingual review is still pending.
- Safety and clinical-adjacent copy must record its source, review date, and reviewer
  status. Until a qualified human review is recorded, copy is described as cautious
  self-help content, not clinically validated guidance.
- `QUALIFIED_CONTENT_REVIEW_PACKET.md` is the controlled bilingual hand-off. A
  completed software pass or the existence of that packet is not reviewer sign-off;
  its credential, issue-log, scenario, and signature fields must be completed by a
  qualified human reviewer.
- Release evidence combines automated gate, option-ID, translation, database,
  import/export, and migration tests with rendered browser checks of interaction,
  safety, responsive layout, and offline behavior. A source-text check alone is
  never treated as proof that a visible branch works.
