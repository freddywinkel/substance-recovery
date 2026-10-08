import { MAX_SUPPORTED_TIMESTAMP } from "./recoveryFeatures";

export interface WeeklyReviewDraft {
  selectedPatternId: string;
  nextWeekPlan: string;
  linkedGoalId: string;
  ownObservation?: string;
  rememberFromWeek?: string;
  choseForMyself?: string;
  makeRoomForNextWeek?: string;
  pleasantActivity?: string;
  recordId?: string;
  timestamp?: number;
  sourceUpdatedAt?: number | null;
}

const PATTERN_IDS = new Set([
  "",
  "own",
  "type:craving",
  "type:trek",
  "type:relapse",
  "type:anxiety",
  "type:boredom",
  "time:morning",
  "time:afternoon",
  "time:evening",
  "time:night",
  "intensity:7-10",
]);

/** Drafts can be incomplete, but must remain safe to reopen as form state. */
export function isWeeklyReviewDraft(
  value: unknown,
): value is WeeklyReviewDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const draft = value as Record<string, unknown>;
  return (
    Object.keys(draft).every((key) =>
      [
        "selectedPatternId",
        "nextWeekPlan",
        "linkedGoalId",
        "ownObservation",
        "rememberFromWeek",
        "choseForMyself",
        "makeRoomForNextWeek",
        "pleasantActivity",
        "recordId",
        "timestamp",
        "sourceUpdatedAt",
      ].includes(key),
    ) &&
    typeof draft.selectedPatternId === "string" &&
    PATTERN_IDS.has(draft.selectedPatternId) &&
    typeof draft.nextWeekPlan === "string" &&
    draft.nextWeekPlan.length <= 4000 &&
    typeof draft.linkedGoalId === "string" &&
    draft.linkedGoalId.length <= 200 &&
    (draft.ownObservation === undefined ||
      (typeof draft.ownObservation === "string" &&
        draft.ownObservation.length <= 4000)) &&
    ["rememberFromWeek", "choseForMyself", "makeRoomForNextWeek", "pleasantActivity"].every(
      field => draft[field] === undefined || (typeof draft[field] === "string" && draft[field].length <= 2000),
    ) &&
    (draft.recordId === undefined || (typeof draft.recordId === "string" && !!draft.recordId.trim() && draft.recordId.length <= 200)) &&
    (draft.timestamp === undefined || isDraftTimestamp(draft.timestamp)) &&
    (draft.sourceUpdatedAt === undefined || draft.sourceUpdatedAt === null || isDraftTimestamp(draft.sourceUpdatedAt))
  );
}

function isDraftTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= MAX_SUPPORTED_TIMESTAMP;
}
