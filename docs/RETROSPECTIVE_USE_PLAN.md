# Retrospective use: audit and implementation plan

The user wants to fill gaps after a relapse without completing a reflection for every missed day. Retrospective use belongs in the totals and history, as clarified on 9 October 2026.

## Audit findings

- Goals count confirmed, target-specific quick and completed detailed registrations, but cannot describe a missed period.
- A period must not manufacture individual moments or assume daily use.
- Goals with an optional blank start date disappear from progress.
- Last-use information is calculated but not shown on Home.
- Date ranges require calendar-day calculations, overlap handling, safe corrections, backup validation and offline persistence.
- Existing multi-target registrations used the registration date even when a substance had an explicit later use date. That could produce incorrect last-use dates and count a moment twice with a retrospective period.

## Plan

1. Add a short, optional-reflection form from Home and Registrations: target, first use day, last use day, daily/some days/unknown frequency, optional note. One day uses the same flow. Date boundaries explicitly describe reported use days; no time of day is invented.
2. Store a typed `use-period` feature record locally, with retained drafts, strict date/target validation, atomic conflict-safe save/delete, and existing full-backup support. Reject overlapping periods for the same target so users correct the original rather than double count it.
3. Include retrospective periods in goal totals. Show individual moments and periods separately. Moments covered by a period remain in history but do not add another unit to the combined count. Count unique reported use days only from daily coverage and explicit use-day evidence; some/unknown frequency stays a lower bound.
4. Display the last recorded use day and calendar days since it, with wording that does not certify abstinence. Keep the chosen journey start and prior effort intact. Display goals without a start date instead of hiding them.
5. Provide a period history with edit/delete and links from the registration history. Include the same goal summary in Insights. Preserve selective report consent and avoid fabricating reflection data.
6. Verify meaningful analytics, validation, persistence/backup and conflict cases; exercise the real form, totals, corrections and offline behavior in a production PWA. Run required release checks, deploy through GitHub Pages, and verify the public build and an old-client update without clearing data.

## Acceptance example

An Alcohol period from 1–14 September marked daily is one retrospective period and 14 reported use days. An already recorded Alcohol moment on 7 September stays in history and is covered by that period for the combined total. The last reported use day is 14 September, regardless of when the period was entered. Frequency `some-days` or `unknown` does not infer use on all fourteen days.

## Implemented and verified

- Home, registration history and Insights expose the flow and a shared target-specific summary.
- Each retrospective record describes explicit first and last use days; single-day input and a two-week date preset are supported. Frequency defaults to unknown and notes are optional.
- Reports include retrospective periods only through a separate unticked selection. Notes require their own selection, and crossing date ranges show the original boundaries plus the part inside the chosen range.
- DB v13 is a compatibility barrier for older clients; upgrading leaves existing stores and records intact. Drafts, save/delete revisions, deleted-record markers and backup overlap checks prevent stale writes or duplicate periods.
- Optional goal start dates display correctly, day calculations handle daylight-saving transitions, and valid per-target use times determine overlap and last-use dates.
- Local validation: 913 unit/integration tests, 10 release-tool tests, workspace/test TypeScript checks, dependency audit with no known vulnerabilities, production build and PWA artifact verification. Browser and public-release evidence is recorded in the pull request and release outcome.
