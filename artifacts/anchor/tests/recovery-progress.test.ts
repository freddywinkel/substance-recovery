import { describe, expect, it } from "vitest";
import type {
  QuickRegistrationRecord,
  RecoveryActionRecord,
} from "../src/lib/recoveryFeatures";
import {
  buildReviewRegistrations,
  buildLocalDateRange,
  buildSelectiveReport,
  buildSupportiveProgressSummary,
  buildWeeklyReviewSummary,
  getLocalWeekRange,
  type RecoveryProgressSources,
} from "../src/lib/recoveryProgress";

const quickRegistration = (
  id: string,
  timestamp: number,
): QuickRegistrationRecord => ({
  id,
  recordType: "quick-registration",
  timestamp,
  updatedAt: timestamp,
  registrationType: "craving",
  intensity: 8,
  immediateSafety: "safe-for-now",
  chosenAction: "call-support",
  chosenActionOther: "",
  note: "Quick note",
  reflectionStatus: "pending",
  reflectionDueAt: timestamp + 10 * 60_000,
  reflectionStartedAt: null,
  reflectionCompletedAt: null,
  linkedDetailedRecordId: null,
});

const recoveryAction = (
  id: string,
  timestamp: number,
): RecoveryActionRecord => ({
  id,
  recordType: "recovery-action",
  timestamp,
  updatedAt: timestamp,
  actionType: "contact",
  label: "Called support",
  note: "",
  sourceId: null,
});

function emptySources(): RecoveryProgressSources {
  return {
    cravingLogs: [],
    relapseLogs: [],
    anxietyLogs: [],
    boredomLogs: [],
    quickRegistrations: [],
  };
}

describe("recovery progress registration boundary", () => {
  it("uses occurrence time, excludes draft status records, and keeps quick registrations distinct", () => {
    const occurredAt = new Date(2026, 7, 3, 9).getTime();
    const savedLater = occurredAt + 60_000;
    const sources: RecoveryProgressSources = {
      ...emptySources(),
      cravingLogs: [
        {
          id: "completed-trek",
          timestamp: savedLater,
          occurredAt,
          status: "completed",
          cravingType: "active",
          intensity: 7,
          situationPresets: ["Stress"],
          chosenAction: "delay",
          note: "Detailed note",
        },
        {
          id: "draft",
          timestamp: savedLater,
          status: "draft",
          intensity: 10,
        },
      ],
      quickRegistrations: [quickRegistration("quick", occurredAt + 1)],
    };

    const entries = buildReviewRegistrations(sources);
    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => entry.id)).not.toContain("detailed:craving:draft");
    expect(entries.find((entry) => entry.sourceId === "completed-trek")).toMatchObject({
      type: "trek",
      timestamp: occurredAt,
      source: "detailed",
    });
    expect(entries.find((entry) => entry.sourceId === "quick")?.source).toBe("quick");
  });

  it("counts a quick registration and its linked detailed reflection as one episode", () => {
    const timestamp = new Date(2026, 7, 3, 9).getTime();
    const quick = {
      ...quickRegistration("quick-linked", timestamp),
      registrationType: "anxiety" as const,
      reflectionStatus: "completed" as const,
      reflectionCompletedAt: timestamp + 1_000,
      linkedDetailedRecordId: "detail-linked",
    };
    const entries = buildReviewRegistrations({
      ...emptySources(),
      anxietyLogs: [{ id: "detail-linked", timestamp: timestamp + 500, intensity: 6 }],
      quickRegistrations: [quick],
    });

    expect(entries.map((entry) => entry.id)).toEqual(["detailed:anxiety:detail-linked"]);
    expect(entries[0]).toMatchObject({
      source: "linked",
      timestamp,
      intensity: 8,
      laterIntensity: 6,
      immediateSafety: "safe-for-now",
      note: "Quick note",
    });
  });

  it("keeps a quick episode when its detailed pointer is dangling or has the wrong type", () => {
    const timestamp = new Date(2026, 7, 3, 9).getTime();
    const dangling = {
      ...quickRegistration("quick-dangling", timestamp),
      linkedDetailedRecordId: "missing-detail",
      reflectionStatus: "completed" as const,
      reflectionCompletedAt: timestamp + 1,
    };
    const entries = buildReviewRegistrations({
      ...emptySources(),
      quickRegistrations: [dangling],
    });
    expect(entries).toMatchObject([{ id: "quick:quick-dangling", source: "quick" }]);
  });

  it("links a quick record to only one deterministic detailed record", () => {
    const timestamp = new Date(2026, 7, 3, 9).getTime();
    const quick = {
      ...quickRegistration("quick-one-to-one", timestamp),
      registrationType: "anxiety" as const,
    };
    const entries = buildReviewRegistrations({
      ...emptySources(),
      anxietyLogs: [
        {
          id: "later-detail",
          timestamp: timestamp + 1_000,
          completedAt: timestamp + 2_000,
          intensity: 5,
          answers: { quickRegistrationId: quick.id },
        },
        {
          id: "first-detail",
          timestamp: timestamp + 2_000,
          completedAt: timestamp + 1_000,
          intensity: 6,
          answers: { quickRegistrationId: quick.id },
        },
      ],
      quickRegistrations: [quick],
    });
    expect(entries).toHaveLength(2);
    expect(entries.find((entry) => entry.source === "linked")?.sourceId).toBe("first-detail");
    expect(entries.find((entry) => entry.source === "detailed")?.sourceId).toBe("later-detail");
  });

  it("keeps option IDs translatable while preserving user-authored context verbatim", () => {
    const timestamp = new Date(2026, 7, 3, 9).getTime();
    const [entry] = buildReviewRegistrations({
      ...emptySources(),
      cravingLogs: [{
        id: "structured-context",
        timestamp,
        status: "completed",
        intensity: 4,
        situationPresets: ["Home alone"],
        situationOther: "My own exact wording",
        location: "Work",
        chosenAction: "call-someone",
        answers: {
          situations: ["home-alone"],
          situationOther: "My own exact wording",
          location: "work",
          chosenAction: "call-someone",
        },
      }],
    });
    expect(entry?.contextParts).toEqual([
      { kind: "option", value: "home-alone" },
      { kind: "text", value: "My own exact wording" },
      { kind: "option", value: "work" },
    ]);
    expect(entry?.actionParts).toEqual([{ kind: "option", value: "call-someone" }]);
  });
});

