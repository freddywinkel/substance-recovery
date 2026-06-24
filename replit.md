# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

### Anchor — Recovery Support (`artifacts/anchor`)

A mobile-first Progressive Web App for drug addiction recovery support.

**Key characteristics:**
- Dark mode by default; supports light mode toggle (persisted to IndexedDB)
- Fully offline-capable (Vite PWA plugin + Workbox service worker)
- Local-first: all data stored in IndexedDB via `idb` library. Works fully offline and signed-out with no account required.
- **Optional** cloud account (opt-in): sign in to back up and sync data across devices. Signed-out behaviour is unchanged — Home stays a public landing page, never gated.
- No analytics, no tracking, no social features
- Safe-area insets for modern iPhone notches
- One-handed ergonomic layout, 48px+ touch targets

**Optional cloud login & cross-device sync:**
- Auth: Replit-managed Clerk (Google / Apple / email), web cookie-based session. Routes `/sign-in` and `/sign-up` (wouter base path), branded appearance. Account UI lives in Settings; the rest of the app never forces sign-in.
- Sync backend: `artifacts/api-server` Express 5 route `POST /api/sync` (requireAuth + Origin check + per-kind zod validation + size/count limits; payloads never logged). Single bidirectional endpoint — client pushes dirty changes, pulls by monotonic `revision` cursor with pagination, atomic per request (DB transaction), last-write-wins on `clientUpdatedAt`.
- Server storage: PostgreSQL table `sync_records` (Drizzle) — `userId, kind, recordId, payload(jsonb), clientUpdatedAt, revision(bigserial), deleted`, PK `(userId, kind, recordId)`. The server is a dumb JSONB backstore; it never interprets payloads.
- Syncable kinds only: `journal`, `cravingLogs`, `relapseLogs`, `anxietyLogs`, `boredomLogs`, and the single setting `sobrietyStartDate`. Device-local (never synced): theme, language, activeRegistration, drafts, crisis service, emergency contacts.
- Client engine: `src/lib/sync-engine.ts` (`runSync`) + `src/contexts/SyncContext.tsx` (`SyncProvider`/`useSync`). Triggers: sign-in, online/foreground, debounced post-write (2s), periodic (5min). First sign-in pushes all pre-existing local data up. Completely inert (no network, no timers) when signed out.
- Sync UI: status indicator + "Sync now" in Settings → Account; privacy copy switches to the sync-accurate variant when signed in.

**Interventions (all clinically informed, non-judgmental):**
- Box Breathing (4-4-4-4 guided with animated visual)
- 5-4-3-2-1 Grounding (sensory anchoring)
- Urge Surfing (wave visualization + guided messages)
- Play the Tape Forward (two-path cognitive rehearsal)
- Cold Water Reset (DBT TIPP skill)
- Self-Compassion Reframe (Neff framework)
- Distraction / Redirection (randomized activity suggestions)

**Pages:** Home, Help Now (crisis), Tools (browse all), Journal (mood/craving log), Progress (streak + check-in grid), Settings (theme, privacy info, crisis numbers, data erasure)

**Tracker flows (full multi-step questionnaires):**
- CravingTracker — 11-step flow + "Help me now" collapsible shortcut on step 1
- RelapseLog — 11-step flow (10 + whatNeeded final step); done screen has repair actions selector
- AnxietyTracker v2 — 4-step: type selector (9 types) + intensity → body locations + brain prediction → urgency toggle with panic shortcuts + context/linked states/reassurance-seeking → reaction + done routing
- BoredomTracker v2 — 4-step: restlessness type (10 options) + intensity → stimulation need + convert-check routing → situation + urge → rescue menu + action
- DelayScreen — 10-min countdown timer with rotating grounding instructions and SVG ring

**Data model (IndexedDB v5):**
- `journal` — entries with mood (1-5), craving intensity (1-5, optional), note text, timestamp
- `checkIns` — daily check-ins (one per day)
- `settings` — key/value store (theme, etc.)
- `cravingLogs` — full craving tracker responses
- `relapseLogs` — lapse/relapse tracker responses
- `anxietyLogs` — anxiety check-in responses (intensity, context, trigger, bodySensations, reaction)
- `boredomLogs` — restlessness check-in responses (intensity, feelingTypes, situation, urge, action, delayDuration)
- **Sync fields (v5):** syncable records carry optional `updatedAt` (monotonic local clock) + `deleted` (tombstone). Local getters filter out tombstones; deletes of syncable data write tombstones instead of removing rows.
- `syncMeta` (keyPath `key`) — sync cursor, deviceId, last server time, first-push flag.
- `dirtyRecords` (keyPath `id`) — outbound change queue; local writes mark dirty, pulled remote writes never do. Cleared after a successful push (only if `updatedAt` is unchanged).

**Analytics (`src/lib/analytics.ts`):** `computeCravingStats`, `computeRelapseStats`, `computeAnxietyStats`, `computeBoredomStats`, `computeWeeklyTrend` — all pure functions operating on filtered log arrays

**Dependencies added:** `vite-plugin-pwa`, `workbox-window`, `idb`, `@clerk/react`, `@clerk/localizations`, `@clerk/themes`, `@workspace/api-client-react` (generated sync client)

**Documentation:**
- `artifacts/anchor/docs/DESIGN_PRINCIPLES.md` — privacy, clinical framing, aesthetic principles
- `artifacts/anchor/docs/INTERVENTIONS.md` — intervention reference guide
- `artifacts/anchor/PLAN.md` — implementation plan and phase tracker
