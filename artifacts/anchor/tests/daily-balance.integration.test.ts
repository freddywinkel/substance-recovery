import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearAllData, exportAllData, getFeatureRecords, getSetting, importAllData, setSetting } from "../src/db/crud";
import { getDB } from "../src/db/schema";
import { BALANCE_RESET_KEY, BalanceConflictError, commitBalanceRecord, getDailyBalanceDraftDates, importMoodTrackerBackup, previewMoodTrackerImport, refreshBalanceEpoch, removeBalanceRecord, startBalanceMomentRecord } from "../src/db/dailyBalance";
import { emptyDailyBalance, emptyBalanceMoment, isDailyBalanceRecord, isBalanceMomentRecord, pairedBalanceChange, type DailyBalanceRecord } from "../src/lib/dailyBalance";
import { dailyDraftFromRecord, dailyRecordFromDraft, isDailyBalanceDraft, isBalanceMomentDraft } from "../src/lib/dailyBalanceDraft";
import { parseFeatureRecord } from "../src/lib/recoveryFeatures";
import { acknowledgeDraftReload, DraftConflictError, flushLocalDrafts, getDraftFailure, pendingDraftValues, queueDraftWrite, readLocalDraft, resetLocalDraftMemory, writeLocalDraft } from "../src/lib/localDrafts";
import { SCALES, DEFAULT_SETTINGS, emptyForm, type Backup } from "../src/lib/moodTrackerBackup";
import { BALANCE_EPOCH_KEY } from "../src/lib/balanceEpoch";

const day = "2026-01-02";
const today = 1_790_000_000_000;
const daily = (extra: Partial<DailyBalanceRecord> = {}) => ({ ...emptyDailyBalance(day), ...extra });
const backup = (): Backup => ({ app: "moodtracker", version: 1, exportedAt: new Date(today).toISOString(), scaleDefinitions: SCALES, settings: { ...DEFAULT_SETTINGS, contactName: "SYNTHETIC external contact" },
  entries: [{ id: "source-id", date: day, createdAt: "2026-01-02T20:00:00.000Z", updatedAt: "2026-01-02T21:00:00.000Z", revision: 4, scaleVersion: 1, mainSleep: 450, additionalSleep: 0,
    mood: -2, drive: 0, fatigue: 0, enjoyment: 3, craving: 3, use: "none", significantChange: false, changeNote: "", supportedBy: "SYNTHETIC painting", note: "SYNTHETIC imported" }],
  drafts: [{ date: day, revision: 5, updatedAt: "2026-01-02T22:00:00.000Z", form: { ...emptyForm(day), mainHours: "25", mainMinutes: "", mood: 0, craving: 0, note: "SYNTHETIC unfinished" } }] });

beforeEach(async () => { vi.restoreAllMocks(); vi.spyOn(Date, "now").mockReturnValue(today); await clearAllData(); resetLocalDraftMemory(); });

