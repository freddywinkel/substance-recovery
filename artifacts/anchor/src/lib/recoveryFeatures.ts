import { isValidPreventionPlan, normalizePreventionPlan, type PreventionPlan } from "./preventionPlan";

export const REGISTRATION_TYPES = [
  "trek",
  "craving",
  "boredom",
  "anxiety",
  "relapse",
] as const;

export type RegistrationType = (typeof REGISTRATION_TYPES)[number];

export const TOOL_IDS = [
  "/tools/breathing",
  "/tools/grounding",
  "/tools/cold-water",
  "/tools/urge-surfing",
  "/tools/tape",
  "/tools/self-compassion",
  "/tools/distraction",
  "/delay",
] as const;

export type RecoveryToolId = (typeof TOOL_IDS)[number];

export const RECOVERY_TOOL_LABELS: Record<"en" | "nl", Record<RecoveryToolId, string>> = {
  en: {
    "/tools/breathing": "Box breathing",
    "/tools/grounding": "5-4-3-2-1 grounding",
    "/tools/cold-water": "Cold water reset",
    "/tools/urge-surfing": "Urge surfing",
    "/tools/tape": "Play the tape forward",
    "/tools/self-compassion": "Self-compassion reframe",
    "/tools/distraction": "Redirect attention",
    "/delay": "10-minute pause",
  },
  nl: {
    "/tools/breathing": "Box-ademhaling",
    "/tools/grounding": "5-4-3-2-1 aarding",
    "/tools/cold-water": "Koudwater-reset",
    "/tools/urge-surfing": "Gevoelsurfen",
    "/tools/tape": "Speel de band vooruit",
    "/tools/self-compassion": "Zelfcompassie-herkadering",
    "/tools/distraction": "Aandacht verleggen",
    "/delay": "10 minuten pauze",
  },
};

export function recoveryToolLabel(toolId: RecoveryToolId, language: "en" | "nl"): string {
  return RECOVERY_TOOL_LABELS[language][toolId];
}

export const HOME_WIDGET_IDS = [
  "sobriety",
  "quick-registration",
  "follow-ups",
  "cigarettes",
  "registration-activity",
  "supportive-progress",
  "top-insight",
  "daily-anchor",
  "pinned-contact",
  "pinned-tools",
] as const;

export type HomeWidgetId = (typeof HOME_WIDGET_IDS)[number];

export interface HomePreferences {
  version: 1;
  widgetOrder: HomeWidgetId[];
  hiddenWidgets: HomeWidgetId[];
  hiddenRegistrationTypes: RegistrationType[];
  pinnedContactId: string | null;
  pinnedToolIds: RecoveryToolId[];
}

export interface RecoveryPlan {
  version: 1;
  warningSigns: string[];
  reasonsForRecovery: string[];
  situationsToAvoid: string[];
  trustedContactIds: string[];
  callMessage: string;
  next24Hours: string[];
  updatedAt: number | null;
  prevention?: PreventionPlan;
}

export const DEFAULT_CALL_MESSAGES = {
  en: "Can you call me? I could use some support right now.",
  nl: "Kun je me bellen? Ik kan nu wat steun gebruiken.",
} as const;

export function localizedCallMessage(value: string, language: "en" | "nl"): string {
  return value === DEFAULT_CALL_MESSAGES.en || value === DEFAULT_CALL_MESSAGES.nl
    ? DEFAULT_CALL_MESSAGES[language]
    : value;
}

export const DEFAULT_HOME_PREFERENCES: HomePreferences = {
  version: 1,
  widgetOrder: [...HOME_WIDGET_IDS],
  hiddenWidgets: [],
  hiddenRegistrationTypes: [],
  pinnedContactId: null,
  pinnedToolIds: [],
};

export const DEFAULT_RECOVERY_PLAN: RecoveryPlan = {
  version: 1,
  warningSigns: [],
  reasonsForRecovery: [],
  situationsToAvoid: [],
  trustedContactIds: [],
  callMessage: DEFAULT_CALL_MESSAGES.en,
  next24Hours: [],
  updatedAt: null,
};

export type QuickSafety = "safe-for-now" | "need-support" | "urgent-danger";
export type QuickReflectionStatus = "pending" | "started" | "completed" | "dismissed";
export const QUICK_REFLECTION_HANDOFF_KEY = "anchor-quick-reflection-handoff";

export interface QuickRegistrationRecord {
  id: string;
  recordType: "quick-registration";
  timestamp: number;
  updatedAt: number;
  registrationType: RegistrationType;
  intensity: number | null;
  occurredAt?: number;
  createdAt?: number;
  editedAt?: number;
  target?: string;
  useOutcome?: "used" | "not_used" | "unsure";
  usePrescribed?: boolean;
  immediateSafety: QuickSafety;
  chosenAction: string;
  chosenActionOther: string;
  note: string;
  reflectionStatus: QuickReflectionStatus;
  reflectionDueAt: number;
  reflectionStartedAt: number | null;
  reflectionCompletedAt: number | null;
  linkedDetailedRecordId: string | null;
}

