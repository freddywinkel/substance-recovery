/** Stable v3 ID for an explicit Relapse answer that no clear trigger was known. */
export const RELAPSE_NO_CLEAR_TRIGGER_ID = "no-clear-trigger-not-sure";

const LEGACY_RELAPSE_NO_CLEAR_TRIGGER_ID = "not-sure";

/**
 * Relapse v1/v2 used the generic `not-sure` ID for the first-trigger question.
 * That ID now belongs to a different question, so migrate it only when its
 * historical version proves that it carried the Relapse trigger meaning.
 */
export function relapseFirstTriggerIdForRead(
  value: string | null,
  sourceVersion: number | undefined,
): string | null {
  return (sourceVersion == null || sourceVersion < 3)
    && value === LEGACY_RELAPSE_NO_CLEAR_TRIGGER_ID
    ? RELAPSE_NO_CLEAR_TRIGGER_ID
    : value;
}
