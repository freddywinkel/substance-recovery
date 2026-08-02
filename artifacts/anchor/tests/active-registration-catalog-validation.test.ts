import { describe, expect, it } from "vitest";
import {
  parseActiveRegistration,
  type ActiveRegistration,
  type RegistrationType,
} from "../src/contexts/activeRegistrationValidation";
import { readLiteralVariable } from "./helpers/sourceContracts";

type CatalogCase = {
  type: RegistrationType;
  field: string;
  kind: "scalar" | "array";
  values: string[];
};

const sessionDetails = {
  craving: { route: "/craving", step: "onset" },
  trek: { route: "/trek", step: "type" },
  anxiety: { route: "/anxiety", step: "type" },
  boredom: { route: "/boredom", step: "type" },
  relapse: { route: "/relapse", step: "label" },
} as const satisfies Record<RegistrationType, { route: string; step: string }>;

function legacySession(type: RegistrationType, draft: Record<string, unknown> = {}) {
  const { route, step } = sessionDetails[type];
  return {
    version: 1,
    type,
    route,
    step,
    draft,
    updatedAt: 1_700_000_000_000,
  };
}

function migratedSession(type: RegistrationType): ActiveRegistration {
  const result = parseActiveRegistration(legacySession(type));
  if (!result.ok || !result.value) throw new Error(`Expected ${type} migration to succeed`);
  return result.value;
}

function literalOptions(
  file: string,
  variable: string,
  property?: string,
): string[] {
  const literal = readLiteralVariable(file, variable);
  if (!Array.isArray(literal)) throw new Error(`${variable} must be an array`);
  return literal.map((item) => {
    const value = property && item && typeof item === "object"
      ? (item as Record<string, unknown>)[property]
      : item;
    if (typeof value !== "string") throw new Error(`${variable} contains a non-string option`);
    return value;
  });
}

const cravingFile = "src/pages/CravingTracker.tsx";
const trekFile = "src/pages/TrekTracker.tsx";
const anxietyFile = "src/pages/AnxietyTracker.tsx";
const boredomFile = "src/pages/BoredomTracker.tsx";
const relapseFile = "src/pages/RelapseLog.tsx";