export type RecoveryActionType = "contact" | "care" | "tool" | "goal";

export interface RecoveryActionRecord {
  id: string;
  recordType: "recovery-action";
  timestamp: number;
  updatedAt: number;
  actionType: RecoveryActionType;
  label: string;
  note: string;
  sourceId: string | null;
}

export type FollowUpStatus = "pending" | "completed" | "dismissed";

export interface ToolFollowUpRecord {
  id: string;
  recordType: "tool-follow-up";
  timestamp: number;
  updatedAt: number;
  dueAt: number;
  toolId: RecoveryToolId;
  toolLabel: string;
  feelingBefore: number | null;
  feelingAfter: number | null;
  attempted: boolean | null;
  status: FollowUpStatus;
  completedAt: number | null;
}

export interface WeeklyReviewRecord {
  id: string;
  recordType: "weekly-review";
  timestamp: number;
  updatedAt: number;
  periodStart: number;
  periodEnd: number;
  chosenPattern: string;
  nextWeekPlan: string;
  patternKind?: "registration-type" | "time-of-day" | "high-intensity";
  patternValue?: string;
  patternCount?: number;
  patternDenominator?: number;
  planRevisionAt?: number | null;
  linkedGoalId?: string | null;
  reviewedEntryIds?: string[];
}

export type FeatureRecord =
  | QuickRegistrationRecord
  | RecoveryActionRecord
  | ToolFollowUpRecord
  | WeeklyReviewRecord;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const isString = (value: unknown, max = 4000): value is string =>
  typeof value === "string" && value.length <= max;

// JavaScript Date throws outside this range. Backups are untrusted input, so
// accepting a merely finite number is not sufficient for safe rendering.
export const MAX_SUPPORTED_TIMESTAMP = 8_640_000_000_000_000;

const isFiniteTimestamp = (value: unknown): value is number =>
  typeof value === "number"
  && Number.isFinite(value)
  && value >= 0
  && value <= MAX_SUPPORTED_TIMESTAMP;

const isNullableTimestamp = (value: unknown): value is number | null =>
  value === null || isFiniteTimestamp(value);

const isScore = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 10;

const isNullableScore = (value: unknown): value is number | null => value === null || isScore(value);

const isStringArray = (value: unknown, maxItems = 6000): value is string[] =>
  Array.isArray(value)
  && value.length <= maxItems
  && value.every((item) => typeof item === "string" && item.length <= 12000)
  && value.reduce((total, item) => total + item.length, 0) <= 12000;

const isIdArray = (value: unknown, maxItems = 8): value is string[] =>
  Array.isArray(value)
  && value.length <= maxItems
  && new Set(value).size === value.length
  && value.every((item) => typeof item === "string" && item.trim() !== "" && item.length <= 200);

const uniqueKnown = <T extends string>(value: unknown, known: readonly T[], max = known.length): T[] => {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is T => typeof item === "string" && known.includes(item as T)))].slice(0, max);
};

export function parseHomePreferences(value: unknown): HomePreferences {
  if (!isRecord(value)) return { ...DEFAULT_HOME_PREFERENCES, widgetOrder: [...HOME_WIDGET_IDS] };
  const preferredOrder = uniqueKnown(value.widgetOrder, HOME_WIDGET_IDS);
  const widgetOrder = [
    ...preferredOrder,
    ...HOME_WIDGET_IDS.filter((id) => !preferredOrder.includes(id)),
  ];
  return {
    version: 1,
    widgetOrder,
    hiddenWidgets: uniqueKnown(value.hiddenWidgets, HOME_WIDGET_IDS).filter((id) => id !== "follow-ups"),
    hiddenRegistrationTypes: uniqueKnown(value.hiddenRegistrationTypes, REGISTRATION_TYPES, REGISTRATION_TYPES.length - 1),
    pinnedContactId: typeof value.pinnedContactId === "string" && value.pinnedContactId.length <= 200
      ? value.pinnedContactId
      : null,
    pinnedToolIds: uniqueKnown(value.pinnedToolIds, TOOL_IDS, 2),
  };
}

