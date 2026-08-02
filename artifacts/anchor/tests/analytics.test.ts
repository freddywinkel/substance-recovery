import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  computeAnxietyStats,
  computeAttentionStats,
  computeBoredomStats,
  computeCravingStats,
  computeCompletedRegistrationActivity,
  computeCurrentStreakDays,
  computeRelapseStats,
  computeSobrietyStats,
  completedStatusEntries,
  topFrequencies,
} from "../src/lib/analytics";
import { migrateCravingRegistrationType } from "../src/db/migrations";
import { getOptionTranslation } from "../src/lib/translations";

describe("topFrequencies", () => {
  it("trims labels, ignores blanks, counts occurrences, and applies the limit", () => {
    expect(topFrequencies([" Stress ", "", "Stress", "Boredom", "Stress", "Conflict"], 2)).toEqual([
      { label: "Stress", count: 3 },
      { label: "Boredom", count: 1 },
    ]);
  });
});

describe("completed registration boundary", () => {
  it("excludes draft status records before History and Insights consume them", () => {
    expect(completedStatusEntries([
      { id: "done", status: "completed" as const },
      { id: "draft", status: "draft" as const },
    ])).toEqual([{ id: "done", status: "completed" }]);
  });

  it("does not let a draft relapse reset the displayed sobriety streak", () => {
    const now = Date.UTC(2026, 7, 2, 12);
    const completedAt = now - 5 * 86_400_000;
    const draftAt = now - 1 * 86_400_000;
    const streak = computeCurrentStreakDays("2026-07-01", [
      { status: "completed", timestamp: completedAt },
      { status: "draft", timestamp: draftAt },
    ] as never[], now);
    expect(streak).toBe(5);
    expect(computeSobrietyStats("2026-07-01", [
      { status: "draft", timestamp: draftAt },
    ] as never[], now)).toMatchObject({ hasRelapse: false });
  });

  it("summarizes only completed registration activity without a severity score", () => {
    const now = Date.UTC(2026, 7, 2, 12);
    expect(computeCompletedRegistrationActivity({
      cravingLogs: [
        { status: "completed", timestamp: now - 2 * 86_400_000 },
        { status: "draft", timestamp: now },
      ],
      relapseLogs: [{ status: "draft", timestamp: now }],
      anxietyLogs: [],
      boredomLogs: [],
    } as never, now)).toEqual({
      completedCount: 1,
      lastCompletedAt: now - 2 * 86_400_000,
      daysSinceLastCompleted: 2,
    });

    const source = readFileSync(new URL("../src/pages/Home.tsx", import.meta.url), "utf8");
    expect(source).toContain("computeCompletedRegistrationActivity");
    expect(source).not.toContain("calculateRiskScore");
    expect(source).not.toContain("home.risk.");
    expect(source).not.toContain("/100");
  });

  it("dates completion activity by completedAt rather than the event occurrence", () => {
    const now = Date.UTC(2026, 7, 2, 12);
    const completedAt = now - 60 * 60_000;
    const oldOccurrence = now - 7 * 86_400_000;

    expect(computeCompletedRegistrationActivity({
      cravingLogs: [
        {
          status: "completed",
          timestamp: oldOccurrence,
          occurredAt: oldOccurrence,
          completedAt,
        },
        {
          status: "draft",
          timestamp: now,
          occurredAt: oldOccurrence,
          completedAt: now,
        },
      ],
      relapseLogs: [],
      anxietyLogs: [],
      boredomLogs: [],
    } as never, now)).toEqual({
      completedCount: 1,
      lastCompletedAt: completedAt,
      daysSinceLastCompleted: 0,
    });
  });
});

