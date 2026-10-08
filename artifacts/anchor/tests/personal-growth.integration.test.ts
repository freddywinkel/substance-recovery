import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAllData,
  exportAllData,
  getFeatureRecords,
  getJournalEntries,
  getSetting,
  importAllData,
  previewImportData,
  saveFeatureRecord,
  setSetting,
  addJournalEntry,
} from "../src/db/crud";
import {
  commitPersonalGrowthRecord,
  removePersonalGrowthRecord,
  PersonalGrowthConflictError,
} from "../src/db/personalGrowth";
import {
  parseFeatureRecord,
  type GrowthMomentRecord,
  type CompassionNoteRecord,
} from "../src/lib/recoveryFeatures";
import {
  COMPASSION_NOTE_ID,
  createGrowthMomentDraft,
  createCompassionDraft,
  growthReminder,
  growthMoments,
  isGrowthMomentDraft,
  isCompassionDraft,
} from "../src/lib/personalGrowth";
import { GROWTH_COPY } from "../src/lib/growthCopy";
import { getDB } from "../src/db/schema";

const time = 1_780_000_000_000;
const moment = (id = "synthetic-moment"): GrowthMomentRecord => ({
  id,
  recordType: "growth-moment",
  timestamp: time,
  updatedAt: time,
  note: "SYNTHETIC: a pleasant moment",
  category: null,
  favourite: false,
});
const words: CompassionNoteRecord = {
  id: COMPASSION_NOTE_ID,
  recordType: "compassion-note",
  timestamp: time,
  updatedAt: time,
  text: "SYNTHETIC: I may take my time",
};
const backup = (extra: Record<string, unknown> = {}) => ({
  version: 4,
  dataVersion: 3,
  journal: [],
  cravingLogs: [],
  relapseLogs: [],
  anxietyLogs: [],
  boredomLogs: [],
  cigaretteLogs: [],
  featureRecords: [],
  settings: [],
  ...extra,
});
const envelope = (value: unknown) =>
  JSON.stringify({
    version: 1,
    revision: 1,
    updatedAt: time,
    clientId: "synthetic",
    value,
  });
beforeEach(async () => {
  vi.restoreAllMocks();
  await clearAllData();
});

describe("personal growth contracts", () => {
  it("starts without a category or permission to resurface and without symptom questions", () => {
    const draft = createGrowthMomentDraft();
    expect(isGrowthMomentDraft(draft)).toBe(true);
    expect(draft.category).toBeNull();
    expect(draft.favourite).toBe(false);
    expect(Object.keys(draft)).not.toContain("craving");
    expect(Object.keys(draft)).not.toContain("mood");
    expect(isCompassionDraft(createCompassionDraft(null))).toBe(true);
  });
  it("accepts only explicit valid moments and personal words", () => {
    expect(parseFeatureRecord(moment())).toEqual(moment());
    expect(parseFeatureRecord(words)).toEqual(words);
    for (const invalid of [
      { ...moment(), note: " " },
      { ...moment(), category: "diagnosis" },
      { ...moment(), favourite: "yes" },
      { ...moment(), symptomScore: 3 },
      { ...words, id: "another-id" },
      { ...words, text: "x".repeat(501) },
      { ...moment(), timestamp: Infinity },
    ])
      expect(parseFeatureRecord(invalid)).toBeNull();
    expect(
      isGrowthMomentDraft({
        ...createGrowthMomentDraft(),
        sourceUpdatedAt: -1,
      }),
    ).toBe(false);
    expect(
      isCompassionDraft({ ...createCompassionDraft(null), text: null }),
    ).toBe(false);
  });
  it("resurfaces only a favourite, never a private moment or an inferred success", async () => {
    expect(growthReminder([moment()])).toBeNull();
    const chosen = { ...moment("chosen"), favourite: true };
    const newerPrivate = { ...moment("private"), timestamp: time + 100 };
    expect(growthReminder([chosen, newerPrivate, words])).toEqual(chosen);
    expect(growthMoments([chosen, newerPrivate, words])).toHaveLength(2);
    await saveFeatureRecord(chosen);
    // A return-to-use event is deliberately independent from personal memories.
    await saveFeatureRecord({
      id: "synthetic-return",
      recordType: "quick-registration",
      timestamp: time + 200,
      updatedAt: time + 200,
      registrationType: "relapse",
      intensity: null,
      useOutcome: "used",
      immediateSafety: "safe-for-now",
      chosenAction: "contact-someone",
      chosenActionOther: "",
      note: "",
      reflectionStatus: "pending",
      reflectionDueAt: time + 300,
      reflectionStartedAt: null,
      reflectionCompletedAt: null,
      linkedDetailedRecordId: null,
    });
    expect(growthReminder(await getFeatureRecords())).toEqual(chosen);
  });
  it("keeps every translated key in both languages", () => {
    expect(Object.keys(GROWTH_COPY.nl).sort()).toEqual(
      Object.keys(GROWTH_COPY.en).sort(),
    );
    expect(Object.keys(GROWTH_COPY.nl.categories)).toEqual(
      Object.keys(GROWTH_COPY.en.categories),
    );
  });
});

