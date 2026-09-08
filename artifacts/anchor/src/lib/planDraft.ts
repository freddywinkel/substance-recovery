import { TOOL_IDS, type RecoveryToolId } from "./recoveryFeatures";
import { isValidPreventionPlan, type PreventionPlan } from "./preventionPlan";

export interface RecoveryPlanDraft {
  warningSigns: string;
  reasons: string;
  situations: string;
  message: string;
  next24Hours: string;
  trustedContactIds: string[];
  pinnedContactId: string | null;
  pinnedToolIds: RecoveryToolId[];
  prevention: PreventionPlan;
  baseUpdatedAt: number | null;
}

export function isRecoveryPlanDraft(value: unknown): value is RecoveryPlanDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  const text = (entry: unknown, max: number): entry is string => typeof entry === "string" && entry.length <= max;
  const id = (entry: unknown): entry is string => text(entry, 200) && entry.trim().length > 0;
  const fields = ["warningSigns", "reasons", "situations", "message", "next24Hours", "trustedContactIds", "pinnedContactId", "pinnedToolIds", "prevention", "baseUpdatedAt"];
  return Object.keys(item).every(key => fields.includes(key))
    && ["warningSigns", "reasons", "situations", "next24Hours"].every(key => text(item[key], 12000))
    && text(item.message, 1000)
    && Array.isArray(item.trustedContactIds) && item.trustedContactIds.length <= 50
    && item.trustedContactIds.every(id) && new Set(item.trustedContactIds).size === item.trustedContactIds.length
    && (item.pinnedContactId === null || id(item.pinnedContactId))
    && Array.isArray(item.pinnedToolIds) && item.pinnedToolIds.length <= 2
    && item.pinnedToolIds.every(tool => TOOL_IDS.includes(tool as RecoveryToolId))
    && new Set(item.pinnedToolIds).size === item.pinnedToolIds.length
    && (item.baseUpdatedAt === null || (Number.isSafeInteger(item.baseUpdatedAt) && Number(item.baseUpdatedAt) >= 0 && Number(item.baseUpdatedAt) <= 8_640_000_000_000_000))
    && isValidPreventionPlan(item.prevention);
}
