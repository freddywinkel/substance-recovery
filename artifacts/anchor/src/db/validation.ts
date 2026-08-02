import { migrateRegistrationRecordMetadata } from "./migrations";
import type {
  AnxietyLog,
  BoredomLog,
  CigaretteLog,
  CravingLog,
  JournalEntry,
  RegistrationAnswerValue,
  RelapseLog,
} from "./schema";

export const BACKUP_FORMAT_VERSION = 1 as const;

export type ImportStoreKey =
  | "journal"
  | "cravingLogs"
  | "relapseLogs"
  | "anxietyLogs"
  | "boredomLogs"
  | "cigaretteLogs";

export type ImportedStoreRecord =
  | JournalEntry
  | CravingLog
  | RelapseLog
  | AnxietyLog
  | BoredomLog
  | CigaretteLog;

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function failure(error: string): ValidationResult<never> {
  return { ok: false, error };
}

function isFiniteNumber(value: unknown, min = -Infinity, max = Infinity): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function isNullableFiniteNumber(value: unknown, min: number, max: number): boolean {
  return value === null || isFiniteNumber(value, min, max);
}

function hasStrings(record: UnknownRecord, fields: readonly string[]): string | null {
  for (const field of fields) {
    if (typeof record[field] !== "string") return `${field} must be a string`;
  }
  return null;
}

function hasStringArrays(record: UnknownRecord, fields: readonly string[]): string | null {
  for (const field of fields) {
    const value = record[field];
    if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
      return `${field} must be an array of strings`;
    }
  }
  return null;
}

function optionalString(record: UnknownRecord, field: string): string | null {
  return record[field] === undefined || typeof record[field] === "string"
    ? null
    : `${field} must be a string when present`;
}

function optionalStringArray(record: UnknownRecord, field: string): string | null {
  const value = record[field];
  return value === undefined || (Array.isArray(value) && value.every((item) => typeof item === "string"))
    ? null
    : `${field} must be an array of strings when present`;
}

function oneOf(value: unknown, allowed: readonly unknown[]): boolean {
  return allowed.includes(value);
}

function validAnswerValue(value: unknown): value is RegistrationAnswerValue {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    isFiniteNumber(value) ||
    (Array.isArray(value) && value.every((item) => typeof item === "string"))
  );
}

function validateSyncFields(record: UnknownRecord): string | null {
  if (record.updatedAt !== undefined && !isFiniteNumber(record.updatedAt, 0)) {
    return "updatedAt must be a non-negative finite number";
  }
  if (record.deleted !== undefined && typeof record.deleted !== "boolean") {
    return "deleted must be a boolean";
  }
  return null;
}

function validateRegistrationMetadata(record: UnknownRecord): string | null {
  if (typeof record.id !== "string" || record.id.trim() === "") {
    return "id must be a non-empty string";
  }
  if (!isFiniteNumber(record.timestamp, 0)) {
    return "timestamp must be a non-negative finite number";
  }
  for (const field of ["occurredAt", "startedAt", "completedAt"] as const) {
    if (record[field] !== undefined && !isFiniteNumber(record[field], 0)) {
      return `${field} must be a non-negative finite number`;
    }
  }
  if (
    record.dataVersion !== undefined &&
    (!Number.isInteger(record.dataVersion) || Number(record.dataVersion) <= 0)
  ) {
    return "dataVersion must be a positive integer";
  }
  if (record.contentVersion !== undefined && typeof record.contentVersion !== "string") {
    return "contentVersion must be a string";
  }
  if (record.answers !== undefined) {
    if (!isRecord(record.answers)) return "answers must be an object";
    for (const [key, value] of Object.entries(record.answers)) {
      if (key.trim() === "" || !validAnswerValue(value)) {
        return `answers.${key || "<empty>"} has an unsupported value`;
      }
    }
  }
  return validateSyncFields(record);
}

function validateJournal(record: UnknownRecord): ValidationResult<JournalEntry> {
  if (typeof record.id !== "string" || record.id.trim() === "") return failure("id must be a non-empty string");
  if (!isFiniteNumber(record.timestamp, 0)) return failure("timestamp must be a non-negative finite number");
  if (!Number.isInteger(record.mood) || !isFiniteNumber(record.mood, 1, 5)) return failure("mood must be an integer from 1 through 5");
  if (record.cravingIntensity !== null && !isFiniteNumber(record.cravingIntensity, 0, 10)) return failure("cravingIntensity must be null or a number from 0 through 10");
  if (typeof record.note !== "string") return failure("note must be a string");
  if (record.toolUsed !== null && typeof record.toolUsed !== "string") return failure("toolUsed must be null or a string");
  for (const field of ["trigger", "coping"] as const) {
    const error = optionalString(record, field);
    if (error) return failure(error);
  }
  if (record.favourite !== undefined && typeof record.favourite !== "boolean") return failure("favourite must be a boolean when present");
  const syncError = validateSyncFields(record);
  return syncError ? failure(syncError) : { ok: true, value: record as unknown as JournalEntry };
}

