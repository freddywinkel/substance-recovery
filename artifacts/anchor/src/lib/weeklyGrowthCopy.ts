export const WEEKLY_GROWTH_FIELDS = [
  "rememberFromWeek",
  "choseForMyself",
  "makeRoomForNextWeek",
  "pleasantActivity",
] as const;

export const WEEKLY_GROWTH_COPY = {
  nl: {
    subtitle:
      "Sta stil bij je week en wat je ruimte wilt geven. Ook zonder registraties.",
    title: "Wat ik wil meenemen",
    optional:
      "Alle vragen zijn optioneel. Eén antwoord is genoeg; je mag ook stoppen zonder iets op te slaan.",
    rememberFromWeek: "Wat wil ik van deze week onthouden?",
    choseForMyself: "Waarin koos ik voor mezelf?",
    makeRoomForNextWeek: "Waar wil ik komende week ruimte voor maken?",
    pleasantActivity: "Eén fijne activiteit (optioneel)",
    activityHint:
      "Je eigen idee staat voorop. Bijvoorbeeld tekenen, muziek maken, iemand ontmoeten, koffie drinken of rustig buiten zitten. Geen verplichting om het af te vinken.",
    planning: "Patronen en een ondersteunend plan (optioneel)",
    planningHint:
      "Je kunt dit overslaan. Als je een ondersteunend plan wilt bewaren, kies dan een waarneming en een passende stap.",
    noPattern: "Geen patroon of ondersteunend plan kiezen",
    emptyWeek:
      "Ook zonder probleemregistraties kun je hieronder terugkijken op je week.",
    save: "Weekreflectie opslaan",
    saved: "Weekreflectie op dit apparaat opgeslagen.",
    empty:
      "Schrijf iets bij één van de vragen, of kies een waarneming met een ondersteunend plan. Je mag ook stoppen voor nu.",
    saveError:
      "Opslaan is niet gelukt. Je invoer staat hier nog. Probeer opnieuw.",
    cleanupError:
      "Je reflectie is opgeslagen, maar het concept kon niet worden opgeruimd. Je invoer blijft staan; probeer opnieuw zonder een tweede reflectie te maken.",
    longObservation:
      "Houd je eigen waarneming binnen 1000 tekens. Je huidige tekst blijft bewaard als concept.",
    savedTitle: "Bewaard voor deze week",
    leave: "Stoppen voor nu",
    discard: "Concept wissen",
    confirmDiscard:
      "Je onafgemaakte bewerking wissen? Een opgeslagen weekreflectie blijft behouden.",
    discardAction: "Concept wissen en terugzetten",
    remove: "Opgeslagen weekreflectie verwijderen",
    confirmRemove:
      "Deze weekreflectie en het bijbehorende concept verwijderen? Je andere registraties en momenten blijven behouden.",
    removeAction: "Weekreflectie verwijderen",
    removed: "Weekreflectie verwijderd.",
    cancel: "Annuleren",
    conflict:
      "Deze weekreflectie is in een ander venster gewijzigd of verwijderd. Je invoer is behouden en de nieuwere versie is niet overschreven.",
    loadLatest: "Huidige opgeslagen versie openen",
    confirmLatest:
      "Je eigen onafgemaakte bewerking wissen en de huidige opgeslagen versie laden?",
    latestAction: "Mijn bewerking wissen en laden",
    deleteError:
      "Wissen is niet gelukt. Probeer opnieuw; je invoer blijft beschikbaar.",
    retainedPattern: "Eerder opgeslagen waarneming",
  },
  en: {
    subtitle:
      "Reflect on your week and what you want to make room for. Records are not required.",
    title: "What I want to take with me",
    optional:
      "Every question is optional. One answer is enough; you can also stop without saving anything.",
    rememberFromWeek: "What do I want to remember from this week?",
    choseForMyself: "Where did I choose for myself?",
    makeRoomForNextWeek: "What do I want to make room for next week?",
    pleasantActivity: "One enjoyable activity (optional)",
    activityHint:
      "Your own idea comes first. For example drawing, making music, meeting someone, having coffee or sitting outside. There is no obligation to tick it off.",
    planning: "Patterns and a supportive plan (optional)",
    planningHint:
      "You can skip this. To save a supportive plan, choose an observation and a step that fits it.",
    noPattern: "Choose no pattern or supportive plan",
    emptyWeek:
      "You can reflect on your week below even without problem registrations.",
    save: "Save weekly reflection",
    saved: "Weekly reflection saved on this device.",
    empty:
      "Write something for one of the questions, or choose an observation with a supportive plan. You can also stop for now.",
    saveError: "Saving failed. Your input is still here. Try again.",
    cleanupError:
      "Your reflection was saved, but its draft could not be cleared. Your input stays here; retry without creating a second reflection.",
    longObservation:
      "Keep your own observation within 1000 characters. Your current text is retained as a draft.",
    savedTitle: "Saved for this week",
    leave: "Stop for now",
    discard: "Clear draft",
    confirmDiscard:
      "Clear your unfinished edit? Any saved weekly reflection will be kept.",
    discardAction: "Clear draft and reset",
    remove: "Delete saved weekly reflection",
    confirmRemove:
      "Delete this weekly reflection and its draft? Your other records and moments will be kept.",
    removeAction: "Delete weekly reflection",
    removed: "Weekly reflection deleted.",
    cancel: "Cancel",
    conflict:
      "This weekly reflection changed or was deleted in another window. Your input is retained and the newer version was not overwritten.",
    loadLatest: "Open current saved version",
    confirmLatest:
      "Discard your unfinished edit and load the current saved version?",
    latestAction: "Discard my edit and load",
    deleteError: "Clearing failed. Try again; your input is still available.",
    retainedPattern: "Previously saved observation",
  },
} as const;
