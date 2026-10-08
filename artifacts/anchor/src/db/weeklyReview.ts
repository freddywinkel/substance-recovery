import { getDB } from "./schema";
import { MAX_SUPPORTED_TIMESTAMP, parseFeatureRecord, type WeeklyReviewRecord } from "@/lib/recoveryFeatures";
import { flushLocalDrafts, isValidLocalDraftEnvelope, pendingDraftValues } from "@/lib/localDrafts";

const deletionKey = (id: string) => `weekly-review-deleted:${id}`;

export class WeeklyReviewConflictError extends Error {
  constructor() {
    super("This weekly review changed or was deleted in another window. Your draft has been kept.");
    this.name = "WeeklyReviewConflictError";
  }
}

const contentFields = [
  "id", "recordType", "timestamp", "periodStart", "periodEnd", "chosenPattern",
  "nextWeekPlan", "patternKind", "patternValue", "patternCount", "patternDenominator",
  "planRevisionAt", "linkedGoalId", "reviewedEntryIds", "rememberFromWeek",
  "choseForMyself", "makeRoomForNextWeek", "pleasantActivity",
] as const;

function sameContent(left: WeeklyReviewRecord, right: WeeklyReviewRecord): boolean {
  return contentFields.every(field => JSON.stringify(left[field]) === JSON.stringify(right[field]));
}

/** One period has one identity. The comparison and write share one transaction. */
export async function commitWeeklyReviewRecord(
  record: WeeklyReviewRecord,
  expectedUpdatedAt: number | null,
): Promise<WeeklyReviewRecord> {
  const parsed = parseFeatureRecord(record);
  if (!parsed || parsed.recordType !== "weekly-review") throw new Error("Invalid weekly review.");
  const db = await getDB();
  const tx = db.transaction(["featureRecords", "syncMeta"], "readwrite");
  void tx.done.catch(() => undefined);
  try {
    const records = tx.objectStore("featureRecords");
    const current = await records.get(record.id);
    const deleted = await tx.objectStore("syncMeta").get(deletionKey(record.id));
    if (!current && deleted) throw new WeeklyReviewConflictError();
    if (current && (
      current.recordType !== "weekly-review" || current.timestamp !== record.timestamp ||
      current.periodStart !== record.periodStart || current.periodEnd !== record.periodEnd
    )) throw new WeeklyReviewConflictError();
    // Do not duplicate a successful first save when only draft cleanup failed.
    if (current?.recordType === "weekly-review" && sameContent(current, record)) {
      await tx.done;
      return current;
    }
    if ((current?.updatedAt ?? null) !== expectedUpdatedAt) throw new WeeklyReviewConflictError();
    // Legacy duplicates remain readable/editable, but a new identity cannot add another.
    if (!current) {
      const existing = await records.index("byRecordType").getAll("weekly-review");
      if (existing.some(item => item.recordType === "weekly-review" &&
        item.periodStart === record.periodStart && item.periodEnd === record.periodEnd)) {
        throw new WeeklyReviewConflictError();
      }
    }
    const updatedAt = Math.max(Date.now(), (current?.updatedAt ?? 0) + 1);
    if (updatedAt > MAX_SUPPORTED_TIMESTAMP) throw new Error("This review's revision cannot be advanced safely.");
    const saved = { ...record, updatedAt };
    await records.put(saved);
    await tx.done;
    return saved;
  } catch (error) {
    try { tx.abort(); } catch { /* already closed */ }
    await tx.done.catch(() => undefined);
    throw error;
  }
}

function belongsToReview(value: unknown, recordId: string): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return true;
  const draft = value as Record<string, unknown>;
  // Existing legacy drafts had no record identity and belong to this period.
  return draft.recordId === undefined || draft.recordId === recordId;
}

/** Erase private draft text with the record, retaining only a content-free identity marker. */
export async function removeWeeklyReviewRecord(record: WeeklyReviewRecord): Promise<void> {
  await flushLocalDrafts();
  const db = await getDB();
  const tx = db.transaction(["featureRecords", "settings", "syncMeta"], "readwrite");
  void tx.done.catch(() => undefined);
  const draftKey = `weekly-review:${record.periodStart}`;
  let erasedDraft = false;
  try {
    const records = tx.objectStore("featureRecords");
    const current = await records.get(record.id);
    if (current && (current.recordType !== "weekly-review" || current.updatedAt !== record.updatedAt || current.timestamp !== record.timestamp ||
      current.periodStart !== record.periodStart || current.periodEnd !== record.periodEnd)) {
      throw new WeeklyReviewConflictError();
    }
    const settings = tx.objectStore("settings");
    const raw = (await settings.get(`draft:${draftKey}`))?.value;
    let draft: unknown;
    if (typeof raw === "string" && raw) {
      try {
        const envelope: unknown = JSON.parse(raw);
        if (isValidLocalDraftEnvelope(envelope)) draft = envelope.value;
      } catch { /* Invalid legacy draft text is erased with its period. */ }
    }
    if (belongsToReview(draft, record.id)) {
      await settings.delete(`draft:${draftKey}`);
      erasedDraft = true;
    }
    await records.delete(record.id);
    await tx.objectStore("syncMeta").put({ key: deletionKey(record.id), value: record.timestamp });
    await tx.done;
  } catch (error) {
    try { tx.abort(); } catch { /* already closed */ }
    await tx.done.catch(() => undefined);
    throw error;
  }
  if (erasedDraft && belongsToReview(pendingDraftValues.get(draftKey), record.id)) pendingDraftValues.delete(draftKey);
}
