import { syncRecords, type SyncChange } from "@workspace/api-client-react";
import {
  applyRemoteRecord,
  clearAllData,
  clearDeviceLocalData,
  clearSyncableStoresForAccountSwitch,
  enqueueAllSyncableRecords,
  eraseSyncableDataWithTombstones,
  getDirtyRecords,
  getLastSyncedUserId,
  getSobrietyUpdatedAt,
  getSyncableRecord,
  getSyncCursor,
  getSetting,
  isFirstPushDone,
  isSyncableRecordKind,
  markFirstPushDone,
  nextUpdatedAt,
  reconcileDirtyAfterPush,
  setLastSyncedUserId,
  setSyncCursor,
  setLastServerTime,
  SOBRIETY_RECORD_ID,
  SOBRIETY_SETTING_KIND,
  SYNC_APPLIED_EVENT,
  type DirtyRecord,
  type PushedItem,
} from "@/db";

// Server caps a request at 500 changes; stay well under so each push is small.
const PUSH_CHUNK = 200;
// Pull page size requested per round-trip.
const PULL_LIMIT = 200;

interface PreparedChange {
  change: SyncChange;
  item: PushedItem;
}

/**
 * Build the wire change for a single dirty entry, capturing the updatedAt we are
 * about to push so the dirty entry can be cleared safely afterwards.
 */
async function prepareChange(
  dirty: DirtyRecord,
): Promise<PreparedChange | null> {
  if (dirty.kind === SOBRIETY_SETTING_KIND) {
    const raw = (await getSetting(SOBRIETY_RECORD_ID, "")) as string;
    const updatedAt = (await getSobrietyUpdatedAt()) || (await nextUpdatedAt());
    return {
      change: {
        kind: dirty.kind,
        recordId: dirty.recordId,
        payload: { value: raw === "" ? null : raw, updatedAt },
        clientUpdatedAt: updatedAt,
        deleted: false,
      },
      item: { id: dirty.id, kind: dirty.kind, recordId: dirty.recordId, updatedAt },
    };
  }

  if (!isSyncableRecordKind(dirty.kind)) return null;

  const rec = await getSyncableRecord(dirty.kind, dirty.recordId);
  if (!rec) {
    // Should not happen (deletes are tombstones), but converge the server anyway.
    const updatedAt = await nextUpdatedAt();
    return {
      change: {
        kind: dirty.kind,
        recordId: dirty.recordId,
        payload: null,
        clientUpdatedAt: updatedAt,
        deleted: true,
      },
      item: { id: dirty.id, kind: dirty.kind, recordId: dirty.recordId, updatedAt },
    };
  }

  const updatedAt = rec.updatedAt ?? (await nextUpdatedAt());
  const deleted = !!rec.deleted;
  return {
    change: {
      kind: dirty.kind,
      recordId: dirty.recordId,
      payload: deleted ? null : (rec as unknown as Record<string, unknown>),
      clientUpdatedAt: updatedAt,
      deleted,
    },
    item: { id: dirty.id, kind: dirty.kind, recordId: dirty.recordId, updatedAt },
  };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export interface SyncOutcome {
  pushed: number;
  applied: number;
}

let running: Promise<SyncOutcome> | null = null;
let runningUserId: string | null = null;

/**
 * Run one full sync cycle for the given Clerk user: push all dirty local changes
 * in chunks, then drain remote pages by revision cursor until the server reports
 * no more. Conflicts resolve last-write-wins on updatedAt.
 *
 * Concurrent calls for the same user share the in-flight run; a call for a
 * different user is serialized after the current one (an account switch must not
 * piggy-back on the previous account's sync).
 *
 * Requires an authenticated session (cookies are sent same-origin via the
 * proxy). Throws on network/HTTP failure so the caller can surface an error.
 */
export function runSync(userId: string): Promise<SyncOutcome> {
  if (!userId) return Promise.resolve({ pushed: 0, applied: 0 });
  if (running && runningUserId === userId) return running;
  const prev = running ?? Promise.resolve();
  const next = prev
    .catch(() => {})
    .then(() => doRunSync(userId));
  running = next;
  runningUserId = userId;
  void next.finally(() => {
    if (running === next) {
      running = null;
      runningUserId = null;
    }
  });
  return next;
}

async function doRunSync(userId: string): Promise<SyncOutcome> {
  // Account switch on this browser: drop the previous account's local copy
  // before syncing the new one, so it neither shows to nor is pushed into the
  // new account. The new user then pulls their own data from a fresh cursor.
  const lastUser = await getLastSyncedUserId();
  if (lastUser && lastUser !== userId) {
    await clearSyncableStoresForAccountSwitch();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(SYNC_APPLIED_EVENT));
    }
  }
  await setLastSyncedUserId(userId);

  // One-time per user: on first sign-in, enqueue all pre-existing local data so
  // it reaches the account (records created offline aren't otherwise dirty).
  // After an account switch the stores are empty, so this enqueues nothing.
  if (!(await isFirstPushDone(userId))) {
    await enqueueAllSyncableRecords();
    await markFirstPushDone(userId);
  }

  let cursor = await getSyncCursor(userId);
  let pushed = 0;
  let applied = 0;

  const apply = async (
    records: {
      kind: string;
      recordId: string;
      payload?: Record<string, unknown> | null;
      clientUpdatedAt: number;
      deleted: boolean;
    }[],
  ) => {
    for (const r of records) {
      if (await applyRemoteRecord({ ...r, payload: r.payload ?? null })) {
        applied += 1;
      }
    }
  };

  // Build all pending changes up front.
  const dirty = await getDirtyRecords();
  const prepared: PreparedChange[] = [];
  for (const d of dirty) {
    const p = await prepareChange(d);
    if (p) prepared.push(p);
  }

  // Push phase — each call also returns a page of remote changes, advancing the
  // cursor as we go.
  let lastHasMore = true;
  for (const group of chunk(prepared, PUSH_CHUNK)) {
    const result = await syncRecords(
      { changes: group.map((g) => g.change), cursor, limit: PULL_LIMIT },
      { credentials: "include" },
    );
    await apply(result.records);
    cursor = result.cursor;
    await setSyncCursor(userId, cursor);
    await setLastServerTime(result.serverTime);
    await reconcileDirtyAfterPush(group.map((g) => g.item));
    pushed += group.length;
    lastHasMore = result.hasMore;
  }

  // Pull phase — drain remaining pages. Runs at least once when there were no
  // dirty changes to push, so a fresh device still pulls its account data.
  if (prepared.length === 0) lastHasMore = true;
  while (lastHasMore) {
    const result = await syncRecords(
      { changes: [], cursor, limit: PULL_LIMIT },
      { credentials: "include" },
    );
    await apply(result.records);
    cursor = result.cursor;
    await setSyncCursor(userId, cursor);
    await setLastServerTime(result.serverTime);
    lastHasMore = result.hasMore;
  }

  // Let the UI refresh if remote data changed local state.
  if (applied > 0 && typeof window !== "undefined") {
    window.dispatchEvent(new Event(SYNC_APPLIED_EVENT));
  }

  return { pushed, applied };
}

