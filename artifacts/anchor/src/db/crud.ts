import { isQuickRegistrationDraft } from "@/lib/quickRegistrationDraft";
import { isRecoveryPlanDraft } from "@/lib/planDraft";
import { isWeeklyReviewDraft } from "@/lib/weeklyReviewDraft";
import { isSupportiveActionDraft } from "@/lib/supportiveActionDraft";
import { isHomeCustomizationDraft } from "@/lib/homeCustomizationDraft";
import { isJourneyDateDraft } from "@/lib/settingsActions";
import { isRegistrationCorrectionDraft, registrationSourceSignature, RegistrationSourceConflictError, type CorrectionDetailedRecord } from "@/lib/registrationCorrectionDraft";
import { isCigaretteEditDraft } from "@/lib/cigaretteEditDraft";
import { isCareContactDraft, isPersonalContactDraft } from "@/lib/contactDrafts";
import { isJournalDraft } from "@/lib/journalDraft";
import { isValidLocalDraftEnvelope } from "@/lib/localDrafts";
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
  const service: unknown = JSON.parse(String(record.value));
  if (!validCrisisService(service)) throw new Error("Saved care contact cannot be read.");
  return service;
}
export async function saveCrisisService(service: CrisisService | null): Promise<void> {
  const db = await getDB();
  await db.put("settings", { key: "crisisService", value: service ? JSON.stringify(service) : "" });
}
export async function getEmergencyContacts(): Promise<EmergencyContact[]> {
  const db = await getDB();
  const record = await db.get("settings", "emergencyContacts");
  if (!record?.value) return [];
  const contacts: unknown = JSON.parse(String(record.value));
  if (!Array.isArray(contacts) || !contacts.every(validEmergencyContact)) throw new Error("Saved support contacts cannot be read.");
  return contacts;
}
export async function saveEmergencyContacts(contacts: EmergencyContact[]): Promise<void> {
  const db = await getDB();
  await db.put("settings", { key: "emergencyContacts", value: JSON.stringify(contacts) });
}
// ── Journal ──────────────────────────────────────────────────
export async function addJournalEntry(entry: NewRegistrationRecord<JournalEntry>): Promise<JournalEntry> {
  const db = await getDB();
  const full: JournalEntry = { ...entry, id: entry.id ?? crypto.randomUUID() };
  await db.put("journal", full);
  return full;
}
export async function getJournalEntries(limit = Infinity): Promise<JournalEntry[]> {
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
export async function getCravingLogs(limit = Infinity): Promise<CravingLog[]> {
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
export async function getRelapseLogs(limit = Infinity): Promise<RelapseLog[]> {
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
export async function getAnxietyLogs(limit = Infinity): Promise<AnxietyLog[]> {
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
export async function getBoredomLogs(limit = Infinity): Promise<BoredomLog[]> {
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
export async function getCigaretteLogs(limit = Infinity): Promise<CigaretteLog[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("cigaretteLogs", "byTimestamp");
  return all.filter((e) => !e.deleted).slice(-limit).reverse();
}
export interface CigaretteUpdateSource { timestamp: number; note?: string; updatedAt?: number | null; }
export async function updateCigaretteLog(log: CigaretteLog, expected?: CigaretteUpdateSource): Promise<CigaretteLog> {
  const db = await getDB();
  const tx = db.transaction("cigaretteLogs", "readwrite");
  void tx.done.catch(() => undefined);
  try {
    if (expected) {
      const current = await tx.store.get(log.id);
      if (!current || current.deleted || current.timestamp !== expected.timestamp || (current.note ?? "") !== (expected.note ?? "") || (current.updatedAt ?? null) !== (expected.updatedAt ?? null)) throw new RegistrationSourceConflictError();
    }
    const saved = { ...log, occurredAt: log.timestamp, updatedAt: Date.now() };
    await tx.store.put(saved);
    await tx.done;
    return saved;
  } catch (error) { try { tx.abort(); } catch { /* closed */ } await tx.done.catch(() => undefined); throw error; }
}
export async function deleteCigaretteLog(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("cigaretteLogs", id);
}

// ── Clear all ────────────────────────────────────────────────
const ALL_STORES = ["journal", "checkIns", "settings", "cravingLogs", "relapseLogs", "anxietyLogs", "boredomLogs", "cigaretteLogs", "featureRecords", "dirtyRecords", "syncMeta"] as const;
const BACKUP_STORES = ["journal", "checkIns", "settings", "cravingLogs", "relapseLogs", "anxietyLogs", "boredomLogs", "cigaretteLogs", "featureRecords"] as const;

/** All stores commit together, or erasure leaves every store unchanged. */
export async function clearAllData(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(ALL_STORES, "readwrite");
  try {
    await Promise.all(ALL_STORES.map(async (store) => tx.objectStore(store).clear()));
    await tx.done;
  } catch (error) {
    try { tx.abort(); } catch { /* already aborted */ }
    await tx.done.catch(() => {});
    throw error;
  }
}

/** Consistent complete snapshot, including drafts, legacy check-ins and tombstones.
 * Device-specific sync bookkeeping is deliberately excluded. */
export async function exportAllData(): Promise<Record<string, unknown>> {
  const db = await getDB();
  const tx = db.transaction(BACKUP_STORES, "readonly");
  const done = tx.done;
  void done.catch(() => {});
  const values = await Promise.all(BACKUP_STORES.map(async (store) => tx.objectStore(store).getAll()));
  await done;
  const data = Object.fromEntries(BACKUP_STORES.map((store, index) => [store, values[index]]));
  // Contacts are stored once, in settings; older backups also carried aliases.
  return {
    version: BACKUP_FORMAT_VERSION,
    dataVersion: CURRENT_REGISTRATION_DATA_VERSION,
    exportedAt: Date.now(),
    ...data,
  };
}

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
    typeof value.phone === "string" &&
    ["role", "availability", "supportNotes", "fallback"].every(key => value[key] === undefined || (typeof value[key] === "string" && value[key].length <= 500)) &&
    (value.sharingPreference === undefined || ["unanswered", "ask-first", "may-share", "keep-private"].includes(String(value.sharingPreference)))
  );
}

function validCrisisService(value: unknown): value is CrisisService {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.id.trim() !== "" &&
    typeof value.name === "string" &&
    typeof value.number === "string" &&
    typeof value.isCustom === "boolean" &&
    (value.role === undefined || ["emergency", "suicide-support", "urgent-care", "treatment", "advice", "listening", "relatives", "safeguarding", "non-acute-report", "unverified"].includes(String(value.role))) &&
    (value.availability === undefined || (typeof value.availability === "string" && value.availability.length <= 5000)) &&
    (value.eligibility === undefined || (typeof value.eligibility === "string" && value.eligibility.length <= 5000))
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

  if (/^draft:(recovery-plan|journal-entry|quick-registration|care-contact|personal-contact|supportive-action|home-customization|journey-date|registration-correction|cigarette-edit|weekly-review:[a-zA-Z0-9-]+)$/.test(key)) {
    if (settingValue === "") return { key, value: "" };
    if (typeof settingValue !== "string" || settingValue.length > 512_000) return null;
    const envelope = parseJsonSetting(settingValue);
    if (!isValidLocalDraftEnvelope(envelope)) return null;
    if (key === "draft:supportive-action" && !isSupportiveActionDraft(envelope.value)) return null;
    if (key === "draft:home-customization" && !isHomeCustomizationDraft(envelope.value)) return null;
    if (key === "draft:journey-date" && !isJourneyDateDraft(envelope.value)) return null;
    if (key === "draft:registration-correction" && !isRegistrationCorrectionDraft(envelope.value)) return null;
    if (key === "draft:cigarette-edit" && !isCigaretteEditDraft(envelope.value)) return null;
    if (key === "draft:recovery-plan" && !isRecoveryPlanDraft(envelope.value)) return null;
    if (key.startsWith("draft:weekly-review:") && !isWeeklyReviewDraft(envelope.value)) return null;
    if (key === "draft:quick-registration" && !isQuickRegistrationDraft(envelope.value)) return null;
    if (key === "draft:journal-entry" && !isJournalDraft(envelope.value)) return null;
    if (key === "draft:care-contact" && !isCareContactDraft(envelope.value)) return null;
    if (key === "draft:personal-contact" && !isPersonalContactDraft(envelope.value)) return null;
    return { key, value: settingValue };
  }

  // Version 1 has a closed setting catalog. A future backup version can add
  // new keys deliberately instead of silently accepting arbitrary settings.
  return null;
}

export type ImportMode = "merge" | "replace";
export interface ImportResult { imported: number; skipped: number; errors: string[]; committed: boolean; }
export interface ImportPreview {
  canImport: boolean;
  incoming: number;
  existing: number;
  conflicts: number;
  counts: Record<string, number>;
  errors: string[];
  warnings: string[];
}
type BackupStore = typeof BACKUP_STORES[number];
type PreparedRow = { store: BackupStore; key: string; value: unknown };

function prepareImport(payload: Record<string, unknown>) {
  const rows: PreparedRow[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const envelope = validateBackupEnvelope(payload);
  if (!envelope.ok) return { rows, errors: [envelope.error], warnings };
  const knownKeys = new Set<string>([...BACKUP_STORES, "version", "dataVersion", "exportedAt", "emergencyContacts", "crisisService"]);
  for (const key of Object.keys(payload)) if (!knownKeys.has(key)) errors.push(`Unsupported backup field ${key}.`);
  const rowKeys = new Set<string>();
  const add = (store: BackupStore, key: string, value: unknown) => {
    const token = `${store}:${key}`;
    if (rowKeys.has(token)) {
      errors.push(`Duplicate ${store} ID/key ${key}.`); return;
    }
    rowKeys.add(token);
    rows.push({ store, key, value });
  };
  const stores: ImportStoreKey[] = ["journal", "cravingLogs", "relapseLogs", "anxietyLogs", "boredomLogs", "cigaretteLogs"];
  for (const store of stores) {
    const records = payload[store];
    if (!Array.isArray(records)) continue;
    records.forEach((item, index) => {
      const result = validateImportedStoreRecord(store, item);
      const id = isRecord(item) && typeof item.id === "string" ? item.id : `item ${index + 1}`;
      if (!result.ok) errors.push(`Invalid ${store} ${id}: ${result.error}`);
      else add(store, result.value.id, result.value);
    });
  }
  if (Array.isArray(payload.checkIns)) payload.checkIns.forEach((item, index) => {
    if (!isRecord(item) || typeof item.id !== "string" || !item.id.trim() || typeof item.date !== "string" || typeof item.timestamp !== "number" || !Number.isFinite(item.timestamp) || item.timestamp < 0) {
      errors.push(`Invalid checkIns item ${index + 1}.`);
    } else add("checkIns", item.id, item);
  });
  if (Array.isArray(payload.featureRecords)) payload.featureRecords.forEach((item, index) => {
    const parsed = parseFeatureRecord(item);
    if (!parsed) errors.push(`Invalid featureRecords item ${index + 1}.`);
    else add("featureRecords", parsed.id, parsed);
  });
  if (Array.isArray(payload.settings)) payload.settings.forEach(item => {
    const parsed = normalizeImportedSetting(item);
    if (!parsed) errors.push(`Invalid or unsupported setting ${isRecord(item) && typeof item.key === "string" ? item.key : "<unknown>"}.`);
    else add("settings", parsed.key, parsed);
  });
  const addAlias = (key: string, value: string) => {
    const existing = rows.find(row => row.store === "settings" && row.key === key);
    if (existing) {
      const previous = (existing.value as { value: unknown }).value;
      if (JSON.stringify(parseJsonSetting(String(previous))) !== JSON.stringify(parseJsonSetting(value))) errors.push(`Conflicting duplicate ${key} in backup.`);
    } else add("settings", key, { key, value });
  };
  if (Object.prototype.hasOwnProperty.call(payload, "emergencyContacts")) {
    if (!Array.isArray(payload.emergencyContacts)) errors.push("Invalid emergencyContacts: expected an array.");
    else {
      const contacts = payload.emergencyContacts;
      contacts.forEach((item, index) => { if (!validEmergencyContact(item)) errors.push(`Invalid emergencyContacts item ${index + 1}.`); });
      if (contacts.every(validEmergencyContact)) addAlias("emergencyContacts", JSON.stringify(contacts));
    }
  }
  if (Object.prototype.hasOwnProperty.call(payload, "crisisService")) {
    const service = payload.crisisService;
    if (service !== null && !validCrisisService(service)) errors.push("Invalid crisisService: expected a service object or null.");
    else addAlias("crisisService", service === null ? "" : JSON.stringify(service));
  }
  const contacts = rows.find(row => row.store === "settings" && row.key === "emergencyContacts");
  if (contacts) {
    const list = parseJsonSetting((contacts.value as { value: string }).value) as EmergencyContact[];
    if (new Set(list.map(item => item.id)).size !== list.length) errors.push("Duplicate emergency contact ID.");
  }
  // A historical orphan is preserved, but surfaced before import, not silently repaired.
  for (const row of rows) {
    if (row.store !== "featureRecords") continue;
    const record = row.value as FeatureRecord;
    if (record.recordType !== "quick-registration" || !record.linkedDetailedRecordId) continue;
    const store = record.registrationType === "trek" ? "cravingLogs" : `${record.registrationType}Logs`;
    if (!rowKeys.has(`${store}:${record.linkedDetailedRecordId}`)) warnings.push(`Reflection link ${record.id} points outside this backup; merge may resolve it from existing data.`);
  }
  return { rows, errors, warnings };
}

/** Read-only preflight. No settings or contact writes are performed here. */
export async function previewImportData(payload: Record<string, unknown>): Promise<ImportPreview> {
  const prepared = prepareImport(payload);
  const db = await getDB();
  const tx = db.transaction(BACKUP_STORES, "readonly");
  const done = tx.done;
  void done.catch(() => {});
  const keys = await Promise.all(BACKUP_STORES.map(async store => tx.objectStore(store).getAllKeys()));
  await done;
  const counts = Object.fromEntries(BACKUP_STORES.map(store => [store, prepared.rows.filter(row => row.store === store).length]));
  const existingKeys = new Map(BACKUP_STORES.map((store, index) => [store, new Set(keys[index])]));
  const conflicts = prepared.rows.filter(row => existingKeys.get(row.store)?.has(row.key)).length;
  return { canImport: prepared.errors.length === 0, incoming: prepared.rows.length, existing: keys.reduce((n, items) => n + items.length, 0), conflicts, counts, errors: prepared.errors, warnings: prepared.warnings };
}

/** Validate the entire payload before one atomic merge/replacement transaction. */
export async function importAllData(payload: Record<string, unknown>, options: { mode?: ImportMode } = {}): Promise<ImportResult> {
  const { rows, errors } = prepareImport(payload);
  if (errors.length) return { imported: 0, skipped: errors.length, errors, committed: false };
  const db = await getDB();
  const tx = db.transaction(ALL_STORES, "readwrite");
  try {
    if (options.mode === "replace") await Promise.all(ALL_STORES.map(async store => tx.objectStore(store).clear()));
    for (const row of rows) {
      let value = row.value;
      if (options.mode !== "replace" && row.store === "settings" && row.key === "emergencyContacts") {
        const saved = await tx.objectStore("settings").get("emergencyContacts");
        const old = saved?.value ? parseJsonSetting(String(saved.value)) : [];
        if (!Array.isArray(old) || !old.every(validEmergencyContact)) throw new Error("Existing contacts cannot be read. Export your current data before replacing them.");
        const incoming = parseJsonSetting((row.value as { value: string }).value) as EmergencyContact[];
        const merged = new Map(old.map(item => [item.id, item]));
        incoming.forEach(item => merged.set(item.id, item));
        value = { key: row.key, value: JSON.stringify([...merged.values()]) };
      }
      await tx.objectStore(row.store).put(value as never);
    }
    await tx.done;
    return { imported: rows.length, skipped: 0, errors: [], committed: true };
  } catch (error) {
    try { tx.abort(); } catch { /* already aborted */ }
    await tx.done.catch(() => {});
    return { imported: 0, skipped: 0, errors: [`Import failed; no changes were committed: ${String(error)}`], committed: false };
  }
}

function episodeStore(type: RegistrationType) {
  return type === "craving" || type === "trek" ? "cravingLogs" : type === "relapse" ? "relapseLogs" : type === "anxiety" ? "anxietyLogs" : "boredomLogs";
}
export async function deleteRegistrationEpisode(input: { type: RegistrationType; detailedId?: string; quickId?: string; scope?: "episode" | "reflection" }): Promise<void> {
  const db = await getDB();
  const store = episodeStore(input.type);
  const tx = db.transaction([store, "featureRecords"], "readwrite");
  try {
    const detailed = input.detailedId ? await tx.objectStore(store).get(input.detailedId) : undefined;
    let quickId = input.quickId ?? (typeof detailed?.answers?.quickRegistrationId === "string" ? detailed.answers.quickRegistrationId : undefined);
    if (!quickId && input.detailedId) {
      const all = await tx.objectStore("featureRecords").getAll();
      quickId = all.find(item => item.recordType === "quick-registration" && item.registrationType === input.type && item.linkedDetailedRecordId === input.detailedId)?.id;
    }
    const quick = quickId ? await tx.objectStore("featureRecords").get(quickId) : undefined;
    const matching = quick?.recordType === "quick-registration" && quick.registrationType === input.type ? quick : undefined;
    const detailedId = input.detailedId ?? matching?.linkedDetailedRecordId ?? undefined;
    if (detailedId) await tx.objectStore(store).delete(detailedId);
    if (matching) {
      if (input.scope === "reflection") await tx.objectStore("featureRecords").put({ ...matching, updatedAt: Date.now(), reflectionStatus: "pending", reflectionStartedAt: null, reflectionCompletedAt: null, linkedDetailedRecordId: null });
      else await tx.objectStore("featureRecords").delete(matching.id);
    }
    await tx.done;
  } catch (error) { try { tx.abort(); } catch { /* already aborted */ } await tx.done.catch(() => {}); throw error; }
}
export async function updateRegistrationEpisode(input: {
  type: RegistrationType;
  detailedRecord?: CorrectionDetailedRecord;
  quickRecord?: QuickRegistrationRecord;
  expectedSource?: { detailed: CorrectionDetailedRecord | null; quick: QuickRegistrationRecord | null };
}): Promise<{ detailedRecord?: CorrectionDetailedRecord; quickRecord?: QuickRegistrationRecord }> {
  const store = episodeStore(input.type);
  let detailed: CravingLog | RelapseLog | AnxietyLog | BoredomLog | undefined;
  if (input.detailedRecord) {
    const result = validateImportedStoreRecord(store, input.detailedRecord);
    if (!result.ok) throw new Error(result.error);
    detailed = result.value as typeof detailed;
  }
  const quick = input.quickRecord ? parseFeatureRecord(input.quickRecord) : undefined;
  if (input.quickRecord && (!quick || quick.recordType !== "quick-registration" || quick.registrationType !== input.type)) throw new Error("Invalid quick registration update.");
  if (detailed && quick?.recordType === "quick-registration" && quick.linkedDetailedRecordId !== detailed.id) throw new Error("Quick and detailed record links do not match.");
  const db = await getDB();
  const tx = db.transaction([store, "featureRecords"], "readwrite");
  void tx.done.catch(() => undefined);
  try {
    if (input.expectedSource) {
      if (!!detailed !== !!input.expectedSource.detailed || !!quick !== !!input.expectedSource.quick) throw new RegistrationSourceConflictError();
      if (detailed) {
        const current = await tx.objectStore(store).get(detailed.id);
        // History snapshots use the public readers' legacy normalization. Use
        // that same view inside this transaction so an unchanged legacy row is
        // editable, while its complete normalized contents remain the baseline.
        const comparable = current && (store === "cravingLogs" ? normalizeCravingRecord(current as CravingLog) : store === "relapseLogs" ? normalizeRelapseRecord(current as RelapseLog) : current);
        if (!current || current.deleted || current.id !== input.expectedSource.detailed?.id || registrationSourceSignature(comparable) !== registrationSourceSignature(input.expectedSource.detailed)) throw new RegistrationSourceConflictError();
      }
      if (quick) {
        const current = await tx.objectStore("featureRecords").get(quick.id);
        const comparable = parseFeatureRecord(current);
        if (!comparable || comparable.id !== input.expectedSource.quick?.id || registrationSourceSignature(comparable) !== registrationSourceSignature(input.expectedSource.quick)) throw new RegistrationSourceConflictError();
      }
    }
    if (detailed) await tx.objectStore(store).put(detailed as never);
    if (quick) await tx.objectStore("featureRecords").put(quick);
    await tx.done;
    return { detailedRecord: detailed, quickRecord: quick as QuickRegistrationRecord | undefined };
  } catch (error) { try { tx.abort(); } catch { /* already aborted */ } await tx.done.catch(() => {}); throw error; }
}
