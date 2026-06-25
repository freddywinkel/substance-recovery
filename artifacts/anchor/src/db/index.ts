import { openDB, DBSchema, IDBPDatabase } from "idb";

/**
 * Convert a legacy 1–5 journal craving value to its 0–10 equivalent.
 * Linear map: 1→2, 2→4, 3→6, 4→8, 5→10. Values outside 1–5 (including null
 * and already-0–10 values) are returned unchanged.
 */
export function migrateCravingTo0to10(value: number | null): number | null {
  if (value != null && value >= 1 && value <= 5) return value * 2;
  return value;
}

/** Sync metadata mixed into every syncable record (IndexedDB v5). */
export interface SyncFields {
  /** Strictly-increasing local clock stamp; pulled records carry the remote value. */
  updatedAt?: number;
  /** Soft-delete tombstone; filtered out of every getter. */
  deleted?: boolean;
}

export interface JournalEntry extends SyncFields {
  id: string;
  timestamp: number;
  mood: 1 | 2 | 3 | 4 | 5;
  cravingIntensity: number | null; // 0-10
  note: string;
  toolUsed: string | null;
  // v2 optional fields
  trigger?: string;
  coping?: string;
  favourite?: boolean;
}

export interface AppSettings {
  key: string;
  value: string | number | boolean;
}

// ── Craving Log ──────────────────────────────────────────────
export interface CravingLog extends SyncFields {
  id: string;
  timestamp: number;
  status: "draft" | "completed";

  // Step 1 — situation
  situationPresets: string[];
  situationOther: string;

  // Step 2 — intensity
  intensity: number; // 0–10
  distressLevel: number; // 0–10, -1 = skipped
  riskLevel: "" | "low" | "medium" | "high";

  // Step 3 — emotions
  emotions: string[];
  emotionOther: string;

  // Step 4 — physical sensations
  physicalSensations: string[];

  // Step 5 — thoughts
  thoughtPresets: string[];
  thoughtFreeText: string;

  // Step 6 — location + social
  location: string;
  locationOther: string;
  socialContext: string[];

  // Step 7 — substance / behavior
  substances: string[];
  primarySubstance: string;

  // Step 8 — buildup duration
  buildupDuration: string;

  // Step 9 — chosen action
  chosenAction: string;
  chosenActionOther: string;
  toolUsed: string | null;

  // Step 10 — confidence
  confidenceBefore: number; // 0–10

  // Follow-up (set later)
  intensityAfter: number | null;
  confidenceAfter: number | null;
  cravingOutcome: "decreased" | "same" | "increased" | null;
  interventionUsed: boolean | null;
  markAsPattern: boolean;

  // Safety
  highRiskFlag: boolean;

  // Optional catch-all note
  note: string;

  // v2 type split (optional, undefined on old records)
  cravingType?: "active" | "passive"; // active = trek, passive = craving
  onsetType?: string;     // passive: how craving started
  planningStage?: string; // active: how far in the plan
  needType?: string;      // active: what need drives it (legacy single-select)
  needTypes?: string[];   // active: needs that drive it (multi-select)
  needOther?: string;     // active: free-text "other" need
  triggers?: string[];    // active: situational triggers (multi-select)
  triggerNote?: string;   // active: free-text trigger context
  trekTypes?: string[];   // active: type(s) of the urge / trek (multi-select)
  onsetOther?: string;    // passive: free-text "other" onset
  useOutcome?: "used" | "not_used" | "unsure"; // behavioral outcome: did they end up using
}

// ── Relapse Log ──────────────────────────────────────────────
export type RelapseLabel =
  | "lapse"
  | "setback"
  | "return-to-use"
  | "relapse"
  | "no-label";

export type EpisodeDuration =
  | "single-moment"
  | "few-hours"
  | "whole-day"
  | "multiple-days";

export type AmountCategory =
  | "small"
  | "moderate"
  | "a-lot"
  | "multiple-times"
  | "binge"
  | "prefer-not";

export type AcuteRisk =
  | "none"
  | "unsafe"
  | "fear-continued-use"
  | "withdrawal"
  | "self-harm-risk";

