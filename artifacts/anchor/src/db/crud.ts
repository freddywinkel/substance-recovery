import {
  getDB,
  type AnxietyLog,
  type BoredomLog,
  type CigaretteLog,
  type CravingLog,
  type CrisisService,
  type EmergencyContact,
  type JournalEntry,
  type RelapseLog,
} from "./schema";
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
  const full: JournalEntry = { ...entry, id: crypto.randomUUID() };
  await db.put("journal", full);
  return full;
}
export async function getJournalEntries(limit = 100): Promise<JournalEntry[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("journal", "byTimestamp");
  return all.filter((e) => !e.deleted).slice(-limit).reverse();
}
export async function deleteJournalEntry(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("journal", id);
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
}

// ── Craving Logs ─────────────────────────────────────────────
export async function addCravingLog(entry: Omit<CravingLog, "id">): Promise<CravingLog> {
  const db = await getDB();
  const full: CravingLog = { ...entry, id: crypto.randomUUID() };
  await db.put("cravingLogs", full);
  return full;
}
export async function updateCravingLog(log: CravingLog): Promise<void> {
  const db = await getDB();
  await db.put("cravingLogs", log);
}
export async function getCravingLogs(limit = 200): Promise<CravingLog[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("cravingLogs", "byTimestamp");
  return all.filter((e) => !e.deleted).slice(-limit).reverse();
}
export async function deleteCravingLog(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("cravingLogs", id);
}

// ── Relapse Logs ─────────────────────────────────────────────
export async function addRelapseLog(entry: Omit<RelapseLog, "id">): Promise<RelapseLog> {
  const db = await getDB();
  const full: RelapseLog = { ...entry, id: crypto.randomUUID() };
  await db.put("relapseLogs", full);
  return full;
}
export async function getRelapseLogs(limit = 200): Promise<RelapseLog[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("relapseLogs", "byTimestamp");
  return all.filter((e) => !e.deleted).slice(-limit).reverse();
}
export async function updateRelapseLog(log: RelapseLog): Promise<void> {
  const db = await getDB();
  await db.put("relapseLogs", log);
}
export async function deleteRelapseLog(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("relapseLogs", id);
}

// ── Anxiety Logs ─────────────────────────────────────────────
export async function addAnxietyLog(entry: Omit<AnxietyLog, "id">): Promise<AnxietyLog> {
  const db = await getDB();
  const full: AnxietyLog = { ...entry, id: crypto.randomUUID() };
  await db.put("anxietyLogs", full);
  return full;
}
export async function getAnxietyLogs(limit = 200): Promise<AnxietyLog[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("anxietyLogs", "byTimestamp");
  return all.filter((e) => !e.deleted).slice(-limit).reverse();
}
export async function updateAnxietyLog(log: AnxietyLog): Promise<void> {
  const db = await getDB();
  await db.put("anxietyLogs", log);
}
export async function deleteAnxietyLog(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("anxietyLogs", id);
}

// ── Boredom Logs ──────────────────────────────────────────────
export async function addBoredomLog(entry: Omit<BoredomLog, "id">): Promise<BoredomLog> {
  const db = await getDB();
  const full: BoredomLog = { ...entry, id: crypto.randomUUID() };
  await db.put("boredomLogs", full);
  return full;
}
export async function getBoredomLogs(limit = 200): Promise<BoredomLog[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("boredomLogs", "byTimestamp");
  return all.filter((e) => !e.deleted).slice(-limit).reverse();
}
export async function updateBoredomLog(log: BoredomLog): Promise<void> {
  const db = await getDB();
  await db.put("boredomLogs", log);
}
export async function deleteBoredomLog(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("boredomLogs", id);
}

// ── Cigarette Logs ───────────────────────────────────────────
export async function addCigaretteLog(entry: Omit<CigaretteLog, "id">): Promise<CigaretteLog> {
  const db = await getDB();
  const full: CigaretteLog = { ...entry, id: crypto.randomUUID() };
  await db.put("cigaretteLogs", full);
  return full;
}
export async function getCigaretteLogs(limit = 200): Promise<CigaretteLog[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("cigaretteLogs", "byTimestamp");
  return all.filter((e) => !e.deleted).slice(-limit).reverse();
}
export async function updateCigaretteLog(log: CigaretteLog): Promise<void> {
  const db = await getDB();
  await db.put("cigaretteLogs", log);
}
export async function deleteCigaretteLog(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("cigaretteLogs", id);
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
    db.clear("cigaretteLogs"),
    db.clear("dirtyRecords"),
    db.clear("syncMeta"),
  ]);
}

