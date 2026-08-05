import {
  ACUTE_RISK_SELECTION_VALUES,
  acuteRiskCompatibilityAlias,
  isAcuteRisk,
  isValidAcuteRiskSelectionArray,
  normalizeAcuteRisks,
} from "@/db/relapseSafety";
import { relapseWhenForOccurrence } from "@/db/relapseTiming";
import {
  RETIRED_TREK_AXIS_MIGRATIONS,
  RETIRED_TREK_IMMEDIACY_MIGRATIONS,
} from "@/lib/trekMigration";
import {
  RELAPSE_NO_CLEAR_TRIGGER_ID,
  relapseFirstTriggerIdForRead,
} from "@/lib/relapseTrigger";
import {
  activeBoredomClassificationNeedsMigration,
  BOREDOM_CLASSIFICATION_NOT_SURE_ID,
  normalizeActiveBoredomClassification,
} from "@/lib/boredomClassification";

export const ACTIVE_REGISTRATION_VERSION = 3 as const;

export type RegistrationType =
  | "craving"
  | "trek"
  | "anxiety"
  | "boredom"
  | "relapse";

export interface PendingReturn {
  returnRoute: string;
  returnStep: string;
}

export interface ActiveRegistration {
  version: typeof ACTIVE_REGISTRATION_VERSION;
  type: RegistrationType;
  route: string;
  step: string;
  /** Runtime-validated per type before entering tracker state. */
  draft: unknown;
  /** Stable ID reused by idempotent save attempts for this registration. */
  recordId: string;
  startedAt: number;
  updatedAt: number;
  savedLogId?: string;
  /** Exact quick registration that opened this detailed reflection. */
  quickRegistrationId?: string;
  /** Original quick-event time, kept separate from the later reflection start. */
  quickRegistrationTimestamp?: number;
  pendingReturn?: PendingReturn;
  stepIndex?: number;
  stepCount?: number;
}

export type ActiveRegistrationParseResult =
  | {
      ok: true;
      value: ActiveRegistration | null;
      migrated: boolean;
    }
  | {
      ok: false;
      value: null;
      migrated: false;
      error: string;
    };

type UnknownRecord = Record<string, unknown>;

const ROUTES: Record<RegistrationType, string> = {
  craving: "/craving",
  trek: "/trek",
  anxiety: "/anxiety",
  boredom: "/boredom",
  relapse: "/relapse",
};

const STEPS: Record<RegistrationType, readonly string[]> = {
  craving: ["onset", "trigger", "inner", "substance", "action", "outcome", "done"],
  trek: ["type", "planning", "inner", "need", "substance", "action", "outcome", "done"],
  anxiety: ["type", "body", "urgency", "details", "reaction", "done"],
  boredom: ["type", "need", "situation", "action", "done"],
  relapse: ["label", "when", "trigger", "before", "next", "done"],
};

const DRAFT_DEFAULTS: Record<RegistrationType, UnknownRecord> = {
  craving: {
    onsetType: "",
    intensity: null,
    confidenceBefore: null,
    situationPresets: [],
    physicalSensations: [],
    buildupDuration: "",
    onsetOther: "",
    triggerOther: "",
    location: "",
    emotions: [],
    emotionOther: "",
    thoughtPresets: [],
    thoughtFreeText: "",
    chosenAction: "",
    actionAttempted: null,
    substances: [],
    cravingOutcome: "",
    intensityAfter: null,
    useOutcome: "",
  },
  trek: {
    trekTypes: [],
    intensity: null,
    confidenceBefore: null,
    planningStage: "",
    location: "",
    locationOther: "",
    triggers: [],
    triggerNote: "",
    emotions: [],
    emotionOther: "",
    physicalSensations: [],
    thoughtPresets: [],
    thoughtFreeText: "",
    needTypes: [],
    needOther: "",
    substances: [],
    chosenAction: "",
    actionAttempted: null,
    confidenceAfter: null,
    useOutcome: "",
  },
  anxiety: {
    anxietyTypes: [],
    intensity: null,
    bodyLocations: [],
    bodyPrediction: "",
    urgencyHigh: null,
    context: "",
    triggers: [],
    reassuranceSeeking: [],
    linkedStates: [],
    reaction: "",
    showNote: false,
    note: "",
    outcome: "",
  },
  boredom: {
    restlessnessTypes: [],
    intensity: null,
    stimulationNeeds: [],
    convertCheck: "",
    situation: "",
    situationOther: "",
    urge: "",
    urgeOther: "",
    rescueMenu: [],
    action: "",
    showNote: false,
    note: "",
    delayTimerStartedAt: null,
    delayDuration: null,
  },
  relapse: {
    label: "",
    when: "",
    occurrenceDateTime: "",
    episodeDuration: "unanswered",
    substances: [],
    primarySubstance: "",
    amountCategory: "unanswered",
    firstTriggerType: "",
    firstTriggerText: "",
    preUseFactors: [],
    missedWarnings: [],
    preUseThoughtPreset: "",
    preUseThoughtPresets: [],
    preUseThoughtFreeText: "",
    couldHaveHelpedEarly: [],
    couldHaveHelpedMiddle: [],
    couldHaveHelpedLast: [],
    supportContact: "",
    supportContactOther: "",
    nextStep: "",
    nextStepOther: "",
    acuteRisks: [],
    acuteRisk: "unanswered",
    note: "",
    context: "",
    emotionAfter: null,
    whatNeeded: "",
    repairActions: [],
  },
};

