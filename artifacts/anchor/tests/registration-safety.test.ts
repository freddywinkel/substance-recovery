import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getSubstanceSafetyWarnings,
  getUrgentSafetyCopy,
} from "../src/lib/registrationSafety";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("registration safety copy", () => {
  it.each(["en", "nl"] as const)("keeps an explicit 112 route in %s", (language) => {
    const copy = getUrgentSafetyCopy(language);

    expect(copy.call112).toContain("112");
    expect(copy.emergency).toContain("112");
    expect(copy.assessmentLimit).not.toBe("");
  });

  it("returns cautious warnings for every selected high-risk substance", () => {
    const warnings = getSubstanceSafetyWarnings(
      ["Alcohol", "BENZODIAZEPINES", "Opioids", "Cannabis"],
      "en",
    );

    expect(warnings.map(({ key }) => key)).toEqual([
      "alcohol",
      "benzodiazepines",
      "opioids",
    ]);
    for (const warning of warnings) {
      expect(warning.body).toContain("112");
    }
  });

  it("does not invent a substance-specific warning for an unselected category", () => {
    expect(getSubstanceSafetyWarnings(["Cannabis", "Gaming"], "nl")).toEqual([]);
  });

  it.each(["CravingTracker", "TrekTracker"])(
    "keeps immediate 112 and substance guidance on the %s used-event screen",
    (tracker) => {
      const trackerSource = source(`src/pages/${tracker}.tsx`);
      const outcomeStep = trackerSource.lastIndexOf('{step === "outcome" && (');
      const immediateEmergencyLink = trackerSource.indexOf('href="tel:112"', outcomeStep);
      const immediateWarnings = trackerSource.indexOf(
        "getSubstanceSafetyWarnings(draft.substances, language)",
        outcomeStep,
      );

      expect(trackerSource).toContain('draft.useOutcome === "used"');
      expect(outcomeStep).toBeGreaterThan(-1);
      expect(immediateEmergencyLink).toBeGreaterThan(outcomeStep);
      expect(immediateWarnings).toBeGreaterThan(outcomeStep);
    },
  );

  it("places Relapse acute-risk screening inside the first step", () => {
    const relapseSource = source("src/pages/RelapseLog.tsx");
    const labelStep = relapseSource.indexOf('{step === "label" && (');
    const riskQuestion = relapseSource.indexOf('t("relapse.q.risk")', labelStep);
    const whenStep = relapseSource.indexOf('{step === "when" && (', riskQuestion);

    expect(labelStep).toBeGreaterThan(-1);
    expect(riskQuestion).toBeGreaterThan(labelStep);
    expect(whenStep).toBeGreaterThan(riskQuestion);
    expect(relapseSource).toContain('case "label":   return draft.acuteRisk !== "unanswered";');
  });

  it("keeps optional Relapse answers genuinely unanswered", () => {
    const relapseSource = source("src/pages/RelapseLog.tsx");
    const whenGateStart = relapseSource.indexOf('case "when":');
    const whenGateEnd = relapseSource.indexOf('case "trigger":', whenGateStart);
    const whenGate = relapseSource.slice(whenGateStart, whenGateEnd);

    expect(relapseSource).toContain('episodeDuration: "unanswered"');
    expect(relapseSource).toContain('amountCategory: "unanswered"');
    expect(relapseSource).toContain('emotionAfter: null');
    expect(whenGate).not.toContain("substances.length");
  });

  it.each([
    "CravingTracker",
    "TrekTracker",
    "AnxietyTracker",
    "BoredomTracker",
    "RelapseLog",
  ])("writes the versioned answer envelope from %s", (tracker) => {
    const trackerSource = source(`src/pages/${tracker}.tsx`);

    expect(trackerSource).toContain("dataVersion: 2");
    expect(trackerSource).toContain('contentVersion: "registration-v2"');
    expect(trackerSource).toContain("answers: {");
  });
});
