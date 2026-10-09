import { getDB } from "./schema";
import { isUsePeriodRecord, localDateString, usePeriodsOverlap, type UsePeriodRecord } from "@/lib/usePeriods";
import { flushLocalDrafts, isValidLocalDraftEnvelope, pendingDraftValues } from "@/lib/localDrafts";

const deletionKey = (id: string) => `use-period-deleted:${id}`;

export class UsePeriodConflictError extends Error {
  constructor() {
    super("This use period changed or was deleted in another window. Your draft has been kept.");
    this.name = "UsePeriodConflictError";
  }
}

export class UsePeriodOverlapError extends Error {
  constructor(public readonly existingId: string) {
    super("This target already has a use period covering one of these days. Edit that period instead.");
    this.name = "UsePeriodOverlapError";
  }
}

/** Comparison, overlap check and write share a transaction, including between tabs. */
export async function commitUsePeriodRecord(record: UsePeriodRecord, expectedUpdatedAt: number | null): Promise<UsePeriodRecord> {
  if (!isUsePeriodRecord(record)) throw new Error("Invalid use period.");
  if (record.endDate > localDateString()) throw new Error("A use period cannot include future days.");
  const db = await getDB();
  const tx = db.transaction(["featureRecords", "syncMeta"], "readwrite");
  void tx.done.catch(() => undefined);
  try {
    const records = tx.objectStore("featureRecords");
    const current = await records.get(record.id);
    const deleted = await tx.objectStore("syncMeta").get(deletionKey(record.id));
    if (!current && deleted) throw new UsePeriodConflictError();
    if (current && !isUsePeriodRecord(current)) throw new UsePeriodConflictError();
    const same = current?.recordType === "use-period"
      && current.timestamp === record.timestamp && current.target === record.target
      && current.startDate === record.startDate && current.endDate === record.endDate
      && current.frequency === record.frequency && current.note === record.note;
    if (same) {
      await tx.done;
      return current as UsePeriodRecord;
    }
    if ((current?.updatedAt ?? null) !== expectedUpdatedAt
      || (current && (current.recordType !== "use-period" || current.timestamp !== record.timestamp))) {
      throw new UsePeriodConflictError();
    }
    const all = await records.getAll();
    const overlap = all.find(candidate => isUsePeriodRecord(candidate) && usePeriodsOverlap(record, candidate));
    if (overlap) throw new UsePeriodOverlapError(overlap.id);
    const updatedAt = Math.max(Date.now(), (current?.updatedAt ?? 0) + 1);
    if (updatedAt > 8_640_000_000_000_000) throw new Error("This period's revision cannot be advanced safely.");
    const saved: UsePeriodRecord = { ...record, updatedAt };
    await records.put(saved);
    await tx.done;
    return saved;
  } catch (error) {
    try { tx.abort(); } catch { /* already closed */ }
    await tx.done.catch(() => undefined);
    throw error;
  }
}

function draftId(raw: string | number | boolean | undefined): string | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const envelope: unknown = JSON.parse(raw);
    if (!isValidLocalDraftEnvelope(envelope)) return null;
    const value = envelope.value;
    return value && typeof value === "object" && "id" in value && typeof value.id === "string" ? value.id : null;
  } catch { return null; }
}

export async function removeUsePeriodRecord(record: UsePeriodRecord): Promise<void> {
  if (!isUsePeriodRecord(record)) throw new Error("Invalid use period.");
  await flushLocalDrafts();
  const db = await getDB();
  const tx = db.transaction(["featureRecords", "settings", "syncMeta"], "readwrite");
  void tx.done.catch(() => undefined);
  const erasedDraftKeys = [`use-period:${encodeURIComponent(record.id)}`];
  try {
    const records = tx.objectStore("featureRecords");
    const settings = tx.objectStore("settings");
    const metadata = tx.objectStore("syncMeta");
    const current = await records.get(record.id);
    if (current && (current.updatedAt !== record.updatedAt || current.recordType !== "use-period" || current.timestamp !== record.timestamp)) {
      throw new UsePeriodConflictError();
    }
    const creating = await settings.get("draft:use-period:new");
    if (draftId(creating?.value) === record.id) erasedDraftKeys.push("use-period:new");
    await records.delete(record.id);
    for (const key of erasedDraftKeys) await settings.delete(`draft:${key}`);
    // Content-free local marker prevents an old open form from reviving a deletion.
    await metadata.put({ key: deletionKey(record.id), value: record.timestamp });
    await tx.done;
  } catch (error) {
    try { tx.abort(); } catch { /* already closed */ }
    await tx.done.catch(() => undefined);
    throw error;
  }
  for (const key of erasedDraftKeys) pendingDraftValues.delete(key);
}
