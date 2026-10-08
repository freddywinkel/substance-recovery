import { getDB } from "./schema";
import { parseFeatureRecord } from "@/lib/recoveryFeatures";
import type { PersonalGrowthRecord } from "@/lib/personalGrowth";
import { flushLocalDrafts, isValidLocalDraftEnvelope, pendingDraftValues } from "@/lib/localDrafts";

const deletionKey = (id: string) => `personal-growth-deleted:${id}`;

function draftValue(raw: string | number | boolean | undefined): Record<string, unknown> | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const envelope: unknown = JSON.parse(raw);
    if (!isValidLocalDraftEnvelope(envelope)) return null;
    const value = envelope.value;
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

export class PersonalGrowthConflictError extends Error {
  constructor() {
    super(
      "This record changed or was deleted in another window. Your draft has been kept.",
    );
  }
}

/** Compare-and-write prevents an old draft from replacing newer data or reviving a deletion. */
export async function commitPersonalGrowthRecord<
  T extends PersonalGrowthRecord,
>(record: T, expectedUpdatedAt: number | null): Promise<T> {
  const parsed = parseFeatureRecord(record);
  if (
    !parsed ||
    !["growth-moment", "compassion-note"].includes(parsed.recordType)
  )
    throw new Error("Invalid personal growth record.");
  const db = await getDB();
  const tx = db.transaction(["featureRecords", "syncMeta"], "readwrite");
  void tx.done.catch(() => undefined);
  const records = tx.objectStore("featureRecords");
  const current = await records.get(record.id);
  const deleted = await tx.objectStore("syncMeta").get(deletionKey(record.id));
  // A first-save draft still has a null source revision after failed cleanup.
  // Its identity must not become new again merely because another tab deleted it.
  // The fixed compassion-note ID can be deliberately reused with a fresh creation time.
  if (!current && deleted && (
    record.recordType === "growth-moment"
    || typeof deleted.value !== "number"
    || record.timestamp <= deleted.value
  )) {
    await tx.done;
    throw new PersonalGrowthConflictError();
  }
  // A retry after a committed write and failed draft cleanup is idempotent.
  const same =
    current?.recordType === record.recordType &&
    current.timestamp === record.timestamp &&
    (record.recordType === "growth-moment"
      ? current.recordType === "growth-moment" &&
        current.note === record.note &&
        current.category === record.category &&
        current.favourite === record.favourite
      : current.recordType === "compassion-note" &&
        current.text === record.text);
  if (same) {
    await tx.done;
    return current as T;
  }
  if (
    (current?.updatedAt ?? null) !== expectedUpdatedAt ||
    (current && current.recordType !== record.recordType)
  ) {
    await tx.done;
    throw new PersonalGrowthConflictError();
  }
  const saved = {
    ...record,
    updatedAt: Math.max(Date.now(), (current?.updatedAt ?? 0) + 1),
  };
  await records.put(saved);
  await tx.done;
  return saved;
}

export async function removePersonalGrowthRecord(
  record: PersonalGrowthRecord,
): Promise<void> {
  await flushLocalDrafts();
  const db = await getDB();
  const tx = db.transaction(["featureRecords", "settings", "syncMeta"], "readwrite");
  void tx.done.catch(() => undefined);
  const records = tx.objectStore("featureRecords");
  const settings = tx.objectStore("settings");
  const metadata = tx.objectStore("syncMeta");
  const erasedDraftKeys: string[] = [];
  try {
    const current = await records.get(record.id);
    if (current && (current.updatedAt !== record.updatedAt || current.recordType !== record.recordType)) {
      throw new PersonalGrowthConflictError();
    }
    if (record.recordType === "growth-moment") {
      erasedDraftKeys.push(`growth-moment:${encodeURIComponent(record.id)}`);
      const creating = await settings.get("draft:growth-moment:new");
      if (draftValue(creating?.value)?.id === record.id) erasedDraftKeys.push("growth-moment:new");
    } else {
      const stored = await settings.get("draft:compassion-note");
      const value = draftValue(stored?.value);
      // Do not erase a separately started, newer generation of personal words.
      if (!value || typeof value.timestamp !== "number" || value.timestamp <= record.timestamp) {
        erasedDraftKeys.push("compassion-note");
      }
    }
    const previous = await metadata.get(deletionKey(record.id));
    await records.delete(record.id);
    for (const key of erasedDraftKeys) await settings.delete(`draft:${key}`);
    // Only identity and creation time are retained. No personal text is kept or exported.
    await metadata.put({ key: deletionKey(record.id), value: Math.max(record.timestamp, typeof previous?.value === "number" ? previous.value : 0) });
    await tx.done;
  } catch (error) {
    try { tx.abort(); } catch { /* already closed */ }
    await tx.done.catch(() => undefined);
    throw error;
  }
  for (const key of erasedDraftKeys) pendingDraftValues.delete(key);
}
