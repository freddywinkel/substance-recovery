import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { cigaretteDraftMatchesSource, isCigaretteEditDraft, type CigaretteEditValues } from "../src/lib/cigaretteEditDraft";
import { clearAllData, exportAllData, getSetting, importAllData, setSetting } from "../src/db/crud";

const valid: CigaretteEditValues = { id: "synthetic-cigarette", editTime: "", editNote: "unfinished", sourceTimestamp: 1_700_000_000_000, sourceNote: "original", sourceUpdatedAt: null };

describe("cigarette edit draft boundaries", () => {
  beforeEach(async () => { await clearAllData(); });
  it("preserves unfinished times without accepting unsupported draft shapes", () => {
    expect(isCigaretteEditDraft(null)).toBe(true);
    expect(isCigaretteEditDraft(valid)).toBe(true);
    expect(isCigaretteEditDraft({ ...valid, editTime: "unfinished" })).toBe(true);
    for (const patch of [{ id: "" }, { id: 12 }, { editNote: [] }, { editTime: null }, { sourceTimestamp: Infinity }, { sourceTimestamp: 8_640_000_000_000_001 }, { sourceTimestamp: -1 }, { sourceNote: false }, { sourceUpdatedAt: "1" }, { sourceUpdatedAt: -1 }, { extra: true }]) {
      expect(isCigaretteEditDraft({ ...valid, ...patch })).toBe(false);
    }
    expect(isCigaretteEditDraft([])).toBe(false);
    expect(isCigaretteEditDraft({ ...valid, sourceNote: undefined })).toBe(false);
  });
  it("distinguishes source edits, deletion and historical unstamped records", () => {
    const log = { id: valid.id, timestamp: valid.sourceTimestamp, note: valid.sourceNote };
    expect(cigaretteDraftMatchesSource(valid, log)).toBe(true);
    for (const patch of [{ timestamp: log.timestamp + 1 }, { note: "concurrent" }, { updatedAt: 1 }, { deleted: true }, { id: "other" }]) {
      expect(cigaretteDraftMatchesSource(valid, { ...log, ...patch })).toBe(false);
    }
  });
  it("round-trips an unfinished draft and rejects a malformed replacement atomically", async () => {
    const envelope = { version: 1, revision: 1, updatedAt: 100, clientId: "synthetic", value: valid };
    await setSetting("draft:cigarette-edit", JSON.stringify(envelope));
    const backup = await exportAllData();
    await clearAllData();
    expect((await importAllData(backup, { mode: "replace" })).committed).toBe(true);
    expect(JSON.parse(String(await getSetting("draft:cigarette-edit")))).toEqual(envelope);
    const corrupt = structuredClone(backup);
    (corrupt.settings as Array<{ key: string; value: unknown }>).find(item => item.key === "draft:cigarette-edit")!.value = JSON.stringify({ ...envelope, value: { ...valid, sourceTimestamp: 9e20 } });
    expect((await importAllData(corrupt, { mode: "replace" })).committed).toBe(false);
    expect(JSON.parse(String(await getSetting("draft:cigarette-edit")))).toEqual(envelope);
  });
});
