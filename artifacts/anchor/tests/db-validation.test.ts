import { describe, expect, it } from "vitest";
import {
  BACKUP_FORMAT_VERSION,
  validateBackupEnvelope,
  validateImportedStoreRecord,
  type ImportStoreKey,
} from "../src/db/validation";

function backup(overrides: Record<string, unknown> = {}) {
  return {
    version: BACKUP_FORMAT_VERSION,
    journal: [],
    cravingLogs: [],
    relapseLogs: [],
    anxietyLogs: [],
    boredomLogs: [],
    settings: [],
    ...overrides,
  };
}

function cravingRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "craving-1",
    timestamp: 1_700_000_000_000,
    status: "completed",
    situationPresets: [],
    situationOther: "",
    intensity: 5,
    distressLevel: 4,
    riskLevel: "low",
    emotions: [],
    emotionOther: "",
    physicalSensations: [],
    thoughtPresets: [],
    thoughtFreeText: "",
    location: "",
    locationOther: "",
    socialContext: [],
    substances: [],
    primarySubstance: "",
    buildupDuration: "",
    chosenAction: "",
    chosenActionOther: "",
    toolUsed: null,
    confidenceBefore: 5,
    intensityAfter: null,
    confidenceAfter: null,
    cravingOutcome: null,
    interventionUsed: null,
    markAsPattern: false,
    highRiskFlag: false,
    note: "",
    ...overrides,
  };
}

describe("validateBackupEnvelope", () => {
  it("accepts the current backup envelope and optional cigarette store", () => {
    const value = backup({ cigaretteLogs: [] });
    expect(validateBackupEnvelope(value)).toEqual({ ok: true, value });
  });

  it.each([
    ["a primitive", null, "Backup must be an object."],
    ["an unsupported version", backup({ version: 99 }), "Unsupported backup version."],
    ["a missing required store", (() => {
      const value = backup();
      delete (value as Partial<typeof value>).journal;
      return value;
    })(), "journal must be an array."],
    ["a malformed optional cigarette store", backup({ cigaretteLogs: {} }), "cigaretteLogs must be an array when present."],
  ])("rejects %s", (_label, value, error) => {
    expect(validateBackupEnvelope(value)).toEqual({ ok: false, error });
  });
});

describe("validateImportedStoreRecord", () => {
  it("accepts a valid record and backfills canonical registration metadata", () => {
    const result = validateImportedStoreRecord("cigaretteLogs", {
      id: "cigarette-1",
      timestamp: 1_700_000_000_000,
      note: "",
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        id: "cigarette-1",
        timestamp: 1_700_000_000_000,
        occurredAt: 1_700_000_000_000,
        startedAt: 1_700_000_000_000,
        completedAt: 1_700_000_000_000,
        dataVersion: 1,
      },
    });
  });

  it("accepts unanswered nullable fields declared by the craving schema", () => {
    const result = validateImportedStoreRecord(
      "cravingLogs",
      cravingRecord({ intensity: null, distressLevel: null, confidenceBefore: null }),
    );
    expect(result.ok).toBe(true);
  });

  it("normalizes the retired QuickLog distress sentinel to unanswered", () => {
    const legacy = cravingRecord({
      id: "legacy-quick-log",
      distressLevel: -1,
      cravingType: "passive",
    });

    const result = validateImportedStoreRecord("cravingLogs", legacy);

    expect(result).toMatchObject({
      ok: true,
      value: {
        id: "legacy-quick-log",
        distressLevel: null,
      },
    });
    expect(legacy.distressLevel).toBe(-1);
  });

  it("accepts unanswered nullable fields declared by the anxiety and boredom schemas", () => {
    const anxiety = validateImportedStoreRecord("anxietyLogs", {
      id: "anxiety-1",
      timestamp: 1_700_000_000_000,
      intensity: null,
      context: "",
      trigger: "",
      bodySensations: [],
      reaction: "",
      note: "",
    });
    const boredom = validateImportedStoreRecord("boredomLogs", {
      id: "boredom-1",
      timestamp: 1_700_000_000_000,
      intensity: null,
      feelingTypes: [],
      situation: "",
      urge: "",
      action: "",
      delayDuration: null,
      note: "",
    });

    expect(anxiety.ok).toBe(true);
    expect(boredom.ok).toBe(true);
  });

  it.each([
    ["cravingLogs", cravingRecord({ intensity: 11 }), "intensity must be null or from 0 through 10"],
    ["cravingLogs", cravingRecord({ substances: ["alcohol", 3] }), "substances must be an array of strings"],
    ["cravingLogs", cravingRecord({ answers: { intensity: { nested: true } } }), "answers.intensity has an unsupported value"],
    ["cigaretteLogs", { id: "", timestamp: 0 }, "id must be a non-empty string"],
  ] as const)("rejects malformed %s records", (key, value, error) => {
    expect(validateImportedStoreRecord(key as ImportStoreKey, value)).toEqual({ ok: false, error });
  });
});
