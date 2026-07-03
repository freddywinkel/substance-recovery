import {
  getDB,
  type AnxietyLog,
  type BoredomLog,
  type CravingLog,
  type CrisisService,
  type EmergencyContact,
  type JournalEntry,
  type RelapseLog,
} from "./schema";
import {
  markDirty,
  nextUpdatedAt,
  setSobrietyUpdatedAt,
  SOBRIETY_RECORD_ID,
  SOBRIETY_SETTING_KIND,
  SOBRIETY_UPDATED_AT_KEY,
  SYNCABLE_RECORD_KINDS,
} from "./sync";

export async function getCrisisService(): Promise<CrisisService | null> {
  const db = await getDB();
  const record = await db.get("settings", "crisisService");
  if (!record?.value) return null;
  try { return JSON.parse(record.value as string) as CrisisService; } catch { return null; }
}
export async function saveCrisisService(service: CrisisService | null): Promise<void> {
  const db = await getDB();
  await db.put("settings", { key: "crisisService", value: service ? JSON.stringify(service) : "" });
}
export async function getEmergencyContacts(): Promise<EmergencyContact[]> {
  const db = await getDB();
  const record = await db.get("settings", "emergencyContacts");
  if (!record?.value) return [];
  try { return JSON.parse(record.value as string) as EmergencyContact[]; } catch { return []; }
}
export async function saveEmergencyContacts(contacts: EmergencyContact[]): Promise<void> {
  const db = await getDB();
  await db.put("settings", { key: "emergencyContacts", value: JSON.stringify(contacts) });
}
// ── Journal ──────────────────────────────────────────────────
export async function addJournalEntry(entry: Omit<JournalEntry, "id">): Promise<JournalEntry> {
  const db = await getDB();
  const full: JournalEntry = { ...entry, id: crypto.randomUUID(), updatedAt: await nextUpdatedAt() };
  await db.put("journal", full);
  await markDirty("journal", full.id);
  return full;
}
export async function getJournalEntries(limit = 100): Promise<JournalEntry[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("journal", "byTimestamp");
  return all.filter((e) => !e.deleted).slice(-limit).reverse();
}
export async function deleteJournalEntry(id: string): Promise<void> {
  const db = await getDB();
  const existing = await db.get("journal", id);
  if (!existing) return;
  await db.put("journal", { ...existing, deleted: true, updatedAt: await nextUpdatedAt() });
  await markDirty("journal", id);
}

// ── Settings ─────────────────────────────────────────────────
export async function getSetting(key: string, defaultValue?: string | number | boolean) {
  const db = await getDB();
  const record = await db.get("settings", key);
  return record?.value ?? defaultValue;
}
export async function setSetting(key: string, value: string | number | boolean) {
  const db = await getDB();
  await db.put("settings", { key, value });
  // Only sobrietyStartDate is syncable; all other settings stay device-local.
  if (key === SOBRIETY_RECORD_ID) {
    await setSobrietyUpdatedAt(await nextUpdatedAt());
    await markDirty(SOBRIETY_SETTING_KIND, SOBRIETY_RECORD_ID);
  }
}

// ── Craving Logs ─────────────────────────────────────────────
export async function addCravingLog(entry: Omit<CravingLog, "id">): Promise<CravingLog> {
  const db = await getDB();
  const full: CravingLog = { ...entry, id: crypto.randomUUID(), updatedAt: await nextUpdatedAt() };
  await db.put("cravingLogs", full);
  await markDirty("cravingLogs", full.id);
  return full;
}
export async function updateCravingLog(log: CravingLog): Promise<void> {
  const db = await getDB();
  const next: CravingLog = { ...log, updatedAt: await nextUpdatedAt() };
  await db.put("cravingLogs", next);
  await markDirty("cravingLogs", next.id);
}
export async function getCravingLogs(limit = 200): Promise<CravingLog[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("cravingLogs", "byTimestamp");
  return all.filter((e) => !e.deleted).slice(-limit).reverse();
}
export async function deleteCravingLog(id: string): Promise<void> {
  const db = await getDB();
  const existing = await db.get("cravingLogs", id);
  if (!existing) return;
  await db.put("cravingLogs", { ...existing, deleted: true, updatedAt: await nextUpdatedAt() });
  await markDirty("cravingLogs", id);
}

