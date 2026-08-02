import { describe, expect, it } from "vitest";
import { validateImportedStoreRecord } from "../src/db/validation";
import {
  buildBoredomAnswers,
  canProceedBoredomStep,
} from "../src/pages/BoredomTracker";
import { readSource } from "./helpers/sourceContracts";

function answersFor(urge: string, urgeOther: string) {
  return buildBoredomAnswers({
    restlessnessTypes: ["Bored"],
    intensity: null,
    stimulationNeeds: ["not-sure"],
    convertCheck: "classification-not-sure",
    situation: "Doing nothing",
    situationOther: "",
    urge,
    urgeOther,
    rescueMenu: [],
    action: "Not yet / just logging",
    note: "",
  });
}

function boredomV3Record(answers: ReturnType<typeof answersFor>) {
  return {
    id: "boredom-urge-other",
    timestamp: 1_700_000_000_000,
    status: "completed",
    intensity: null,
    feelingTypes: ["Bored"],
    situation: "Doing nothing",
    situationOther: "",
    urge: answers.urge === "other-stimulation" ? "Other stimulation" : "Gaming",
    urgeOther: typeof answers.urgeOther === "string" ? answers.urgeOther : "",
    action: "Not yet / just logging",
    delayDuration: null,
    note: "",
    stimulationNeed: "",
    restlessnessTypes: ["Bored"],
    stimulationNeeds: ["not-sure"],
    rescueMenu: [],
    convertCheck: "classification-not-sure",
    environmentReset: [],
    outcomeAfter: null,
    dataVersion: 3,
    contentVersion: "registration-v3",
    answers,
  };
}

describe("Boredom optional custom urge", () => {
  it("keeps the custom-text control explicitly optional in the tracker", () => {
    const source = readSource("src/pages/BoredomTracker.tsx");

    expect(source).toContain('{t("boredom.other_urge")} ({t("common.optional")})');
  });

  it("labels the custom situation as required and gates blank text", () => {
    const source = readSource("src/pages/BoredomTracker.tsx");

    expect(source).toContain('{t("boredom.other_situation")} ({t("common.required")})');
    expect(canProceedBoredomStep(
      "situation",
      ["Bored"],
      ["not-sure"],
      "classification-not-sure",
      "Other",
      "   ",
      "Not yet / just logging",
    )).toBe(false);
    expect(canProceedBoredomStep(
      "situation",
      ["Bored"],
      ["not-sure"],
      "classification-not-sure",
      "Other",
      "Waiting room",
      "Not yet / just logging",
    )).toBe(true);
  });

  it("accepts Other stimulation with an intentionally blank custom description", () => {
    const answers = answersFor("Other stimulation", "   ");

    expect(answers).toMatchObject({
      urge: "other-stimulation",
      urgeOther: null,
    });
    expect(validateImportedStoreRecord(
      "boredomLogs",
      boredomV3Record(answers),
    )).toMatchObject({ ok: true });
  });

  it("accepts and preserves supplied custom urge text", () => {
    const answers = answersFor("Other stimulation", "  Watching short videos  ");
    const result = validateImportedStoreRecord(
      "boredomLogs",
      boredomV3Record(answers),
    );

    expect(answers.urgeOther).toBe("Watching short videos");
    expect(result).toMatchObject({
      ok: true,
      value: {
        answers: { urgeOther: "Watching short videos" },
      },
    });
  });

  it("nulls hidden UI text and rejects hidden text supplied by an import", () => {
    const answers = answersFor("Gaming", "stale hidden text");

    expect(answers).toMatchObject({ urge: "gaming", urgeOther: null });
    expect(validateImportedStoreRecord(
      "boredomLogs",
      boredomV3Record(answers),
    )).toMatchObject({ ok: true });

    expect(validateImportedStoreRecord("boredomLogs", boredomV3Record({
      ...answers,
      urgeOther: "stale hidden text",
    }))).toEqual({
      ok: false,
      error: "dataVersion 3 Boredom urgeOther requires urge other-stimulation",
    });
  });
});
