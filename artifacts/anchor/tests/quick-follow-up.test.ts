import { describe, expect, it } from "vitest";
import type { QuickRegistrationRecord, ToolFollowUpRecord } from "../src/lib/recoveryFeatures";
import {
  QUICK_REFLECTION_DELAY_MS,
  activeQuickReflections,
  buildQuickRegistrationRecord,
  completedToolFollowUp,
  dueToolFollowUps,
} from "../src/lib/quickFollowUp";

describe("quick registration", () => {
  it("normalizes user input and schedules later reflection", () => {
    const now = 1_000;
    const record = buildQuickRegistrationRecord({
      registrationType: "craving",
      intensity: 11.7,
      immediateSafety: "safe-for-now",
      chosenAction: " wait-ten ",
      chosenActionOther: "  later  ",
      note: "  one line  ",
    }, now);

    expect(record).toMatchObject({
      timestamp: now,
      intensity: 10,
      chosenAction: "wait-ten",
      chosenActionOther: "later",
      note: "one line",
      reflectionStatus: "pending",
      reflectionDueAt: now + QUICK_REFLECTION_DELAY_MS,
      reflectionStartedAt: null,
      linkedDetailedRecordId: null,
    });
  });

  it("returns only unfinished reflections in due-time order", () => {
    const base = {
      recordType: "quick-registration" as const,
      timestamp: 0,
      updatedAt: 0,
      registrationType: "craving" as const,
      intensity: 5,
      immediateSafety: "safe-for-now" as const,
      chosenAction: "wait-ten",
      chosenActionOther: "",
      note: "",
      reflectionStartedAt: null,
      reflectionCompletedAt: null,
      linkedDetailedRecordId: null,
    };
    const records: QuickRegistrationRecord[] = [
      { ...base, id: "later", reflectionStatus: "pending", reflectionDueAt: 20 },
      { ...base, id: "done", reflectionStatus: "completed", reflectionDueAt: 1 },
      { ...base, id: "started", reflectionStatus: "started", reflectionDueAt: 10 },
    ];

    expect(activeQuickReflections(records).map((record) => record.id)).toEqual(["started", "later"]);
  });

  it("puts immediate-danger and support-needed reminders ahead of safe reminders", () => {
    const safe = buildQuickRegistrationRecord({
      registrationType: "craving",
      intensity: 4,
      immediateSafety: "safe-for-now",
      chosenAction: "wait-ten",
    }, 1_000);
    const support = buildQuickRegistrationRecord({
      registrationType: "anxiety",
      intensity: 7,
      immediateSafety: "need-support",
      chosenAction: "trusted-contact",
    }, 2_000);
    const urgent = buildQuickRegistrationRecord({
      registrationType: "anxiety",
      intensity: 9,
      immediateSafety: "urgent-danger",
      chosenAction: "safer-place",
    }, 3_000);

    expect(activeQuickReflections([
      { ...safe, id: "safe" },
      { ...support, id: "support" },
      { ...urgent, id: "urgent" },
    ]).map((record) => record.id)).toEqual(["urgent", "support", "safe"]);
  });
});

describe("tool follow-ups", () => {
  const base: ToolFollowUpRecord = {
    id: "tool-1",
    recordType: "tool-follow-up",
    timestamp: 1,
    updatedAt: 1,
    dueAt: 100,
    toolId: "/tools/breathing",
    toolLabel: "Breathing",
    feelingBefore: null,
    feelingAfter: null,
    attempted: null,
    status: "pending",
    completedAt: null,
  };

  it("selects only due pending check-ins", () => {
    const records: ToolFollowUpRecord[] = [
      base,
      { ...base, id: "future", dueAt: 200 },
      { ...base, id: "dismissed", dueAt: 50, status: "dismissed" },
    ];
    expect(dueToolFollowUps(records, 150).map((record) => record.id)).toEqual(["tool-1"]);
  });

  it("records a bounded reported score without causal conclusions", () => {
    const completed = completedToolFollowUp(base, true, -2, 500);
    expect(completed).toMatchObject({
      attempted: true,
      feelingAfter: 0,
      status: "completed",
      completedAt: 500,
      updatedAt: 500,
    });
  });
});
