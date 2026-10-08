import { DatabaseBlockedError, DatabaseOutdatedError, publishDatabaseLifecycle } from "./lifecycle";
import type { UseDetail } from "@/lib/useDetails";
import type { CareRole } from "@/lib/careDirectory";
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import {
  migrateCravingRegistrationType,
  migrateCravingTo0to10,
  migrateRelapseFollowUpAnswers,
  migrateRelapseV2DefaultAnswers,
  migrateRegistrationRecordMetadata,
} from "./migrations";
import { migrateRelapseSafetyRecord } from "./relapseSafety";
import { normalizeRelapseTimingRecord } from "./relapseTiming";
import { migrateCompletedTrekRecord } from "@/lib/trekMigration";
import type { FeatureRecord } from "@/lib/recoveryFeatures";
import type { AcuteRisk, AcuteRiskSelection } from "./relapseSafety";

export type {
  AcuteConcern,
  AcuteRisk,
  AcuteRiskSelection,
} from "./relapseSafety";
interface SyncMetaRecord {
  key: string;
  value: string | number;
}

interface DirtyRecord {
  id: string;
  kind: string;
  recordId: string;
}


/** Sync metadata mixed into every syncable record (IndexedDB v5). */
export interface SyncFields {
  /** Strictly-increasing local clock stamp; pulled records carry the remote value. */
  updatedAt?: number;
  /** Soft-delete tombstone; filtered out of every getter. */
  deleted?: boolean;
}

export type RegistrationAnswerValue =
  | string
  | string[]
  | number
  | boolean
  | null;

/**
 * Versioned metadata shared by every registration record.
 *
 * `timestamp` remains the compatibility timestamp used by existing indexes and
 * consumers. New writes mirror `occurredAt` into it. The explicit fields keep
 * occurrence, tracker start, and completion from being conflated in future UI
 * and analytics work.
 */
export interface RegistrationRecordMetadata {
  /** Time of a user correction; occurrence/start/completion remain separate. */
  editedAt?: number;
  /** When the event occurred. Falls back to the legacy timestamp. */
  occurredAt?: number;
  /** When the user started this registration flow. */
  startedAt?: number;
  /** When the registration was committed. */
  completedAt?: number;
  /** Shape version for the canonical metadata/answers envelope. */
  dataVersion?: number;
  /** Optional option-catalog/content version used to interpret stable IDs. */
  contentVersion?: string;
  /** Stable answer IDs for forward-compatible tracker payloads. */
  answers?: Record<string, RegistrationAnswerValue>;
}

export type FollowUpOutcome =
  | "decreased"
  | "same"
  | "increased"
  | "unknown"
  | null;

export interface JournalEntry extends SyncFields {
  id: string;
  timestamp: number;
  mood: 1 | 2 | 3 | 4 | 5 | null;
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
export interface CravingLog extends SyncFields, RegistrationRecordMetadata {
  useDetails?: UseDetail[];
  id: string;
  timestamp: number;
  status: "draft" | "completed";

  // Step 1 — situation
  situationPresets: string[];
  situationOther: string;

  // Step 2 — intensity
  intensity: number | null; // 0–10, null = unanswered
  distressLevel: number | null; // 0–10, null = unanswered
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
  actionAttempted?: boolean | null; // null/undefined = unanswered
  toolUsed: string | null;

  // Step 10 — confidence
  confidenceBefore: number | null; // 0–10, null = unanswered

  // Follow-up (set later)
  intensityAfter: number | null;
  confidenceAfter: number | null;
  cravingOutcome: FollowUpOutcome;
  interventionUsed: boolean | null;
  markAsPattern: boolean;

  // Deprecated compatibility field. Earlier builds inferred this from an
  // intensity threshold. New writes keep it false and Insights ignores it.
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
  | "multiple-days"
  | "unanswered";

export type AmountCategory =
  | "small"
  | "moderate"
  | "a-lot"
  | "multiple-times"
  | "binge"
  | "prefer-not"
  | "unanswered";

export interface RelapseLog extends SyncFields, RegistrationRecordMetadata {
  useDetails?: UseDetail[];
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
  /** Canonical safety answer. Empty means unanswered; `none` is exclusive. */
  acuteRisks: AcuteRiskSelection[];
  /**
   * Compatibility alias for older backups and consumers. It represents only
   * one prioritized value; `acuteRisks` above is authoritative.
   */
  acuteRisk: AcuteRisk;

