import { describe, expect, it } from "vitest";
import {
  computeAnxietyStats,
  computeBoredomStats,
  computeCravingStats,
  computeRelapseStats,
  topFrequencies,
} from "../src/lib/analytics";

describe("topFrequencies", () => {
  it("trims labels, ignores blanks, counts occurrences, and applies the limit", () => {
    expect(topFrequencies([" Stress ", "", "Stress", "Boredom", "Stress", "Conflict"], 2)).toEqual([
      { label: "Stress", count: 3 },
      { label: "Boredom", count: 1 },
    ]);
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
      highRiskCount: 1,
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
    expect(stats.topCouldHaveHelped).toEqual([{ label: "Text or call someone", count: 1 }]);
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
