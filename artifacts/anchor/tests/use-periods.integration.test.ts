import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearAllData, exportAllData, getFeatureRecords, getSetting, importAllData, previewImportData, setSetting } from "../src/db/crud";
import { getDB } from "../src/db/schema";
import { commitUsePeriodRecord, removeUsePeriodRecord, UsePeriodConflictError, UsePeriodOverlapError } from "../src/db/usePeriods";
import { parseFeatureRecord } from "../src/lib/recoveryFeatures";
import { createUsePeriodDraft, isUsePeriodDraft, isUsePeriodRecord, localDateString, type UsePeriodRecord } from "../src/lib/usePeriods";

const time = 1_780_000_000_000;
const period = (id = "synthetic-period", extra: Partial<UsePeriodRecord> = {}): UsePeriodRecord => ({
  id, recordType: "use-period", timestamp: time, updatedAt: time,
  target: "Alcohol", startDate: "2026-05-01", endDate: "2026-05-14", frequency: "daily", note: "SYNTHETIC period", ...extra,
});
const backup = (extra: Record<string, unknown> = {}) => ({
  version: 5, dataVersion: 3, journal: [], cravingLogs: [], relapseLogs: [], anxietyLogs: [], boredomLogs: [], cigaretteLogs: [], featureRecords: [], settings: [], ...extra,
});
const envelope = (value: unknown) => JSON.stringify({ version: 1, revision: 1, updatedAt: time, clientId: "synthetic", value });

beforeEach(async () => { vi.restoreAllMocks(); await clearAllData(); });

describe("retrospective use contracts", () => {
  it("retains incomplete drafts without inventing use frequency or dates", () => {
    const draft = createUsePeriodDraft(undefined, "Alcohol");
    expect(isUsePeriodDraft(draft)).toBe(true);
    expect(draft).toMatchObject({ target: "Alcohol", startDate: "", endDate: "", frequency: "unknown", note: "", sourceUpdatedAt: null });
    expect(createUsePeriodDraft(undefined, "not a target").target).toBe("");
    expect(isUsePeriodDraft({ ...draft, startDate: "2026-05-14", endDate: "2026-05-01" })).toBe(true);
    expect(isUsePeriodDraft({ ...draft, startDate: "2026-02-30" })).toBe(false);
  });
  it("validates real ordered calendar dates, canonical targets and bounded fields without depending on the current clock", () => {
    expect(parseFeatureRecord(period())).toEqual(period());
    expect(isUsePeriodRecord(period("one-day", { startDate: "2024-02-29", endDate: "2024-02-29", frequency: "unknown", note: "" }))).toBe(true);
    expect(isUsePeriodRecord(period("future-backup", { startDate: "2099-01-01", endDate: "2099-01-02" }))).toBe(true);
    for (const invalid of [
      { target: "alcohol" }, { startDate: "2026-02-29" }, { startDate: "2026-05-15" },
      { endDate: "2026-13-01" }, { startDate: "2026-5-01" }, { frequency: "maybe" },
      { id: "new" }, { id: "unpaired\ud800" }, { timestamp: Infinity }, { note: "x".repeat(4001) }, { usePrescribed: false },
    ]) expect(parseFeatureRecord({ ...period(), ...invalid })).toBeNull();
    const draft = createUsePeriodDraft(period());
    for (const invalid of [{ id: "new" }, { id: "unpaired\ud800" }, { target: "other" }, { sourceUpdatedAt: -1 }, { note: null }, { unexpected: true }]) {
      expect(isUsePeriodDraft({ ...draft, ...invalid })).toBe(false);
    }
  });
  it("uses the local calendar day and accepts today but rejects future use on commit", async () => {
    const today = localDateString();
    const local = new Date(2026, 2, 29, 23, 30);
    expect(localDateString(local.getTime())).toBe("2026-03-29");
    await expect(commitUsePeriodRecord(period("today", { startDate: today, endDate: today }), null)).resolves.toMatchObject({ endDate: today });
    await expect(commitUsePeriodRecord(period("future", { startDate: "2099-01-01", endDate: "2099-01-02" }), null)).rejects.toThrow("future");
    expect(await getFeatureRecords()).toHaveLength(1);
  });
});

