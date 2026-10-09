import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  headRelapseV2WithFollowUp,
  headTrekV2,
} from "./fixtures/deployed-v2-records";
import type { FeatureRecord } from "../src/lib/recoveryFeatures";

const DATABASE_NAME = "anchor-recovery";
let closeUpgradedDatabase: (() => void) | null = null;

const {
  occurredAt: _legacyOccurredAt,
  startedAt: _legacyStartedAt,
  completedAt: _legacyCompletedAt,
  dataVersion: _legacyDataVersion,
  ...preV7TrekRecord
} = headTrekV2;
const v6TrekRecord = {
  ...preV7TrekRecord,
  id: "pre-v7-trek",
  note: "preserve this pre-v7 note",
};

function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("IndexedDB deletion was blocked"));
    request.onsuccess = () => resolve();
  });
}

function openAndSeedLegacyDatabase(
  version: 6 | 7 | 8,
  cravingRecord: object,
  relapseRecord?: object,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, version);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const db = request.result;
      const journal = db.createObjectStore("journal", { keyPath: "id" });
      journal.createIndex("byTimestamp", "timestamp");
      const checkIns = db.createObjectStore("checkIns", { keyPath: "id" });
      checkIns.createIndex("byDate", "date");
      db.createObjectStore("settings", { keyPath: "key" });
      const cravingLogs = db.createObjectStore("cravingLogs", { keyPath: "id" });
      cravingLogs.createIndex("byTimestamp", "timestamp");
      const relapseLogs = db.createObjectStore("relapseLogs", { keyPath: "id" });
      relapseLogs.createIndex("byTimestamp", "timestamp");
      const anxietyLogs = db.createObjectStore("anxietyLogs", { keyPath: "id" });
      anxietyLogs.createIndex("byTimestamp", "timestamp");
      const boredomLogs = db.createObjectStore("boredomLogs", { keyPath: "id" });
      boredomLogs.createIndex("byTimestamp", "timestamp");
      db.createObjectStore("syncMeta", { keyPath: "key" });
      db.createObjectStore("dirtyRecords", { keyPath: "id" });
      const cigaretteLogs = db.createObjectStore("cigaretteLogs", { keyPath: "id" });
      cigaretteLogs.createIndex("byTimestamp", "timestamp");
    };
    request.onsuccess = () => {
      const db = request.result;
      const stores = relapseRecord
        ? ["cravingLogs", "relapseLogs"]
        : ["cravingLogs"];
      const transaction = db.transaction(stores, "readwrite");
      transaction.objectStore("cravingLogs").put(structuredClone(cravingRecord));
      if (relapseRecord) {
        transaction.objectStore("relapseLogs").put(structuredClone(relapseRecord));
      }
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
    };
  });
}

