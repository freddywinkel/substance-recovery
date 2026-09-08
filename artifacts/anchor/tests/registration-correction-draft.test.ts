import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { getDB, type CigaretteLog, type CravingLog, type RelapseLog } from "../src/db/schema";
import {
  clearAllData, exportAllData, getCravingLogs, getRelapseLogs, getFeatureRecords,
  getSetting, importAllData, previewImportData, setSetting, updateRegistrationEpisode,
  updateCigaretteLog,
} from "../src/db/crud";
import { applyRegistrationCorrection, correctionAnswers, localDateTime } from "../src/components/RegistrationCorrection";
import { isRegistrationCorrectionDraft, registrationSourceSignature, RegistrationSourceConflictError, type RegistrationCorrectionDraft } from "../src/lib/registrationCorrectionDraft";
import type { QuickRegistrationRecord } from "../src/lib/recoveryFeatures";
import { blankUseDetail } from "../src/lib/useDetails";
import { headTrekV2, headRelapseV2WithFollowUp } from "./fixtures/deployed-v2-records";

const stamp = 1_780_000_000_000;
const quick = (patch: Partial<QuickRegistrationRecord> = {}): QuickRegistrationRecord => ({
  id: "quick-draft", recordType: "quick-registration", timestamp: stamp,
  updatedAt: stamp, registrationType: "trek", intensity: null,
  immediateSafety: "safe-for-now", chosenAction: "grounding", chosenActionOther: "",
  note: "Saved quick note", reflectionStatus: "pending", reflectionDueAt: stamp + 1000,
  reflectionStartedAt: null, reflectionCompletedAt: null, linkedDetailedRecordId: null,
  ...patch,
});
const quickDraft = (): RegistrationCorrectionDraft => {
  const source = quick();
  return { version: 1, entryId: source.id, type: "trek", detailed: null, quick: source,
    answers: {}, eventTime: localDateTime(source.timestamp), quickValue: structuredClone(source), useDetails: [] };
};
const settingsDraft = (value: unknown) => ({ key: "draft:registration-correction", value: JSON.stringify({ version: 1, revision: 1, updatedAt: stamp, clientId: "synthetic", value }) });
const backup = (settings: unknown[]) => ({ version: 3, dataVersion: 3, journal: [], cravingLogs: [], relapseLogs: [], anxietyLogs: [], boredomLogs: [], featureRecords: [], settings });
beforeEach(async () => { await clearAllData(); });

describe("recoverable history correction drafts", () => {
  it("accepts unfinished quick time/intensity without silently normalizing null, zero or explicit no", () => {
    for (const eventTime of ["", "2099-01-01T12:00"]) {
      for (const intensity of [null, 0, 11, -1, 3.5]) {
        const draft = quickDraft();
        draft.eventTime = eventTime;
        draft.quickValue = { ...draft.quickValue!, intensity, note: "Unfinished", useOutcome: "not_used", usePrescribed: false };
        expect(isRegistrationCorrectionDraft(draft)).toBe(true);
        expect(draft.quickValue.intensity).toBe(intensity);
      }
    }
  });
  it.each([
    { version: 2 }, { type: ["trek"] }, { eventTime: "not a date" }, { extra: true },
    { answers: { note: { nested: true } } }, { answers: { value: Infinity } },
    { useDetails: [{ ...blankUseDetail("Alcohol"), extra: true }] },
  ])("rejects malformed envelopes instead of stripping input: %j", patch => {
    expect(isRegistrationCorrectionDraft({ ...quickDraft(), ...patch })).toBe(false);
  });
  it("rejects a changed ID, timestamp, source metadata, unsupported field or invalid source", () => {
    for (const patch of [{ id: "different" }, { timestamp: stamp + 1 }, { updatedAt: stamp + 1 }, { extra: true }]) {
      const draft = quickDraft();
      expect(isRegistrationCorrectionDraft({ ...draft, quickValue: { ...draft.quickValue, ...patch } })).toBe(false);
    }
    const draft = quickDraft();
    expect(isRegistrationCorrectionDraft({ ...draft, quick: { ...draft.quick, intensity: 11 } })).toBe(false);
    expect(isRegistrationCorrectionDraft({ ...draft, quickValue: { ...draft.quickValue, immediateSafety: ["safe-for-now"] } })).toBe(false);
  });
  it("backs up and restores incomplete canonical answers, time, note, nulls and optional use detail", async () => {
    const db = await getDB();
    await db.put("cravingLogs", structuredClone(headTrekV2));
    const source = (await getCravingLogs())[0];
    const draft: RegistrationCorrectionDraft = {
      version: 1, entryId: source.id, type: "trek", detailed: source, quick: null,
      answers: { ...correctionAnswers(source, "trek"), intensity: null, actionAttempted: false, note: "Unfinished note", intensityAfter: 0 },
      eventTime: "", quickValue: null, useDetails: [{ ...blankUseDetail("Alcohol"), amountStatus: "unknown" }],
    };
    expect(isRegistrationCorrectionDraft(draft)).toBe(true);
    const setting = settingsDraft(draft);
    await setSetting(setting.key, setting.value);
    const exported = await exportAllData();
    await clearAllData();
    expect((await importAllData(exported)).committed).toBe(true);
    expect(await getSetting(setting.key)).toBe(setting.value);
    expect(JSON.parse(String(await getSetting(setting.key))).value).toEqual(draft);
  });
  it("rejects an invalid imported draft atomically and preserves an unreadable local draft in exports", async () => {
    const malformed = settingsDraft({ ...quickDraft(), eventTime: { hidden: true } });
    await setSetting("theme", "dark");
    expect((await previewImportData(backup([malformed]))).canImport).toBe(false);
    expect((await importAllData(backup([{ key: "theme", value: "light" }, malformed]))).committed).toBe(false);
    expect(await getSetting("theme")).toBe("dark");
    await setSetting(malformed.key, malformed.value);
    const exported = await exportAllData();
    expect(exported.settings).toContainEqual(malformed);
    expect(await getSetting(malformed.key)).toBe(malformed.value);
  });
});