describe("weekly review evidence", () => {
  it("reports explicit denominators and source IDs for every observed pattern", () => {
    const mondayMorning = new Date(2026, 7, 3, 9).getTime();
    const mondayEvening = new Date(2026, 7, 3, 20).getTime();
    const tuesdayMorning = new Date(2026, 7, 4, 10).getTime();
    const outsideWeek = new Date(2026, 7, 10, 9).getTime();
    const registrations = buildReviewRegistrations({
      ...emptySources(),
      anxietyLogs: [
        { id: "a1", timestamp: mondayMorning, intensity: 8, context: "Work" },
        { id: "a2", timestamp: mondayEvening, intensity: 4, context: "Home" },
      ],
      boredomLogs: [
        { id: "b1", timestamp: tuesdayMorning, intensity: null, situation: "Alone" },
        { id: "outside", timestamp: outsideWeek, intensity: 9 },
      ],
    });
    const range = getLocalWeekRange(mondayMorning, 0);

    const review = buildWeeklyReviewSummary(registrations, range);

    expect(review.entries).toHaveLength(3);
    expect(review.patterns).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "registration-type",
        value: "anxiety",
        count: 2,
        denominator: 3,
        entryIds: expect.arrayContaining(["detailed:anxiety:a1", "detailed:anxiety:a2"]),
      }),
      expect.objectContaining({
        kind: "time-of-day",
        value: "morning",
        count: 2,
        denominator: 3,
      }),
      expect.objectContaining({
        kind: "high-intensity",
        count: 1,
        denominator: 2,
        entryIds: ["detailed:anxiety:a1"],
      }),
    ]));
  });

  it("recognises detailed, quick and self-recorded actions without converting them into a streak", () => {
    const start = new Date(2026, 7, 3).getTime();
    const range = { start, endExclusive: start + 7 * 86_400_000 };
    const registrations = buildReviewRegistrations({
      ...emptySources(),
      anxietyLogs: [{ id: "detail", timestamp: start + 1, intensity: 3 }],
      quickRegistrations: [quickRegistration("quick", start + 2)],
    });

    expect(buildSupportiveProgressSummary({
      registrations,
      recoveryActions: [recoveryAction("action", start + 3)],
      range,
    })).toEqual({
      detailedRegistrations: 1,
      quickRegistrations: 1,
      supportiveActions: 1,
      totalRecognisedActions: 3,
      byActionType: { contact: 1 },
    });
  });
});