export interface RelapseLog extends SyncFields {
  id: string;
  timestamp: number;
  status: "draft" | "completed";

  // Step 1 — label
  label: RelapseLabel;

  // Step 2 — when
  when: string;
  episodeDuration: EpisodeDuration;

  // Step 3 — substance + amount
  substances: string[];
  primarySubstance: string;
  amountCategory: AmountCategory;

  // Step 4 — first trigger
  firstTriggerType: string;
  firstTriggerText: string;

  // Step 5 — pre-use factors / warning signs
  preUseFactors: string[];
  missedWarnings: string[];

  // Step 6 — thought before
  preUseThoughtPreset: string;          // legacy single-select
  preUseThoughtPresets?: string[];      // permission-giving thoughts (multi-select)
  preUseThoughtFreeText: string;

  // Step 7 — what could have helped
  couldHaveHelpedEarly: string[];
  couldHaveHelpedMiddle: string[];
  couldHaveHelpedLast: string[];

  // Step 8 — who to tell
  supportContact: string;
  supportContactOther: string;

  // Step 9 — next step + risk
  nextStep: string;
  nextStepOther: string;
  acuteRisk: AcuteRisk;

  // Step 10 — optional note
  note: string;
  context: string;
  emotionAfter: number;

  // v2 extended fields (optional, undefined on old records)
  whatNeeded?: string;        // "What did you actually need?" — relief, sleep, numbness…
  relapseType?: string;       // impulsive | emotional collapse | boredom-driven | social pressure…
  pointOfNoReturn?: string;   // first thought | first contact | first movement | once there | once started
  repairActions?: string[];   // chosen stabilisation actions after logging
}

// ── Anxiety Log ──────────────────────────────────────────────
// Developer note: AnxietyLog and BoredomLog are designed for awareness and
// distress-tolerance training, NOT symptom control or obsessive self-monitoring.
// The goal is fast pattern recognition and building tolerance for uncomfortable
// internal states without immediately reacting.

export interface AnxietyLog extends SyncFields {
  id: string;
  timestamp: number;
  intensity: number; // 1–10

  // v1 fields
  context: string; // single-select
  trigger: string; // single-select
  bodySensations: string[]; // multi-select
  reaction: string; // single-select
  note: string;

  // v2 extended fields (optional, undefined on old records)
  anxietyTypes?: string[];        // multi-select: panic spike, social anxiety, dread…
  bodyLocations?: string[];       // chest, stomach, throat, head, arms, legs, whole body
  bodyPrediction?: string;        // what is your brain predicting?
  urgencyHigh?: boolean;          // urgent / needs-help-now flag
  reassuranceSeeking?: string[];  // googling, checking body, asking others…
  linkedState?: string;           // legacy single-select: triggered craving, restlessness, etc.
  linkedStates?: string[];        // linked states (multi-select)
  triggers?: string[];            // triggers (multi-select)
  outcomeAfter?: "decreased" | "same" | "increased" | null; // set on done screen
}

// ── Boredom Log ───────────────────────────────────────────────
export interface BoredomLog extends SyncFields {
  id: string;
  timestamp: number;
  intensity: number; // 1–10

  // v1 fields
  feelingTypes: string[]; // 1–2 select
  situation: string; // single-select
  urge: string; // single-select
  action: string; // single-select: escaped/delayed/sat-with-it/replaced
  delayDuration: string; // "0" | "5" | "10" | "20+" | ""
  note: string;

  // v2 extended fields (optional, undefined on old records)
  restlessnessTypes?: string[];   // bored, understimulated, agitated, mentally noisy…
  stimulationNeed?: string;       // legacy single-select: calming | movement | sensory-reset | hands | mental | social
  stimulationNeeds?: string[];    // stimulation needs (multi-select)
  rescueMenu?: string[];          // selected rescue actions (shower, walk, stretch…)
  convertCheck?: string;          // is this actually: craving | anxiety | loneliness | exhaustion
  environmentReset?: string[];    // open window, softer lights, leave room…
  outcomeAfter?: "decreased" | "same" | "increased" | null; // set on done screen
}

