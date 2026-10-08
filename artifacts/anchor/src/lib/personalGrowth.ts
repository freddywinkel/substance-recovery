import type {
  CompassionNoteRecord,
  FeatureRecord,
  GrowthMomentRecord,
} from "./recoveryFeatures";

export const GROWTH_CATEGORIES = [
  "pleasure",
  "connection",
  "agency",
  "self-care",
  "growth",
] as const;
export type GrowthCategory = (typeof GROWTH_CATEGORIES)[number];
export const COMPASSION_NOTE_ID = "personal-compassion-note" as const;
export type PersonalGrowthRecord = GrowthMomentRecord | CompassionNoteRecord;

export function growthMoments(
  records: readonly FeatureRecord[],
): GrowthMomentRecord[] {
  return records
    .filter(
      (record): record is GrowthMomentRecord =>
        record.recordType === "growth-moment",
    )
    .sort((a, b) => b.timestamp - a.timestamp || a.id.localeCompare(b.id));
}

/** Only an explicit favourite can be resurfaced; no mood/use inference. */
export function growthReminder(
  records: readonly FeatureRecord[],
): GrowthMomentRecord | null {
  return growthMoments(records).find((record) => record.favourite) ?? null;
}

export function personalCompassionNote(
  records: readonly FeatureRecord[],
): CompassionNoteRecord | null {
  return (
    records.find(
      (record): record is CompassionNoteRecord =>
        record.recordType === "compassion-note",
    ) ?? null
  );
}

export interface GrowthMomentDraft {
  id: string;
  timestamp: number;
  sourceUpdatedAt: number | null;
  note: string;
  category: GrowthCategory | null;
  favourite: boolean;
}

export function createGrowthMomentDraft(
  record?: GrowthMomentRecord,
): GrowthMomentDraft {
  return {
    id: record?.id ?? crypto.randomUUID(),
    timestamp: record?.timestamp ?? Date.now(),
    sourceUpdatedAt: record?.updatedAt ?? null,
    note: record?.note ?? "",
    category: record?.category ?? null,
    favourite: record?.favourite ?? false,
  };
}

const validTime = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 8_640_000_000_000_000;
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

export function isGrowthMomentDraft(
  value: unknown,
): value is GrowthMomentDraft {
  return (
    object(value) &&
    Object.keys(value).every((key) =>
      [
        "id",
        "timestamp",
        "sourceUpdatedAt",
        "note",
        "category",
        "favourite",
      ].includes(key),
    ) &&
    typeof value.id === "string" &&
    !!value.id.trim() &&
    value.id.length <= 200 &&
    value.id !== "new" &&
    value.id !== COMPASSION_NOTE_ID &&
    validTime(value.timestamp) &&
    (value.sourceUpdatedAt === null || validTime(value.sourceUpdatedAt)) &&
    typeof value.note === "string" &&
    value.note.length <= 2000 &&
    (value.category === null ||
      GROWTH_CATEGORIES.includes(value.category as GrowthCategory)) &&
    typeof value.favourite === "boolean"
  );
}

export interface CompassionDraft {
  text: string;
  sourceUpdatedAt: number | null;
  timestamp: number;
}
export function createCompassionDraft(
  record: CompassionNoteRecord | null,
): CompassionDraft {
  return {
    text: record?.text ?? "",
    sourceUpdatedAt: record?.updatedAt ?? null,
    timestamp: record?.timestamp ?? Date.now(),
  };
}
export function isCompassionDraft(value: unknown): value is CompassionDraft {
  return (
    object(value) &&
    Object.keys(value).every((key) =>
      ["text", "sourceUpdatedAt", "timestamp"].includes(key),
    ) &&
    typeof value.text === "string" &&
    value.text.length <= 500 &&
    validTime(value.timestamp) &&
    (value.sourceUpdatedAt === null || validTime(value.sourceUpdatedAt))
  );
}
