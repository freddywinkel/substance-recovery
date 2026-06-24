---
name: Anchor single→multi-select backward-compat pattern
description: How Anchor trackers add multi-select fields without breaking old IndexedDB records, and the summary/edit desync trap.
---

When converting an Anchor tracker question from single-select to multi-select, keep old IndexedDB records readable WITHOUT bumping the DB version:

- ADD a new plural array field (e.g. `triggers[]`); keep the legacy singular field (e.g. `trigger`) optional. Never remove the singular.
- Normalize on READ everywhere via a helper: `arrOr(plural, singular)` in Logs.tsx, `pluralOr(plural, singular)` in analytics.ts (returns `plural` if non-empty, else `[singular]`, else `[]`).
- On EDIT (Logs.tsx) patch BOTH: `onChange={v => patch({ plural: v, singular: v[0] || "" })}`.

**Why:** old records only have the singular; new flows write the plural and mirror `singular = v[0]`. Reads must fall back; edits must keep both in sync or the next read diverges.

**The trap:** it is easy to make the per-entry *summary* plural-aware (`arrOr(...)`) while leaving the *edit* control as `ChipSingle` bound to the singular only — editing a multi-value entry then silently drops/desyncs the plural. Every converted field must use `ChipMulti` + dual-patch in the edit switch, not just in the summary.

Anxiety/boredom outcome feedback reuses the pre-existing `outcomeAfter` field (now typed `"decreased"|"same"|"increased"|null`); the old trackers never actually wrote it, so no legacy string values exist to normalize against.
