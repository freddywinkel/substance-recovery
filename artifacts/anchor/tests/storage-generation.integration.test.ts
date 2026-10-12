import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openDB, type IDBPDatabase } from "idb";

const connections: IDBPDatabase[] = [];
beforeEach(() => { vi.resetModules(); vi.stubGlobal("indexedDB", new IDBFactory()); });
afterEach(() => { connections.splice(0).forEach(db => db.close()); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

/** Independent connections capture their own startup generation, as separate tabs do. */
async function anotherWindow() {
  const schema = await import("../src/db/schema");
  await schema.getDB();
  const { guardDatabaseWrites, STORAGE_GENERATION_KEY, INITIAL_STORAGE_GENERATION } = await import("../src/db/storageGeneration");
  const raw = await openDB("anchor-recovery", schema.DATABASE_VERSION); connections.push(raw);
  const generation = (await raw.get("syncMeta", STORAGE_GENERATION_KEY))?.value ?? INITIAL_STORAGE_GENERATION;
  const onReset = vi.fn();
  return { db: guardDatabaseWrites(raw, () => generation, onReset), onReset };
}

const stores = ["journal", "checkIns", "settings", "cravingLogs", "relapseLogs", "anxietyLogs", "boredomLogs", "cigaretteLogs", "featureRecords", "dirtyRecords", "syncMeta"];
const row = (store: string, id = "synthetic") => store === "settings" || store === "syncMeta"
  ? { key: id, value: "SYNTHETIC private value" }
  : { id, timestamp: 1_790_000_000_000, note: "SYNTHETIC private record" };
const backup = (extra: Record<string, unknown> = {}) => ({ version: 6, dataVersion: 3, settings: [], journal: [], cravingLogs: [], relapseLogs: [], anxietyLogs: [], boredomLogs: [], featureRecords: [], ...extra });

describe("reset isolation across all persisted data", () => {
  it("rejects a first-save journal draft and settings from the window that erased its data", async () => {
    const crud = await import("../src/db/crud");
    const drafts = await import("../src/lib/localDrafts");
    const { createJournalDraft } = await import("../src/lib/journalDraft");
    const { getDB } = await import("../src/db/schema");
    await getDB();
    const unfinished = { ...createJournalDraft(), note: "SYNTHETIC private text before erase" };
    await crud.clearAllData();
    await expect(drafts.writeLocalDraft("journal-entry", unfinished, 0, "sleeping-window")).rejects.toThrow();
    await expect(crud.setSetting("activeRegistration", "SYNTHETIC stale session")).rejects.toThrow();
    expect((await crud.exportAllData()).settings).toEqual([]);
  });

  it("rejects an idempotent first-save retry after erase instead of resurrecting the record", async () => {
    const crud = await import("../src/db/crud");
    const { commitPersonalGrowthRecord } = await import("../src/db/personalGrowth");
    const record = { id: "synthetic-growth", recordType: "growth-moment" as const, timestamp: Date.now(), updatedAt: Date.now(), note: "SYNTHETIC pre-reset record", category: null, favourite: false };
    await commitPersonalGrowthRecord(record, null);
    await crud.clearAllData();
    await expect(commitPersonalGrowthRecord(record, null)).rejects.toThrow();
    expect((await crud.exportAllData()).featureRecords).toEqual([]);
  });

  it.each(stores)("blocks stale convenience writes to %s on a retained connection", async store => {
    const { clearAllData } = await import("../src/db/crud");
    const stale = await anotherWindow();
    await clearAllData();
    await expect(stale.db.put(store, row(store))).rejects.toMatchObject({ name: "DatabaseResetError" });
    await expect(stale.db.add(store, row(store))).rejects.toMatchObject({ name: "DatabaseResetError" });
    const fresh = await anotherWindow();
    await fresh.db.put(store, row(store, "retained"));
    await expect(stale.db.delete(store, "retained")).rejects.toMatchObject({ name: "DatabaseResetError" });
    await expect(stale.db.clear(store)).rejects.toMatchObject({ name: "DatabaseResetError" });
    expect(await fresh.db.get(store, "retained")).toEqual(row(store, "retained"));
    expect(await fresh.db.get(store, "synthetic")).toBeUndefined();
    expect(stale.onReset).toHaveBeenCalled();
  });

  it("atomically rejects direct multi-store transactions and keeps single-store tx.store working", async () => {
    const stale = await anotherWindow();
    const first = stale.db.transaction("settings", "readwrite");
    await first.store!.put({ key: "initial", value: true }); await first.done;
    await (await import("../src/db/crud")).clearAllData();
    const tx = stale.db.transaction(["settings", "journal"], "readwrite");
    const writes = [tx.objectStore("settings").put(row("settings")), tx.objectStore("journal").put(row("journal")), tx.done];
    expect((await Promise.allSettled(writes)).every(result => result.status === "rejected")).toBe(true);
    expect(await stale.db.getAll("settings")).toEqual([]);
    expect(await stale.db.getAll("journal")).toEqual([]);
  });

  it.each(["merge", "replace"] as const)("full %s restore invalidates all earlier windows but a reloaded window preserves and edits restored data", async mode => {
    const stale = await anotherWindow();
    const crud = await import("../src/db/crud");
    const payload = backup({ settings: [{ key: "theme", value: "light" }], journal: [{ id: "restored", timestamp: Date.now(), mood: 1, cravingIntensity: 0, note: "SYNTHETIC restored", toolUsed: null }] });
    expect(await crud.importAllData(payload, { mode })).toMatchObject({ committed: true });
    await expect(stale.db.put("settings", { key: "theme", value: "dark" })).rejects.toMatchObject({ name: "DatabaseResetError" });
    const fresh = await anotherWindow();
    expect(await fresh.db.get("settings", "theme")).toEqual({ key: "theme", value: "light" });
    expect((await fresh.db.get("journal", "restored"))?.note).toBe("SYNTHETIC restored");
    await fresh.db.put("settings", { key: "theme", value: "dark" });
    expect(await fresh.db.get("settings", "theme")).toEqual({ key: "theme", value: "dark" });
    expect(JSON.stringify(await crud.exportAllData())).not.toContain("storage-generation");
  });

  it("does not invalidate any window when reset or restore aborts", async () => {
    const current = await anotherWindow();
    const crud = await import("../src/db/crud");
    const original = IDBObjectStore.prototype.put;
    const failing = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function(this: IDBObjectStore, value, key) {
      if (this.name === "syncMeta" && value?.key === "storage-generation") throw new DOMException("SYNTHETIC disk failure", "QuotaExceededError");
      return original.call(this, value, key);
    });
    await expect(crud.clearAllData()).rejects.toThrow("SYNTHETIC disk failure");
    expect(await crud.importAllData(backup({ settings: [{ key: "theme", value: "light" }] }), { mode: "replace" })).toMatchObject({ committed: false, errors: [expect.stringContaining("SYNTHETIC disk failure")] });
    failing.mockRestore();
    await current.db.put("settings", { key: "theme", value: "dark" });
    expect(current.onReset).not.toHaveBeenCalled();
    expect(await current.db.get("settings", "theme")).toEqual({ key: "theme", value: "dark" });
  });

  it("serializes a queued old writer after reset and leaves the reset authoritative", async () => {
    const stale = await anotherWindow();
    const resetter = await anotherWindow();
    const erase = resetter.db.transaction(["settings", "journal", "syncMeta"], "readwrite");
    const erased = Promise.all([
      erase.objectStore("settings").clear(), erase.objectStore("journal").clear(),
      erase.objectStore("syncMeta").put({ key: "storage-generation", value: "synthetic-new-generation" }), erase.done,
    ]);
    // Starts before reset completes, but its transaction must wait on syncMeta.
    const retry = stale.db.put("journal", row("journal"));
    const outcomes = await Promise.allSettled([erased, retry]);
    expect(outcomes.map(result => result.status)).toEqual(["fulfilled", "rejected"]);
    expect(await stale.db.getAll("journal")).toEqual([]);
  });

  it("reports a reset-specific reload state and ordinary provider refresh never grants old forms permission", async () => {
    const crud = await import("../src/db/crud");
    const { getDB } = await import("../src/db/schema");
    const { getDatabaseLifecycleStatus } = await import("../src/db/lifecycle");
    const { refreshBalanceEpoch } = await import("../src/db/dailyBalance");
    await getDB(); await crud.clearAllData(); await refreshBalanceEpoch();
    await expect(crud.setSetting("theme", "dark")).rejects.toMatchObject({ name: "DatabaseResetError" });
    expect(getDatabaseLifecycleStatus()?.kind).toBe("reset");
    await getDB(); await refreshBalanceEpoch();
    await expect(crud.setSetting("theme", "light")).rejects.toMatchObject({ name: "DatabaseResetError" });
    expect((await crud.exportAllData()).settings).toEqual([]);
  });

  it("fails closed when the transaction generation read throws, without leaking or committing the transaction", async () => {
    const current = await anotherWindow();
    const original = IDBObjectStore.prototype.get;
    const failing = vi.spyOn(IDBObjectStore.prototype, "get").mockImplementation(function(this: IDBObjectStore, key) {
      if (this.name === "syncMeta" && key === "storage-generation") throw new DOMException("SYNTHETIC read failure", "UnknownError");
      return original.call(this, key);
    });
    await expect(current.db.put("settings", row("settings"))).rejects.toThrow("SYNTHETIC read failure");
    failing.mockRestore();
    expect(await current.db.getAll("settings")).toEqual([]);
    await current.db.put("settings", row("settings"));
    expect(await current.db.getAll("settings")).toEqual([row("settings")]);
  });
});
