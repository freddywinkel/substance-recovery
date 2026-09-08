import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { getDB } from "../src/db/schema";
import { clearAllData, getSetting, setSetting } from "../src/db/crud";
import { DEFAULT_RECOVERY_PLAN, parseStoredRecoveryPlan } from "../src/lib/recoveryFeatures";
import { commitRecoveryPlan } from "../src/db/planPersistence";
import { writeLocalDraft } from "../src/lib/localDrafts";

beforeEach(async () => { await clearAllData(); });

describe("strict stored plan reads", () => {
  it("distinguishes genuinely absent settings from malformed existing values", () => {
    expect(parseStoredRecoveryPlan(undefined)).toEqual(DEFAULT_RECOVERY_PLAN);
    expect(parseStoredRecoveryPlan("")).toEqual(DEFAULT_RECOVERY_PLAN);
    const legacy = { ...DEFAULT_RECOVERY_PLAN, warningSigns: ["retain this"] };
    delete (legacy as Partial<typeof legacy>).trustedContactIds;
    expect(parseStoredRecoveryPlan(JSON.stringify(legacy))).toMatchObject({ warningSigns: ["retain this"], trustedContactIds: [] });
  });
  it.each([null, false, 0, 123, "null", "{broken", "{}", JSON.stringify({ ...DEFAULT_RECOVERY_PLAN, warningSigns: "malformed" }), JSON.stringify({ ...DEFAULT_RECOVERY_PLAN, futureField: "preserve source" })])("does not normalize unsupported stored source %j into a blank plan", raw => {
    expect(() => parseStoredRecoveryPlan(raw)).toThrow();
  });
  it.each([0, false, "{broken", "null", JSON.stringify({ ...DEFAULT_RECOVERY_PLAN, warningSigns: "malformed" })])("a save refuses to replace malformed prior data or home choices: %j", async raw => {
    await setSetting("recoveryPlan", raw);
    await setSetting("homePreferences", "SYNTHETIC retain original preferences");
    await expect(commitRecoveryPlan({ ...DEFAULT_RECOVERY_PLAN, warningSigns: ["new draft"] }, { pinnedContactId: "new" })).rejects.toThrow();
    expect(await getSetting("recoveryPlan")).toEqual(raw);
    expect(await getSetting("homePreferences")).toEqual("SYNTHETIC retain original preferences");
  });
  it("keeps the absent-previous conflict check after another tab deletes the plan", async () => {
    const first = await commitRecoveryPlan({ ...DEFAULT_RECOVERY_PLAN, warningSigns: ["old"] }, undefined, 100);
    await setSetting("recoveryPlan", "");
    await expect(commitRecoveryPlan(first.plan, undefined, 200)).rejects.toThrow("another tab");
    expect(await getSetting("recoveryPlan")).toBe("");
  });
});

describe("unsupported draft source preservation", () => {
  it.each([0, false, 123, "{broken", "null"])("rejects write retry over malformed raw value %j", async raw => {
    await setSetting("draft:recovery-plan", raw);
    await expect(writeLocalDraft("recovery-plan", { note: "replacement" }, 0, "synthetic-tab")).rejects.toThrow("Unsupported saved draft");
    expect(await getSetting("draft:recovery-plan")).toEqual(raw);
  });
  it("also preserves an unsupported null stored value instead of treating it as absent", async () => {
    const db = await getDB();
    // Deliberate corruption fixture in isolated fake IndexedDB.
    await db.put("settings", { key: "draft:recovery-plan", value: null as unknown as string });
    await expect(writeLocalDraft("recovery-plan", {}, 0, "synthetic-tab")).rejects.toThrow("Unsupported saved draft");
    expect((await db.get("settings", "draft:recovery-plan"))?.value).toBeNull();
  });
  it("still permits new drafts and explicitly cleared slots", async () => {
    expect(await writeLocalDraft("quick-registration", { note: "new" }, 0, "synthetic-tab")).toBe(1);
    await setSetting("draft:quick-registration", "");
    expect(await writeLocalDraft("quick-registration", { note: "newer" }, 0, "synthetic-tab")).toBe(1);
  });
});
