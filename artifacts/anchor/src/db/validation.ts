import {
  migrateRelapseFollowUpAnswers,
  migrateRelapseV2DefaultAnswers,
  migrateRegistrationRecordMetadata,
} from "./migrations";
import {
  isAcuteRisk,
  isValidAcuteRiskSelectionArray,
  migrateRelapseSafetyRecord,
} from "./relapseSafety";
import { normalizeRelapseTimingRecord, relapseWhenForOccurrence } from "./relapseTiming";
import { migrateCompletedTrekRecord } from "@/lib/trekMigration";
import { RELAPSE_NO_CLEAR_TRIGGER_ID } from "@/lib/relapseTrigger";
import { BOREDOM_CLASSIFICATION_NOT_SURE_ID } from "@/lib/boredomClassification";
import type {
  AnxietyLog,
  BoredomLog,
  CigaretteLog,
  CravingLog,
  JournalEntry,
  RegistrationAnswerValue,
  RelapseLog,
} from "./schema";

export const BACKUP_FORMAT_VERSION = 2 as const;

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

const MAX_SUPPORTED_TIMESTAMP = 8_640_000_000_000_000;

function isFiniteTimestamp(value: unknown): value is number {
  return isFiniteNumber(value, 0, MAX_SUPPORTED_TIMESTAMP);
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

function sameStringSet(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value) => right.includes(value));
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
  if (record.updatedAt !== undefined && !isFiniteTimestamp(record.updatedAt)) {
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
  if (!isFiniteTimestamp(record.timestamp)) {
    return "timestamp must be a non-negative finite number";
  }
  for (const field of ["occurredAt", "startedAt", "completedAt"] as const) {
    if (record[field] !== undefined && !isFiniteTimestamp(record[field])) {
      return `${field} must be a non-negative finite number`;
    }
  }
  if (
    record.dataVersion !== undefined &&
    (!Number.isInteger(record.dataVersion) || Number(record.dataVersion) <= 0)
  ) {
    return "dataVersion must be a positive integer";
  }
  if (typeof record.dataVersion === "number" && record.dataVersion > 3) {
    return "dataVersion is newer than this app supports";
  }
  if (record.contentVersion !== undefined && typeof record.contentVersion !== "string") {
    return "contentVersion must be a string";
  }
  if (record.dataVersion === 3 && record.contentVersion !== "registration-v3") {
    return "dataVersion 3 requires contentVersion registration-v3";
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

type CanonicalAnswerValidator = (value: unknown) => boolean;
type CanonicalAnswerSchema = Readonly<Record<string, CanonicalAnswerValidator>>;

const isNonEmptyTextAnswer: CanonicalAnswerValidator = (value) =>
  typeof value === "string" && value.trim() !== "";
const isStableIdAnswer: CanonicalAnswerValidator = (value) =>
  typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
const isNullableStringAnswer: CanonicalAnswerValidator = (value) =>
  value === null || isNonEmptyTextAnswer(value);
const isStableIdArrayAnswer: CanonicalAnswerValidator = (value) =>
  Array.isArray(value)
  && value.length > 0
  && value.every(isStableIdAnswer)
  && new Set(value).size === value.length;
const isNullableStableIdArrayAnswer: CanonicalAnswerValidator = (value) =>
  value === null || isStableIdArrayAnswer(value);
const isNullableStableIdAnswer: CanonicalAnswerValidator = (value) =>
  value === null || isStableIdAnswer(value);
const isNullableScoreAnswer: CanonicalAnswerValidator = (value) =>
  value === null || isFiniteNumber(value, 0, 10);
const isNullableBooleanAnswer: CanonicalAnswerValidator = (value) =>
  value === null || typeof value === "boolean";
const isOutcomeAnswer: CanonicalAnswerValidator = (value) =>
  oneOf(value, [null, "decreased", "same", "increased", "unknown"]);
const isDelayDurationAnswer: CanonicalAnswerValidator = (value) =>
  value === null || isFiniteNumber(value, 0);
const isUseOutcomeAnswer: CanonicalAnswerValidator = (value) =>
  oneOf(value, ["used", "not_used", "unsure"]);
const RELAPSE_FIRST_TRIGGER_IDS = new Set([
  "internal-emotion",
  "external-event",
  "specific-thought",
  "physical-discomfort",
  "social-pressure",
  "craving-out-of-nowhere",
  "memory-or-flashback",
  "seeing-or-smelling-a-cue",
  RELAPSE_NO_CLEAR_TRIGGER_ID,
]);
const BOREDOM_CONVERT_IDS = new Set([
  "yes-this-feels-like-restlessness",
  "maybe-a-craving",
  "maybe-anxiety",
  "maybe-loneliness",
  "maybe-exhaustion",
  BOREDOM_CLASSIFICATION_NOT_SURE_ID,
]);

const CRAVING_V3_ANSWERS: CanonicalAnswerSchema = {
  registrationType: (value) => value === "craving",
  onsetType: isStableIdAnswer,
  onsetOther: isNullableStringAnswer,
  intensity: isNullableScoreAnswer,
  confidenceBefore: isNullableScoreAnswer,
  situations: isStableIdArrayAnswer,
  situationOther: isNullableStringAnswer,
  physicalSensations: isNullableStableIdArrayAnswer,
  buildupDuration: isStableIdAnswer,
  location: isNullableStableIdAnswer,
  emotions: isNullableStableIdArrayAnswer,
  emotionOther: isNullableStringAnswer,
  thoughts: isNullableStableIdArrayAnswer,
  thoughtOther: isNullableStringAnswer,
  targets: isNullableStableIdArrayAnswer,
  chosenAction: isStableIdAnswer,
  actionAttempted: isNullableBooleanAnswer,
  useOutcome: isUseOutcomeAnswer,
  cravingOutcome: isOutcomeAnswer,
  intensityAfter: isNullableScoreAnswer,
};

const TREK_V3_ANSWERS: CanonicalAnswerSchema = {
  registrationType: (value) => value === "trek",
  trekTypes: isStableIdArrayAnswer,
  intensity: isNullableScoreAnswer,
  confidenceBefore: isNullableScoreAnswer,
  planningStage: isStableIdAnswer,
  location: isNullableStableIdAnswer,
  locationOther: isNullableStringAnswer,
  triggers: isStableIdArrayAnswer,
  triggerNote: isNullableStringAnswer,
  emotions: isNullableStableIdArrayAnswer,
  emotionOther: isNullableStringAnswer,
  physicalSensations: isNullableStableIdArrayAnswer,
  thoughts: isNullableStableIdArrayAnswer,
  thoughtFreeText: isNullableStringAnswer,
  needs: isStableIdArrayAnswer,
  needOther: isNullableStringAnswer,
  targets: isNullableStableIdArrayAnswer,
  chosenAction: isStableIdAnswer,
  actionAttempted: isNullableBooleanAnswer,
  confidenceAfter: isNullableScoreAnswer,
  useOutcome: isUseOutcomeAnswer,
};

const ANXIETY_V3_ANSWERS: CanonicalAnswerSchema = {
  anxietyTypes: isStableIdArrayAnswer,
  intensity: isNullableScoreAnswer,
  bodyLocations: isStableIdArrayAnswer,
  bodyPrediction: isNullableStringAnswer,
  urgencyHigh: (value) => typeof value === "boolean",
  context: isNullableStableIdAnswer,
  triggers: isNullableStableIdArrayAnswer,
  reassuranceSeeking: isNullableStableIdArrayAnswer,
  linkedStates: isNullableStableIdArrayAnswer,
  reaction: isStableIdAnswer,
  note: isNullableStringAnswer,
  outcomeAfter: isOutcomeAnswer,
};

const BOREDOM_V3_ANSWERS: CanonicalAnswerSchema = {
  restlessnessTypes: isStableIdArrayAnswer,
  intensity: isNullableScoreAnswer,
  stimulationNeeds: isStableIdArrayAnswer,
  convertCheck: (value) => typeof value === "string" && BOREDOM_CONVERT_IDS.has(value),
  situation: isStableIdAnswer,
  situationOther: isNullableStringAnswer,
  urge: isNullableStableIdAnswer,
  urgeOther: isNullableStringAnswer,
  rescueMenu: isNullableStableIdArrayAnswer,
  action: isNullableStableIdAnswer,
  delayDuration: isDelayDurationAnswer,
  note: isNullableStringAnswer,
  outcomeAfter: isOutcomeAnswer,
};

const RELAPSE_V3_ANSWERS: CanonicalAnswerSchema = {
  acuteRisks: (value) => value === null || isValidAcuteRiskSelectionArray(value),
  label: (value) => oneOf(value, [null, "lapse", "setback", "return-to-use", "relapse", "no-label"]),
  when: (value) => oneOf(value, [null, "just-now", "today", "yesterday", "few-days"]),
  episodeDuration: (value) => oneOf(value, [null, "single-moment", "few-hours", "whole-day", "multiple-days"]),
  substances: isNullableStableIdArrayAnswer,
  primarySubstance: (value) => value === null,
  amountCategory: (value) => oneOf(value, [null, "small", "moderate", "a-lot", "multiple-times", "binge", "prefer-not"]),
  firstTriggerType: (value) => value === null
    || (typeof value === "string" && RELAPSE_FIRST_TRIGGER_IDS.has(value)),
  firstTriggerText: isNullableStringAnswer,
  preUseFactors: isNullableStableIdArrayAnswer,
  leadUpContext: isNullableStringAnswer,
  missedWarnings: isNullableStableIdArrayAnswer,
  preUseThoughts: isNullableStableIdArrayAnswer,
  preUseThoughtFreeText: isNullableStringAnswer,
  couldHaveHelped: isNullableStableIdArrayAnswer,
  couldHaveHelpedEarly: isNullableStableIdArrayAnswer,
  couldHaveHelpedMiddle: isNullableStableIdArrayAnswer,
  couldHaveHelpedLast: isNullableStableIdArrayAnswer,
  supportContact: isNullableStableIdAnswer,
  supportContactOther: isNullableStringAnswer,
  nextStep: isNullableStableIdAnswer,
  nextStepOther: isNullableStringAnswer,
  note: isNullableStringAnswer,
  emotionAfter: isNullableScoreAnswer,
  whatNeeded: isNullableStableIdAnswer,
  repairActions: isNullableStableIdArrayAnswer,
};

const CRAVING_TREK_OPTIONAL_V3_ANSWERS: CanonicalAnswerSchema = {
  // Notes are added only after the person edits the saved History entry, so
  // they are allowed but not required on the initial tracker write.
  note: isNullableStringAnswer,
  quickRegistrationId: (value) => value === null
    || (typeof value === "string" && value.trim().length > 0 && value.length <= 200),
};

const QUICK_LINK_OPTIONAL_V3_ANSWER: CanonicalAnswerSchema = {
  quickRegistrationId: CRAVING_TREK_OPTIONAL_V3_ANSWERS.quickRegistrationId,
};

function validateV3CanonicalAnswers(
  record: UnknownRecord,
  flow: "Craving" | "Trek" | "Anxiety" | "Boredom" | "Relapse",
  schema: CanonicalAnswerSchema,
  optionalSchema: CanonicalAnswerSchema = {},
): string | null {
  if (record.dataVersion !== 3) return null;
  if (!isRecord(record.answers)) {
    return `dataVersion 3 ${flow} requires a canonical answers object`;
  }

  for (const [key, validator] of Object.entries(schema)) {
    if (!Object.prototype.hasOwnProperty.call(record.answers, key)) {
      return `dataVersion 3 ${flow} requires canonical answers.${key}`;
    }
    if (!validator(record.answers[key])) {
      return `dataVersion 3 ${flow} has an invalid canonical answers.${key}`;
    }
  }

  for (const [key, validator] of Object.entries(optionalSchema)) {
    if (Object.prototype.hasOwnProperty.call(record.answers, key) && !validator(record.answers[key])) {
      return `dataVersion 3 ${flow} has an invalid canonical answers.${key}`;
    }
  }

  const unexpected = Object.keys(record.answers).find(
    (key) => !(key in schema) && !(key in optionalSchema),
  );
  return unexpected
    ? `dataVersion 3 ${flow} has an unsupported canonical answers.${unexpected}`
    : null;
}

function validateJournal(record: UnknownRecord): ValidationResult<JournalEntry> {
  if (typeof record.id !== "string" || record.id.trim() === "") return failure("id must be a non-empty string");
  if (!isFiniteTimestamp(record.timestamp)) return failure("timestamp must be a supported non-negative date timestamp");
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
  if (record.dataVersion === 3) {
    if (!oneOf(record.cravingType, ["active", "passive"])) {
      return failure("dataVersion 3 Craving requires a cravingType classification");
    }
    if (record.primarySubstance !== "") {
      return failure("dataVersion 3 Craving/Trek requires an empty primarySubstance compatibility field");
    }
    const isTrek = record.cravingType === "active";
    if (isTrek && record.needType !== undefined && record.needType !== "") {
      return failure("dataVersion 3 Trek requires an empty needType compatibility field");
    }
    const answerError = validateV3CanonicalAnswers(
      record,
      isTrek ? "Trek" : "Craving",
      isTrek ? TREK_V3_ANSWERS : CRAVING_V3_ANSWERS,
      CRAVING_TREK_OPTIONAL_V3_ANSWERS,
    );
    if (answerError) return failure(answerError);
    if (record.status === "completed" && typeof (record.answers as UnknownRecord).actionAttempted !== "boolean") {
      return failure(`completed dataVersion 3 ${isTrek ? "Trek" : "Craving"} requires a boolean answers.actionAttempted`);
    }
    const answers = record.answers as UnknownRecord;
    const hasCanonicalNote = Object.prototype.hasOwnProperty.call(answers, "note");
    const canonicalNote = hasCanonicalNote && typeof answers.note === "string"
      ? answers.note
      : "";
    if (record.note !== canonicalNote) {
      return failure(`dataVersion 3 ${isTrek ? "Trek" : "Craving"} canonical note conflicts with note`);
    }
    if (isTrek) {
      const trekTypes = answers.trekTypes as string[];
      const triggers = answers.triggers as string[];
      const needs = answers.needs as string[];
      if (trekTypes.length > 2) {
        return failure("dataVersion 3 Trek answers.trekTypes exceeds the maximum of 2 selections");
      }
      if (Array.isArray(answers.emotions) && answers.emotions.length > 3) {
        return failure("dataVersion 3 Trek answers.emotions exceeds the maximum of 3 selections");
      }
      if (Array.isArray(answers.physicalSensations) && answers.physicalSensations.length > 3) {
        return failure("dataVersion 3 Trek answers.physicalSensations exceeds the maximum of 3 selections");
      }
      if (Array.isArray(answers.thoughts) && answers.thoughts.length > 2) {
        return failure("dataVersion 3 Trek answers.thoughts exceeds the maximum of 2 selections");
      }
      if (trekTypes.length > 1 && trekTypes.includes("approach-not-sure")) {
        return failure("dataVersion 3 Trek cannot combine an unknown form with a specific form");
      }
      if (triggers.length > 1 && triggers.includes("no-clear-trigger-not-sure")) {
        return failure("dataVersion 3 Trek cannot combine no-clear trigger with a specific trigger");
      }
      if (needs.length > 1 && needs.includes("not-sure")) {
        return failure("dataVersion 3 Trek cannot combine an unknown need with a specific need");
      }
      if ((answers.location === "other") !== (answers.locationOther !== null)) {
        return failure("dataVersion 3 Trek locationOther conflicts with location");
      }
      if (triggers.includes("other") !== (answers.triggerNote !== null)) {
        return failure("dataVersion 3 Trek triggerNote conflicts with triggers");
      }
      if (needs.includes("other") !== (answers.needOther !== null)) {
        return failure("dataVersion 3 Trek needOther conflicts with needs");
      }
      if (answers.actionAttempted !== true && answers.confidenceAfter !== null) {
        return failure("dataVersion 3 Trek confidenceAfter requires an attempted action");
      }
    } else {
      const situations = answers.situations as string[];
      if (Array.isArray(answers.physicalSensations) && answers.physicalSensations.length > 3) {
        return failure("dataVersion 3 Craving answers.physicalSensations exceeds the maximum of 3 selections");
      }
      if (Array.isArray(answers.emotions) && answers.emotions.length > 3) {
        return failure("dataVersion 3 Craving answers.emotions exceeds the maximum of 3 selections");
      }
      if (Array.isArray(answers.thoughts) && answers.thoughts.length > 2) {
        return failure("dataVersion 3 Craving answers.thoughts exceeds the maximum of 2 selections");
      }
      if (situations.length > 1 && situations.includes("no-clear-situation-not-sure")) {
        return failure("dataVersion 3 Craving cannot combine no-clear situation with a specific situation");
      }
      if ((answers.onsetType === "other") !== (answers.onsetOther !== null)) {
        return failure("dataVersion 3 Craving onsetOther conflicts with onsetType");
      }
      if (situations.includes("other") !== (answers.situationOther !== null)) {
        return failure("dataVersion 3 Craving situationOther conflicts with situations");
      }
      if (
        (answers.cravingOutcome === null || answers.cravingOutcome === "unknown")
        && answers.intensityAfter !== null
      ) {
        return failure("dataVersion 3 Craving intensityAfter requires a measured outcome");
      }
    }
  }
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
    value: migrateCompletedTrekRecord(
      migrateRegistrationRecordMetadata(record as unknown as CravingLog),
    ),
  };
}

function validateRelapse(record: UnknownRecord): ValidationResult<RelapseLog> {
  const metaError = validateRegistrationMetadata(record);
  if (metaError) return failure(metaError);
  if (!oneOf(record.status, ["draft", "completed"])) return failure("status is invalid");
  if (!oneOf(record.label, ["lapse", "setback", "return-to-use", "relapse", "no-label"])) return failure("label is invalid");
  if (!oneOf(record.episodeDuration, ["single-moment", "few-hours", "whole-day", "multiple-days", "unanswered"])) return failure("episodeDuration is invalid");
  if (!oneOf(record.amountCategory, ["small", "moderate", "a-lot", "multiple-times", "binge", "prefer-not", "unanswered"])) return failure("amountCategory is invalid");
  const hasCanonicalRisks = Object.prototype.hasOwnProperty.call(record, "acuteRisks");
  if (hasCanonicalRisks && !isValidAcuteRiskSelectionArray(record.acuteRisks)) {
    return failure("acuteRisks must contain unique valid values and 'none' must be exclusive");
  }
  const answerEnvelope = isRecord(record.answers) ? record.answers : undefined;
  const hasCanonicalAnswerRisks = !!answerEnvelope
    && Object.prototype.hasOwnProperty.call(answerEnvelope, "acuteRisks");
  const hasAnyCanonicalRisks = hasCanonicalRisks || hasCanonicalAnswerRisks;
  if (record.dataVersion !== undefined && Number(record.dataVersion) >= 3) {
    if (!hasCanonicalRisks || !hasCanonicalAnswerRisks) {
      return failure("dataVersion 3 Relapse requires canonical acuteRisks fields");
    }
    if (
      record.status === "completed"
      && Array.isArray(record.acuteRisks)
      && record.acuteRisks.length === 0
    ) {
      return failure("completed dataVersion 3 Relapse requires an answered safety question");
    }
  }
  if (!hasAnyCanonicalRisks && !isAcuteRisk(record.acuteRisk)) {
    return failure("acuteRisk is required when acuteRisks is absent");
  }
  if (
    !hasAnyCanonicalRisks
    && answerEnvelope
    && isAcuteRisk(record.acuteRisk)
    && isAcuteRisk(answerEnvelope.acuteRisk)
    && record.acuteRisk !== answerEnvelope.acuteRisk
  ) {
    return failure("acuteRisk conflicts with answers.acuteRisk");
  }
  if (isRecord(record.answers)) {
    const answerRisks = record.answers.acuteRisks;
    if (
      answerRisks !== undefined
      && answerRisks !== null
      && !isValidAcuteRiskSelectionArray(answerRisks)
    ) {
      return failure("answers.acuteRisks must contain unique valid values and 'none' must be exclusive");
    }
    if (
      !hasAnyCanonicalRisks
      && record.answers.acuteRisk !== undefined
      && !isAcuteRisk(record.answers.acuteRisk)
    ) {
      return failure("answers.acuteRisk is invalid");
    }
    if (
      hasCanonicalRisks
      && Object.prototype.hasOwnProperty.call(record.answers, "acuteRisks")
    ) {
      const canonicalAnswers = answerRisks === null ? [] : answerRisks;
      if (
        !Array.isArray(canonicalAnswers)
        || !sameStringSet(record.acuteRisks as string[], canonicalAnswers as string[])
      ) {
        return failure("acuteRisks conflicts with answers.acuteRisks");
      }
    }
  }
  const relapseAnswerError = validateV3CanonicalAnswers(
    record,
    "Relapse",
    RELAPSE_V3_ANSWERS,
    QUICK_LINK_OPTIONAL_V3_ANSWER,
  );
  if (relapseAnswerError) return failure(relapseAnswerError);
  if (record.dataVersion === 3 && isRecord(record.answers)) {
    if (!isFiniteNumber(record.occurredAt, 0) || !isFiniteNumber(record.completedAt, 0)) {
      return failure("dataVersion 3 Relapse requires exact occurredAt and completedAt metadata");
    }
    if (record.timestamp !== record.occurredAt) {
      return failure("dataVersion 3 Relapse requires timestamp to equal occurredAt");
    }
    if (record.occurredAt > record.completedAt) {
      return failure("dataVersion 3 Relapse occurrence cannot be after completion");
    }
    const expectedWhen = relapseWhenForOccurrence(record.occurredAt, record.completedAt);
    if (record.when !== expectedWhen || record.answers.when !== expectedWhen) {
      return failure("dataVersion 3 Relapse canonical answers.when conflicts with occurrence metadata");
    }
    if (record.preUseThoughtPreset !== "") {
      return failure("dataVersion 3 Relapse requires an empty preUseThoughtPreset compatibility field");
    }
    const canonicalNote = typeof record.answers.note === "string" ? record.answers.note : "";
    if (record.note !== canonicalNote) {
      return failure("dataVersion 3 Relapse canonical note conflicts with note");
    }
    if (
      (record.answers.firstTriggerType !== null && record.answers.firstTriggerText !== null)
      || (record.answers.supportContact !== null && record.answers.supportContactOther !== null)
      || (record.answers.nextStep !== null && record.answers.nextStepOther !== null)
    ) {
      return failure("dataVersion 3 Relapse has conflicting canonical canned and custom answers");
    }
    if (record.status === "completed") {
      const hasSupportChoice = record.answers.supportContact !== null;
      const hasCustomSupport = record.answers.supportContactOther !== null;
      if (hasSupportChoice === hasCustomSupport) {
        return failure("completed dataVersion 3 Relapse requires exactly one support-contact answer");
      }
      const hasNextStepChoice = record.answers.nextStep !== null;
      const hasCustomNextStep = record.answers.nextStepOther !== null;
      if (hasNextStepChoice === hasCustomNextStep) {
        return failure("completed dataVersion 3 Relapse requires exactly one next-step answer");
      }
    }
    const phaseHelp = [
      record.answers.couldHaveHelpedEarly,
      record.answers.couldHaveHelpedMiddle,
      record.answers.couldHaveHelpedLast,
    ].flatMap((value) => Array.isArray(value) ? value : []);
    const expectedHelp = [...new Set(phaseHelp)];
    const generalHelp = Array.isArray(record.answers.couldHaveHelped)
      ? record.answers.couldHaveHelped
      : [];
    if (!sameStringSet(expectedHelp, generalHelp)) {
      return failure("dataVersion 3 Relapse canonical couldHaveHelped union conflicts with phase answers");
    }
  }
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
  if (record.dataVersion === 3 && record.primarySubstance !== "") {
    return failure("dataVersion 3 Relapse requires an empty primarySubstance compatibility field");
  }
  if (
    record.amountCategory !== "unanswered"
    && (record.substances as string[]).length === 0
    && (record.dataVersion === 3 || record.primarySubstance === "")
  ) {
    return failure("amountCategory requires at least one substance or behavior target");
  }
  if (record.dataVersion === 3 && isRecord(record.answers)) {
    const answerAmount = record.answers.amountCategory;
    const answerTargets = record.answers.substances;
    if (
      answerAmount !== null
      && answerAmount !== "unanswered"
      && (!Array.isArray(answerTargets) || answerTargets.length === 0)
    ) {
      return failure("canonical answers.amountCategory requires at least one canonical substance or behavior target");
    }
  }
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
    value: normalizeRelapseTimingRecord(
      migrateRelapseFollowUpAnswers(
        migrateRelapseV2DefaultAnswers(
          migrateRegistrationRecordMetadata(
            migrateRelapseSafetyRecord(record) as unknown as RelapseLog,
          ),
        ),
      ),
    ),
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
  if (
    record.dataVersion === 3
    && ((record.trigger !== "") || (record.linkedState !== undefined && record.linkedState !== ""))
  ) {
    return failure("dataVersion 3 Anxiety requires empty trigger and linkedState compatibility fields");
  }
  const anxietyAnswerError = validateV3CanonicalAnswers(
    record,
    "Anxiety",
    ANXIETY_V3_ANSWERS,
    QUICK_LINK_OPTIONAL_V3_ANSWER,
  );
  if (anxietyAnswerError) return failure(anxietyAnswerError);
  if (record.dataVersion === 3 && isRecord(record.answers)) {
    const canonicalNote = typeof record.answers.note === "string" ? record.answers.note : "";
    if (record.note !== canonicalNote) {
      return failure("dataVersion 3 Anxiety canonical note conflicts with note");
    }
    const bodyLocations = record.answers.bodyLocations as string[];
    const anxietyTypes = record.answers.anxietyTypes as string[];
    if (anxietyTypes.length > 2) {
      return failure("dataVersion 3 Anxiety answers.anxietyTypes exceeds the maximum of 2 selections");
    }
    const linkedStates = record.answers.linkedStates;
    if (
      bodyLocations.length > 1
      && (
        bodyLocations.includes("not-in-one-place-not-sure")
        || bodyLocations.includes("whole-body")
      )
    ) {
      return failure("dataVersion 3 Anxiety cannot combine a neutral body answer with a specific answer");
    }
    if (
      Array.isArray(linkedStates)
      && linkedStates.length > 1
      && linkedStates.includes("not-connected-to-anything-specific")
    ) {
      return failure("dataVersion 3 Anxiety cannot combine a neutral linked-state answer with a specific answer");
    }
  }
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
  if (
    record.dataVersion === 3
    && record.stimulationNeed !== undefined
    && record.stimulationNeed !== ""
  ) {
    return failure("dataVersion 3 Boredom requires an empty stimulationNeed compatibility field");
  }
  const boredomAnswerError = validateV3CanonicalAnswers(
    record,
    "Boredom",
    BOREDOM_V3_ANSWERS,
    QUICK_LINK_OPTIONAL_V3_ANSWER,
  );
  if (boredomAnswerError) return failure(boredomAnswerError);
  if (record.dataVersion === 3 && isRecord(record.answers)) {
    const canonicalNote = typeof record.answers.note === "string" ? record.answers.note : "";
    if (record.note !== canonicalNote) {
      return failure("dataVersion 3 Boredom canonical note conflicts with note");
    }
    const needs = record.answers.stimulationNeeds as string[];
    const restlessnessTypes = record.answers.restlessnessTypes as string[];
    if (restlessnessTypes.length > 2) {
      return failure("dataVersion 3 Boredom answers.restlessnessTypes exceeds the maximum of 2 selections");
    }
    if (needs.length > 1 && needs.includes("not-sure")) {
      return failure("dataVersion 3 Boredom cannot combine an unknown need with a specific need");
    }
    if ((record.answers.situation === "other") !== (record.answers.situationOther !== null)) {
      return failure("dataVersion 3 Boredom situationOther conflicts with situation");
    }
    // The custom description is optional even after "Other stimulation" is
    // selected. It may only carry text on that visible branch; null is valid
    // both there and for every non-custom urge.
    if (record.answers.urge !== "other-stimulation" && record.answers.urgeOther !== null) {
      return failure("dataVersion 3 Boredom urgeOther requires urge other-stimulation");
    }
    const isTrackerConversion = oneOf(record.answers.convertCheck, ["maybe-a-craving", "maybe-anxiety"]);
    if (isTrackerConversion) {
      if (
        record.answers.rescueMenu !== null
        || record.answers.action !== null
        || record.answers.note !== null
      ) {
        return failure("dataVersion 3 Boredom conversion cannot retain skipped action answers");
      }
    } else if (record.answers.action === null) {
      return failure("dataVersion 3 Boredom requires an action outside tracker conversion");
    }
  }
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
  if (value.version !== 1 && value.version !== BACKUP_FORMAT_VERSION) {
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
  if (value.version === 2 && !Array.isArray(value.featureRecords)) {
    return failure("featureRecords must be an array in a version 2 backup.");
  }
  if (value.featureRecords !== undefined && !Array.isArray(value.featureRecords)) {
    return failure("featureRecords must be an array when present.");
  }
  return { ok: true, value };
}
