export function localSettingsDate(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
export function isValidSettingsDate(value: string, today = localSettingsDate()): boolean {
  if (value === "") return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value > today) return false;
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime()) && localSettingsDate(date) === value;
}
/** Future dates can be unfinished drafts; applying one has stricter rules. */
export function isJourneyDateDraft(value: unknown): value is string {
  return typeof value === "string" && isValidSettingsDate(value, "9999-12-31");
}

/** Separate the irreversible data commit from optional browser cleanup/reload. */
export async function performSettingsReset(actions: {
  flush: () => Promise<void>; erase: () => Promise<void>; committed: () => void;
  clearDraftMemory: () => void; clearBrowserMetadata: () => void; reload: () => void;
}): Promise<{ committed: boolean; error?: Error }> {
  try { await actions.flush(); await actions.erase(); }
  catch (cause) { return { committed: false, error: cause instanceof Error ? cause : new Error(String(cause)) }; }
  actions.committed();
  // IndexedDB is authoritative. Optional localStorage denial must never be called
  // a failed erase or invite a second destructive operation.
  try { actions.clearDraftMemory(); } catch { /* A full reload also clears memory. */ }
  try { actions.clearBrowserMetadata(); } catch { /* Optional display metadata only. */ }
  try { actions.reload(); return { committed: true }; }
  catch (cause) { return { committed: true, error: cause instanceof Error ? cause : new Error(String(cause)) }; }
}
