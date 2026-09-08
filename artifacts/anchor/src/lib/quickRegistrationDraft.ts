import { REGISTRATION_TYPES, type RegistrationType, type QuickSafety } from "./recoveryFeatures";
import { isKnownRecoveryTarget, isBehavioralTarget } from "./recoveryTargets";

export const QUICK_ACTION_IDS = ["trusted-contact", "coping-tool", "wait-ten", "safer-place", "professional-help", "other"] as const;
export const QUICK_SAFETY_IDS: QuickSafety[] = ["safe-for-now", "need-support", "urgent-danger"];
export interface QuickRegistrationDraft {
  id: string; timestamp: number; registrationType: RegistrationType | null;
  intensity: number | null; immediateSafety: QuickSafety | null;
  chosenAction: string; chosenActionOther: string; note: string;
  // Older local drafts predate these optional recording fields.
  target?: string; useOutcome?: "" | "used" | "not_used" | "unsure"; usePrescribed?: boolean;
}
export function createBlankQuickRegistrationDraft(): QuickRegistrationDraft {
  return { id: crypto.randomUUID(), timestamp: Date.now(), registrationType: null, intensity: null,
    immediateSafety: null, chosenAction: "", chosenActionOther: "", note: "", target: "", useOutcome: "", usePrescribed: false };
}
export function isQuickRegistrationDraft(value: unknown): value is QuickRegistrationDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  const fields = ["id", "timestamp", "registrationType", "intensity", "immediateSafety", "chosenAction", "chosenActionOther", "note", "target", "useOutcome", "usePrescribed"];
  const text = (item: unknown, max: number) => typeof item === "string" && item.length <= max;
  return Object.keys(v).every(key => fields.includes(key))
    && text(v.id, 200) && (v.id as string).trim().length > 0
    && Number.isSafeInteger(v.timestamp) && Number(v.timestamp) >= 0 && Number(v.timestamp) <= 8_640_000_000_000_000
    && (v.registrationType === null || REGISTRATION_TYPES.includes(v.registrationType as RegistrationType))
    && (v.intensity === null || (Number.isInteger(v.intensity) && Number(v.intensity) >= 0 && Number(v.intensity) <= 10))
    && (v.immediateSafety === null || QUICK_SAFETY_IDS.includes(v.immediateSafety as QuickSafety))
    && (v.chosenAction === "" || QUICK_ACTION_IDS.includes(v.chosenAction as typeof QUICK_ACTION_IDS[number]))
    && text(v.chosenActionOther, 500) && text(v.note, 2000)
    && (v.target === undefined || v.target === "" || (typeof v.target === "string" && isKnownRecoveryTarget(v.target)))
    && (v.useOutcome === undefined || ["", "used", "not_used", "unsure"].includes(v.useOutcome as string))
    && (v.usePrescribed === undefined || typeof v.usePrescribed === "boolean")
    && (v.usePrescribed !== true || (v.useOutcome === "used" && !isBehavioralTarget(String(v.target ?? ""))));
}