describe("retrospective use atomic persistence", () => {
  it("keeps first saves idempotent, advances edits and preserves creation identity", async () => {
    const saved = await commitUsePeriodRecord(period(), null);
    expect(await commitUsePeriodRecord(period(), null)).toEqual(saved);
    const edited = await commitUsePeriodRecord({ ...saved, endDate: "2026-05-15", frequency: "some-days" }, saved.updatedAt);
    expect(edited.timestamp).toBe(saved.timestamp);
    expect(edited.updatedAt).toBeGreaterThan(saved.updatedAt);
    await expect(commitUsePeriodRecord({ ...edited, timestamp: time + 1 }, edited.updatedAt)).rejects.toBeInstanceOf(UsePeriodConflictError);
    expect(await getFeatureRecords()).toEqual([edited]);
  });
  it("rejects inclusive same-target overlaps while allowing different targets and adjacent days", async () => {
    const saved = await commitUsePeriodRecord(period(), null);
    await expect(commitUsePeriodRecord(period("touching", { startDate: "2026-05-14", endDate: "2026-05-15" }), null)).rejects.toMatchObject({ name: "UsePeriodOverlapError", existingId: saved.id });
    await commitUsePeriodRecord(period("adjacent", { startDate: "2026-05-15", endDate: "2026-05-16" }), null);
    await commitUsePeriodRecord(period("different-target", { target: "Cannabis" }), null);
    expect(await getFeatureRecords()).toHaveLength(3);
    await expect(commitUsePeriodRecord({ ...saved, endDate: "2026-05-16" }, saved.updatedAt)).rejects.toBeInstanceOf(UsePeriodOverlapError);
  });
  it("checks overlaps atomically when two windows save at once", async () => {
    const results = await Promise.allSettled([commitUsePeriodRecord(period("one"), null), commitUsePeriodRecord(period("two"), null)]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(result => result.status === "rejected" && result.reason instanceof UsePeriodOverlapError)).toHaveLength(1);
    expect(await getFeatureRecords()).toHaveLength(1);
  });
  it("prevents stale overwrites, stale deletions and resurrection after a first-save cleanup failure", async () => {
    const saved = await commitUsePeriodRecord(period(), null);
    const newer = await commitUsePeriodRecord({ ...saved, note: "SYNTHETIC newer edit" }, saved.updatedAt);
    await expect(commitUsePeriodRecord({ ...saved, note: "stale" }, saved.updatedAt)).rejects.toBeInstanceOf(UsePeriodConflictError);
    await expect(removeUsePeriodRecord(saved)).rejects.toBeInstanceOf(UsePeriodConflictError);
    await removeUsePeriodRecord(newer);
    await expect(commitUsePeriodRecord(period(), null)).rejects.toBeInstanceOf(UsePeriodConflictError);
    await expect(commitUsePeriodRecord(newer, newer.updatedAt)).rejects.toBeInstanceOf(UsePeriodConflictError);
    expect(await getFeatureRecords()).toEqual([]);
    expect(await (await getDB()).getAll("syncMeta")).toEqual([{ key: `use-period-deleted:${saved.id}`, value: saved.timestamp }]);
    expect(JSON.stringify(await exportAllData())).not.toContain(newer.note);
  });
  it("erases associated edit and first-save drafts atomically while retaining unrelated drafts", async () => {
    const saved = await commitUsePeriodRecord(period("id/ü with space"), null);
    const editKey = `draft:use-period:${encodeURIComponent(saved.id)}`;
    await setSetting(editKey, envelope(createUsePeriodDraft(saved)));
    await setSetting("draft:use-period:new", envelope(createUsePeriodDraft(saved)));
    const unrelatedKey = "draft:use-period:unrelated";
    const unrelatedValue = envelope(createUsePeriodDraft(period("unrelated")));
    await setSetting(unrelatedKey, unrelatedValue);
    await removeUsePeriodRecord(saved);
    expect((await exportAllData()).settings).toEqual([{ key: unrelatedKey, value: unrelatedValue }]);
    const another = await commitUsePeriodRecord(period("another"), null);
    await setSetting("draft:use-period:new", unrelatedValue);
    await removeUsePeriodRecord(another);
    expect(await getSetting("draft:use-period:new")).toBe(unrelatedValue);
  });
  it("rolls back deletion and its marker if draft cleanup fails", async () => {
    const saved = await commitUsePeriodRecord(period(), null);
    const key = `draft:use-period:${saved.id}`;
    const value = envelope(createUsePeriodDraft(saved));
    await setSetting(key, value);
    const nativeDelete = IDBObjectStore.prototype.delete;
    vi.spyOn(IDBObjectStore.prototype, "delete").mockImplementation(function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore["delete"]>) {
      if (this.name === "settings") throw new DOMException("SYNTHETIC cleanup failure", "UnknownError");
      return nativeDelete.apply(this, args);
    });
    await expect(removeUsePeriodRecord(saved)).rejects.toThrow();
    expect(await getFeatureRecords()).toEqual([saved]);
    expect(await getSetting(key)).toBe(value);
    expect(await (await getDB()).getAll("syncMeta")).toEqual([]);
  });
  it("keeps existing data if a period write fails", async () => {
    const saved = await commitUsePeriodRecord(period(), null);
    const nativePut = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore["put"]>) {
      if (this.name === "featureRecords") throw new DOMException("SYNTHETIC quota", "QuotaExceededError");
      return nativePut.apply(this, args);
    });
    await expect(commitUsePeriodRecord({ ...saved, note: "changed" }, saved.updatedAt)).rejects.toThrow();
    expect(await getFeatureRecords()).toEqual([saved]);
  });
});