// ── Crisis & Emergency ────────────────────────────────────────
export interface CrisisService {
  id: string;
  name: string;
  number: string;
  isCustom: boolean;
}

export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
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

// ── Sync bookkeeping records (IndexedDB v5, local-only) ──────
export interface SyncMetaRecord {
  key: string;
  value: string | number;
}
export interface DirtyRecord {
  id: string; // `${kind}:${recordId}`
  kind: string;
  recordId: string;
}

// ── IndexedDB schema ─────────────────────────────────────────
interface AnchorDB extends DBSchema {
  journal: {
    key: string;
    value: JournalEntry;
    indexes: { byTimestamp: number };
  };
  // Vestigial store kept for backward compatibility — no longer written or read by the app
  checkIns: {
    key: string;
    value: { id: string; date: string; timestamp: number };
    indexes: { byDate: string };
  };
  settings: {
    key: string;
    value: AppSettings;
  };
  cravingLogs: {
    key: string;
    value: CravingLog;
    indexes: { byTimestamp: number };
  };
  relapseLogs: {
    key: string;
    value: RelapseLog;
    indexes: { byTimestamp: number };
  };
  anxietyLogs: {
    key: string;
    value: AnxietyLog;
    indexes: { byTimestamp: number };
  };
  boredomLogs: {
    key: string;
    value: BoredomLog;
    indexes: { byTimestamp: number };
  };
  // Local-only sync bookkeeping (v5). Never affects offline behaviour.
  syncMeta: {
    key: string;
    value: SyncMetaRecord;
  };
  dirtyRecords: {
    key: string;
    value: DirtyRecord;
  };
}

let dbInstance: IDBPDatabase<AnchorDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<AnchorDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<AnchorDB>("anchor-recovery", 5, {
    upgrade(db, oldVersion, _newVersion, tx) {
      if (oldVersion < 1) {
        const journalStore = db.createObjectStore("journal", { keyPath: "id" });
        journalStore.createIndex("byTimestamp", "timestamp");
        const checkInStore = db.createObjectStore("checkIns", { keyPath: "id" });
        checkInStore.createIndex("byDate", "date");
        db.createObjectStore("settings", { keyPath: "key" });
      }
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains("cravingLogs")) {
          const cs = db.createObjectStore("cravingLogs", { keyPath: "id" });
          cs.createIndex("byTimestamp", "timestamp");
        }
        if (!db.objectStoreNames.contains("relapseLogs")) {
          const rs = db.createObjectStore("relapseLogs", { keyPath: "id" });
          rs.createIndex("byTimestamp", "timestamp");
        }
      }
      if (oldVersion < 3) {
        if (!db.objectStoreNames.contains("anxietyLogs")) {
          const al = db.createObjectStore("anxietyLogs", { keyPath: "id" });
          al.createIndex("byTimestamp", "timestamp");
        }
        if (!db.objectStoreNames.contains("boredomLogs")) {
          const bl = db.createObjectStore("boredomLogs", { keyPath: "id" });
          bl.createIndex("byTimestamp", "timestamp");
        }
      }
      // v4 — journal craving scale migrated from 1–5 to 0–10.
      // Legacy entries hold 1–5 values but the UI now labels them "/10", so a
      // legacy "5 of 5" misreads as a middling "5/10". Convert them once with a
      // linear map (1→2, 2→4, 3→6, 4→8, 5→10).
      //
      // The 0–10 slider and this v4 migration ship together, so when a database
      // upgrades from a pre-v4 schema every journal entry it already holds was
      // written on the old 1–5 scale — no 0–10 entry can exist yet. The
      // schema-version boundary (oldVersion < 4) is therefore the reliable
      // discriminator: convert every existing 1–5 value here. Entries created
      // after the upgrade are written on the 0–10 scale and are never seen by
      // this one-shot migration, so they stay untouched.
      if (oldVersion >= 1 && oldVersion < 4) {
        const journalStore = tx.objectStore("journal");
        journalStore.getAll().then((entries) => {
          for (const entry of entries) {
            const converted = migrateCravingTo0to10(entry.cravingIntensity);
            if (converted !== entry.cravingIntensity) {
              journalStore.put({ ...entry, cravingIntensity: converted });
            }
          }
        });
      }
      // v5 — optional cloud-sync scaffolding. Two local-only stores: syncMeta
      // (deviceId, revision cursor, monotonic clock, per-setting stamps) and
      // dirtyRecords (queue of locally-changed syncable records to push). No
      // existing data is touched; offline/signed-out behaviour is unchanged.
      if (oldVersion < 5) {
        if (!db.objectStoreNames.contains("syncMeta")) {
          db.createObjectStore("syncMeta", { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains("dirtyRecords")) {
          db.createObjectStore("dirtyRecords", { keyPath: "id" });
        }
      }
    },
  });

  return dbInstance;
}