const catalogCases: CatalogCase[] = [
  { type: "craving", field: "onsetType", kind: "scalar", values: literalOptions(cravingFile, "ONSET_TYPES") },
  { type: "craving", field: "situationPresets", kind: "array", values: literalOptions(cravingFile, "TRIGGER_PRESETS") },
  { type: "craving", field: "physicalSensations", kind: "array", values: literalOptions(cravingFile, "PHYSICAL_SENSATIONS") },
  { type: "craving", field: "buildupDuration", kind: "scalar", values: literalOptions(cravingFile, "BUILDUP_OPTIONS", "value") },
  { type: "craving", field: "chosenAction", kind: "scalar", values: literalOptions(cravingFile, "OUTCOME_ACTIONS", "value") },
  { type: "craving", field: "cravingOutcome", kind: "scalar", values: literalOptions(cravingFile, "OUTCOMES", "value") },
  { type: "craving", field: "substances", kind: "array", values: literalOptions(cravingFile, "SUBSTANCES") },
  { type: "craving", field: "emotions", kind: "array", values: literalOptions(cravingFile, "EMOTIONS") },
  { type: "craving", field: "thoughtPresets", kind: "array", values: literalOptions(cravingFile, "THOUGHTS") },
  { type: "craving", field: "location", kind: "scalar", values: literalOptions(cravingFile, "LOCATIONS") },
  { type: "craving", field: "useOutcome", kind: "scalar", values: literalOptions(cravingFile, "USE_OUTCOMES", "value") },

  { type: "trek", field: "trekTypes", kind: "array", values: literalOptions(trekFile, "TREK_TYPES") },
  { type: "trek", field: "planningStage", kind: "scalar", values: literalOptions(trekFile, "PLANNING_STAGES") },
  { type: "trek", field: "location", kind: "scalar", values: literalOptions(trekFile, "TREK_LOCATIONS") },
  { type: "trek", field: "triggers", kind: "array", values: literalOptions(trekFile, "TREK_TRIGGERS") },
  { type: "trek", field: "needTypes", kind: "array", values: literalOptions(trekFile, "TREK_NEEDS") },
  { type: "trek", field: "chosenAction", kind: "scalar", values: literalOptions(trekFile, "TREK_ACTIONS", "value") },
  { type: "trek", field: "substances", kind: "array", values: literalOptions(trekFile, "SUBSTANCES") },
  { type: "trek", field: "emotions", kind: "array", values: literalOptions(trekFile, "EMOTIONS") },
  { type: "trek", field: "physicalSensations", kind: "array", values: literalOptions(trekFile, "PHYSICAL") },
  { type: "trek", field: "thoughtPresets", kind: "array", values: literalOptions(trekFile, "THOUGHTS") },
  { type: "trek", field: "useOutcome", kind: "scalar", values: literalOptions(trekFile, "USE_OUTCOMES", "value") },

  { type: "anxiety", field: "anxietyTypes", kind: "array", values: literalOptions(anxietyFile, "ANXIETY_TYPES") },
  { type: "anxiety", field: "bodyLocations", kind: "array", values: literalOptions(anxietyFile, "BODY_LOCATIONS") },
  { type: "anxiety", field: "context", kind: "scalar", values: literalOptions(anxietyFile, "CONTEXTS") },
  { type: "anxiety", field: "triggers", kind: "array", values: literalOptions(anxietyFile, "TRIGGERS") },
  { type: "anxiety", field: "reassuranceSeeking", kind: "array", values: literalOptions(anxietyFile, "REASSURANCE_SEEKING") },
  { type: "anxiety", field: "reaction", kind: "scalar", values: literalOptions(anxietyFile, "REACTIONS") },
  { type: "anxiety", field: "linkedStates", kind: "array", values: literalOptions(anxietyFile, "LINKED_STATES") },
  { type: "anxiety", field: "outcome", kind: "scalar", values: literalOptions(anxietyFile, "OUTCOMES", "value") },

  { type: "boredom", field: "restlessnessTypes", kind: "array", values: literalOptions(boredomFile, "RESTLESSNESS_TYPES") },
  { type: "boredom", field: "stimulationNeeds", kind: "array", values: literalOptions(boredomFile, "STIMULATION_NEEDS", "value") },
  { type: "boredom", field: "convertCheck", kind: "scalar", values: literalOptions(boredomFile, "CONVERT_CHECKS") },
  { type: "boredom", field: "situation", kind: "scalar", values: literalOptions(boredomFile, "SITUATIONS") },
  { type: "boredom", field: "urge", kind: "scalar", values: literalOptions(boredomFile, "URGES") },
  {
    type: "boredom",
    field: "rescueMenu",
    kind: "array",
    values: [
      ...literalOptions(boredomFile, "RESCUE_CALM"),
      ...literalOptions(boredomFile, "RESCUE_MOVE"),
      ...literalOptions(boredomFile, "RESCUE_HANDS"),
      ...literalOptions(boredomFile, "RESCUE_MENTAL"),
      ...literalOptions(boredomFile, "RESCUE_SENSORY"),
      ...literalOptions(boredomFile, "RESCUE_SOCIAL"),
    ],
  },
  { type: "boredom", field: "action", kind: "scalar", values: literalOptions(boredomFile, "MAIN_ACTIONS") },

  { type: "relapse", field: "label", kind: "scalar", values: literalOptions(relapseFile, "LABEL_OPTIONS", "value") },
  { type: "relapse", field: "when", kind: "scalar", values: literalOptions(relapseFile, "WHEN_OPTIONS", "value") },
  { type: "relapse", field: "episodeDuration", kind: "scalar", values: literalOptions(relapseFile, "DURATION_OPTIONS", "value") },
  { type: "relapse", field: "substances", kind: "array", values: literalOptions(relapseFile, "SUBSTANCES") },
  { type: "relapse", field: "primarySubstance", kind: "scalar", values: literalOptions(relapseFile, "SUBSTANCES") },
  { type: "relapse", field: "amountCategory", kind: "scalar", values: literalOptions(relapseFile, "AMOUNT_OPTIONS", "value") },
  { type: "relapse", field: "firstTriggerType", kind: "scalar", values: literalOptions(relapseFile, "FIRST_TRIGGER_TYPES") },
  { type: "relapse", field: "preUseFactors", kind: "array", values: literalOptions(relapseFile, "PRE_USE_FACTORS") },
  { type: "relapse", field: "missedWarnings", kind: "array", values: literalOptions(relapseFile, "MISSED_WARNINGS") },
  { type: "relapse", field: "preUseThoughtPreset", kind: "scalar", values: literalOptions(relapseFile, "THOUGHT_PRESETS") },
  { type: "relapse", field: "preUseThoughtPresets", kind: "array", values: literalOptions(relapseFile, "THOUGHT_PRESETS") },
  { type: "relapse", field: "couldHaveHelpedEarly", kind: "array", values: literalOptions(relapseFile, "COULD_HELP_OPTIONS") },
  { type: "relapse", field: "couldHaveHelpedMiddle", kind: "array", values: literalOptions(relapseFile, "COULD_HELP_OPTIONS") },
  { type: "relapse", field: "couldHaveHelpedLast", kind: "array", values: literalOptions(relapseFile, "COULD_HELP_OPTIONS") },
  { type: "relapse", field: "supportContact", kind: "scalar", values: literalOptions(relapseFile, "SUPPORT_CONTACTS") },
  { type: "relapse", field: "nextStep", kind: "scalar", values: literalOptions(relapseFile, "NEXT_STEPS") },
  {
    type: "relapse",
    field: "acuteRisk",
    kind: "scalar",
    values: ["none", "unsafe", "fear-continued-use", "withdrawal", "self-harm-risk"],
  },
  { type: "relapse", field: "whatNeeded", kind: "scalar", values: literalOptions(relapseFile, "WHAT_NEEDED_OPTIONS", "value") },
  { type: "relapse", field: "repairActions", kind: "array", values: literalOptions(relapseFile, "REPAIR_ACTIONS") },
];