describe("real IndexedDB registration upgrades to v8", () => {
  beforeEach(async () => {
    await deleteDatabase();
    vi.resetModules();
  });

  afterEach(async () => {
    closeUpgradedDatabase?.();
    closeUpgradedDatabase = null;
    await deleteDatabase();
  });

  it("migrates exact deployed Trek and Relapse records while preserving unrelated answers", async () => {
    await openAndSeedLegacyDatabase(7, headTrekV2, headRelapseV2WithFollowUp);
    const { getDB } = await import("../src/db/schema");
    const db = await getDB();
    closeUpgradedDatabase = () => db.close();

    expect(db.version).toBe(13);
    expect(db.objectStoreNames.contains("featureRecords")).toBe(true);

    const trek = await db.get("cravingLogs", headTrekV2.id);
    expect(trek).toBeDefined();
    expect(trek).toMatchObject({
      id: headTrekV2.id,
      dataVersion: 2,
      contentVersion: "registration-v2",
      timestamp: headTrekV2.timestamp,
      occurredAt: headTrekV2.occurredAt,
      startedAt: headTrekV2.startedAt,
      completedAt: headTrekV2.completedAt,
      cravingType: "active",
      highRiskFlag: true,
      thoughtFreeText: "I know the shortcut",
      needType: "Relief",
      needOther: "quiet",
      triggerNote: "near the station",
      answers: {
        registrationType: "trek",
        trekTypes: null,
        planningStage: "immediacy-access-close",
        needs: ["relief", "other", "stimulation"],
        triggers: ["stress", "other", "social-pressure"],
        thoughts: ["i-cant-handle-this"],
        targets: ["alcohol"],
        actionAttempted: true,
        confidenceAfter: 6,
        useOutcome: "not_used",
      },
    });

    const relapse = await db.get("relapseLogs", headRelapseV2WithFollowUp.id);
    expect(relapse).toBeDefined();
    expect(relapse).toMatchObject({
      id: headRelapseV2WithFollowUp.id,
      dataVersion: 2,
      contentVersion: "registration-v2",
      timestamp: headRelapseV2WithFollowUp.timestamp,
      occurredAt: headRelapseV2WithFollowUp.occurredAt,
      startedAt: headRelapseV2WithFollowUp.startedAt,
      completedAt: headRelapseV2WithFollowUp.completedAt,
      label: "no-label",
      when: "just-now",
      substances: ["Alcohol"],
      primarySubstance: "",
      firstTriggerText: "argument",
      context: "poor sleep",
      note: "kept note",
      couldHaveHelpedEarly: ["Text or call someone"],
      couldHaveHelpedMiddle: ["Text or call someone"],
      couldHaveHelpedLast: ["Text or call someone"],
      acuteRisks: ["none"],
      acuteRisk: "none",
      whatNeeded: "Relief",
      repairActions: ["Drink water or eat something"],
      answers: {
        acuteRisks: ["none"],
        label: null,
        when: null,
        firstTriggerType: "external-event",
        preUseThoughts: ["ill-stop-tomorrow"],
        couldHaveHelpedEarly: ["text-or-call-someone"],
        couldHaveHelpedMiddle: ["text-or-call-someone"],
        couldHaveHelpedLast: ["text-or-call-someone"],
        whatNeeded: "relief",
        repairActions: ["drink-water-or-eat-something"],
      },
    });
    expect(relapse?.answers).not.toHaveProperty("acuteRisk");

    db.close();
    closeUpgradedDatabase = null;
  });

  it("composes metadata and Trek migration when upgrading directly from v6", async () => {
    await openAndSeedLegacyDatabase(6, v6TrekRecord);
    const { getDB } = await import("../src/db/schema");
    const db = await getDB();
    closeUpgradedDatabase = () => db.close();

    expect(db.version).toBe(13);
    expect(db.objectStoreNames.contains("featureRecords")).toBe(true);

    const trek = await db.get("cravingLogs", v6TrekRecord.id);
    expect(trek).toMatchObject({
      id: v6TrekRecord.id,
      timestamp: v6TrekRecord.timestamp,
      occurredAt: v6TrekRecord.timestamp,
      startedAt: v6TrekRecord.timestamp,
      completedAt: v6TrekRecord.timestamp,
      dataVersion: 1,
      contentVersion: "registration-v2",
      cravingType: "active",
      note: "preserve this pre-v7 note",
      thoughtFreeText: "I know the shortcut",
      highRiskFlag: true,
      needOther: "quiet",
      triggerNote: "near the station",
      answers: {
        registrationType: "trek",
        trekTypes: null,
        planningStage: "immediacy-access-close",
        needs: ["relief", "other", "stimulation"],
        triggers: ["stress", "other", "social-pressure"],
        thoughts: ["i-cant-handle-this"],
        targets: ["alcohol"],
        actionAttempted: true,
        confidenceAfter: 6,
        useOutcome: "not_used",
      },
    });

    db.close();
    closeUpgradedDatabase = null;
  });

  it("upgrades an exact v8 database and supports every v9 feature-record variant and index", async () => {
    await openAndSeedLegacyDatabase(8, headTrekV2);
    const { getDB } = await import("../src/db/schema");
    const { getFeatureRecords, saveFeatureRecord } = await import("../src/db/crud");
    const db = await getDB();
    closeUpgradedDatabase = () => db.close();

    expect(db.version).toBe(13);
    const transaction = db.transaction("featureRecords", "readonly");
    expect([...transaction.store.indexNames].sort()).toEqual(["byRecordType", "byTimestamp"]);
    await transaction.done;

    const timestamp = 1_700_000_100_000;
    const records = [
      {
        id: "quick-v8-upgrade",
        recordType: "quick-registration",
        timestamp,
        updatedAt: timestamp,
        registrationType: "anxiety",
        intensity: 7,
        immediateSafety: "safe-for-now",
        chosenAction: "contact-support",
        chosenActionOther: "",
        note: "",
        reflectionStatus: "pending",
        reflectionDueAt: timestamp + 600_000,
        reflectionStartedAt: null,
        reflectionCompletedAt: null,
        linkedDetailedRecordId: null,
      },
      {
        id: "action-v8-upgrade",
        recordType: "recovery-action",
        timestamp: timestamp + 1,
        updatedAt: timestamp + 1,
        actionType: "contact",
        label: "Called support",
        note: "",
        sourceId: null,
      },
      {
        id: "tool-v8-upgrade",
        recordType: "tool-follow-up",
        timestamp: timestamp + 2,
        updatedAt: timestamp + 2,
        dueAt: timestamp + 600_002,
        toolId: "/tools/breathing",
        toolLabel: "Box breathing",
        feelingBefore: 7,
        feelingAfter: null,
        attempted: null,
        status: "pending",
        completedAt: null,
      },
      {
        id: "weekly-v8-upgrade",
        recordType: "weekly-review",
        timestamp: timestamp + 3,
        updatedAt: timestamp + 3,
        periodStart: timestamp,
        periodEnd: timestamp + 7 * 86_400_000 - 1,
        chosenPattern: "Anxiety was frequently recorded (1/1)",
        nextWeekPlan: "Call support early.",
      },
    ] satisfies FeatureRecord[];

    for (const record of records) await saveFeatureRecord(record);
    expect((await getFeatureRecords()).map((record) => record.id).sort()).toEqual(
      records.map((record) => record.id).sort(),
    );
    expect((await db.getAllFromIndex("featureRecords", "byRecordType", "quick-registration")))
      .toHaveLength(1);

    db.close();
    closeUpgradedDatabase = null;
  });
});
