const RECOVERY_QUOTES = [
  "Cravings rise, peak, and pass. You only need to stay with this wave.",
  "You do not need to solve your whole life today. Protect the next hour.",
  "An urge is information, not an instruction.",
  "Recovery is built in ordinary moments.",
  "Pause first. Choose second.",
  "One decision at a time. Today counts.",
  "Still here. Still moving.",
  "You only need to protect today.",
  "The urge can pass. Your progress can stay.",
  "Breathe. This moment is enough.",
  "Small steps are still steps forward.",
  "You are not your cravings. You are the witness.",
  "Every moment of awareness is a victory.",
  "Compassion for yourself is part of recovery.",
  "This feeling is temporary. You are not.",
  "Notice without judgment. That is the practice.",
  "What you resist, persists. What you allow, transforms.",
  "One breath. One choice. One moment.",
  "Your strength is in showing up again.",
  "Healing is not linear. It is real.",
];

/**
 * Deterministically picks today's recovery quote based on the date.
 * Same day = same quote. No storage needed.
 */
export function getTodaysQuote(): string {
  const now = new Date();
  const dayIndex = now.getFullYear() * 366 + now.getMonth() * 31 + now.getDate();
  return RECOVERY_QUOTES[dayIndex % RECOVERY_QUOTES.length];
}