function withDraftValue(
  session: ActiveRegistration,
  field: string,
  value: unknown,
): ActiveRegistration {
  return {
    ...session,
    draft: {
      ...(session.draft as Record<string, unknown>),
      [field]: value,
    },
  };
}

describe("active-registration option catalogs", () => {
  it.each(catalogCases)(
    "accepts every current $type.$field option used by the tracker",
    ({ type, field, kind, values }) => {
      const session = migratedSession(type);
      for (const option of values) {
        const value = kind === "array" ? [option] : option;
        expect(
          parseActiveRegistration(withDraftValue(session, field, value)),
          `${type}.${field} should accept ${option}`,
        ).toMatchObject({ ok: true });
      }
    },
  );

  it.each(catalogCases)(
    "rejects a corrupted $type.$field option",
    ({ type, field, kind, values }) => {
      const session = migratedSession(type);
      const corrupted = kind === "array"
        ? [values[0], "__not-a-catalog-option__"]
        : "__not-a-catalog-option__";
      expect(parseActiveRegistration(withDraftValue(session, field, corrupted))).toEqual({
        ok: false,
        value: null,
        migrated: false,
        error: "Active-registration draft has an invalid shape.",
      });
    },
  );

  it.each(catalogCases.filter(({ kind }) => kind === "array"))(
    "rejects duplicate $type.$field choices",
    ({ type, field, values }) => {
      const session = migratedSession(type);
      expect(parseActiveRegistration(withDraftValue(session, field, [values[0], values[0]])))
        .toMatchObject({ ok: false, error: "Active-registration draft has an invalid shape." });
    },
  );

  it.each([
    ["craving", "onsetOther"], ["craving", "triggerOther"],
    ["craving", "emotionOther"], ["craving", "thoughtFreeText"],
    ["trek", "locationOther"], ["trek", "triggerNote"],
    ["trek", "emotionOther"], ["trek", "thoughtFreeText"], ["trek", "needOther"],
    ["anxiety", "bodyPrediction"], ["anxiety", "note"],
    ["boredom", "situationOther"], ["boredom", "urgeOther"], ["boredom", "note"],
    ["relapse", "firstTriggerText"], ["relapse", "preUseThoughtFreeText"],
    ["relapse", "supportContactOther"], ["relapse", "nextStepOther"],
    ["relapse", "note"], ["relapse", "context"],
  ] as const)("continues to allow free text in %s.%s", (type, field) => {
    const session = migratedSession(type);
    expect(parseActiveRegistration(withDraftValue(
      session,
      field,
      "Personal text — not a catalog option.",
    ))).toMatchObject({ ok: true });
  });

  it("rejects mutually exclusive anxiety linked-state choices", () => {
    const session = migratedSession("anxiety");
    expect(parseActiveRegistration(withDraftValue(session, "linkedStates", [
      "Not connected to anything specific",
      "After a conflict",
    ]))).toMatchObject({ ok: false, error: "Active-registration draft has an invalid shape." });
  });

  it("migrates retired catalog values into their current semantic fields", () => {
    const craving = parseActiveRegistration(legacySession("craving", {
      chosenAction: "used",
    }));
    const boredom = parseActiveRegistration(legacySession("boredom", {
      convertCheck: "No — this is restlessness",
      rescueMenu: ["Open a window"],
    }));
    if (!craving.ok || !craving.value || !boredom.ok || !boredom.value) {
      throw new Error("Expected retired catalog values to migrate");
    }

    expect(craving.value.draft).toMatchObject({ chosenAction: "", useOutcome: "used" });
    expect(boredom.value.draft).toMatchObject({
      convertCheck: "Yes — this feels like restlessness",
      rescueMenu: ["Open a window"],
    });
    expect(parseActiveRegistration(craving.value)).toMatchObject({ ok: true, migrated: false });
    expect(parseActiveRegistration(boredom.value)).toMatchObject({ ok: true, migrated: false });
  });

  it.each(["setback", "return-to-use"])(
    "retains the historical relapse label %s across migration and v2 reload",
    (label) => {
      const migrated = parseActiveRegistration(legacySession("relapse", { label }));
      if (!migrated.ok || !migrated.value) throw new Error("Expected relapse migration to succeed");
      expect(migrated.value.draft).toMatchObject({ label });
      expect(parseActiveRegistration(migrated.value)).toMatchObject({ ok: true, migrated: false });
    },
  );
});
