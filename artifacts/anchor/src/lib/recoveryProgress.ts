import type {
  QuickRegistrationRecord,
  QuickSafety,
  RecoveryActionRecord,
  RegistrationType,
} from "@/lib/recoveryFeatures";
import { toStableOptionId } from "@/lib/registrationIds";

export type ReviewSource = "detailed" | "quick" | "linked";
export type TimeOfDay = "morning" | "afternoon" | "evening" | "night";

type ReviewAnswerValue = string | string[] | number | boolean | null;

export interface ReviewTextPart {
  kind: "option" | "text";
  value: string;
}

interface RegistrationBase {
  id: string;
  timestamp: number;
  occurredAt?: number | null;
  completedAt?: number | null;
  intensity?: number | null;
  note?: string;
  answers?: Record<string, ReviewAnswerValue>;
}

export interface CravingReviewInput extends RegistrationBase {
  status: "draft" | "completed";
  cravingType?: "active" | "passive";
  situationPresets?: string[];
  situationOther?: string;
  location?: string;
  locationOther?: string;
  chosenAction?: string;
  chosenActionOther?: string;
}

export interface RelapseReviewInput extends RegistrationBase {
  status: "draft" | "completed";
  label?: string;
  primarySubstance?: string;
  substances?: string[];
  firstTriggerType?: string;
  firstTriggerText?: string;
  nextStep?: string;
  nextStepOther?: string;
}

export interface AnxietyReviewInput extends RegistrationBase {
  context?: string;
  trigger?: string;
  reaction?: string;
}

export interface BoredomReviewInput extends RegistrationBase {
  situation?: string;
  situationOther?: string;
  urge?: string;
  urgeOther?: string;
  action?: string;
}

export interface RecoveryProgressSources {
  cravingLogs: readonly CravingReviewInput[];
  relapseLogs: readonly RelapseReviewInput[];
  anxietyLogs: readonly AnxietyReviewInput[];
  boredomLogs: readonly BoredomReviewInput[];
  quickRegistrations: readonly QuickRegistrationRecord[];
}

export interface ReviewRegistration {
  id: string;
  sourceId: string;
  source: ReviewSource;
  type: RegistrationType;
  timestamp: number;
  intensity: number | null;
  laterIntensity: number | null;
  immediateSafety: QuickSafety | null;
  context: string;
  contextParts: ReviewTextPart[];
  action: string;
  actionParts: ReviewTextPart[];
  note: string;
}

export interface LocalWeekRange {
  start: number;
  endExclusive: number;
}

export function buildLocalDateRange(
  from: string,
  through: string,
): { start: number; endExclusive: number } | null {
  const parseDateOnly = (value: string): Date | null => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year
      && date.getMonth() === month - 1
      && date.getDate() === day
      ? date
      : null;
  };

  const startDate = parseDateOnly(from);
  const throughDate = parseDateOnly(through);
  if (!startDate || !throughDate || throughDate.getTime() < startDate.getTime()) return null;
  throughDate.setDate(throughDate.getDate() + 1);
  return { start: startDate.getTime(), endExclusive: throughDate.getTime() };
}

export type WeeklyPattern =
  | {
      id: string;
      kind: "registration-type";
      value: RegistrationType;
      count: number;
      denominator: number;
      entryIds: string[];
    }
  | {
      id: string;
      kind: "time-of-day";
      value: TimeOfDay;
      count: number;
      denominator: number;
      entryIds: string[];
    }
  | {
      id: string;
      kind: "high-intensity";
      value: "7-10";
      count: number;
      denominator: number;
      entryIds: string[];
    };

export interface WeeklyReviewSummary {
  entries: ReviewRegistration[];
  countsByType: Partial<Record<RegistrationType, number>>;
  patterns: WeeklyPattern[];
  intensityAnsweredCount: number;
}

export interface SupportiveProgressSummary {
  detailedRegistrations: number;
  quickRegistrations: number;
  supportiveActions: number;
  totalRecognisedActions: number;
  byActionType: Partial<Record<RecoveryActionRecord["actionType"], number>>;
}

export const REPORT_FIELD_IDS = [
  "summary",
  "date",
  "source",
  "type",
  "intensity",
  "immediate-safety",
  "context",
  "chosen-action",
  "notes",
  "supportive-date",
  "supportive-category",
  "supportive-description",
  "supportive-notes",
] as const;

