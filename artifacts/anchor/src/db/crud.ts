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
  type RegistrationRecordMetadata,
} from "./schema";
import {
  BACKUP_FORMAT_VERSION,
  validateBackupEnvelope,
  validateImportedStoreRecord,
  type ImportStoreKey,
} from "./validation";
import {
  CURRENT_REGISTRATION_CONTENT_VERSION,
  CURRENT_REGISTRATION_DATA_VERSION,
  migrateCravingRegistrationType,
  migrateRelapseFollowUpAnswers,
  migrateRelapseV2DefaultAnswers,
} from "./migrations";
import { migrateRelapseSafetyRecord } from "./relapseSafety";
import { normalizeRelapseTimingRecord } from "./relapseTiming";
import { parseActiveRegistration } from "@/contexts/activeRegistrationValidation";
import { migrateCompletedTrekRecord } from "@/lib/trekMigration";
import {
  parseFeatureRecord,
  isValidHomePreferences,
  isValidRecoveryPlan,
  parseHomePreferences,
  parseJson,
  parseRecoveryPlan,
  type FeatureRecord,
  type QuickRegistrationRecord,
  type RegistrationType,
} from "@/lib/recoveryFeatures";

type NewRegistrationRecord<T extends { id: string }> = Omit<T, "id"> & {
  id?: string;
};

type TimedRegistrationRecord = RegistrationRecordMetadata & {
  id: string;
  timestamp: number;
};

function prepareRegistrationRecord<T extends TimedRegistrationRecord>(
  entry: Omit<T, "id"> & { id?: string },
): T {
  const occurredAt =
    typeof entry.occurredAt === "number" && Number.isFinite(entry.occurredAt)
      ? entry.occurredAt
      : entry.timestamp;
  const startedAt =
    typeof entry.startedAt === "number" && Number.isFinite(entry.startedAt)
      ? entry.startedAt
      : occurredAt;
  const completedAt =
    typeof entry.completedAt === "number" && Number.isFinite(entry.completedAt)
      ? entry.completedAt
      : Date.now();
  const dataVersion = entry.dataVersion ?? CURRENT_REGISTRATION_DATA_VERSION;
  const contentVersion = entry.contentVersion
    ?? (dataVersion === 3 ? CURRENT_REGISTRATION_CONTENT_VERSION : undefined);

  return {
    ...entry,
    id: entry.id ?? crypto.randomUUID(),
    // Keep existing indexes/analytics compatible with the canonical occurrence.
    timestamp: occurredAt,
    occurredAt,
    startedAt,
    completedAt,
    dataVersion,
    ...(contentVersion === undefined ? {} : { contentVersion }),
  } as T;
}

function normalizeRelapseRecord(record: RelapseLog): RelapseLog {
  return normalizeRelapseTimingRecord(
    migrateRelapseFollowUpAnswers(
      migrateRelapseV2DefaultAnswers(migrateRelapseSafetyRecord(record)),
    ),
  );
}

function normalizeCravingRecord(record: CravingLog): CravingLog {
  return migrateCompletedTrekRecord(migrateCravingRegistrationType(record));
}

function assertRelapseAmountHasTarget(record: Pick<
  RelapseLog,
  "amountCategory" | "substances" | "primarySubstance" | "dataVersion"
>): void {
  const isCurrentWrite = record.dataVersion === undefined || record.dataVersion >= 3;
  if (isCurrentWrite && record.primarySubstance !== "") {
    throw new Error("A current Relapse record cannot use the primarySubstance compatibility field.");
  }
  if (
    record.amountCategory !== "unanswered"
    && record.substances.length === 0
    && (isCurrentWrite || record.primarySubstance === "")
  ) {
    throw new Error("A Relapse amount requires at least one substance or behavior target.");
  }
}
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

// ── Recovery feature records ─────────────────────────────────
export async function getFeatureRecords(): Promise<FeatureRecord[]> {
  const db = await getDB();
  const records = await db.getAllFromIndex("featureRecords", "byTimestamp");
  return records
    .map((record) => parseFeatureRecord(record))
    .filter((record): record is FeatureRecord => record !== null)
    .reverse();
}

/**
 * Repairs the secondary quick-to-detailed pointer from the detailed record's
 * own durable answer envelope. This makes a transient feature-store write
 * failure recoverable on refresh without duplicating or losing the episode.
 */
