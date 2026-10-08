import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const DATABASE_NAME = "anchor-recovery";
const storeKeys: Record<string, string> = {
  journal: "id", checkIns: "id", settings: "key", cravingLogs: "id",
  relapseLogs: "id", anxietyLogs: "id", boredomLogs: "id", cigaretteLogs: "id",
  featureRecords: "id", dirtyRecords: "id", syncMeta: "key",
};
const syntheticRows: Record<string, object[]> = {
  journal: [{ id: "journal-old", timestamp: 1700000000000, mood: 3, cravingIntensity: 5, note: "Preserve historical answers" }],
  checkIns: [{ id: "legacy-check-in", date: "2024-01-01", sober: true }],
  settings: [
    { key: "recoveryPlan", value: JSON.stringify({ version: 1, warningSigns: "Existing text", prevention: { future: "preserve raw data" } }) },
    { key: "emergencyContacts", value: JSON.stringify([{ id: "contact", name: "Synthetic helper", phone: "test-only" }]) },
    { key: "draft:journal-entry", value: "synthetic raw draft that migration must not reinterpret" },
  ],
  cravingLogs: [{ id: "craving", timestamp: 1700000000000, dataVersion: 3, answers: { unknown: null } }],
  relapseLogs: [{ id: "relapse", timestamp: 1700000000000, answers: { safetyConcerns: ["unknown"] } }],
  anxietyLogs: [{ id: "anxiety", timestamp: 1700000000000 }],
  boredomLogs: [{ id: "boredom", timestamp: 1700000000000, deleted: true }],
  cigaretteLogs: [{ id: "cigarette", timestamp: 1700000000000, occurredAt: 1700000000000 }],
  featureRecords: [{ id: "quick", recordType: "quick-registration", timestamp: 1700000000000, detailedRecordId: "craving" }],
  dirtyRecords: [{ id: "dirty", kind: "journal", recordId: "journal-old" }],
  syncMeta: [{ key: "deviceId", value: "synthetic-device" }],
};
const connections: Array<{ close(): void }> = [];

function openNative(version: number, create = false): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, version);
    if (create) request.onupgradeneeded = () => {
      for (const [name, keyPath] of Object.entries(storeKeys)) {
        const store = request.result.createObjectStore(name, { keyPath });
        if (name === "journal" || name.endsWith("Logs") || name === "featureRecords") store.createIndex("byTimestamp", "timestamp");
        if (name === "checkIns") store.createIndex("byDate", "date");
        if (name === "featureRecords") store.createIndex("byRecordType", "recordType");
      }
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => { connections.push(request.result); resolve(request.result); };
  });
}

function writeRows(db: IDBDatabase, rows: Record<string, object[]>): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(Object.keys(rows), "readwrite");
    for (const [name, records] of Object.entries(rows)) for (const record of records) tx.objectStore(name).put(record);
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
  });
}

async function seed(version = 9) {
  const db = await openNative(version, true);
  await writeRows(db, syntheticRows);
  return db;
}

function snapshot(db: IDBDatabase): Promise<Record<string, object[]>> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(Object.keys(storeKeys), "readonly");
    const values: Record<string, object[]> = {};
    for (const name of Object.keys(storeKeys)) {
      const request = tx.objectStore(name).getAll();
      request.onsuccess = () => { values[name] = request.result; };
    }
    tx.oncomplete = () => resolve(values);
    tx.onabort = () => reject(tx.error);
  });
}

