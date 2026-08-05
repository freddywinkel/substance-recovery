import type {
  QuickRegistrationRecord,
  QuickSafety,
  RegistrationType,
  ToolFollowUpRecord,
} from "@/lib/recoveryFeatures";

export const QUICK_REFLECTION_DELAY_MS = 10 * 60 * 1000;

export interface QuickRegistrationInput {
  registrationType: RegistrationType;
  intensity: number;
  immediateSafety: QuickSafety;
  chosenAction: string;
  chosenActionOther?: string;
  note?: string;
}

export function buildQuickRegistrationRecord(
  input: QuickRegistrationInput,
  now = Date.now(),
): Omit<QuickRegistrationRecord, "id"> {
  return {
    recordType: "quick-registration",
    timestamp: now,
    updatedAt: now,
    registrationType: input.registrationType,
    intensity: Math.max(0, Math.min(10, Math.round(input.intensity))),
    immediateSafety: input.immediateSafety,
    chosenAction: input.chosenAction.trim(),
    chosenActionOther: input.chosenActionOther?.trim() ?? "",
    note: input.note?.trim() ?? "",
    reflectionStatus: "pending",
    reflectionDueAt: now + QUICK_REFLECTION_DELAY_MS,
    reflectionStartedAt: null,
    reflectionCompletedAt: null,
    linkedDetailedRecordId: null,
  };
}

export function activeQuickReflections(
  records: QuickRegistrationRecord[],
): QuickRegistrationRecord[] {
  const safetyPriority: Record<QuickSafety, number> = {
    "urgent-danger": 0,
    "need-support": 1,
    "safe-for-now": 2,
  };
  return records
    .filter((record) => record.reflectionStatus === "pending" || record.reflectionStatus === "started")
    .slice()
    .sort((left, right) => (
      safetyPriority[left.immediateSafety] - safetyPriority[right.immediateSafety]
      || left.reflectionDueAt - right.reflectionDueAt
    ));
}

export function dueToolFollowUps(
  records: ToolFollowUpRecord[],
  now = Date.now(),
): ToolFollowUpRecord[] {
  return records
    .filter((record) => record.status === "pending" && record.dueAt <= now)
    .slice()
    .sort((left, right) => left.dueAt - right.dueAt);
}

export function completedToolFollowUp(
  record: ToolFollowUpRecord,
  attempted: boolean,
  feelingAfter: number,
  now = Date.now(),
): ToolFollowUpRecord {
  return {
    ...record,
    updatedAt: now,
    attempted,
    feelingAfter: Math.max(0, Math.min(10, Math.round(feelingAfter))),
    status: "completed",
    completedAt: now,
  };
}
