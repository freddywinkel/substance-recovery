export interface WeeklyReviewDraft {
  selectedPatternId: string;
  nextWeekPlan: string;
  linkedGoalId: string;
  ownObservation?: string;
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
        draft.ownObservation.length <= 4000))
  );
}