export type ReportFieldId = (typeof REPORT_FIELD_IDS)[number];
export type ReportSupportiveField = Extract<ReportFieldId, `supportive-${string}`>;
export type ReportRegistrationField = Exclude<
  ReportFieldId,
  "summary" | ReportSupportiveField
>;

export function isReportSupportiveField(field: ReportFieldId): field is ReportSupportiveField {
  return field.startsWith("supportive-");
}

export interface SelectiveReportRow {
  id: string;
  values: Partial<Record<ReportRegistrationField, string | number | null | ReviewTextPart[]>>;
}

export interface SelectiveSupportiveActionRow {
  id: string;
  actionType: RecoveryActionRecord["actionType"];
  sourceId: string | null;
  values: Partial<Record<ReportSupportiveField, string | number | null>>;
}

export interface SelectiveReport {
  registrations: SelectiveReportRow[];
  supportiveActions: SelectiveSupportiveActionRow[];
  summary: null | {
    registrationCount: number;
    supportiveActionCount: number;
  };
}

const optionPart = (value: string | undefined | null): ReviewTextPart[] => {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized ? [{ kind: "option", value: normalized }] : [];
};

const textPart = (value: string | undefined | null): ReviewTextPart[] => {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized ? [{ kind: "text", value: normalized }] : [];
};

function answerOptionParts(
  answers: RegistrationBase["answers"],
  key: string,
  legacy: string | readonly string[] | undefined | null,
): ReviewTextPart[] {
  const answer = answers?.[key];
  const values = typeof answer === "string"
    ? [answer]
    : Array.isArray(answer) && answer.every((value) => typeof value === "string")
      ? answer
      : Array.isArray(legacy)
        ? legacy.map(toStableOptionId)
        : typeof legacy === "string"
          ? [toStableOptionId(legacy)]
          : [];
  return values.flatMap(optionPart);
}