type DraftCatalog = {
  scalars: Readonly<Record<string, readonly string[]>>;
  arrays: Readonly<Record<string, readonly string[]>>;
  arrayLimits?: Readonly<Record<string, number>>;
};

function optionalValues(values: readonly string[]): readonly string[] {
  return ["", ...values];
}

const SUBSTANCE_VALUES = [
  "Alcohol", "Cannabis", "Cocaine / stimulant", "Benzodiazepines", "Nicotine",
  "Opioids", "Gambling", "Sex / pornography", "Gaming", "Food / binge eating",
] as const;
const EMOTION_VALUES = [
  "Anxious", "Tense", "Low / sad", "Empty", "Angry", "Frustrated", "Guilty",
  "Ashamed", "Lonely", "Bored", "Restless", "Overwhelmed", "Rejected",
  "Hopeless", "Excited / hyped", "Numb",
] as const;
const PHYSICAL_VALUES = [
  "Restlessness", "Chest tightness", "Head pressure", "Nausea", "Sweating",
  "Trembling", "Rapid heartbeat", "Fatigue", "Empty feeling", "Nervous energy",
  "Feeling rushed", "Urge in the body",
] as const;
const THOUGHT_VALUES = [
  "I can't handle this", "Just one won't matter", "No one will notice",
  "I've earned this", "It doesn't matter anymore", "I just want peace",
  "I want to feel / stop feeling", "I'll start fresh tomorrow",
] as const;
const OUTCOME_VALUES = ["decreased", "same", "increased", "dont-know"] as const;
const USE_OUTCOME_VALUES = ["used", "not_used", "unsure"] as const;

const BOREDOM_RESCUE_VALUES = [
  "Shower", "Tea or water", "Cold water on face", "Breathe slowly", "Lie down briefly",
  "Short walk", "Stretch", "Shake tension out", "Paced steps", "2-minute movement",
  "Fold laundry", "Tidy one area", "Doodle", "Snack prep", "Organize a drawer",
  "Simple reading", "Podcast", "Low-intensity game", "Recipe browsing", "Light admin task",
  "Hold something textured", "Notice one scent", "Cold or warm water on hands",
  "Listen to one sound", "Fresh air or softer light", "Call or text someone",
  "Sit near other people", "Ask someone to join a short walk",
  "Send a simple check-in message",
  // Retained version-1 values. They remain valid so a migrated draft can be
  // parsed again without discarding an already selected rescue action.
  "Open a window", "Softer lights", "Leave the room", "Change clothes",
  "Sit somewhere else",
] as const;

const RELAPSE_THOUGHT_VALUES = [
  "I can't handle this", "I'll stop tomorrow", "One time won't matter",
  "It's already ruined", "I just want peace", "I don't want to feel anything",
  "I earned this", "No one will know",
] as const;