describe("selective printable report", () => {
  it("rejects blank, reversed and impossible calendar date ranges", () => {
    expect(buildLocalDateRange("", "2026-08-05")).toBeNull();
    expect(buildLocalDateRange("2026-08-05", "2026-08-04")).toBeNull();
    expect(buildLocalDateRange("2026-02-30", "2026-03-01")).toBeNull();

    const leapDay = buildLocalDateRange("2028-02-29", "2028-02-29");
    expect(leapDay).not.toBeNull();
    expect(leapDay!.endExclusive).toBeGreaterThan(leapDay!.start);
  });

  it("filters the period and emits only the fields explicitly selected", () => {
    const start = new Date(2026, 7, 3).getTime();
    const range = { start, endExclusive: start + 86_400_000 };
    const registrations = buildReviewRegistrations({
      ...emptySources(),
      anxietyLogs: [
        { id: "included", timestamp: start + 10, intensity: 6, context: "Work", note: "Private detail" },
        { id: "excluded", timestamp: range.endExclusive, intensity: 9, context: "Outside" },
      ],
    });
    const report = buildSelectiveReport({
      registrations,
      recoveryActions: [
        recoveryAction("included-action", start + 20),
        recoveryAction("excluded-action", range.endExclusive),
      ],
      range,
      fields: ["date", "source", "type", "supportive-description"],
    });

    expect(report.summary).toBeNull();
    expect(report.registrations).toHaveLength(1);
    expect(report.registrations[0]?.values).toEqual({
      date: start + 10,
      source: "detailed",
      type: "anxiety",
    });
    expect(report.registrations[0]?.values).not.toHaveProperty("notes");
    expect(report.supportiveActions.map((action) => action.id)).toEqual(["included-action"]);
  });

  it("omits supportive actions unless that report field is selected", () => {
    const start = new Date(2026, 7, 3).getTime();
    const report = buildSelectiveReport({
      registrations: [],
      recoveryActions: [recoveryAction("action", start)],
      range: { start, endExclusive: start + 1 },
      fields: ["summary"],
    });

    expect(report.supportiveActions).toEqual([]);
    expect(report.summary).toEqual({ registrationCount: 0, supportiveActionCount: 1 });
  });

  it("keeps supportive descriptions and notes independently selectable", () => {
    const start = new Date(2026, 7, 3).getTime();
    const action = { ...recoveryAction("private-action", start), note: "Sensitive note" };
    const descriptionOnly = buildSelectiveReport({
      registrations: [],
      recoveryActions: [action],
      range: { start, endExclusive: start + 1 },
      fields: ["supportive-description"],
    });
    const noSupportiveDetails = buildSelectiveReport({
      registrations: [],
      recoveryActions: [action],
      range: { start, endExclusive: start + 1 },
      fields: ["date"],
    });

    expect(descriptionOnly.supportiveActions).toEqual([{
      id: action.id,
      actionType: action.actionType,
      sourceId: action.sourceId,
      values: { "supportive-description": action.label },
    }]);
    expect(descriptionOnly.supportiveActions[0]?.values).not.toHaveProperty("supportive-notes");
    expect(JSON.stringify(descriptionOnly.supportiveActions)).not.toContain("Sensitive note");
    expect(noSupportiveDetails.supportiveActions).toEqual([]);
  });
});
