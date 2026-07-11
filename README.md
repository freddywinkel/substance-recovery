# Substance Recovery

A mobile-first Progressive Web App (PWA) for addiction recovery support, built as a private, offline-capable companion.

## What it is

Substance Recovery is an offline-first application that helps users track their recovery journey with tools for:
- **Journal** — Mood and craving logging with notes
- **Progress** — Sobriety streak tracking and daily check-ins
- **Tools** — Clinically-informed interventions (Box Breathing, 5-4-3-2-1 Grounding, Urge Surfing, Cold Water Reset, etc.)
- **Trackers** — Multi-step flows for Cravings, Relapse, Anxiety, and Boredom
- **Crisis Support** — Immediate help-now resources
- **Local backups** — Export and import a JSON backup file from Settings

All personal data stays in the browser's local IndexedDB storage. The deployed app has no account system, analytics, cloud sync, or application back-end.

## Stack

- **Frontend**: React 19, TypeScript 5.9, Vite 7, Tailwind CSS v4, Framer Motion, Radix UI primitives
- **Storage**: Browser IndexedDB
- **Build**: Vite
- **Package Manager**: pnpm (required — preinstall hook blocks npm/yarn)
- **Monorepo**: pnpm workspaces with 8 packages

## Workspace Packages

| Package | Path | Purpose |
|---|---|---|
| `@workspace/anchor` | `artifacts/anchor` | Main PWA frontend |
| Other workspace packages | `artifacts/api-server`, `lib/*` | Legacy source retained in the repository; not used by the deployed PWA |

## Commands

### Install
```bash
pnpm install
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

## Environment Variables

| Variable | Required | Used By | Notes |
|---|---|---|---|
| `PORT` | No (defaults 8080) | Frontend | Vite development/preview port |
| `BASE_PATH` | No (defaults `/`) | Frontend | Vite base URL |

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
This can occur because the workspace lockfile excludes platform-specific optional packages. The GitHub Actions Linux build is the deployment source of truth.

## Source

This project was originally forked from **"Anchor (Recovery Path)"** on Replit. The original source was preserved and this project was created as a clean, optimized deployment target.

## License

MIT (see `package.json`)
