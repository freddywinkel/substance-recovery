import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addCravingLog,
  addRelapseLog,
  clearAllData,
  exportAllData,
  getCravingLogs,
  getRelapseLogs,
  getCrisisService,
  getEmergencyContacts,
  getFeatureRecords,
  getSetting,
  importAllData,
  reconcileQuickReflectionLinks,
  saveCrisisService,
  saveFeatureRecord,
  setSetting,
  updateCravingLog,
} from "../src/db/crud";
import type { CravingLog, RelapseLog } from "../src/db/schema";
import { setRegistrationSessionState } from "../src/db/registrationSessionSettings";
import { withCanonicalNote } from "../src/lib/canonicalRegistration";
import {
  DEFAULT_HOME_PREFERENCES,
  DEFAULT_RECOVERY_PLAN,
} from "../src/lib/recoveryFeatures";
import { ACTIVE_REGISTRATION_VERSION } from "../src/contexts/activeRegistrationValidation";
import { createBlankCravingDraft } from "../src/pages/CravingTracker";

const TEST_TIMESTAMP = 1_700_000_000_000;

function cravingRecord(overrides: Partial<CravingLog> = {}): CravingLog {
  return {
    id: "craving-roundtrip",
    timestamp: TEST_TIMESTAMP,
    cravingType: "passive",
    answers: {
      registrationType: "craving",
      onsetType: "random-no-reason",
      onsetOther: null,
      intensity: 5,
      confidenceBefore: 5,
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
    },
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

function relapseRecord(overrides: Partial<RelapseLog> = {}): RelapseLog {
  return {
    id: "relapse-roundtrip",
    timestamp: TEST_TIMESTAMP,
    status: "completed",
    label: "no-label",
    when: "today",
    episodeDuration: "unanswered",
    substances: [],
    primarySubstance: "",
    amountCategory: "unanswered",
    firstTriggerType: "",
    firstTriggerText: "",
    preUseFactors: [],
    missedWarnings: [],
    preUseThoughtPreset: "",
    preUseThoughtFreeText: "",
    couldHaveHelpedEarly: [],
    couldHaveHelpedMiddle: [],
    couldHaveHelpedLast: [],
    supportContact: "",
    supportContactOther: "",
    nextStep: "",
    nextStepOther: "",
    acuteRisks: ["none"],
    acuteRisk: "none",
    note: "",
    context: "",
    emotionAfter: null,
    ...overrides,
  };
}

function relapseV3Answers(overrides: Record<string, string | string[] | number | boolean | null> = {}) {
  return {
    acuteRisks: ["none"],
    label: null,
    when: "just-now",
    episodeDuration: null,
    substances: null,
    primarySubstance: null,
    amountCategory: null,
    firstTriggerType: null,
    firstTriggerText: null,
    preUseFactors: null,
    leadUpContext: null,
    missedWarnings: null,
    preUseThoughts: null,
    preUseThoughtFreeText: null,
    couldHaveHelped: null,
    couldHaveHelpedEarly: null,
    couldHaveHelpedMiddle: null,
    couldHaveHelpedLast: null,
    supportContact: "no-one-right-now",
    supportContactOther: null,
    nextStep: "water-food-rest-first",
    nextStepOther: null,
    note: null,
    emotionAfter: null,
    whatNeeded: null,
    repairActions: null,
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
    await addCravingLog(withCanonicalNote(cravingRecord(), "roundtrip marker"));
    await setSetting("theme", "light");

    expect(await getCravingLogs()).toHaveLength(1);
    const backup = await exportAllData();
    expect(backup).toMatchObject({
      version: 3,
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

  it("backs up and restores offline recovery feature records", async () => {
    await saveFeatureRecord({
      id: "quick-backup",
      recordType: "quick-registration",
      timestamp: TEST_TIMESTAMP,
      updatedAt: TEST_TIMESTAMP,
      registrationType: "craving",
      intensity: 8,
      immediateSafety: "safe-for-now",
      chosenAction: "use-a-tool",
      chosenActionOther: "",
      note: "private note",
      reflectionStatus: "pending",
      reflectionDueAt: TEST_TIMESTAMP + 60_000,
      reflectionStartedAt: null,
      reflectionCompletedAt: null,
      linkedDetailedRecordId: null,
    });
    await saveFeatureRecord({
      id: "action-backup",
      recordType: "recovery-action",
      timestamp: TEST_TIMESTAMP + 1,
      updatedAt: TEST_TIMESTAMP + 1,
      actionType: "contact",
      label: "Called support",
      note: "private action note",
      sourceId: null,
    });
    await saveFeatureRecord({
      id: "tool-backup",
      recordType: "tool-follow-up",
      timestamp: TEST_TIMESTAMP + 2,
      updatedAt: TEST_TIMESTAMP + 2,
      dueAt: TEST_TIMESTAMP + 60_002,
      toolId: "/tools/breathing",
      toolLabel: "Box breathing",
      feelingBefore: 8,
      feelingAfter: null,
      attempted: null,
      status: "pending",
      completedAt: null,
    });
    await saveFeatureRecord({
      id: "weekly-backup",
      recordType: "weekly-review",
      timestamp: TEST_TIMESTAMP + 3,
      updatedAt: TEST_TIMESTAMP + 3,
      periodStart: TEST_TIMESTAMP,
      periodEnd: TEST_TIMESTAMP + 7 * 86_400_000 - 1,
      chosenPattern: "Craving was frequently recorded (1/1)",
      nextWeekPlan: "Contact support early.",
    });
    await setSetting("homePreferences", JSON.stringify(DEFAULT_HOME_PREFERENCES));
    await setSetting("recoveryPlan", JSON.stringify(DEFAULT_RECOVERY_PLAN));

    const backup = await exportAllData();
    expect(backup).toMatchObject({ version: 3 });
    if (!Array.isArray(backup.featureRecords)) throw new Error("Expected feature records in backup");
    expect(backup.featureRecords).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "quick-backup", recordType: "quick-registration" }),
      expect.objectContaining({ id: "action-backup", recordType: "recovery-action" }),
      expect.objectContaining({ id: "tool-backup", recordType: "tool-follow-up" }),
      expect.objectContaining({ id: "weekly-backup", recordType: "weekly-review" }),
    ]));
    const quickInBackup = backup.featureRecords.find((record): record is Record<string, unknown> =>
      Boolean(record)
      && typeof record === "object"
      && !Array.isArray(record)
      && (record as Record<string, unknown>).id === "quick-backup",
    );
    if (!quickInBackup || quickInBackup.recordType !== "quick-registration") {
      throw new Error("Expected quick registration in backup");
    }
    // Deployed v2 backups predate the explicit link field. Import must
    // normalize them instead of skipping the otherwise valid record.
    delete quickInBackup.linkedDetailedRecordId;

    await clearAllData();
    expect(await getFeatureRecords()).toEqual([]);
    expect(await importAllData(backup)).toMatchObject({ skipped: 0, errors: [] });
    expect(await getFeatureRecords()).toHaveLength(4);
    expect((await getFeatureRecords()).find((record) => record.id === "quick-backup")).toMatchObject({
      id: "quick-backup",
      intensity: 8,
      reflectionStatus: "pending",
      linkedDetailedRecordId: null,
    });
    expect(JSON.parse(String(await getSetting("homePreferences")))).toEqual(DEFAULT_HOME_PREFERENCES);
    expect(JSON.parse(String(await getSetting("recoveryPlan")))).toEqual(DEFAULT_RECOVERY_PLAN);
  });

  it("backs up and restores a validated suspended registration stack", async () => {
    const suspended = [{
      version: ACTIVE_REGISTRATION_VERSION,
      type: "craving" as const,
      route: "/craving",
      step: "onset",
      draft: createBlankCravingDraft(),
      recordId: "suspended-craving",
      startedAt: TEST_TIMESTAMP,
      updatedAt: TEST_TIMESTAMP,
    }];
    await setRegistrationSessionState("", JSON.stringify(suspended));

    const backup = await exportAllData();
    await clearAllData();
    expect(await importAllData(backup)).toMatchObject({ skipped: 0, errors: [] });
    expect(JSON.parse(String(await getSetting("suspendedRegistrations")))).toMatchObject([
      { recordId: "suspended-craving", type: "craving", step: "onset" },
    ]);
  });

  it("repairs and round-trips an exact quick-to-detailed link from the durable answer envelope", async () => {
    await saveFeatureRecord({
      id: "quick-linked-roundtrip",
      recordType: "quick-registration",
      timestamp: TEST_TIMESTAMP,
      updatedAt: TEST_TIMESTAMP,
      registrationType: "craving",
      intensity: 9,
      immediateSafety: "need-support",
      chosenAction: "contact-support",
      chosenActionOther: "",
      note: "Initial note",
      reflectionStatus: "started",
      reflectionDueAt: TEST_TIMESTAMP + 600_000,
      reflectionStartedAt: TEST_TIMESTAMP + 1,
      reflectionCompletedAt: null,
      linkedDetailedRecordId: null,
    });
    const base = cravingRecord();
    await addCravingLog({
      ...base,
      id: "detailed-linked-roundtrip",
      answers: {
        ...base.answers,
        quickRegistrationId: "quick-linked-roundtrip",
      },
    });

    expect(await reconcileQuickReflectionLinks()).toBe(1);
    expect((await getFeatureRecords()).find((record) => record.id === "quick-linked-roundtrip"))
      .toMatchObject({
        reflectionStatus: "completed",
        linkedDetailedRecordId: "detailed-linked-roundtrip",
      });

    const backup = await exportAllData();
    await clearAllData();
    expect(await importAllData(backup)).toMatchObject({ skipped: 0, errors: [] });
    expect((await getCravingLogs()).find((record) => record.id === "detailed-linked-roundtrip")?.answers)
      .toMatchObject({ quickRegistrationId: "quick-linked-roundtrip" });
  });

  it("reuses a stable record ID so a retried save cannot duplicate a registration", async () => {
    const firstAttempt = withCanonicalNote(cravingRecord(), "first attempt");
    await addCravingLog(firstAttempt);
    await addCravingLog(withCanonicalNote(firstAttempt, "successful retry"));

    const stored = await getCravingLogs();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      id: "craving-roundtrip",
      note: "successful retry",
    });
  });

  it("round-trips a canonical Craving note added by the History editor", async () => {
    const saved = await addCravingLog(cravingRecord());
    await updateCravingLog(withCanonicalNote(saved, "  Edited in History  "));

    const backup = await exportAllData();
    await clearAllData();
    expect(await importAllData(backup)).toMatchObject({ skipped: 0, errors: [] });
    expect(await getCravingLogs()).toMatchObject([{
      note: "Edited in History",
      answers: { note: "Edited in History" },
    }]);
  });

  it("preserves every simultaneous Relapse concern through save, export, and import", async () => {
    await addRelapseLog(relapseRecord({
      dataVersion: 3,
      contentVersion: "registration-v3",
      occurredAt: TEST_TIMESTAMP,
      startedAt: TEST_TIMESTAMP,
      completedAt: TEST_TIMESTAMP,
      when: "just-now",
      acuteRisks: ["unsafe", "withdrawal", "self-harm-risk"],
      acuteRisk: "unsafe",
      answers: relapseV3Answers({
        acuteRisks: ["unsafe", "withdrawal", "self-harm-risk"],
      }),
    }));

    const backup = await exportAllData();
    expect(backup).toMatchObject({
      relapseLogs: [{
        acuteRisks: ["unsafe", "withdrawal", "self-harm-risk"],
        acuteRisk: "self-harm-risk",
        answers: {
          acuteRisks: ["unsafe", "withdrawal", "self-harm-risk"],
        },
      }],
    });

    await clearAllData();
    const imported = await importAllData(backup);
    expect(imported).toMatchObject({ skipped: 0, errors: [] });
    expect(await getRelapseLogs()).toMatchObject([{
      acuteRisks: ["unsafe", "withdrawal", "self-harm-risk"],
      acuteRisk: "self-harm-risk",
      answers: {
        acuteRisks: ["unsafe", "withdrawal", "self-harm-risk"],
      },
    }]);
  });

  it("migrates a legacy singular Relapse concern during import and exports the canonical array", async () => {
    const { acuteRisks: _removed, ...legacy } = relapseRecord({
      acuteRisk: "withdrawal",
      when: "yesterday",
    });
    const imported = await importAllData(emptyBackup({ relapseLogs: [legacy] }));

    expect(imported).toMatchObject({ skipped: 0, errors: [] });
    expect(await getRelapseLogs()).toMatchObject([{
      acuteRisks: ["withdrawal"],
      acuteRisk: "withdrawal",
      when: "yesterday",
    }]);
    expect(await exportAllData()).toMatchObject({
      relapseLogs: [{
        acuteRisks: ["withdrawal"],
        acuteRisk: "withdrawal",
        when: "yesterday",
      }],
    });
  });

  it("keeps legacy none unanswered, preserves canonical none, and removes stale answer aliases", async () => {
    const { acuteRisks: _legacyArray, ...legacyNone } = relapseRecord({
      id: "legacy-none",
      acuteRisk: "none",
      answers: { acuteRisk: "none" },
    });
    const canonicalNone = relapseRecord({
      id: "canonical-none",
      acuteRisks: ["none"],
      acuteRisk: "unsafe",
      answers: { acuteRisks: ["none"], acuteRisk: "unsafe" },
    });

    const imported = await importAllData(emptyBackup({
      relapseLogs: [legacyNone, canonicalNone],
    }));
    expect(imported).toMatchObject({ skipped: 0, errors: [] });
    const logs = await getRelapseLogs();
    expect(logs.find(({ id }) => id === "canonical-none")).toMatchObject({
      acuteRisks: ["none"],
      acuteRisk: "none",
      answers: { acuteRisks: ["none"] },
    });
    expect(logs.find(({ id }) => id === "legacy-none")).toMatchObject({
      acuteRisks: [],
      acuteRisk: "unanswered",
      answers: { acuteRisks: null },
    });
  });

  it("migrates the deployed v2 singular-none and post-save follow-up shape without hiding answers", async () => {
    const { acuteRisks: _removed, ...deployedV2 } = relapseRecord({
      id: "deployed-v2-follow-up",
      dataVersion: 2,
      contentVersion: "registration-v2",
      label: "no-label",
      when: "just-now",
      acuteRisk: "none",
      whatNeeded: "connection",
      repairActions: ["Tell someone safe", "Make a next-24-hour plan"],
      emotionAfter: 0,
      answers: {
        acuteRisk: "none",
        label: "no-label",
        when: "just-now",
        whatNeeded: null,
        repairActions: null,
        emotionAfter: null,
      },
    });

    expect(await importAllData(emptyBackup({ relapseLogs: [deployedV2] })))
      .toMatchObject({ skipped: 0, errors: [] });
    expect(await getRelapseLogs()).toMatchObject([{
      id: "deployed-v2-follow-up",
      acuteRisks: ["none"],
      acuteRisk: "none",
      label: "no-label",
      when: "just-now",
      whatNeeded: "connection",
      repairActions: ["Tell someone safe", "Make a next-24-hour plan"],
      emotionAfter: 0,
      answers: {
        acuteRisks: ["none"],
        label: null,
        when: null,
        whatNeeded: "connection",
        repairActions: ["tell-someone-safe", "make-a-next-24-hour-plan"],
        emotionAfter: 0,
      },
    }]);

    const backup = await exportAllData();
    await clearAllData();
    expect(await importAllData(backup)).toMatchObject({ skipped: 0, errors: [] });
    expect(await getRelapseLogs()).toMatchObject([{
      answers: {
        acuteRisks: ["none"],
        label: null,
        when: null,
        whatNeeded: "connection",
        repairActions: ["tell-someone-safe", "make-a-next-24-hour-plan"],
        emotionAfter: 0,
      },
    }]);
  });

  it("rejects contradictory canonical safety arrays and an amount without a target", async () => {
    const imported = await importAllData(emptyBackup({
      relapseLogs: [
        relapseRecord({
          id: "conflicting-risks",
          acuteRisks: ["unsafe"],
          answers: { acuteRisks: ["withdrawal"] },
        }),
        relapseRecord({
          id: "orphaned-amount",
          amountCategory: "moderate",
        }),
      ],
    }));
    expect(imported.skipped).toBe(2);
    expect(imported.errors).toEqual([
      "Invalid relapseLogs conflicting-risks: acuteRisks conflicts with answers.acuteRisks",
      "Invalid relapseLogs orphaned-amount: amountCategory requires at least one substance or behavior target",
    ]);
    expect(await getRelapseLogs()).toEqual([]);
  });

  it("normalizes when from exact timestamps and round-trips the optional emotion-after answer", async () => {
    const completedAt = new Date(2026, 7, 2, 12, 0).getTime();
    const occurredAt = new Date(2026, 7, 1, 10, 0).getTime();
    await addRelapseLog(relapseRecord({
      id: "timed-relapse",
      dataVersion: 3,
      contentVersion: "registration-v3",
      timestamp: occurredAt,
      occurredAt,
      completedAt,
      when: "yesterday",
      emotionAfter: 7,
      answers: relapseV3Answers({
        acuteRisks: ["none"],
        when: "yesterday",
        emotionAfter: 7,
      }),
    }));

    expect(await getRelapseLogs()).toMatchObject([{
      when: "yesterday",
      emotionAfter: 7,
      answers: { emotionAfter: 7 },
    }]);
    const backup = await exportAllData();
    await clearAllData();
    expect(await importAllData(backup)).toMatchObject({ skipped: 0, errors: [] });
    expect(await getRelapseLogs()).toMatchObject([{
      when: "yesterday",
      emotionAfter: 7,
      answers: { emotionAfter: 7 },
    }]);
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

  it("blocks the whole import when a contact is invalid and preserves the existing crisis service", async () => {
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
    expect(result.committed).toBe(false);
    expect(result.imported).toBe(0);
    expect(await getEmergencyContacts()).toEqual([]);
    expect(await getCrisisService()).toMatchObject({ id: "existing-service" });
  });
});