describe("retrospective use backups", () => {
  it.each(["id!test", "id'test", "id(test)", "id*test", "id/ü with space"])("round-trips a record and encoded drafts for %s", async id => {
    const saved = await commitUsePeriodRecord(period(id), null);
    const editKey = `draft:use-period:${encodeURIComponent(id)}`;
    const editValue = envelope({ ...createUsePeriodDraft(saved), note: "SYNTHETIC unfinished edit" });
    const newValue = envelope(createUsePeriodDraft(undefined, "Cannabis"));
    await setSetting(editKey, editValue);
    await setSetting("draft:use-period:new", newValue);
    const exported = await exportAllData();
    expect((await previewImportData(exported)).canImport).toBe(true);
    await removeUsePeriodRecord(saved);
    expect((await importAllData(exported)).committed).toBe(true);
    expect(await getFeatureRecords()).toEqual([saved]);
    expect(await getSetting(editKey)).toBe(editValue);
    expect(await getSetting("draft:use-period:new")).toBe(newValue);
    await expect(commitUsePeriodRecord({ ...saved, note: "deliberately restored" }, saved.updatedAt)).resolves.toMatchObject({ id });
    await clearAllData();
    expect((await importAllData(exported, { mode: "replace" })).committed).toBe(true);
    expect(await getFeatureRecords()).toEqual([saved]);
  });
  it("rejects malformed records, forged draft IDs and incoming overlap before replacement", async () => {
    const saved = await commitUsePeriodRecord(period(), null);
    for (const payload of [
      backup({ featureRecords: [{ ...period(), target: "unrecognized" }] }),
      backup({ settings: [{ key: "draft:use-period:new", value: envelope({ ...createUsePeriodDraft(), frequency: "maybe" }) }] }),
      backup({ settings: [{ key: "draft:use-period:wrong", value: envelope(createUsePeriodDraft(saved)) }] }),
      backup({ featureRecords: [period("one"), period("two")] }),
    ]) {
      expect((await previewImportData(payload)).canImport).toBe(false);
      expect((await importAllData(payload, { mode: "replace" })).committed).toBe(false);
      expect(await getFeatureRecords()).toEqual([saved]);
    }
  });
  it("rejects overlap introduced by merging against local data and permits deliberate replacement", async () => {
    const saved = await commitUsePeriodRecord(period("existing"), null);
    const incoming = period("incoming", { startDate: "2026-05-10", endDate: "2026-05-17" });
    const payload = backup({ featureRecords: [incoming] });
    expect((await previewImportData(payload, { mode: "merge" })).canImport).toBe(false);
    expect((await previewImportData(payload, { mode: "replace" })).canImport).toBe(true);
    expect((await importAllData(payload)).committed).toBe(false);
    expect(await getFeatureRecords()).toEqual([saved]);
    expect((await importAllData(payload, { mode: "replace" })).committed).toBe(true);
    expect(await getFeatureRecords()).toEqual([incoming]);
  });
  it("evaluates replaced IDs as their incoming version instead of double counting a corrected backup", async () => {
    const saved = await commitUsePeriodRecord(period(), null);
    const payload = backup({ featureRecords: [{ ...saved, startDate: "2026-05-02", endDate: "2026-05-10" }] });
    expect((await previewImportData(payload)).canImport).toBe(true);
    expect((await importAllData(payload)).committed).toBe(true);
    expect(await getFeatureRecords()).toEqual(payload.featureRecords);
  });
});
