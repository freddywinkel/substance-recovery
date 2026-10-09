export const USE_PERIOD_COPY = {
  nl: {
    title: "Gebruik achteraf vastleggen",
    history: "Gebruik achteraf",
    editTitle: "Periode bewerken",
    intro:
      "Niet alles gelogd? Je kunt een gebruiksdag of een langere periode in één keer vastleggen. Een uitgebreide terugblik is niet nodig.",
    local: "Lokaal op dit apparaat opgeslagen",
    target: "Middel of gedrag",
    choose: "Kies een middel of gedrag",
    first: "Eerste gebruiksdag",
    last: "Laatste gebruiksdag",
    dateHint:
      "Kies dagen waarop je hebt gebruikt. De laatste dag bepaalt de laatste gemelde gebruiksdatum; er wordt geen tijdstip ingevuld.",
    frequency: "Hoe vaak in deze periode?",
    daily: "Elke dag",
    some: "Op sommige dagen",
    unknown: "Weet ik niet meer",
    frequencyHint:
      "Alleen ‘Elke dag’ telt alle dagen als gemelde gebruiksdagen. Anders tellen alleen de opgegeven eerste en laatste dag en je losse registraties.",
    note: "Notitie (optioneel)",
    save: "Gebruik opslaan",
    saving: "Opslaan…",
    saved: "Gebruik bewaard.",
    today: "Vandaag",
    twoWeeks: "Afgelopen 2 weken",
    presetHint: "Je kunt de datums hieronder aanpassen.",
    required:
      "Kies een middel of gedrag en geldige eerste en laatste gebruiksdag. De laatste dag moet op of na de eerste dag liggen en mag niet in de toekomst liggen.",
    conflict:
      "Deze periode is in een ander venster gewijzigd of verwijderd. Je concept is bewaard. Laad de nieuwste gegevens voordat je verdergaat.",
    overlap:
      "Er staat al een periode voor dit middel of gedrag in deze datums. Pas die periode aan om dubbel tellen te voorkomen. Je concept is bewaard.",
    error: "Opslaan is niet gelukt. Je invoer staat hier nog; probeer opnieuw.",
    cleanup:
      "Het gebruik is opgeslagen, maar het concept kon niet worden gewist. Opnieuw opslaan maakt geen dubbele registratie.",
    editExisting: "Bestaande periode bewerken",
    collection: "Bekijk vastgelegd gebruik",
    home: "Terug naar Thuis",
    again: "Nog een periode vastleggen",
    empty:
      "Nog geen gebruik achteraf vastgelegd. Je bestaande losse registraties blijven meetellen bij je doelen.",
    edit: "Periode bewerken",
    remove: "Periode verwijderen",
    confirm: "Deze periode verwijderen? Je losse registraties blijven bewaard.",
    yes: "Ja, verwijderen",
    cancel: "Annuleren",
    deleteError:
      "Verwijderen is niet gelukt. Vernieuw de gegevens en probeer opnieuw.",
    reload: "Gegevens opnieuw laden",
    loading: "Gebruik laden…",
    loadError: "Je gegevens konden niet volledig worden geladen.",
    missing: "Deze periode is niet meer beschikbaar.",
    discard: "Concept wissen",
    discardQuestion:
      "Dit concept wissen? Je opgeslagen periode blijft bewaard.",
    discardYes: "Ja, concept wissen",
    reloadDraft: "Concept wissen en gegevens opnieuw laden",
    retrospective: "Achteraf vastgelegd",
    totalHint:
      "Een periode telt als één registratie met gemeld gebruik. Momenten binnen die periode tellen niet nogmaals mee in dat totaal. Dit is geen telling van elk afzonderlijk gebruiksmoment.",
    evidence:
      "Dagen sinds de laatste gemelde gebruiksdag zijn geen bevestigde abstinentie. Dagen zonder invoer blijven onbekend.",
    prescribed:
      "Leg hier het gebruik vast dat bij jouw hersteldoel hoort. Medicatie volgens voorschrift hoeft niet als terugval te worden geregistreerd.",
  },
  en: {
    title: "Record use retrospectively",
    history: "Retrospective use",
    editTitle: "Edit period",
    intro:
      "Missed some entries? Record a use day or a longer period in one go. A detailed reflection is optional.",
    local: "Stored locally on this device",
    target: "Substance or behavior",
    choose: "Choose a substance or behavior",
    first: "First use day",
    last: "Last use day",
    dateHint:
      "Choose days on which you used. The last day determines your last reported use date; no time of day is assumed.",
    frequency: "How often during this period?",
    daily: "Every day",
    some: "On some days",
    unknown: "I don't remember",
    frequencyHint:
      "Only ‘Every day’ counts every day as a reported use day. Otherwise only your first and last day and individual entries count.",
    note: "Note (optional)",
    save: "Save use",
    saving: "Saving…",
    saved: "Use saved.",
    today: "Today",
    twoWeeks: "Past 2 weeks",
    presetHint: "You can adjust the dates below.",
    required:
      "Choose a substance or behavior and valid first and last use days. The last day must be on or after the first and cannot be in the future.",
    conflict:
      "This period changed or was deleted in another window. Your draft is kept. Load the latest data before continuing.",
    overlap:
      "A period for this substance or behavior already covers these dates. Edit it to avoid counting twice. Your draft is kept.",
    error: "Could not save. Your input is still here; please retry.",
    cleanup:
      "Use was saved, but the draft could not be cleared. Saving again will not create a duplicate.",
    editExisting: "Edit existing period",
    collection: "View recorded use",
    home: "Back to Home",
    again: "Record another period",
    empty:
      "No retrospective use recorded yet. Your individual entries still count toward your goals.",
    edit: "Edit period",
    remove: "Delete period",
    confirm: "Delete this period? Your individual entries will be kept.",
    yes: "Yes, delete",
    cancel: "Cancel",
    deleteError: "Could not delete. Refresh your data and retry.",
    reload: "Reload data",
    loading: "Loading use…",
    loadError: "Your data could not be loaded completely.",
    missing: "This period is no longer available.",
    discard: "Discard draft",
    discardQuestion: "Discard this draft? Your saved period will be kept.",
    discardYes: "Yes, discard draft",
    reloadDraft: "Discard draft and reload data",
    retrospective: "Recorded retrospectively",
    totalHint:
      "A period counts as one record of reported use. Events within it are not counted again in that total. This is not a count of every individual use event.",
    evidence:
      "Days since the last reported use day are not confirmed abstinence. Days without entries remain unknown.",
    prescribed:
      "Record use relevant to your recovery goal here. Medication taken as prescribed does not need to be recorded as a return to use.",
  },
} as const;
