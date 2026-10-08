import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearAllData, exportAllData, getFeatureRecords, getSetting, importAllData, previewImportData, saveFeatureRecord, setSetting } from "../src/db/crud";
import { getDB } from "../src/db/schema";
import { commitWeeklyReviewRecord, removeWeeklyReviewRecord, WeeklyReviewConflictError } from "../src/db/weeklyReview";
import { MAX_SUPPORTED_TIMESTAMP, parseFeatureRecord, type WeeklyReviewRecord } from "../src/lib/recoveryFeatures";
import { isWeeklyReviewDraft, type WeeklyReviewDraft } from "../src/lib/weeklyReviewDraft";

const time = 1_780_000_000_000;
const review = (extra: Partial<WeeklyReviewRecord> = {}): WeeklyReviewRecord => ({
  id: "synthetic-week", recordType: "weekly-review", timestamp: time, updatedAt: time,
  periodStart: time, periodEnd: time + 7 * 86_400_000 - 1,
  chosenPattern: "", nextWeekPlan: "", rememberFromWeek: "SYNTHETIC: laughed together",
  choseForMyself: "", makeRoomForNextWeek: "", pleasantActivity: "", ...extra,
});
const legacy = (): WeeklyReviewRecord => ({
  id: "synthetic-legacy-week", recordType: "weekly-review", timestamp: time, updatedAt: time,
  periodStart: time, periodEnd: time + 7 * 86_400_000 - 1,
  chosenPattern: "An old personal observation", nextWeekPlan: "An old plan",
});
const draft = (record = review()): WeeklyReviewDraft => ({
  selectedPatternId: "", nextWeekPlan: "", linkedGoalId: "", ownObservation: "",
  rememberFromWeek: record.rememberFromWeek ?? "", choseForMyself: "", makeRoomForNextWeek: "", pleasantActivity: "",
  recordId: record.id, timestamp: record.timestamp, sourceUpdatedAt: record.updatedAt,
});
const envelope = (value: unknown) => JSON.stringify({ version: 1, revision: 1, updatedAt: time, clientId: "synthetic", value });
const backup = (extra: Record<string, unknown> = {}) => ({
  version: 5, dataVersion: 3, journal: [], cravingLogs: [], relapseLogs: [], anxietyLogs: [], boredomLogs: [],
  cigaretteLogs: [], featureRecords: [], settings: [], ...extra,
});

beforeEach(async () => { vi.restoreAllMocks(); await clearAllData(); });

describe("optional weekly reflection contracts", () => {
  it("accepts reflection-only and unchanged legacy records and drafts", () => {
    expect(parseFeatureRecord(review())).toEqual(review());
    expect(parseFeatureRecord(legacy())).toEqual(legacy());
    expect(isWeeklyReviewDraft(draft())).toBe(true);
    expect(isWeeklyReviewDraft({ selectedPatternId: "own", nextWeekPlan: "next", linkedGoalId: "", ownObservation: "prior" })).toBe(true);
    // Do not strand an existing draft created under the original 4000-character limit.
    expect(isWeeklyReviewDraft({ selectedPatternId: "own", nextWeekPlan: "", linkedGoalId: "", ownObservation: "x".repeat(4000) })).toBe(true);
  });

  it.each(["rememberFromWeek", "choseForMyself", "makeRoomForNextWeek", "pleasantActivity"] as const)("validates %s without requiring a symptom record or score", field => {
    expect(parseFeatureRecord(review({ [field]: "x".repeat(2000) }))).not.toBeNull();
    expect(isWeeklyReviewDraft({ ...draft(), [field]: "x".repeat(2000) })).toBe(true);
    for (const value of ["x".repeat(2001), null, 4, [], {}]) {
      expect(parseFeatureRecord({ ...review(), [field]: value })).toBeNull();
      expect(isWeeklyReviewDraft({ ...draft(), [field]: value })).toBe(false);
    }
  });

  it("validates revision tokens and rejects unknown draft fields", () => {
    for (const extra of [
      { recordId: "" }, { recordId: "x".repeat(201) }, { recordId: 4 },
      { timestamp: -1 }, { timestamp: Infinity }, { timestamp: MAX_SUPPORTED_TIMESTAMP + 1 },
      { sourceUpdatedAt: "1" }, { sourceUpdatedAt: -1 }, { sourceUpdatedAt: NaN }, { diagnosis: "unsupported" },
    ]) expect(isWeeklyReviewDraft({ ...draft(), ...extra })).toBe(false);
    expect(isWeeklyReviewDraft({ ...draft(), sourceUpdatedAt: null })).toBe(true);
  });
});

