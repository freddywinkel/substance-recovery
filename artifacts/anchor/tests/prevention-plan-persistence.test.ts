import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearAllData, exportAllData, getSetting, importAllData, setSetting } from "../src/db/crud";
import { commitRecoveryPlan } from "../src/db/planPersistence";
import { DEFAULT_RECOVERY_PLAN, parseRecoveryPlan, isValidRecoveryPlan } from "../src/lib/recoveryFeatures";
import { emptyPreventionPlan, isValidPreventionPlan } from "../src/lib/preventionPlan";
import { DraftConflictError, flushLocalDrafts, queueDraftWrite, readLocalDraft, removeLocalDraft, resetLocalDraftMemory, writeLocalDraft } from "../src/lib/localDrafts";

beforeEach(async () => { vi.restoreAllMocks(); await flushLocalDrafts().catch(() => undefined); resetLocalDraftMemory(); await clearAllData(); });

const plan = () => ({ ...DEFAULT_RECOVERY_PLAN, warningSigns: ["My original signal"], prevention: {
  ...emptyPreventionPlan(), goals: [{ id: "goal-a", target: "Alcohol", type: "reduction" as const, description: "My personal agreement", startDate: "2026-09-01", active: true, showProgress: true }],
  signalActions: [{ id: "signal-a", signal: "Isolating", firstAction: "Call my friend", alternative: "Contact my team", contactId: "friend", toolId: null }],
} });

describe("versioned prevention plan", () => {
  it("preserves legacy values and new fields through save, backup and restore", async () => {
    const saved = await commitRecoveryPlan(plan(), { pinnedContactId: "friend" }, 100);
    expect(saved.plan.prevention?.revision).toBe(1);
    const backup = await exportAllData();
    await clearAllData();
    const restored = await importAllData(backup, { mode: "replace" });
    expect(restored.committed).toBe(true);
    expect(parseRecoveryPlan(JSON.parse(String(await getSetting("recoveryPlan"))))).toEqual(saved.plan);
  });
  it("preserves one exact prior version per save, without recursive history", async () => {
    const first = await commitRecoveryPlan(plan(), undefined, 100);
    const second = await commitRecoveryPlan({ ...first.plan, warningSigns: ["A revised signal"] }, undefined, 100);
    expect(second.plan.updatedAt).toBe(101);
    expect(second.plan.prevention?.revisions).toHaveLength(1);
    const snapshot = JSON.parse(second.plan.prevention!.revisions[0].content);
    expect(snapshot.warningSigns).toEqual(["My original signal"]);
    expect(snapshot.prevention.revisions).toEqual([]);
  });
  it("rejects stale tab saves without replacing the new plan or home choices", async () => {
    const first = await commitRecoveryPlan(plan(), { pinnedContactId: "first" }, 100);
    const second = await commitRecoveryPlan({ ...first.plan, warningSigns: ["Newer tab"] }, { pinnedContactId: "second" }, 200);
    await expect(commitRecoveryPlan(first.plan, { pinnedContactId: "stale" }, 300)).rejects.toThrow("another tab");
    expect(JSON.parse(String(await getSetting("recoveryPlan")))).toEqual(second.plan);
    expect(JSON.parse(String(await getSetting("homePreferences"))).pinnedContactId).toBe("second");
  });
  it("does not let a stale tab remove another tab's newer draft", async () => {
    const first = await writeLocalDraft("recovery-plan", { note: "first" }, 0, "tab-a");
    await writeLocalDraft("recovery-plan", { note: "newer" }, first, "tab-b");
    await expect(removeLocalDraft("recovery-plan", first)).rejects.toBeInstanceOf(DraftConflictError);
    expect((await readLocalDraft("recovery-plan"))?.value).toEqual({ note: "newer" });
  });
  it("does not resurrect a removed plan from a stale tab", async () => {
    const saved = await commitRecoveryPlan(plan(), undefined, 100);
    await clearAllData();
    await expect(commitRecoveryPlan(saved.plan)).rejects.toThrow("another tab");
    expect(await getSetting("recoveryPlan")).toBeUndefined();
  });
  it("rolls back both writes if preference persistence fails", async () => {
    const first = await commitRecoveryPlan(plan(), { pinnedContactId: "first" }, 100);
    const original = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore["put"]>) {
      if ((args[0] as { key?: string }).key === "homePreferences") throw new DOMException("synthetic quota", "QuotaExceededError");
      return original.apply(this, args);
    });
    await expect(commitRecoveryPlan({ ...first.plan, warningSigns: ["Must not commit"] }, { pinnedContactId: "failed" }, 200)).rejects.toThrow();
    expect(JSON.parse(String(await getSetting("recoveryPlan")))).toEqual(first.plan);
  });
  it("does not normalize future versions or malformed extended data into an empty plan", () => {
    expect(() => parseRecoveryPlan({ ...plan(), version: 2 })).toThrow("Unsupported");
    expect(isValidRecoveryPlan({ ...plan(), prevention: { version: 2 } })).toBe(false);
    expect(() => parseRecoveryPlan({ ...plan(), prevention: { version: 2 } })).toThrow("Unsupported");
    expect(isValidPreventionPlan({ ...emptyPreventionPlan(), reviewDate: "2026-02-30" })).toBe(false);
  });
});

describe("durable local drafts", () => {
  it("serializes rapid writes and reads back the final value", async () => {
    let revision = 0;
    const first = queueDraftWrite("recovery-plan", async () => { revision = await writeLocalDraft("recovery-plan", { text: "First" }, revision, "tab-a"); });
    const second = queueDraftWrite("recovery-plan", async () => { revision = await writeLocalDraft("recovery-plan", { text: "Second" }, revision, "tab-a"); });
    await Promise.all([first, second]); await flushLocalDrafts();
    expect((await readLocalDraft("recovery-plan"))?.value).toEqual({ text: "Second" });
    expect(revision).toBe(2);
  });
  it("prevents lost updates between tabs and permits explicit rebase", async () => {
    await writeLocalDraft("journal-entry", { note: "tab A" }, 0, "tab-a");
    await expect(writeLocalDraft("journal-entry", { note: "tab B" }, 0, "tab-b")).rejects.toBeInstanceOf(DraftConflictError);
    expect((await readLocalDraft("journal-entry"))?.value).toEqual({ note: "tab A" });
    await writeLocalDraft("journal-entry", { note: "keep B explicitly" }, 1, "tab-b");
    expect((await readLocalDraft("journal-entry"))?.value).toEqual({ note: "keep B explicitly" });
  });
  it("does not upgrade on failed writes, and a successful retry clears the block", async () => {
    await expect(queueDraftWrite("quick-registration", async () => { throw new Error("synthetic write failure"); })).rejects.toThrow();
    await expect(flushLocalDrafts()).rejects.toThrow("not been saved");
    await queueDraftWrite("quick-registration", async () => { await writeLocalDraft("quick-registration", { intensity: 0 }, 0, "tab-a"); });
    await expect(flushLocalDrafts()).resolves.toBeUndefined();
    await removeLocalDraft("quick-registration");
    expect(await readLocalDraft("quick-registration")).toBeNull();
  });
  it("retains unsupported draft source data rather than replacing it", async () => {
    await setSetting("draft:recovery-plan", JSON.stringify({ version: 99, value: "original" }));
    await expect(readLocalDraft("recovery-plan")).rejects.toThrow("unsupported");
    await expect(writeLocalDraft("recovery-plan", { text: "overwrite" }, 0, "tab-a")).rejects.toThrow("Unsupported");
    expect(JSON.parse(String(await getSetting("draft:recovery-plan"))).value).toBe("original");
  });
});