/**
 * "Erase all data" while signed in: wipe the cloud copy too, not just the
 * device. Tombstone every syncable record + the sobriety setting, push the
 * tombstones so the account is emptied, then hard-clear locally. If the push
 * cannot complete (offline), the tombstones stay queued and run on reconnect
 * while the device is cleared of all device-local data immediately.
 */
export async function eraseAccountAndLocalData(userId: string): Promise<void> {
  // If this user's data is not yet the materialized local copy (e.g. they just
  // signed in on a browser still holding another account's data), reconcile
  // first. Otherwise the account-switch clear inside runSync would drop the
  // tombstones we are about to create and this account's cloud would never be
  // wiped.
  if ((await getLastSyncedUserId()) !== userId) {
    try {
      await runSync(userId);
    } catch {
      // Offline and unable to materialize this account — we cannot reconcile or
      // wipe a cloud we have never reached. Clear device-local data only; the
      // cloud wipe must be retried once online.
      await clearDeviceLocalData();
      return;
    }
  }
  // lastSyncedUserId === userId now, so the tombstones below survive runSync.
  await eraseSyncableDataWithTombstones();
  try {
    await runSync(userId);
    await clearAllData();
  } catch {
    // Offline: keep tombstones queued so the cloud wipe runs on reconnect.
    await clearDeviceLocalData();
  }
}
