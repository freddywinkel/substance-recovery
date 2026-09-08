import type { CrisisService } from "@/db/schema";

export type CareRole = "emergency" | "suicide-support" | "urgent-care" | "treatment" | "advice" | "listening" | "relatives" | "safeguarding" | "non-acute-report" | "unverified";
type LocalText = { en: string; nl: string };
export interface CareDirectoryEntry {
  id: string; nameKey: string; number: string; role: CareRole;
  availability: LocalText; eligibility: LocalText; sourceUrl: string; checkedAt: string; publicDirect: boolean;
}
const both = (nl: string, en: string): LocalText => ({ nl, en });
const entry = (id: string, number: string, role: CareRole, availability: LocalText, eligibility: LocalText, sourceUrl: string, publicDirect = true): CareDirectoryEntry =>
  ({ id, nameKey: `crisis.${id}`, number, role, availability, eligibility, sourceUrl, checkedAt: "2026-09-08", publicDirect });
/** Public-source checks are not clinical review or a promise of live availability. */
export const CARE_DIRECTORY: CareDirectoryEntry[] = [
  entry("112", "112", "emergency", both("24 uur per dag", "24 hours a day"), both("Bij direct gevaar of een medisch noodgeval", "Immediate danger or medical emergency"), "https://www.rijksoverheid.nl/vraag-en-antwoord/alarmnummer-112/wanneer-112-bellen"),
  entry("113", "113", "suicide-support", both("24 uur per dag; ook 0800-0113 en chat", "24 hours a day; also 0800-0113 and chat"), both("Bij gedachten aan zelfdoding", "For thoughts of suicide"), "https://www.113.nl/i/luisterlijn"),
  entry("luisterlijn", "088 0767 000", "listening", both("24 uur per dag; normale belkosten", "24 hours a day; usual provider charges"), both("Volwassenen; Nederlands. Andere taal afhankelijk van vrijwilliger.", "Adults; Dutch. Other languages depend on the volunteer."), "https://www.deluisterlijn.nl/de-luisterlijn-telefoon.html"),
  entry("mind", "0900-1450", "advice", both("Werkdagen 09:00–21:00; gebruikelijke belkosten", "Weekdays 09:00–21:00; usual calling charges"), both("Advies over mentale problemen", "Advice about mental-health concerns"), "https://mindhulplijn.nl/footer-contact/contact"),
  entry("drugsinfo", "0900-1995", "advice", both("Ma–vr 09:00–17:00; €0,10/min plus normale belkosten", "Mon–Fri 09:00–17:00; €0.10/min plus usual calling charges"), both("Vragen over drugs; geen spoedbeoordeling", "Drug information; no emergency assessment"), "https://www.drugsinfo.nl/contact/"),
  entry("vnn", "088 234 34 34", "treatment", both("Tijdens kantooruren", "Office hours"), both("Advies en aanmelding; Groningen, Friesland en Drenthe", "Advice and intake; Groningen, Friesland and Drenthe"), "https://www.vnn.nl/contact"),
  entry("tactus", "088 382 28 87", "treatment", both("Ma–vr 08:30–17:00", "Mon–Fri 08:30–17:00"), both("Algemene vragen/aanmelding; bij crisis huisarts of huisartsenpost", "General questions/intake; crisis: GP or out-of-hours GP service"), "https://www.tactus.nl/contact/"),
  entry("antes", "088 358 15 00", "urgent-care", both("24 uur per dag", "24 hours a day"), both("Antes-cliënten in crisis, hun naasten en verwijzers; regionale afspraken gelden", "Antes clients in crisis, their relatives and referrers; regional agreements apply"), "https://anteszorg.nl/hulp-bij-psychische-klachten/specialistische-hulp"),
  entry("ggnet", "088 933 4400", "urgent-care", both("24 uur per dag voor erkende verwijzers", "24 hours a day for recognized referrers"), both("Apeldoorn/Zutphen en Liemers/Achterhoek. Als cliënt: bel huisarts of eigen behandelaar.", "Apeldoorn/Zutphen and Liemers/Achterhoek. As a client: contact your GP or care professional."), "https://ggnet.nl/crisisdienst", false),
  entry("dierbare", "070 416 17 81", "relatives", both("Bekijk actuele bereikbaarheid op de website", "Check current availability on the website"), both("Stichting Naast: steun voor naasten bij verslaving", "Stichting Naast: support for relatives affected by addiction"), "https://stichtingnaast.nl/contact/"),
  entry("brijder", "088 358 22 60", "advice", both("Bekijk actuele bereikbaarheid op de website", "Check current availability on the website"), both("Brijder Preventie: preventiegesprek; geen crisisdienst", "Brijder Prevention: prevention advice; not a crisis service"), "https://brijder.nl/contact"),
  entry("indigo", "088 357 10 50", "treatment", both("Kantoor; controleer bereikbaarheid op de website", "Office; check availability on the website"), both("Indigo Haaglanden; basis-ggz/preventie. Voor spoed: huisarts/HAP.", "Indigo Haaglanden; primary mental-health care/prevention. Urgent care: GP/out-of-hours GP."), "https://indigo.nl/regios/haaglanden/"),
  entry("veiligthuis", "0800-2000", "safeguarding", both("24 uur per dag; gratis en anoniem advies", "24 hours a day; free anonymous advice"), both("Zorgen over huiselijk geweld of kindermishandeling", "Concerns about domestic violence or child abuse"), "https://www.veiligthuis.nl/nl/over-ons/de-adviesfunctie-van-veilig-thuis"),
  entry("depressielijn", "088-505 4334", "listening", both("Bekijk openingstijden op de website", "Check opening hours on the website"), both("Lotgenotencontact over depressie", "Peer support about depression"), "https://depressievereniging.nl/wat-wij-doen/depressielijn/"),
  entry("meldpunt", "0800-1205", "non-acute-report", both("Lokale bereikbaarheid kan verschillen", "Local availability may vary"), both("Niet-acute zorgen over zorgwekkend gedrag van iemand anders", "Non-urgent concerns about another person's worrying behavior"), "https://www.rijksoverheid.nl/vraag-en-antwoord/geestelijke-gezondheidszorg/meldpunt-zorgwekkend-gedrag"),
  entry("ypsilon", "088-000 21 20", "relatives", both("Ma/di/do/vr 10:00–16:00", "Mon/Tue/Thu/Fri 10:00–16:00"), both("Advies en steun voor naasten", "Advice and support for relatives"), "https://www.ypsilon.org/zorg-voor-jezelf/advies-en-steun/"),
  entry("kindertelefoon", "0800-0432", "listening", both("Bekijk openingstijden op de website", "Check opening hours on the website"), both("Voor kinderen van 8 tot 18 jaar", "For children aged 8 to 18"), "https://www.kindertelefoon.nl/bellen"),
  entry("injebol", "0800-0450", "listening", both("Dagelijks 14:00–22:00", "Daily 14:00–22:00"), both("Voor 16 t/m 27 jaar; gesprek met een vrijwilliger", "Ages 16–27; conversation with a volunteer"), "https://injebol.nl/bellen-chatten-hoe-werkt-het/"),
];
const ROLE_LABELS: Record<CareRole, LocalText> = {
  emergency: both("Noodhulp", "Emergency"), "suicide-support": both("Hulp bij zelfdodingsgedachten", "Suicide support"), "urgent-care": both("Spoedeisende zorg — toegangsafspraken gelden", "Urgent care — access restrictions apply"),
  treatment: both("Reguliere zorg / aanmelding", "Regular care / intake"), advice: both("Informatie en advies", "Information and advice"), listening: both("Luisterend oor / lotgenoten", "Listening / peer support"), relatives: both("Steun voor naasten", "Support for relatives"), safeguarding: both("Veiligheid thuis", "Safety at home"), "non-acute-report": both("Niet-acute melding", "Non-urgent concern"), unverified: both("Eigen contact — functie/bereikbaarheid niet bevestigd", "Personal contact — role/availability unconfirmed"),
};
export const careRoleLabel = (role: CareRole, language: "en" | "nl") => ROLE_LABELS[role]?.[language] ?? ROLE_LABELS.unverified[language];
export function careFallback(language: "en" | "nl"): string {
  return language === "nl" ? "Bij dringende medische of psychische zorgen: bel je huisarts, buiten kantooruren de huisartsenpost, of je behandelteam volgens jouw afspraken. Bij direct gevaar: 112. Bij zelfdodingsgedachten: 113, 0800-0113 of chat via 113.nl."
    : "For urgent medical or mental-health concerns: contact your GP, the out-of-hours GP service, or your treatment team according to your agreed plan. Immediate danger: 112. Suicide concerns: 113, 0800-0113 or chat at 113.nl.";
}
const digits = (number: string) => number.replace(/[^\d+]/g, "");
export function resolveCareContact(service: CrisisService, language: "en" | "nl") {
  const known = CARE_DIRECTORY.find(item => item.id === service.id);
  const matches = known && !service.isCustom && digits(known.number) === digits(service.number);
  return {
    role: (matches ? known.role : service.isCustom ? service.role ?? "unverified" : "unverified") as CareRole,
    availability: matches ? known.availability[language] : service.availability || (language === "nl" ? "Bereikbaarheid niet bevestigd" : "Availability unconfirmed"),
    eligibility: matches ? known.eligibility[language] : service.eligibility || (language === "nl" ? "Controleer met dit contact waarvoor en wanneer je kunt bellen." : "Confirm with this contact when and why to call."),
    sourceUrl: known?.sourceUrl, checkedAt: matches ? known.checkedAt : undefined,
    publicDirect: matches ? known.publicDirect : !known || service.isCustom,
    changedNumber: !!known && !service.isCustom && !matches,
  };
}
export function directoryContact(entry: CareDirectoryEntry, name: string): CrisisService {
  return { id: entry.id, name, number: entry.number, isCustom: false };
}