describe("computeCravingStats", () => {
  it("excludes drafts and separates active treks from passive cravings", () => {
    const stats = computeCravingStats([
      {
        status: "completed",
        cravingType: "active",
        intensity: 8,
        confidenceBefore: 3,
        intensityAfter: null,
        confidenceAfter: null,
        cravingOutcome: null,
        chosenAction: "delay-timer",
        useOutcome: "not_used",
        highRiskFlag: true,
        situationPresets: ["Stress"],
        emotions: [],
        physicalSensations: [],
        thoughtPresets: [],
        substances: [],
        socialContext: [],
        needTypes: ["Relief"],
      },
      {
        status: "completed",
        cravingType: "passive",
        intensity: 4,
        confidenceBefore: 7,
        intensityAfter: 2,
        confidenceAfter: 8,
        cravingOutcome: "decreased",
        chosenAction: "grounding",
        useOutcome: "not_used",
        highRiskFlag: false,
        situationPresets: ["Home alone"],
        emotions: [],
        physicalSensations: [],
        thoughtPresets: [],
        substances: [],
        socialContext: [],
      },
      {
        status: "draft",
        cravingType: "passive",
        intensity: 10,
        confidenceBefore: 0,
        intensityAfter: null,
        confidenceAfter: null,
        cravingOutcome: null,
        chosenAction: "used",
        useOutcome: "used",
        highRiskFlag: true,
        situationPresets: [],
        emotions: [],
        physicalSensations: [],
        thoughtPresets: [],
        substances: [],
        socialContext: [],
      },
    ] as never[]);

    expect(stats).toMatchObject({
      total: 2,
      activeTotal: 1,
      passiveTotal: 1,
      avgIntensity: 6,
      avgIntensityActive: 8,
      avgIntensityPassive: 4,
      usedCount: 0,
      notUsedCount: 2,
      reportedNotUsedPct: 100,
    });
  });

  it("reports strategy outcomes only for actions explicitly marked as attempted", () => {
    const base = {
      status: "completed",
      cravingType: "passive",
      intensity: 6,
      confidenceBefore: 5,
      intensityAfter: null,
      confidenceAfter: null,
      cravingOutcome: null,
      chosenAction: "grounding",
      useOutcome: "not_used",
      highRiskFlag: false,
      situationPresets: [],
      emotions: [],
      physicalSensations: [],
      thoughtPresets: [],
      substances: [],
      socialContext: [],
    };
    const stats = computeCravingStats([
      { ...base, actionAttempted: true },
      { ...base, actionAttempted: false },
      { ...base, actionAttempted: null },
    ] as never[]);

    expect(stats.reportedOutcomesByAttemptedAction).toEqual([
      {
        strategy: "grounding",
        total: 1,
        notUsed: 1,
        used: 0,
        unsure: 0,
        notUsedPct: 100,
      },
    ]);
  });
});

describe("computeRelapseStats", () => {
  const base = {
    status: "completed",
    timestamp: Date.now(),
    label: "no-label",
    firstTriggerType: "Internal emotion",
    missedWarnings: [],
    preUseThoughtPreset: "",
    preUseThoughtPresets: [],
    couldHaveHelpedEarly: [],
    couldHaveHelpedMiddle: [],
    couldHaveHelpedLast: [],
    supportContact: "Friend",
    supportContactOther: "",
  };

  it("does not triple-count a help option mirrored across legacy stage fields", () => {
    const stats = computeRelapseStats([
      {
        ...base,
        couldHaveHelpedEarly: ["Text or call someone"],
        couldHaveHelpedMiddle: ["Text or call someone"],
        couldHaveHelpedLast: ["Text or call someone"],
      },
    ] as never[]);
    expect(stats.topCouldHaveHelped).toEqual([{ label: "text-or-call-someone", count: 1 }]);
  });

  it("counts the explicit no-support choice as no support", () => {
    const stats = computeRelapseStats([{ ...base, supportContact: "No one right now" }] as never[]);
    expect(stats.noSupportContactCount).toBe(1);
  });

  it("recognizes a custom support contact", () => {
    const stats = computeRelapseStats([
      { ...base, supportContact: "", supportContactOther: "Peer mentor" },
    ] as never[]);
    expect(stats.noSupportContactCount).toBe(0);
  });
});

describe("outcome denominators", () => {
  it("uses only answered anxiety outcomes as the improvement denominator", () => {
    const stats = computeAnxietyStats([
      { intensity: 7, reaction: "Avoided or left", outcomeAfter: "decreased", context: "", trigger: "", bodySensations: [] },
      { intensity: 3, reaction: "Reached out to someone", outcomeAfter: null, context: "", trigger: "", bodySensations: [] },
      { intensity: 5, reaction: "Reached out to someone", outcomeAfter: "unknown", context: "", trigger: "", bodySensations: [] },
    ] as never[]);
    expect(stats).toMatchObject({ hasOutcomeData: true, improvedCount: 1, improvedPct: 100 });
  });

  it("uses only answered boredom outcomes as the improvement denominator", () => {
    const stats = computeBoredomStats([
      { intensity: 6, feelingTypes: [], situation: "Alone", urge: "", action: "Delayed action", outcomeAfter: "decreased" },
      { intensity: 2, feelingTypes: [], situation: "Alone", urge: "", action: "Escaped immediately", outcomeAfter: null },
      { intensity: 4, feelingTypes: [], situation: "Alone", urge: "", action: "Delayed action", outcomeAfter: "unknown" },
    ] as never[]);
    expect(stats).toMatchObject({ hasOutcomeData: true, improvedCount: 1, improvedPct: 100 });
  });
});

