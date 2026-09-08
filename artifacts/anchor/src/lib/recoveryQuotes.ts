const RECOVERY_QUOTES = {
  en: [
  "Cravings can change. Choose a coping step or ask someone for support.",
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
  "This moment does not define you.",
  "Notice without judgment. That is the practice.",
  "Notice what you need. You can choose a different approach or ask for help.",
  "One breath. One choice. One moment.",
  "Your strength is in showing up again.",
  "Healing is not linear. It is real.",
  ],
  nl: [
    "Cravings kunnen veranderen. Kies een helpende stap of vraag iemand om steun.",
    "Je hoeft vandaag niet je hele leven op te lossen. Bescherm het komende uur.",
    "Een drang is informatie, geen opdracht.",
    "Herstel wordt opgebouwd in gewone momenten.",
    "Pauzeer eerst. Kies daarna.",
    "Eén beslissing tegelijk. Vandaag telt.",
    "Nog steeds hier. Nog steeds in beweging.",
    "Je hoeft alleen vandaag te beschermen.",
    "De drang kan voorbijgaan. Je vooruitgang kan blijven.",
    "Adem. Dit moment is genoeg.",
    "Kleine stappen zijn nog steeds stappen vooruit.",
    "Jij bent niet je cravings. Jij bent degene die ze waarneemt.",
    "Elk moment van bewustzijn is een overwinning.",
    "Compassie voor jezelf hoort bij herstel.",
    "Dit moment bepaalt niet wie je bent.",
    "Merk op zonder oordeel. Dat is de oefening.",
    "Merk op wat je nodig hebt. Je kunt een andere aanpak kiezen of hulp vragen.",
    "Eén ademhaling. Eén keuze. Eén moment.",
    "Je kracht zit in opnieuw komen opdagen.",
    "Herstel verloopt niet rechtlijnig. Het is wel echt.",
  ],
} as const;

/**
 * Deterministically picks today's recovery quote based on the date.
 * Same day = same quote. No storage needed.
 */
export function getTodaysQuote(language: "en" | "nl"): string {
  const now = new Date();
  const dayIndex = now.getFullYear() * 366 + now.getMonth() * 31 + now.getDate();
  const quotes = RECOVERY_QUOTES[language];
  return quotes[dayIndex % quotes.length];
}
