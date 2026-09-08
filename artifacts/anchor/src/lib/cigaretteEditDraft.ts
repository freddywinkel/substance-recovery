import type { CigaretteLog } from "@/db";

export interface CigaretteEditValues {
  id: string;
  editTime: string;
  editNote: string;
  sourceTimestamp: number;
  sourceNote: string;
  sourceUpdatedAt: number | null;
}

export type CigaretteEditDraft = CigaretteEditValues | null;

export function isCigaretteEditDraft(value: unknown): value is CigaretteEditDraft {
  if (value === null) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const draft = value as Record<string, unknown>;
  const keys = ["id", "editTime", "editNote", "sourceTimestamp", "sourceNote", "sourceUpdatedAt"];
  return Object.keys(draft).length === keys.length && keys.every(key => key in draft)
    && typeof draft.id === "string" && draft.id.length > 0 && draft.id.length <= 200
    && typeof draft.editTime === "string" && draft.editTime.length <= 100
    && typeof draft.editNote === "string" && draft.editNote.length <= 100_000
    && typeof draft.sourceTimestamp === "number" && Number.isFinite(draft.sourceTimestamp) && draft.sourceTimestamp >= 0 && draft.sourceTimestamp <= 8_640_000_000_000_000
    && typeof draft.sourceNote === "string" && draft.sourceNote.length <= 100_000
    && (draft.sourceUpdatedAt === null || (typeof draft.sourceUpdatedAt === "number" && Number.isFinite(draft.sourceUpdatedAt) && draft.sourceUpdatedAt >= 0));
}

export function cigaretteDraftMatchesSource(draft: CigaretteEditValues, log: CigaretteLog): boolean {
  return draft.id === log.id && draft.sourceTimestamp === log.timestamp
    && draft.sourceNote === (log.note ?? "")
    && draft.sourceUpdatedAt === (log.updatedAt ?? null) && !log.deleted;
}