describe("personal growth persistence", () => {
  it("makes save retries idempotent and edits retain their identity and creation time", async () => {
    const saved = await commitPersonalGrowthRecord(moment(), null);
    expect(await commitPersonalGrowthRecord(moment(), null)).toEqual(saved);
    const edited = await commitPersonalGrowthRecord(
      { ...saved, note: "SYNTHETIC edited", favourite: true },
      saved.updatedAt,
    );
    expect(edited.timestamp).toBe(saved.timestamp);
    expect(edited.updatedAt).toBeGreaterThan(saved.updatedAt);
    expect(await getFeatureRecords()).toEqual([edited]);
    await removePersonalGrowthRecord(edited);
    expect(await getFeatureRecords()).toEqual([]);
  });
  it("does not overwrite concurrent edits or revive a deleted record from a stale draft", async () => {
    const saved = await commitPersonalGrowthRecord(moment(), null);
    const newer = await commitPersonalGrowthRecord(
      { ...saved, note: "SYNTHETIC another window" },
      saved.updatedAt,
    );
    await expect(
      commitPersonalGrowthRecord({ ...saved, note: "stale" }, saved.updatedAt),
    ).rejects.toBeInstanceOf(PersonalGrowthConflictError);
    await expect(removePersonalGrowthRecord(saved)).rejects.toBeInstanceOf(
      PersonalGrowthConflictError,
    );
    expect(await getFeatureRecords()).toEqual([newer]);
    await removePersonalGrowthRecord(newer);
    await expect(
      commitPersonalGrowthRecord(saved, saved.updatedAt),
    ).rejects.toBeInstanceOf(PersonalGrowthConflictError);
    expect(await getFeatureRecords()).toEqual([]);
  });
  it.each(["moment", "words"])("does not recreate deleted %s from a first-save retry with no source revision", async kind => {
    const original = kind === "moment" ? moment() : words;
    const saved = await commitPersonalGrowthRecord(original, null);
    // First save committed, but its original draft cleanup failed in another window.
    await removePersonalGrowthRecord(saved);
    await expect(commitPersonalGrowthRecord(original, null)).rejects.toBeInstanceOf(PersonalGrowthConflictError);
    expect(await getFeatureRecords()).toEqual([]);
    const fresh = kind === "moment"
      ? moment("another-moment")
      : { ...words, timestamp: words.timestamp + 1, text: "SYNTHETIC intentionally new words" };
    await expect(commitPersonalGrowthRecord(fresh, null)).resolves.toMatchObject({ ...fresh, updatedAt: expect.any(Number) });
  });
  it("deletes the moment and its private unfinished drafts together without deleting unrelated input", async () => {
    const saved = await commitPersonalGrowthRecord(moment(), null);
    const editKey = `draft:growth-moment:${encodeURIComponent(saved.id)}`;
    const editValue = envelope({ ...createGrowthMomentDraft(saved), note: "SYNTHETIC private edit" });
    const newValue = envelope({ ...createGrowthMomentDraft(moment()), note: "SYNTHETIC first-save draft" });
    const unrelatedKey = "draft:growth-moment:unrelated";
    const unrelatedValue = envelope(createGrowthMomentDraft(moment("unrelated")));
    await setSetting(editKey, editValue);
    await setSetting("draft:growth-moment:new", newValue);
    await setSetting(unrelatedKey, unrelatedValue);
    await removePersonalGrowthRecord(saved);
    const exported = await exportAllData();
    expect(exported.featureRecords).toEqual([]);
    expect(exported.settings).toEqual([{ key: unrelatedKey, value: unrelatedValue }]);
    expect((await previewImportData(exported)).canImport).toBe(true);
  });
  it("deletes saved words and their unfinished draft atomically", async () => {
    const saved = await commitPersonalGrowthRecord(words, null);
    await setSetting("draft:compassion-note", envelope({ ...createCompassionDraft(saved), text: "SYNTHETIC private words draft" }));
    await removePersonalGrowthRecord(saved);
    expect((await exportAllData()).settings).toEqual([]);
  });
  it("rolls back record deletion and its marker when draft erasure fails", async () => {
    const saved = await commitPersonalGrowthRecord(moment(), null);
    const draftKey = `draft:growth-moment:${saved.id}`;
    const draftValue = envelope(createGrowthMomentDraft(saved));
    await setSetting(draftKey, draftValue);
    const nativeDelete = IDBObjectStore.prototype.delete;
    vi.spyOn(IDBObjectStore.prototype, "delete").mockImplementation(function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore["delete"]>) {
      if (this.name === "settings") throw new DOMException("synthetic draft erase failure", "UnknownError");
      return nativeDelete.apply(this, args);
    });
    await expect(removePersonalGrowthRecord(saved)).rejects.toThrow();
    expect(await getFeatureRecords()).toEqual([saved]);
    expect(await getSetting(draftKey)).toBe(draftValue);
    expect(await (await getDB()).getAll("syncMeta")).toEqual([]);
  });
  it("keeps deletion markers content-free and local while allowing deliberate backup restoration and complete erasure", async () => {
    const saved = await commitPersonalGrowthRecord(moment(), null);
    const beforeDeletion = await exportAllData();
    await removePersonalGrowthRecord(saved);
    const db = await getDB();
    expect(await db.getAll("syncMeta")).toEqual([{ key: `personal-growth-deleted:${saved.id}`, value: saved.timestamp }]);
    const afterDeletion = await exportAllData();
    expect(afterDeletion).not.toHaveProperty("syncMeta");
    expect(JSON.stringify(afterDeletion)).not.toContain(saved.note);
    expect((await importAllData(beforeDeletion)).committed).toBe(true);
    await expect(commitPersonalGrowthRecord({ ...saved, note: "SYNTHETIC intentionally restored edit" }, saved.updatedAt)).resolves.toMatchObject({ id: saved.id });
    await clearAllData();
    expect(await db.getAll("syncMeta")).toEqual([]);
    await expect(commitPersonalGrowthRecord(moment(), null)).resolves.toMatchObject({ id: saved.id });
  });
  it("preserves a different new-moment draft when deleting an existing moment", async () => {
    const saved = await commitPersonalGrowthRecord(moment(), null);
    const unrelatedValue = envelope(createGrowthMomentDraft(moment("unrelated-new")));
    await setSetting("draft:growth-moment:new", unrelatedValue);
    await removePersonalGrowthRecord(saved);
    expect(await getSetting("draft:growth-moment:new")).toBe(unrelatedValue);
  });
  it("round-trips moments, favourites, words and drafts alongside existing records", async () => {
    const existing = {
      id: "synthetic-journal",
      timestamp: time,
      mood: null,
      cravingIntensity: null,
      note: "existing",
      toolUsed: null,
    };
    await addJournalEntry(existing);
    const saved = await commitPersonalGrowthRecord(
      { ...moment(), favourite: true, category: "agency" },
      null,
    );
    const note = await commitPersonalGrowthRecord(words, null);
    const newDraft = { ...createGrowthMomentDraft(), note: "unfinished" };
    const editDraft = {
      ...createGrowthMomentDraft(saved),
      note: "unfinished edit",
    };
    const settings = [
      { key: "draft:growth-moment:new", value: envelope(newDraft) },
      { key: `draft:growth-moment:${saved.id}`, value: envelope(editDraft) },
      {
        key: "draft:compassion-note",
        value: envelope({
          ...createCompassionDraft(note),
          text: "unfinished words",
        }),
      },
    ];
    for (const setting of settings)
      await setSetting(setting.key, setting.value);
    const exported = await exportAllData();
    expect(exported.version).toBe(4);
    expect((await previewImportData(exported)).canImport).toBe(true);
    await clearAllData();
    expect((await importAllData(exported, { mode: "replace" })).committed).toBe(
      true,
    );
    expect(await getFeatureRecords()).toEqual(
      expect.arrayContaining([saved, note]),
    );
    expect(await getJournalEntries()).toEqual([existing]);
    for (const setting of settings)
      expect(await getSetting(setting.key)).toEqual(setting.value);
    expect((await importAllData(exported)).committed).toBe(true);
    expect(await getFeatureRecords()).toHaveLength(2);
  });
  it.each([1, 2, 3, 4])(
    "still accepts historical backup version %s",
    async (version) => {
      expect((await previewImportData(backup({ version }))).canImport).toBe(
        true,
      );
    },
  );
  it.each(["synthetic!id", "synthetic'id", "synthetic(id)", "synthetic*id", "synthetic/ü id"])("round-trips the edit draft for an encoded valid record ID: %s", async id => {
    const saved = await commitPersonalGrowthRecord(moment(id), null);
    const key = `draft:growth-moment:${encodeURIComponent(id)}`;
    const value = envelope(createGrowthMomentDraft(saved));
    await setSetting(key, value);
    const exported = await exportAllData();
    expect((await previewImportData(exported)).canImport).toBe(true);
    await clearAllData();
    expect((await importAllData(exported, { mode: "replace" })).committed).toBe(true);
    expect(await getSetting(key)).toBe(value);
    expect(await getFeatureRecords()).toEqual([saved]);
  });
  it("rejects malformed records and drafts before any replacement write", async () => {
    await commitPersonalGrowthRecord(moment(), null);
    for (const payload of [
      backup({ featureRecords: [{ ...moment(), favourite: "no" }] }),
      backup({
        settings: [
          { key: "draft:compassion-note", value: envelope({ text: 42 }) },
        ],
      }),
      backup({
        settings: [
          {
            key: "draft:growth-moment:wrong-id",
            value: envelope(createGrowthMomentDraft(moment())),
          },
        ],
      }),
    ]) {
      expect((await previewImportData(payload)).canImport).toBe(false);
      expect(
        (await importAllData(payload, { mode: "replace" })).committed,
      ).toBe(false);
      expect(await getFeatureRecords()).toHaveLength(1);
    }
  });
  it("rejects the reserved new ID in records and drafts before replacement can collide with the creation form", async () => {
    const existing = await commitPersonalGrowthRecord(moment(), null);
    const reserved = moment("new");
    const reservedDraft = createGrowthMomentDraft(reserved);
    expect(parseFeatureRecord(reserved)).toBeNull();
    expect(isGrowthMomentDraft(reservedDraft)).toBe(false);
    for (const payload of [
      backup({ featureRecords: [reserved] }),
      backup({ settings: [{ key: "draft:growth-moment:new", value: envelope(reservedDraft) }] }),
    ]) {
      expect((await previewImportData(payload)).canImport).toBe(false);
      expect((await importAllData(payload, { mode: "replace" })).committed).toBe(false);
      expect(await getFeatureRecords()).toEqual([existing]);
    }
  });
  it("does not touch an existing record when saving fails", async () => {
    const saved = await commitPersonalGrowthRecord(moment(), null);
    const db = await getDB();
    const nativePut = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore["put"]>
    ) {
      if (this.name === "featureRecords")
        throw new DOMException("synthetic quota", "QuotaExceededError");
      return nativePut.apply(this, args);
    });
    await expect(
      commitPersonalGrowthRecord({ ...saved, note: "new" }, saved.updatedAt),
    ).rejects.toThrow();
    expect(await db.get("featureRecords", saved.id)).toEqual(saved);
  });
});