// ── Relapse Logs ─────────────────────────────────────────────
export async function addRelapseLog(entry: Omit<RelapseLog, "id">): Promise<RelapseLog> {
  const db = await getDB();
  const full: RelapseLog = { ...entry, id: crypto.randomUUID(), updatedAt: await nextUpdatedAt() };
  await db.put("relapseLogs", full);
  await markDirty("relapseLogs", full.id);
  return full;
}
export async function getRelapseLogs(limit = 200): Promise<RelapseLog[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("relapseLogs", "byTimestamp");
  return all.filter((e) => !e.deleted).slice(-limit).reverse();
}
export async function updateRelapseLog(log: RelapseLog): Promise<void> {
  const db = await getDB();
  const next: RelapseLog = { ...log, updatedAt: await nextUpdatedAt() };
  await db.put("relapseLogs", next);
  await markDirty("relapseLogs", next.id);
}
export async function deleteRelapseLog(id: string): Promise<void> {
  const db = await getDB();
  const existing = await db.get("relapseLogs", id);
  if (!existing) return;
  await db.put("relapseLogs", { ...existing, deleted: true, updatedAt: await nextUpdatedAt() });
  await markDirty("relapseLogs", id);
}

// ── Anxiety Logs ─────────────────────────────────────────────
export async function addAnxietyLog(entry: Omit<AnxietyLog, "id">): Promise<AnxietyLog> {
  const db = await getDB();
  const full: AnxietyLog = { ...entry, id: crypto.randomUUID(), updatedAt: await nextUpdatedAt() };
  await db.put("anxietyLogs", full);
  await markDirty("anxietyLogs", full.id);
  return full;
}
export async function getAnxietyLogs(limit = 200): Promise<AnxietyLog[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("anxietyLogs", "byTimestamp");
  return all.filter((e) => !e.deleted).slice(-limit).reverse();
}
export async function updateAnxietyLog(log: AnxietyLog): Promise<void> {
  const db = await getDB();
  const next: AnxietyLog = { ...log, updatedAt: await nextUpdatedAt() };
  await db.put("anxietyLogs", next);
  await markDirty("anxietyLogs", next.id);
}
export async function deleteAnxietyLog(id: string): Promise<void> {
  const db = await getDB();
  const existing = await db.get("anxietyLogs", id);
  if (!existing) return;
  await db.put("anxietyLogs", { ...existing, deleted: true, updatedAt: await nextUpdatedAt() });
  await markDirty("anxietyLogs", id);
}

// ── Boredom Logs ──────────────────────────────────────────────
export async function addBoredomLog(entry: Omit<BoredomLog, "id">): Promise<BoredomLog> {
  const db = await getDB();
  const full: BoredomLog = { ...entry, id: crypto.randomUUID(), updatedAt: await nextUpdatedAt() };
  await db.put("boredomLogs", full);
  await markDirty("boredomLogs", full.id);
  return full;
}
export async function getBoredomLogs(limit = 200): Promise<BoredomLog[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("boredomLogs", "byTimestamp");
  return all.filter((e) => !e.deleted).slice(-limit).reverse();
}
export async function updateBoredomLog(log: BoredomLog): Promise<void> {
  const db = await getDB();
  const next: BoredomLog = { ...log, updatedAt: await nextUpdatedAt() };
  await db.put("boredomLogs", next);
  await markDirty("boredomLogs", next.id);
}
export async function deleteBoredomLog(id: string): Promise<void> {
  const db = await getDB();
  const existing = await db.get("boredomLogs", id);
  if (!existing) return;
  await db.put("boredomLogs", { ...existing, deleted: true, updatedAt: await nextUpdatedAt() });
  await markDirty("boredomLogs", id);
}

// ── Clear all ────────────────────────────────────────────────
export async function clearAllData(): Promise<void> {
  const db = await getDB();
  await Promise.all([
    db.clear("journal"),
    db.clear("checkIns"),
    db.clear("settings"),
    db.clear("cravingLogs"),
    db.clear("relapseLogs"),
    db.clear("anxietyLogs"),
    db.clear("boredomLogs"),
    // Drop the pending-push queue too, so erased data is never pushed up. The
    // revision cursor in syncMeta is intentionally kept: it leaves already-synced
    // server revisions un-re-pulled, so a local erase stays erased on this device.
    db.clear("dirtyRecords"),
  ]);
}

/**
 * Account switch on a shared browser: drop the previous account's locally
 * materialized syncable data (its records are already on the server under that
 * account) so it neither shows to nor gets pushed into the newly signed-in
 * account. Device-local data (theme, language, check-ins, crisis service,
 * contacts) is left untouched. Edge case: a previous account's not-yet-pushed
 * dirty writes are dropped — acceptable versus leaking data across accounts.
 */
export async function clearSyncableStoresForAccountSwitch(): Promise<void> {
  const db = await getDB();
  await Promise.all([
    db.clear("journal"),
    db.clear("cravingLogs"),
    db.clear("relapseLogs"),
    db.clear("anxietyLogs"),
    db.clear("boredomLogs"),
    db.clear("dirtyRecords"),
    db.delete("settings", SOBRIETY_RECORD_ID),
    db.delete("syncMeta", SOBRIETY_UPDATED_AT_KEY),
  ]);
}