describe("weekly reflection persistence and privacy", () => {
  it("saves a reflection without registrations and preserves identity while editing", async () => {
    const saved = await commitWeeklyReviewRecord(review(), null);
    const changed = await commitWeeklyReviewRecord({ ...saved, makeRoomForNextWeek: "SYNTHETIC rest" }, saved.updatedAt);
    expect(changed.id).toBe(saved.id);
    expect(changed.timestamp).toBe(saved.timestamp);
    expect(changed.updatedAt).toBeGreaterThan(saved.updatedAt);
    expect(await getFeatureRecords()).toEqual([changed]);
    const exported = await exportAllData();
    expect(exported.cravingLogs).toEqual([]);
    expect(exported.journal).toEqual([]);
  });

  it("makes first-save retries idempotent and rejects a second identity for the same period", async () => {
    const input = review();
    const saved = await commitWeeklyReviewRecord(input, null);
    expect(await commitWeeklyReviewRecord(input, null)).toEqual(saved);
    await expect(commitWeeklyReviewRecord(review({ id: "second-window" }), null)).rejects.toBeInstanceOf(WeeklyReviewConflictError);
    expect(await getFeatureRecords()).toEqual([saved]);
  });

  it("serializes two simultaneous first saves for a period", async () => {
    const results = await Promise.allSettled([
      commitWeeklyReviewRecord(review({ id: "window-one" }), null),
      commitWeeklyReviewRecord(review({ id: "window-two" }), null),
    ]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(result => result.status === "rejected")).toHaveLength(1);
    expect(await getFeatureRecords()).toHaveLength(1);
  });

  it("keeps legacy duplicate periods editable without introducing further duplicates", async () => {
    const old = legacy();
    await saveFeatureRecord(old);
    await saveFeatureRecord({ ...old, id: "legacy-duplicate" });
    const saved = await commitWeeklyReviewRecord({ ...old, choseForMyself: "SYNTHETIC a walk" }, old.updatedAt);
    expect(saved.id).toBe(old.id);
    expect(await getFeatureRecords()).toHaveLength(2);
  });

  it("rejects stale changes and deletion without disturbing the newer record", async () => {
    const old = await commitWeeklyReviewRecord(review(), null);
    const newer = await commitWeeklyReviewRecord({ ...old, rememberFromWeek: "SYNTHETIC changed elsewhere" }, old.updatedAt);
    await expect(commitWeeklyReviewRecord({ ...old, pleasantActivity: "stale" }, old.updatedAt)).rejects.toBeInstanceOf(WeeklyReviewConflictError);
    await expect(removeWeeklyReviewRecord(old)).rejects.toBeInstanceOf(WeeklyReviewConflictError);
    expect(await getFeatureRecords()).toEqual([newer]);
  });

  it("does not reuse another record identity or change a review's creation time or period", async () => {
    const saved = await commitWeeklyReviewRecord(review(), null);
    for (const change of [{ timestamp: time + 1 }, { periodStart: time + 1 }, { periodEnd: time + 1 }]) {
      await expect(commitWeeklyReviewRecord({ ...saved, ...change }, saved.updatedAt)).rejects.toBeInstanceOf(WeeklyReviewConflictError);
    }
    expect(await getFeatureRecords()).toEqual([saved]);
  });

  it("does not turn a maximum supported imported revision into an unreadable timestamp", async () => {
    const saved = review({ updatedAt: MAX_SUPPORTED_TIMESTAMP });
    await saveFeatureRecord(saved);
    await expect(commitWeeklyReviewRecord({ ...saved, pleasantActivity: "SYNTHETIC edit" }, saved.updatedAt)).rejects.toThrow("revision");
    expect(await getFeatureRecords()).toEqual([saved]);
  });

  it("removes a review and its private draft together, retaining unrelated drafts", async () => {
    const saved = await commitWeeklyReviewRecord(review(), null);
    const relatedKey = `draft:weekly-review:${saved.periodStart}`;
    const unrelatedKey = `draft:weekly-review:${saved.periodStart - 7 * 86_400_000}`;
    const unrelated = envelope({ ...draft(), recordId: "other-week" });
    await setSetting(relatedKey, envelope({ ...draft(saved), rememberFromWeek: "SYNTHETIC unfinished private text" }));
    await setSetting(unrelatedKey, unrelated);
    await removeWeeklyReviewRecord(saved);
    expect(await getFeatureRecords()).toEqual([]);
    expect(await getSetting(relatedKey, "")).toBe("");
    expect(await getSetting(unrelatedKey)).toBe(unrelated);
    const exported = await exportAllData();
    expect(exported.settings).toEqual([{ key: unrelatedKey, value: unrelated }]);
    expect(JSON.stringify(exported)).not.toContain("unfinished private text");
    expect(exported).not.toHaveProperty("syncMeta");
  });

  it("erases a legacy period draft but preserves a new generation with its own identity", async () => {
    const saved = await commitWeeklyReviewRecord(review(), null);
    const key = `draft:weekly-review:${saved.periodStart}`;
    await setSetting(key, envelope({ selectedPatternId: "own", ownObservation: "private", nextWeekPlan: "", linkedGoalId: "" }));
    await removeWeeklyReviewRecord(saved);
    expect(await getSetting(key, "")).toBe("");
    const nextDraft = envelope({ ...draft(), recordId: "new-generation", sourceUpdatedAt: null });
    await setSetting(key, nextDraft);
    await removeWeeklyReviewRecord(saved);
    expect(await getSetting(key)).toBe(nextDraft);
  });

  it("blocks stale first-save revival after deletion and allows a deliberate new identity", async () => {
    const original = review();
    const saved = await commitWeeklyReviewRecord(original, null);
    await removeWeeklyReviewRecord(saved);
    await expect(commitWeeklyReviewRecord(original, null)).rejects.toBeInstanceOf(WeeklyReviewConflictError);
    await expect(commitWeeklyReviewRecord(saved, saved.updatedAt)).rejects.toBeInstanceOf(WeeklyReviewConflictError);
    expect(await (await getDB()).getAll("syncMeta")).toEqual([{ key: `weekly-review-deleted:${saved.id}`, value: saved.timestamp }]);
    await expect(commitWeeklyReviewRecord(review({ id: "deliberately-new" }), null)).resolves.toMatchObject({ id: "deliberately-new" });
  });

  it("rolls back deletion and its identity marker if draft erasure fails", async () => {
    const saved = await commitWeeklyReviewRecord(review(), null);
    const key = `draft:weekly-review:${saved.periodStart}`;
    const privateDraft = envelope(draft(saved));
    await setSetting(key, privateDraft);
    const nativeDelete = IDBObjectStore.prototype.delete;
    vi.spyOn(IDBObjectStore.prototype, "delete").mockImplementation(function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore["delete"]>) {
      if (this.name === "settings") throw new DOMException("Synthetic draft erasure failure", "UnknownError");
      return nativeDelete.apply(this, args);
    });
    await expect(removeWeeklyReviewRecord(saved)).rejects.toThrow();
    expect(await getFeatureRecords()).toEqual([saved]);
    expect(await getSetting(key)).toBe(privateDraft);
    expect(await (await getDB()).getAll("syncMeta")).toEqual([]);
  });

  it("restores intentionally exported records despite local deletion markers and fully erases markers", async () => {
    const saved = await commitWeeklyReviewRecord(review(), null);
    const beforeDeletion = await exportAllData();
    await removeWeeklyReviewRecord(saved);
    expect((await importAllData(beforeDeletion)).committed).toBe(true);
    await expect(commitWeeklyReviewRecord({ ...saved, choseForMyself: "SYNTHETIC restored edit" }, saved.updatedAt)).resolves.toMatchObject({ id: saved.id });
    await clearAllData();
    expect(await (await getDB()).getAll("syncMeta")).toEqual([]);
  });
});

