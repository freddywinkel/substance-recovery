import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankQuickRegistrationDraft, isQuickRegistrationDraft } from "../src/lib/quickRegistrationDraft";
import { isJourneyDateDraft, isValidSettingsDate, localSettingsDate, performSettingsReset } from "../src/lib/settingsActions";
import { clearAllData, exportAllData, getSetting, importAllData, setSetting } from "../src/db/crud";

beforeEach(async () => { await clearAllData(); });

describe("quick draft payload validation", () => {
  it("preserves unanswered, explicit zero, GHB and optional fields absent in older drafts", () => {
    const blank = createBlankQuickRegistrationDraft();
    expect(isQuickRegistrationDraft(blank)).toBe(true);
    expect(isQuickRegistrationDraft({ ...blank, intensity: 0, target: "GHB", useOutcome: "unsure" })).toBe(true);
    const { target, useOutcome, usePrescribed, ...legacy } = blank;
    expect(isQuickRegistrationDraft(legacy)).toBe(true);
  });
  it.each([
    { id: " " }, { timestamp: Infinity }, { timestamp: -1 }, { timestamp: "123" },
    { registrationType: "diagnosis" }, { intensity: 2.5 }, { intensity: 11 }, { intensity: undefined },
    { immediateSafety: "probably-safe" }, { chosenAction: "unreviewed-action" },
    { chosenActionOther: [] }, { chosenActionOther: "x".repeat(501) }, { note: "x".repeat(2001) },
    { target: "unmapped target" }, { useOutcome: "maybe-used" }, { usePrescribed: "yes" }, { unknownField: "keep?" },
    { target: "Gaming", useOutcome: "used", usePrescribed: true }, { useOutcome: "not_used", usePrescribed: true },
  ])("rejects unsupported fields without coercing them: %j", patch => {
    expect(isQuickRegistrationDraft({ ...createBlankQuickRegistrationDraft(), ...patch })).toBe(false);
  });
  it("round-trips a valid quick draft and rejects a malformed import atomically", async () => {
    const envelope = { version: 1, revision: 1, updatedAt: 100, clientId: "synthetic", value: { ...createBlankQuickRegistrationDraft(), intensity: 0, note: "unfinished" } };
    await setSetting("draft:quick-registration", JSON.stringify(envelope));
    const backup = await exportAllData();
    await clearAllData();
    expect((await importAllData(backup, { mode: "replace" })).committed).toBe(true);
    expect(JSON.parse(String(await getSetting("draft:quick-registration")))).toEqual(envelope);
    const corrupt = structuredClone(backup);
    const settings = corrupt.settings as Array<{ key: string; value: unknown }>;
    settings.find(item => item.key === "draft:quick-registration")!.value = JSON.stringify({ ...envelope, value: { ...envelope.value, immediateSafety: [] } });
    expect((await importAllData(corrupt, { mode: "replace" })).committed).toBe(false);
    expect(JSON.parse(String(await getSetting("draft:quick-registration")))).toEqual(envelope);
  });
});

describe("settings dates and reset commit boundary", () => {
  it("preserves future date drafts without permitting them as applied dates", () => {
    expect(isJourneyDateDraft("2099-01-01")).toBe(true);
    expect(isValidSettingsDate("2099-01-01", "2026-09-09")).toBe(false);
    expect(isJourneyDateDraft("")).toBe(true);
    for (const value of [null, 20260909, "2026-02-30", "malformed", {}, []]) expect(isJourneyDateDraft(value)).toBe(false);
  });
  it("uses the local calendar and rejects impossible or future dates", () => {
    expect(localSettingsDate(new Date(2026, 8, 8, 0, 1))).toBe("2026-09-08");
    expect(isValidSettingsDate("", "2026-09-08")).toBe(true);
    expect(isValidSettingsDate("2024-02-29", "2026-09-08")).toBe(true);
    for (const value of ["2025-02-29", "2026-13-01", "2026-09-09", "not a date"]) expect(isValidSettingsDate(value, "2026-09-08")).toBe(false);
  });
  const actions = () => ({ flush: vi.fn().mockResolvedValue(undefined), erase: vi.fn().mockResolvedValue(undefined), committed: vi.fn(), clearDraftMemory: vi.fn(), clearBrowserMetadata: vi.fn(), reload: vi.fn() });
  it("does not erase or reload if an unfinished draft cannot flush", async () => {
    const a = actions(); a.flush.mockRejectedValue(new Error("draft write failed"));
    expect(await performSettingsReset(a)).toMatchObject({ committed: false });
    expect(a.erase).not.toHaveBeenCalled(); expect(a.committed).not.toHaveBeenCalled(); expect(a.reload).not.toHaveBeenCalled();
  });
  it("does not report committed deletion after a database transaction fails", async () => {
    const a = actions(); a.erase.mockRejectedValue(new Error("database erase failed"));
    expect(await performSettingsReset(a)).toMatchObject({ committed: false });
    expect(a.committed).not.toHaveBeenCalled(); expect(a.clearBrowserMetadata).not.toHaveBeenCalled(); expect(a.reload).not.toHaveBeenCalled();
  });
  it("still reloads after deletion if optional browser cleanup fails", async () => {
    const a = actions(); a.clearBrowserMetadata.mockImplementation(() => { throw new Error("localStorage denied"); });
    expect(await performSettingsReset(a)).toEqual({ committed: true });
    expect(a.erase).toHaveBeenCalledTimes(1); expect(a.committed).toHaveBeenCalledTimes(1); expect(a.reload).toHaveBeenCalledTimes(1);
  });
  it("reports successful deletion with a separate reload problem", async () => {
    const a = actions(); a.reload.mockImplementation(() => { throw new Error("reload denied"); });
    expect(await performSettingsReset(a)).toMatchObject({ committed: true, error: expect.any(Error) });
    expect(a.erase).toHaveBeenCalledTimes(1); expect(a.committed).toHaveBeenCalledTimes(1);
  });
});
