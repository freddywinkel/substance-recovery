import { describe, expect, it } from "vitest";
import type { AnxietyLog, BoredomLog } from "../src/db";
import { getOptionTranslation, getTranslation } from "../src/lib/translations";
import {
  buildAnxietyAnswers,
  canProceedAnxietyStep,
  getAnxietyCompletionCopy,
  normalizeAnxietyBodyLocations,
  REACTIONS,
  toggleAnxietyBodyLocation,
  withAnxietyOutcome,
} from "../src/pages/AnxietyTracker";
import {
  boredomFollowUpTrackers,
  boredomStepCount,
  buildBoredomAnswers,
  canProceedBoredomStep,
  isBoredomTrackerConversion,
  normalizeBoredomStep,
  removeIncompatibleBoredomRescues,
  toggleBoredomStimulationNeed,
  withBoredomOutcome,
} from "../src/pages/BoredomTracker";
import { readSource } from "./helpers/sourceContracts";

describe("Anxiety question and saved-answer semantics", () => {
  it("keeps the neutral answer and optional 0–10 scale bilingual", () => {
    expect(getOptionTranslation("nl", "Not in one place / not sure"))
      .toBe("Niet op één plek / niet zeker");
    expect(getTranslation("en", "anxiety.q.intensity_note")).toMatch(/^0\s/);
    expect(getTranslation("nl", "anxiety.q.intensity_note")).toMatch(/^0\s/);
  });

  it("requires a deliberate body answer without forcing a specific location", () => {
    expect(canProceedAnxietyStep("body", ["Dread"], [], false, "")).toBe(false);
    expect(canProceedAnxietyStep(
      "body",
      ["Dread"],
      ["Not in one place / not sure"],
      false,
      "",
    )).toBe(true);
  });

  it("keeps a deliberate not-yet reaction distinct from an unanswered reaction", () => {
    expect(canProceedAnxietyStep("reaction", ["Dread"], ["Chest"], false, ""))
      .toBe(false);
    expect(canProceedAnxietyStep(
      "reaction",
      ["Dread"],
      ["Chest"],
      false,
      "Not yet / just logging",
    )).toBe(true);
  });

  it("keeps broad and neutral body answers exclusive of specific locations", () => {
    expect(toggleAnxietyBodyLocation(["Chest"], "Whole body")).toEqual(["Whole body"]);
    expect(toggleAnxietyBodyLocation(["Whole body"], "Chest")).toEqual(["Chest"]);
    expect(toggleAnxietyBodyLocation(["Chest"], "Not in one place / not sure"))
      .toEqual(["Not in one place / not sure"]);
    expect(normalizeAnxietyBodyLocations(["Whole body", "Chest", "Chest"]))
      .toEqual(["Chest"]);
  });

  it("writes the follow-up outcome to both legacy and versioned answer fields", () => {
    const log = {
      id: "anxiety-1",
      outcomeAfter: null,
      answers: { reaction: "sat-with-it" },
    } as unknown as AnxietyLog;

    expect(withAnxietyOutcome(log, "decreased")).toMatchObject({
      outcomeAfter: "decreased",
      answers: { reaction: "sat-with-it", outcomeAfter: "decreased" },
    });
    expect(withAnxietyOutcome(log, null).answers?.outcomeAfter).toBeNull();
  });

  it("writes null, never blank strings or empty arrays, for unanswered optional answers", () => {
    const answers = buildAnxietyAnswers({
      anxietyTypes: ["Dread"],
      intensity: null,
      bodyLocations: ["Not in one place / not sure"],
      bodyPrediction: "   ",
      urgencyHigh: false,
      context: "",
      triggers: [],
      reassuranceSeeking: [],
      linkedStates: [],
      reaction: "Not yet / just logging",
      note: "",
    });

    expect(answers).toEqual({
      anxietyTypes: ["dread"],
      intensity: null,
      bodyLocations: ["not-in-one-place-not-sure"],
      bodyPrediction: null,
      urgencyHigh: false,
      context: null,
      triggers: null,
      reassuranceSeeking: null,
      linkedStates: null,
      reaction: "not-yet-just-logging",
      note: null,
      outcomeAfter: null,
    });
    expect(Object.values(answers)).not.toContain("");
    expect(Object.values(answers)).not.toContainEqual([]);
  });

  it.each(REACTIONS)("keeps the medical red-flag caveat for reaction: %s", (reaction) => {
    const copy = getAnxietyCompletionCopy(
      reaction,
      false,
      "en",
      (key) => `translated:${key}`,
    );

    expect(copy.message).not.toBe(copy.medicalCaveat);
    expect(copy.medicalCaveat).toBe("translated:anxiety.medical_caveat");
  });

  it("keeps the medical caveat on the urgent completion branch in both languages", () => {
    for (const language of ["en", "nl"] as const) {
      const copy = getAnxietyCompletionCopy(
        "Reached out to someone",
        true,
        language,
        (key) => getTranslation(language, key),
      );
      expect(copy.medicalCaveat).toContain("112");
      expect(copy.message).not.toBe(copy.medicalCaveat);
    }
  });

  it("does not invent primary answers for multi-select Anxiety questions", () => {
    const source = readSource("src/pages/AnxietyTracker.tsx");

    expect(source).toContain('trigger: ""');
    expect(source).toContain('linkedState: ""');
    expect(source).not.toContain("trigger: triggers[0]");
    expect(source).not.toContain("linkedState: linkedStates[0]");
  });
});

