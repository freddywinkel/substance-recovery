import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnxietyLog, BoredomLog, CravingLog, RelapseLog } from "../src/db/schema";
import type { RegistrationSessionSnapshot } from "../src/db/registrationSessionSettings";
import type { RegistrationType } from "../src/contexts/activeRegistrationValidation";

type Completed = AnxietyLog | BoredomLog | CravingLog | RelapseLog;
const time = 1_790_000_000_000;
const types = ["craving", "trek", "anxiety", "boredom", "relapse"] as const;
beforeEach(() => { vi.resetModules(); vi.stubGlobal("indexedDB", new IDBFactory()); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function record(type: RegistrationType): Completed {
  const base = { id: `synthetic-${type}`, timestamp: time, occurredAt: time, startedAt: time, completedAt: time + 100, dataVersion: 2, note: "SYNTHETIC initial answers" };
  if (type === "anxiety") return { ...base, intensity: 7, context: "", trigger: "", bodySensations: [], reaction: "" };
  if (type === "boredom") return { ...base, intensity: 4, feelingTypes: [], situation: "", urge: "", action: "", delayDuration: null };
  if (type === "relapse") return { ...base, status: "completed", label: "no-label", when: "today", episodeDuration: "unanswered", substances: [], primarySubstance: "", amountCategory: "unanswered", firstTriggerType: "", firstTriggerText: "", preUseFactors: [], missedWarnings: [], preUseThoughtPreset: "", preUseThoughtFreeText: "", couldHaveHelpedEarly: [], couldHaveHelpedMiddle: [], couldHaveHelpedLast: [], supportContact: "", supportContactOther: "", nextStep: "", nextStepOther: "", acuteRisks: ["none"], acuteRisk: "none", context: "", emotionAfter: null };
  return { ...base, status: "completed", answers: { registrationType: type }, cravingType: type === "trek" ? "active" : "passive", situationPresets: [], situationOther: "", intensity: 5, distressLevel: null, riskLevel: "", emotions: [], emotionOther: "", physicalSensations: [], thoughtPresets: [], thoughtFreeText: "", location: "", locationOther: "", socialContext: [], substances: [], primarySubstance: "", buildupDuration: "", chosenAction: "", chosenActionOther: "", toolUsed: null, confidenceBefore: null, intensityAfter: null, confidenceAfter: null, cravingOutcome: null, interventionUsed: null, markAsPattern: false, highRiskFlag: false };
}

async function setup(type: RegistrationType = "anxiety") {
  const crud = await import("../src/db/crud");
  const session = await import("../src/db/registrationSessionSettings");
  const { parseActiveRegistration } = await import("../src/contexts/activeRegistrationValidation");
  const initialStep = type === "craving" ? "onset" : type === "relapse" ? "label" : "type";
  const parsed = parseActiveRegistration({ version: 1, type, route: `/${type}`, step: initialStep, draft: {}, updatedAt: time });
  if (!parsed.ok || !parsed.value) throw new Error("Invalid synthetic session");
  const active = { ...parsed.value, recordId: `synthetic-${type}`, startedAt: time };
  await session.setRegistrationSessionState(JSON.stringify(active), "");
  const expected = await session.getRegistrationSessionState();
  const method = type === "craving" || type === "trek" ? "addCravingLog" : type === "anxiety" ? "addAnxietyLog" : type === "boredom" ? "addBoredomLog" : "addRelapseLog";
  const save = crud[method] as (entry: Completed, expected?: RegistrationSessionSnapshot) => Promise<Completed>;
  const store: "cravingLogs" | "anxietyLogs" | "boredomLogs" | "relapseLogs" = type === "craving" || type === "trek" ? "cravingLogs" : type === "anxiety" ? "anxietyLogs" : type === "boredom" ? "boredomLogs" : "relapseLogs";
  const { getDB } = await import("../src/db/schema");
  const db = await getDB();
  return { crud, session, active, expected, save, store, db };
}

describe("atomic tracker completion ownership", () => {
  it.each(types)("rejects stale %s completion before any conflict was displayed or completed row existed", async type => {
    const { session, active, expected, save, db, store } = await setup(type);
    await session.setRegistrationSessionState(JSON.stringify({ ...active, updatedAt: time + 1 }), "", expected);
    await expect(save(record(type), expected)).rejects.toMatchObject({ name: "RegistrationSessionConflictError" });
    expect(await db.getAll(store)).toEqual([]);
  });

  it.each(types)("allows a valid %s save and same-content retry without changing its original completion timestamp", async type => {
    const { save, expected, db, store } = await setup(type);
    const input = record(type);
    const saved = await save(input, expected);
    const retry = await save({ ...input, completedAt: time + 999, updatedAt: time + 999 }, expected);
    expect(retry).toEqual(saved);
    expect(retry.completedAt).toBe(time + 100);
    expect(await db.getAll(store)).toEqual([saved]);
  });

  it.each(types)("only permits one of two different %s completions from the same still-current snapshot", async type => {
    const { save, expected, db, store } = await setup(type);
    const outcomes = await Promise.allSettled([
      save({ ...record(type), note: "SYNTHETIC first winner" }, expected),
      save({ ...record(type), note: "SYNTHETIC stale second completion" }, expected),
    ]);
    expect(outcomes.map(result => result.status)).toEqual(["fulfilled", "rejected"]);
    expect((await db.getAll(store))[0].note).toBe("SYNTHETIC first winner");
  });

  it("preserves newer completed content even if the active session has not advanced yet", async () => {
    const { crud, save, expected, db } = await setup();
    const saved = await save(record("anxiety"), expected) as AnxietyLog;
    await crud.updateAnxietyLog({ ...saved, note: "SYNTHETIC corrected completed note" });
    await expect(save(record("anxiety"), expected)).rejects.toMatchObject({ name: "RegistrationSessionConflictError" });
    expect((await db.get("anxietyLogs", saved.id))?.note).toBe("SYNTHETIC corrected completed note");
  });

  it("checks the suspended stack in the same transaction as completion", async () => {
    const { session, expected, save, db } = await setup();
    await session.setRegistrationSessionState(String(expected.activeRegistration), "[]", expected);
    await expect(save(record("anxiety"), expected)).rejects.toMatchObject({ name: "RegistrationSessionConflictError" });
    expect(await db.getAll("anxietyLogs")).toEqual([]);
  });

  it("never authorizes an old record using a newly loaded session's snapshot", async () => {
    const { session, active, expected, save, db } = await setup();
    await session.setRegistrationSessionState(JSON.stringify({ ...active, recordId: "synthetic-another-session" }), "", expected);
    const fresh = await session.getRegistrationSessionState();
    await expect(save(record("anxiety"), fresh)).rejects.toMatchObject({ name: "RegistrationSessionConflictError" });
    expect(await db.getAll("anxietyLogs")).toEqual([]);
  });

  it("requires the entry type to belong to the saved session, including the shared craving/trek store", async () => {
    const { save, expected, db } = await setup("craving");
    await expect(save({ ...record("trek"), id: "synthetic-craving" }, expected)).rejects.toMatchObject({ name: "RegistrationSessionConflictError" });
    expect(await db.getAll("cravingLogs")).toEqual([]);
  });

  it("does not recreate a completed record that was deleted after the saved session advanced", async () => {
    const { session, active, expected, save, db } = await setup();
    const saved = await save(record("anxiety"), expected);
    await session.setRegistrationSessionState(JSON.stringify({ ...active, savedLogId: saved.id, step: "done" }), "", expected);
    await db.delete("anxietyLogs", saved.id);
    await expect(save(record("anxiety"), await session.getRegistrationSessionState())).rejects.toMatchObject({ name: "RegistrationSessionConflictError" });
    expect(await db.getAll("anxietyLogs")).toEqual([]);
  });

  it("rolls back a failed commit and permits the same stable-ID attempt after storage recovers", async () => {
    const { session, expected, save, db } = await setup();
    const original = IDBObjectStore.prototype.put;
    const failure = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function(this: IDBObjectStore, value, key) {
      if (this.name === "anxietyLogs") throw new DOMException("SYNTHETIC quota failure", "QuotaExceededError");
      return original.call(this, value, key);
    });
    await expect(save(record("anxiety"), expected)).rejects.toThrow("SYNTHETIC quota failure");
    expect(await session.getRegistrationSessionState()).toEqual(expected);
    expect(await db.getAll("anxietyLogs")).toEqual([]);
    failure.mockRestore();
    await expect(save(record("anxiety"), expected)).resolves.toMatchObject({ id: "synthetic-anxiety" });
  });

  it("preserves explicit non-tracker add semantics for existing callers", async () => {
    const { crud, db } = await setup();
    const input = record("anxiety") as AnxietyLog;
    await crud.addAnxietyLog(input);
    await crud.addAnxietyLog({ ...input, note: "SYNTHETIC deliberate non-tracker replacement" });
    expect((await db.get("anxietyLogs", input.id))?.note).toBe("SYNTHETIC deliberate non-tracker replacement");
  });
});
