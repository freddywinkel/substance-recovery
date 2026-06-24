# Anchor — Implementation Log

## Project Overview
Anchor is a mobile-first, offline-capable, dark-mode-default PWA for drug addiction recovery support. Built with React, TypeScript, and Vite. All data stored locally via IndexedDB — no accounts, no cloud sync.

---

## Architecture

| Layer | Tech |
|-------|------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS v4 + custom CSS variables |
| Storage | IndexedDB via `idb` library (DB v3 schema) |
| State | Custom `useStore` hook (no Redux) |
| Routing | Wouter (lightweight) |
| PWA | Vite PWA plugin + manifest |
| Icons | Lucide React |

---

## DB Schema (v3)

### Stores
- `journal` — free-text journal entries
- `checkIns` — daily check-in dates (streak tracking)
- `cravingLogs` — 11-step craving tracker logs
- `relapseLogs` — 10-step + whatNeeded relapse log entries
- `anxietyLogs` — 4-step anxiety tracker logs (v2)
- `boredomLogs` — 4-step boredom/restlessness tracker logs (v2)
- `settings` — theme and user preferences

---

## Features

### Intervention Tools (7)
1. **CravingTracker** — 11-step craving check-in with "Help me now" shortcut on step 1
2. **RelapseLog** — 10-step honest lapse log + whatNeeded step + repair actions on done screen
3. **AnxietyTracker v2** — 4-step flow: type selector + intensity → body locations + brain prediction → urgency toggle with panic shortcuts → reaction + context
4. **BoredomTracker v2** — 4-step flow: restlessness type + intensity → stimulation need + convert-check → situation + urge → rescue menu + action
5. **DelayScreen** — 10-minute urge surfing countdown timer
6. **Journal** — free-text private journal
7. **Help/Toolbox** — curated skill cards (breathing, grounding, etc.)

### Core Features
- **Streak tracking** — daily check-in calendar and streak count
- **Progress analytics** — craving patterns, anxiety patterns, restlessness patterns, weekly activity charts
- **Home 6-action grid** — Craving, Lapse, Anxiety, Restlessness, 10-min Delay, Journal
- **Dark mode default** — light mode toggle persisted to IndexedDB
- **PWA installable** — Home Screen installability for iPhone 14 Pro and Android

---

## Clinical Framing
- MBRP (Mindfulness-Based Relapse Prevention)
- DBT (Dialectical Behaviour Therapy) skills
- Motivational Interviewing principles
- Kristin Neff self-compassion model
- Language: never uses "failure", avoids shame/guilt framing, always judgment-free

---

## Key Design Decisions

### Safe-area pattern
Each page handles its own safe-area padding inside `PageHeader`. No global body padding.

### Action bar pattern
```
fixed left-0 right-0 z-40 pt-3 pb-3
bottom: calc(3.5rem + env(safe-area-inset-bottom))
```

### Reset data bug fix
`resetAllData` in `useStore` now correctly clears anxietyLogs and boredomLogs state in addition to journal, checkIns, cravingLogs, and relapseLogs.

### Help me now shortcut (CravingTracker step 1)
Collapsible panel with quick links to: Delay timer, Help/Toolbox, Anxiety check-in, Boredom check-in.

### RelapseLog whatNeeded step
Added as final optional step before save. 11 "what did you actually need?" options (relief, sleep, comfort, etc.) with clinical framing about needs-based understanding of relapse.

### RelapseLog repair actions (done screen)
10 stabilizing actions displayed on the done screen after logging a relapse. User can tap to note which they plan to take.

---

## Crisis Contact
Dutch crisis line: Crisisdienst Antes — 088 358 1500 (tel:0883581500)

---

## Changelog

| Date | Change |
|------|--------|
| 2026-04 | Initial build: CravingTracker (11-step), RelapseLog (10-step), AnxietyTracker, BoredomTracker, DelayScreen, Journal, Progress, Home |
| 2026-04 | DB v3 schema: added AnxietyLog, BoredomLog stores |
| 2026-04 | AnxietyTracker v2: 4-step flow with type selector, body locations, urgency routing, panic shortcuts, linked states |
| 2026-04 | BoredomTracker v2: 4-step flow with restlessness type, stimulation need, convert-check, rescue menu |
| 2026-04 | CravingTracker: "Help me now" collapsible shortcut panel on step 1 |
| 2026-04 | RelapseLog: added whatNeeded step + repair actions on done screen + improved shame-interruption messaging |
| 2026-04 | Home: expanded to 6-action grid (added Delay timer + Journal) |
| 2026-04 | Progress: added anxiety patterns + restlessness patterns sections; added FreqList component |
| 2026-04 | useStore: fixed resetAllData to clear anxietyLogs and boredomLogs |
| 2026-04 | Crisis line: updated to Crisisdienst Antes 088 358 1500 throughout |