function validateCraving(record: UnknownRecord): ValidationResult<CravingLog> {
  const metaError = validateRegistrationMetadata(record);
  if (metaError) return failure(metaError);
  if (!oneOf(record.status, ["draft", "completed"])) return failure("status is invalid");
  const arrayError = hasStringArrays(record, [
    "situationPresets", "emotions", "physicalSensations", "thoughtPresets",
    "socialContext", "substances",
  ]);
  if (arrayError) return failure(arrayError);
  const stringError = hasStrings(record, [
    "situationOther", "riskLevel", "emotionOther", "thoughtFreeText", "location",
    "locationOther", "primarySubstance", "buildupDuration", "chosenAction",
    "chosenActionOther", "note",
  ]);
  if (stringError) return failure(stringError);
  if (!oneOf(record.riskLevel, ["", "low", "medium", "high"])) return failure("riskLevel is invalid");
  if (!isNullableFiniteNumber(record.intensity, 0, 10)) return failure("intensity must be null or from 0 through 10");
  if (!isNullableFiniteNumber(record.distressLevel, 0, 10)) return failure("distressLevel must be null or from 0 through 10");
  if (!isNullableFiniteNumber(record.confidenceBefore, 0, 10)) return failure("confidenceBefore must be null or from 0 through 10");
  for (const field of ["intensityAfter", "confidenceAfter"] as const) {
    if (record[field] !== null && !isFiniteNumber(record[field], 0, 10)) return failure(`${field} must be null or from 0 through 10`);
  }
  if (!oneOf(record.cravingOutcome, [null, "decreased", "same", "increased", "unknown"])) return failure("cravingOutcome is invalid");
  if (record.interventionUsed !== null && typeof record.interventionUsed !== "boolean") return failure("interventionUsed must be null or boolean");
  if (record.actionAttempted !== undefined && record.actionAttempted !== null && typeof record.actionAttempted !== "boolean") return failure("actionAttempted must be boolean, null, or absent");
  if (typeof record.markAsPattern !== "boolean" || typeof record.highRiskFlag !== "boolean") return failure("markAsPattern and highRiskFlag must be booleans");
  if (record.toolUsed !== null && typeof record.toolUsed !== "string") return failure("toolUsed must be null or a string");
  if (record.cravingType !== undefined && !oneOf(record.cravingType, ["active", "passive"])) return failure("cravingType is invalid");
  for (const field of ["onsetType", "planningStage", "needType", "needOther", "triggerNote", "onsetOther"] as const) {
    const error = optionalString(record, field);
    if (error) return failure(error);
  }
  for (const field of ["needTypes", "triggers", "trekTypes"] as const) {
    const error = optionalStringArray(record, field);
    if (error) return failure(error);
  }
  if (record.useOutcome !== undefined && !oneOf(record.useOutcome, ["used", "not_used", "unsure"])) return failure("useOutcome is invalid");
  return {
    ok: true,
    value: migrateRegistrationRecordMetadata(record as unknown as CravingLog),
  };
}

function validateRelapse(record: UnknownRecord): ValidationResult<RelapseLog> {
  const metaError = validateRegistrationMetadata(record);
  if (metaError) return failure(metaError);
  if (!oneOf(record.status, ["draft", "completed"])) return failure("status is invalid");
  if (!oneOf(record.label, ["lapse", "setback", "return-to-use", "relapse", "no-label"])) return failure("label is invalid");
  if (!oneOf(record.episodeDuration, ["single-moment", "few-hours", "whole-day", "multiple-days", "unanswered"])) return failure("episodeDuration is invalid");
  if (!oneOf(record.amountCategory, ["small", "moderate", "a-lot", "multiple-times", "binge", "prefer-not", "unanswered"])) return failure("amountCategory is invalid");
  if (!oneOf(record.acuteRisk, ["none", "unsafe", "fear-continued-use", "withdrawal", "self-harm-risk", "unanswered"])) return failure("acuteRisk is invalid");
  const arrayError = hasStringArrays(record, [
    "substances", "preUseFactors", "missedWarnings", "couldHaveHelpedEarly",
    "couldHaveHelpedMiddle", "couldHaveHelpedLast",
  ]);
  if (arrayError) return failure(arrayError);
  const stringError = hasStrings(record, [
    "when", "primarySubstance", "firstTriggerType", "firstTriggerText",
    "preUseThoughtPreset", "preUseThoughtFreeText", "supportContact",
    "supportContactOther", "nextStep", "nextStepOther", "note", "context",
  ]);
  if (stringError) return failure(stringError);
  if (record.emotionAfter !== null && !isFiniteNumber(record.emotionAfter, 0, 10)) return failure("emotionAfter must be null or from 0 through 10");
  for (const field of ["preUseThoughtPresets", "repairActions"] as const) {
    const error = optionalStringArray(record, field);
    if (error) return failure(error);
  }
  for (const field of ["whatNeeded", "relapseType", "pointOfNoReturn"] as const) {
    const error = optionalString(record, field);
    if (error) return failure(error);
  }
  return {
    ok: true,
    value: migrateRegistrationRecordMetadata(record as unknown as RelapseLog),
  };
}

