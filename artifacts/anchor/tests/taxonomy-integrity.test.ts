import { describe, expect, it } from "vitest";
import { DEFAULT_CRISIS_SERVICES } from "../src/lib/crisisServices";
import {
  arrayObjectStringPropertyValuesContaining,
  objectPropertyNames,
  readLiteralVariable,
} from "./helpers/sourceContracts";

type Option =
  | string
  | {
      value?: string;
      label?: string;
      sub?: string;
      labelKey?: string;
    };

type Dictionary = Record<string, string>;

const translationFile = "src/lib/translations.ts";
const en = readLiteralVariable(translationFile, "en") as Dictionary;
const nl = readLiteralVariable(translationFile, "nl") as Dictionary;
const optionNl = readLiteralVariable(translationFile, "optNl") as Dictionary;
const optionEn = readLiteralVariable(translationFile, "optEn") as Dictionary;

const trackers = [
  {
    name: "Trek",
    file: "src/pages/TrekTracker.tsx",
    expectedOptions: 96,
    lists: [
      "TREK_TYPES",
      "PLANNING_STAGES",
      "TREK_LOCATIONS",
      "TREK_TRIGGERS",
      "TREK_NEEDS",
      "TREK_ACTIONS",
      "SUBSTANCES",
      "EMOTIONS",
      "PHYSICAL",
      "THOUGHTS",
      "USE_OUTCOMES",
    ],
  },
  {
    name: "Craving",
    file: "src/pages/CravingTracker.tsx",
    expectedOptions: 95,
    lists: [
      "ONSET_TYPES",
      "TRIGGER_PRESETS",
      "PHYSICAL_SENSATIONS",
      "BUILDUP_OPTIONS",
      "OUTCOME_ACTIONS",
      "OUTCOMES",
      "SUBSTANCES",
      "EMOTIONS",
      "THOUGHTS",
      "LOCATIONS",
      "USE_OUTCOMES",
    ],
  },
  {
    name: "Anxiety",
    file: "src/pages/AnxietyTracker.tsx",
    expectedOptions: 53,
    lists: [
      "ANXIETY_TYPES",
      "BODY_LOCATIONS",
      "CONTEXTS",
      "TRIGGERS",
      "REASSURANCE_SEEKING",
      "REACTIONS",
      "LINKED_STATES",
      "OUTCOMES",
    ],
  },
  {
    name: "Boredom",
    file: "src/pages/BoredomTracker.tsx",
    expectedOptions: 73,
    lists: [
      "RESTLESSNESS_TYPES",
      "STIMULATION_NEEDS",
      "CONVERT_CHECKS",
      "SITUATIONS",
      "URGES",
      "RESCUE_CALM",
      "RESCUE_MOVE",
      "RESCUE_HANDS",
      "RESCUE_MENTAL",
      "RESCUE_SENSORY",
      "RESCUE_SOCIAL",
      "MAIN_ACTIONS",
      "OUTCOMES",
    ],
  },
  {
    name: "Relapse",
    file: "src/pages/RelapseLog.tsx",
    expectedOptions: 124,
    lists: [
      "LABEL_OPTIONS",
      "DURATION_OPTIONS",
      "SUBSTANCES",
      "AMOUNT_OPTIONS",
      "FIRST_TRIGGER_TYPES",
      "PRE_USE_FACTORS",
      "MISSED_WARNINGS",
      "THOUGHT_PRESETS",
      "COULD_HELP_OPTIONS",
      "SUPPORT_CONTACTS",
      "NEXT_STEPS",
      "WHAT_NEEDED_OPTIONS",
      "REPAIR_ACTIONS",
      "WHEN_OPTIONS",
    ],
  },
] as const;

