import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDB, type JournalEntry } from "../src/db/schema";
import { addCigaretteLog, addJournalEntry, clearAllData, exportAllData, getCigaretteLogs, getEmergencyContacts, getJournalEntries, getSetting, importAllData, previewImportData, saveEmergencyContacts, setSetting, updateCigaretteLog } from "../src/db/crud";
import { createJournalDraft, isJournalDraft } from "../src/lib/journalDraft";
import { validateImportedStoreRecord } from "../src/db/validation";
import { createBlankQuickRegistrationDraft } from "../src/lib/quickRegistrationDraft";
import { isRecoveryPlanDraft, type RecoveryPlanDraft } from "../src/lib/planDraft";
import { emptyPreventionPlan } from "../src/lib/preventionPlan";
const time = 1_780_000_000_000;
const journal = (id: string, timestamp = time): JournalEntry => ({ id, timestamp, mood: null, cravingIntensity: null, note: "synthetic note", toolUsed: null });
const contact = (id: string, name = id) => ({ id, name, relationship: "friend", phone: "synthetic" });
const backup = (extra: Record<string, unknown> = {}) => ({ version: 3, dataVersion: 3, journal: [], cravingLogs: [], relapseLogs: [], anxietyLogs: [], boredomLogs: [], cigaretteLogs: [], featureRecords: [], settings: [], ...extra });
beforeEach(async () => { vi.restoreAllMocks(); await clearAllData(); });

describe("complete history and journal data quality", () => {
  it("retains more than 1,000 records in full reads and exports, with opt-in limits only", async () => {
    const db = await getDB(); const tx = db.transaction(["journal", "cigaretteLogs"], "readwrite");
    for (let i = 0; i < 1205; i++) {
      void tx.objectStore("journal").put(journal(`j-${i}`, time + i));
      void tx.objectStore("cigaretteLogs").put({ id: `c-${i}`, timestamp: time + i });
    }
    await tx.done;
    expect(await getJournalEntries()).toHaveLength(1205);
    expect(await getCigaretteLogs()).toHaveLength(1205);
    expect((await getJournalEntries()).at(-1)?.id).toBe("j-0");
    expect(await getCigaretteLogs(20)).toHaveLength(20);
    const exported = await exportAllData();
    expect(exported.journal).toHaveLength(1205); expect(exported.cigaretteLogs).toHaveLength(1205);
  });
  it("starts with unanswered scores, preserves explicit zero and historical midpoints, and retries one stable ID", async () => {
    const draft = createJournalDraft(); expect(draft.mood).toBeNull(); expect(draft.craving).toBeNull(); expect(isJournalDraft(draft)).toBe(true);
    await addJournalEntry(journal(draft.id)); await addJournalEntry({ ...journal(draft.id), note: "retry" });
    expect(await getJournalEntries()).toEqual([{ ...journal(draft.id), note: "retry" }]);
    expect(validateImportedStoreRecord("journal", journal("null")).ok).toBe(true);
    expect(validateImportedStoreRecord("journal", { ...journal("zero"), cravingIntensity: 0 }).ok).toBe(true);
    expect(validateImportedStoreRecord("journal", { ...journal("old"), mood: 3, cravingIntensity: 5 }).ok).toBe(true);
    expect(validateImportedStoreRecord("journal", { ...journal("bad"), mood: 0 }).ok).toBe(false);
  });
  it("corrects both occurrence timestamps without rewriting start/completion", async () => {
    const saved = await addCigaretteLog({ timestamp: time, startedAt: time + 10, completedAt: time + 20 });
    await updateCigaretteLog({ ...saved, timestamp: time - 86400000 });
    expect((await getCigaretteLogs())[0]).toMatchObject({ timestamp: time - 86400000, occurredAt: time - 86400000, startedAt: time + 10, completedAt: time + 20 });
  });
});