export async function reconcileQuickReflectionLinks(): Promise<number> {
  const db = await getDB();
  const [featureRecords, cravingLogs, relapseLogs, anxietyLogs, boredomLogs] = await Promise.all([
    db.getAll("featureRecords"),
    db.getAll("cravingLogs"),
    db.getAll("relapseLogs"),
    db.getAll("anxietyLogs"),
    db.getAll("boredomLogs"),
  ]);

  const candidates = new Map<string, {
    detailedRecordId: string;
    type: RegistrationType;
    completedAt: number;
  }>();
  const remember = (
    record: RegistrationRecordMetadata & { id: string; completedAt?: number; timestamp: number },
    type: RegistrationType,
  ) => {
    const quickRegistrationId = record.answers?.quickRegistrationId;
    if (typeof quickRegistrationId !== "string" || !quickRegistrationId.trim()) return;
    const completedAt = typeof record.completedAt === "number" ? record.completedAt : record.timestamp;
    const existing = candidates.get(quickRegistrationId);
    if (!existing || completedAt < existing.completedAt) {
      candidates.set(quickRegistrationId, {
        detailedRecordId: record.id,
        type,
        completedAt,
      });
    }
  };

  for (const record of cravingLogs) {
    if (!record.deleted && record.status === "completed") {
      remember(record, record.cravingType === "active" ? "trek" : "craving");
    }
  }
  for (const record of relapseLogs) {
    if (!record.deleted && record.status === "completed") remember(record, "relapse");
  }
  for (const record of anxietyLogs) {
    if (!record.deleted) remember(record, "anxiety");
  }
  for (const record of boredomLogs) {
    if (!record.deleted) remember(record, "boredom");
  }

  let repaired = 0;
  for (const raw of featureRecords) {
    const parsed = parseFeatureRecord(raw);
    if (!parsed || parsed.recordType !== "quick-registration") continue;
    const candidate = candidates.get(parsed.id);
    if (!candidate || candidate.type !== parsed.registrationType) continue;
    if (
      parsed.reflectionStatus === "completed"
      && parsed.linkedDetailedRecordId === candidate.detailedRecordId
    ) continue;
    const updated: QuickRegistrationRecord = {
      ...parsed,
      updatedAt: Date.now(),
      reflectionStatus: "completed",
      reflectionStartedAt: parsed.reflectionStartedAt ?? candidate.completedAt,
      reflectionCompletedAt: parsed.reflectionCompletedAt ?? candidate.completedAt,
      linkedDetailedRecordId: candidate.detailedRecordId,
    };
    await db.put("featureRecords", updated);
    repaired += 1;
  }
  return repaired;
}

export async function saveFeatureRecord(record: FeatureRecord): Promise<void> {
  const parsed = parseFeatureRecord(record);
  if (!parsed) throw new Error("Invalid recovery feature record.");
  const db = await getDB();
  await db.put("featureRecords", parsed);
}

export async function deleteFeatureRecord(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("featureRecords", id);
}

// ── Craving Logs ─────────────────────────────────────────────
export async function addCravingLog(entry: NewRegistrationRecord<CravingLog>): Promise<CravingLog> {
  const db = await getDB();
  const full = normalizeCravingRecord(prepareRegistrationRecord<CravingLog>(entry));
  await db.put("cravingLogs", full);
  return full;
}
export async function updateCravingLog(log: CravingLog): Promise<void> {
  const db = await getDB();
  await db.put("cravingLogs", normalizeCravingRecord(log));
}
export async function getCravingLogs(limit = 200): Promise<CravingLog[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("cravingLogs", "byTimestamp");
  return all
    .filter((e) => !e.deleted)
    .slice(-limit)
    .reverse()
    .map(normalizeCravingRecord);
}
export async function deleteCravingLog(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("cravingLogs", id);
}

// ── Relapse Logs ─────────────────────────────────────────────
export async function addRelapseLog(entry: NewRegistrationRecord<RelapseLog>): Promise<RelapseLog> {
  const db = await getDB();
  assertRelapseAmountHasTarget(entry);
  const full = normalizeRelapseRecord(prepareRegistrationRecord<RelapseLog>(entry));
  await db.put("relapseLogs", full);
  return full;
}
export async function getRelapseLogs(limit = 200): Promise<RelapseLog[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("relapseLogs", "byTimestamp");
  return all
    .filter((entry) => !entry.deleted)
    .slice(-limit)
    .reverse()
    .map(normalizeRelapseRecord);
}
export async function updateRelapseLog(log: RelapseLog): Promise<void> {
  const db = await getDB();
  assertRelapseAmountHasTarget(log);
  await db.put(
    "relapseLogs",
    normalizeRelapseRecord(log),
  );
}
export async function deleteRelapseLog(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("relapseLogs", id);
}

