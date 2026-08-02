/**
 * Stable, language-neutral identifiers used in versioned registration `answers`.
 *
 * Legacy fields continue to keep their original display values for backwards
 * compatibility. New analysis should prefer `answers`, whose IDs no longer expose
 * English copy as the data contract.
 */
export function toStableOptionId(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function toStableOptionIds(values: string[]): string[] {
  return values.map(toStableOptionId).filter(Boolean);
}

export function removeHiddenOtherText(selected: string | string[], text: string): string {
  const hasOther = Array.isArray(selected)
    ? selected.includes("Other")
    : selected === "Other";
  return hasOther ? text.trim() : "";
}

export function logicalTimestamp(record: {
  occurredAt?: number | null;
  timestamp: number;
}): number {
  return typeof record.occurredAt === "number" && Number.isFinite(record.occurredAt)
    ? record.occurredAt
    : record.timestamp;
}
