import { describe, expect, it } from "vitest";
import {
  ACTIVE_REGISTRATION_VERSION,
  parseActiveRegistration,
} from "../src/contexts/activeRegistrationValidation";
import { registrationOptionId } from "../src/lib/canonicalRegistration";
import {
  RELAPSE_NO_CLEAR_TRIGGER_ID,
} from "../src/lib/relapseTrigger";
import { getOptionTranslation } from "../src/lib/translations";
import {
  buildRelapseAnswers,
  createBlankRelapseDraft,
  hasNoClearTrigger,
  toggleNoClearTrigger,
} from "../src/pages/RelapseLog";

function activeRelapse(version: 1 | 2 | typeof ACTIVE_REGISTRATION_VERSION, firstTriggerType: string) {
  const now = 1_700_000_000_000;
  return {
    version,
    type: "relapse",
    route: "/relapse",
    step: "trigger",
    draft: {
      ...createBlankRelapseDraft(),
      firstTriggerType,
    },
    ...(version === 1 ? {} : {
      recordId: `relapse-trigger-v${version}`,
      startedAt: now,
    }),
    updatedAt: now,
  };
}

describe("Relapse no-clear-trigger stable ID", () => {
  it("writes the distinct v3 ID and keeps the generic Boredom label independent", () => {
    const draft = toggleNoClearTrigger(createBlankRelapseDraft());

    expect(draft.firstTriggerType).toBe(RELAPSE_NO_CLEAR_TRIGGER_ID);
    expect(hasNoClearTrigger(draft)).toBe(true);
    expect(buildRelapseAnswers(draft).firstTriggerType).toBe(RELAPSE_NO_CLEAR_TRIGGER_ID);
    expect(getOptionTranslation("en", RELAPSE_NO_CLEAR_TRIGGER_ID))
      .toBe("No clear trigger / not sure");
    expect(getOptionTranslation("nl", RELAPSE_NO_CLEAR_TRIGGER_ID))
      .toBe("Geen duidelijke aanleiding / niet zeker");
    expect(getOptionTranslation("en", "not-sure")).toBe("Not sure what would help");
    expect(getOptionTranslation("nl", "not-sure")).toBe("Niet zeker wat zou helpen");
  });

  it.each([1, 2] as const)("migrates a v%s active Relapse draft from the legacy ID", (version) => {
    const parsed = parseActiveRegistration(activeRelapse(version, "not-sure"));

    expect(parsed).toMatchObject({
      ok: true,
      migrated: true,
      value: {
        version: ACTIVE_REGISTRATION_VERSION,
        draft: { firstTriggerType: RELAPSE_NO_CLEAR_TRIGGER_ID },
      },
    });
  });

  it("accepts only the distinct ID in a current active draft", () => {
    expect(parseActiveRegistration(
      activeRelapse(ACTIVE_REGISTRATION_VERSION, RELAPSE_NO_CLEAR_TRIGGER_ID),
    )).toMatchObject({ ok: true });
    expect(parseActiveRegistration(
      activeRelapse(ACTIVE_REGISTRATION_VERSION, "not-sure"),
    )).toMatchObject({
      ok: false,
      error: "Active-registration draft has an invalid shape.",
    });
  });

  it("maps only v1/v2 completed Relapse answers to the new display ID", () => {
    expect(registrationOptionId({
      dataVersion: 2,
      answers: { firstTriggerType: "not-sure" },
    }, "firstTriggerType")).toBe(RELAPSE_NO_CLEAR_TRIGGER_ID);
    expect(registrationOptionId({
      dataVersion: 1,
    }, "firstTriggerType", "not-sure")).toBe(RELAPSE_NO_CLEAR_TRIGGER_ID);
    expect(registrationOptionId({
      dataVersion: 3,
      answers: { firstTriggerType: RELAPSE_NO_CLEAR_TRIGGER_ID },
    }, "firstTriggerType")).toBe(RELAPSE_NO_CLEAR_TRIGGER_ID);
    expect(registrationOptionId({
      dataVersion: 3,
      answers: { firstTriggerType: "not-sure" },
    }, "firstTriggerType")).toBe("not-sure");
  });
});
