import { describe, expect, it } from "vitest";
import {
  detailsFor,
  formatDetailItems,
  registrationEntriesForHistory,
} from "../src/components/RegistrationHistory";
import { migrateRelapseFollowUpAnswers } from "../src/db/migrations";
import { getOptionTranslation, type Language } from "../src/lib/translations";

function detailItems(entry: unknown, labelKey: string) {
  return detailsFor(entry as never).find((detail) => detail.labelKey === labelKey)?.items ?? [];
}

function renderedDetail(entry: unknown, labelKey: string, language: Language): string {
  return formatDetailItems(
    detailItems(entry, labelKey),
    (value) => getOptionTranslation(language, value),
  );
}

describe("Registration History canonical detail rows", () => {
  it("keeps Relapse phase-specific help answers separate and respects canonical null", () => {
    const details = detailsFor({
      _type: "relapse",
      dataVersion: 2,
      answers: {
        couldHaveHelpedEarly: ["text-or-call-someone"],
        couldHaveHelpedMiddle: null,
        couldHaveHelpedLast: ["leave-the-trigger-place"],
      },
      couldHaveHelpedEarly: ["Legacy early"],
      couldHaveHelpedMiddle: ["Legacy middle must stay hidden"],
      couldHaveHelpedLast: ["Stale legacy must stay hidden"],
    } as never);

    expect(details.find((detail) => detail.labelKey === "logs.detail.could_help_early")?.items)
      .toEqual([{ kind: "option", value: "text-or-call-someone" }]);
    expect(details.find((detail) => detail.labelKey === "logs.detail.could_help_middle")?.items)
      .toEqual([]);
    expect(details.find((detail) => detail.labelKey === "logs.detail.could_help_last")?.items)
      .toEqual([{ kind: "option", value: "leave-the-trigger-place" }]);
    expect(details.some((detail) => detail.labelKey === "logs.detail.could_help")).toBe(false);

    const legacy = detailsFor({
      _type: "relapse",
      dataVersion: 1,
      couldHaveHelpedEarly: ["Text or call someone"],
      couldHaveHelpedMiddle: ["Leave the trigger place"],
      couldHaveHelpedLast: [],
    } as never);
    expect(legacy.find((detail) => detail.labelKey === "logs.detail.could_help_middle")?.items)
      .toEqual([{ kind: "option", value: "leave-the-trigger-place" }]);
  });

  it("renders an explicit emotion-after zero but hides canonical null and supports pre-v2", () => {
    const values = (entry: unknown) => detailsFor(entry as never)
      .find((detail) => detail.labelKey === "logs.detail.emotion_after")?.items
      .map((item) => item.value) ?? [];

    expect(values({
      _type: "relapse",
      dataVersion: 2,
      answers: { emotionAfter: 0 },
      emotionAfter: 9,
    })).toEqual([0]);
    expect(values({
      _type: "relapse",
      dataVersion: 3,
      answers: { emotionAfter: null },
      emotionAfter: 9,
    })).toEqual([]);
    expect(values({ _type: "relapse", emotionAfter: 4 })).toEqual([4]);
    expect(values({
      ...migrateRelapseFollowUpAnswers({
        dataVersion: 2,
        answers: { emotionAfter: null },
        emotionAfter: 0,
      }),
      _type: "relapse",
    })).toEqual([0]);
  });

  it.each(["en", "nl"] as const)(
    "keeps ID-looking free text literal in every mixed History flow while translating options in %s",
    (language) => {
      const cases = [
        {
          entry: {
            _type: "craving",
            dataVersion: 3,
            answers: {
              onsetType: "other",
              onsetOther: "urge-surfing",
              chosenAction: "urge-surfing",
            },
          },
          labelKey: "logs.detail.onset",
          optionId: "other",
          literal: "urge-surfing",
        },
        {
          entry: {
            _type: "trek",
            dataVersion: 3,
            answers: { triggers: ["other"], triggerNote: "not-sure" },
          },
          labelKey: "logs.detail.trigger",
          optionId: "other",
          literal: "not-sure",
        },
        {
          entry: {
            _type: "boredom",
            dataVersion: 3,
            answers: { urge: "other-stimulation", urgeOther: "none" },
          },
          labelKey: "logs.detail.urge",
          optionId: "other-stimulation",
          literal: "none",
        },
        {
          entry: {
            _type: "relapse",
            dataVersion: 3,
            answers: {
              preUseFactors: ["too-much-self-confidence"],
              leadUpContext: "other",
            },
          },
          labelKey: "logs.detail.lead_up",
          optionId: "too-much-self-confidence",
          literal: "other",
        },
      ];

      for (const { entry, labelKey, optionId, literal } of cases) {
        expect(detailItems(entry, labelKey)).toEqual([
          { kind: "option", value: optionId },
          { kind: "literal", value: literal },
        ]);
        expect(renderedDetail(entry, labelKey, language)).toBe(
          `${getOptionTranslation(language, optionId)}, ${literal}`,
        );
      }

      const craving = cases[0].entry;
      expect(renderedDetail(craving, "logs.detail.action", language)).toBe(
        language === "nl" ? "Gevoelsurfen" : "Urge surfing",
      );
      expect(renderedDetail(craving, "logs.detail.onset", language)).toContain("urge-surfing");
      expect(renderedDetail(craving, "logs.detail.onset", language)).not.toContain("Urge surfing");
      expect(renderedDetail(craving, "logs.detail.onset", language)).not.toContain("Gevoelsurfen");
    },
  );
});

describe("Registration History completed-status boundary", () => {
  it("never merges Craving or Relapse drafts into user-facing History", () => {
    const entries = registrationEntriesForHistory({
      cravingLogs: [
        { id: "craving-done", status: "completed", cravingType: "passive" },
        { id: "craving-draft", status: "draft", cravingType: "passive" },
      ],
      relapseLogs: [
        { id: "relapse-done", status: "completed" },
        { id: "relapse-draft", status: "draft" },
      ],
      anxietyLogs: [],
      boredomLogs: [],
    } as never);

    expect(entries.map((entry) => entry.id)).toEqual(["craving-done", "relapse-done"]);
  });
});
