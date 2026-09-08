/** Stored values are deliberately stable: changing UI language never rewrites history. */
export const RECOVERY_TARGET_VALUES = [
  "Alcohol", "Cannabis", "Cocaine / stimulant", "Benzodiazepines", "Nicotine", "Opioids",
  "GHB", "GBL", "Other substance", "Unknown substance",
  "Gambling", "Sex / pornography", "Gaming", "Food / binge eating",
] as const;

const BEHAVIORAL_TARGETS = new Set(["Gambling", "Sex / pornography", "Gaming", "Food / binge eating"]);
const NL: Record<string, string> = {
  Alcohol: "Alcohol", Cannabis: "Cannabis", "Cocaine / stimulant": "Cocaïne / stimulerend middel",
  Benzodiazepines: "Benzodiazepinen", Nicotine: "Nicotine", Opioids: "Opioïden", GHB: "GHB", GBL: "GBL",
  "Other substance": "Ander middel", "Unknown substance": "Middel onbekend", Gambling: "Gokken",
  "Sex / pornography": "Seks / pornografie", Gaming: "Gamen", "Food / binge eating": "Eten / eetbuien",
};
export function recoveryTargetLabel(value: string, language: "en" | "nl"): string {
  return language === "nl" ? NL[value] ?? value : value;
}
export function isBehavioralTarget(value: string): boolean { return BEHAVIORAL_TARGETS.has(value); }
export function isKnownRecoveryTarget(value: string): boolean { return (RECOVERY_TARGET_VALUES as readonly string[]).includes(value); }
export function getTargetScopeCopy(targets: string[], language: "en" | "nl"): string {
  if (!targets.some(isBehavioralTarget)) return language === "nl"
    ? "Kies wat bij dit moment hoort. Een registratie is geen diagnose. Medicatie volgens voorschrift is niet automatisch een terugval."
    : "Choose what belongs to this moment. A record is not a diagnosis. Medication taken as prescribed is not automatically a return to use.";
  return language === "nl"
    ? "Beschrijf het gedrag dat jij wilt veranderen en jouw persoonlijke grens. Eten, gamen of seks op zichzelf is geen terugval. Deze algemene zelfhulp vervangt geen behandeling voor eetproblemen of ander gedrag. Bespreek passende doelen met een zorgverlener."
    : "Describe the behavior you want to change and your personal boundary. Eating, gaming or sex itself is not a return to use. This general self-help does not replace care for eating problems or other behaviors. Discuss suitable goals with a professional.";
}
