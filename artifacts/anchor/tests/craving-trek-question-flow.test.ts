import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  buildCravingAnswers,
  createBlankCravingDraft,
  navigateAfterCravingReturnSaved,
  normalizedIntensityAfter,
  shouldShowMedicalSafetyForTargets as shouldShowCravingMedicalSafety,
  toggleCravingSituationSelection,
} from "../src/pages/CravingTracker";
import {
  buildTrekAnswers,
  confidenceAfterForAttempt,
  createBlankTrekDraft,
  navigateAfterTrekReturnSaved,
  shouldShowMedicalSafetyForTargets as shouldShowTrekMedicalSafety,
  toggleTrekNeedSelection,
  toggleTrekTypeSelection,
  toggleTrekTriggerSelection,
} from "../src/pages/TrekTracker";
import { parseActiveRegistration } from "../src/contexts/activeRegistrationValidation";

function source(file: string): string {
  return readFileSync(resolve(process.cwd(), `src/pages/${file}.tsx`), "utf8");
}

function canonicalSession(type: "craving" | "trek") {
  const route = type === "craving" ? "/craving" : "/trek";
  const step = type === "craving" ? "onset" : "type";
  const parsed = parseActiveRegistration({
    version: 1,
    type,
    route,
    step,
    draft: {},
    updatedAt: 1_700_000_000_000,
  });
  if (!parsed.ok || !parsed.value) throw new Error(`Expected a canonical ${type} session`);
  return parsed.value;
}

function parseWithDraft(
  type: "craving" | "trek",
  updates: Record<string, unknown>,
) {
  const session = canonicalSession(type);
  return parseActiveRegistration({
    ...session,
    draft: { ...(session.draft as Record<string, unknown>), ...updates },
  });
}

function expectRequiredMarker(page: string, translationKey: string) {
  const label = `t("${translationKey}")`;
  const start = page.indexOf(label);
  expect(start, `${translationKey} must be rendered`).toBeGreaterThan(-1);
  expect(page.slice(start, start + 350), `${translationKey} must be visibly required`)
    .toContain("<RequiredMarker language={language} />");
}

