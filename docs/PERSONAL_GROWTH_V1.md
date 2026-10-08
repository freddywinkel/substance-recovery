# Personal growth — first version

Implementation scope: optional everyday moments, chosen reminders, a personal
growth collection and brief self-compassion. Weekly-review changes and an explicit
self-criticism support route are deferred.

## Entry points

- Home's existing `supportive-progress` widget becomes **What I’m building / Wat ik opbouw**. The saved widget order and visibility are preserved. Urgent follow-ups retain priority.
- `/moments/new`: one short text, optional category, explicit opt-in to a Home reminder. Skipping stores no completed record; unfinished input is retained until saved or explicitly cleared.
- `/growth`: all moments or chosen reminders, with edit, reminder toggle and confirmed deletion. Reachable from Home, Journal and supportive actions; no new bottom-navigation tab.
- `/tools/self-compassion/brief`: acknowledge, respond with words or a practical action, choose what is needed. Personal words can be saved, edited or deleted. Stopping requires no answers and records no tool use.
- Existing extended self-compassion remains available. Completed tracker screens use their existing save/navigation handoffs to open the brief route. The quick-registration entry point is shown only with a “safe for now” answer.

## Data contract

`growth-moment` and `compassion-note` are typed, validated records in the existing
IndexedDB `featureRecords` store. They are excluded from recovery-action counts,
symptom summaries and shared reports. New local drafts use the existing
revision-aware draft mechanism and are included in complete backups.

Database v11 is a no-rewrite compatibility barrier. Backup format 4 is required
for new exports, with formats 1–3 still importable. Record edits use an atomic
compare-and-write to reject stale updates and prevent stale edits from reviving
deleted records. Retries after a successful write and failed draft cleanup are
idempotent.

Deleting a personal record also removes its associated unfinished draft in the
same transaction. A content-free local identity marker prevents an old first-save
retry from recreating a deleted record; these markers contain no personal text
and are excluded from exported backups. Conflict recovery keeps unfinished input
until the user explicitly confirms discarding it and loading the latest record.
Starting another moment and clearing it generates a fresh identity.

## Verification and remaining release gate

- On 8 October 2026, all 855 unit/integration tests passed locally, including 44 personal-growth cases and migration coverage for both v9 and v10 databases.
- Workspace and test-source TypeScript checks passed. The production build and GitHub Pages/PWA artifact verification passed with Node 24 and the pinned pnpm 11.9.0.
- All 48 Chromium browser tests passed against the final production build, without retries. The 12 personal-growth scenarios cover draft survival, offline saving, opt-in reminders, edits/deletion, skipping, storage failures, self-compassion words, backup restoration, cross-tab conflict recovery, fresh identity after draft discard, Home visibility and the quick-registration safety gate. Existing route, Home ordering and 200% text checks also passed.
- Generated Dutch mobile and 320px English screenshots were visually inspected. A local in-app-browser PWA update retained a synthetic saved moment without clearing site data. This is desktop browser evidence, not an installed physical-mobile-PWA result.
- `PWA_TEST_PORT=8754` isolated browser verification from another checkout's running preview. Set `CI=1` to require the test runner's own server instead of reusing an existing one.
- Available transitive dependency patches were applied in the lockfile without changing manifests or suppressing advisories. Audit totals are 0 critical, 1 high and 1 moderate. The existing high-severity CI gate still fails on `braces@3.0.3` in the legacy API/mockup dependency paths. The registry's latest version is 3.0.3 and the [GitHub advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) lists no patched release. The moderate `postcss-selector-parser` finding through Tailwind typography also remains.
- Before release: resolve the dependency gate, verify an installed mobile PWA update without clearing site data, and obtain qualified human content review as documented in the review packet. This change is a review candidate and has not been deployed.

Only synthetic fixtures belong in tests and screenshots. No personal histories,
research attachments or user recovery records are included in source control.
