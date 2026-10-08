# Personal growth — phases 1 and 2

Implementation scope: optional everyday moments, chosen reminders, a personal
growth collection, brief self-compassion, expanded weekly reflection and an
explicit self-criticism support route.

## Entry points

- Home's existing `supportive-progress` widget becomes **What I’m building / Wat ik opbouw**. The saved widget order and visibility are preserved. Urgent follow-ups retain priority.
- `/moments/new`: one short text, optional category, explicit opt-in to a Home reminder. Skipping stores no completed record; unfinished input is retained until saved or explicitly cleared.
- `/growth`: all moments or chosen reminders, with edit, reminder toggle and confirmed deletion. Reachable from Home, Journal and supportive actions; no new bottom-navigation tab.
- `/tools/self-compassion/brief`: acknowledge, respond with words or a practical action, choose what is needed. Personal words can be saved, edited or deleted. Stopping requires no answers and records no tool use.
- Existing extended self-compassion remains available. Completed tracker screens use their existing save/navigation handoffs to open the brief route. The quick-registration entry point is shown only with a “safe for now” answer.
- `/weekly-review`: three optional reflection questions (remembering the week, choosing for oneself and making room for next week), plus an optional enjoyable activity. One answer is enough. The existing pattern/supportive-plan flow remains available in an optional section; skipping creates no completed review. Saved reviews can be edited or explicitly deleted, and current/previous-week drafts remain separate.
- `/tools/self-criticism`: an explicit entry from Home and Tools with four choices: grounding, brief self-compassion, chosen growth reminders or help/contact options. It opens no automatic assessment, registration or external communication. Direct Help and the action card remain available, and the user can stop without answering anything.

## Data contract

`growth-moment` and `compassion-note` are typed, validated records in the existing
IndexedDB `featureRecords` store. They are excluded from recovery-action counts,
symptom summaries and shared reports. New local drafts use the existing
revision-aware draft mechanism and are included in complete backups.

Database v12 is a no-rewrite compatibility barrier, extending phase 1's v11.
Backup format 5 is required for new exports, with formats 1–4 still importable. Record edits use an atomic
compare-and-write to reject stale updates and prevent stale edits from reviving
deleted records. Retries after a successful write and failed draft cleanup are
idempotent.

Deleting a personal record also removes its associated unfinished draft in the
same transaction. A content-free local identity marker prevents an old first-save
retry from recreating a deleted record; these markers contain no personal text
and are excluded from exported backups. Conflict recovery keeps unfinished input
until the user explicitly confirms discarding it and loading the latest record.
Starting another moment and clearing it generates a fresh identity.

Weekly reviews add optional `rememberFromWeek`, `choseForMyself`,
`makeRoomForNextWeek` and `pleasantActivity` strings (2000 characters each).
Legacy reviews and unfinished drafts remain readable. Reflection-only reviews
need no symptom pattern or supportive plan. Compare-and-write preserves existing
review identities, blocks conflicting period creation and stale overwrites, and
makes cleanup retries idempotent. Deletion atomically removes the record and its
associated draft, using a content-free local ID marker to prevent revival by an
old retry. New fields stay out of selective reports and are included in complete
backups. The optional activity has no completion score, streak or reminder.

## Verification and release checks

- On 8 October 2026, all 880 unit/integration tests passed locally across 41 files, including 44 personal-growth cases, 24 weekly-reflection cases and migration coverage for v9, v10 and v11 databases.
- Workspace and test-source TypeScript checks passed. The production build and GitHub Pages/PWA artifact verification passed with Node 24 and the pinned pnpm 11.9.0.
- All 60 Chromium browser tests passed against the final production build, without retries. The 12 personal-growth scenarios cover draft survival, offline saving, opt-in reminders, edits/deletion, skipping, storage failures, self-compassion words, backup restoration, cross-tab conflict recovery, fresh identity after draft discard, Home visibility and the quick-registration safety gate. Seven weekly-reflection scenarios cover optional planning, weeks without problem records, help/week navigation, offline saves, edit/discard/delete/recreate, failed-write and cleanup retries, conflicts, legacy plans and backup replacement. Five self-criticism scenarios cover entry points, support choices, chosen-only memories, immediate help, no automatic records and narrow NL/EN layouts. Existing route, Home ordering and 200% text checks also passed.
- Generated Dutch and English mobile screenshots for weekly reflection and self-criticism were visually inspected, including 320px layouts. A local in-app-browser update from phase 1 to phase 2 retained a synthetic saved moment without clearing site data. This is desktop browser evidence, not an installed physical-mobile-PWA result.
- `PWA_TEST_PORT=8754` isolated browser verification from another checkout's running preview. Set `CI=1` to require the test runner's own server instead of reusing an existing one.
- The release dependency audit reports no known vulnerabilities. The legacy API uses its existing `httpxy@0.5.5` transport directly, and mockup discovery uses Node 24's native filesystem glob instead of `fast-glob`. These changes remove the vulnerable `braces` chain. The unused Tailwind typography plugin was removed, eliminating the remaining selector-parser advisory. The full-workspace high-severity audit gate remains unchanged.
- Ten tooling regression tests cover proxy streaming, path/query/header/cookie behavior, error and disconnect cleanup, and mockup file discovery. They run with the standard test command. The API and mockup builds also passed locally.
- An automated browser update test used a snapshot of the actual public build `d13641d` and the release candidate. It retained a saved synthetic journal entry and an unfinished plan through the v10-to-v12 update, blocked updating while a draft write failed, succeeded after retry, and retained the journal offline with no runtime errors.
- Deployment is authorized by the user and must pass the GitHub workflow before publication. The pull request and its linked workflow contain publication evidence. Physical installed-mobile-PWA verification and qualified human content review remain separate, pending evidence; automated checks do not establish either.

Only synthetic fixtures belong in tests and screenshots. No personal histories,
research attachments or user recovery records are included in source control.