/** Canonical values stored by tracker controls; free-text fields are omitted. */
const DRAFT_CATALOGS: Record<RegistrationType, DraftCatalog> = {
  craving: {
    scalars: {
      onsetType: optionalValues([
        "Sudden cue (saw/smelled/heard)", "Physical sensation", "Memory or flashback",
        "Social trigger", "Random / no reason", "Other",
      ]),
      buildupDuration: optionalValues([
        "just-started", "5-15min", "15-60min", "few-hours", "since-morning",
        "most-of-day", "multiple-days",
      ]),
      location: optionalValues([
        "Home", "Work", "Outside", "Shop or bar", "In transit",
        "At someone else's place", "Prefer not to say",
      ]),
      chosenAction: optionalValues([
        "urge-surfing", "box-breathing", "grounding", "distraction", "call-someone",
        "just-observed",
      ]),
      cravingOutcome: optionalValues(OUTCOME_VALUES),
      useOutcome: optionalValues(USE_OUTCOME_VALUES),
    },
    arrays: {
      situationPresets: [
        "Home alone", "On my way somewhere", "After work", "Conflict or argument",
        "Feeling bored", "Under stress", "Bad news", "Party or social event",
        "Someone using nearby", "Saw or smelled a trigger",
        "No clear situation / not sure", "Other",
      ],
      physicalSensations: PHYSICAL_VALUES,
      emotions: EMOTION_VALUES,
      thoughtPresets: THOUGHT_VALUES,
      substances: SUBSTANCE_VALUES,
    },
    arrayLimits: {
      physicalSensations: 3,
      emotions: 3,
      thoughtPresets: 2,
    },
  },
  trek: {
    scalars: {
      planningStage: optionalValues([
        "immediacy-thoughts-only", "immediacy-steps-started",
        "immediacy-access-close", "immediacy-about-to-act",
      ]),
      location: optionalValues([
        "Home", "Work", "Outside", "Shop or bar", "In transit",
        "Someone else's place", "Other",
      ]),
      chosenAction: optionalValues([
        "remove-access", "change-location", "delay-timer", "call-someone", "use-tool",
        "just-observe",
      ]),
      useOutcome: optionalValues(USE_OUTCOME_VALUES),
    },
    arrays: {
      trekTypes: [
        "approach-mental-rehearsal", "approach-checking-availability",
        "approach-arranging-access", "approach-moving-toward",
        "approach-automatic-routine", "approach-responding-to-contact",
        "approach-not-sure",
      ],
      triggers: [
        "Boredom", "Stress", "Habit / routine", "Social pressure", "Money available",
        "Feeling good / celebratory", "Conflict", "No clear trigger / not sure", "Other",
      ],
      emotions: EMOTION_VALUES,
      physicalSensations: PHYSICAL_VALUES,
      thoughtPresets: THOUGHT_VALUES,
      needTypes: [
        "Relief", "Excitement", "Reward", "Numbness", "Comfort", "Connection",
        "Stimulation", "Escape", "Not sure", "Other",
      ],
      substances: SUBSTANCE_VALUES,
    },
    arrayLimits: {
      trekTypes: 2,
      emotions: 3,
      physicalSensations: 3,
      thoughtPresets: 2,
    },
  },
  anxiety: {
    scalars: {
      context: optionalValues([
        "Social — with unknowns", "Work / performance", "Alone", "After using / crash",
        "Nothing specific", "Other",
      ]),
      reaction: optionalValues([
        "Sat with it — didn't react", "Tried to fix myself", "Avoided or left",
        "Searched for distraction", "Talked more / overcompensated",
        "Used a tool (breathing, grounding…)", "Reached out to someone",
        "Not yet / just logging",
      ]),
      outcome: optionalValues(OUTCOME_VALUES),
    },
    arrays: {
      anxietyTypes: [
        "Panic spike", "Health anxiety", "Dread", "Racing thoughts", "Social anxiety",
        "Generalized worry", "Shame / fear after use", "Future fear", "Body anxiety",
      ],
      bodyLocations: [
        "Chest", "Stomach", "Throat", "Head", "Arms", "Legs", "Whole body",
        "Not in one place / not sure",
      ],
      triggers: [
        "Feeling observed", "Thought about appearance", "Silence / nothing to do",
        "Social expectation", "Fear of judgment", "Something else",
      ],
      reassuranceSeeking: [
        "Googling symptoms / reassurance", "Checking body or pulse",
        "Asking others repeatedly", "Avoiding the situation", "Ruminating / replaying",
        "Compulsive distraction",
      ],
      linkedStates: [
        "This is triggering a craving", "This started from restlessness",
        "Poor sleep contributed", "After a conflict", "After substance use",
        "Not connected to anything specific",
      ],
    },
    arrayLimits: {
      anxietyTypes: 2,
    },
  },
  boredom: {
    scalars: {
      convertCheck: optionalValues([
        "Yes — this feels like restlessness", "Maybe a craving", "Maybe anxiety",
        "Maybe loneliness", "Maybe exhaustion", BOREDOM_CLASSIFICATION_NOT_SURE_ID,
      ]),
      situation: optionalValues([
        "Doing nothing", "Between activities", "Alone", "After stimulation drops",
        "Before sleep", "Other",
      ]),
      urge: optionalValues([
        "Scroll / phone", "Gaming", "Eat", "Use substances", "Seek people",
        "Other stimulation",
      ]),
      action: optionalValues([
        "Sat with it — didn't react", "Delayed action", "Replaced with healthy routine",
        "Escaped immediately", "Not yet / just logging",
      ]),
    },
    arrays: {
      restlessnessTypes: [
        "Bored", "Understimulated", "Physically agitated", "Mentally noisy",
        "Can't sit still", "Empty", "Irritated", "Craving stimulation",
        "Lonely and restless", "Tired but wired",
      ],
      stimulationNeeds: [
        "calming", "movement", "sensory-reset", "hands", "mental", "social", "not-sure",
      ],
      rescueMenu: BOREDOM_RESCUE_VALUES,
    },
    arrayLimits: {
      restlessnessTypes: 2,
    },
  },
  relapse: {
    scalars: {
      // `setback` and `return-to-use` are retained schema values from earlier
      // releases and are available in the current optional selector.
      label: optionalValues(["lapse", "setback", "return-to-use", "relapse", "no-label"]),
      when: optionalValues(["just-now", "today", "yesterday", "few-days"]),
      episodeDuration: [
        "unanswered", "single-moment", "few-hours", "whole-day", "multiple-days",
      ],
      // Compatibility storage only. Current v3 controls use the visible
      // `substances` array; a non-empty scalar is migrated exclusively while
      // reading a v1/v2 draft and must never become a hidden v3 answer.
      primarySubstance: [""],
      amountCategory: [
        "unanswered", "small", "moderate", "a-lot", "multiple-times", "binge",
        "prefer-not",
      ],
      firstTriggerType: optionalValues([
        "Internal emotion", "External event", "Specific thought", "Physical discomfort",
        "Social pressure", "Craving out of nowhere", "Memory / flashback",
        "Seeing or smelling a cue", RELAPSE_NO_CLEAR_TRIGGER_ID,
      ]),
      // Compatibility-only scalar. Current v3 controls persist the plural
      // `preUseThoughtPresets` answer and never infer a primary from array order.
      preUseThoughtPreset: [""],
      supportContact: optionalValues([
        "No one right now", "Partner", "Friend", "Family member", "Sponsor",
        "Therapist / counsellor", "GP / doctor", "Crisis line if needed",
      ]),
      nextStep: optionalValues([
        "Water, food, rest first", "Remove triggers from reach", "Reach out to someone",
        "Plan the next 24 hours", "Get back to routine", "Structure today",
        "Make an appointment", "Use a support tool", "Start again from right now",
      ]),
      acuteRisk: [
        "unanswered", "none", "unsafe", "fear-continued-use", "withdrawal",
        "self-harm-risk",
      ],
      whatNeeded: optionalValues([
        "relief", "sleep", "numbness", "comfort", "stimulation", "escape",
        "connection", "reward", "silence", "rebellion", "other",
      ]),
    },
    arrays: {
      substances: SUBSTANCE_VALUES,
      preUseFactors: [
        "Poor sleep", "High stress", "Conflict", "Isolation", "Boredom",
        "Too much self-confidence", "Stopped reaching out", "Let go of routines",
        "Sought out a trigger place", "Had money available", "Contact with a trigger person",
        "Mood got worse gradually", "Felt 'invincible' — too good",
      ],
      missedWarnings: [
        "Withdrawing from others", "Not talking about how I felt",
        "Increased irritability", "Poor self-care", "Hungry / tired / overwhelmed",
        "Bargaining with myself", "Romanticizing past use", "'Just once' thinking",
        "Making a plan without admitting it", "Seeking out triggers", "Keeping secrets",
        "Hopeless thinking", "Physical tension building", "Contact with a risky person",
        "Bought or prepared",
      ],
      preUseThoughtPresets: RELAPSE_THOUGHT_VALUES,
      couldHaveHelpedEarly: [
        "Text or call someone", "Go outside / change location", "Leave the trigger place",
        "Eat or sleep first", "Use a tool from the toolbox", "Be honest with someone",
        "Look at my plan", "Block access / money", "Make an appointment with a professional",
      ],
      couldHaveHelpedMiddle: [
        "Text or call someone", "Go outside / change location", "Leave the trigger place",
        "Eat or sleep first", "Use a tool from the toolbox", "Be honest with someone",
        "Look at my plan", "Block access / money", "Make an appointment with a professional",
      ],
      couldHaveHelpedLast: [
        "Text or call someone", "Go outside / change location", "Leave the trigger place",
        "Eat or sleep first", "Use a tool from the toolbox", "Be honest with someone",
        "Look at my plan", "Block access / money", "Make an appointment with a professional",
      ],
      repairActions: [
        "Drink water or eat something", "Rest and sleep", "Remove access or substances",
        "Tell someone safe", "Block / delete contact", "Leave the place",
        "Re-enter my routine", "Open the toolbox", "Make a next-24-hour plan",
        "Let myself rest without shame",
      ],
      acuteRisks: ACUTE_RISK_SELECTION_VALUES,
    },
  },
};