function validateAnxiety(record: UnknownRecord): ValidationResult<AnxietyLog> {
  const metaError = validateRegistrationMetadata(record);
  if (metaError) return failure(metaError);
  if (!isNullableFiniteNumber(record.intensity, 0, 10)) return failure("intensity must be null or from 0 through 10");
  const stringError = hasStrings(record, ["context", "trigger", "reaction", "note"]);
  if (stringError) return failure(stringError);
  const arrayError = hasStringArrays(record, ["bodySensations"]);
  if (arrayError) return failure(arrayError);
  for (const field of ["bodyPrediction", "linkedState"] as const) {
    const error = optionalString(record, field);
    if (error) return failure(error);
  }
  for (const field of ["anxietyTypes", "bodyLocations", "reassuranceSeeking", "linkedStates", "triggers"] as const) {
    const error = optionalStringArray(record, field);
    if (error) return failure(error);
  }
  if (record.urgencyHigh !== undefined && record.urgencyHigh !== null && typeof record.urgencyHigh !== "boolean") return failure("urgencyHigh must be boolean, null, or absent");
  if (record.outcomeAfter !== undefined && !oneOf(record.outcomeAfter, [null, "decreased", "same", "increased", "unknown"])) return failure("outcomeAfter is invalid");
  return {
    ok: true,
    value: migrateRegistrationRecordMetadata(record as unknown as AnxietyLog),
  };
}

function validateBoredom(record: UnknownRecord): ValidationResult<BoredomLog> {
  const metaError = validateRegistrationMetadata(record);
  if (metaError) return failure(metaError);
  if (!isNullableFiniteNumber(record.intensity, 0, 10)) return failure("intensity must be null or from 0 through 10");
  const stringError = hasStrings(record, ["situation", "urge", "action", "note"]);
  if (stringError) return failure(stringError);
  if (record.delayDuration !== null && typeof record.delayDuration !== "string") return failure("delayDuration must be null or a string");
  const arrayError = hasStringArrays(record, ["feelingTypes"]);
  if (arrayError) return failure(arrayError);
  for (const field of ["stimulationNeed", "convertCheck", "situationOther", "urgeOther"] as const) {
    const error = optionalString(record, field);
    if (error) return failure(error);
  }
  for (const field of ["restlessnessTypes", "stimulationNeeds", "rescueMenu", "environmentReset"] as const) {
    const error = optionalStringArray(record, field);
    if (error) return failure(error);
  }
  if (record.outcomeAfter !== undefined && !oneOf(record.outcomeAfter, [null, "decreased", "same", "increased", "unknown"])) return failure("outcomeAfter is invalid");
  return {
    ok: true,
    value: migrateRegistrationRecordMetadata(record as unknown as BoredomLog),
  };
}

function validateCigarette(record: UnknownRecord): ValidationResult<CigaretteLog> {
  const metaError = validateRegistrationMetadata(record);
  if (metaError) return failure(metaError);
  const noteError = optionalString(record, "note");
  return noteError
    ? failure(noteError)
    : {
        ok: true,
        value: migrateRegistrationRecordMetadata(record as unknown as CigaretteLog),
      };
}

export function validateImportedStoreRecord(
  key: ImportStoreKey,
  value: unknown,
): ValidationResult<ImportedStoreRecord> {
  if (!isRecord(value)) return failure("record must be an object");
  switch (key) {
    case "journal": return validateJournal(value);
    case "cravingLogs": {
      // The retired QuickLog stored -1 as its explicit "not answered" marker.
      // Preserve those legitimate version-1 backups while converging on the
      // current schema's single unanswered representation.
      const normalized = value.distressLevel === -1
        ? { ...value, distressLevel: null }
        : value;
      return validateCraving(normalized);
    }
    case "relapseLogs": return validateRelapse(value);
    case "anxietyLogs": return validateAnxiety(value);
    case "boredomLogs": return validateBoredom(value);
    case "cigaretteLogs": return validateCigarette(value);
  }
}

export function validateBackupEnvelope(
  value: unknown,
): ValidationResult<Record<string, unknown>> {
  if (!isRecord(value)) return failure("Backup must be an object.");
  if (value.version !== BACKUP_FORMAT_VERSION) {
    return failure("Unsupported backup version.");
  }
  for (const key of [
    "journal", "cravingLogs", "relapseLogs", "anxietyLogs", "boredomLogs", "settings",
  ] as const) {
    if (!Array.isArray(value[key])) return failure(`${key} must be an array.`);
  }
  if (value.cigaretteLogs !== undefined && !Array.isArray(value.cigaretteLogs)) {
    return failure("cigaretteLogs must be an array when present.");
  }
  return { ok: true, value };
}