describe("database write compatibility and recovery", () => {
  beforeEach(() => { vi.resetModules(); vi.stubGlobal("indexedDB", new IDBFactory()); });
  afterEach(() => { connections.splice(0).forEach(db => db.close()); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it.each([9, 10, 11])("upgrades v%s to v12 without rewriting any record or store, including raw drafts and tombstones", async version => {
    const legacy = await seed(version);
    const before = await snapshot(legacy);
    legacy.close();
    const { getDB, DATABASE_VERSION } = await import("../src/db/schema");
    const db = await getDB(); connections.push(db);
    expect(db.version).toBe(DATABASE_VERSION);
    expect(db.version).toBe(12);
    const native = await openNative(12);
    expect(await snapshot(native)).toEqual(before);
    const { getDatabaseLifecycleStatus } = await import("../src/db/lifecycle");
    expect(getDatabaseLifecycleStatus()).toBeNull();
  });

  it("fails blocked callers promptly, shares one queued upgrade, preserves the old tab's last write, and prevents v9 reopening", async () => {
    const legacy = await seed();
    const openSpy = vi.spyOn(indexedDB, "open");
    const { getDB } = await import("../src/db/schema");
    const { getDatabaseLifecycleStatus } = await import("../src/db/lifecycle");
    const results = await Promise.allSettled([getDB(), getDB()]);
    expect(results.every(result => result.status === "rejected" && result.reason.name === "DatabaseBlockedError")).toBe(true);
    expect(getDatabaseLifecycleStatus()?.kind).toBe("blocked");
    await expect(getDB()).rejects.toMatchObject({ name: "DatabaseBlockedError" });
    expect(openSpy).toHaveBeenCalledTimes(1);
    await writeRows(legacy, { settings: [{ key: "last-old-window-save", value: "retained before closing" }] });
    legacy.close();
    await vi.waitFor(() => expect(getDatabaseLifecycleStatus()?.kind).toBe("reload-required"));
    const db = await getDB(); connections.push(db);
    expect(await db.get("settings", "last-old-window-save")).toEqual({ key: "last-old-window-save", value: "retained before closing" });
    await expect(openNative(9)).rejects.toMatchObject({ name: "VersionError" });
    expect(await db.get("settings", "recoveryPlan")).toEqual(syntheticRows.settings[0]);
  });

  it("closes a v12 connection on a future upgrade and refuses all further access until the app reloads", async () => {
    const legacy = await seed(); legacy.close();
    const { getDB } = await import("../src/db/schema");
    const { getDatabaseLifecycleStatus } = await import("../src/db/lifecycle");
    const current = await getDB(); connections.push(current);
    const newer = await openNative(13);
    expect(newer.version).toBe(13);
    expect(getDatabaseLifecycleStatus()?.kind).toBe("outdated");
    await expect(getDB()).rejects.toMatchObject({ name: "DatabaseOutdatedError" });
    expect(() => current.transaction("settings", "readwrite")).toThrow();
    expect((await snapshot(newer)).settings).toEqual(syntheticRows.settings.slice().sort((a, b) => (a as {key: string}).key.localeCompare((b as {key: string}).key)));
  });

  it("treats an already newer database as outdated instead of attempting a destructive reset", async () => {
    const newer = await seed(13); const before = await snapshot(newer); newer.close();
    const { getDB } = await import("../src/db/schema");
    const { getDatabaseLifecycleStatus } = await import("../src/db/lifecycle");
    await expect(getDB()).rejects.toMatchObject({ name: "DatabaseOutdatedError" });
    expect(getDatabaseLifecycleStatus()?.kind).toBe("outdated");
    expect(await snapshot(await openNative(13))).toEqual(before);
  });

  it("allows retry after a transient open failure and requires a clean provider reload", async () => {
    const openSpy = vi.spyOn(indexedDB, "open").mockImplementationOnce(() => { throw new DOMException("Synthetic storage failure", "UnknownError"); });
    const { getDB } = await import("../src/db/schema");
    const { getDatabaseLifecycleStatus } = await import("../src/db/lifecycle");
    await expect(getDB()).rejects.toMatchObject({ name: "UnknownError" });
    expect(getDatabaseLifecycleStatus()?.kind).toBe("unavailable");
    openSpy.mockRestore();
    const db = await getDB(); connections.push(db);
    expect(db.version).toBe(12);
    expect(getDatabaseLifecycleStatus()?.kind).toBe("reload-required");
  });

  it("retains the complete old database after an aborted upgrade and succeeds on a later retry", async () => {
    const legacy = await seed(); const before = await snapshot(legacy); legacy.close();
    const nativeOpen = indexedDB.open.bind(indexedDB);
    const openSpy = vi.spyOn(indexedDB, "open").mockImplementationOnce((name, version) => {
      const request = nativeOpen(name, version);
      request.addEventListener("upgradeneeded", () => { request.transaction!.abort(); });
      return request;
    });
    const { getDB } = await import("../src/db/schema");
    await expect(getDB()).rejects.toMatchObject({ name: "AbortError" });
    const unchanged = await openNative(9);
    expect(await snapshot(unchanged)).toEqual(before);
    unchanged.close(); openSpy.mockRestore();
    const db = await getDB(); connections.push(db);
    expect(db.version).toBe(12);
    expect(await snapshot(await openNative(12))).toEqual(before);
  });
});