function duplicateValues(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

function optionFields(option: Option): { id: string; enLabel: string; nlLabel: string; sub?: string; nlSub?: string } {
  if (typeof option === "string") {
    return {
      id: option,
      enLabel: option,
      nlLabel: optionNl[option],
    };
  }

  const enLabel = option.labelKey ? en[option.labelKey] : option.label;
  const nlLabel = option.labelKey ? nl[option.labelKey] : enLabel ? optionNl[enLabel] : undefined;
  if (!enLabel || !nlLabel) {
    throw new Error(`Untranslated option ${JSON.stringify(option)}`);
  }
  return {
    id: option.value ?? enLabel,
    enLabel,
    nlLabel,
    sub: option.sub || undefined,
    nlSub: option.sub ? optionNl[option.sub] : undefined,
  };
}

describe("translation dictionaries", () => {
  it("keeps the English and Dutch UI dictionaries in exact key parity", () => {
    expect(Object.keys(nl).sort()).toEqual(Object.keys(en).sort());
  });

  it.each(["en", "nl", "optNl"])("contains no duplicate literal keys in %s", (dictionary) => {
    const keys = objectPropertyNames(translationFile, dictionary);
    expect(duplicateValues(keys)).toEqual([]);
  });
});

describe.each(trackers)("$name taxonomy", ({ file, expectedOptions, lists }) => {
  const parsedLists = lists.map((list) => ({
    list,
    options: readLiteralVariable(file, list) as Option[],
  }));

  it(`keeps the ${expectedOptions}-option source inventory explicit`, () => {
    expect(parsedLists.reduce((total, current) => total + current.options.length, 0)).toBe(expectedOptions);
  });

  it.each(parsedLists)("keeps $list IDs and labels unique after translation", ({ options }) => {
    const fields = options.map(optionFields);
    expect(duplicateValues(fields.map(({ id }) => id))).toEqual([]);
    expect(duplicateValues(fields.map(({ enLabel }) => enLabel))).toEqual([]);
    expect(duplicateValues(fields.map(({ nlLabel }) => nlLabel))).toEqual([]);
  });

  it.each(parsedLists)("has an explicit Dutch lookup for every $list label and sublabel", ({ options }) => {
    for (const option of options) {
      if (typeof option === "string") {
        expect(optionNl, option).toHaveProperty(option);
        continue;
      }
      if (option.labelKey) {
        expect(en, option.labelKey).toHaveProperty(option.labelKey);
        expect(nl, option.labelKey).toHaveProperty(option.labelKey);
      } else if (option.label) {
        expect(optionNl, option.label).toHaveProperty(option.label);
      }
      if (option.sub) expect(optionNl, option.sub).toHaveProperty(option.sub);
    }
  });
});

describe("safety option contracts", () => {
  it("exposes every selectable AcuteRisk value while keeping unanswered internal", () => {
    const schemaValues = readLiteralVariable(
      "src/db/relapseSafety.ts",
      "ACUTE_RISK_SELECTION_VALUES",
    ) as string[];
    const unanswered = readLiteralVariable(
      "src/db/relapseSafety.ts",
      "UNANSWERED_ACUTE_RISK",
    );
    const uiValues = arrayObjectStringPropertyValuesContaining(
      "src/pages/RelapseLog.tsx",
      "value",
      "self-harm-risk",
    );
    expect(unanswered).toBe("unanswered");
    expect(schemaValues).not.toContain("unanswered");
    expect(uiValues).not.toContain("unanswered");
    expect(duplicateValues(uiValues)).toEqual([]);
    expect([...uiValues].sort()).toEqual([...schemaValues].sort());
  });

  it("keeps the national emergency and suicide-prevention numbers available", () => {
    const services = DEFAULT_CRISIS_SERVICES;
    expect(duplicateValues(services.map(({ id }) => id))).toEqual([]);
    expect(services).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "112", number: "112" }),
        expect.objectContaining({ id: "113", number: "113" }),
      ]),
    );
  });
});

describe("persisted option labels", () => {
  const persistedObjectLists = [
    ["src/pages/TrekTracker.tsx", ["TREK_TYPES", "PLANNING_STAGES", "TREK_ACTIONS", "USE_OUTCOMES"]],
    ["src/pages/CravingTracker.tsx", ["BUILDUP_OPTIONS", "OUTCOME_ACTIONS", "OUTCOMES", "USE_OUTCOMES"]],
    ["src/pages/BoredomTracker.tsx", ["STIMULATION_NEEDS", "OUTCOMES"]],
    ["src/pages/RelapseLog.tsx", ["LABEL_OPTIONS", "DURATION_OPTIONS", "AMOUNT_OPTIONS", "WHAT_NEEDED_OPTIONS", "WHEN_OPTIONS"]],
  ] as const;

  it("has explicit English and Dutch history labels for every stored object ID", () => {
    for (const [file, lists] of persistedObjectLists) {
      for (const list of lists) {
        const options = readLiteralVariable(file, list) as Array<string | { value: string }>;
        for (const option of options) {
          const value = typeof option === "string" ? option : option.value;
          expect(optionEn, `${file} ${list} ${value}`).toHaveProperty(value);
          expect(optionNl, `${file} ${list} ${value}`).toHaveProperty(value);
        }
      }
    }
  });

  it("has explicit English and Dutch labels for every selectable safety value", () => {
    const values = readLiteralVariable(
      "src/db/relapseSafety.ts",
      "ACUTE_RISK_SELECTION_VALUES",
    ) as string[];
    for (const value of values) {
      expect(optionEn).toHaveProperty(value);
      expect(optionNl).toHaveProperty(value);
    }
  });
});