function isRecord(value: unknown): value is UnknownRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isFiniteTimestamp(value: unknown): value is number {
  return typeof value === "number"
    && Number.isFinite(value)
    && value >= 0
    && value <= 8_640_000_000_000_000;
}

function isRegistrationType(value: unknown): value is RegistrationType {
  return typeof value === "string" && Object.hasOwn(ROUTES, value);
}

function makeRecordId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `registration-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function cloneDefault(value: unknown): unknown {
  return Array.isArray(value) ? [...value] : value;
}

const NULLABLE_BOOLEAN_FIELDS = new Set(["actionAttempted", "urgencyHigh"]);
const ZERO_TO_TEN_FIELDS = new Set([
  "intensity",
  "confidenceBefore",
  "intensityAfter",
  "confidenceAfter",
  "emotionAfter",
]);
const NULLABLE_NON_NEGATIVE_NUMBER_FIELDS = new Set([
  "delayTimerStartedAt",
  "delayDuration",
]);

function isZeroToTen(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 10;
}

function matchesDefaultType(
  key: string,
  value: unknown,
  defaultValue: unknown,
): boolean {
  if (Array.isArray(defaultValue)) {
    return Array.isArray(value) && value.every((item) => typeof item === "string");
  }
  if (defaultValue === null) {
    if (value === null) return true;
    return NULLABLE_BOOLEAN_FIELDS.has(key)
      ? typeof value === "boolean"
      : NULLABLE_NON_NEGATIVE_NUMBER_FIELDS.has(key)
        ? isFiniteTimestamp(value)
      : ZERO_TO_TEN_FIELDS.has(key) && isZeroToTen(value);
  }
  if (typeof defaultValue === "number") {
    return ZERO_TO_TEN_FIELDS.has(key) && isZeroToTen(value);
  }
  return typeof value === typeof defaultValue;
}

function migrateLegacyDraftValues(type: RegistrationType, draft: UnknownRecord): void {
  if (type === "craving" && draft.chosenAction === "used") {
    // The original action list mixed the behavioral outcome into the action
    // question. Move it into the dedicated outcome field introduced later.
    draft.chosenAction = "";
    if (draft.useOutcome === "") draft.useOutcome = "used";
  }
  if (type === "boredom" && draft.convertCheck === "No — this is restlessness") {
    // Same meaning, rewritten when the question changed from exclusion to
    // positive identification.
    draft.convertCheck = "Yes — this feels like restlessness";
  }
}

const ACTIVE_TREK_NEED_BY_STABLE_ID: Readonly<Record<string, string>> = {
  stimulation: "Stimulation",
  escape: "Escape",
};

const ACTIVE_TREK_TRIGGER_BY_STABLE_ID: Readonly<Record<string, string>> = {
  "social-pressure": "Social pressure",
};

function appendMissingStrings(source: string[], additions: string[]): string[] {
  const result = [...source];
  for (const value of additions) {
    if (!result.includes(value)) result.push(value);
  }
  return result;
}

function hasRetiredTrekDraftValues(type: RegistrationType, value: unknown): boolean {
  if (type !== "trek" || !isRecord(value)) return false;
  const trekTypes = value.trekTypes;
  return (
    Array.isArray(trekTypes)
    && trekTypes.some((item) =>
      typeof item === "string" && Object.hasOwn(RETIRED_TREK_AXIS_MIGRATIONS, item))
  ) || (
    typeof value.planningStage === "string"
    && Object.hasOwn(RETIRED_TREK_IMMEDIACY_MIGRATIONS, value.planningStage)
  );
}

function hasRelapseDraftNormalization(
  type: RegistrationType,
  value: unknown,
  singularNoneIsDeliberate: boolean,
): boolean {
  if (type !== "relapse" || !isRecord(value)) return false;
  const hasCanonical = Array.isArray(value.acuteRisks);
  const acuteRisks = normalizeAcuteRisks(
    hasCanonical ? value.acuteRisks : undefined,
    value.acuteRisk,
    singularNoneIsDeliberate,
  );
  const expectedAlias = acuteRiskCompatibilityAlias(acuteRisks);
  const expectedWhen = typeof value.occurrenceDateTime === "string"
    ? relapseWhenForOccurrence(value.occurrenceDateTime)
    : "";
  return !hasCanonical
    || value.acuteRisk !== expectedAlias
    || value.when !== expectedWhen;
}

/**
 * Normalize both v1 and already-versioned v2 drafts from the retired Trek list.
 * Values that encoded a motive or context move to their dedicated fields, so the
 * approach-form axis stays clean without dropping what the person selected.
 */
function migrateRetiredTrekDraftValues(type: RegistrationType, draft: UnknownRecord): void {
  if (type !== "trek") return;

  const sourceTypes = draft.trekTypes as string[];
  const forms: string[] = [];
  const inferredNeeds: string[] = [];
  const inferredTriggers: string[] = [];
  let retiredTypeFound = false;

  // Duplicate input is corruption, not migration material. Leave it untouched so
  // catalog validation rejects it instead of silently sanitizing it.
  if (new Set(sourceTypes).size === sourceTypes.length) {
    for (const value of sourceTypes) {
      const replacement = RETIRED_TREK_AXIS_MIGRATIONS[value];
      if (!replacement) {
        forms.push(value);
        continue;
      }
      retiredTypeFound = true;
      if (replacement.form) forms.push(replacement.form);
      if (replacement.need) {
        inferredNeeds.push(ACTIVE_TREK_NEED_BY_STABLE_ID[replacement.need] ?? replacement.need);
      }
      if (replacement.trigger) {
        inferredTriggers.push(
          ACTIVE_TREK_TRIGGER_BY_STABLE_ID[replacement.trigger] ?? replacement.trigger,
        );
      }
    }
  }

  if (retiredTypeFound) {
    // Motive-only retired values prove a need, not the new observable-form
    // answer. An empty form list deliberately sends the resumed draft back to
    // the required type step below.
    draft.trekTypes = forms;

    if (inferredNeeds.length > 0) {
      const sourceNeeds = (draft.needTypes as string[])
        .filter((value) => value !== "Not sure");
      draft.needTypes = appendMissingStrings(sourceNeeds, inferredNeeds);
    }

    if (inferredTriggers.length > 0) {
      const sourceTriggers = (draft.triggers as string[])
        .filter((value) => value !== "No clear trigger / not sure");
      draft.triggers = appendMissingStrings(sourceTriggers, inferredTriggers);
    }
  }

  const planningStage = draft.planningStage as string;
  const nextPlanningStage = RETIRED_TREK_IMMEDIACY_MIGRATIONS[planningStage];
  if (nextPlanningStage) draft.planningStage = nextPlanningStage;
}

/**
 * Clear answers whose controlling choice no longer exposes them. These are
 * deterministic visibility rules, not guesses: retaining the hidden value
 * would make the resumed draft disagree with the tracker payload.
 */
function normalizeDependentDraftValues(type: RegistrationType, draft: UnknownRecord): void {
  if (type === "craving") {
    if (draft.onsetType !== "Other") draft.onsetOther = "";
    if (!(draft.situationPresets as string[]).includes("Other")) draft.triggerOther = "";
    return;
  }

  if (type === "trek") {
    if (draft.location !== "Other") draft.locationOther = "";
    if (!(draft.triggers as string[]).includes("Other")) draft.triggerNote = "";
    if (!(draft.needTypes as string[]).includes("Other")) draft.needOther = "";
    if (draft.actionAttempted !== true) draft.confidenceAfter = null;
    return;
  }

  if (type === "boredom") {
    if (draft.situation !== "Other") draft.situationOther = "";
    if (draft.urge !== "Other stimulation") draft.urgeOther = "";

    const convertedToAnotherTracker = draft.convertCheck === "Maybe a craving"
      || draft.convertCheck === "Maybe anxiety";
    if (convertedToAnotherTracker) {
      draft.rescueMenu = [];
      draft.action = "";
      draft.showNote = false;
      draft.note = "";
    }
  }
}

function matchesDraftCatalog(type: RegistrationType, draft: UnknownRecord): boolean {
  const catalog = DRAFT_CATALOGS[type];

  for (const [field, allowed] of Object.entries(catalog.scalars)) {
    const value = draft[field];
    if (typeof value !== "string" || !allowed.includes(value)) return false;
  }

  for (const [field, allowed] of Object.entries(catalog.arrays)) {
    const value = draft[field];
    if (!Array.isArray(value) || !value.every((item) => allowed.includes(item))) return false;
    if (new Set(value).size !== value.length) return false;
    const limit = catalog.arrayLimits?.[field];
    if (limit !== undefined && value.length > limit) return false;
  }

  if (type === "craving") {
    const situations = draft.situationPresets as string[];
    if (situations.length > 1 && situations.includes("No clear situation / not sure")) {
      return false;
    }
  }

  if (type === "anxiety") {
    const bodyLocations = draft.bodyLocations as string[];
    if (
      bodyLocations.length > 1 &&
      (
        bodyLocations.includes("Not in one place / not sure")
        || bodyLocations.includes("Whole body")
      )
    ) return false;

    const linkedStates = draft.linkedStates as string[];
    if (
      linkedStates.includes("Not connected to anything specific") &&
      linkedStates.length !== 1
    ) {
      return false;
    }
  }

  if (type === "boredom") {
    const stimulationNeeds = draft.stimulationNeeds as string[];
    if (stimulationNeeds.length > 1 && stimulationNeeds.includes("not-sure")) return false;
  }

  if (type === "trek") {
    const trekTypes = draft.trekTypes as string[];
    if (trekTypes.length > 1 && trekTypes.includes("approach-not-sure")) {
      return false;
    }

    const triggers = draft.triggers as string[];
    if (triggers.length > 1 && triggers.includes("No clear trigger / not sure")) {
      return false;
    }

    const needTypes = draft.needTypes as string[];
    if (needTypes.length > 1 && needTypes.includes("Not sure")) return false;
  }

  if (type === "relapse") {
    const acuteRisks = draft.acuteRisks as string[];
    if (acuteRisks.length > 1 && acuteRisks.includes("none")) return false;

    // Current controls make each canned/custom pair mutually exclusive. A
    // restored pair cannot be migrated without silently discarding one of the
    // person's answers, so reject the draft and surface the invalid session.
    if (
      ((draft.firstTriggerType as string) !== "" && (draft.firstTriggerText as string).trim() !== "")
      || ((draft.supportContact as string) !== "" && (draft.supportContactOther as string).trim() !== "")
      || ((draft.nextStep as string) !== "" && (draft.nextStepOther as string).trim() !== "")
    ) return false;

    const hasTarget = (draft.substances as string[]).length > 0;
    if ((draft.primarySubstance as string) !== "") return false;
    if (!hasTarget && draft.amountCategory !== "unanswered") return false;
  }

  return true;
}

function normalizeDraft(
  type: RegistrationType,
  value: unknown,
  sourceVersion: 1 | 2 | typeof ACTIVE_REGISTRATION_VERSION,
): UnknownRecord | null {
  if (!isRecord(value)) return null;
  const allowLegacyMissingFields = sourceVersion === 1;
  const defaults = DRAFT_DEFAULTS[type];
  const result: UnknownRecord = {};

  for (const [key, defaultValue] of Object.entries(defaults)) {
    const candidate = value[key];
    const canonicalRelapseSafetyAlias = type === "relapse"
      && key === "acuteRisk"
      && Array.isArray(value.acuteRisks);
    if (candidate === undefined) {
      // `acuteRisks` was added to the existing v2 Relapse draft. Accept a v2
      // session that predates the field and derive it from its singular answer.
      const canMigrateRelapseSafety = sourceVersion === 2
        && type === "relapse"
        && key === "acuteRisks";
      const canMigrateBoredomDelay = sourceVersion === 2
        && type === "boredom"
        && (key === "delayTimerStartedAt" || key === "delayDuration");
      if (
        !allowLegacyMissingFields
        && !canMigrateRelapseSafety
        && !canMigrateBoredomDelay
        && !canonicalRelapseSafetyAlias
      ) return null;
      result[key] = cloneDefault(defaultValue);
      continue;
    }
    // Once the canonical array exists, a compatibility alias is derived below
    // and must never invalidate or override the canonical answer.
    if (canonicalRelapseSafetyAlias) {
      result[key] = cloneDefault(defaultValue);
      continue;
    }
    if (!matchesDefaultType(key, candidate, defaultValue)) return null;
    result[key] = cloneDefault(candidate);
  }

  if (allowLegacyMissingFields) migrateLegacyDraftValues(type, result);
  migrateRetiredTrekDraftValues(type, result);
  normalizeDependentDraftValues(type, result);
  if (type === "boredom") {
    result.convertCheck = normalizeActiveBoredomClassification(result.convertCheck as string);
  }
  if (type === "relapse") {
    result.firstTriggerType = relapseFirstTriggerIdForRead(
      result.firstTriggerType as string,
      sourceVersion,
    ) ?? "";
    const legacyPrimary = result.primarySubstance as string;
    if (sourceVersion < 3 && legacyPrimary !== "") {
      result.substances = appendMissingStrings(result.substances as string[], [legacyPrimary]);
      result.primarySubstance = "";
    } else if (sourceVersion >= 3 && legacyPrimary !== "") {
      // v3 has only the visible plural target control. A hidden scalar cannot
      // be reconciled without overriding the canonical draft.
      return null;
    }
    const legacyThought = result.preUseThoughtPreset as string;
    if (sourceVersion < 3 && legacyThought !== "") {
      result.preUseThoughtPresets = appendMissingStrings(
        result.preUseThoughtPresets as string[],
        [legacyThought],
      );
      result.preUseThoughtPreset = "";
    } else if (sourceVersion >= 3 && legacyThought !== "") {
      return null;
    }
    const hadCanonicalArray = Array.isArray(value.acuteRisks);
    if (hadCanonicalArray && !isValidAcuteRiskSelectionArray(value.acuteRisks)) {
      return null;
    }
    // A pre-array v2 draft may only be migrated from a recognized singular
    // value. Reject unknown legacy data instead of silently converting it to
    // an unanswered safety question. Once the canonical array exists it is
    // authoritative and the compatibility alias is regenerated below.
    if (
      !hadCanonicalArray
      && value.acuteRisk !== undefined
      && !isAcuteRisk(value.acuteRisk)
    ) {
      return null;
    }
    const acuteRisks = normalizeAcuteRisks(
      hadCanonicalArray ? result.acuteRisks : undefined,
      result.acuteRisk,
      sourceVersion >= 2,
    );
    result.acuteRisks = acuteRisks;
    result.acuteRisk = acuteRiskCompatibilityAlias(acuteRisks);
    // v1 and deployed v2 prefilled no-label and just-now/exact time. Those
    // defaults do not prove an interaction. Clear only the unprovable defaults;
    // a non-default label/bucket is evidence that the person changed it.
    if (sourceVersion < 3 && result.label === "no-label") result.label = "";
    if (sourceVersion < 3 && result.when === "just-now") {
      result.when = "";
      result.occurrenceDateTime = "";
    }

    // For current semantics, or a migrated non-default historical selection,
    // exact occurrence is authoritative and the broad bucket is regenerated.
    if (!(DRAFT_CATALOGS.relapse.scalars.when as readonly unknown[]).includes(result.when)) {
      return null;
    }
    result.when = relapseWhenForOccurrence(result.occurrenceDateTime as string);
  }
  return matchesDraftCatalog(type, result) ? result : null;
}

function parseJson(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  if (raw === "") return null;
  return JSON.parse(raw);
}

/**
 * Validate a persisted session and migrate v1/v2 shapes to v3. Invalid
 * sessions are rejected instead of being cast into tracker state.
 */
export function parseActiveRegistration(
  raw: unknown,
): ActiveRegistrationParseResult {
  let data: unknown;
  try {
    data = parseJson(raw);
  } catch {
    return {
      ok: false,
      value: null,
      migrated: false,
      error: "Active registration is not valid JSON.",
    };
  }

  if (data === null || data === "") {
    return { ok: true, value: null, migrated: false };
  }
  if (!isRecord(data)) {
    return {
      ok: false,
      value: null,
      migrated: false,
      error: "Active registration must be an object.",
    };
  }

  const sourceVersion = data.version;
  if (
    sourceVersion !== 1
    && sourceVersion !== 2
    && sourceVersion !== ACTIVE_REGISTRATION_VERSION
  ) {
    return {
      ok: false,
      value: null,
      migrated: false,
      error: "Unsupported active-registration version.",
    };
  }
  if (!isRegistrationType(data.type)) {
    return {
      ok: false,
      value: null,
      migrated: false,
      error: "Unknown active-registration type.",
    };
  }

  const type = data.type;
  if (data.route !== ROUTES[type]) {
    return {
      ok: false,
      value: null,
      migrated: false,
      error: "Active-registration route does not match its type.",
    };
  }
  if (typeof data.step !== "string" || !STEPS[type].includes(data.step)) {
    return {
      ok: false,
      value: null,
      migrated: false,
      error: "Active-registration step is invalid for its type.",
    };
  }

  const trekTaxonomyMigrated = hasRetiredTrekDraftValues(type, data.draft);
  const boredomClassificationMigrated = type === "boredom"
    && isRecord(data.draft)
    && activeBoredomClassificationNeedsMigration(data.draft.convertCheck);
  const relapseDraftMigrated = hasRelapseDraftNormalization(
    type,
    data.draft,
    sourceVersion >= 2,
  );
  const draft = normalizeDraft(type, data.draft, sourceVersion);
  if (!draft) {
    return {
      ok: false,
      value: null,
      migrated: false,
      error: "Active-registration draft has an invalid shape.",
    };
  }
  // v1 preselected these safety-sensitive answers. Their stored value cannot
  // prove the user made a choice, so migration deliberately asks again. v2's
  // affirmative/none safety choices remain explicit because its blank sentinel
  // was `unanswered`.
  if (sourceVersion === 1 && type === "anxiety" && draft.urgencyHigh === false) {
    draft.urgencyHigh = null;
  }
  if (
    sourceVersion !== 1 &&
    (typeof data.recordId !== "string" || data.recordId.trim() === "")
  ) {
    return {
      ok: false,
      value: null,
      migrated: false,
      error: "Active-registration record ID is invalid.",
    };
  }
  if (sourceVersion !== 1 && !isFiniteTimestamp(data.startedAt)) {
    return {
      ok: false,
      value: null,
      migrated: false,
      error: "Active-registration start time is invalid.",
    };
  }
  if (sourceVersion !== 1 && !isFiniteTimestamp(data.updatedAt)) {
    return {
      ok: false,
      value: null,
      migrated: false,
      error: "Active-registration update time is invalid.",
    };
  }
  if (
    data.savedLogId !== undefined &&
    (typeof data.savedLogId !== "string" || data.savedLogId.trim() === "")
  ) {
    return {
      ok: false,
      value: null,
      migrated: false,
      error: "Active-registration saved-log ID is invalid.",
    };
  }
  if (
    data.quickRegistrationId !== undefined
    && (
      typeof data.quickRegistrationId !== "string"
      || data.quickRegistrationId.trim() === ""
      || data.quickRegistrationId.length > 200
    )
  ) {
    return {
      ok: false,
      value: null,
      migrated: false,
      error: "Active-registration quick-registration ID is invalid.",
    };
  }
  if (
    data.quickRegistrationTimestamp !== undefined
    && (
      data.quickRegistrationId === undefined
      || !isFiniteTimestamp(data.quickRegistrationTimestamp)
    )
  ) {
    return {
      ok: false,
      value: null,
      migrated: false,
      error: "Active-registration quick-registration time is invalid.",
    };
  }

  const now = Date.now();
  const startedAt = isFiniteTimestamp(data.startedAt)
    ? data.startedAt
    : sourceVersion === 1 && isFiniteTimestamp(data.updatedAt)
      ? data.updatedAt
      : now;
  const updatedAt = isFiniteTimestamp(data.updatedAt)
    ? data.updatedAt
    : startedAt;
  const savedLogId =
    typeof data.savedLogId === "string" && data.savedLogId.trim() !== ""
      ? data.savedLogId
      : undefined;
  const quickRegistrationId =
    typeof data.quickRegistrationId === "string" && data.quickRegistrationId.trim() !== ""
      ? data.quickRegistrationId
      : undefined;
  const quickRegistrationTimestamp =
    quickRegistrationId && isFiniteTimestamp(data.quickRegistrationTimestamp)
      ? data.quickRegistrationTimestamp
      : undefined;
  const recordId =
    typeof data.recordId === "string" && data.recordId.trim() !== ""
      ? data.recordId
      : savedLogId ?? makeRecordId();

  let pendingReturn: PendingReturn | undefined;
  if (data.pendingReturn !== undefined) {
    if (
      !isRecord(data.pendingReturn) ||
      data.pendingReturn.returnRoute !== ROUTES[type] ||
      typeof data.pendingReturn.returnStep !== "string" ||
      !STEPS[type].includes(data.pendingReturn.returnStep)
    ) {
      return {
        ok: false,
        value: null,
        migrated: false,
        error: "Active-registration return target is invalid.",
      };
    }
    pendingReturn = {
      returnRoute: data.pendingReturn.returnRoute,
      returnStep: data.pendingReturn.returnStep,
    };
  }

  const migratedStep = type === "trek"
    && trekTaxonomyMigrated
    && (draft.trekTypes as string[]).length === 0
      ? "type"
      : data.step;
  const stepWasReset = migratedStep !== data.step;
  const expectedStepCount = STEPS[type].length - 1;
  const currentIndex = STEPS[type].indexOf(migratedStep);
  const derivedStepIndex =
    migratedStep === "done" ? expectedStepCount : currentIndex + 1;
  const stepCount =
    Number.isInteger(data.stepCount) && Number(data.stepCount) > 0
      ? Number(data.stepCount)
      : expectedStepCount;
  const stepIndex =
    !stepWasReset &&
    Number.isInteger(data.stepIndex) &&
    Number(data.stepIndex) > 0 &&
    Number(data.stepIndex) <= stepCount
      ? Number(data.stepIndex)
      : derivedStepIndex;

  return {
    ok: true,
    migrated: sourceVersion !== ACTIVE_REGISTRATION_VERSION
      || trekTaxonomyMigrated
      || boredomClassificationMigrated
      || relapseDraftMigrated
      || data.recordId !== recordId
      || (type === "relapse"
        && isRecord(data.draft)
        && !Object.prototype.hasOwnProperty.call(data.draft, "acuteRisks"))
      || (type === "boredom"
        && isRecord(data.draft)
        && (
          !Object.prototype.hasOwnProperty.call(data.draft, "delayTimerStartedAt")
          || !Object.prototype.hasOwnProperty.call(data.draft, "delayDuration")
        )),
    value: {
      version: ACTIVE_REGISTRATION_VERSION,
      type,
      route: ROUTES[type],
      step: migratedStep,
      draft,
      recordId,
      startedAt,
      updatedAt: Math.max(startedAt, updatedAt),
      savedLogId,
      quickRegistrationId,
      quickRegistrationTimestamp,
      pendingReturn,
      stepIndex,
      stepCount,
    },
  };
}

export function registrationSteps(type: RegistrationType): readonly string[] {
  return STEPS[type];
}