// ── Sync metadata & dirty tracking (v5) ──────────────────────
// Local-only bookkeeping that powers optional cloud sync. None of this changes
// offline behaviour: writes still land in IndexedDB first; these helpers only
// record *what* changed and *when*, so the sync engine (only when signed in)
// can push it and resolve conflicts last-write-wins.

const SYNC_META_CLOCK = "clock";
const SYNC_META_CURSOR = "cursor";
const SYNC_META_DEVICE_ID = "deviceId";
const SYNC_META_LAST_SERVER_TIME = "lastServerTime";
// The Clerk userId whose data is currently materialized locally. Lets the engine
// detect an account switch on the same browser and drop the previous account's
// local copy before syncing the new one (prevents cross-account leakage).
const SYNC_META_LAST_USER = "lastSyncedUserId";

// The single syncable setting. Its value lives in the `settings` store; its
// sync stamp lives in `syncMeta` (settings values can't carry an updatedAt).
export const SOBRIETY_SETTING_KIND = "setting:sobrietyStartDate";
export const SOBRIETY_RECORD_ID = "sobrietyStartDate";
const SOBRIETY_UPDATED_AT_KEY = "setting:sobrietyStartDate:updatedAt";

async function getSyncMetaValue(
  key: string,
): Promise<string | number | undefined> {
  const db = await getDB();
  const rec = await db.get("syncMeta", key);
  return rec?.value;
}
async function setSyncMetaValue(
  key: string,
  value: string | number,
): Promise<void> {
  const db = await getDB();
  await db.put("syncMeta", { key, value });
}

/**
 * Issue a strictly-increasing local timestamp for a write. Uses wall-clock time
 * when it has advanced, otherwise the previous stamp + 1, so rapid successive
 * writes never collide. Persisted so the clock survives reloads. Done in one
 * readwrite transaction to stay monotonic under concurrent writes.
 */
export async function nextUpdatedAt(): Promise<number> {
  const db = await getDB();
  const tx = db.transaction("syncMeta", "readwrite");
  const store = tx.objectStore("syncMeta");
  const prev = (await store.get(SYNC_META_CLOCK))?.value;
  const prevNum = typeof prev === "number" ? prev : 0;
  const next = Math.max(Date.now(), prevNum + 1);
  await store.put({ key: SYNC_META_CLOCK, value: next });
  await tx.done;
  return next;
}

/** Stable per-device id (generated once, persisted) used for sync tie-breaks. */
export async function getDeviceId(): Promise<string> {
  const existing = await getSyncMetaValue(SYNC_META_DEVICE_ID);
  if (typeof existing === "string" && existing) return existing;
  const id = crypto.randomUUID();
  await setSyncMetaValue(SYNC_META_DEVICE_ID, id);
  return id;
}

/**
 * Server revision cursor for incremental pulls, scoped per Clerk user so two
 * accounts on the same browser never share a cursor (which would let the second
 * account skip records at or below the first account's revision). "0" means
 * "pull everything".
 */
export async function getSyncCursor(userId: string): Promise<string> {
  const v = await getSyncMetaValue(`${SYNC_META_CURSOR}:${userId}`);
  return typeof v === "string" ? v : "0";
}
export async function setSyncCursor(
  userId: string,
  cursor: string,
): Promise<void> {
  await setSyncMetaValue(`${SYNC_META_CURSOR}:${userId}`, cursor);
}

