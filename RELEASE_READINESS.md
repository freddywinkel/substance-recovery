# Release readiness — 12 October 2026

Verdict: **READY FOR LIMITED BETA**. No known P0/P1 finding remains in the tested scope. Physical installed-device, assistive-technology and qualified content review gates remain open.

This is the pre-deployment audit snapshot. The user separately authorized deployment on 12 October 2026 after reviewing this audit. Publication proceeds through the existing CI and Pages gates, followed by public build and prior-client update verification. Consult the [deployment workflow](https://github.com/freddywinkel/substance-recovery/actions/workflows/deploy-pages.yml) for current publication status; the local audit results below do not by themselves establish that a release is live.

## Product and scope

Anchor / Substance Recovery is a Dutch-first, bilingual, local-only recovery companion. Its useful outcome is to record an experience, choose support and reflect later without needing an account or connection. Daily balance adds an evening check-in and linked mood/EIS/craving before and after an activity. It preserves the existing visual identity and five-position navigation. EIS 0–100 is a personal intensity rating, not a validated clinical instrument. No Fitbit, analytics, remote records, cloud sync or new product capabilities are added in this audit.

This is an engineering and heuristic usability review, not user research, clinical approval, a security guarantee or a WCAG conformance certificate. The target is WCAG 2.2 AA. Physical phone installation and assistive-technology behavior require separate evidence.

Starting source: `b195819e9dd008ca445bfe92f7e128afb83f4c87` (`origin/main` verified read-only before release on 12 October). The prior clean branch `e300a49d7c38258600e65010cfa681a0d1eac4d4` had an identical tree. Work is on branch `codex/release-readiness-2026-10-12` in `substance-recovery-daily-balance`. No applicable AGENTS.md was found in this checkout or its ancestors. Other worktrees and their uncommitted work were not edited. The audit request excluded publication; the subsequent explicit deployment request supplies that authorization.

### Screen and data map

| Surface | Purpose and principal paths | Persistence / dependencies |
| --- | --- | --- |
| Start / More | Optional Home cards, quick access, settings and feature discovery | Local preferences; five navigation positions retained |
| Help / action card | Immediate help links and the person's saved support plan | Eager-loaded routes; phone provider / chosen external site only when activated |
| New / registrations | Quick entry, planned urge, craving, anxiety, boredom and return-to-use reflection; history and corrections | IndexedDB registrations and active/suspended drafts; explicit action and outcome meanings |
| Tools | Breathing, grounding, urge surfing, sensory reset, distraction, tape-forward and self-compassion | Local exercises; optional linked return to a registration or balance moment |
| Daily balance | Date-specific daily summary, activity moments, history and 14-day table | `daily-balance` / `balance-moment` feature records and revision-aware raw drafts |
| Journal / growth | Notes, search/date filters, positive moments and personal words | Journal and feature records, independent from symptom summaries |
| Plan / review / insights / reports | Goals, support/care plan, weekly reflection, descriptive patterns, chosen export | Local records; explicit sharing/export; no diagnostic inference |
| Settings | Theme/language, personal/care contacts, install guidance, backup/import/reset | IndexedDB authoritative; optional display metadata in localStorage |

Data flow: form → local draft → validated transaction → saved record → descriptive history/insights. Full backup format 6 includes saved records and unfinished drafts. Formats 1–5 remain supported. MoodTracker import is separate, previews conflicts and preserves the original 0–3 craving scale. The Pages artifact is static; legacy server/API packages in the monorepo are not deployed dependencies.

## Priorities and findings

Severity: P0 critical/app-wide; P1 critical journey or data loss; P2 meaningful issue with an alternative; P3 optional polish. Confidence is independent of severity.

| ID | Area | Finding / user impact | Evidence | Severity | Confidence | Proposed fix | Status | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RR-01 | Data integrity | A stale window can resurrect pre-reset blank journal drafts or first-save growth records after Delete all data. A privacy deletion does not stay deleted. | Synthetic fake-IndexedDB reproduction: `writeLocalDraft(..., revision 0)` and first growth commit succeed after reset; daily balance already had stronger protection. | P1 | High | Transactional generation check shared by all persisted writes; DB15 compatibility barrier; require a reload after reset/full import. | FIXED | PASS: 20 dedicated regressions, 12 lifecycle tests; native two-window erase/replace on candidate3 retains input, denies stale writes and allows fresh writes after reload. |
| RR-02 | PWA / multiple windows | Updating from a window with an older registration can overwrite a newer saved draft; activation can reload failed input. A window missing the waiting-worker event can also remain on old code. | Real-worker reproductions: text B returned to A, warning disappeared; candidate3 editor missed the external waiting-worker event. | P1 | High | Flush each window's own queue; guard both library reload callbacks and native replacement-controller events, leaving first install alone. | FIXED | PASS: published DB14→candidate6 DB15 and candidate6→next6 actual builds, saved and failed registration/plan cases, explicit retry, offline reload and unrelated-cache retention. No first-install reload, runtime errors or native dialogs. |
| RR-03 | Accessibility | Amber text and several dimmed paragraphs have insufficient contrast, including help, grounding and daily actions. | Stable-render axe measurements: approximately 3.48–3.78:1 for original light text; three dark paragraphs 3.50–4.41:1. | P2 | High | Darken the light primary token from 40% to 30% lightness; remove three opacity reductions; use foreground text on two tinted cards. | FIXED | PASS: 104 route/theme/language/viewport cases plus 15 populated states, zero axe violations; examples and screenshot pairs below. |
| RR-04 | Release operations | README says backup5/DB12 and the original plan proposes cloud sync; operators could choose an incompatible rollback or misunderstand data transfer. | README import section and `artifacts/anchor/PLAN.md` contradict actual backup6/DB14 baseline. | P2 | High | Document actual formats, DB15 candidate, local-only scope, compatible rollback and previous-client checks; mark scaffold plan historical. | FIXED | PASS: source checked against validation/schema/build/workflow and separately reviewed. |
| RR-05 | Specialist / device evidence | Qualified bilingual health-content review and physical installed-device tests have no sign-off. | `QUALIFIED_CONTENT_REVIEW_PACKET.md` remains PENDING; browser automation is the available environment. | P1 for broad mobile release | High | Limit beta scope; obtain scoped human review and device acceptance before broader release claims. | OPEN | NOT RUN: qualified review, VoiceOver/TalkBack and physical installation. |
| RR-06 | Concurrent registrations | Two windows editing the same registration can overwrite each other's draft; a stale completed save can overwrite a newer completed record even after a draft conflict. | Synthetic actual-source reproduction: draft CAS rejects stale text, then the old completed-record `put` still replaces the shared record ID. | P1 | High | Compare the active/suspended snapshot transactionally for both draft and completed saves; retain failed input and offer explicit saved-version reload. | FIXED | PASS: 5 session and 22 completion tests; native stale final save, retained input and failed unrelated draft recovery in all three engines. |
| RR-07 | Keyboard | WebKit users cannot keyboard-scroll the Privacy content region. | Tab + PageDown stays outside the region; scrollTop remains 0 despite 442px overflow. | P2 | High | Make the labeled region focusable with a visible focus outline. | FIXED | PASS: keyboard focus and scroll 0→442; regression passed in Chromium, Firefox and WebKit. |
| RR-08 | Navigation focus | A slow lazy route misses the single-frame heading focus/title update. | With a 350ms chunk delay, focus stays on the old navigation/BODY and title stays generic. | P2 | High | Wait for the heading to mount; cancel focus movement if the user has already continued interacting. | FIXED | PASS: delayed-route and continued-interaction regressions in all three engines. |
| RR-09 | Large histories | Journal renders all 1,000 entries, making a long history sluggish. | 16,108 DOM nodes; 913ms normal / 3,092ms at 4× CPU slowdown in local lab. | P2 | High | Initially render 50 matching entries; append 50 per Show more; keep search across the complete history. | FIXED | PASS: regression fails on baseline and passes after repair. 16,108→910 nodes; 4× CPU initial render 3,092→1,111ms; all 1,000 records and oldest-match search retained. |
| RR-10 | Statistics | Future-dated cigarette imports count as already smoked; elapsed time stays stale while the screen is open. | Tomorrow's synthetic record counts as 1 today/week/month and gives −86,400,000ms elapsed. | P2 | High | Exclude future/deleted/invalid timestamps from current calculations; refresh on minute ticks and visibility return. | FIXED | PASS: three exact-value tests plus real component timer regression in all three engines: 1→0 today across midnight, elapsed 1m, one unchanged stored event. |
| RR-11 | Deployment | Manual workflow dispatch from another branch can reach Pages deployment steps. | `workflow_dispatch` plus event-only deployment conditions. | P2 | High | Require `refs/heads/main` for Pages configuration, upload and deployment. | FIXED | PASS source review; NOT RUN GitHub workflow, because this task is local only. |
| RR-12 | Performance | Entry bundle remains substantial. | Baseline entry 821,266 bytes raw / 250,372 gzip; local lab FCP 100ms normal / 392ms at 4× CPU. | P3 | High | Defer further splitting until physical-device/network measurements identify a bottleneck. | DEFERRED | Build warning retained; no speculative dependency or routing rewrite. |
| RR-13 | Error-state reflow | A long conflict warning overflows at 320px/200% text; simultaneous failed-save and update warnings can cover Help. | Candidate2 conflict banner 1,194/954px tall; candidate4 stacked update panel top −665px. Found while validating the new failure paths. | P2 | High | Bound and keyboard-enable both warning regions; retain complete text and reachable recovery actions. | FIXED | PASS: conflict warning in all engines; actual-worker stacked warning in NL/EN at 320px/200%, plus final candidate6 regression preserving Help, keyboard actions and Retry→Update. |
| RR-14 | Update timing | Typing another ordinary draft change during a delayed flush is outside its first queue snapshot. The existing beforeunload guard can become the recovery path. | Three delayed-queue regressions fail on baseline; registration queue already drains to completion. No silent data loss reproduced. | P2 | High | Drain newly queued local writes before proceeding; retain failure/retry behavior. | FIXED | PASS: same-key/new-key late writes and late failure blocked until explicit successful retry; separate peer review and final worker tests. |

Significant UX changes use the existing design language. RR-03: low-contrast action labels → harder recognition, particularly in light mode → slightly darker amber → more legible unchanged controls → automated ratios plus rendered checks. RR-01/02: apparent save/update success can hide data loss → guard writes/reloads and offer recovery → retained input and honest status → fault-injected multi-window tests. These are heuristic benefits, not measured user-study outcomes.

RR-09: rendering a large history delays use → initially show 50 results with an explicit count → faster access while keeping every record searchable → before/after lab measurement and a 1,000-record regression. Common search still needs one input action; revealing entries 51–100 adds one Show more action. No fields or useful capabilities were removed. The end-of-day flow and five navigation positions remain unchanged.

## Main journeys

| Journey | Baseline result | Final result / evidence |
| --- | --- | --- |
| New user: reach a useful outcome, save a note-only journal entry, find Help | PASS in Chromium production suite; no mandatory onboarding/account | PASS: final Chromium suite and focused Firefox/WebKit checks |
| Craving / quick entry → app help or own activity → attempted status → after mood/EIS/craving → evening summary | PASS, including explicit score copy, missing versus zero and no duplicate recovery event | PASS: final suite, including stale completion rejection and explicit conflict recovery |
| Returning user: resume unfinished forms, edit/delete history, review weekly/goal patterns and preserve local settings | PASS for covered journeys; extra reset race FAIL (RR-01) | PASS: final suite, dedicated generation/migration regressions and native two-window reset/restore |
| Backup preview → export/import/replace, including MoodTracker conflicts and raw drafts | PASS for covered journeys; stale window after replacement included in RR-01 fix scope | PASS: full roundtrips, malformed import rejection, raw drafts and MoodTracker original ratings retained |
| Cached app → offline entry/reload → reconnect/update with unsaved input | PASS single-window baseline; multiple-window update FAIL (RR-02) | PASS: final two-build worker transitions and offline recovery; WebKit uses the separately documented server-stopped procedure |

## Verification method and commands

Commands run from the repository root on Windows, Node `24.18.1`, pinned pnpm `11.9.0`. Because ambient pnpm differs, commands below use `npm exec --yes --package=pnpm@11.9.0 -- pnpm` (denoted `PNPM` in this report). The npm wrapper reports benign unknown `.npmrc` option warnings; pnpm executes the pinned configuration. No dependency changes are planned.

| Check | Exact command / procedure | Baseline observed result | Final result |
| --- | --- | --- | --- |
| Workspace types | `PNPM typecheck` | PASS | PASS on final source |
| Test-source types | `PNPM typecheck:tests` | PASS | PASS; final regression additions included |
| Unit/integration + release tools | `PNPM test` | PASS: 944 app tests / 45 files; 10 release-tool tests | PASS: 1,001 app tests / 50 files; 10 release-tool tests |
| Dependency advisories | `PNPM audit --audit-level high` | PASS: no known vulnerabilities | PASS: no known vulnerabilities; lockfile unchanged |
| Production build | `$env:BASE_PATH='/substance-recovery/'; $env:ANCHOR_BUILD_ID='audit-baseline-b195819'; PNPM --filter @workspace/anchor run build` then copy `index.html` to `404.html` | PASS; 72 precache entries, 1881.27 KiB. >500 kB chunk warning retained for measurement. | PASS: independently built `release-readiness-candidate6-20261012` and `release-readiness-next6-20261012`; 72 precache entries, 1890.68 KiB each. Same command, different build IDs. |
| PWA artifact | `PNPM verify:pwa` | PASS, expected Pages scope/start URL and fallback | PASS for both final artifacts |
| Chromium production journeys | `$env:PWA_TEST_ROOT='tmp/release-readiness-2026-10-12/baseline'; $env:PWA_TEST_PORT='8782'; PNPM exec playwright test --output=tmp/release-readiness-2026-10-12/baseline-browser-results` | PASS: 88 tests, 3.3 minutes | PASS: candidate6, 100 tests, 4.0 minutes; final command below |
| Additional browser engines | Focused suite using the local cross-browser config | NOT RUN at baseline; fixtures were added during audit | PASS: candidate6 Firefox20 and WebKit17; three WebKit offline-emulation cases BLOCKED, three server-stopped equivalents PASS |
| Lint | No lint script/configured release gate | NOT APPLICABLE; type/source review used | NOT APPLICABLE |
| Accessibility / responsive | Stable-render axe scan, screenshots, explicit keyboard checks; details below | RR-03 confirmed | PASS within automated/keyboard scope; physical and assistive-technology checks NOT RUN |
| Old/current worker | Real separately built artifacts served at same isolated origin; normal update prompt | RR-02 confirmed | PASS: published14→candidate6 and candidate6→next6; exact commands below |
| Public deployment | No deploy/push/commit in this request | NOT RUN for candidate | NOT RUN; candidate remains local. Read-only live GET still shows b195819, HTTP200, Cache-Control max-age=600, HSTS max-age=31556952. |
| Accounts / payment / queues / server authorization | Not part of deployed architecture | NOT APPLICABLE | NOT APPLICABLE |

Baseline logs: `tmp/release-readiness-2026-10-12/baseline-{tests,build,browser}.log`. Baseline artifact is retained at `tmp/release-readiness-2026-10-12/baseline` and not overwritten by candidate builds. Evidence under `tmp` is local and ignored by Git; keep it with the review handoff when transferring this checkout.

Final logs: `final-typecheck.log`, `final-test-typecheck.log`, `final-tests.log`, `final-audit.log`, `final-browser.log`, `final-cross-firefox.log` and `final-cross-webkit.log` under the same directory. The immutable candidate is `candidate6`; `candidate-next6` was separately built from the same source with a different build ID to exercise real worker replacement. The broad UI scan uses candidate3; later changes only affected update guards, draft flushing and the separately retested warning panel. Reset native evidence uses candidate3 with the same final generation guard. No evidence is described as physical-device testing.

Final browser and worker commands (PowerShell; `PNPM` expands to the exact pinned wrapper specified above):

```powershell
$env:PWA_TEST_ROOT='tmp/release-readiness-2026-10-12/candidate6'
$env:PWA_TEST_PORT='8782'
PNPM exec playwright test --output=tmp/release-readiness-2026-10-12/final-browser-results

$env:PWA_TEST_PORT='8786'
$auditSmokePattern='journal note-only|custom activity keeps|plan draft survives|downloaded backup restores|quick intensity has keyboard|MoodTracker import previews|daily and moment views fit|record conflicts reload|large journal history|release-readiness-a11y|cigarette counter updates|a stale final save|a stale registration retains'
PNPM exec playwright test --config=tmp/release-readiness-2026-10-12/cross-browser.config.ts --project=firefox --grep=$auditSmokePattern --output=tmp/release-readiness-2026-10-12/final-cross-firefox-results
PNPM exec playwright test --config=tmp/release-readiness-2026-10-12/cross-browser.config.ts --project=webkit --grep=$auditSmokePattern --grep-invert='daily and moment views fit|large journal history|plan draft survives' --output=tmp/release-readiness-2026-10-12/final-cross-webkit-results
# Only the three independently diagnosed offline-emulation cases are excluded.
# Their unchanged app assertions were separately exercised with a stopped origin:
node tmp/release-readiness-2026-10-12/verify-webkit-origin-offline.mjs

$env:PWA_TEST_ROOT='tmp/daily-balance-release/deployed-public'
$env:PWA_UPDATE_ROOT='tmp/release-readiness-2026-10-12/candidate6'
$env:PWA_TEST_PORT='8784'
$env:PWA_EXPECTED_PRIOR_DB_VERSION='14'
$env:PWA_EXPECTED_NEXT_DB_VERSION='15'
$env:PWA_UPDATE_EVIDENCE='tmp/release-readiness-2026-10-12/operations/published14-to-candidate6'
node scripts/verify-daily-balance-update.mjs

$env:PWA_TEST_ROOT='tmp/release-readiness-2026-10-12/candidate6'
$env:PWA_UPDATE_ROOT='tmp/release-readiness-2026-10-12/candidate-next6'
$env:PWA_UPDATE_EVIDENCE='tmp/release-readiness-2026-10-12/operations/candidate6-to-next6-multitab'
node scripts/verify-pwa-multitab-update.mjs

$env:PWA_TEST_ROOT='tmp/release-readiness-2026-10-12/candidate3'
$env:PWA_TEST_PORT='8787'
$env:PWA_RESET_EVIDENCE='tmp/release-readiness-2026-10-12/reset-native-candidate3'
node scripts/verify-storage-reset.mjs
```

The cross-engine config uses the existing Playwright setup with Firefox/WebKit projects, one worker and exclusive ownership of port8786. The WebKit server-stopped script explicitly uses candidate4. No test assertion was removed to turn the driver failure into a pass. Detailed procedures, screenshots and baseline reproductions: `ui/UI_AUDIT_EVIDENCE.md`, `data-audit.md` and `operations/operations-audit.md` in the evidence directory.

### Environments and evidence boundaries

Windows desktop, headless Chromium 151.0.7922.34, Firefox 153.0 and WebKit 26.5 are available. Browser profiles contain synthetic data only. Phone/tablet/desktop widths (320, 390, 820 and 1440 CSS pixels), light/dark and NL/EN combinations are viewport tests. Text enlargement sets the root font to 200%; this is separate from physical browser zoom. No actual iPhone, iPad, Android or installed standalone window was tested.

Baseline operations inspection visited 31 routes offline after worker control, with zero unhandled page errors, failed requests or external requests. Timings use an unthrottled localhost server and Chromium CPU throttling, not a physical mobile device, field metrics or a Lighthouse score. Baseline total assets were 1,861,132 raw bytes / 543,562 gzip; Insights was a separate 111,680-byte gzip chunk. Performance evidence: `operations/operations-measurements.json` and `operations/large-history-result.json` under the evidence directory.

The same 1,000-note / 365-day / 1,000-moment synthetic dataset on candidate4 produced 910 Journal DOM nodes rather than 16,108. Initial render was 872ms normal / 1,111ms at 4× CPU; keyword search over 100 matches was 54/452ms versus 105/669ms baseline, and Today filtering 46/131ms versus 132/765ms. The oldest note remains searchable. These are single local lab samples; unrelated timings varied, so no general app speed or mobile-performance claim is made. Evidence: `operations/large-history-candidate4-result.json`. Final candidate6 has 57 assets: 1,870,757 raw / 546,510 gzip bytes; entry 829,949 raw / 253,021 gzip (2,649 gzip bytes above baseline). Further splitting is deferred.

An initial cross-engine run was invalidated by two test harnesses sharing a port; connection-refused results were harness failures, not app failures. Final runs reserve distinct ports per owner. Baseline failing reproductions and intermediate accessibility failures are retained rather than relabeled as passes.

The first full candidate unit run found three legacy migration assertions still expecting DB14. They were updated to the intended DB15; legacy fixture contents and all record-preservation assertions remain unchanged. The repeat passed all 998 app tests. The clock regression also fails on the immutable baseline: Today's count does not change after the clock crosses midnight.

Source changes receive a separate review by another task agent sharing this checkout; this is peer review, not an external security assessment. Test fixture changes explicitly simulate a full app reload after fixture reset/import. Production exposes no generation-reset API, and reset-isolation regressions use the real guard before any simulated reload.

### Accessibility and visual evidence

PASS on candidate3 (same route/theme styles in subsequent builds): 104 automated route/theme/language/viewport checks and 15 populated states with zero axe violations, horizontal overflow or runtime errors. Axe4.13 used WCAG2 A/AA and WCAG2.1 A/AA tags; WCAG2.2 remained the broader review target, not an assertion that the automated rules covered all 2.2 criteria. Seven targeted keyboard/contrast/reflow regressions passed in Chromium; focused counterparts passed in Firefox/WebKit after waiting for the committed language change before a hard test navigation. Six 200% text-resize screens and eight 844×390 landscape cases retained reachable save/export/help actions. Reduced-motion breathing had no active animations and transition duration approximately 0.000001s.

Rendered text contrast examples: light Help 3.69→5.93:1, activity link 3.48→5.59:1; dark grounding example 4.18→7.18:1, delay safety text 3.50→8.12:1 and Journal privacy text 4.41→8.12:1. The two tightest remaining amber tinted examples measured 4.58 and 4.87:1. These are measured examples, not a universal accessibility claim.

Before/after screenshots under `tmp/release-readiness-2026-10-12/ui/`: `nl-light-320-empty-daily-{before,after}.png`, `privacy-keyboard-webkit-{before,after}.png`, `contrast-dark-delay-2-{before,after}.png`. Final route screenshots use candidate3, including the refreshed Privacy keyboard pair. Conflict warning screenshots explicitly name candidate2 (failure) and candidate3 (repair). Stacked update warning: `stacked-update-candidate4/stacked-320-200.png` → `stacked-update-candidate5-en/stacked-320-200-Update.png`; the matching NL capture uses `stacked-update-candidate5-nl/stacked-320-200-Bijwerken.png`. Both language variants passed; final candidate6 repeats the permanent enlarged-text worker regression.

### Browser-driver limitation

Three WebKit tests hit `WebKit encountered an internal error` on full navigation after `context.setOffline(true)`. A standalone, cache-only service worker with no Anchor or Workbox code reproduces it on WebKit 26.5; Chromium and Firefox pass. Stopping that minimal origin server instead passes in all three engines with `fromServiceWorker=true`. Therefore the original simulated-offline checks are **BLOCKED by the driver** (their command reports FAIL), not relabeled as app passes. Candidate WebKit verification with the origin actually stopped is recorded separately below. Evidence: `webkit-offline-diagnosis/result.json` and its minimal reproduction script.

PASS: three candidate4 WebKit equivalents, with a Node-side `ECONNREFUSED` check proving the origin server was stopped and each document served by the worker. Daily preserves mood −2/EIS73/raw 25-hour input, rejects that invalid save, then commits a repaired 450-minute value with unanswered fields still null; a Painting moment also saves. Journal preserves all 1,000 rows and oldest-entry search. Plan/action-card values and Help remain usable. No page errors or failed requests. Evidence: `webkit-origin-offline-candidate4/result.json`, three traces and screenshots. Later candidate changes only bound the update warning and drain already queued saves; they do not change these offline cache or record paths.

### Changed files and review boundaries

- Database/save reliability: `src/db/{storageGeneration,schema,lifecycle,crud,registrationSessionSettings}.ts`, `contexts/ActiveRegistrationContext.tsx`, `hooks/useLogs.ts`, `lib/persistenceQueue.ts`, and database/storage/PWA warning components.
- Usability/accessibility: `ScrollToTop.tsx`, `index.css`, Privacy/Journal/help/plan/delay pages and Grounding54321; `CigaretteCounter.tsx` and `lib/cigaretteStats.ts` correct the time-sensitive calculations.
- Regression coverage: five new unit/integration files, the shared reload fixture, existing migration/roundtrip fixture updates, four browser regression files and standalone reset/multiwindow update verifiers. All app paths above are under `artifacts/anchor/`.
- Operations/docs: this report, README, historical PLAN notice and main-only Pages workflow conditions. No package or lockfile changes, new dependencies, analytics, account/cloud features, or unrelated worktree changes.

Separate peer review verified the transactional generation guard, completion transaction and retry semantics, context-to-CRUD wiring, reload queues, Journal pagination, and deployment/docs changes. It found the completion bypass during the pass; that P1 was repaired and retested. Ordinary display preferences remain last-write-wins between windows; the app is not a multi-user synchronization system.

### Privacy, security and safety scope

PASS (source inspection): the deployed frontend has no accounts, remote persistence, analytics, telemetry or external fonts. No app-source fetch/XHR/beacon/WebSocket transmission of records was found. User text is rendered through React; the generic chart style helper is not a user-content HTML sink. The client CSP limits scripts/connects to self. A targeted frontend/workflow secret-pattern search found no matches; this is not a repository-history secret scan or penetration test.

PASS (source inspection): backup preview limits files to 50 MiB before parsing, validates the entire payload, blocks invalid imports and commits accepted imports transactionally. Privacy copy explains readable local storage/backups, device/profile access and browser eviction/reset limitations. Exported/shared copies are explicitly outside app deletion. Fault injection tests cover storage failure; actual disk exhaustion and operating-system eviction are not simulated as physical evidence.

PASS (read-only source spot check on 12 October): the immediate-help distinction and selected contact details match [Rijksoverheid 112](https://www.rijksoverheid.nl/documenten/vraag-en-antwoord/alarmnummer-112/wanneer-112-bellen), [113](https://www.113.nl/i/luisterlijn), [DRUGSinfo](https://www.drugsinfo.nl/contact/), [VNN](https://www.vnn.nl/contact) and [Tactus](https://www.tactus.nl/contact/). No calls, chats or forms were submitted. This spot check does not validate the whole care directory or the suitability/effectiveness of coping exercises. Other regional details and qualified bilingual content review remain NOT RUN in this pass.

Accessibility references: [W3C WCAG 2.2 guidance](https://www.w3.org/WAI/WCAG22/understanding/) and [focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html). Automated checks cover only detectable criteria; screenshots and keyboard scripts do not prove screen-reader usability.

## Deployment and recovery considerations

The audit itself did not publish changes. Deployment was subsequently authorized. Retain the prior production artifact, use the existing Pages workflow and gates, and verify public build identity/assets and an actual old client after deployment.

DB15 is a compatibility barrier only, with no store or record rewrite. It deliberately blocks v14 and older writers that lack the reset protections. Backup format remains6. After a reset or full replacement, an old window must reload before writing again; it must never reauthorize stale form contents merely by refreshing a provider.

The existing public client cannot be retroactively given a new reload guard. For its one-time transition, resolve any save error in each open Anchor window, retain a backup, then close extra windows before updating the remaining saved window. Candidate-to-next-build tests must separately demonstrate the new multi-window guard. Do not claim those tests fix JavaScript already running in an old client.

Rollback must retain DB15 compatibility and all current record/draft parsing. Prefer a forward repair. Never downgrade the database, clear browser site data, or replace user data automatically to make an older binary run. Test a compatible rollback artifact in a synthetic profile and retain its previous manifest/worker/asset hashes.

## Manual acceptance checklist

Use a separate test profile/device with synthetic records, not your only copy of personal data.

1. On the actual phone/tablet, install from the browser, reopen from the Home Screen, rotate, enlarge text and fill the lowest field with the on-screen keyboard visible. Confirm save/help/navigation remain reachable.
2. Save a note-only entry; create a daily/activity before/after check-in; reload offline and verify the exact values, including an unanswered value and an explicit zero.
3. Open two windows. With test data only, reset or restore a backup in one; confirm the other requires a reload and cannot restore an old draft. Check Help remains reachable.
4. Make an unfinished entry, receive an update, postpone it, then update after saving. With the candidate installed, verify both windows preserve their own pending input.
5. Export and restore a synthetic backup into another isolated profile. Confirm daily entries, activity moments, plan, contacts and drafts. Read the conflict preview before replacing anything.
6. Use VoiceOver/TalkBack or a desktop screen reader to complete a daily check-in, navigate an error, operate dialogs and read the patterns table. Record device/OS/browser and outcome.

## Release recommendation

**READY FOR LIMITED BETA.** The local candidate is suitable for a small group of informed adult testers using desktop Chromium or Firefox, with local backup/restore instructions and the one-time old-window update procedure. WebKit engine checks provide additional compatibility evidence; they do not establish Safari or installed iOS support. The repaired P1 data-loss paths have regression, native-browser and separate peer-review evidence. No known P0/P1 remains within this scope.

Before a broader mobile release, complete the physical iOS/Android installed-PWA checklist (including on-screen keyboard, safe areas, suspension/reopen and update), screen-reader acceptance, and qualified NL/EN recovery-content review. Actual OS storage eviction/full disk, an exercised compatible rollback binary, GitHub CI on these uncommitted changes and public candidate verification are **NOT RUN**. The WebKit `setOffline` driver limitation remains **BLOCKED**, with a verified server-stopped alternative. Bundle splitting is **DEFERRED P3**.

At completion of the local audit, changes were uncommitted and the public app remained b195819. The subsequent deployment authorization does not waive the existing CI gates, DB15 compatibility requirement or fresh public/old-client verification. The NOT RUN statuses above describe the audit snapshot; release results are recorded in the deployment workflow and release pull request. This is a scoped engineering recommendation, not a guarantee of security, clinical suitability, legal compliance or accessibility conformance.