export function parseRecoveryPlan(value: unknown): RecoveryPlan {
  if (!isRecord(value)) return { ...DEFAULT_RECOVERY_PLAN };
  if (value.version !== undefined && value.version !== 1) throw new Error("Unsupported recovery plan version.");
  return {
    version: 1,
    warningSigns: isStringArray(value.warningSigns) ? value.warningSigns : [],
    reasonsForRecovery: isStringArray(value.reasonsForRecovery) ? value.reasonsForRecovery : [],
    situationsToAvoid: isStringArray(value.situationsToAvoid) ? value.situationsToAvoid : [],
    trustedContactIds: isIdArray(value.trustedContactIds, 50) ? value.trustedContactIds : [],
    callMessage: isString(value.callMessage, 1000) ? value.callMessage : DEFAULT_RECOVERY_PLAN.callMessage,
    next24Hours: isStringArray(value.next24Hours) ? value.next24Hours : [],
    updatedAt: isNullableTimestamp(value.updatedAt) ? value.updatedAt : null,
    ...(value.prevention !== undefined ? { prevention: normalizePreventionPlan(value.prevention) } : {}),
  };
}

export function isValidHomePreferences(value: unknown): value is HomePreferences {
  if (!isRecord(value) || value.version !== 1) return false;
  if (!Array.isArray(value.widgetOrder) || value.widgetOrder.length !== HOME_WIDGET_IDS.length) return false;
  if (!Array.isArray(value.hiddenWidgets) || !Array.isArray(value.hiddenRegistrationTypes) || !Array.isArray(value.pinnedToolIds)) return false;
  const normalized = parseHomePreferences(value);
  return (
    JSON.stringify(normalized.widgetOrder) === JSON.stringify(value.widgetOrder)
    && JSON.stringify(normalized.hiddenWidgets) === JSON.stringify(value.hiddenWidgets)
    && JSON.stringify(normalized.hiddenRegistrationTypes) === JSON.stringify(value.hiddenRegistrationTypes)
    && JSON.stringify(normalized.pinnedToolIds) === JSON.stringify(value.pinnedToolIds)
    && normalized.pinnedContactId === value.pinnedContactId
  );
}

export function isValidRecoveryPlan(value: unknown): value is RecoveryPlan {
  if (!isRecord(value) || value.version !== 1) return false;
  if (value.prevention !== undefined && !isValidPreventionPlan(value.prevention)) return false;
  const normalized = parseRecoveryPlan(value);
  return (
    JSON.stringify(normalized.warningSigns) === JSON.stringify(value.warningSigns)
    && JSON.stringify(normalized.reasonsForRecovery) === JSON.stringify(value.reasonsForRecovery)
    && JSON.stringify(normalized.situationsToAvoid) === JSON.stringify(value.situationsToAvoid)
    && (value.trustedContactIds === undefined
      || JSON.stringify(normalized.trustedContactIds) === JSON.stringify(value.trustedContactIds))
    && normalized.callMessage === value.callMessage
    && JSON.stringify(normalized.next24Hours) === JSON.stringify(value.next24Hours)
    && normalized.updatedAt === value.updatedAt
  );
}

/** Missing settings may initialize a plan; unreadable existing settings never do. */
export function parseStoredRecoveryPlan(raw: unknown): RecoveryPlan {
  if (raw === undefined || raw === "") return { ...DEFAULT_RECOVERY_PLAN };
  const unsupported = () => new Error("The saved recovery plan cannot be read safely. Your existing data has not been changed.");
  if (typeof raw !== "string") throw unsupported();
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw unsupported(); }
  const fields = ["version", "warningSigns", "reasonsForRecovery", "situationsToAvoid", "trustedContactIds", "callMessage", "next24Hours", "updatedAt", "prevention"];
  if (!isRecord(parsed) || !Object.keys(parsed).every(key => fields.includes(key)) || !isValidRecoveryPlan(parsed)) throw unsupported();
  return parseRecoveryPlan(parsed);
}