function uniqueParts(...groups: readonly ReviewTextPart[][]): ReviewTextPart[] {
  const seen = new Set<string>();
  return groups.flat().filter((part) => {
    const key = `${part.kind}:${part.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const partsToLegacyText = (parts: readonly ReviewTextPart[]): string =>
  parts.map((part) => part.value).join(" · ");

const joinedDistinctNonBlank = (...values: Array<string | undefined | null>): string =>
  [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))].join("\n");

function registrationTimestamp(record: RegistrationBase): number {
  return typeof record.occurredAt === "number" && Number.isFinite(record.occurredAt)
    ? record.occurredAt
    : record.timestamp;
}

function safeIntensity(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function buildReviewRegistrations(
  sources: RecoveryProgressSources,
): ReviewRegistration[] {
  const entries: ReviewRegistration[] = [];
  const quickById = new Map(
    sources.quickRegistrations.map((record) => [record.id, record] as const),
  );
  const consumedLinkedQuickIds = new Set<string>();
  const hintedDetailedWinnerByQuickId = new Map<string, {
    detailedRecordId: string;
    type: RegistrationType;
    completedAt: number;
  }>();
  const rememberHintedWinner = (
    record: RegistrationBase,
    type: RegistrationType,
  ) => {
    const quickRegistrationId = record.answers?.quickRegistrationId;
    if (typeof quickRegistrationId !== "string") return;
    const quick = quickById.get(quickRegistrationId);
    if (!quick || quick.registrationType !== type) return;
    const completedAt = typeof record.completedAt === "number" && Number.isFinite(record.completedAt)
      ? record.completedAt
      : registrationTimestamp(record);
    const existing = hintedDetailedWinnerByQuickId.get(quickRegistrationId);
    if (!existing || completedAt < existing.completedAt) {
      hintedDetailedWinnerByQuickId.set(quickRegistrationId, {
        detailedRecordId: record.id,
        type,
        completedAt,
      });
    }
  };
  for (const record of sources.cravingLogs) {
    if (record.status === "completed") {
      rememberHintedWinner(record, record.cravingType === "active" ? "trek" : "craving");
    }
  }
  for (const record of sources.relapseLogs) {
    if (record.status === "completed") rememberHintedWinner(record, "relapse");
  }
  for (const record of sources.anxietyLogs) rememberHintedWinner(record, "anxiety");
  for (const record of sources.boredomLogs) rememberHintedWinner(record, "boredom");

  const linkedQuickByDetailedId = new Map<string, QuickRegistrationRecord>();
  for (const quick of sources.quickRegistrations) {
    if (quick.linkedDetailedRecordId) {
      linkedQuickByDetailedId.set(
        `${quick.registrationType}:${quick.linkedDetailedRecordId}`,
        quick,
      );
    }
  }

  const addDetailed = (
    entry: Omit<ReviewRegistration, "source" | "laterIntensity" | "immediateSafety">,
    hintedQuickRegistrationId?: ReviewAnswerValue,
  ) => {
    const hintedWinner = typeof hintedQuickRegistrationId === "string"
      ? hintedDetailedWinnerByQuickId.get(hintedQuickRegistrationId)
      : undefined;
    const hintedQuick =
      typeof hintedQuickRegistrationId === "string"
      && hintedWinner?.detailedRecordId === entry.sourceId
      && hintedWinner.type === entry.type
        ? quickById.get(hintedQuickRegistrationId)
        : undefined;
    const candidate = hintedQuick?.registrationType === entry.type
      ? hintedQuick
      : linkedQuickByDetailedId.get(`${entry.type}:${entry.sourceId}`);
    const quick = candidate && !consumedLinkedQuickIds.has(candidate.id) ? candidate : undefined;
    if (quick) consumedLinkedQuickIds.add(quick.id);
    const quickActionParts = quick
      ? uniqueParts(optionPart(quick.chosenAction), textPart(quick.chosenActionOther))
      : [];
    const actionParts = uniqueParts(quickActionParts, entry.actionParts);
    const quickIntensity = quick ? safeIntensity(quick.intensity) : null;
    entries.push({
      ...entry,
      source: quick ? "linked" : "detailed",
      timestamp: quick?.timestamp ?? entry.timestamp,
      intensity: quickIntensity ?? entry.intensity,
      laterIntensity:
        quick && quickIntensity !== null && entry.intensity !== null && entry.intensity !== quickIntensity
          ? entry.intensity
          : null,
      immediateSafety: quick?.immediateSafety ?? null,
      actionParts,
      action: partsToLegacyText(actionParts),
      note: joinedDistinctNonBlank(quick?.note, entry.note),
    });
  };

  for (const record of sources.cravingLogs) {
    if (record.status !== "completed") continue;
    const type: RegistrationType = record.cravingType === "active" ? "trek" : "craving";
    const contextParts = uniqueParts(
      answerOptionParts(record.answers, "situations", record.situationPresets),
      textPart(record.situationOther),
      answerOptionParts(record.answers, "location", record.location),
      textPart(record.locationOther),
    );
    const actionParts = uniqueParts(
      answerOptionParts(record.answers, "chosenAction", record.chosenAction),
      textPart(record.chosenActionOther),
    );
    addDetailed({
      id: `detailed:${type}:${record.id}`,
      sourceId: record.id,
      type,
      timestamp: registrationTimestamp(record),
      intensity: safeIntensity(record.intensity),
      context: partsToLegacyText(contextParts),
      contextParts,
      action: partsToLegacyText(actionParts),
      actionParts,
      note: record.note?.trim() ?? "",
    }, record.answers?.quickRegistrationId);
  }

  for (const record of sources.relapseLogs) {
    if (record.status !== "completed") continue;
    const contextParts = uniqueParts(
      answerOptionParts(record.answers, "label", record.label),
      answerOptionParts(record.answers, "substances", record.substances ?? (record.primarySubstance ? [record.primarySubstance] : [])),
      answerOptionParts(record.answers, "firstTriggerType", record.firstTriggerType),
      textPart(record.firstTriggerText),
    );
    const actionParts = uniqueParts(
      answerOptionParts(record.answers, "nextStep", record.nextStep),
      textPart(record.nextStepOther),
    );
    addDetailed({
      id: `detailed:relapse:${record.id}`,
      sourceId: record.id,
      type: "relapse",
      timestamp: registrationTimestamp(record),
      intensity: safeIntensity(record.intensity),
      context: partsToLegacyText(contextParts),
      contextParts,
      action: partsToLegacyText(actionParts),
      actionParts,
      note: record.note?.trim() ?? "",
    }, record.answers?.quickRegistrationId);
  }

  for (const record of sources.anxietyLogs) {
    const contextParts = uniqueParts(
      answerOptionParts(record.answers, "context", record.context),
      answerOptionParts(record.answers, "triggers", record.trigger),
    );
    const actionParts = answerOptionParts(record.answers, "reaction", record.reaction);
    addDetailed({
      id: `detailed:anxiety:${record.id}`,
      sourceId: record.id,
      type: "anxiety",
      timestamp: registrationTimestamp(record),
      intensity: safeIntensity(record.intensity),
      context: partsToLegacyText(contextParts),
      contextParts,
      action: partsToLegacyText(actionParts),
      actionParts,
      note: record.note?.trim() ?? "",
    }, record.answers?.quickRegistrationId);
  }

  for (const record of sources.boredomLogs) {
    const contextParts = uniqueParts(
      answerOptionParts(record.answers, "situation", record.situation),
      textPart(record.situationOther),
      answerOptionParts(record.answers, "urge", record.urge),
      textPart(record.urgeOther),
    );
    const actionParts = answerOptionParts(record.answers, "action", record.action);
    addDetailed({
      id: `detailed:boredom:${record.id}`,
      sourceId: record.id,
      type: "boredom",
      timestamp: registrationTimestamp(record),
      intensity: safeIntensity(record.intensity),
      context: partsToLegacyText(contextParts),
      contextParts,
      action: partsToLegacyText(actionParts),
      actionParts,
      note: record.note?.trim() ?? "",
    }, record.answers?.quickRegistrationId);
  }

  for (const record of sources.quickRegistrations) {
    // Once the full reflection exists, it represents this episode in
    // denominators and reports. Keeping the paired quick row as well would
    // give one event double weight.
    if (consumedLinkedQuickIds.has(record.id)) continue;
    const actionParts = uniqueParts(
      optionPart(record.chosenAction),
      textPart(record.chosenActionOther),
    );
    entries.push({
      id: `quick:${record.id}`,
      sourceId: record.id,
      source: "quick",
      type: record.registrationType,
      timestamp: record.timestamp,
      intensity: safeIntensity(record.intensity),
      laterIntensity: null,
      immediateSafety: record.immediateSafety,
      context: "",
      contextParts: [],
      action: partsToLegacyText(actionParts),
      actionParts,
      note: record.note.trim(),
    });
  }

  return entries.sort((left, right) => right.timestamp - left.timestamp);
}

export function getLocalWeekRange(now = Date.now(), weekOffset = 0): LocalWeekRange {
  const startDate = new Date(now);
  const day = startDate.getDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  startDate.setDate(startDate.getDate() - daysSinceMonday + weekOffset * 7);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 7);
  return { start: startDate.getTime(), endExclusive: endDate.getTime() };
}

export function filterByPeriod<T extends { timestamp: number }>(
  records: readonly T[],
  range: LocalWeekRange,
): T[] {
  return records.filter(
    (record) => record.timestamp >= range.start && record.timestamp < range.endExclusive,
  );
}

export function timeOfDayFor(timestamp: number): TimeOfDay {
  const hour = new Date(timestamp).getHours();
  if (hour >= 6 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  if (hour >= 18 && hour < 22) return "evening";
  return "night";
}

function largestGroup<T extends string>(
  groups: Map<T, ReviewRegistration[]>,
): [T, ReviewRegistration[]] | null {
  let largest: [T, ReviewRegistration[]] | null = null;
  for (const group of groups.entries()) {
    if (!largest || group[1].length > largest[1].length) largest = group;
  }
  return largest;
}

export function buildWeeklyReviewSummary(
  registrations: readonly ReviewRegistration[],
  range: LocalWeekRange,
): WeeklyReviewSummary {
  const entries = filterByPeriod(registrations, range).sort(
    (left, right) => right.timestamp - left.timestamp,
  );
  const byType = new Map<RegistrationType, ReviewRegistration[]>();
  const byTime = new Map<TimeOfDay, ReviewRegistration[]>();
  const countsByType: Partial<Record<RegistrationType, number>> = {};

  for (const entry of entries) {
    const typeItems = byType.get(entry.type) ?? [];
    typeItems.push(entry);
    byType.set(entry.type, typeItems);
    countsByType[entry.type] = typeItems.length;

    const bucket = timeOfDayFor(entry.timestamp);
    const timeItems = byTime.get(bucket) ?? [];
    timeItems.push(entry);
    byTime.set(bucket, timeItems);
  }

  const patterns: WeeklyPattern[] = [];
  const topType = largestGroup(byType);
  if (topType) {
    patterns.push({
      id: `type:${topType[0]}`,
      kind: "registration-type",
      value: topType[0],
      count: topType[1].length,
      denominator: entries.length,
      entryIds: topType[1].map((entry) => entry.id),
    });
  }

  const topTime = largestGroup(byTime);
  if (topTime) {
    patterns.push({
      id: `time:${topTime[0]}`,
      kind: "time-of-day",
      value: topTime[0],
      count: topTime[1].length,
      denominator: entries.length,
      entryIds: topTime[1].map((entry) => entry.id),
    });
  }

  const intensityAnswered = entries.filter((entry) => entry.intensity !== null);
  const highIntensity = intensityAnswered.filter(
    (entry) => (entry.intensity ?? 0) >= 7,
  );
  if (highIntensity.length > 0) {
    patterns.push({
      id: "intensity:7-10",
      kind: "high-intensity",
      value: "7-10",
      count: highIntensity.length,
      denominator: intensityAnswered.length,
      entryIds: highIntensity.map((entry) => entry.id),
    });
  }

  return {
    entries,
    countsByType,
    patterns,
    intensityAnsweredCount: intensityAnswered.length,
  };
}

export function buildSupportiveProgressSummary(input: {
  registrations: readonly ReviewRegistration[];
  recoveryActions: readonly RecoveryActionRecord[];
  range: LocalWeekRange;
}): SupportiveProgressSummary {
  const registrations = filterByPeriod(input.registrations, input.range);
  const recoveryActions = filterByPeriod(input.recoveryActions, input.range);
  const detailedRegistrations = registrations.filter(
    (entry) => entry.source !== "quick",
  ).length;
  const quickRegistrations = registrations.filter((entry) => entry.source === "quick").length;
  const byActionType: Partial<Record<RecoveryActionRecord["actionType"], number>> = {};
  for (const action of recoveryActions) {
    byActionType[action.actionType] = (byActionType[action.actionType] ?? 0) + 1;
  }
  return {
    detailedRegistrations,
    quickRegistrations,
    supportiveActions: recoveryActions.length,
    totalRecognisedActions:
      detailedRegistrations + quickRegistrations + recoveryActions.length,
    byActionType,
  };
}

export function buildSelectiveReport(input: {
  registrations: readonly ReviewRegistration[];
  recoveryActions: readonly RecoveryActionRecord[];
  range: LocalWeekRange;
  fields: readonly ReportFieldId[];
}): SelectiveReport {
  const selected = new Set(input.fields);
  const registrationsInRange = filterByPeriod(input.registrations, input.range);
  const actionsInRange = filterByPeriod(input.recoveryActions, input.range);
  const registrations = registrationsInRange.map((entry): SelectiveReportRow => {
    const values: SelectiveReportRow["values"] = {};
    if (selected.has("date")) values.date = entry.timestamp;
    if (selected.has("source")) values.source = entry.source;
    if (selected.has("type")) values.type = entry.type;
    if (selected.has("intensity")) {
      values.intensity = entry.laterIntensity === null
        ? entry.intensity
        : `${entry.intensity} → ${entry.laterIntensity}`;
    }
    if (selected.has("immediate-safety")) values["immediate-safety"] = entry.immediateSafety;
    if (selected.has("context")) values.context = entry.contextParts;
    if (selected.has("chosen-action")) values["chosen-action"] = entry.actionParts;
    if (selected.has("notes")) values.notes = entry.note;
    return { id: entry.id, values };
  });

  const supportiveActions = input.fields.some(isReportSupportiveField)
    ? actionsInRange.map((action): SelectiveSupportiveActionRow => {
        const values: SelectiveSupportiveActionRow["values"] = {};
        if (selected.has("supportive-date")) values["supportive-date"] = action.timestamp;
        if (selected.has("supportive-category")) values["supportive-category"] = action.actionType;
        if (selected.has("supportive-description")) values["supportive-description"] = action.label;
        if (selected.has("supportive-notes")) values["supportive-notes"] = action.note;
        return {
          id: action.id,
          actionType: action.actionType,
          sourceId: action.sourceId,
          values,
        };
      })
    : [];

  return {
    registrations,
    supportiveActions,
    summary: selected.has("summary")
      ? {
          registrationCount: registrationsInRange.length,
          supportiveActionCount: actionsInRange.length,
        }
      : null,
  };
}
