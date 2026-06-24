# Substance Recovery

A mobile-first Progressive Web App (PWA) for addiction recovery support, built as a private, offline-capable companion.

## What it is

Substance Recovery is a full-stack application that helps users track their recovery journey with tools for:
- **Journal** — Mood and craving logging with notes
- **Progress** — Sobriety streak tracking and daily check-ins
- **Tools** — Clinically-informed interventions (Box Breathing, 5-4-3-2-1 Grounding, Urge Surfing, Cold Water Reset, etc.)
- **Trackers** — Multi-step flows for Cravings, Relapse, Anxiety, and Boredom
- **Crisis Support** — Immediate help-now resources
- **Optional Cloud Sync** — Sign in to back up data across devices (opt-in; app works fully offline without account)

## Stack

- **Frontend**: React 19, TypeScript 5.9, Vite 7, Tailwind CSS v4, Framer Motion, Radix UI primitives
- **Backend**: Express 5, TypeScript, Drizzle ORM, PostgreSQL
- **Auth**: Clerk (Replit-managed) — optional, Google/Apple/email
- **Build**: esbuild (API), Vite (frontend)
- **Package Manager**: pnpm (required — preinstall hook blocks npm/yarn)
- **Monorepo**: pnpm workspaces with 8 packages

## Workspace Packages

| Package | Path | Purpose |
|---|---|---|
| `@workspace/anchor` | `artifacts/anchor` | Main PWA frontend |
| `@workspace/api-server` | `artifacts/api-server` | Express API backend |
| `@workspace/db` | `lib/db` | Drizzle ORM + PostgreSQL schema |
| `@workspace/api-spec` | `lib/api-spec` | OpenAPI spec + Orval codegen |
| `@workspace/api-zod` | `lib/api-zod` | Generated Zod schemas |
| `@workspace/api-client-react` | `lib/api-client-react` | Generated React Query hooks |
| `@workspace/scripts` | `scripts` | Utility scripts |

## Commands

### Install
```bash
pnpm install
```

### Development
```bash
# Frontend only
pnpm --filter @workspace/anchor run dev

# API server only
pnpm --filter @workspace/api-server run dev

# Full typecheck (all packages)
pnpm run typecheck
```

### Build
```bash
# Build all packages (typecheck + build)
pnpm run build

# Frontend only
pnpm --filter @workspace/anchor run build

# API server only
pnpm --filter @workspace/api-server run build
```

### Start (production)
```bash
# API server
pnpm --filter @workspace/api-server run start
```

## Required Secrets / Environment Variables

Set these in **Replit Secrets** (or `.env` for local development):

| Variable | Required | Used By | Notes |
|---|---|---|---|
| `DATABASE_URL` | Yes (for sync) | API server, DB | PostgreSQL connection string |
| `VITE_CLERK_PUBLISHABLE_KEY` | Yes (for auth) | Frontend | Clerk publishable key |
| `CLERK_SECRET_KEY` | Yes (for auth) | API server | Clerk secret key |
| `CLERK_PUBLISHABLE_KEY` | Yes (for auth) | API server | Same as above, used by middleware |
| `PORT` | No (defaults 8080) | Frontend, API | Vite dev server / API listen port |
| `BASE_PATH` | No (defaults `/`) | Frontend | Vite base URL |
| `NODE_ENV` | No | API server | `production` for production builds |

**Note**: The app works fully offline without any auth or database configuration. Cloud sync and sign-in are optional features.

## Replit Setup

1. **Import** this repository into a new Replit project named **"Substance Recovery"**
2. **Add Secrets** via the Secrets panel (Tools → Secrets):
   - `DATABASE_URL` — your PostgreSQL connection string
   - `VITE_CLERK_PUBLISHABLE_KEY` — from Replit Auth panel
   - `CLERK_SECRET_KEY` — from Replit Auth panel
   - `CLERK_PUBLISHABLE_KEY` — same as `VITE_CLERK_PUBLISHABLE_KEY`
3. **Provision a PostgreSQL database** if not already available
4. **Push DB schema** (if needed):
   ```bash
   pnpm --filter @workspace/db run push
   ```
5. **Deploy** using Replit Deployments → Autoscale

## Deployment Architecture

- **Frontend**: Static deployment served at `/`, built to `artifacts/anchor/dist/public`
- **API**: Autoscale deployment at `/api`, built to `artifacts/api-server/dist/index.mjs`
- **Router**: `application` (Replit handles routing between static and API)
- **Target**: `autoscale` (scales to zero when idle, scales up on demand)

## Troubleshooting

### Build fails with "Use pnpm instead"
Make sure you're using `pnpm`, not `npm` or `yarn`. The root `package.json` has a `preinstall` hook that blocks other package managers.

### Missing module '@rollup/rollup-win32-x64-msvc'
This is expected on Windows — the `pnpm-workspace.yaml` excludes non-Linux platform packages to optimize for Replit's Linux environment. Builds will work correctly on Replit.

### Missing `VITE_CLERK_PUBLISHABLE_KEY`
The app will still build and run, but auth features will be disabled. All offline/local features continue to work.

### Missing `DATABASE_URL`
The app will build and the frontend will work. The API server will log an error when sync endpoints are hit. Set the secret to enable cloud sync.

## Source

This project was originally forked from **"Anchor (Recovery Path)"** on Replit. The original source was preserved and this project was created as a clean, optimized deployment target.

## License

MIT (see `package.json`)
