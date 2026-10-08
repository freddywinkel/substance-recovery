# Anchor — Design Principles

## Core Philosophy

Anchor is a private, offline companion for people navigating addiction recovery. It holds no judgment, stores recovery data on the device, and presents no clinical diagnosis. It can support reflection and the next useful action, but it is not medical care, crisis care, or a validated clinical assessment.

## Privacy Principles

- All recovery data lives exclusively on the device in IndexedDB. There is no account, sign-in, cloud sync, or remote recovery-data store.
- Manual JSON export/import is the backup and device-transfer mechanism. The person controls where that exported file is stored.
- No analytics, telemetry, or tracking pixels
- No external font CDNs, tracking scripts, advertising, or third-party analytics SDKs
- The app works fully offline after installation. Network access is only needed to download an update or open an explicitly selected external help link.

## Clinical Framework

The app contains common self-help exercises used in recovery and anxiety support. Their presence does not make Anchor clinically validated, and no exercise is presented as guaranteed to work:

- **Urge Surfing** — riding the wave of a craving without acting on it
- **5-4-3-2-1 Grounding** — sensory anchoring to the present moment
- **Box Breathing** — a paced 4-4-4-4 breathing exercise
- **Cold Water Reset** — an optional sensory reset using cool water
- **Play the Tape Forward** — cognitive rehearsal of consequences
- **Self-Compassion Reframe** — talking to yourself as you would a friend
- **Distraction / Redirection** — brief engagement with a non-harmful activity

## Framing Guidelines

- Never suggest the app replaces medical, addiction, crisis, or therapeutic care
- Never diagnose, assess severity, or recommend medications
- Always use warm, first-person inviting language ("Let's try..." not "You must...")
- Acknowledge difficulty without catastrophizing
- End every tool with a moment of affirmation
- Emergency resources are visible, direct, and appropriate to the person's answer. Immediate danger routes to 112; non-immediate suicide-prevention support routes to 113; a configured local crisis service remains available.
- New, severe, different, or medically concerning symptoms receive a medical-assessment caveat instead of unconditional reassurance.
- Substance-specific risks such as withdrawal and overdose are not generalized to behavioural targets.

## Content Governance

- Registration behavior is defined in `REGISTRATION_CONTRACT.md`; historical prompt files are not independently authoritative.
- English and Dutch require semantic review as well as translation-key parity.
- Each safety-sensitive statement records a source and review date. Current registration guidance references public information from 113 Suicide Prevention and Trimbos/DRUGSinfo; this is not a substitute for qualified human clinical review.
- Until a qualified reviewer signs off, Anchor is described as cautious self-help software, not as clinically approved or clinically validated.

## Aesthetic

- Dark mode by default (reduces visual stimulation during distress)
- Muted, earthy deep tones: deep slate/indigo backgrounds, warm amber/sage accents
- Large touch targets (min 48px) for shaky hands
- One-handed ergonomic layout: primary actions in the bottom 60% of screen
- Safe-area insets respected on all modern mobile devices
- Smooth, slow transitions — nothing jarring or fast
- No confetti, streaks, gamification badges, or social pressure

## Personal growth and brief self-compassion

- A pleasant moment need not be an achievement. Entry categories, reminders and exercises are optional; skipping creates no failure record.
- Moments have their own short route with no craving, trigger or mood questions. They never affect symptom summaries or sobriety calculations.
- Only explicitly favourited moments may be resurfaced on Home. Personal self-compassion words are shown inside the brief exercise, not automatically on Home or in shared reports.
- Difficulty and positive experiences may coexist. Do not imply that optimism prevents relapse, that an exercise must feel good, or that an absence of entries means an absence of progress.
- Return-to-use records never reset personal growth history. Editing and deletion remain deliberate user choices.
- Short self-compassion offers words or a practical action, not compulsory body focus, touch, breathing, positive reframing or professional treatment.
- Saved moments, words and drafts stay local and are included in full backups. There is no model inference, remote processing or new tracking.
