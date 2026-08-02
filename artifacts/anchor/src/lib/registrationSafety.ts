export type SafetyLanguage = "en" | "nl";

// Safety wording was source-checked in an AI-assisted software/content pass on
// 2026-08-02. Qualified bilingual human clinical/content review remains pending.
// Keep the UI concise and re-check these sources when changing emergency or
// withdrawal copy:
// https://www.113.nl/i/ik-heb-hulp-nodig
// https://www.drugsinfo.nl/vraag/wat-zijn-ontwenningsverschijnselen
// https://www.drugsinfo.nl/heroine/heroine-risicos-verminderen
// https://www.drugsinfo.nl/overige-middelen/wat-is-narcan-naloxone/

export interface SubstanceSafetyWarning {
  key: "alcohol" | "benzodiazepines" | "opioids";
  title: string;
  body: string;
}

interface UrgentSafetyCopy {
  title: string;
  assessmentLimit: string;
  emergency: string;
  unsafe: string;
  continuedUse: string;
  withdrawal: string;
  selfHarm: string;
  humanHelp: string;
  call112: string;
  call113: string;
  call0800: string;
  visit113: string;
  configuredService: string;
}

const URGENT_SAFETY_COPY: Record<SafetyLanguage, UrgentSafetyCopy> = {
  en: {
    title: "Get human help now",
    assessmentLimit: "This app cannot assess whether this is a medical emergency.",
    emergency:
      "Call 112 now for immediate danger, loss of consciousness, a seizure, severe confusion, severe chest pain, or slow or difficult breathing.",
    unsafe:
      "If you do not feel safe where you are, contact emergency services or move toward another person or safer place if you can do so safely.",
    continuedUse:
      "If you are concerned you may continue using or act on a behaviour, contact a trusted person, your GP, addiction service, or configured crisis service now.",
    withdrawal:
      "Withdrawal can sometimes require urgent medical care. Contact a GP, out-of-hours GP service, or addiction doctor now. Call 112 for a seizure, collapse, severe confusion, or trouble breathing.",
    selfHarm:
      "If you might hurt yourself or someone else, do not stay alone with that risk. Call 112 for immediate danger. For thoughts of suicide, call 113 or freephone 0800-0113, or chat at 113.nl.",
    humanHelp:
      "If it is not an immediate emergency, contact your GP, out-of-hours GP service, or configured crisis service now.",
    call112: "Call 112",
    call113: "Call 113",
    call0800: "Call freephone 0800-0113",
    visit113: "Chat at 113.nl",
    configuredService: "Configured crisis service",
  },
  nl: {
    title: "Schakel nu menselijke hulp in",
    assessmentLimit: "Deze app kan niet beoordelen of dit een medisch noodgeval is.",
    emergency:
      "Bel nu 112 bij direct gevaar, bewusteloosheid, een aanval, ernstige verwardheid, ernstige pijn op de borst of een langzame of moeilijke ademhaling.",
    unsafe:
      "Voel je je niet veilig waar je bent, neem dan contact op met de hulpdiensten of ga naar een andere persoon of veiligere plek als dat veilig kan.",
    continuedUse:
      "Ben je bang dat je doorgaat met gebruiken of het gedrag uitvoert, neem dan nu contact op met iemand die je vertrouwt, je huisarts, verslavingszorg of ingestelde crisisdienst.",
    withdrawal:
      "Ontwenning kan soms dringende medische zorg vereisen. Neem nu contact op met een huisarts, huisartsenpost of verslavingsarts. Bel 112 bij een aanval, instorten, ernstige verwardheid of moeite met ademhalen.",
    selfHarm:
      "Als je jezelf of iemand anders mogelijk iets aandoet, blijf dan niet alleen met dat risico. Bel 112 bij direct gevaar. Bij gedachten aan zelfdoding kun je 113 of gratis 0800-0113 bellen, of chatten via 113.nl.",
    humanHelp:
      "Is het geen direct noodgeval, neem dan nu contact op met je huisarts, huisartsenpost of ingestelde crisisdienst.",
    call112: "Bel 112",
    call113: "Bel 113",
    call0800: "Bel gratis 0800-0113",
    visit113: "Chat via 113.nl",
    configuredService: "Ingestelde crisisdienst",
  },
};

