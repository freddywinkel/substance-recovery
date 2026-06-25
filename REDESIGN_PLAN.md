# Redesign Plan: Anchor - Substance Recovery

## Issues to Fix

### 1. Light/Dark Mode (CRITICAL)
Problem: New premium UI uses hardcoded `text-white/...` and `bg-white/...` colors that only work in dark mode.
Fix: Replace with CSS variable-based colors (`text-foreground`, `bg-card`, `border-border`) using Tailwind's `dark:` prefix where needed.

### 2. Scroll-to-Top (FIXED ✅)
Added `ScrollToTop` hook in App.tsx. All pages now scroll to top on route change.

### 3. Export/Import Buttons in Settings
Problem: Still uses unstyled/plain buttons compared to the rest of the premium UI.
Fix: Style with the new glassmorphism card design, consistent with other Settings sections.

### 4. Logs Default Category (FIXED ✅)
Changed from `"craving"` to `"trek"` — now opens on the first tab.

### 5. "Log vandaag" Button Logic
Problem: Goes to journal (not logical for quick logging).
Fix: Goes to new **Registraties** tab.

---

## Big Structural Redesign

### NEW: Registraties (Registrations) Tab
- New page: `/registraties`
- Contains the 5 registration types currently on Home:
  1. **Trek** (active desire) — Flame icon, amber
  2. **Craving** (passive urge) — Zap icon, teal
  3. **Boredom** — Coffee icon, emerald
  4. **Anxiety** — Brain icon, violet
  5. **Relapse** — AlertTriangle icon, rose
- Each card: glassmorphism style, height 120px, icon + title + subtitle + last log date
- Clicking navigates to the respective tracker

### Bottom Nav Restructuring
Current: Home, Help, Journal, Logs, Progress, Settings (6 tabs)
New: Home, Registraties, Help, Journal, Logs, Progress, Settings (7 tabs)

**Solution for 7 tabs:**
- Make the floating pill slightly wider: `max-w-lg` instead of `max-w-md`
- Reduce icon size to 16px and label font to 8px
- Use horizontal scroll if needed (but 7 should fit on most phones)
- Alternatively: merge Logs + Progress into a single "History" tab, or remove Progress (stats can be in Settings)

**Recommended:** Keep 7 tabs with smaller sizing. The floating pill can accommodate 7 items.

### NEW: Home Dashboard (Overview)
The Home screen becomes a true dashboard:

1. **Header** — greeting + app name
2. **Sobriety Hero Card** — large counter, milestone text, "Log vandaag" button (→ Registraties)
3. **Status Row** — 3 mini cards: cravings logged, check-ins, journal prompt
4. **Risk Overview** — NEW section showing recent risk patterns
   - "Last craving: 2 days ago" / "No cravings this week 🎉"
   - "Streak at risk: no check-in for 3 days"
5. **Daily Insight** — recovery quote (already exists)
6. **Quick Actions** — 2-3 most important buttons (not all 5 registrations)
   - "Emergency" → /help
   - "Toolbox" → /tools
   - "Journal" → /journal

### Settings Export/Import Styling
- Use the same glassmorphism card design as other sections
- Cloud icon header
- Export button: primary amber, FileDown icon
- Import: file input disguised as secondary button, FileUp icon
- Last exported timestamp below
- Toast notifications on success/error

---

## Theme-Aware Color Strategy

Replace all hardcoded colors with this pattern:

| Dark Mode | Light Mode | Tailwind Class |
|-----------|-----------|----------------|
| `text-white/92` | `text-foreground/90` | `text-foreground/90 dark:text-white/90` |
| `text-white/50` | `text-muted-foreground` | `text-muted-foreground` |
| `bg-white/[0.04]` | `bg-card` | `bg-card/50 dark:bg-white/[0.04]` |
| `border-white/10` | `border-border` | `border-border dark:border-white/10` |
| `bg-[#0D0C0B]` | `bg-[#F9F7F4]` | `bg-background` (CSS variable) |

This ensures the app looks premium in BOTH modes.

---

## Implementation Order

1. Fix light/dark mode in Home.tsx (replace hardcoded colors)
2. Create Registraties page with 5 registration cards
3. Update BottomNav to 7 tabs (smaller sizing)
4. Redesign Home as overview dashboard
5. Fix Settings Export/Import styling
6. Fix "Log vandaag" → Registraties
7. Build, test, push
