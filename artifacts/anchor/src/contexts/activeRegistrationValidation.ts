export const ACTIVE_REGISTRATION_VERSION = 2 as const;

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
  },
  relapse: {
    label: "no-label",
    when: "just-now",
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
        "Someone using nearby", "Saw or smelled a trigger", "Other",
      ],
      physicalSensations: PHYSICAL_VALUES,
      emotions: EMOTION_VALUES,
      thoughtPresets: THOUGHT_VALUES,
      substances: SUBSTANCE_VALUES,
    },
  },
  trek: {
    scalars: {
      planningStage: optionalValues([
        "Just thinking about it", "Getting money or resources", "On my way there",
        "About to act",
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
        "Planning or thinking about it", "Actively seeking it", "Ritual / habit",
        "Boredom-driven", "Emotional escape", "Social pressure",
      ],
      triggers: [
        "Boredom", "Stress", "Habit / routine", "Social pressure", "Money available",
        "Feeling good / celebratory", "Conflict", "Other",
      ],
      emotions: EMOTION_VALUES,
      physicalSensations: PHYSICAL_VALUES,
      thoughtPresets: THOUGHT_VALUES,
      needTypes: [
        "Relief", "Excitement", "Reward", "Numbness", "Comfort", "Connection",
        "Stimulation", "Escape", "Other",
      ],
      substances: SUBSTANCE_VALUES,
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
      ]),
      outcome: optionalValues(OUTCOME_VALUES),
    },
    arrays: {
      anxietyTypes: [
        "Panic spike", "Health anxiety", "Dread", "Racing thoughts", "Social anxiety",
        "Generalized worry", "Shame / fear after use", "Future fear", "Body anxiety",
      ],
      bodyLocations: ["Chest", "Stomach", "Throat", "Head", "Arms", "Legs", "Whole body"],
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
  },
  boredom: {
    scalars: {
      convertCheck: optionalValues([
        "Yes — this feels like restlessness", "Maybe a craving", "Maybe anxiety",
        "Maybe loneliness", "Maybe exhaustion", "Not sure",
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
        "Escaped immediately",
      ]),
    },
    arrays: {
      restlessnessTypes: [
        "Bored", "Understimulated", "Physically agitated", "Mentally noisy",
        "Can't sit still", "Empty", "Irritated", "Craving stimulation",
        "Lonely and restless", "Tired but wired",
      ],
      stimulationNeeds: ["calming", "movement", "sensory-reset", "hands", "mental", "social"],
      rescueMenu: BOREDOM_RESCUE_VALUES,
    },
  },
  relapse: {
    scalars: {
      // `setback` and `return-to-use` are retained schema values from earlier
      // releases even though the current selector presents three labels.
      label: ["lapse", "setback", "return-to-use", "relapse", "no-label"],
      when: ["just-now", "today", "yesterday", "few-days"],
      episodeDuration: [
        "unanswered", "single-moment", "few-hours", "whole-day", "multiple-days",
      ],
      primarySubstance: optionalValues(SUBSTANCE_VALUES),
      amountCategory: [
        "unanswered", "small", "moderate", "a-lot", "multiple-times", "binge",
        "prefer-not",
      ],
      firstTriggerType: optionalValues([
        "Internal emotion", "External event", "Specific thought", "Physical discomfort",
        "Social pressure", "Craving out of nowhere", "Memory / flashback",
        "Seeing or smelling a cue",
      ]),
      preUseThoughtPreset: optionalValues(RELAPSE_THOUGHT_VALUES),
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
    },
  },
};

function isRecord(value: unknown): value is UnknownRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isFiniteTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
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
  }

  if (type === "anxiety") {
    const linkedStates = draft.linkedStates as string[];
    if (
      linkedStates.includes("Not connected to anything specific") &&
      linkedStates.length !== 1
    ) {
      return false;
    }
  }

  return true;
}