describe("Boredom question, branch, and saved-answer semantics", () => {
  it("keeps neutral need and not-yet action answers bilingual", () => {
    expect(getOptionTranslation("en", "not-sure")).toBe("Not sure what would help");
    expect(getOptionTranslation("nl", "not-sure")).toBe("Niet zeker wat zou helpen");
    expect(getOptionTranslation("nl", "Not yet / just logging"))
      .toBe("Nog niet / alleen registreren");
    expect(getTranslation("en", "boredom.q.intensity_note")).toMatch(/^0\s/);
    expect(getTranslation("nl", "boredom.q.intensity_note")).toMatch(/^0\s/);
  });

  it("requires a deliberate stimulation-need answer and preserves a neutral choice", () => {
    expect(canProceedBoredomStep(
      "need",
      ["Bored"],
      [],
      "Yes — this feels like restlessness",
      "",
      "",
      "",
    )).toBe(false);
    expect(canProceedBoredomStep(
      "need",
      ["Bored"],
      ["not-sure"],
      "Yes — this feels like restlessness",
      "",
      "",
      "",
    )).toBe(true);
    expect(toggleBoredomStimulationNeed(["calming"], "not-sure")).toEqual(["not-sure"]);
    expect(toggleBoredomStimulationNeed(["not-sure"], "movement")).toEqual(["movement"]);
  });

  it("saves craving/anxiety classifications after context without forcing an unrelated action", () => {
    expect(isBoredomTrackerConversion("Maybe a craving")).toBe(true);
    expect(isBoredomTrackerConversion("Maybe anxiety")).toBe(true);
    expect(isBoredomTrackerConversion("Maybe loneliness")).toBe(false);
    expect(boredomStepCount("Maybe anxiety")).toBe(3);
    expect(boredomStepCount("Not sure")).toBe(4);
    expect(normalizeBoredomStep("action", "Maybe anxiety")).toBe("situation");
    expect(canProceedBoredomStep(
      "action",
      ["Bored"],
      ["not-sure"],
      "Maybe anxiety",
      "Alone",
      "",
      "",
    )).toBe(true);
    expect(canProceedBoredomStep(
      "action",
      ["Bored"],
      ["not-sure"],
      "Yes — this feels like restlessness",
      "Alone",
      "",
      "",
    )).toBe(false);
    expect(canProceedBoredomStep(
      "action",
      ["Bored"],
      ["not-sure"],
      "Yes — this feels like restlessness",
      "Alone",
      "",
      "Not yet / just logging",
    )).toBe(true);
  });

  it("removes rescue suggestions that duplicate the selected target urge", () => {
    const selected = ["Low-intensity game", "Snack prep", "Short walk"];
    expect(removeIncompatibleBoredomRescues(selected, "Gaming"))
      .toEqual(["Snack prep", "Short walk"]);
    expect(removeIncompatibleBoredomRescues(selected, "Eat"))
      .toEqual(["Low-intensity game", "Short walk"]);
  });

  it("offers a craving follow-up without relabelling a substance-use urge as craving", () => {
    expect(boredomFollowUpTrackers("Yes — this feels like restlessness", "Use substances"))
      .toEqual(["craving"]);
    expect(boredomFollowUpTrackers("Maybe anxiety", "Use substances"))
      .toEqual(["craving", "anxiety"]);
    expect(boredomFollowUpTrackers("Yes — this feels like restlessness", "Gaming"))
      .toEqual([]);
  });

  it("writes null for unanswered optionals and hidden conversion-branch answers", () => {
    const answers = buildBoredomAnswers({
      restlessnessTypes: ["Bored"],
      intensity: null,
      stimulationNeeds: ["not-sure"],
      convertCheck: "Maybe anxiety",
      situation: "Other",
      situationOther: "  Waiting room  ",
      urge: "",
      urgeOther: "hidden text",
      rescueMenu: ["Short walk"],
      action: "Delayed action",
      note: "hidden note",
    });

    expect(answers).toEqual({
      restlessnessTypes: ["bored"],
      intensity: null,
      stimulationNeeds: ["not-sure"],
      convertCheck: "maybe-anxiety",
      situation: "other",
      situationOther: "Waiting room",
      urge: null,
      urgeOther: null,
      rescueMenu: null,
      action: null,
      delayDuration: null,
      note: null,
      outcomeAfter: null,
    });
    expect(Object.values(answers)).not.toContain("");
    expect(Object.values(answers)).not.toContainEqual([]);
  });

  it("keeps required non-conversion answers concrete while nulling blank optionals", () => {
    const answers = buildBoredomAnswers({
      restlessnessTypes: ["Bored"],
      intensity: null,
      stimulationNeeds: ["calming"],
      convertCheck: "Yes — this feels like restlessness",
      situation: "Alone",
      situationOther: "hidden text",
      urge: "",
      urgeOther: "hidden text",
      rescueMenu: [],
      action: "Not yet / just logging",
      note: "  ",
    });

    expect(answers).toMatchObject({
      restlessnessTypes: ["bored"],
      stimulationNeeds: ["calming"],
      convertCheck: "yes-this-feels-like-restlessness",
      situation: "alone",
      situationOther: null,
      urge: null,
      urgeOther: null,
      rescueMenu: null,
      action: "not-yet-just-logging",
      note: null,
    });
  });

  it("writes the follow-up outcome to both legacy and versioned answer fields", () => {
    const log = {
      id: "boredom-1",
      outcomeAfter: null,
      answers: { action: "delayed-action" },
    } as unknown as BoredomLog;

    expect(withBoredomOutcome(log, "same")).toMatchObject({
      outcomeAfter: "same",
      answers: { action: "delayed-action", outcomeAfter: "same" },
    });
    expect(withBoredomOutcome(log, null).answers?.outcomeAfter).toBeNull();
  });

  it("does not record a ten-minute duration merely because the timer was opened", () => {
    const source = readSource("src/pages/BoredomTracker.tsx");
    const openDelay = source.slice(
      source.indexOf("const openDelay"),
      source.indexOf("const openTools"),
    );

    expect(openDelay).not.toContain("delayDuration");
    expect(openDelay.indexOf("await reg.patchSession")).toBeGreaterThan(-1);
    expect(openDelay.indexOf('navigate("/delay")'))
      .toBeGreaterThan(openDelay.indexOf("await reg.patchSession"));
  });

  it("does not invent a primary need for a multi-select Boredom answer", () => {
    const source = readSource("src/pages/BoredomTracker.tsx");

    expect(source).toContain('stimulationNeed: ""');
    expect(source).not.toContain("stimulationNeed: stimulationNeeds[0]");
  });
});