/**
 * Export all local data (journal, logs, settings, contacts, crisis service)
 * as a JSON blob that can be downloaded or stored as a manual backup.
 */
export async function exportAllData(): Promise<Record<string, unknown>> {
  const db = await getDB();
  const journal = await db.getAll("journal");
  const cravingLogs = await db.getAll("cravingLogs");
  const relapseLogs = await db.getAll("relapseLogs");
  const anxietyLogs = await db.getAll("anxietyLogs");
  const boredomLogs = await db.getAll("boredomLogs");
  const cigaretteLogs = await db.getAll("cigaretteLogs");
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
    cigaretteLogs: cigaretteLogs.filter((e) => !e.deleted),
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
function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isValidImportedLog(key: string, item: unknown): item is Record<string, unknown> {
  if (
    !isRecord(item) ||
    typeof item.id !== "string" ||
    typeof item.timestamp !== "number" ||
    !Number.isFinite(item.timestamp)
  ) {
    return false;
  }

  const requiredArrays: Record<string, string[]> = {
    cravingLogs: ["situationPresets", "emotions", "physicalSensations", "thoughtPresets", "socialContext", "substances"],
    relapseLogs: ["substances", "preUseFactors", "missedWarnings", "couldHaveHelpedEarly", "couldHaveHelpedMiddle", "couldHaveHelpedLast"],
    anxietyLogs: ["bodySensations"],
    boredomLogs: ["feelingTypes"],
    cigaretteLogs: [],
  };

  if (key === "journal") {
    return (
      Number.isInteger(item.mood) &&
      Number(item.mood) >= 1 &&
      Number(item.mood) <= 5 &&
      typeof item.note === "string"
    );
  }

  return (requiredArrays[key] ?? []).every((field) => Array.isArray(item[field]));
}

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
    { key: "cigaretteLogs", store: "cigaretteLogs" as const },
  ];

  for (const { key, store } of stores) {
    const arr = payload[key];
    if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      if (!isValidImportedLog(key, item)) {
        skipped++;
        continue;
      }
      try {
        if (store === "journal") await db.put("journal", item as unknown as JournalEntry);
        else if (store === "cravingLogs") await db.put("cravingLogs", item as unknown as CravingLog);
        else if (store === "relapseLogs") await db.put("relapseLogs", item as unknown as RelapseLog);
        else if (store === "anxietyLogs") await db.put("anxietyLogs", item as unknown as AnxietyLog);
        else if (store === "boredomLogs") await db.put("boredomLogs", item as unknown as BoredomLog);
        else if (store === "cigaretteLogs") await db.put("cigaretteLogs", item as unknown as CigaretteLog);
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
      if (
        isRecord(s) &&
        typeof s.key === "string" &&
        ["string", "number", "boolean"].includes(typeof s.value)
      ) {
        try {
          await db.put("settings", s as unknown as { key: string; value: string | number | boolean });
          imported++;
        } catch (e) {
          errors.push(`Failed to import setting ${s.key}: ${String(e)}`);
        }
      } else skipped++;
    }
  }

  const contacts = payload.emergencyContacts;
  if (Array.isArray(contacts)) {
    const validContacts = contacts.filter(
      (contact): contact is EmergencyContact =>
        isRecord(contact) &&
        typeof contact.id === "string" &&
        typeof contact.name === "string" &&
        typeof contact.relationship === "string" &&
        typeof contact.phone === "string",
    );
    skipped += contacts.length - validContacts.length;
    try {
      await saveEmergencyContacts(validContacts);
      imported++;
    } catch (e) {
      errors.push(`Failed to import contacts: ${String(e)}`);
    }
  }

  const crisis = payload.crisisService;
  if (
    isRecord(crisis) &&
    typeof crisis.id === "string" &&
    typeof crisis.name === "string" &&
    typeof crisis.number === "string" &&
    typeof crisis.isCustom === "boolean"
  ) {
    try {
      await saveCrisisService(crisis as unknown as CrisisService);
      imported++;
    } catch (e) {
      errors.push(`Failed to import crisis service: ${String(e)}`);
    }
  }

  return { imported, skipped, errors };
}
