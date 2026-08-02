export const RELAPSE_WHEN_VALUES = [
  "just-now",
  "today",
  "yesterday",
  "few-days",
] as const;

export type RelapseWhen = (typeof RELAPSE_WHEN_VALUES)[number];

function timestamp(value: string | number | Date): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  if (value === "") return Number.NaN;
  return new Date(value).getTime();
}

/**
 * Derive the broad compatibility bucket from the exact occurrence and a
 * reference time. The bucket is never an independent answer: exact occurrence
 * is authoritative and an empty/invalid occurrence remains unanswered.
 */
export function relapseWhenForOccurrence(
  occurrence: string | number | Date,
  reference: string | number | Date = new Date(),
): RelapseWhen | "" {
  const occurrenceTime = timestamp(occurrence);
  const referenceTime = timestamp(reference);
  if (!Number.isFinite(occurrenceTime) || !Number.isFinite(referenceTime)) return "";

  const elapsed = referenceTime - occurrenceTime;
  if (elapsed >= 0 && elapsed <= 60 * 60 * 1000) return "just-now";

  const occurrenceDate = new Date(occurrenceTime);
  const referenceDate = new Date(referenceTime);
  const occurrenceDay = new Date(
    occurrenceDate.getFullYear(),
    occurrenceDate.getMonth(),
    occurrenceDate.getDate(),
  ).getTime();
  const today = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  ).getTime();
  const yesterday = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate() - 1,
  ).getTime();
  if (occurrenceDay === today) return "today";
  if (occurrenceDay === yesterday) return "yesterday";
  return "few-days";
}

type RelapseTimingRecord = {
  timestamp: number;
  occurredAt?: number;
  completedAt?: number;
  dataVersion?: number;
  when: string;
};

/**
 * Normalize a stored record without mutating it. `occurredAt` (or the legacy
 * timestamp) is the exact event time; `completedAt` is the reference used when
 * the relative bucket was recorded. A stale supplied `when` value never wins.
 */
export function normalizeRelapseTimingRecord<T extends RelapseTimingRecord>(record: T): T {
  const hasStoredOccurrence = Number.isFinite(record.occurredAt);
  const currentExactTimeSemantics = typeof record.dataVersion === "number"
    && record.dataVersion >= 3;
  const independentlyStoredLegacyOccurrence = hasStoredOccurrence
    && Number(record.occurredAt) !== record.timestamp;

  // Before v3, `timestamp` could be the save/index time and the relative `when`
  // answer could be the only occurrence evidence. The v7 metadata migration
  // copied that timestamp into occurredAt, which does not make it exact event
  // evidence. Deployed v2 also prefilled its exact-time control, so it is not
  // interaction evidence by itself. Preserve the legacy bucket unless an
  // independently different occurredAt existed; deriving here would rewrite
  // e.g. yesterday to just-now.
  if (!currentExactTimeSemantics && !independentlyStoredLegacyOccurrence) {
    return { ...record };
  }

  const occurrence = Number(record.occurredAt);
  const reference = Number.isFinite(record.completedAt)
    ? Number(record.completedAt)
    : record.timestamp;
  return {
    ...record,
    when: relapseWhenForOccurrence(occurrence, reference),
  };
}