describe("Anxiety and Boredom requirement labels", () => {
  function markupAfter(source: string, translationKey: string, length = 500): string {
    const start = source.indexOf(`t("${translationKey}")`);
    expect(start, `${translationKey} should be rendered`).toBeGreaterThan(-1);
    return source.slice(start, start + length);
  }

  it("keeps the Add note action copy free of a duplicated optional marker", () => {
    expect(getTranslation("en", "common.add_note")).toBe("+ Add note");
    expect(getTranslation("nl", "common.add_note")).toBe("+ Notitie toevoegen");
  });

  it("marks every progression-blocking Anxiety question as required", () => {
    const source = readSource("src/pages/AnxietyTracker.tsx");
    for (const key of [
      "anxiety.q.type",
      "anxiety.q.body",
      "anxiety.q.urgency",
      "anxiety.q.reaction",
    ]) {
      expect(markupAfter(source, key)).toContain('t("common.required")');
    }
  });

  it("keeps every displayed optional Anxiety answer visibly optional", () => {
    const source = readSource("src/pages/AnxietyTracker.tsx");
    for (const key of [
      "anxiety.q.intensity",
      "anxiety.q.prediction",
      "anxiety.q.context",
      "anxiety.q.linked",
      "anxiety.q.patterns",
      "anxiety.q.trigger",
      "anxiety.q.outcome",
      "common.add_note",
    ]) {
      expect(markupAfter(source, key)).toContain('t("common.optional")');
    }
  });

  it("marks every progression-blocking Boredom question and conditional Other field", () => {
    const source = readSource("src/pages/BoredomTracker.tsx");
    for (const key of [
      "boredom.q.type",
      "boredom.q.need",
      "boredom.q.convert",
      "boredom.q.situation",
      "boredom.q.action_handled",
    ]) {
      expect(markupAfter(source, key)).toContain('t("common.required")');
    }
    expect(source).toContain('htmlFor="boredom-situation-other"');
    expect(getTranslation("en", "boredom.other_situation")).toBe("Describe the situation");
    expect(getTranslation("nl", "boredom.other_situation")).toBe("Beschrijf de situatie");
  });

  it("keeps every displayed optional Boredom answer visibly optional", () => {
    const source = readSource("src/pages/BoredomTracker.tsx");
    for (const key of [
      "boredom.q.intensity",
      "boredom.q.urge",
      "boredom.other_urge",
      "boredom.q.action",
      "boredom.q.outcome",
      "common.add_note",
    ]) {
      expect(markupAfter(source, key)).toContain('t("common.optional")');
    }
  });
});
