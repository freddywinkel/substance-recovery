import { describe, expect, it } from "vitest";
import {
  cravingRegistrationKind,
  registrationBoolean,
  registrationNumber,
  registrationOptionId,
  registrationOptionIds,
  registrationText,
} from "../src/lib/canonicalRegistration";
import { migrateCompletedTrekRecord } from "../src/lib/trekMigration";
import {
  migrateCravingRegistrationType,
  migrateRelapseFollowUpAnswers,
} from "../src/db/migrations";
import {
  headRelapseV2,
  headTrekV2,
} from "./fixtures/deployed-v2-records";

const headCravingV2 = {
  dataVersion: 2,
  contentVersion: "registration-v2",
  cravingType: "passive",
  answers: {
    onsetType: "gradual-build-up",
    intensity: 6,
    confidenceBefore: 4,
    situations: ["home-alone"],
    physicalSensations: ["restlessness"],
    buildupDuration: "5-15min",
    location: "home",
    emotions: ["anxious"],
    thoughts: ["i-cant-handle-this"],
    targets: ["alcohol"],
    chosenAction: "delay-timer",
    actionAttempted: true,
    useOutcome: "not_used",
  },
};

const headAnxietyV2 = {
  dataVersion: 2,
  contentVersion: "registration-v2",
  answers: {
    anxietyTypes: ["panic-spike"],
    intensity: 8,
    bodyLocations: ["chest"],
    urgencyHigh: false,
    context: "alone",
    triggers: ["silence-nothing-to-do"],
    reassuranceSeeking: null,
    linkedStates: null,
    reaction: "reached-out-to-someone",
  },
};

const headBoredomV2 = {
  dataVersion: 2,
  contentVersion: "registration-v2",
  answers: {
    restlessnessTypes: ["understimulated"],
    intensity: 5,
    stimulationNeeds: ["movement"],
    convertCheck: "yes-this-feels-like-restlessness",
    situation: "other",
    urge: "other-stimulation",
    rescueMenu: ["step-outside"],
    action: "delayed-action",
  },
};

