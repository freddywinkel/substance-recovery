export const CURRENT_REGISTRATION_DATA_VERSION = 2;

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
