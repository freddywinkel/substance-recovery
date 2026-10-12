# Substance Recovery

A mobile-first Progressive Web App (PWA) for addiction recovery support, built as a private, offline-capable companion.

## What it is

Substance Recovery is an offline-first application that helps users track their recovery journey with tools for:
- **Journal** — Mood and craving logging with notes
- **Daily balance** — An optional evening check-in for sleep, mood, emotional intensity and craving, linked to before/activity/after moments; includes a previewed MoodTracker JSON import
- **My growth** — Optional everyday moments and self-chosen reminders, with no symptom questions, streaks or scores; accessible from Home, Journal and supportive actions
- **Brief self-compassion** — Optional acknowledgement, kind words or a practical action, and one editable personal phrase; no automatic tool-use or follow-up record
- **Weekly reflection** — Optional memories, personal choices, room for next week and one enjoyable activity; usable without problem registrations, alongside the existing supportive plan
- **Support for self-criticism** — An explicit choice of grounding, kinder words, chosen memories or contact options; no automatic analysis or registration
- **Progress** — Personal recovery goals, recorded events, and optional goal-specific progress
- **Tools** — Common self-help exercises (paced breathing, 5-4-3-2-1 grounding, urge surfing, sensory reset, etc.); these are not clinical treatment or validated assessment tools
- **Trackers** — Multi-step flows for planned/active urges, cravings, relapse, anxiety, and boredom
- **Crisis Support** — Immediate help-now resources
- **Local backups** — Export and import a JSON backup file from Settings
- **Prevention plan** — Personal goals, warning signs linked to actions, support/care agreements, aftercare, saved versions and an offline action card

Personal records are stored in the browser's local IndexedDB storage. Exports create copies that the user manages separately. The deployed app has no account system, tracking analytics, cloud sync, or application back-end.

