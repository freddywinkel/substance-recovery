import { isKnownRecoveryTarget } from "./recoveryTargets";

export const USE_PERIOD_FREQUENCIES = ["daily", "some-days", "unknown"] as const;
export type UsePeriodFrequency = (typeof USE_PERIOD_FREQUENCIES)[number];

/** Boundaries are the first and last reported use days, never entry dates. */
export interface UsePeriodRecord {
  id: string;
  recordType: "use-period";
  timestamp: number;
  updatedAt: number;
  target: string;
  startDate: string;
  endDate: string;
  frequency: UsePeriodFrequency;
  note: string;
}

export interface UsePeriodDraft {
  id: string;
  timestamp: number;
  sourceUpdatedAt: number | null;
  target: string;
  startDate: string;
  endDate: string;
  frequency: UsePeriodFrequency;
  note: string;
}

const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const validTime = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value)
  && value >= 0 && value <= 8_640_000_000_000_000;
const validId = (value: unknown): value is string => {
  if (typeof value !== "string" || !value.trim() || value.length > 200 || value === "new") return false;
  // Every editable identity needs an encodable draft key; reject lone surrogates.
  try { encodeURIComponent(value); return true; } catch { return false; }
};

/** Strict calendar dates: Date's rollover must not turn February 30 into March. */
export function isUsePeriodDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000-")) return false;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function localDateString(timestamp = Date.now()): string {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime()) || date.getFullYear() < 1 || date.getFullYear() > 9999) {
    throw new Error("Unsupported local calendar date.");
  }
  return `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const validContent = (value: Record<string, unknown>): boolean =>
  typeof value.target === "string" && isKnownRecoveryTarget(value.target)
  && isUsePeriodDate(value.startDate) && isUsePeriodDate(value.endDate)
  && value.startDate <= value.endDate
  && USE_PERIOD_FREQUENCIES.includes(value.frequency as UsePeriodFrequency)
  && typeof value.note === "string" && value.note.length <= 4000;

/** Backups remain clock independent; current-date checks belong to committing. */
export function isUsePeriodRecord(value: unknown): value is UsePeriodRecord {
  return object(value)
    && Object.keys(value).every(key => ["id", "recordType", "timestamp", "updatedAt", "target", "startDate", "endDate", "frequency", "note"].includes(key))
    && validId(value.id) && value.recordType === "use-period"
    && validTime(value.timestamp) && validTime(value.updatedAt)
    && validContent(value);
}

export function createUsePeriodDraft(record?: UsePeriodRecord, target?: string): UsePeriodDraft {
  return {
    id: record?.id ?? crypto.randomUUID(),
    timestamp: record?.timestamp ?? Date.now(),
    sourceUpdatedAt: record?.updatedAt ?? null,
    target: record?.target ?? (target && isKnownRecoveryTarget(target) ? target : ""),
    startDate: record?.startDate ?? "",
    endDate: record?.endDate ?? "",
    frequency: record?.frequency ?? "unknown",
    note: record?.note ?? "",
  };
}

/** Incomplete and temporarily reversed dates must survive an interrupted edit. */
export function isUsePeriodDraft(value: unknown): value is UsePeriodDraft {
  return object(value)
    && Object.keys(value).every(key => ["id", "timestamp", "sourceUpdatedAt", "target", "startDate", "endDate", "frequency", "note"].includes(key))
    && validId(value.id) && validTime(value.timestamp)
    && (value.sourceUpdatedAt === null || validTime(value.sourceUpdatedAt))
    && typeof value.target === "string" && (value.target === "" || isKnownRecoveryTarget(value.target))
    && (value.startDate === "" || isUsePeriodDate(value.startDate))
    && (value.endDate === "" || isUsePeriodDate(value.endDate))
    && USE_PERIOD_FREQUENCIES.includes(value.frequency as UsePeriodFrequency)
    && typeof value.note === "string" && value.note.length <= 4000;
}

export function usePeriodsOverlap(left: UsePeriodRecord, right: UsePeriodRecord): boolean {
  return left.id !== right.id && left.target === right.target
    && left.startDate <= right.endDate && right.startDate <= left.endDate;
}

/** Sort once instead of enumerating dates or comparing every pair in large backups. */
export function overlappingUsePeriod(records: readonly UsePeriodRecord[]): UsePeriodRecord | null {
  const sorted = records.slice().sort((a, b) => a.target.localeCompare(b.target) || a.startDate.localeCompare(b.startDate));
  let previous: UsePeriodRecord | undefined;
  for (const record of sorted) {
    if (previous && usePeriodsOverlap(previous, record)) return record;
    previous = record;
  }
  return null;
}
