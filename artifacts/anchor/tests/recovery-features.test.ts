import { describe, expect, it } from "vitest";
import {
  DEFAULT_HOME_PREFERENCES,
  HOME_WIDGET_IDS,
  MAX_SUPPORTED_TIMESTAMP,
  localizedCallMessage,
  parseFeatureRecord,
  parseHomePreferences,
  parseRecoveryPlan,
} from "../src/lib/recoveryFeatures";

describe("recovery feature contracts", () => {
  it("completes a partial Home order and limits preferred tools to two", () => {
    const parsed = parseHomePreferences({
      version: 1,
      widgetOrder: ["pinned-tools", "quick-registration", "pinned-tools", "unknown"],
      hiddenWidgets: ["cigarettes", "unknown"],
      hiddenRegistrationTypes: ["trek", "craving", "boredom", "anxiety", "relapse"],
      pinnedContactId: "contact-1",
      pinnedToolIds: ["/tools/breathing", "/tools/grounding", "/tools/tape"],
    });

    expect(parsed.widgetOrder.slice(0, 2)).toEqual(["pinned-tools", "quick-registration"]);
    expect(new Set(parsed.widgetOrder)).toEqual(new Set(HOME_WIDGET_IDS));
    expect(parsed.hiddenWidgets).toEqual(["cigarettes"]);
    expect(parsed.hiddenRegistrationTypes).toHaveLength(4);
    expect(parsed.pinnedToolIds).toEqual(["/tools/breathing", "/tools/grounding"]);
  });

  it("uses safe defaults for malformed recovery-plan content", () => {
    const parsed = parseRecoveryPlan({
      warningSigns: "not-an-array",
      reasonsForRecovery: ["My health"],
      situationsToAvoid: [],
      callMessage: 42,
      next24Hours: [],
      updatedAt: "yesterday",
    });

    expect(parsed.warningSigns).toEqual([]);
    expect(parsed.reasonsForRecovery).toEqual(["My health"]);
    expect(parsed.callMessage).toContain("call me");
    expect(parsed.updatedAt).toBeNull();
  });

  it("accepts a complete quick registration and rejects an invalid safety answer", () => {
    const valid = {
      id: "quick-1",
      recordType: "quick-registration",
      timestamp: 100,
      updatedAt: 100,
      registrationType: "craving",
      intensity: 7,
      immediateSafety: "need-support",
      chosenAction: "contact-someone",
      chosenActionOther: "",
      note: "",
      reflectionStatus: "pending",
      reflectionDueAt: 200,
      reflectionStartedAt: null,
      reflectionCompletedAt: null,
      linkedDetailedRecordId: null,
    };

    expect(parseFeatureRecord(valid)).toEqual(valid);
    expect(parseFeatureRecord({ ...valid, immediateSafety: "unknown" })).toBeNull();
    expect(parseFeatureRecord({ ...valid, timestamp: MAX_SUPPORTED_TIMESTAMP + 1 })).toBeNull();
  });

  it("localizes only the untouched prepared message and preserves personal wording", () => {
    expect(localizedCallMessage("Can you call me? I could use some support right now.", "nl"))
      .toBe("Kun je me bellen? Ik kan nu wat steun gebruiken.");
    expect(localizedCallMessage("Bel mij alsjeblieft om 20:00", "en"))
      .toBe("Bel mij alsjeblieft om 20:00");
  });

  it("restores the complete default Home catalog from an empty value", () => {
    expect(parseHomePreferences(null)).toEqual(DEFAULT_HOME_PREFERENCES);
  });
});