describe("canonical registration consumers", () => {
  it("lets a present v2 answer win over conflicting legacy aliases, including null", () => {
    const stats = computeCravingStats([{
      status: "completed",
      dataVersion: 2,
      answers: {
        registrationType: "craving",
        intensity: null,
        situations: ["canonical-situation"],
        emotions: null,
        chosenAction: null,
        actionAttempted: null,
        useOutcome: null,
        cravingOutcome: null,
        intensityAfter: null,
        confidenceBefore: null,
        confidenceAfter: null,
      },
      cravingType: "active",
      intensity: 10,
      confidenceBefore: 9,
      intensityAfter: 1,
      confidenceAfter: 10,
      cravingOutcome: "decreased",
      chosenAction: "grounding",
      actionAttempted: true,
      useOutcome: "not_used",
      highRiskFlag: true,
      situationPresets: ["Legacy situation"],
      emotions: ["Legacy emotion"],
      physicalSensations: [],
      thoughtPresets: [],
      substances: [],
      socialContext: [],
    }] as never[]);

    expect(stats).toMatchObject({
      total: 1,
      activeTotal: 0,
      passiveTotal: 1,
      avgIntensity: null,
      withUseOutcomeCount: 0,
      topSituations: [{ label: "canonical-situation", count: 1 }],
      topEmotions: [],
    });
    expect(stats).not.toHaveProperty("highRiskCount");
  });

  it("read-migrates the unambiguous early-v2 cravingType discriminator", () => {
    const record = {
      dataVersion: 2,
      cravingType: "active" as const,
      answers: { intensity: 6 },
    };
    const migrated = migrateCravingRegistrationType(record);
    expect(migrated.answers.registrationType).toBe("trek");
    expect(record.answers).not.toHaveProperty("registrationType");

    const stats = computeCravingStats([{
      ...migrated,
      status: "completed",
      intensity: 1,
      confidenceBefore: null,
      intensityAfter: null,
      confidenceAfter: null,
      cravingOutcome: null,
      chosenAction: "",
      actionAttempted: null,
      useOutcome: undefined,
      highRiskFlag: false,
      situationPresets: [],
      emotions: [],
      physicalSensations: [],
      thoughtPresets: [],
      substances: [],
      socialContext: [],
    }] as never[]);
    expect(stats).toMatchObject({ activeTotal: 1, passiveTotal: 0, avgIntensityActive: 6 });
  });

  it("translates stable IDs instead of exposing raw storage syntax", () => {
    expect(getOptionTranslation("nl", "text-or-call-someone")).toBe("Iemand een bericht sturen of bellen");
    expect(getOptionTranslation("en", "home-alone")).toBe("Home alone");
  });
});

describe("explicit Insights attention", () => {
  it("uses only answered canonical safety questions and preserves simultaneous concerns", () => {
    const stats = computeAttentionStats({
      cravingLogs: [{
        status: "completed",
        dataVersion: 2,
        answers: { registrationType: "craving", intensity: 10 },
        cravingType: "passive",
        intensity: 10,
        highRiskFlag: true,
      }] as never[],
      anxietyLogs: [
        { dataVersion: 2, answers: { urgencyHigh: true }, urgencyHigh: false, intensity: 1 },
        { dataVersion: 2, answers: { urgencyHigh: null }, urgencyHigh: true, intensity: 10 },
      ] as never[],
      relapseLogs: [
        {
          status: "completed",
          dataVersion: 2,
          answers: { acuteRisks: ["withdrawal", "self-harm-risk"] },
          acuteRisks: ["withdrawal", "self-harm-risk"],
          acuteRisk: "none",
        },
        {
          status: "completed",
          dataVersion: 2,
          answers: { acuteRisks: null },
          acuteRisks: [],
          acuteRisk: "unsafe",
        },
        {
          status: "completed",
          dataVersion: 2,
          answers: { acuteRisks: ["none"] },
          acuteRisks: ["none"],
          acuteRisk: "none",
        },
        {
          status: "completed",
          dataVersion: 2,
          answers: { acuteRisk: "none" },
          acuteRisk: "none",
        },
      ] as never[],
      boredomLogs: [{ dataVersion: 2, answers: { intensity: 10 }, intensity: 10 }] as never[],
    });

    expect(stats).toEqual({
      answeredCount: 4,
      needsAttentionCount: 2,
      reasons: {
        "anxiety-urgent": 1,
        "relapse-unsafe": 0,
        "relapse-continued-use": 0,
        "relapse-withdrawal": 1,
        "relapse-self-harm": 1,
      },
    });
  });

  it("uses only unambiguous affirmative safety values for pre-v2 compatibility", () => {
    const stats = computeAttentionStats({
      cravingLogs: [],
      boredomLogs: [],
      anxietyLogs: [
        { urgencyHigh: true },
        { urgencyHigh: false },
      ] as never[],
      relapseLogs: [
        { status: "completed", acuteRisk: "unsafe" },
        { status: "completed", acuteRisk: "none" },
        { status: "draft", acuteRisk: "self-harm-risk" },
      ] as never[],
    });
    expect(stats).toMatchObject({ answeredCount: 2, needsAttentionCount: 2 });
  });
});