const SUBSTANCE_WARNINGS: Record<
  SubstanceSafetyWarning["key"],
  Record<SafetyLanguage, Omit<SubstanceSafetyWarning, "key">>
> = {
  alcohol: {
    en: {
      title: "Alcohol: get medical advice before stopping suddenly",
      body:
        "If you may be physically dependent on alcohol, suddenly stopping can sometimes cause dangerous withdrawal. Contact a GP, out-of-hours GP service, or addiction doctor for personal advice. Call 112 for a seizure, collapse, severe confusion, or trouble breathing.",
    },
    nl: {
      title: "Alcohol: vraag medisch advies voordat je abrupt stopt",
      body:
        "Als er mogelijk lichamelijke afhankelijkheid van alcohol is, kan plotseling stoppen soms gevaarlijke ontwenningsverschijnselen geven. Vraag persoonlijk advies aan een huisarts, huisartsenpost of verslavingsarts. Bel 112 bij een aanval, instorten, ernstige verwardheid of moeite met ademhalen.",
    },
  },
  benzodiazepines: {
    en: {
      title: "Benzodiazepines: do not change use abruptly without advice",
      body:
        "After regular use, suddenly stopping benzodiazepines can sometimes cause dangerous withdrawal. Contact the prescriber, a GP, out-of-hours GP service, or addiction doctor for a supervised plan. Call 112 for a seizure, collapse, severe confusion, or trouble breathing.",
    },
    nl: {
      title: "Benzodiazepinen: verander gebruik niet abrupt zonder advies",
      body:
        "Na regelmatig gebruik kan plotseling stoppen met benzodiazepinen soms gevaarlijke ontwenningsverschijnselen geven. Neem voor een begeleid plan contact op met de voorschrijver, huisarts, huisartsenpost of verslavingsarts. Bel 112 bij een aanval, instorten, ernstige verwardheid of moeite met ademhalen.",
    },
  },
  opioids: {
    en: {
      title: "Opioids: overdose and withdrawal safety",
      body:
        "After a break, tolerance can be lower and a previously used dose can cause an overdose. Mixing opioids with alcohol or sedatives increases breathing risk. Get medical advice before stopping or restarting. If someone is hard to wake or is breathing slowly or not at all, call 112 immediately; give naloxone only if it is available and you know how to use it.",
    },
    nl: {
      title: "Opioïden: veiligheid bij overdosering en ontwenning",
      body:
        "Na een onderbreking kan de tolerantie lager zijn en kan een eerder gebruikte dosis een overdosis veroorzaken. Combineren met alcohol of kalmerende middelen vergroot het risico op ademhalingsproblemen. Vraag medisch advies voordat je stopt of opnieuw gebruikt. Is iemand moeilijk wakker te krijgen of ademt diegene langzaam of niet, bel dan direct 112; dien naloxon alleen toe als dit beschikbaar is en je weet hoe je het moet gebruiken.",
    },
  },
};

export function getUrgentSafetyCopy(language: SafetyLanguage): UrgentSafetyCopy {
  return URGENT_SAFETY_COPY[language];
}

export function getSubstanceSafetyWarnings(
  substances: string[],
  language: SafetyLanguage,
): SubstanceSafetyWarning[] {
  const normalized = new Set(substances.map((substance) => substance.toLowerCase()));
  const keys: SubstanceSafetyWarning["key"][] = [];

  if (normalized.has("alcohol")) keys.push("alcohol");
  if (normalized.has("benzodiazepines")) keys.push("benzodiazepines");
  if (normalized.has("opioids")) keys.push("opioids");

  return keys.map((key) => ({ key, ...SUBSTANCE_WARNINGS[key][language] }));
}

export function phoneHref(number: string): string {
  const normalized = number.trim().replace(/[^\d+]/g, "");
  return `tel:${normalized}`;
}
