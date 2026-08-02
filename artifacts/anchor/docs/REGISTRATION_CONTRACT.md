# Anchor registration contract

Status: canonical product contract for registration data version 2.

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
2. An unanswered value is `null` or absent. It must never be converted into `0`,
   `false`, `none`, `no concern`, or a midpoint measurement.
3. `unknown` is a real answer, distinct from unanswered.
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
10. Core answers are read-only in History to preserve an audit trail. Notes may be
    edited. A materially incorrect record is deleted and entered again.

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

- Capture type, optional intensity/confidence, planning stage, context, inner
  experience, underlying needs, optional target, chosen next action, whether the
  action was attempted, and reported use outcome.
- Selection caps are visible before interaction. Once a cap is reached, unselected
  options are disabled; an existing answer is never silently removed.
- The done message reflects the reported outcome, not the selected intention.

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
- Social contact, loneliness, and exhaustion receive meaningful next-step content.
- Suggestions linked to a person’s recovery target are excluded where appropriate
  (for example, gaming is not suggested when gaming is the selected target).

### Relapse or return to behaviour

- Capture an optional self-chosen label, actual occurrence time, optional duration,
  optional targets, context/lead-up, support, immediate next step, explicit safety
  check, what was needed, and post-save stabilization actions.
- Safety is never preselected. Immediate danger to self/others routes to 112 and
  appropriate crisis support. Substance-specific urgent warnings are shown only for
  relevant substance targets.
- The flow is resumable. Historical time choices affect `occurredAt`.

## Insights contract

- Insights display only fields that were actually answered.
- Percentages disclose their denominator and are not shown for tiny or absent data.
- “Success rate,” causal effectiveness, invented severity scores, and ranking a
  relapse as intensity 10 are prohibited.
- Frequencies count one logical answer once. Legacy duplicate aliases are
  normalized before aggregation.
- History and Insights resolve stored stable IDs to English or Dutch labels; raw
  internal IDs are never shown.

## Content governance

- English and Dutch receive semantic review, not only key-parity checks.
- Safety and clinical-adjacent copy must record its source, review date, and reviewer
  status. Until a qualified human review is recorded, copy is described as cautious
  self-help content, not clinically validated guidance.
- Release evidence combines automated gate, option-ID, translation, database,
  import/export, and migration tests with rendered browser checks of interaction,
  safety, responsive layout, and offline behavior. A source-text check alone is
  never treated as proof that a visible branch works.
