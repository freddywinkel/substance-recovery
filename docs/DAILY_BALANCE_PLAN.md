# Connected daily balance

## Product decision

Integrate MoodTracker as a native, optional part of Anchor. Keep the existing app shell, five navigation positions, recovery registrations and tool pages. The daily page is available from More and Insights; its Home card is opt-in through Edit Home. No Fitbit or external synchronization.

Three connected views:

1. **Daily check-in:** one editable summary per local calendar date. Optional sleep duration, mood, emotional intensity, craving, drive, fatigue, enjoyment and notes. Missing answers stay missing; zero is a real answer.
2. **Activity moment:** mood, emotional intensity and craving before an app tool, walking, painting or a freely named activity. A craving or saved quick registration can start a linked moment without finishing or duplicating that registration.
3. **Afterward:** explicitly record whether the activity was tried and independently rate mood, emotional intensity and craving again. Opening a tool does not prove it was tried. Tool pages link back to the moment. Moments appear in the day's timeline; copying a latest rating into the evening reflection is an explicit choice.

## Rating meanings

- Mood: five labeled choices from very low to very good; stored as -2 through +2.
- EIS: personal emotional intensity, integer 0–100. Zero means no intensity; 100 means extremely strong. Intensity may accompany pleasant or unpleasant emotions. This is a personal tracking scale, without diagnostic thresholds.
- New craving measurements: 0–10. Existing imported MoodTracker daily craving: 0–3, visibly labeled and never silently converted or averaged with 0–10.

The 0–100 format is informed by common subjective distress scaling, including [CCI's SUDS example](https://www.cci.health.wa.gov.au/~/media/CCI/Mental-Health-Professionals/Anxiety/Anxiety---Information-Sheets/Anxiety-Information-Sheet---06---Situational-Exposure.pdf). General emotional intensity is broader than distress; this app's EIS is not presented as a validated clinical instrument. Before/after differences describe personal observations, not proof of activity effectiveness.

## Persistence and migration

- Add `daily-balance` and `balance-moment` records to the existing IndexedDB feature store. Database version 14 is an additive compatibility barrier protecting new records from older app parsers.
- Use revision-aware local drafts, transactional writes, stale-edit conflicts, deletion guards and a reset marker. Preserve unfinished input across navigation, offline use and worker updates.
- Anchor backup version 6 includes both record types and drafts, retaining compatibility with supported older backups.
- Dedicated MoodTracker JSON import validates the whole file, previews date conflicts, and offers keep-Anchor or incoming-day resolution. Only daily data and drafts are imported; original MoodTracker data, Anchor settings, contacts and activity moments remain separate.
- No automatic cross-app storage access. Keep the standalone MoodTracker deployment available during transition.

## Acceptance checks

- Native layout in Dutch and English at phone and tablet widths, accessible labels and keyboard controls.
- Before → custom activity/tool → after → daily timeline, including explicit attempt/no attempt and partial ratings.
- Craving draft/resume and quick-registration source linking without duplicate recovery events.
- Strict scales, unanswered versus zero, editing/deleting, old backups, import conflicts, invalid raw sleep drafts, stale tabs and atomic persistence failure.
- Production base path, manifest identity, offline reload, previous-client worker update and saved-data/draft retention.
- CI gates, then verify the public deployment and a synthetic live user flow. Physical iOS installation is a separate evidence boundary.