describe("backup preflight, preservation and atomic transactions", () => {
  it("does not mutate during preview or import any part of malformed data", async () => {
    await saveEmergencyContacts([contact("keep")]); await setSetting("theme", "dark");
    const payload = backup({ journal: [journal("new")], emergencyContacts: [{ id: "bad", name: 42 }], settings: [{ key: "theme", value: "light" }] });
    const preview = await previewImportData(payload); expect(preview.canImport).toBe(false);
    expect(await getSetting("theme")).toBe("dark");
    expect(await importAllData(payload)).toMatchObject({ imported: 0, committed: false });
    expect(await getEmergencyContacts()).toEqual([contact("keep")]); expect(await getJournalEntries()).toEqual([]); expect(await getSetting("theme")).toBe("dark");
  });
  it("merges contacts by stable ID; explicit replacement removes absent IDs atomically", async () => {
    await saveEmergencyContacts([contact("keep"), contact("update", "old")]); await addJournalEntry(journal("old"));
    const payload = backup({ emergencyContacts: [contact("update", "new"), contact("new")] });
    expect((await importAllData(payload)).committed).toBe(true);
    expect(await getEmergencyContacts()).toEqual([contact("keep"), contact("update", "new"), contact("new")]); expect(await getJournalEntries()).toHaveLength(1);
    expect((await importAllData(payload, { mode: "replace" })).committed).toBe(true);
    expect(await getEmergencyContacts()).toEqual([contact("update", "new"), contact("new")]); expect(await getJournalEntries()).toEqual([]);
  });
  it("blocks duplicate IDs, conflicting legacy aliases, unsupported settings and future versions", async () => {
    for (const payload of [backup({ journal: [journal("same"), journal("same")] }), backup({ version: 99 }), backup({ settings: [{ key: "future", value: "x" }] }), backup({ settings: [{ key: "emergencyContacts", value: JSON.stringify([contact("one")]) }], emergencyContacts: [contact("two")] })]) {
      expect((await previewImportData(payload)).canImport).toBe(false); expect((await importAllData(payload)).committed).toBe(false);
    }
    expect(await getEmergencyContacts()).toEqual([]);
  });
  it("round-trips tombstones, legacy check-ins, explicit null and local drafts in v4", async () => {
    const db = await getDB();
    await db.put("journal", { ...journal("deleted"), deleted: true }); await db.put("checkIns", { id: "legacy", date: "2020-01-01", timestamp: time });
    await addJournalEntry(journal("visible"));
    const value = { version: 1, revision: 1, updatedAt: time, clientId: "synthetic", value: createJournalDraft() };
    await setSetting("draft:journal-entry", JSON.stringify(value));
    const exported = await exportAllData(); expect(exported.version).toBe(5); expect(exported.journal).toHaveLength(2); expect(exported.checkIns).toHaveLength(1);
    await clearAllData(); const result = await importAllData(exported); expect(result.errors).toEqual([]); expect(result.committed).toBe(true);
    expect(await db.get("journal", "deleted")).toMatchObject({ deleted: true }); expect(await getJournalEntries()).toHaveLength(1); expect(await db.getAll("checkIns")).toHaveLength(1); expect(await getSetting("draft:journal-entry")).toBe(JSON.stringify(value));
  });
  it("preflights the quick draft payload before any import write and preserves unanswered values", async () => {
    const draft = createBlankQuickRegistrationDraft();
    const envelope = { version: 1, revision: 1, updatedAt: time, clientId: "synthetic", value: draft };
    const setting = { key: "draft:quick-registration", value: JSON.stringify(envelope) };
    expect((await previewImportData(backup({ settings: [setting] }))).canImport).toBe(true);
    expect((await importAllData(backup({ settings: [setting] }))).committed).toBe(true);
    expect(await getSetting(setting.key)).toBe(setting.value);
    const invalid = { ...setting, value: JSON.stringify({ ...envelope, value: { ...draft, immediateSafety: "invented-safety" } }) };
    const payload = backup({ journal: [journal("must-not-import")], settings: [invalid] });
    expect((await previewImportData(payload)).canImport).toBe(false);
    expect((await importAllData(payload)).committed).toBe(false);
    expect(await getJournalEntries()).toEqual([]);
    expect(await getSetting(setting.key)).toBe(setting.value);
  });
  it("round-trips incomplete recovery and weekly drafts but rejects malformed nested data before import", async () => {
    const plan: RecoveryPlanDraft = { warningSigns: "Draft warning", reasons: "", situations: "", message: "", next24Hours: "", trustedContactIds: ["helper"], pinnedContactId: null, pinnedToolIds: ["/tools/breathing"], prevention: emptyPreventionPlan(), baseUpdatedAt: null };
    const weekly = { selectedPatternId: "", nextWeekPlan: "Unfinished weekly plan", linkedGoalId: "" };
    const settings = [
      { key: "draft:recovery-plan", value: JSON.stringify({ version: 1, revision: 1, updatedAt: time, clientId: "synthetic", value: plan }) },
      { key: "draft:weekly-review:2026-09-07", value: JSON.stringify({ version: 1, revision: 1, updatedAt: time, clientId: "synthetic", value: weekly }) },
    ];
    expect(isRecoveryPlanDraft(plan)).toBe(true);
    expect((await importAllData(backup({ settings }))).committed).toBe(true);
    const exported = await exportAllData();
    await clearAllData();
    expect((await importAllData(exported)).committed).toBe(true);
    for (const setting of settings) expect(await getSetting(setting.key)).toEqual(setting.value);
    for (const [key, value] of [[settings[0].key, { ...plan, baseUpdatedAt: -1 }], [settings[1].key, { ...weekly, nextWeekPlan: ["wrong type"] }]] as const) {
      const invalid = { key, value: JSON.stringify({ version: 1, revision: 1, updatedAt: time, clientId: "synthetic", value }) };
      const payload = backup({ settings: [invalid], journal: [journal("must-not-import")] });
      expect((await previewImportData(payload)).canImport).toBe(false);
      expect((await importAllData(payload)).committed).toBe(false);
      expect(await getJournalEntries()).toEqual([]);
    }
    for (const setting of settings) expect(await getSetting(setting.key)).toEqual(setting.value);
  });
  it("rolls back a replacement transaction if a later store write fails", async () => {
    await addJournalEntry(journal("original")); await saveEmergencyContacts([contact("original")]);
    const original = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore["put"]>) {
      if (this.name === "cigaretteLogs") throw new DOMException("synthetic quota failure", "QuotaExceededError");
      return original.apply(this, args);
    });
    const result = await importAllData(backup({ journal: [journal("incoming")], cigaretteLogs: [{ id: "cig", timestamp: time }] }), { mode: "replace" });
    expect(result).toMatchObject({ committed: false, imported: 0 });
    expect(await getJournalEntries()).toEqual([journal("original")]); expect(await getEmergencyContacts()).toEqual([contact("original")]);
  });
  it("rolls back erasure if one store cannot clear", async () => {
    await addJournalEntry(journal("keep")); await saveEmergencyContacts([contact("keep")]);
    const original = IDBObjectStore.prototype.clear;
    vi.spyOn(IDBObjectStore.prototype, "clear").mockImplementation(function (this: IDBObjectStore) {
      if (this.name === "settings") throw new Error("synthetic clear failure");
      return original.call(this);
    });
    await expect(clearAllData()).rejects.toThrow("synthetic clear failure");
    expect(await getJournalEntries()).toEqual([journal("keep")]); expect(await getEmergencyContacts()).toEqual([contact("keep")]);
  });
});
