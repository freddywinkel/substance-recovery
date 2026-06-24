# Anchor — Design Principles

## Core Philosophy

Anchor is a private, offline-capable companion for people navigating addiction recovery. It holds no judgment, defaults to storing nothing remotely, and presents no clinical diagnosis. It exists only to help a person get through the next few minutes.

## Privacy Principles

- By default, all data lives exclusively on the device (IndexedDB) — no account required
- Sign-in is **optional and opt-in**. The app is never gated: Home is a public landing page and every tool works signed-out.
- Only if a person chooses to sign in does their recovery data (journal, tracker logs, recovery date) sync to their private account for cross-device backup. Theme and language always stay device-local.
- The sync server is a dumb encrypted-at-rest backstore: it stores per-record JSON keyed to the user's account and never interprets, analyses, or shares it. Payloads are never logged.
- No analytics, telemetry, or tracking pixels
- No external font CDNs, tracking scripts, or third-party SDKs (auth is the only network feature, and only when signed in)
- The app works fully offline after installation, signed-in or signed-out

## Clinical Framework

Interventions are informed by evidence-based techniques only:

- **Urge Surfing** — riding the wave of a craving without acting on it
- **5-4-3-2-1 Grounding** — sensory anchoring to the present moment
- **Box Breathing** — regulated 4-4-4-4 breath pattern to calm the nervous system
- **Cold Water Reset** — physiological interrupt (face/wrists/cold water)
- **Play the Tape Forward** — cognitive rehearsal of consequences
- **Self-Compassion Reframe** — talking to yourself as you would a friend
- **Distraction / Redirection** — brief engagement with a non-harmful activity

## Framing Guidelines

- Never suggest the app replaces medical or therapeutic care
- Never diagnose, assess severity, or recommend medications
- Always use warm, first-person inviting language ("Let's try..." not "You must...")
- Acknowledge difficulty without catastrophizing
- End every tool with a moment of affirmation
- Emergency resources are always visible but never alarming

## Aesthetic

- Dark mode by default (reduces visual stimulation during distress)
- Muted, earthy deep tones: deep slate/indigo backgrounds, warm amber/sage accents
- Large touch targets (min 48px) for shaky hands
- One-handed ergonomic layout: primary actions in the bottom 60% of screen
- Safe-area insets respected on all modern mobile devices
- Smooth, slow transitions — nothing jarring or fast
- No confetti, streaks, gamification badges, or social pressure