/**
 * Privacy-preserving erase for syncable data while signed in: tombstone every
 * live syncable record and the sobriety setting, marking them dirty so the next
 * push wipes the cloud copy too. Tombstones (not hard deletes) are required so
 * the deletion propagates to the account and other devices.
 */
export async function eraseSyncableDataWithTombstones(): Promise<void> {
  const db = await getDB();
  for (const store of SYNCABLE_RECORD_KINDS) {
    const all = await db.getAll(store);
    for (const rec of all) {
      if (rec.deleted) continue;
      await db.put(store as "journal", {
        ...rec,
        deleted: true,
        updatedAt: await nextUpdatedAt(),
      } as JournalEntry);
      await markDirty(store, rec.id);
    }
  }
  const sob = await db.get("settings", SOBRIETY_RECORD_ID);
  if (sob && typeof sob.value === "string" && sob.value !== "") {
    await db.put("settings", { key: SOBRIETY_RECORD_ID, value: "" });
    await setSobrietyUpdatedAt(await nextUpdatedAt());
    await markDirty(SOBRIETY_SETTING_KIND, SOBRIETY_RECORD_ID);
  }
}

/**
 * Clear device-local-only data (check-ins + all device-local settings) without
 * touching the syncable tombstones/dirty queue/cursor. Used by the signed-in
 * erase when the tombstone push could not complete (offline): the cloud wipe
 * stays queued and runs on reconnect, while the device still looks erased.
 */
export async function clearDeviceLocalData(): Promise<void> {
  const db = await getDB();
  await db.clear("checkIns");
  const keys = await db.getAllKeys("settings");
  for (const key of keys) {
    // Keep the emptied sobriety marker; its tombstone is still queued to push.
    if (key === SOBRIETY_RECORD_ID) continue;
    await db.delete("settings", key);
  }
}

/**
 * Export all local data (journal, logs, settings, contacts, crisis service)
 * as a JSON blob that can be downloaded or shared. Useful for non-signed-in
 * users who want a manual backup.
 */
export async function exportAllData(): Promise<Record<string, unknown>> {
  const db = await getDB();
  const journal = await db.getAll("journal");
  const cravingLogs = await db.getAll("cravingLogs");
  const relapseLogs = await db.getAll("relapseLogs");
  const anxietyLogs = await db.getAll("anxietyLogs");
  const boredomLogs = await db.getAll("boredomLogs");
  const settings = await db.getAll("settings");
  const contacts = await getEmergencyContacts();
  const crisis = await getCrisisService();

  return {
    version: 1,
    exportedAt: Date.now(),
    journal: journal.filter((e) => !e.deleted),
    cravingLogs: cravingLogs.filter((e) => !e.deleted),
    relapseLogs: relapseLogs.filter((e) => !e.deleted),
    anxietyLogs: anxietyLogs.filter((e) => !e.deleted),
    boredomLogs: boredomLogs.filter((e) => !e.deleted),
    settings,
    emergencyContacts: contacts,
    crisisService: crisis,
  };
}

/**
 * Import a previously exported JSON blob. Overwrites existing data for the
 * imported record IDs, and inserts new ones. Does NOT wipe the whole database
 * first — so merging is possible. Call clearAllData() before import if a full
 * restore is desired.
 */
export async function importAllData(
  payload: Record<string, unknown>,
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const db = await getDB();
  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;

  const stores = [
    { key: "journal", store: "journal" as const },
    { key: "cravingLogs", store: "cravingLogs" as const },
    { key: "relapseLogs", store: "relapseLogs" as const },
    { key: "anxietyLogs", store: "anxietyLogs" as const },
    { key: "boredomLogs", store: "boredomLogs" as const },
  ];

  for (const { key, store } of stores) {
    const arr = payload[key];
    if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      if (!item || typeof item !== "object" || !item.id) {
        skipped++;
        continue;
      }
      try {
        await db.put(store, item);
        imported++;
      } catch (e) {
        skipped++;
        errors.push(`Failed to import ${key} ${item.id}: ${String(e)}`);
      }
    }
  }

  const settingsArr = payload.settings;
  if (Array.isArray(settingsArr)) {
    for (const s of settingsArr) {
      if (s && s.key) {
        try {
          await db.put("settings", s);
          imported++;
        } catch (e) {
          errors.push(`Failed to import setting ${s.key}: ${String(e)}`);
        }
      }
    }
  }

  const contacts = payload.emergencyContacts;
  if (Array.isArray(contacts)) {
    try {
      await saveEmergencyContacts(contacts as EmergencyContact[]);
      imported++;
    } catch (e) {
      errors.push(`Failed to import contacts: ${String(e)}`);
    }
  }

  const crisis = payload.crisisService;
  if (crisis && typeof crisis === "object") {
    try {
      await saveCrisisService(crisis as CrisisService);
      imported++;
    } catch (e) {
      errors.push(`Failed to import crisis service: ${String(e)}`);
    }
  }

  return { imported, skipped, errors };
}