/** The Clerk user whose data is currently materialized locally (or null). */
export async function getLastSyncedUserId(): Promise<string | null> {
  const v = await getSyncMetaValue(SYNC_META_LAST_USER);
  return typeof v === "string" && v ? v : null;
}
export async function setLastSyncedUserId(userId: string): Promise<void> {
  await setSyncMetaValue(SYNC_META_LAST_USER, userId);
}
export async function getLastServerTime(): Promise<number> {
  const v = await getSyncMetaValue(SYNC_META_LAST_SERVER_TIME);
  return typeof v === "number" ? v : 0;
}
export async function setLastServerTime(t: number): Promise<void> {
  await setSyncMetaValue(SYNC_META_LAST_SERVER_TIME, t);
}

/** Sync stamp for the sobrietyStartDate setting (see note above). */
export async function getSobrietyUpdatedAt(): Promise<number> {
  const v = await getSyncMetaValue(SOBRIETY_UPDATED_AT_KEY);
  return typeof v === "number" ? v : 0;
}
export async function setSobrietyUpdatedAt(t: number): Promise<void> {
  await setSyncMetaValue(SOBRIETY_UPDATED_AT_KEY, t);
}

/** Mark a syncable record as needing push. Keyed by `kind:recordId`. */
async function markDirty(kind: string, recordId: string): Promise<void> {
  const db = await getDB();
  await db.put("dirtyRecords", { id: `${kind}:${recordId}`, kind, recordId });
  // Signal the sync engine (if mounted) to schedule a debounced push. Harmless
  // when signed out — nothing listens.
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SYNC_DIRTY_EVENT));
  }
}

// ── Sync engine primitives (v5) ──────────────────────────────
// Consumed by lib/sync-engine.ts. Kept here so they have typed access to the
// object stores. The merge path (applyRemoteRecord) never marks records dirty,
// so pulled data never bounces back on the next push.

/** Fired on window after any local syncable write; drives debounced sync. */
export const SYNC_DIRTY_EVENT = "anchor:dirty";
/** Fired on window after a sync applied remote changes; drives UI refresh. */
export const SYNC_APPLIED_EVENT = "anchor:synced";

const SYNC_META_FIRST_PUSH = "firstPushDone";

// Syncable record kinds (everything except the single setting kind) and their
// object store. Store name === kind by construction.
export const SYNCABLE_RECORD_KINDS = [
  "journal",
  "cravingLogs",
  "relapseLogs",
  "anxietyLogs",
  "boredomLogs",
] as const;
export type SyncableRecordKind = (typeof SYNCABLE_RECORD_KINDS)[number];
type SyncableRecord =
  | JournalEntry
  | CravingLog
  | RelapseLog
  | AnxietyLog
  | BoredomLog;

const recordKindSet = new Set<string>(SYNCABLE_RECORD_KINDS);
export function isSyncableRecordKind(kind: string): kind is SyncableRecordKind {
  return recordKindSet.has(kind);
}

export async function getDirtyRecords(): Promise<DirtyRecord[]> {
  const db = await getDB();
  return db.getAll("dirtyRecords");
}

/** Read a syncable record (returns undefined for missing or unknown kinds). */
export async function getSyncableRecord(
  kind: string,
  recordId: string,
): Promise<SyncableRecord | undefined> {
  if (!isSyncableRecordKind(kind)) return undefined;
  const db = await getDB();
  return db.get(kind, recordId);
}

export interface PushedItem {
  id: string;
  kind: string;
  recordId: string;
  updatedAt: number;
}

/**
 * After a successful push, drop each dirty entry — but only if the record has
 * not been written again since we built the change (its updatedAt is unchanged).
 * A newer local write keeps the entry dirty so the next sync re-pushes it.
 */
export async function reconcileDirtyAfterPush(
  items: PushedItem[],
): Promise<void> {
  const db = await getDB();
  for (const it of items) {
    let current = 0;
    if (it.kind === SOBRIETY_SETTING_KIND) {
      current = await getSobrietyUpdatedAt();
    } else if (isSyncableRecordKind(it.kind)) {
      current = (await db.get(it.kind, it.recordId))?.updatedAt ?? 0;
    } else {
      current = it.updatedAt; // unknown kind — drop it
    }
    if (current <= it.updatedAt) {
      await db.delete("dirtyRecords", it.id);
    }
  }
}