describe("transactional correction source checks", () => {
  it.each(["trek", "relapse"] as const)("edits an actual raw legacy %s row using its enriched public-reader snapshot", async (type) => {
    const db = await getDB();
    const raw = structuredClone(type === "trek" ? headTrekV2 : headRelapseV2WithFollowUp);
    expect(raw).not.toHaveProperty("updatedAt");
    const store = type === "trek" ? "cravingLogs" : "relapseLogs";
    await db.put(store, raw as never);
    const source = type === "trek" ? (await getCravingLogs())[0] : (await getRelapseLogs())[0];
    expect(registrationSourceSignature(source)).not.toBe(registrationSourceSignature(raw));
    const answers = { ...correctionAnswers(source, type), note: "Corrected legacy source" };
    const edited = applyRegistrationCorrection(source, type, answers, source.timestamp, [], stamp);
    const saved = await updateRegistrationEpisode({ type, detailedRecord: edited, expectedSource: { detailed: source, quick: null } });
    expect(saved.detailedRecord?.note).toBe("Corrected legacy source");
    expect(saved.detailedRecord?.startedAt).toBe(source.startedAt);
    expect(saved.detailedRecord?.completedAt).toBe(source.completedAt);
    expect(saved.detailedRecord?.updatedAt).toBe(stamp);
    expect(await db.get(store, raw.id)).toEqual(saved.detailedRecord);
    // Cleanup can fail after the first write. Its exact committed return must
    // itself be a usable baseline for that retry, including legacy migrations.
    await updateRegistrationEpisode({ type, detailedRecord: saved.detailedRecord, expectedSource: { detailed: saved.detailedRecord!, quick: null } });
    expect(await db.count(store)).toBe(1);
  });
  it("edits a legacy quick row missing linkedDetailedRecordId through the public reader", async () => {
    const db = await getDB();
    const raw = quick(); delete (raw as Partial<QuickRegistrationRecord>).linkedDetailedRecordId;
    await db.put("featureRecords", raw);
    const source = (await getFeatureRecords())[0] as QuickRegistrationRecord;
    expect(source.linkedDetailedRecordId).toBeNull();
    expect(registrationSourceSignature(source)).not.toBe(registrationSourceSignature(raw));
    const saved = await updateRegistrationEpisode({ type: "trek", quickRecord: { ...source, note: "Corrected", updatedAt: stamp + 1 }, expectedSource: { detailed: null, quick: source } });
    expect(saved.quickRecord?.note).toBe("Corrected");
    expect(await db.get("featureRecords", source.id)).toEqual(saved.quickRecord);
  });
  it("detects a changed legacy source even when no updatedAt exists", async () => {
    const db = await getDB();
    await db.put("cravingLogs", structuredClone(headTrekV2));
    const source = (await getCravingLogs())[0];
    const newer = { ...headTrekV2, note: "Other tab changed the source" };
    await db.put("cravingLogs", newer);
    const edited = applyRegistrationCorrection(source, "trek", { ...correctionAnswers(source, "trek"), note: "Stale change" }, source.timestamp, [], stamp);
    await expect(updateRegistrationEpisode({ type: "trek", detailedRecord: edited, expectedSource: { detailed: source, quick: null } })).rejects.toBeInstanceOf(RegistrationSourceConflictError);
    expect(await db.get("cravingLogs", source.id)).toEqual(newer);
  });
  it("does not resurrect a deleted detailed source or its quick source", async () => {
    const db = await getDB();
    await db.put("cravingLogs", structuredClone(headTrekV2));
    const source = (await getCravingLogs())[0];
    const edited = applyRegistrationCorrection(source, "trek", correctionAnswers(source, "trek"), source.timestamp, [], stamp);
    await db.delete("cravingLogs", source.id);
    await expect(updateRegistrationEpisode({ type: "trek", detailedRecord: edited, expectedSource: { detailed: source, quick: null } })).rejects.toBeInstanceOf(RegistrationSourceConflictError);
    expect(await db.get("cravingLogs", source.id)).toBeUndefined();
    const quickSource = quick();
    await db.put("featureRecords", quickSource); await db.delete("featureRecords", quickSource.id);
    await expect(updateRegistrationEpisode({ type: "trek", quickRecord: { ...quickSource, note: "Stale" }, expectedSource: { detailed: null, quick: quickSource } })).rejects.toBeInstanceOf(RegistrationSourceConflictError);
    expect(await db.get("featureRecords", quickSource.id)).toBeUndefined();
  });
  it("rejects a changed quick half without committing the detailed half of a paired correction", async () => {
    const db = await getDB();
    await db.put("cravingLogs", { ...structuredClone(headTrekV2), answers: { ...headTrekV2.answers, quickRegistrationId: "quick-draft" } });
    const detailSource = (await getCravingLogs())[0];
    const quickSource = quick({ reflectionStatus: "completed", reflectionCompletedAt: stamp, linkedDetailedRecordId: detailSource.id });
    await db.put("featureRecords", quickSource);
    const newer = { ...quickSource, note: "Another edit without timestamp change" };
    await db.put("featureRecords", newer);
    const storedBefore = await db.get("cravingLogs", detailSource.id);
    const detailEdit = applyRegistrationCorrection(detailSource, "trek", { ...correctionAnswers(detailSource, "trek"), note: "Paired edit" }, detailSource.timestamp, [], stamp);
    await expect(updateRegistrationEpisode({ type: "trek", detailedRecord: detailEdit, quickRecord: { ...quickSource, note: "Stale paired edit" }, expectedSource: { detailed: detailSource, quick: quickSource } })).rejects.toBeInstanceOf(RegistrationSourceConflictError);
    expect(await db.get("cravingLogs", detailSource.id)).toEqual(storedBefore);
    expect(await db.get("featureRecords", quickSource.id)).toEqual(newer);
  });
  it("uses the exact committed result as a retry baseline and never adds a second row", async () => {
    const db = await getDB(); const source = quick(); await db.put("featureRecords", source);
    const saved = await updateRegistrationEpisode({ type: "trek", quickRecord: { ...source, note: "Committed before cleanup", updatedAt: stamp + 1 }, expectedSource: { detailed: null, quick: source } });
    await expect(updateRegistrationEpisode({ type: "trek", quickRecord: saved.quickRecord, expectedSource: { detailed: null, quick: source } })).rejects.toBeInstanceOf(RegistrationSourceConflictError);
    await updateRegistrationEpisode({ type: "trek", quickRecord: saved.quickRecord, expectedSource: { detailed: null, quick: saved.quickRecord! } });
    expect(await db.getAll("featureRecords")).toEqual([saved.quickRecord]);
  });
});