  // Step 10 — optional note
  note: string;
  context: string;
  emotionAfter: number | null;

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

export interface AnxietyLog extends SyncFields, RegistrationRecordMetadata {
  id: string;
  timestamp: number;
  intensity: number | null; // 0–10, null = unanswered

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
  urgencyHigh?: boolean | null;   // null/undefined = unanswered
  reassuranceSeeking?: string[];  // googling, checking body, asking others…
  linkedState?: string;           // legacy single-select: triggered craving, restlessness, etc.
  linkedStates?: string[];        // linked states (multi-select)
  triggers?: string[];            // triggers (multi-select)
  outcomeAfter?: FollowUpOutcome; // set on done screen
}

// ── Boredom Log ───────────────────────────────────────────────
export interface BoredomLog extends SyncFields, RegistrationRecordMetadata {
  id: string;
  timestamp: number;
  intensity: number | null; // 0–10, null = unanswered

  // v1 fields
  feelingTypes: string[]; // 1–2 select
  situation: string; // single-select
  situationOther?: string;
  urge: string; // single-select
  urgeOther?: string;
  action: string; // single-select: escaped/delayed/sat-with-it/replaced
  delayDuration: string | null; // null = not recorded
  note: string;

  // v2 extended fields (optional, undefined on old records)
  restlessnessTypes?: string[];   // bored, understimulated, agitated, mentally noisy…
  stimulationNeed?: string;       // legacy single-select: calming | movement | sensory-reset | hands | mental | social
  stimulationNeeds?: string[];    // stimulation needs (multi-select)
  rescueMenu?: string[];          // selected rescue actions (shower, walk, stretch…)
  convertCheck?: string;          // is this actually: craving | anxiety | loneliness | exhaustion
  environmentReset?: string[];    // open window, softer lights, leave room…
  outcomeAfter?: FollowUpOutcome; // set on done screen
}

// ── Cigarette Log ─────────────────────────────────────────────
export interface CigaretteLog extends SyncFields, RegistrationRecordMetadata {
  id: string;
  timestamp: number;
  note?: string;
}

// ── Crisis & Emergency ────────────────────────────────────────
export interface CrisisService {
  role?: CareRole;
  availability?: string;
  eligibility?: string;
  id: string;
  name: string;
  number: string;
  isCustom: boolean;
}

export interface EmergencyContact {
  role?: string;
  availability?: string;
  supportNotes?: string;
  fallback?: string;
  /** Applies to a chosen report, not the private full backup or permission to send messages. */
  sharingPreference?: "unanswered" | "ask-first" | "may-share" | "keep-private";
  id: string;
  name: string;
  relationship: string;
  phone: string;
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
  cigaretteLogs: {
    key: string;
    value: CigaretteLog;
    indexes: { byTimestamp: number };
  };
  featureRecords: {
    key: string;
    value: FeatureRecord;
    indexes: { byTimestamp: number; byRecordType: FeatureRecord["recordType"] };
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

export const DATABASE_VERSION = 11;
let dbInstance: IDBPDatabase<AnchorDB> | null = null;
let opening: Promise<IDBPDatabase<AnchorDB>> | null = null;
let blockedError: DatabaseBlockedError | null = null;
let outdatedError: DatabaseOutdatedError | null = null;

export async function getDB(): Promise<IDBPDatabase<AnchorDB>> {
  if (outdatedError) throw outdatedError;
  if (dbInstance) return dbInstance;
  if (opening) {
    if (blockedError) throw blockedError;
    return opening;
  }

  publishDatabaseLifecycle({ kind: "opening" });
  let rejectBlocked!: (error: DatabaseBlockedError) => void;
  const blocked = new Promise<never>((_resolve, reject) => { rejectBlocked = reject; });
  const request = Promise.resolve().then(() => openDB<AnchorDB>("anchor-recovery", DATABASE_VERSION, {
    blocked() {
      blockedError = new DatabaseBlockedError();
      publishDatabaseLifecycle({ kind: "blocked", error: blockedError });
      // The native request stays queued, but callers are not left loading forever.
      // There is only one queued request, including after repeated retry clicks.
      rejectBlocked(blockedError);
    },
    blocking() {
      dbInstance?.close();
      dbInstance = null;
      outdatedError = new DatabaseOutdatedError();
      publishDatabaseLifecycle({ kind: "outdated", error: outdatedError });
    },
    terminated() {
      dbInstance = null;
      publishDatabaseLifecycle({ kind: "unavailable", error: new Error("The database connection was interrupted. Retry opening your data.") });
    },
    upgrade(db, oldVersion, _newVersion, tx) {
      // openDB's request reports upgrade failure to getDB. Also consume the
      // transaction promise so a browser-aborted upgrade cannot leak a second,
      // unhandled rejection while the UI is displaying the recoverable error.
      void tx.done.catch(() => undefined);
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
      // v6 — cigarette log store for tobacco-use tracking.
      if (oldVersion < 6) {
        if (!db.objectStoreNames.contains("cigaretteLogs")) {
          const cl = db.createObjectStore("cigaretteLogs", { keyPath: "id" });
          cl.createIndex("byTimestamp", "timestamp");
        }
      }
      // v7 — preserve the legacy timestamp/index while giving every existing
      // registration explicit occurrence/start/completion metadata. Historical
      // records cannot be reconstructed more precisely, so all three fields use
      // their authoritative legacy timestamp during this one-shot migration.
      if (oldVersion < 7) {
        const stores = [
          "cravingLogs",
          "anxietyLogs",
          "boredomLogs",
          "cigaretteLogs",
        ] as const;
        for (const storeName of stores) {
          if (!db.objectStoreNames.contains(storeName)) continue;
          const store = tx.objectStore(storeName);
          store.openCursor().then(function migrateCursor(cursor): Promise<void> | void {
            if (!cursor) return;
            cursor.update(migrateRegistrationRecordMetadata(cursor.value));
            return cursor.continue().then(migrateCursor);
          });
        }
      }
      // v8 — make simultaneous Relapse safety concerns canonical. Keep the
      // singular value only as a compatibility alias for older consumers.
      if (oldVersion < 8 && db.objectStoreNames.contains("relapseLogs")) {
        const store = tx.objectStore("relapseLogs");
        store.openCursor().then(function migrateRelapseCursor(cursor): Promise<void> | void {
          if (!cursor) return;
          cursor.update(normalizeRelapseTimingRecord(migrateRelapseFollowUpAnswers(
            migrateRelapseV2DefaultAnswers(
              migrateRelapseSafetyRecord(
                migrateRegistrationRecordMetadata(cursor.value),
              ),
            ),
          )));
          return cursor.continue().then(migrateRelapseCursor);
        });
      }
      if (oldVersion < 8 && db.objectStoreNames.contains("cravingLogs")) {
        const store = tx.objectStore("cravingLogs");
        store.openCursor().then(function migrateCravingCursor(cursor): Promise<void> | void {
          if (!cursor) return;
          // A direct v6 -> v8 upgrade also runs the v7 cursor above. Both
          // cursors can observe the same pre-v7 value, so this later whole-record
          // update must carry metadata itself rather than erase the v7 result.
          cursor.update(migrateCompletedTrekRecord(
            migrateCravingRegistrationType(
              migrateRegistrationRecordMetadata(cursor.value),
            ),
          ));
          return cursor.continue().then(migrateCravingCursor);
        });
      }
      // v9 — offline-only records for quick registrations, supportive actions,
      // timed follow-ups and saved weekly plans. Existing stores are untouched.
      if (oldVersion < 9 && !db.objectStoreNames.contains("featureRecords")) {
        const records = db.createObjectStore("featureRecords", { keyPath: "id" });
        records.createIndex("byTimestamp", "timestamp");
        records.createIndex("byRecordType", "recordType");
      }
      // v11 adds a write-compatibility barrier for personal growth records.
      // No store or existing record is rewritten. Older clients must update
      // before opening the database, so their closed backup catalog cannot
      // hide or discard new moments, personal words or unfinished drafts.
      // v10 is a write-compatibility barrier for expanded recovery data.
      // No store/record is rewritten here. An older v9 app cannot reopen this
      // database and save an older representation over the new plan fields.
    },
  }));
  const ready = request.then((database) => {
    dbInstance = database;
    blockedError = null;
    opening = null;
    publishDatabaseLifecycle(null);
    return database;
  }, (cause: unknown) => {
    opening = null;
    blockedError = null;
    const error = cause instanceof Error ? cause : new Error(String(cause));
    if (error.name === "VersionError") {
      outdatedError = new DatabaseOutdatedError();
      publishDatabaseLifecycle({ kind: "outdated", error: outdatedError });
      throw outdatedError;
    }
    publishDatabaseLifecycle({ kind: "unavailable", error });
    throw error;
  });
  opening = Promise.race([ready, blocked]);
  return opening;
}