describe("daily balance contracts", () => {
  it("preserves null and zero; EIS accepts 0–100 independently from mood and craving", () => {
    expect(isDailyBalanceRecord(daily())).toBe(true);
    expect(parseFeatureRecord(daily({ mood: -2, emotionalIntensity: 100, craving: 0 }))).toMatchObject({ mood: -2, emotionalIntensity: 100, craving: 0 });
    expect(parseFeatureRecord(daily({ mood: 2, emotionalIntensity: 100, craving: null }))).toMatchObject({ mood: 2, emotionalIntensity: 100, craving: null });
    for (const extra of [{ emotionalIntensity: 101 }, { emotionalIntensity: -1 }, { emotionalIntensity: 0.5 }, { craving: 11 }, { mood: 3 }, { cravingScale: 3 as const, craving: 4 }, { date: "2026-02-30" }]) expect(isDailyBalanceRecord(daily(extra))).toBe(false);
    expect(dailyRecordFromDraft(dailyDraftFromRecord(daily({ mainSleep: 0, additionalSleep: null })))).toMatchObject({ errors: [], record: { mainSleep: 0, additionalSleep: null } });
  });
  it("keeps invalid raw duration drafts without turning them into saved totals", () => {
    const draft = { ...dailyDraftFromRecord(daily(), null), mainHours: "25", mainMinutes: "" };
    expect(isDailyBalanceDraft(draft)).toBe(true);
    expect(dailyRecordFromDraft(draft).errors).toHaveLength(1);
    expect(dailyRecordFromDraft({ ...draft, mainHours: "", mainMinutes: "30" })).toMatchObject({ errors: [], record: { mainSleep: 30 } });
  });
  it("requires paired after timestamps and excludes unanswered scores from change", () => {
    const moment = emptyBalanceMoment(day);
    expect(isBalanceMomentRecord(moment)).toBe(true);
    expect(isBalanceMomentRecord({ ...moment, status: "completed" })).toBe(false);
    const completed = { ...moment, status: "completed" as const, before: { mood: -2, emotionalIntensity: 100, craving: null }, after: { mood: 0, emotionalIntensity: 0, craving: 0 }, afterAt: today + 10 };
    expect(isBalanceMomentRecord(completed)).toBe(true);
    expect(pairedBalanceChange(completed, "mood")).toBe(2);
    expect(pairedBalanceChange(completed, "emotionalIntensity")).toBe(-100);
    expect(pairedBalanceChange(completed, "craving")).toBeNull();
    expect(isBalanceMomentRecord({ ...completed, afterAt: today - 1 })).toBe(false);
  });
  it("preserves partial activity labels and after answers as drafts and allows a rated skipped activity", () => {
    const record = { ...emptyBalanceMoment(day), activity: { kind: "custom" as const, label: "" }, after: { mood: 0, emotionalIntensity: 0, craving: null } };
    expect(isBalanceMomentDraft({ record, sourceUpdatedAt: null })).toBe(true);
    expect(isBalanceMomentRecord(record)).toBe(false);
    const skipped = { ...record, activity: { kind: "custom" as const, label: "Walking" }, status: "skipped" as const, attempted: false, afterAt: today + 1 };
    expect(isBalanceMomentRecord(skipped)).toBe(true);
    expect(isBalanceMomentRecord({ ...skipped, afterAt: null })).toBe(false);
  });
});