describe("cigarette edit source protection", () => {
  const cigarette = (): CigaretteLog => ({ id: "cigarette", timestamp: stamp, occurredAt: stamp, startedAt: stamp + 100, completedAt: stamp + 200, note: "Original", dataVersion: 3 });
  it("returns the exact committed row while retaining registration timing", async () => {
    const db = await getDB(); const source = cigarette(); await db.put("cigaretteLogs", source);
    const saved = await updateCigaretteLog({ ...source, timestamp: stamp - 60000, note: "Edited" }, source);
    expect(saved).toEqual(await db.get("cigaretteLogs", source.id));
    expect(saved.occurredAt).toBe(stamp - 60000);
    expect(saved.startedAt).toBe(source.startedAt); expect(saved.completedAt).toBe(source.completedAt);
    await updateCigaretteLog(saved, saved);
    expect(await db.count("cigaretteLogs")).toBe(1);
  });
  it("rejects stale notes, a deleted source, and a tombstone without resurrecting or overwriting", async () => {
    const db = await getDB(); const source = cigarette();
    for (const current of [{ ...source, note: "Another tab" }, { ...source, deleted: true }, null]) {
      if (current) await db.put("cigaretteLogs", current); else await db.delete("cigaretteLogs", source.id);
      await expect(updateCigaretteLog({ ...source, note: "Stale edit" }, source)).rejects.toBeInstanceOf(RegistrationSourceConflictError);
      expect(await db.get("cigaretteLogs", source.id)).toEqual(current ?? undefined);
    }
  });
});
