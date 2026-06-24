---
name: Anchor tracker type display order
description: Canonical ordering of tracker/registration types across Anchor UI lists.
---

# Canonical tracker type order

The source of truth for the display order of tracker types is the **Home screen
action cards**: `trek → craving → boredom → anxiety → journal → relapse`.

**Rule:** any user-visible list that shows these types in a fixed sequence must
follow that order (e.g. the Logbook tab bar — which omits Journal, so it reads
`trek, craving, boredom, anxiety, relapse`).

**Why:** users learn the order from the Home buttons; a different order elsewhere
feels inconsistent (the Logbook previously diverged).

**How to apply:** slot any new tracker into the Home order. Do NOT reorder
non-display arrays (DB store declarations, store state, the type-validity list)
for cosmetics — they are membership/schema, not display order, and changing them
has no user-visible effect.
