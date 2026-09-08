import type { JournalEntry } from "@/db/schema";
export interface JournalDraft { id: string; timestamp: number; mood: JournalEntry["mood"]; craving: number | null; note: string; trigger: string; coping: string; favourite: boolean; }
export function createJournalDraft(): JournalDraft { return { id: crypto.randomUUID(), timestamp: Date.now(), mood: null, craving: null, note: "", trigger: "", coping: "", favourite: false }; }
export function isJournalDraft(value: unknown): value is JournalDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === "string" && v.id.trim() !== "" && typeof v.timestamp === "number" && Number.isFinite(v.timestamp) && v.timestamp >= 0
    && (v.mood === null || (Number.isInteger(v.mood) && Number(v.mood) >= 1 && Number(v.mood) <= 5))
    && (v.craving === null || (Number.isInteger(v.craving) && Number(v.craving) >= 0 && Number(v.craving) <= 10))
    && [v.note, v.trigger, v.coping].every(item => typeof item === "string") && typeof v.favourite === "boolean";
}