Open the [public app](https://freddywinkel.github.io/substance-recovery/). The [GitHub Pages workflow](https://github.com/freddywinkel/substance-recovery/actions/workflows/deploy-pages.yml) records deployments from `main`; the page's `anchor-build` metadata identifies its deployed commit. Existing installations can open online and choose **Bijwerken / Update** when the update prompt appears. Local records remain in the same browser profile.

The [8 September implementation audit](docs/AUDIT_IMPLEMENTATION_2026-09-08.md) and [9 September UI follow-up](docs/UI_AUDIT_FOLLOWUP_2026-09-09.md) record the pre-publication candidates, regression evidence and remaining clinical/device review boundaries. They are historical verification snapshots; use the deployment workflow for current publication status.

## Stack

- **Frontend**: React 19, TypeScript 5.9, Vite 7, Tailwind CSS v4, Radix UI primitives
- **Storage**: Browser IndexedDB
- **Build**: Vite
- **Package Manager**: pnpm (required — preinstall hook blocks npm/yarn)
- **Monorepo**: pnpm workspaces with 9 projects including the workspace root

## Workspace Packages

| Package | Path | Purpose |
|---|---|---|
| `@workspace/anchor` | `artifacts/anchor` | Main PWA frontend |
| Other workspace packages | `artifacts/api-server`, `lib/*` | Legacy source retained in the repository; not used by the deployed PWA |

## Supported development environment

Use Node.js 24 LTS and pnpm 11.9.0. `.node-version`, `package.json` engines, the package manager pin, and CI identify these versions. Check `node --version` and `pnpm --version` before installing. Run commands from the repository root, not its parent workspace directory.

## Commands

### Install
```bash
pnpm install --frozen-lockfile
```

### Development
```bash
# Frontend only
pnpm --filter @workspace/anchor run dev

# Full typecheck (all packages)
pnpm run typecheck
```

### Build
```bash
# Build all packages (typecheck + build)
pnpm run build

# Frontend only
pnpm --filter @workspace/anchor run build

```

### Verification

```bash
pnpm run typecheck
pnpm run typecheck:tests
pnpm run test
pnpm audit --audit-level high
```

Build and test the production PWA at its deployment base path, including the generated service worker. In PowerShell:

```powershell
$env:BASE_PATH = "/substance-recovery/"
pnpm --filter @workspace/anchor run build
Copy-Item artifacts/anchor/dist/public/index.html artifacts/anchor/dist/public/404.html
pnpm run verify:pwa
pnpm exec playwright install chromium
pnpm exec playwright test
```

The browser configuration serves the existing production artifact; rebuild after source changes. CI installs Chromium with its Linux dependencies, runs the browser suite, and retains test evidence. Use synthetic records in browser tests. A local build/test pass does not establish what version is currently deployed or prove behavior on a physical installed iOS/Android PWA.

## Environment Variables

| Variable | Required | Used By | Notes |
|---|---|---|---|
| `PORT` | No (defaults 8080) | Frontend | Vite development/preview port |
| `BASE_PATH` | No (defaults `/`) | Frontend | Vite base URL |
| `PWA_TEST_PORT` | No (defaults `8752`) | Browser tests / built-PWA preview | Use a free port to avoid reusing another checkout's preview |

No secrets, database, or authentication configuration is required.

## Deployment

GitHub Actions deploys the app to GitHub Pages whenever a change reaches `main`:

<https://freddywinkel.github.io/substance-recovery/>

## Deployment Architecture

- **Host**: GitHub Pages
- **Build output**: `artifacts/anchor/dist/public`
- **Base path**: `/substance-recovery/`
- **PWA**: generated service worker and manifest provide offline support

## Troubleshooting

### Build fails with "Use pnpm instead"
Make sure you're using `pnpm`, not `npm` or `yarn`. The root `package.json` has a `preinstall` hook that blocks other package managers.

### Missing module '@rollup/rollup-win32-x64-msvc'
Native binaries are normal optional dependencies selected for the current OS/CPU. The workspace no longer suppresses supported Rollup, esbuild, Tailwind or Lightning CSS platform packages, and does not require Windows-only packages at the root. Install with optional dependencies enabled using the pinned pnpm version. Do not copy `node_modules` between operating systems.

### Import and backup versions

New backups use format 6. Historical formats 1–5 remain supported and checked before import. Invalid/unsupported data blocks the import without partial writes; merge and replacement each use one IndexedDB transaction. The complete snapshot includes daily balances, before/activity/after moments, retrospective use periods, growth moments, reminder preferences, personal self-compassion words, weekly reflection fields, local drafts, historical check-ins and deletion markers. It excludes obsolete device-specific sync bookkeeping and content-free retry guards. Selective reports are separate from backups; personal growth and optional weekly reflection fields are not automatically added to a shareable report. Settings has a separate MoodTracker import: review dates and conflicts before choosing whether to keep Anchor's day or use the imported day. Imported craving ratings retain their original 0–3 scale.

Database version 15 preserves existing stores and records and prevents older clients from bypassing the reset/replacement protection. Version 14 introduced the compatibility barrier for daily balances and activity moments. The v14-to-v15 upgrade rewrites no records or stores. If an update waits for another Anchor tab or installed app window, resolve any unsaved-input warning there before closing that window and choosing **Reopen / reload**. Help remains available during a database interruption. Do not clear browser site data to resolve an update. Rolling the app code back to a version-14 or earlier client after this upgrade will not restore database access; use a compatible updated client instead.

### Release decision and recovery

Read [RELEASE_READINESS.md](RELEASE_READINESS.md) for the pre-deployment audit, verified environments and open release gates. The user separately authorized this limited-beta release; consult the [Pages workflow](https://github.com/freddywinkel/substance-recovery/actions/workflows/deploy-pages.yml) for current publication status.

Before an authorized release, run the verification commands above, retain the previous production artifact and test the previous-to-candidate worker update with saved records and unfinished input. After deployment, compare the public `anchor-build` metadata and assets with the intended build, then verify a real prior browser client updating without clearing its data.

For the first transition from the previously published version, save or retry pending input in every open Anchor window, keep a backup, and close extra windows before updating the remaining saved window. The new per-window update protection applies once this candidate is loaded; it cannot change JavaScript still running in the older client.

Prefer a forward fix for data/schema issues. A rollback artifact must understand the installed database version and all current record/draft types; never lower the database version, delete site data or restore an older backup automatically. Test a compatible rollback in an isolated profile first. User-chosen backup replacement removes records absent from the file, so keep a separate current backup before restoring.

### Dependency maintenance

Run `pnpm audit` and review the actual affected dependency paths. Vite is kept on the supported 7.3 patch line across app builds and Vitest; avoid accidentally upgrading only Vitest's transitive Vite to another major. Legacy API/code-generation packages remain outside the deployed PWA. Updating their dependencies does not activate a backend, accounts or sync.

## Source

This project was originally forked from **"Anchor (Recovery Path)"** on Replit. The original source was preserved and this project was created as a clean, optimized deployment target.

## License

MIT (see `package.json`)