describe("weekly reflection backup compatibility", () => {
  it.each([1, 2, 3, 4])("retains legacy review content from backup version %s", async version => {
    const old = legacy();
    expect((await importAllData(backup({ version, featureRecords: [old] }))).committed).toBe(true);
    expect(await getFeatureRecords()).toEqual([old]);
  });

  it("round-trips all four fields, legacy reviews, and unfinished drafts in backup5", async () => {
    const saved = await commitWeeklyReviewRecord(review({ choseForMyself: "SYNTHETIC a pause", makeRoomForNextWeek: "SYNTHETIC rest", pleasantActivity: "SYNTHETIC park" }), null);
    const old = { ...legacy(), periodStart: time - 7 * 86_400_000, periodEnd: time - 1 };
    await saveFeatureRecord(old);
    const key = `draft:weekly-review:${saved.periodStart}`;
    const stored = envelope({ ...draft(saved), makeRoomForNextWeek: "SYNTHETIC unfinished" });
    await setSetting(key, stored);
    const exported = await exportAllData();
    expect(exported.version).toBe(5);
    expect((await previewImportData(exported)).canImport).toBe(true);
    await clearAllData();
    expect((await importAllData(exported, { mode: "replace" })).committed).toBe(true);
    expect(await getFeatureRecords()).toEqual(expect.arrayContaining([saved, old]));
    expect(await getSetting(key)).toBe(stored);
  });

  it("rejects malformed new fields before any replacement changes existing data", async () => {
    const saved = await commitWeeklyReviewRecord(review(), null);
    for (const payload of [
      backup({ featureRecords: [{ ...review(), choseForMyself: 3 }] }),
      backup({ featureRecords: [{ ...review(), pleasantActivity: "x".repeat(2001) }] }),
      backup({ settings: [{ key: `draft:weekly-review:${time}`, value: envelope({ ...draft(), makeRoomForNextWeek: false }) }] }),
      backup({ settings: [{ key: `draft:weekly-review:${time}`, value: envelope({ ...draft(), sourceUpdatedAt: "unsupported" }) }] }),
      backup({ version: 6 }),
    ]) {
      expect((await previewImportData(payload)).canImport).toBe(false);
      expect((await importAllData(payload, { mode: "replace" })).committed).toBe(false);
      expect(await getFeatureRecords()).toEqual([saved]);
    }
  });
});