describe("Craving and Trek question-flow semantics", () => {
  it("keeps the unknown Trek form exclusive with specific approach forms", () => {
    expect(toggleTrekTypeSelection(["approach-mental-rehearsal"], "approach-not-sure"))
      .toEqual(["approach-not-sure"]);
    expect(toggleTrekTypeSelection(["approach-not-sure"], "approach-moving-toward"))
      .toEqual(["approach-moving-toward"]);
  });

  it.each([
    ["Craving", shouldShowCravingMedicalSafety],
    ["Trek", shouldShowTrekMedicalSafety],
  ] as const)("keeps medical copy target-aware in %s", (_name, shouldShowMedicalSafety) => {
    expect(shouldShowMedicalSafety([])).toBe(true);
    expect(shouldShowMedicalSafety(["Alcohol"])).toBe(true);
    expect(shouldShowMedicalSafety(["Gaming", "Gambling"])).toBe(false);
    expect(shouldShowMedicalSafety(["Gaming", "Opioids"])).toBe(true);
  });

  it("clears a Craving intensity follow-up when its outcome no longer supports it", () => {
    expect(normalizedIntensityAfter("decreased", 0)).toBe(0);
    expect(normalizedIntensityAfter("same", 6)).toBe(6);
    expect(normalizedIntensityAfter("dont-know", 6)).toBeNull();
    expect(normalizedIntensityAfter("", 6)).toBeNull();
  });

  it("stores Trek confidence-after only for a reported action attempt", () => {
    expect(confidenceAfterForAttempt(true, 0)).toBe(0);
    expect(confidenceAfterForAttempt(true, null)).toBeNull();
    expect(confidenceAfterForAttempt(false, 8)).toBeNull();
    expect(confidenceAfterForAttempt(null, 8)).toBeNull();
  });

  it("treats Craving's no-clear-situation answer as mutually exclusive", () => {
    const unknown = "No clear situation / not sure";

    expect(toggleCravingSituationSelection(["Home alone", "Under stress"], unknown)).toEqual([unknown]);
    expect(toggleCravingSituationSelection([unknown], "Home alone")).toEqual(["Home alone"]);
    expect(toggleCravingSituationSelection([unknown], unknown)).toEqual([]);
  });

  it("treats Trek's no-clear-trigger answer as mutually exclusive", () => {
    const unknown = "No clear trigger / not sure";

    expect(toggleTrekTriggerSelection(["Boredom", "Stress"], unknown)).toEqual([unknown]);
    expect(toggleTrekTriggerSelection([unknown], "Stress")).toEqual(["Stress"]);
    expect(toggleTrekTriggerSelection([unknown], unknown)).toEqual([]);
  });

  it("keeps an unknown Trek need distinct and mutually exclusive", () => {
    expect(toggleTrekNeedSelection(["Relief", "Connection"], "Not sure"))
      .toEqual(["Not sure"]);
    expect(toggleTrekNeedSelection(["Not sure"], "Relief")).toEqual(["Relief"]);
    expect(toggleTrekNeedSelection(["Not sure"], "Not sure")).toEqual([]);
  });

  it("writes null—not empty strings or arrays—for unanswered optional Craving answers", () => {
    const draft = createBlankCravingDraft();
    Object.assign(draft, {
      onsetType: "Random / no reason",
      situationPresets: ["No clear situation / not sure"],
      buildupDuration: "just-started",
      chosenAction: "just-observed",
      actionAttempted: false,
      useOutcome: "unsure",
    });

    expect(buildCravingAnswers(draft)).toEqual({
      registrationType: "craving",
      onsetType: "random-no-reason",
      onsetOther: null,
      intensity: null,
      confidenceBefore: null,
      situations: ["no-clear-situation-not-sure"],
      situationOther: null,
      physicalSensations: null,
      buildupDuration: "just-started",
      location: null,
      emotions: null,
      emotionOther: null,
      thoughts: null,
      thoughtOther: null,
      targets: null,
      chosenAction: "just-observed",
      actionAttempted: false,
      useOutcome: "unsure",
      cravingOutcome: null,
      intensityAfter: null,
    });
  });

  it("writes null—not empty strings or arrays—for unanswered optional Trek answers", () => {
    const draft = createBlankTrekDraft();
    Object.assign(draft, {
      trekTypes: ["approach-automatic-routine"],
      planningStage: "immediacy-thoughts-only",
      triggers: ["No clear trigger / not sure"],
      needTypes: ["Not sure"],
      chosenAction: "just-observe",
      actionAttempted: false,
      confidenceAfter: 8,
      useOutcome: "unsure",
    });

    expect(buildTrekAnswers(draft)).toEqual({
      registrationType: "trek",
      trekTypes: ["approach-automatic-routine"],
      intensity: null,
      confidenceBefore: null,
      planningStage: "immediacy-thoughts-only",
      location: null,
      locationOther: null,
      triggers: ["no-clear-trigger-not-sure"],
      triggerNote: null,
      emotions: null,
      emotionOther: null,
      physicalSensations: null,
      thoughts: null,
      thoughtFreeText: null,
      needs: ["not-sure"],
      needOther: null,
      targets: null,
      chosenAction: "just-observe",
      actionAttempted: false,
      confidenceAfter: null,
      useOutcome: "unsure",
    });
  });

  it("keeps optional Trek location skippable", () => {
    const trek = source("TrekTracker");
    const planningGate = trek.match(/case "planning": return ([^;]+);/)?.[1] ?? "";

    expect(trek).toContain("contentVersion: CURRENT_REGISTRATION_CONTENT_VERSION");
    expect(planningGate).not.toContain('draft.location !== ""');
    expect(planningGate).toContain('draft.location !== "Other"');
  });

  it("keeps Trek needs and targets plural without inventing a primary answer", () => {
    const trek = source("TrekTracker");
    const draft = createBlankTrekDraft();
    draft.needTypes = ["Relief", "Connection"];
    draft.substances = ["Alcohol", "Gaming"];

    expect(trek).toContain('needType: ""');
    expect(trek).not.toContain("needType: draft.needTypes[0]");
    expect(trek).toContain('primarySubstance: ""');
    expect(trek).not.toContain("primarySubstance: draft.substances[0]");
    expect(buildTrekAnswers(draft)).toMatchObject({
      needs: ["relief", "connection"],
      targets: ["alcohol", "gaming"],
    });
  });

  it("does not retain hidden Trek after-action data", () => {
    const trek = source("TrekTracker");

    expect(trek).toContain('draft.actionAttempted === true && (');
    expect(trek).toContain("confidenceAfter: confidenceAfterForAttempt(item.value, prev.confidenceAfter)");
    expect(trek).toContain("confidenceAfter: null");
  });

  it("keeps both inner-experience steps genuinely optional", () => {
    const craving = source("CravingTracker");
    const trek = source("TrekTracker");

    expect(craving).toContain('case "inner":   return true;');
    expect(trek).toContain('case "inner":    return true;');
    expect(craving.match(/t\("common\.optional"\)/g)?.length ?? 0).toBeGreaterThanOrEqual(6);
    expect(trek.match(/t\("common\.optional"\)/g)?.length ?? 0).toBeGreaterThanOrEqual(6);
  });

  it("visibly marks every progression-blocking Craving question", () => {
    const craving = source("CravingTracker");
    for (const key of [
      "craving.q.onset",
      "craving.q.situation",
      "craving.q.buildup",
      "craving.q.action",
      "tracker.action.attempted_q",
      "tracker.outcome.q",
    ]) {
      expectRequiredMarker(craving, key);
    }
    for (const id of ["craving-onset-other", "craving-situation-other"]) {
      const at = craving.indexOf(`htmlFor="${id}"`);
      expect(at, `${id} must have a label`).toBeGreaterThan(-1);
      const field = craving.slice(at, at + 700);
      expect(field).toContain("<RequiredMarker language={language} />");
      expect(field).toContain(`id="${id}"`);
      expect(field).toContain('aria-required="true"');
    }
  });

  it("visibly marks every progression-blocking Trek question", () => {
    const trek = source("TrekTracker");
    for (const key of [
      "trek.q.type",
      "trek.q.planning",
      "trek.q.trigger",
      "trek.q.need",
      "trek.q.action",
      "tracker.action.attempted_q",
      "tracker.outcome.q",
    ]) {
      expectRequiredMarker(trek, key);
    }
    for (const id of ["trek-location-other", "trek-trigger-other", "trek-need-other"]) {
      const at = trek.indexOf(`htmlFor="${id}"`);
      expect(at, `${id} must have a label`).toBeGreaterThan(-1);
      const field = trek.slice(at, at + 700);
      expect(field).toContain("<RequiredMarker language={language} />");
      expect(field).toContain(`id="${id}"`);
      expect(field).toContain('aria-required="true"');
    }
  });

  it.each([
    ["Craving", navigateAfterCravingReturnSaved],
    ["Trek", navigateAfterTrekReturnSaved],
  ] as const)("does not leave %s when its return target cannot be saved", async (_name, openAfterSave) => {
    const navigate = vi.fn();

    await expect(openAfterSave(async () => false, navigate)).resolves.toBe(false);
    expect(navigate).not.toHaveBeenCalled();

    await expect(openAfterSave(async () => { throw new Error("write failed"); }, navigate)).resolves.toBe(false);
    expect(navigate).not.toHaveBeenCalled();

    await expect(openAfterSave(async () => true, navigate)).resolves.toBe(true);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it("rejects persisted no-clear answers combined with specific answers", () => {
    expect(parseWithDraft("craving", {
      situationPresets: ["No clear situation / not sure", "Home alone"],
    })).toMatchObject({ ok: false, error: "Active-registration draft has an invalid shape." });
    expect(parseWithDraft("trek", {
      triggers: ["No clear trigger / not sure", "Stress"],
    })).toMatchObject({ ok: false, error: "Active-registration draft has an invalid shape." });
  });

  it.each([
    ["craving", "physicalSensations", ["Restlessness", "Chest tightness", "Head pressure", "Nausea"]],
    ["craving", "emotions", ["Anxious", "Tense", "Low / sad", "Empty"]],
    ["craving", "thoughtPresets", ["I can't handle this", "Just one won't matter", "No one will notice"]],
    ["trek", "trekTypes", ["approach-mental-rehearsal", "approach-checking-availability", "approach-automatic-routine"]],
    ["trek", "physicalSensations", ["Restlessness", "Chest tightness", "Head pressure", "Nausea"]],
    ["trek", "emotions", ["Anxious", "Tense", "Low / sad", "Empty"]],
    ["trek", "thoughtPresets", ["I can't handle this", "Just one won't matter", "No one will notice"]],
  ] as const)("rejects persisted %s.%s selections over the visible cap", (type, field, values) => {
    expect(parseWithDraft(type, { [field]: values.slice(0, -1) })).toMatchObject({ ok: true });
    expect(parseWithDraft(type, { [field]: [...values] })).toMatchObject({
      ok: false,
      error: "Active-registration draft has an invalid shape.",
    });
  });
});
