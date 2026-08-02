import { describe, expect, it } from "vitest";
import {
  ACTIVE_REGISTRATION_VERSION,
  parseActiveRegistration,
  type ActiveRegistration,
} from "../src/contexts/activeRegistrationValidation";
import { detailsFor } from "../src/components/RegistrationHistory";
import {
  BOREDOM_CLASSIFICATION_NOT_SURE_ID,
} from "../src/lib/boredomClassification";
import { getOptionTranslation } from "../src/lib/translations";
import { buildBoredomAnswers } from "../src/pages/BoredomTracker";

function currentBlankBoredom(): ActiveRegistration {
  const result = parseActiveRegistration({
    version: 1,
    type: "boredom",
    route: "/boredom",
    step: "need",
    draft: {},
    updatedAt: 1_700_000_000_000,
  });
  if (!result.ok || !result.value) throw new Error("Expected Boredom migration to succeed");
  return result.value;
}

function withClassification(
  session: ActiveRegistration,
  convertCheck: string,
): ActiveRegistration {
  return {
    ...session,
    draft: {
      ...(session.draft as Record<string, unknown>),
      stimulationNeeds: ["not-sure"],
      convertCheck,
    },
  };
}

describe("Boredom classification stable ID", () => {
  it("writes a distinct classification ID without changing the need ID", () => {
    const answers = buildBoredomAnswers({
      restlessnessTypes: ["Bored"],
      intensity: null,
      stimulationNeeds: ["not-sure"],
      convertCheck: BOREDOM_CLASSIFICATION_NOT_SURE_ID,
      situation: "Doing nothing",
      situationOther: "",
      urge: "",
      urgeOther: "",
      rescueMenu: [],
      action: "Not yet / just logging",
      note: "",
    });

    expect(answers.convertCheck).toBe(BOREDOM_CLASSIFICATION_NOT_SURE_ID);
    expect(answers.stimulationNeeds).toEqual(["not-sure"]);
  });

  it.each(["Not sure", "not-sure"])(
    "normalizes a current active-draft %s classification in place",
    (legacyValue) => {
      const parsed = parseActiveRegistration(withClassification(
        currentBlankBoredom(),
        legacyValue,
      ));

      expect(parsed).toMatchObject({
        ok: true,
        migrated: true,
        value: {
          version: ACTIVE_REGISTRATION_VERSION,
          draft: {
            convertCheck: BOREDOM_CLASSIFICATION_NOT_SURE_ID,
            stimulationNeeds: ["not-sure"],
          },
        },
      });
    },
  );

  it.each([1, 2] as const)("normalizes the v%s active-draft classification", (version) => {
    const current = withClassification(currentBlankBoredom(), "not-sure");
    const parsed = parseActiveRegistration({ ...current, version });

    expect(parsed).toMatchObject({
      ok: true,
      migrated: true,
      value: {
        draft: {
          convertCheck: BOREDOM_CLASSIFICATION_NOT_SURE_ID,
          stimulationNeeds: ["not-sure"],
        },
      },
    });
  });

  it("keeps History meanings separate and applies compatibility only before v3", () => {
    const rows = (entry: unknown) => detailsFor(entry as never);
    const classification = (entry: unknown) => rows(entry)
      .find((detail) => detail.labelKey === "logs.detail.classification")?.items[0]?.value;
    const need = (entry: unknown) => rows(entry)
      .find((detail) => detail.labelKey === "logs.detail.need")?.items.map((item) => item.value);

    const old = {
      _type: "boredom",
      dataVersion: 2,
      answers: {
        convertCheck: "not-sure",
        stimulationNeeds: ["not-sure"],
      },
    };
    expect(classification(old)).toBe(BOREDOM_CLASSIFICATION_NOT_SURE_ID);
    expect(need(old)).toEqual(["not-sure"]);

    const current = {
      _type: "boredom",
      dataVersion: 3,
      answers: {
        convertCheck: BOREDOM_CLASSIFICATION_NOT_SURE_ID,
        stimulationNeeds: ["not-sure"],
      },
    };
    expect(classification(current)).toBe(BOREDOM_CLASSIFICATION_NOT_SURE_ID);
    expect(need(current)).toEqual(["not-sure"]);

    expect(classification({
      _type: "boredom",
      dataVersion: 3,
      answers: { convertCheck: "not-sure" },
    })).toBe("not-sure");
  });

  it("displays classification, need, and tracker labels with their own wording", () => {
    expect(getOptionTranslation("en", BOREDOM_CLASSIFICATION_NOT_SURE_ID)).toBe("Not sure");
    expect(getOptionTranslation("nl", BOREDOM_CLASSIFICATION_NOT_SURE_ID)).toBe("Niet zeker");
    expect(getOptionTranslation("en", "not-sure")).toBe("Not sure what would help");
    expect(getOptionTranslation("nl", "not-sure")).toBe("Niet zeker wat zou helpen");
    expect(getOptionTranslation("nl", "urge-surfing")).toBe("Gevoelsurfen");
  });
});
