import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { createSupportiveActionDraft, isSupportiveActionDraft } from "../src/lib/supportiveActionDraft";
import { isHomeCustomizationDraft } from "../src/lib/homeCustomizationDraft";
import { DEFAULT_HOME_PREFERENCES } from "../src/lib/recoveryFeatures";
import { clearAllData, exportAllData, getSetting, importAllData, previewImportData, setSetting } from "../src/db/crud";

beforeEach(async () => { await clearAllData(); });
const settingsDraft = (key: string, value: unknown) => ({ key: `draft:${key}`, value: JSON.stringify({ version: 1, revision: 1, updatedAt: 1780000000000, clientId: "synthetic", value }) });
const backup = (settings: unknown[]) => ({ version: 3, dataVersion: 3, journal: [], cravingLogs: [], relapseLogs: [], anxietyLogs: [], boredomLogs: [], featureRecords: [], settings });

describe("unfinished action and home editor drafts", () => {
  it("retains incomplete action input and a stable ID before submission", () => {
    const blank = createSupportiveActionDraft();
    expect(blank.timestamp).toBeNull(); expect(blank.label).toBe("");
    expect(isSupportiveActionDraft(blank)).toBe(true);
    const edited = { ...blank, actionType: "care", label: "Synthetic meeting", note: "Unfinished note" };
    expect(isSupportiveActionDraft(edited)).toBe(true);
    expect(edited.id).toBe(blank.id);
  });
  it.each([{ id: "" }, { timestamp: -1 }, { timestamp: 1.5 }, { timestamp: Infinity }, { actionType: "tool" }, { actionType: ["care"] }, { label: "x".repeat(501) }, { note: "x".repeat(2001) }, { futureField: true }])("rejects malformed action draft %j", patch => {
    expect(isSupportiveActionDraft({ ...createSupportiveActionDraft(), ...patch })).toBe(false);
  });
  it("uses the exact home catalogue without truncating unknown or excessive selections", () => {
    expect(isHomeCustomizationDraft(DEFAULT_HOME_PREFERENCES)).toBe(true);
    for (const patch of [{ widgetOrder: [] }, { hiddenWidgets: ["follow-ups"] }, { pinnedToolIds: ["/tools/breathing", "/tools/tape", "/tools/grounding"] }, { pinnedContactId: "" }, { futureField: "preserve" }]) {
      expect(isHomeCustomizationDraft({ ...DEFAULT_HOME_PREFERENCES, ...patch })).toBe(false);
    }
  });
  it("backs up and restores unsaved action, home choices and a future date awaiting correction", async () => {
    const settings = [settingsDraft("supportive-action", { ...createSupportiveActionDraft(), label: "Synthetic input" }), settingsDraft("home-customization", { ...DEFAULT_HOME_PREFERENCES, hiddenWidgets: ["sobriety"] }), settingsDraft("journey-date", "2099-01-01")];
    expect((await previewImportData(backup(settings))).canImport).toBe(true);
    expect((await importAllData(backup(settings))).committed).toBe(true);
    const exported = await exportAllData(); await clearAllData();
    expect((await importAllData(exported)).committed).toBe(true);
    for (const setting of settings) expect(await getSetting(setting.key)).toBe(setting.value);
  });
  it("rejects malformed new draft payloads before replacing any saved settings", async () => {
    await setSetting("theme", "dark");
    const malformed = [settingsDraft("supportive-action", { ...createSupportiveActionDraft(), note: [] }), settingsDraft("home-customization", { ...DEFAULT_HOME_PREFERENCES, widgetOrder: ["future"] }), settingsDraft("journey-date", "2026-02-31")];
    for (const setting of malformed) {
      const payload = backup([{ key: "theme", value: "light" }, setting]);
      expect((await previewImportData(payload)).canImport).toBe(false);
      expect((await importAllData(payload)).committed).toBe(false);
      expect(await getSetting("theme")).toBe("dark");
    }
  });
});