describe("deployed registration-v2 read reconciliation", () => {
  it("splits an exact deployed-HEAD Trek save without inventing an observable form", () => {
    const migrated = migrateCompletedTrekRecord(headTrekV2);

    expect(migrated.answers).toMatchObject({
      registrationType: "trek",
      trekTypes: null,
      planningStage: "immediacy-access-close",
      needs: ["relief", "other", "stimulation"],
      triggers: ["stress", "other", "social-pressure"],
    });
    expect(migrated.needType).toBe("Relief");
    expect(migrated.primarySubstance).toBe("");
    expect(registrationOptionIds(headTrekV2, "trekTypes", [])).toEqual([]);
    expect(registrationOptionIds(headTrekV2, "needs", headTrekV2.needTypes)).toEqual([
      "relief",
      "other",
      "stimulation",
    ]);

    const v3 = { ...headTrekV2, dataVersion: 3 };
    expect(migrateCompletedTrekRecord(v3)).toBe(v3);
  });

  it("preserves legacy motive-only Trek meaning without inventing an observable form", () => {
    const motiveOnly = {
      dataVersion: 2,
      contentVersion: "registration-v2",
      cravingType: "active",
      answers: {
        registrationType: "trek",
        trekTypes: ["boredom-driven", "emotional-escape"],
        needs: ["connection"],
        planningStage: "just-thinking-about-it",
        triggers: null,
      },
    };

    const migrated = migrateCompletedTrekRecord(motiveOnly);

    expect(migrated.answers).toMatchObject({
      registrationType: "trek",
      trekTypes: null,
      needs: ["connection", "stimulation", "escape"],
    });
    expect(registrationOptionIds(motiveOnly, "trekTypes", [])).toEqual([]);
    expect(registrationOptionIds(motiveOnly, "needs", null)).toEqual([
      "connection",
      "stimulation",
      "escape",
    ]);
  });

  it("backfills only Craving fields omitted by the deployed writer", () => {
    expect(registrationText(headCravingV2, "thoughtOther", "legacy thought")).toBe("legacy thought");
    expect(registrationOptionId(headCravingV2, "cravingOutcome", "decreased")).toBe("decreased");
    expect(registrationNumber(headCravingV2, "intensityAfter", 2)).toBe(2);
    expect(registrationBoolean(headCravingV2, "actionAttempted", false)).toBe(true);
    expect(registrationOptionId(headCravingV2, "useOutcome", "used")).toBe("not_used");

    const {
      actionAttempted: _actionAttempted,
      useOutcome: _useOutcome,
      ...answersMissingWrittenFields
    } = headCravingV2.answers;
    const missingActuallyWritten = {
      ...headCravingV2,
      answers: answersMissingWrittenFields,
    };
    expect(registrationBoolean(missingActuallyWritten, "actionAttempted", true)).toBeNull();
    expect(registrationOptionId(missingActuallyWritten, "useOutcome", "used")).toBeNull();
  });

  it("backfills Trek custom text but not fields the deployed writer already owned", () => {
    expect(registrationText(headTrekV2, "triggerNote", "near the station")).toBe("near the station");
    expect(registrationText(headTrekV2, "needOther", "quiet")).toBe("quiet");
    expect(registrationOptionId(headTrekV2, "primarySubstance", "Alcohol")).toBeNull();
    expect(registrationOptionIds(headTrekV2, "needs", null)).toEqual([
      "relief",
      "other",
      "stimulation",
    ]);

    const { confidenceAfter: _confidenceAfter, ...answersMissingConfidence } = headTrekV2.answers;
    const intentionallyCorruptedMissingConfidence = {
      ...headTrekV2,
      answers: answersMissingConfidence,
      confidenceAfter: 9,
    };
    expect(registrationNumber(
      intentionallyCorruptedMissingConfidence,
      "confidenceAfter",
      9,
    )).toBeNull();
  });

  it("backfills Anxiety prediction/note/outcome omissions while safety stays explicit", () => {
    expect(registrationText(headAnxietyV2, "bodyPrediction", "I might faint")).toBe("I might faint");
    expect(registrationText(headAnxietyV2, "note", "context")).toBe("context");
    expect(registrationOptionId(headAnxietyV2, "outcomeAfter", "decreased")).toBe("decreased");
    expect(registrationBoolean(headAnxietyV2, "urgencyHigh", true)).toBe(false);
    expect(registrationOptionId(
      { ...headAnxietyV2, answers: { ...headAnxietyV2.answers, outcomeAfter: null } },
      "outcomeAfter",
      "decreased",
    )).toBeNull();
  });

  it("backfills Boredom custom/note/outcome omissions but never treats the old open marker as completion", () => {
    expect(registrationText(headBoredomV2, "situationOther", "waiting room")).toBe("waiting room");
    expect(registrationText(headBoredomV2, "urgeOther", "browse shops")).toBe("browse shops");
    expect(registrationText(headBoredomV2, "note", "restless afternoon")).toBe("restless afternoon");
    expect(registrationOptionId(headBoredomV2, "outcomeAfter", "same")).toBe("same");
    expect(registrationText(headBoredomV2, "delayDuration", "10")).toBeNull();
  });

  it("backfills Relapse custom/context/combined-help omissions while phase and safety fields stay canonical", () => {
    expect(registrationText(headRelapseV2, "firstTriggerText", "argument")).toBe("argument");
    expect(registrationText(headRelapseV2, "leadUpContext", "poor sleep")).toBe("poor sleep");
    expect(registrationOptionIds(headRelapseV2, "couldHaveHelped", [
      "Text or call someone",
      "Text or call someone",
    ])).toEqual(["text-or-call-someone"]);
    expect(registrationOptionIds(headRelapseV2, "couldHaveHelpedEarly", ["stale legacy"])).toEqual([
      "text-or-call-someone",
    ]);
    expect(registrationOptionIds(headRelapseV2, "acuteRisks", ["unsafe"])).toEqual([]);
  });

  it("keeps deliberately divergent phase answers canonical in a separate corruption fixture", () => {
    const intentionallyCorruptedDivergentPhases = {
      ...headRelapseV2,
      answers: {
        ...headRelapseV2.answers,
        couldHaveHelpedEarly: ["text-or-call-someone"],
        couldHaveHelpedMiddle: ["leave-the-trigger-place"],
        couldHaveHelpedLast: null,
      },
    };

    expect(registrationOptionIds(
      intentionallyCorruptedDivergentPhases,
      "couldHaveHelpedMiddle",
      ["stale legacy"],
    )).toEqual(["leave-the-trigger-place"]);
    expect(registrationOptionIds(
      intentionallyCorruptedDivergentPhases,
      "couldHaveHelpedLast",
      ["stale legacy"],
    )).toEqual([]);
  });

  it("never applies v2 omission backfills to v3 and lets canonical null win", () => {
    expect(registrationText(
      { ...headCravingV2, dataVersion: 3, contentVersion: "registration-v3" },
      "thoughtOther",
      "legacy thought",
    )).toBeNull();
    expect(registrationText(
      { ...headCravingV2, answers: { ...headCravingV2.answers, thoughtOther: null } },
      "thoughtOther",
      "legacy thought",
    )).toBeNull();

    const malformedV3Craving = {
      dataVersion: 3,
      contentVersion: "registration-v3",
      cravingType: "active" as const,
      answers: { intensity: 7 },
    };
    expect(migrateCravingRegistrationType(malformedV3Craving)).toBe(malformedV3Craving);
    expect(cravingRegistrationKind(malformedV3Craving)).toBeNull();

    const v3FollowUpConflict = {
      dataVersion: 3,
      answers: { whatNeeded: null, repairActions: null, emotionAfter: null },
      whatNeeded: "Relief",
      repairActions: ["Drink water or eat something"],
      emotionAfter: 0,
    };
    expect(migrateRelapseFollowUpAnswers(v3FollowUpConflict)).toBe(v3FollowUpConflict);
  });
});