describe("atomic balance persistence", () => {
  it("keeps one daily identity and retries successful writes without duplication", async () => {
    const record = daily({ mood: 0 });
    const saved = await commitBalanceRecord(record, null);
    expect(await commitBalanceRecord(record, null)).toEqual(saved);
    const edited = await commitBalanceRecord({ ...saved, emotionalIntensity: 0 }, saved.updatedAt);
    expect(edited.id).toBe(saved.id);
    await expect(commitBalanceRecord({ ...saved, note: "stale" }, saved.updatedAt)).rejects.toBeInstanceOf(BalanceConflictError);
    expect(await getFeatureRecords()).toEqual([edited]);
  });
  it("checks same-day writes atomically between tabs", async () => {
    const base = daily();
    const results = await Promise.allSettled([commitBalanceRecord({ ...base, mood: 1 }, null), commitBalanceRecord({ ...base, mood: -1 }, null)]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(await getFeatureRecords()).toHaveLength(1);
  });
  it("idempotently links source registrations without creating another registration or event", async () => {
    const input = { source: { kind: "craving" as const, recordId: "existing-craving" }, before: { mood: null, emotionalIntensity: 80, craving: 7 } };
    const [one, two] = await Promise.all([startBalanceMomentRecord(input), startBalanceMomentRecord(input)]);
    expect(one.id).toBe(two.id);
    expect(one.before).toEqual(input.before);
    const data = await exportAllData();
    expect(data.cravingLogs).toEqual([]);
    expect(data.relapseLogs).toEqual([]);
    expect(data.featureRecords).toHaveLength(1);
  });
  it("saves custom activities and independent before/after ratings", async () => {
    const open = await startBalanceMomentRecord({ date: day, source: { kind: "daily", recordId: null }, before: { mood: -1, emotionalIntensity: 70, craving: 8 }, activity: { kind: "custom", label: "Painting" } });
    const done = await commitBalanceRecord({ ...open, attempted: true, status: "completed", after: { mood: 1, emotionalIntensity: 75, craving: 3 }, afterAt: today + 1 }, open.updatedAt);
    expect(done.activity).toEqual({ kind: "custom", label: "Painting" });
    expect(done.after).toEqual({ mood: 1, emotionalIntensity: 75, craving: 3 });
  });
  it("removes associated drafts and blocks stale deletion/record/draft resurrection", async () => {
    const saved = await commitBalanceRecord(daily(), null);
    const draft = dailyDraftFromRecord(saved);
    const key = `daily-balance:${day}`;
    await writeLocalDraft(key, draft, 0, "synthetic");
    await removeBalanceRecord(saved);
    expect(await readLocalDraft(key)).toBeNull();
    await expect(commitBalanceRecord(saved, saved.updatedAt)).rejects.toBeInstanceOf(BalanceConflictError);
    await expect(writeLocalDraft(key, draft, 0, "sleeping-tab")).rejects.toBeInstanceOf(DraftConflictError);
    vi.spyOn(Date, "now").mockReturnValue(today + 2);
    expect(await commitBalanceRecord(daily({ mood: 1 }), null)).toMatchObject({ mood: 1 });
  });
  it("reset invalidates even an unsaved blank form and draft in another tab", async () => {
    const unsaved = daily();
    vi.spyOn(Date, "now").mockReturnValue(today + 10);
    await clearAllData();
    await expect(commitBalanceRecord(unsaved, null)).rejects.toBeInstanceOf(BalanceConflictError);
    await expect(writeLocalDraft(`daily-balance:${day}`, dailyDraftFromRecord(unsaved, null), 0, "sleeping-tab")).rejects.toBeInstanceOf(DraftConflictError);
    expect(await (await getDB()).get("syncMeta", BALANCE_RESET_KEY)).toMatchObject({ value: today + 10 });
    expect((await exportAllData()).settings).toEqual([]);
  });
  it.each([0, -10_000])("invalidates blank drafts after reset when the clock changes by %d ms", async offset => {
    const old = daily();
    vi.spyOn(Date, "now").mockReturnValue(today + offset);
    await clearAllData();
    const epoch = (await (await getDB()).get("syncMeta", BALANCE_EPOCH_KEY))?.value;
    expect(epoch).not.toBe(old.storageEpoch);
    await expect(commitBalanceRecord(old, null)).rejects.toBeInstanceOf(BalanceConflictError);
    await expect(writeLocalDraft(`daily-balance:${day}`, dailyDraftFromRecord(old, null), 0, "old-window")).rejects.toBeInstanceOf(DraftConflictError);
    const fresh = daily({ mood: 1 });
    expect(fresh.storageEpoch).toBe(epoch);
    await expect(commitBalanceRecord(fresh, null)).resolves.toMatchObject({ mood: 1 });
  });
  it("deletion tokens survive repeated same-day recreation without depending on the clock", async () => {
    const firstInput = daily();
    const first = await commitBalanceRecord(firstInput, null);
    await removeBalanceRecord(first);
    vi.spyOn(Date, "now").mockReturnValue(today - 10_000);
    const second = await commitBalanceRecord(daily({ note: "SYNTHETIC second" }), null);
    await removeBalanceRecord(second);
    await expect(commitBalanceRecord(firstInput, null)).rejects.toBeInstanceOf(BalanceConflictError);
    await expect(writeLocalDraft(`daily-balance:${day}`, dailyDraftFromRecord(firstInput, null), 0, "old-window")).rejects.toBeInstanceOf(DraftConflictError);
    await expect(commitBalanceRecord(daily({ note: "SYNTHETIC third" }), null)).resolves.toMatchObject({ note: "SYNTHETIC third" });
  });
  it("an explicit refresh adopts another window's reset for new forms while old forms remain invalid", async () => {
    const old = daily();
    await (await getDB()).put("syncMeta", { key: BALANCE_EPOCH_KEY, value: "synthetic-other-window-reset" });
    await expect(commitBalanceRecord(old, null)).rejects.toBeInstanceOf(BalanceConflictError);
    await refreshBalanceEpoch();
    const fresh = daily({ mood: 1 });
    expect(fresh.storageEpoch).toBe("synthetic-other-window-reset");
    await expect(commitBalanceRecord(fresh, null)).resolves.toMatchObject({ mood: 1 });
    await expect(commitBalanceRecord(old, null)).rejects.toBeInstanceOf(BalanceConflictError);
  });
  it("stale deletion never erases a newly started same-day draft", async () => {
    const old = await commitBalanceRecord(daily(), null);
    await removeBalanceRecord(old);
    vi.spyOn(Date, "now").mockReturnValue(today + 10);
    const newerDraft = dailyDraftFromRecord(daily({ note: "SYNTHETIC recreated" }), null);
    await writeLocalDraft(`daily-balance:${day}`, newerDraft, 0, "new-window");
    await expect(removeBalanceRecord(old)).rejects.toBeInstanceOf(BalanceConflictError);
    expect((await readLocalDraft(`daily-balance:${day}`))?.value).toEqual(newerDraft);
  });
  it("explicit successful reload clears only local draft failures while retaining the newer remote draft", async () => {
    const key = `daily-balance:${day}`;
    const latest = dailyDraftFromRecord(daily({ note: "SYNTHETIC newer" }), null);
    await writeLocalDraft(key, latest, 0, "other-window");
    pendingDraftValues.set(key, dailyDraftFromRecord(daily({ note: "SYNTHETIC stale" }), null));
    await expect(queueDraftWrite(key, async () => { await writeLocalDraft(key, pendingDraftValues.get(key), 0, "old-window"); })).rejects.toBeInstanceOf(DraftConflictError);
    expect(getDraftFailure(key)).toBeInstanceOf(DraftConflictError);
    await expect(flushLocalDrafts()).rejects.toThrow();
    const stored = await readLocalDraft(key);
    expect(stored?.value).toEqual(latest);
    acknowledgeDraftReload(key);
    await expect(flushLocalDrafts()).resolves.toBeUndefined();
    expect(await readLocalDraft(key)).toEqual(stored);
    expect(pendingDraftValues.has(key)).toBe(false);
  });
  it("full backups roundtrip daily records, moments and raw drafts and stale clients cannot overwrite restore", async () => {
    const saved = await commitBalanceRecord(daily({ mood: 0, emotionalIntensity: 100 }), null);
    await startBalanceMomentRecord({ date: day, source: { kind: "daily", recordId: null } });
    await writeLocalDraft(`daily-balance:${day}`, { ...dailyDraftFromRecord(saved), mainHours: "25" }, 0, "synthetic");
    const exported = await exportAllData();
    expect(exported.version).toBe(6);
    expect((await importAllData(exported, { mode: "replace" })).committed).toBe(true);
    const records = await getFeatureRecords();
    expect(records).toHaveLength(2);
    expect(records.find(record => record.id === saved.id)).toMatchObject({ mood: 0, emotionalIntensity: 100 });
    expect((await readLocalDraft(`daily-balance:${day}`))?.value).toMatchObject({ mainHours: "25" });
    await expect(commitBalanceRecord({ ...saved, mood: -1 }, saved.updatedAt)).rejects.toBeInstanceOf(BalanceConflictError);
  });
  it("restoring a stale draft preserves its conflict with the newer committed daily record", async () => {
    const old = await commitBalanceRecord(daily({ note: "SYNTHETIC older" }), null);
    const latest = await commitBalanceRecord({ ...old, note: "SYNTHETIC newer" }, old.updatedAt);
    await writeLocalDraft(`daily-balance:${day}`, { ...dailyDraftFromRecord(old), record: { ...old, note: "SYNTHETIC stale draft" } }, 0, "old-window");
    const exported = await exportAllData();
    expect((await importAllData(exported, { mode: "replace" })).committed).toBe(true);
    const envelope = await readLocalDraft(`daily-balance:${day}`);
    expect(isDailyBalanceDraft(envelope?.value)).toBe(true);
    if (!isDailyBalanceDraft(envelope?.value)) throw new Error("missing draft");
    await expect(commitBalanceRecord(envelope.value.record, envelope.value.sourceUpdatedAt)).rejects.toBeInstanceOf(BalanceConflictError);
    expect((await getFeatureRecords()).find(record => record.id === latest.id)).toMatchObject({ note: "SYNTHETIC newer" });
  });
});

describe("dedicated MoodTracker migration", () => {
  it("validates all input before any write and preserves unknown versus zero and exact legacy scale", async () => {
    await setSetting("emergencyContacts", "[]");
    await setSetting("theme", "dark");
    const payload = backup();
    expect(await previewMoodTrackerImport(payload)).toMatchObject({ entries: 1, drafts: 1, conflicts: 0, newDays: 1 });
    await importMoodTrackerBackup(payload);
    const record = (await getFeatureRecords())[0];
    expect(record).toMatchObject({ mood: -2, craving: 3, cravingScale: 3, mainSleep: 450, additionalSleep: 0, provenance: { app: "moodtracker", sourceId: "source-id" } });
    const draft = await readLocalDraft(`daily-balance:${day}`);
    expect(draft?.value).toMatchObject({ mainHours: "25", mainMinutes: "", record: { mood: 0, craving: 0, cravingScale: 3, emotionalIntensity: null } });
    expect(await getSetting("theme", "")).toBe("dark");
    expect(await getSetting("emergencyContacts", "")).toBe("[]");
    expect(JSON.stringify(await exportAllData())).not.toContain("SYNTHETIC external contact");
    const invalid = backup(); invalid.entries[0].mood = 10;
    const before = await exportAllData();
    await expect(importMoodTrackerBackup(invalid, "incoming")).rejects.toThrow("invalid rating");
    expect(await exportAllData()).toEqual(before);
  });
  it("previews and keeps conflicts involving only an unfinished local draft", async () => {
    const draft = { ...dailyDraftFromRecord(daily(), null), mainHours: "25", record: daily({ note: "SYNTHETIC local draft" }) };
    await writeLocalDraft(`daily-balance:${day}`, draft, 0, "synthetic");
    expect(await previewMoodTrackerImport(backup())).toMatchObject({ conflicts: 1, newDays: 0 });
    expect(await importMoodTrackerBackup(backup(), "keep")).toEqual({ imported: 0, skipped: 1 });
    expect(await getFeatureRecords()).toEqual([]);
    expect((await readLocalDraft(`daily-balance:${day}`))?.value).toEqual(draft);
  });
  it("discovers backdated draft-only days without treating invalid raw sleep as a completed summary", async () => {
    const payload = backup(); payload.entries = [];
    await importMoodTrackerBackup(payload);
    expect(await getFeatureRecords()).toEqual([]);
    expect(await getDailyBalanceDraftDates()).toEqual([day]);
    await setSetting("draft:daily-balance:2026-01-03", JSON.stringify({ version: 1, revision: 1, updatedAt: today, clientId: "synthetic", value: dailyDraftFromRecord(daily()) }));
    expect(await getDailyBalanceDraftDates()).toEqual([day]);
  });
  it("incoming conflict choice imports only selected days and advances old draft revisions", async () => {
    const saved = await commitBalanceRecord(daily({ mood: 1 }), null);
    const oldDraft = dailyDraftFromRecord(saved);
    await writeLocalDraft(`daily-balance:${day}`, oldDraft, 0, "synthetic");
    expect(await importMoodTrackerBackup(backup(), "incoming")).toEqual({ imported: 1, skipped: 0 });
    await expect(writeLocalDraft(`daily-balance:${day}`, oldDraft, 1, "sleeping-tab")).rejects.toBeInstanceOf(DraftConflictError);
    await expect(commitBalanceRecord({ ...saved, mood: 2 }, saved.updatedAt)).rejects.toBeInstanceOf(BalanceConflictError);
  });
  it("rejects modified scale definitions, duplicate days and unsupported future backups", async () => {
    const duplicate = backup(); duplicate.entries.push({ ...duplicate.entries[0], id: "other-id" });
    await expect(importMoodTrackerBackup(duplicate)).rejects.toThrow("duplicate");
    await expect(importMoodTrackerBackup({ ...backup(), version: 2 })).rejects.toThrow("unsupported");
    const changed = structuredClone(backup()); (changed.scaleDefinitions.craving as { max: number }).max = 10;
    await expect(importMoodTrackerBackup(changed)).rejects.toThrow("scale definitions");
    expect(await getFeatureRecords()).toEqual([]);
  });
  it("rolls back records and drafts together on an IndexedDB write failure", async () => {
    const original = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function(this: IDBObjectStore, ...args: Parameters<IDBObjectStore["put"]>) {
      if (this.name === "settings") throw new DOMException("SYNTHETIC full disk", "QuotaExceededError");
      return original.apply(this, args);
    });
    await expect(importMoodTrackerBackup(backup())).rejects.toThrow("SYNTHETIC full disk");
    expect(await getFeatureRecords()).toEqual([]);
  });
});
