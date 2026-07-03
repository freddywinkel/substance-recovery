// ── Sync metadata & dirty tracking (v5) ──────────────────────
// Local-only bookkeeping that powers optional cloud sync. None of this changes
// offline behaviour: writes still land in IndexedDB first; these helpers only
// record *what* changed and *when*, so the sync engine (only when signed in)
// can push it and resolve conflicts last-write-wins.

import {
  getDB,
  type AnxietyLog,
  type BoredomLog,
  type CravingLog,
  type JournalEntry,
  type RelapseLog,
} from "./schema";

export interface SyncMetaRecord {
  key: string;
  value: string | number;
}

export interface DirtyRecord {
  id: string;
  kind: string;
  recordId: string;
}

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
export const SOBRIETY_UPDATED_AT_KEY = "setting:sobrietyStartDate:updatedAt";

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
export async function markDirty(kind: string, recordId: string): Promise<void> {
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