function normalizeDraft(
  type: RegistrationType,
  value: unknown,
  allowLegacyMissingFields: boolean,
): UnknownRecord | null {
  if (!isRecord(value)) return null;
  const defaults = DRAFT_DEFAULTS[type];
  const result: UnknownRecord = {};

  for (const [key, defaultValue] of Object.entries(defaults)) {
    const candidate = value[key];
    if (candidate === undefined) {
      if (!allowLegacyMissingFields) return null;
      result[key] = cloneDefault(defaultValue);
      continue;
    }
    if (!matchesDefaultType(key, candidate, defaultValue)) return null;
    result[key] = cloneDefault(candidate);
  }

  if (allowLegacyMissingFields) migrateLegacyDraftValues(type, result);
  return matchesDraftCatalog(type, result) ? result : null;
}

function parseJson(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  if (raw === "") return null;
  return JSON.parse(raw);
}

/**
 * Validate a persisted session and migrate the legacy v1 shape to v2. Invalid
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

  const legacy = data.version === 1;
  if (!legacy && data.version !== ACTIVE_REGISTRATION_VERSION) {
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

  const draft = normalizeDraft(type, data.draft, legacy);
  if (!draft) {
    return {
      ok: false,
      value: null,
      migrated: false,
      error: "Active-registration draft has an invalid shape.",
    };
  }
  // v1 preselected these safety-sensitive answers. Their stored value cannot
  // prove the user made a choice, so migration deliberately asks again. v2
  // values are never rewritten and therefore preserve an explicit "no".
  if (legacy && type === "anxiety" && draft.urgencyHigh === false) {
    draft.urgencyHigh = null;
  }
  if (legacy && type === "relapse" && draft.acuteRisk === "none") {
    draft.acuteRisk = "unanswered";
  }

  if (
    !legacy &&
    (typeof data.recordId !== "string" || data.recordId.trim() === "")
  ) {
    return {
      ok: false,
      value: null,
      migrated: false,
      error: "Active-registration record ID is invalid.",
    };
  }
  if (!legacy && !isFiniteTimestamp(data.startedAt)) {
    return {
      ok: false,
      value: null,
      migrated: false,
      error: "Active-registration start time is invalid.",
    };
  }
  if (!legacy && !isFiniteTimestamp(data.updatedAt)) {
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

  const now = Date.now();
  const startedAt = isFiniteTimestamp(data.startedAt)
    ? data.startedAt
    : legacy && isFiniteTimestamp(data.updatedAt)
      ? data.updatedAt
      : now;
  const updatedAt = isFiniteTimestamp(data.updatedAt)
    ? data.updatedAt
    : startedAt;
  const savedLogId =
    typeof data.savedLogId === "string" && data.savedLogId.trim() !== ""
      ? data.savedLogId
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

  const expectedStepCount = STEPS[type].length - 1;
  const currentIndex = STEPS[type].indexOf(data.step);
  const derivedStepIndex =
    data.step === "done" ? expectedStepCount : currentIndex + 1;
  const stepCount =
    Number.isInteger(data.stepCount) && Number(data.stepCount) > 0
      ? Number(data.stepCount)
      : expectedStepCount;
  const stepIndex =
    Number.isInteger(data.stepIndex) &&
    Number(data.stepIndex) > 0 &&
    Number(data.stepIndex) <= stepCount
      ? Number(data.stepIndex)
      : derivedStepIndex;

  return {
    ok: true,
    migrated: legacy || data.recordId !== recordId,
    value: {
      version: ACTIVE_REGISTRATION_VERSION,
      type,
      route: ROUTES[type],
      step: data.step,
      draft,
      recordId,
      startedAt,
      updatedAt: Math.max(startedAt, updatedAt),
      savedLogId,
      pendingReturn,
      stepIndex,
      stepCount,
    },
  };
}

export function registrationSteps(type: RegistrationType): readonly string[] {
  return STEPS[type];
}
