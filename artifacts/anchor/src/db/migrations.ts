import { toStableOptionId, toStableOptionIds } from "@/lib/registrationIds";

export const CURRENT_REGISTRATION_DATA_VERSION = 3;
export const CURRENT_REGISTRATION_CONTENT_VERSION = "registration-v3";

type CravingClassificationRecord = {
  dataVersion?: number;
  cravingType?: "active" | "passive";
  answers?: Record<string, string | string[] | number | boolean | null>;
};

type RelapseFollowUpRecord = {
  dataVersion?: number;
  answers?: Record<string, string | string[] | number | boolean | null>;
  whatNeeded?: string;
  repairActions?: string[];
  emotionAfter?: number | null;
};

/**
 * Deployed registration-v2 prefilled the Relapse label and occurrence controls.
 * `no-label` and `just-now` in that version therefore do not prove a choice.
 * Keep the legacy top-level fields/timestamps intact for ordering and
 * compatibility, but mark those two canonical answers unanswered. v3 uses
 * explicit blank states and is not rewritten.
 */
export function migrateRelapseV2DefaultAnswers<T extends RelapseFollowUpRecord>(record: T): T {
  if (record.dataVersion !== 2 || record.answers == null) return record;
  const answers = { ...record.answers };
  let changed = false;
  if (answers.label === "no-label") {
    answers.label = null;
    changed = true;
  }
  if (answers.when === "just-now") {
    answers.when = null;
    changed = true;
  }
  return changed ? { ...record, answers } : record;
}

function canonicalAnswerIsBlank(value: unknown): boolean {
  return value === undefined
    || value === null
    || value === ""
    || (Array.isArray(value) && value.length === 0);
}

/**
 * The deployed v2 Relapse flow wrote an initial canonical answers envelope,
 * then saved three optional done-screen follow-ups only at top level. A strict
 * canonical reader therefore saw the initial null and hid the later answer.
 * Backfill only blank canonical slots from meaningful top-level v2 values;
 * an existing nonblank canonical answer remains authoritative.
 */
export function migrateRelapseFollowUpAnswers<T extends RelapseFollowUpRecord>(record: T): T {
  if (
    record.dataVersion !== 2
    || record.answers == null
  ) {
    return record;
  }

  const answers = { ...record.answers };
  let changed = false;

  if (
    canonicalAnswerIsBlank(answers.whatNeeded)
    && typeof record.whatNeeded === "string"
    && record.whatNeeded.trim() !== ""
  ) {
    answers.whatNeeded = toStableOptionId(record.whatNeeded);
    changed = true;
  }

  if (
    canonicalAnswerIsBlank(answers.repairActions)
    && Array.isArray(record.repairActions)
    && record.repairActions.length > 0
  ) {
    answers.repairActions = toStableOptionIds(record.repairActions);
    changed = true;
  }

  if (
    canonicalAnswerIsBlank(answers.emotionAfter)
    && typeof record.emotionAfter === "number"
    && Number.isFinite(record.emotionAfter)
    && record.emotionAfter >= 0
    && record.emotionAfter <= 10
  ) {
    // Zero is a real answer, not an empty sentinel.
    answers.emotionAfter = record.emotionAfter;
    changed = true;
  }

  return changed ? { ...record, answers } : record;
}

/**
 * registration-v2 initially shipped before its craving/trek discriminator was
 * mirrored into `answers`. The legacy discriminator is unambiguous, so promote
 * it once without using any symptom/intensity inference.
 */
export function migrateCravingRegistrationType<
  T extends CravingClassificationRecord,
>(record: T): T {
  if (
    record.dataVersion !== 2 ||
    record.answers == null ||
    Object.prototype.hasOwnProperty.call(record.answers, "registrationType") ||
    (record.cravingType !== "active" && record.cravingType !== "passive")
  ) {
    return record;
  }
  return {
    ...record,
    answers: {
      ...record.answers,
      registrationType: record.cravingType === "active" ? "trek" : "craving",
    },
  };
}

type RegistrationMetadataRecord = {
  timestamp: number;
  occurredAt?: number;
  startedAt?: number;
  completedAt?: number;
  dataVersion?: number;
};

function finiteTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/**
 * Backfill explicit registration timing metadata without changing the legacy
 * timestamp used by existing IndexedDB indexes and application consumers.
 */
export function migrateRegistrationRecordMetadata<
  T extends RegistrationMetadataRecord,
>(record: T): T & Required<Pick<RegistrationMetadataRecord,
  "occurredAt" | "startedAt" | "completedAt" | "dataVersion"
>> {
  const legacyTimestamp = finiteTimestamp(record.timestamp)
    ? record.timestamp
    : Date.now();
  const occurredAt = finiteTimestamp(record.occurredAt)
    ? record.occurredAt
    : legacyTimestamp;
  const startedAt = finiteTimestamp(record.startedAt)
    ? record.startedAt
    : occurredAt;
  const completedAt = finiteTimestamp(record.completedAt)
    ? record.completedAt
    : legacyTimestamp;
  const dataVersion =
    typeof record.dataVersion === "number" &&
    Number.isInteger(record.dataVersion) &&
    record.dataVersion > 0
      ? record.dataVersion
      : 1;

  return {
    ...record,
    timestamp: legacyTimestamp,
    occurredAt,
    startedAt,
    completedAt,
    dataVersion,
  };
}

/**
 * Convert a legacy 1–5 journal craving value to its 0–10 equivalent.
 * Linear map: 1→2, 2→4, 3→6, 4→8, 5→10. Values outside 1–5 (including null
 * and already-0–10 values) are returned unchanged.
 */
export function migrateCravingTo0to10(value: number | null): number | null {
  if (value != null && value >= 1 && value <= 5) return value * 2;
  return value;
}