// ── Anxiety Logs ─────────────────────────────────────────────
export async function addAnxietyLog(entry: NewRegistrationRecord<AnxietyLog>): Promise<AnxietyLog> {
  const db = await getDB();
  const full = prepareRegistrationRecord<AnxietyLog>(entry);
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
export async function addBoredomLog(entry: NewRegistrationRecord<BoredomLog>): Promise<BoredomLog> {
  const db = await getDB();
  const full = prepareRegistrationRecord<BoredomLog>(entry);
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
export async function addCigaretteLog(entry: NewRegistrationRecord<CigaretteLog>): Promise<CigaretteLog> {
  const db = await getDB();
  const full = prepareRegistrationRecord<CigaretteLog>(entry);
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
    db.clear("featureRecords"),
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
  const featureRecords = await db.getAll("featureRecords");
  const contacts = await getEmergencyContacts();
  const crisis = await getCrisisService();

  return {
    version: BACKUP_FORMAT_VERSION,
    dataVersion: CURRENT_REGISTRATION_DATA_VERSION,
    exportedAt: Date.now(),
    journal: journal.filter((e) => !e.deleted),
    cravingLogs: cravingLogs.filter((e) => !e.deleted),
    relapseLogs: relapseLogs
      .filter((entry) => !entry.deleted)
      .map(normalizeRelapseRecord),
    anxietyLogs: anxietyLogs.filter((e) => !e.deleted),
    boredomLogs: boredomLogs.filter((e) => !e.deleted),
    cigaretteLogs: cigaretteLogs.filter((e) => !e.deleted),
    featureRecords,
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

function validEmergencyContact(value: unknown): value is EmergencyContact {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.id.trim() !== "" &&
    typeof value.name === "string" &&
    typeof value.relationship === "string" &&
    typeof value.phone === "string"
  );
}

function validCrisisService(value: unknown): value is CrisisService {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.id.trim() !== "" &&
    typeof value.name === "string" &&
    typeof value.number === "string" &&
    typeof value.isCustom === "boolean"
  );
}

function parseJsonSetting(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function normalizeImportedSetting(
  value: unknown,
): { key: string; value: string | number | boolean } | null {
  if (!isRecord(value) || typeof value.key !== "string") return null;
  const key = value.key;
  const settingValue = value.value;

  if (key === "theme") {
    return settingValue === "dark" || settingValue === "light"
      ? { key, value: settingValue }
      : null;
  }
  if (key === "language") {
    return settingValue === "nl" || settingValue === "en"
      ? { key, value: settingValue }
      : null;
  }
  if (key === "sobrietyStartDate") {
    return typeof settingValue === "string" &&
      (settingValue === "" || /^\d{4}-\d{2}-\d{2}$/.test(settingValue))
      ? { key, value: settingValue }
      : null;
  }
  if (key === "activeRegistration") {
    if (typeof settingValue !== "string") return null;
    const parsed = parseActiveRegistration(settingValue);
    return parsed.ok
      ? { key, value: parsed.value ? JSON.stringify(parsed.value) : "" }
      : null;
  }
  if (key === "suspendedRegistrations") {
    if (typeof settingValue !== "string") return null;
    const parsedStack = settingValue === "" ? [] : parseJsonSetting(settingValue);
    if (!Array.isArray(parsedStack)) return null;
    const normalized: unknown[] = [];
    for (const item of parsedStack) {
      const parsed = parseActiveRegistration(item);
      if (!parsed.ok || !parsed.value) return null;
      normalized.push(parsed.value);
    }
    return { key, value: JSON.stringify(normalized) };
  }
  if (key === "emergencyContacts") {
    if (typeof settingValue !== "string") return null;
    const contacts = parseJsonSetting(settingValue);
    return Array.isArray(contacts) && contacts.every(validEmergencyContact)
      ? { key, value: settingValue }
      : null;
  }
  if (key === "crisisService") {
    if (settingValue === "") return { key, value: "" };
    if (typeof settingValue !== "string") return null;
    const service = parseJsonSetting(settingValue);
    return validCrisisService(service) ? { key, value: settingValue } : null;
  }
  if (key === "homePreferences") {
    if (typeof settingValue !== "string") return null;
    const parsed = parseJson(settingValue);
    if (!isValidHomePreferences(parsed)) return null;
    return { key, value: JSON.stringify(parseHomePreferences(parsed)) };
  }
  if (key === "recoveryPlan") {
    if (typeof settingValue !== "string") return null;
    const parsed = parseJson(settingValue);
    if (!isValidRecoveryPlan(parsed)) return null;
    return { key, value: JSON.stringify(parseRecoveryPlan(parsed)) };
  }

  // Version 1 has a closed setting catalog. A future backup version can add
  // new keys deliberately instead of silently accepting arbitrary settings.
  return null;
}

export async function importAllData(
  payload: Record<string, unknown>,
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const envelope = validateBackupEnvelope(payload);
  if (!envelope.ok) {
    return { imported: 0, skipped: 0, errors: [envelope.error] };
  }

  const db = await getDB();
  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;

  const stores: ImportStoreKey[] = [
    "journal",
    "cravingLogs",
    "relapseLogs",
    "anxietyLogs",
    "boredomLogs",
    "cigaretteLogs",
  ];

  for (const key of stores) {
    const arr = payload[key];
    if (!Array.isArray(arr)) continue;
    for (const [index, item] of arr.entries()) {
      const validation = validateImportedStoreRecord(key, item);
      if (!validation.ok) {
        skipped++;
        const id = isRecord(item) && typeof item.id === "string"
          ? item.id
          : `item ${index + 1}`;
        errors.push(`Invalid ${key} ${id}: ${validation.error}`);
        continue;
      }
      try {
        if (key === "journal") await db.put("journal", validation.value as JournalEntry);
        else if (key === "cravingLogs") await db.put("cravingLogs", validation.value as CravingLog);
        else if (key === "relapseLogs") await db.put("relapseLogs", validation.value as RelapseLog);
        else if (key === "anxietyLogs") await db.put("anxietyLogs", validation.value as AnxietyLog);
        else if (key === "boredomLogs") await db.put("boredomLogs", validation.value as BoredomLog);
        else await db.put("cigaretteLogs", validation.value as CigaretteLog);
        imported++;
      } catch (e) {
        skipped++;
        const id = isRecord(item) && typeof item.id === "string" ? item.id : `item ${index + 1}`;
        errors.push(`Failed to import ${key} ${id}: ${String(e)}`);
      }
    }
  }

  const featureRecords = payload.featureRecords;
  if (Array.isArray(featureRecords)) {
    for (const [index, item] of featureRecords.entries()) {
      const parsed = parseFeatureRecord(item);
      if (!parsed) {
        skipped++;
        errors.push(`Invalid featureRecords item ${index + 1}.`);
        continue;
      }
      try {
        await db.put("featureRecords", parsed);
        imported++;
      } catch (e) {
        skipped++;
        errors.push(`Failed to import featureRecords ${parsed.id}: ${String(e)}`);
      }
    }
  }

  const settingsArr = payload.settings;
  if (Array.isArray(settingsArr)) {
    for (const s of settingsArr) {
      const normalized = normalizeImportedSetting(s);
      if (!normalized) {
        skipped++;
        errors.push(`Invalid or unsupported setting ${isRecord(s) && typeof s.key === "string" ? s.key : "<unknown>"}.`);
        continue;
      }
      try {
        await db.put("settings", normalized);
        imported++;
      } catch (e) {
        errors.push(`Failed to import setting ${normalized.key}: ${String(e)}`);
      }
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, "emergencyContacts")) {
    const contacts = payload.emergencyContacts;
    if (!Array.isArray(contacts)) {
      skipped++;
      errors.push("Invalid emergencyContacts: expected an array.");
    } else {
      const validContacts: EmergencyContact[] = [];
      contacts.forEach((contact, index) => {
        if (validEmergencyContact(contact)) {
          validContacts.push(contact);
        } else {
          skipped++;
          errors.push(`Invalid emergencyContacts item ${index + 1}.`);
        }
      });
      try {
        await saveEmergencyContacts(validContacts);
        imported++;
      } catch (e) {
        skipped++;
        errors.push(`Failed to import contacts: ${String(e)}`);
      }
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, "crisisService")) {
    const crisis = payload.crisisService;
    if (crisis !== null && !validCrisisService(crisis)) {
      skipped++;
      errors.push("Invalid crisisService: expected a service object or null.");
    } else {
      try {
        await saveCrisisService(crisis as CrisisService | null);
        imported++;
      } catch (e) {
        skipped++;
        errors.push(`Failed to import crisis service: ${String(e)}`);
      }
    }
  }

  return { imported, skipped, errors };
}