export interface RemoteChange {
  kind: string;
  recordId: string;
  payload: Record<string, unknown> | null | undefined;
  clientUpdatedAt: number;
  deleted: boolean;
}

/**
 * Merge one pulled record into local IndexedDB, last-write-wins on updatedAt.
 * Never marks dirty. Exact-timestamp ties keep the local copy. Returns true if
 * local state actually changed (so the engine can refresh the UI).
 */
export async function applyRemoteRecord(change: RemoteChange): Promise<boolean> {
  const db = await getDB();

  if (change.kind === SOBRIETY_SETTING_KIND) {
    if (change.clientUpdatedAt <= (await getSobrietyUpdatedAt())) return false;
    const value =
      change.deleted || change.payload == null
        ? ""
        : typeof change.payload.value === "string"
          ? change.payload.value
          : "";
    await db.put("settings", { key: SOBRIETY_RECORD_ID, value });
    await setSobrietyUpdatedAt(change.clientUpdatedAt);
    return true;
  }

  if (!isSyncableRecordKind(change.kind)) return false;
  const store = change.kind;
  const existing = await db.get(store, change.recordId);
  if (change.clientUpdatedAt <= (existing?.updatedAt ?? 0)) return false;

  // store/value kinds are correlated by construction; idb can't track that, so
  // narrow the store to one literal and cast the value to match.
  if (change.deleted || change.payload == null) {
    const tombstone = {
      ...(existing ?? { id: change.recordId }),
      id: change.recordId,
      deleted: true,
      updatedAt: change.clientUpdatedAt,
    } as SyncableRecord;
    await db.put(store as "journal", tombstone as JournalEntry);
    return true;
  }
  const record = {
    ...change.payload,
    id: change.recordId,
    updatedAt: change.clientUpdatedAt,
    deleted: false,
  } as SyncableRecord;
  await db.put(store as "journal", record as JournalEntry);
  return true;
}

/**
 * Whether the one-time, push-all-local-data step has run for this user on this
 * device. Scoped per Clerk user so a second account does not skip its own merge
 * (and so the first account's merge state never suppresses the second's).
 */
export async function isFirstPushDone(userId: string): Promise<boolean> {
  return (await getSyncMetaValue(`${SYNC_META_FIRST_PUSH}:${userId}`)) === 1;
}
export async function markFirstPushDone(userId: string): Promise<void> {
  await setSyncMetaValue(`${SYNC_META_FIRST_PUSH}:${userId}`, 1);
}

/**
 * First-sign-in step: enqueue every existing local syncable record (including
 * tombstones) for push, backfilling updatedAt on pre-v5 records from their
 * creation timestamp. Lets data created offline reach the account on first login.
 */
export async function enqueueAllSyncableRecords(): Promise<void> {
  const db = await getDB();
  for (const store of SYNCABLE_RECORD_KINDS) {
    const all = await db.getAll(store);
    for (const rec of all) {
      if (rec.updatedAt == null) {
        const updatedAt = rec.timestamp ?? (await nextUpdatedAt());
        await db.put(store as "journal", {
          ...rec,
          updatedAt,
        } as JournalEntry);
      }
      await db.put("dirtyRecords", {
        id: `${store}:${rec.id}`,
        kind: store,
        recordId: rec.id,
      });
    }
  }
  const sob = await db.get("settings", SOBRIETY_RECORD_ID);
  if (sob && typeof sob.value === "string" && sob.value !== "") {
    if ((await getSobrietyUpdatedAt()) === 0) {
      await setSobrietyUpdatedAt(await nextUpdatedAt());
    }
    await db.put("dirtyRecords", {
      id: `${SOBRIETY_SETTING_KIND}:${SOBRIETY_RECORD_ID}`,
      kind: SOBRIETY_SETTING_KIND,
      recordId: SOBRIETY_RECORD_ID,
    });
  }
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
