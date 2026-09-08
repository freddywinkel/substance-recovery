import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ states: [] as unknown[], effects: [] as (() => unknown)[], cursor: 0, getJournalEntries: vi.fn(), addJournalEntry: vi.fn(), deleteJournalEntry: vi.fn(), getSetting: vi.fn(), setSetting: vi.fn(), getCrisisService: vi.fn(), getEmergencyContacts: vi.fn() }));
vi.mock("react", () => ({
  useState: (initial: unknown) => { const index = mock.cursor++; if (!(index in mock.states)) mock.states[index] = typeof initial === "function" ? initial() : initial; return [mock.states[index], (update: unknown) => { mock.states[index] = typeof update === "function" ? update(mock.states[index]) : update; }]; },
  useCallback: (callback: unknown) => callback,
  useEffect: (callback: () => unknown) => { mock.effects.push(callback); },
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
}));
vi.mock("../src/db", () => ({ getJournalEntries: mock.getJournalEntries, addJournalEntry: mock.addJournalEntry, deleteJournalEntry: mock.deleteJournalEntry, getSetting: mock.getSetting, setSetting: mock.setSetting, getCrisisService: mock.getCrisisService, getEmergencyContacts: mock.getEmergencyContacts, saveCrisisService: vi.fn(), saveEmergencyContacts: vi.fn() }));
import { useJournal } from "../src/hooks/useJournal";
import { useSettings } from "../src/hooks/useSettings";
import { useUI } from "../src/hooks/useUI";
import { useStorageIntegrity, clearStorageIssue } from "../src/lib/storageIntegrity";
beforeEach(() => { vi.resetAllMocks(); mock.states = []; mock.effects = []; mock.cursor = 0; for (const key of ["journal", "settings", "theme"]) clearStorageIssue(key); });
const saved = { id: "stable", timestamp: 1234, mood: null, cravingIntensity: null, note: "synthetic", toolUsed: null };

describe("committed writes and read failures", () => {
  it("returns a committed journal record when readback fails, instead of inviting a duplicate retry", async () => {
    mock.addJournalEntry.mockResolvedValue(saved); mock.getJournalEntries.mockRejectedValue(new Error("readback failed"));
    const hook = useJournal(); await expect(hook.logEntry(saved)).resolves.toEqual(saved);
    expect(mock.states[0]).toEqual([saved]); expect(useStorageIntegrity().journal?.kind).toBe("readback"); expect(mock.addJournalEntry).toHaveBeenCalledWith(saved);
  });
  it("propagates a failed journal write and does not remove the caller's draft", async () => {
    mock.addJournalEntry.mockRejectedValue(new Error("quota")); const hook = useJournal(); await expect(hook.logEntry(saved)).rejects.toThrow("quota");
    expect(mock.getJournalEntries).not.toHaveBeenCalled(); expect(mock.states[0]).toEqual([]);
  });
  it("removes a committed deletion from the visible cache despite failed readback", async () => {
    mock.deleteJournalEntry.mockResolvedValue(undefined); mock.getJournalEntries.mockRejectedValue(new Error("readback"));
    const hook = useJournal(); mock.states[0] = [saved]; await expect(hook.removeEntry(saved.id)).resolves.toBeUndefined();
    expect(mock.states[0]).toEqual([]); expect(useStorageIntegrity().journal?.kind).toBe("readback");
  });
  it("finishes journal loading with a persistent error and permits retry", async () => {
    mock.getJournalEntries.mockRejectedValueOnce(new Error("offline store failure")).mockResolvedValueOnce([saved]);
    const hook = useJournal(); await hook.reload(); expect(mock.states[1]).toBe(false); expect(mock.states[2]).toBeInstanceOf(Error);
    await hook.reload(); expect(mock.states[0]).toEqual([saved]); expect(mock.states[2]).toBeNull(); expect(useStorageIntegrity().journal).toBeUndefined();
  });
  it("finishes settings and theme loads on errors without pretending data is empty/saved", async () => {
    mock.getSetting.mockRejectedValue(new Error("settings read failure")); mock.getCrisisService.mockResolvedValue(null); mock.getEmergencyContacts.mockResolvedValue([]);
    const settings = useSettings(); await settings.reload(); expect(mock.states[3]).toBe(false); expect(mock.states[4]).toBeInstanceOf(Error); expect(useStorageIntegrity().settings?.kind).toBe("read");
    mock.states = []; mock.cursor = 0;
    const ui = useUI(); await ui.reload(); expect(mock.states[1]).toBe(false); expect(mock.states[2]).toBeInstanceOf(Error); expect(useStorageIntegrity().theme?.kind).toBe("read");
  });
});
