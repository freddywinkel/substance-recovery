/** Stable ID for an explicit "not sure" answer to Boredom classification. */
export const BOREDOM_CLASSIFICATION_NOT_SURE_ID = "classification-not-sure";

const LEGACY_CLASSIFICATION_NOT_SURE_ID = "not-sure";
const LEGACY_CLASSIFICATION_NOT_SURE_LABEL = "Not sure";

/**
 * Active drafts store tracker option values, not completed-answer envelopes.
 * Normalize both shapes written before the classification ID was separated.
 * This is deliberately field-specific so the Boredom need ID stays `not-sure`.
 */
export function normalizeActiveBoredomClassification(value: string): string {
  return value === LEGACY_CLASSIFICATION_NOT_SURE_ID
    || value === LEGACY_CLASSIFICATION_NOT_SURE_LABEL
    ? BOREDOM_CLASSIFICATION_NOT_SURE_ID
    : value;
}

export function activeBoredomClassificationNeedsMigration(value: unknown): boolean {
  return value === LEGACY_CLASSIFICATION_NOT_SURE_ID
    || value === LEGACY_CLASSIFICATION_NOT_SURE_LABEL;
}

/**
 * Completed records before registration-v3 used `not-sure` for this field.
 * Version scope prevents the same ID in another/current question from being
 * globally reinterpreted.
 */
export function boredomClassificationIdForRead(
  value: string | null,
  dataVersion: number | undefined,
): string | null {
  return (dataVersion == null || dataVersion < 3)
    && value === LEGACY_CLASSIFICATION_NOT_SURE_ID
    ? BOREDOM_CLASSIFICATION_NOT_SURE_ID
    : value;
}
