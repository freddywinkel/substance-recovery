import { vi } from "vitest";
import { clearAllData, importAllData, type ImportMode } from "../../src/db/crud";
import { getDB } from "../../src/db/schema";
import * as generation from "../../src/db/storageGeneration";

/**
 * Ordinary roundtrip tests run several app loads in one test module. Simulate
 * ONLY the immutable startup-generation read that a full page reload performs.
 * Production exports no function that grants a stale window a new generation.
 * Reset-isolation tests must use the real APIs and must not call this helper
 * before asserting that the old window is denied.
 */
export async function simulateFullAppReload(): Promise<void> {
  const row = await (await getDB()).get("syncMeta", generation.STORAGE_GENERATION_KEY);
  const current = typeof row?.value === "string" ? row.value : generation.INITIAL_STORAGE_GENERATION;
  vi.spyOn(generation, "getLoadedStorageGeneration").mockReturnValue(current);
}

export async function clearDataAndReload(): Promise<void> {
  await simulateFullAppReload(); // A fresh test session may follow an erased one.
  await clearAllData();
  await simulateFullAppReload();
}

export async function importDataAndReload(payload: Record<string, unknown>, options: { mode?: ImportMode } = {}) {
  const result = await importAllData(payload, options);
  if (result.committed) await simulateFullAppReload();
  return result;
}
