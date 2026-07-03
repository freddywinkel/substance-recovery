import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { migrateCravingTo0to10 } from "./migrations";
import type { SyncMetaRecord, DirtyRecord } from "./sync";


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
