import type { RecoveryActionType } from "./recoveryFeatures";

export interface SupportiveActionDraft {
  id: string;
  timestamp: number | null;
  actionType: Exclude<RecoveryActionType, "tool">;
  label: string;
  note: string;
}

export function createSupportiveActionDraft(): SupportiveActionDraft {
  return { id: crypto.randomUUID(), timestamp: null, actionType: "contact", label: "", note: "" };
}

export function isSupportiveActionDraft(value: unknown): value is SupportiveActionDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const draft = value as Record<string, unknown>;
  return Object.keys(draft).every(key => ["id", "timestamp", "actionType", "label", "note"].includes(key))
    && typeof draft.id === "string" && draft.id.trim().length > 0 && draft.id.length <= 200
    && (draft.timestamp === null || (Number.isSafeInteger(draft.timestamp) && Number(draft.timestamp) >= 0 && Number(draft.timestamp) <= 8_640_000_000_000_000))
    && typeof draft.actionType === "string" && ["contact", "care", "goal"].includes(draft.actionType)
    && typeof draft.label === "string" && draft.label.length <= 500
    && typeof draft.note === "string" && draft.note.length <= 2000;
}
