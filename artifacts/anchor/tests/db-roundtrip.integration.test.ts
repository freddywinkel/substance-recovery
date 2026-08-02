import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addCravingLog,
  clearAllData,
  exportAllData,
  getCravingLogs,
  getCrisisService,
  getEmergencyContacts,
  getSetting,
  importAllData,
  saveCrisisService,
  setSetting,
} from "../src/db/crud";
import type { CravingLog } from "../src/db/schema";
import { setRegistrationSessionState } from "../src/db/registrationSessionSettings";

const TEST_TIMESTAMP = 1_700_000_000_000;

function cravingRecord(overrides: Partial<CravingLog> = {}): CravingLog {
  return {
    id: "craving-roundtrip",
    timestamp: TEST_TIMESTAMP,
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
    actionAttempted: null,
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

function emptyBackup(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    exportedAt: TEST_TIMESTAMP,
    journal: [],
    cravingLogs: [],
    relapseLogs: [],
    anxietyLogs: [],
    boredomLogs: [],
    settings: [],
    emergencyContacts: [],
    crisisService: null,
    ...overrides,
  };
}

describe("IndexedDB backup and retry integration", () => {
  beforeEach(async () => {
    await clearAllData();
  });

  afterEach(async () => {
    await clearAllData();
  });

  it("saves, reads, exports, clears, and restores a registration", async () => {
    await addCravingLog(cravingRecord({ note: "roundtrip marker" }));
    await setSetting("theme", "light");

    expect(await getCravingLogs()).toHaveLength(1);
    const backup = await exportAllData();
    expect(backup).toMatchObject({
      version: 1,
      cravingLogs: [
        {
          id: "craving-roundtrip",
          note: "roundtrip marker",
          occurredAt: TEST_TIMESTAMP,
          startedAt: TEST_TIMESTAMP,
        },
      ],
    });

    await clearAllData();
    expect(await getCravingLogs()).toEqual([]);

    const result = await importAllData(backup);
    expect(result.skipped).toBe(0);
    expect(result.errors).toEqual([]);
    expect(await getCravingLogs()).toMatchObject([
      {
        id: "craving-roundtrip",
        note: "roundtrip marker",
        timestamp: TEST_TIMESTAMP,
        occurredAt: TEST_TIMESTAMP,
      },
    ]);
    expect(await getSetting("theme")).toBe("light");
  });

  it("reuses a stable record ID so a retried save cannot duplicate a registration", async () => {
    const firstAttempt = cravingRecord({ note: "first attempt" });
    await addCravingLog(firstAttempt);
    await addCravingLog({ ...firstAttempt, note: "successful retry" });

    const stored = await getCravingLogs();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      id: "craving-roundtrip",
      note: "successful retry",
    });
  });

  it("updates the active and suspended registration settings together", async () => {
    await setRegistrationSessionState("active-json", "suspended-json");

    expect(await getSetting("activeRegistration")).toBe("active-json");
    expect(await getSetting("suspendedRegistrations")).toBe("suspended-json");
  });

  it("imports an authentic version-1 QuickLog backup and converts -1 distress to null", async () => {
    const historicalBackup = {
      version: 1,
      exportedAt: TEST_TIMESTAMP + 1_000,
      journal: [],
      cravingLogs: [
        {
          ...cravingRecord({
            id: "legacy-quick-log",
            note: "created by retired QuickLog",
            cravingType: "passive",
          }),
          distressLevel: -1,
        },
      ],
      relapseLogs: [],
      anxietyLogs: [],
      boredomLogs: [],
      settings: [],
      emergencyContacts: [],
      crisisService: null,
    };

    const result = await importAllData(historicalBackup);

    expect(result.skipped).toBe(0);
    expect(result.errors).toEqual([]);
    expect(await getCravingLogs()).toMatchObject([
      {
        id: "legacy-quick-log",
        distressLevel: null,
        note: "created by retired QuickLog",
        occurredAt: TEST_TIMESTAMP,
        startedAt: TEST_TIMESTAMP,
        completedAt: TEST_TIMESTAMP,
      },
    ]);
  });

  it("reports malformed present top-level contact and crisis fields", async () => {
    const result = await importAllData(emptyBackup({
      emergencyContacts: { id: "not-an-array" },
      crisisService: "not-a-service",
    }));

    expect(result.skipped).toBe(2);
    expect(result.errors).toEqual([
      "Invalid emergencyContacts: expected an array.",
      "Invalid crisisService: expected a service object or null.",
    ]);
  });

  it("reports invalid contact items, imports valid ones, and restores a null crisis service", async () => {
    await saveCrisisService({
      id: "existing-service",
      name: "Existing service",
      number: "123",
      isCustom: true,
    });

    const result = await importAllData(emptyBackup({
      emergencyContacts: [
        {
          id: "contact-1",
          name: "Trusted person",
          relationship: "Friend",
          phone: "555-0100",
        },
        { id: "broken-contact", name: 42 },
      ],
      crisisService: null,
    }));

    expect(result.skipped).toBe(1);
    expect(result.errors).toEqual(["Invalid emergencyContacts item 2."]);
    expect(await getEmergencyContacts()).toEqual([
      {
        id: "contact-1",
        name: "Trusted person",
        relationship: "Friend",
        phone: "555-0100",
      },
    ]);
    expect(await getCrisisService()).toBeNull();
  });
});