export function parseFeatureRecord(value: unknown): FeatureRecord | null {
  if (!isRecord(value)) return null;
  if (!isString(value.id, 200) || value.id.trim() === "") return null;
  if (!isFiniteTimestamp(value.timestamp) || !isFiniteTimestamp(value.updatedAt)) return null;

  if (value.recordType === "quick-registration") {
    if (!REGISTRATION_TYPES.includes(value.registrationType as RegistrationType)) return null;
    if (!isNullableScore(value.intensity)) return null;
    if (value.occurredAt !== undefined && !isFiniteTimestamp(value.occurredAt)) return null;
    if (value.createdAt !== undefined && !isFiniteTimestamp(value.createdAt)) return null;
    if (value.editedAt !== undefined && !isFiniteTimestamp(value.editedAt)) return null;
    if (value.target !== undefined && !isString(value.target, 200)) return null;
    if (value.useOutcome !== undefined && !["used", "not_used", "unsure"].includes(String(value.useOutcome))) return null;
    if (value.usePrescribed !== undefined && typeof value.usePrescribed !== "boolean") return null;
    if (!["safe-for-now", "need-support", "urgent-danger"].includes(String(value.immediateSafety))) return null;
    if (!isString(value.chosenAction, 200) || value.chosenAction.trim() === "") return null;
    if (!isString(value.chosenActionOther, 500) || !isString(value.note, 2000)) return null;
    if (!["pending", "started", "completed", "dismissed"].includes(String(value.reflectionStatus))) return null;
    if (!isFiniteTimestamp(value.reflectionDueAt)) return null;
    if (!isNullableTimestamp(value.reflectionStartedAt) || !isNullableTimestamp(value.reflectionCompletedAt)) return null;
    if (!(value.linkedDetailedRecordId === undefined || value.linkedDetailedRecordId === null || isString(value.linkedDetailedRecordId, 200))) return null;
    if (value.reflectionStatus === "completed" && value.reflectionCompletedAt === null) return null;
    if (value.reflectionStatus !== "completed" && value.linkedDetailedRecordId != null) return null;
    return {
      ...value,
      linkedDetailedRecordId: typeof value.linkedDetailedRecordId === "string"
        ? value.linkedDetailedRecordId
        : null,
    } as unknown as QuickRegistrationRecord;
  }

  if (value.recordType === "recovery-action") {
    if (!["contact", "care", "tool", "goal"].includes(String(value.actionType))) return null;
    if (!isString(value.label, 500) || value.label.trim() === "" || !isString(value.note, 2000)) return null;
    if (!(value.sourceId === null || isString(value.sourceId, 200))) return null;
    return value as unknown as RecoveryActionRecord;
  }

  if (value.recordType === "tool-follow-up") {
    if (!isFiniteTimestamp(value.dueAt) || !TOOL_IDS.includes(value.toolId as RecoveryToolId)) return null;
    if (!isString(value.toolLabel, 300) || value.toolLabel.trim() === "") return null;
    if (!isNullableScore(value.feelingBefore) || !isNullableScore(value.feelingAfter)) return null;
    if (!(value.attempted === null || typeof value.attempted === "boolean")) return null;
    if (!["pending", "completed", "dismissed"].includes(String(value.status))) return null;
    if (!isNullableTimestamp(value.completedAt)) return null;
    if (
      value.status === "completed"
      && (typeof value.attempted !== "boolean" || !isScore(value.feelingAfter) || value.completedAt === null)
    ) return null;
    if (
      value.status !== "completed"
      && (value.attempted !== null || value.feelingAfter !== null || value.completedAt !== null)
    ) return null;
    return value as unknown as ToolFollowUpRecord;
  }

  if (value.recordType === "weekly-review") {
    if (value.planRevisionAt !== undefined && !isNullableTimestamp(value.planRevisionAt)) return null;
    if (value.linkedGoalId !== undefined && value.linkedGoalId !== null && !isString(value.linkedGoalId, 200)) return null;
    if (value.reviewedEntryIds !== undefined && !isIdArray(value.reviewedEntryIds, 10000)) return null;
    if (!isFiniteTimestamp(value.periodStart) || !isFiniteTimestamp(value.periodEnd) || value.periodEnd < value.periodStart) return null;
    if (!isString(value.chosenPattern, 1000) || !isString(value.nextWeekPlan, 4000)) return null;
    const hasStructuredPattern = [
      value.patternKind,
      value.patternValue,
      value.patternCount,
      value.patternDenominator,
    ].some((part) => part !== undefined);
    if (hasStructuredPattern) {
      if (![
        "registration-type",
        "time-of-day",
        "high-intensity",
      ].includes(String(value.patternKind))) return null;
      if (!isString(value.patternValue, 100) || value.patternValue.trim() === "") return null;
      if (!Number.isInteger(value.patternCount) || Number(value.patternCount) < 0) return null;
      if (!Number.isInteger(value.patternDenominator) || Number(value.patternDenominator) < 1) return null;
      if (Number(value.patternCount) > Number(value.patternDenominator)) return null;
    }
    return value as unknown as WeeklyReviewRecord;
  }

  return null;
}

export function serializeFeatureSetting(value: HomePreferences | RecoveryPlan): string {
  return JSON.stringify(value);
}

export function parseJson(value: unknown): unknown {
  if (typeof value !== "string" || value === "") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function registrationRoute(type: RegistrationType): string {
  return type === "trek" ? "/trek" : `/${type}`;
}

export function startOfLocalDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function startOfCurrentWeek(now = Date.now()): number {
  const date = new Date(now);
  const day = date.getDay();
  const distanceFromMonday = day === 0 ? 6 : day - 1;
  date.setDate(date.getDate() - distanceFromMonday);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}
