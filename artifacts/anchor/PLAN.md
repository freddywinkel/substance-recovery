# Anchor PWA — Implementation Plan

## Product
A mobile-first, offline-capable Progressive Web App for drug addiction recovery support.
Dark mode by default. Local-first (IndexedDB), no tracking. Fully usable offline and signed-out.
Optional opt-in cloud account (Replit-managed Clerk) backs up and syncs recovery data across
devices via `POST /api/sync`; the app is never gated on sign-in.

## Architecture

```
artifacts/anchor/
├── src/
│   ├── db/                    # IndexedDB (idb library)
│   │   └── index.ts           # DB init, typed getters/setters
│   ├── hooks/                 # Custom React hooks
│   │   ├── useStore.ts        # App state (craving log, settings)
│   │   └── usePWA.ts          # Install prompt, offline status
│   ├── pages/                 # Route-level pages
│   │   ├── Home.tsx           # Dashboard / quick access
│   │   ├── CrisisNow.tsx      # "I need help now" screen
│   │   ├── Tools.tsx          # Browse all tools
│   │   ├── Journal.tsx        # Mood/craving log
│   │   ├── Progress.tsx       # Local streak + insights
│   │   └── Settings.tsx       # Theme, data management
│   ├── tools/                 # Intervention modules
│   │   ├── BoxBreathing.tsx
│   │   ├── Grounding54321.tsx
│   │   ├── UrgeSurfing.tsx
│   │   ├── PlayTheTape.tsx
│   │   ├── ColdWaterReset.tsx
│   │   ├── SelfCompassion.tsx
│   │   └── Distraction.tsx
│   ├── components/
│   │   ├── BottomNav.tsx      # Primary mobile navigation
│   │   ├── ToolCard.tsx       # Tool entry card
│   │   └── CrisisBar.tsx      # Always-visible emergency link
│   ├── App.tsx
│   ├── index.css              # Theme + design tokens
│   └── main.tsx
├── public/
│   ├── manifest.json          # PWA manifest
│   ├── sw.js                  # Service worker (cache-first)
│   └── icons/                 # PWA icons (generated via canvas)
├── vite.config.ts             # PWA plugin config
└── docs/                      # Source of truth docs
```

## Phases

### Phase 0: Documentation (complete)
- [x] docs/DESIGN_PRINCIPLES.md
- [x] docs/INTERVENTIONS.md
- [x] PLAN.md

### Phase 1: Scaffold
- [x] Install vite-plugin-pwa + idb
- [x] PWA manifest + icons
- [x] Service worker (offline cache-first)
- [x] Theme: dark-default, CSS variables
- [x] BottomNav, App router

### Phase 2: Core Pages
- [ ] Home dashboard
- [ ] Crisis Now screen (I Need Help)
- [ ] All 7 intervention tools
- [ ] Journal / craving log
- [ ] Progress / streak view
- [ ] Settings

### Phase 3: IndexedDB Integration
- [ ] idb wrapper (typed)
- [ ] useStore hook
- [ ] Persist journal entries, settings, streaks

### Phase 4: PWA + Polish
- [ ] Install prompt
- [ ] Offline indicator
- [ ] Safe-area insets
- [ ] Smooth transitions (framer-motion)
- [ ] Accessibility (ARIA, focus management)

### Phase 5: Stabilization
- [ ] Typecheck clean
- [ ] Manual smoke test all flows
- [ ] Update replit.md
