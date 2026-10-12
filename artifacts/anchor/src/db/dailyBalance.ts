import { getDB } from "./schema";
import { emptyBalanceMoment, emptyDailyBalance, isBalanceMomentRecord, isDailyBalanceRecord, localBalanceDate, type BalanceActivity, type BalanceRatings, type BalanceRecord, type BalanceSource, type DailyBalanceRecord, type BalanceMomentRecord } from "@/lib/dailyBalance";
import { dailyDraftFromRecord, isDailyBalanceDraft, isBalanceMomentDraft, type DailyBalanceDraft } from "@/lib/dailyBalanceDraft";
import { flushLocalDrafts, isValidLocalDraftEnvelope, pendingDraftValues } from "@/lib/localDrafts";
import { validateBackup, type Backup } from "@/lib/moodTrackerBackup";
import { BALANCE_EPOCH_KEY, INITIAL_BALANCE_EPOCH, setBalanceEpoch } from "@/lib/balanceEpoch";

export const BALANCE_RESET_KEY = "daily-balance-reset-at";
/** Explicit reload acknowledges a reset from another window for newly opened forms. */
export async function refreshBalanceEpoch(): Promise<void> {
  const epoch = await (await getDB()).get("syncMeta", BALANCE_EPOCH_KEY);
  setBalanceEpoch(typeof epoch?.value === "string" ? epoch.value : INITIAL_BALANCE_EPOCH);
}
export async function getDailyBalanceDraftDates(): Promise<string[]> {
  const settings = await (await getDB()).getAll("settings");
  return settings.flatMap(setting => {
    if (!setting.key.startsWith("draft:daily-balance:") || typeof setting.value !== "string" || !setting.value) return [];
    try {
      const envelope: unknown = JSON.parse(setting.value);
      return isValidLocalDraftEnvelope(envelope) && isDailyBalanceDraft(envelope.value) && setting.key === `draft:daily-balance:${envelope.value.record.date}`
        ? [envelope.value.record.date] : [];
    } catch { return []; }
  }).sort().reverse();
}
export const balanceDeletionKey = (id: string, instanceId?: string) => `daily-balance-deleted:${id}${instanceId ? `:${instanceId}` : ""}`;
export class BalanceConflictError extends Error {
  constructor() { super("This check-in changed, was deleted, or your data was replaced in another window. Reload before saving; your input has been kept."); this.name = "BalanceConflictError"; }
}
const sameContent = (left: BalanceRecord, right: BalanceRecord) => JSON.stringify({ ...left, updatedAt: 0 }) === JSON.stringify({ ...right, updatedAt: 0 });
const valid = (record: unknown): record is BalanceRecord => isDailyBalanceRecord(record) || isBalanceMomentRecord(record);

export async function commitBalanceRecord<T extends BalanceRecord>(record: T, expectedUpdatedAt: number | null): Promise<T> {
  if (!valid(record)) throw new Error("Invalid daily check-in or activity moment.");
  if (record.date > localBalanceDate()) throw new Error("Choose today or a previous day.");
  const db = await getDB();
  const tx = db.transaction(["featureRecords", "syncMeta"], "readwrite");
  void tx.done.catch(() => undefined);
  try {
    const store = tx.objectStore("featureRecords"), meta = tx.objectStore("syncMeta");
    const current = await store.get(record.id);
    const deleted = await meta.get(balanceDeletionKey(record.id, record.instanceId));
    const epoch = (await meta.get(BALANCE_EPOCH_KEY))?.value ?? INITIAL_BALANCE_EPOCH;
    if ((record.storageEpoch ?? INITIAL_BALANCE_EPOCH) !== epoch) throw new BalanceConflictError();
    if (!current && deleted && (typeof deleted.value === "string" ? deleted.value === record.instanceId : record.timestamp <= deleted.value)) throw new BalanceConflictError();
    if (current && (!valid(current) || current.recordType !== record.recordType || current.timestamp !== record.timestamp || current.instanceId !== record.instanceId)) throw new BalanceConflictError();
    // Retrying after a successful commit but interrupted UI acknowledgement is harmless.
    if (current && valid(current) && sameContent(current, record)) { await tx.done; return current as T; }
    if ((current?.updatedAt ?? null) !== expectedUpdatedAt) throw new BalanceConflictError();
    const saved = { ...record, updatedAt: Math.max(Date.now(), (current?.updatedAt ?? 0) + 1) };
    await store.put(saved);
    await tx.done;
    return saved;
  } catch (error) { try { tx.abort(); } catch { /* already closed */ } await tx.done.catch(() => undefined); throw error; }
}
export const commitDailyBalanceRecord = (record: DailyBalanceRecord, expectedUpdatedAt: number | null) => commitBalanceRecord(record, expectedUpdatedAt);
export const commitBalanceMomentRecord = (record: BalanceMomentRecord, expectedUpdatedAt: number | null) => commitBalanceRecord(record, expectedUpdatedAt);
export interface StartBalanceMomentInput { date?: string; source: BalanceSource; before?: BalanceRatings; activity?: BalanceActivity }
export async function startBalanceMomentRecord(input: StartBalanceMomentInput): Promise<BalanceMomentRecord> {
  const db = await getDB();
  const record = emptyBalanceMoment(input.date ?? localBalanceDate(), input.source);
  if (input.before) record.before = input.before;
  if (input.activity) record.activity = input.activity;
  if (!isBalanceMomentRecord(record) || record.date > localBalanceDate()) throw new Error("Invalid activity moment.");
  const tx = db.transaction(["featureRecords", "syncMeta"], "readwrite");
  void tx.done.catch(() => undefined);
  try {
    if (input.source.recordId !== null) {
      const existing = (await tx.objectStore("featureRecords").index("byRecordType").getAll("balance-moment")).find(item => isBalanceMomentRecord(item) && item.source.kind === input.source.kind && item.source.recordId === input.source.recordId);
      if (existing && isBalanceMomentRecord(existing)) { await tx.done; return existing; }
    }
    record.storageEpoch = String((await tx.objectStore("syncMeta").get(BALANCE_EPOCH_KEY))?.value ?? INITIAL_BALANCE_EPOCH);
    await tx.objectStore("featureRecords").put(record); await tx.done; return record;
  } catch (error) { try { tx.abort(); } catch { /* already closed */ } await tx.done.catch(() => undefined); throw error; }
}
export async function removeBalanceRecord(record: BalanceRecord): Promise<void> {
  if (!valid(record)) throw new Error("Invalid balance record.");
  await flushLocalDrafts();
  const db = await getDB();
  const tx = db.transaction(["featureRecords", "settings", "syncMeta"], "readwrite");
  void tx.done.catch(() => undefined);
  const erased: string[] = [];
  try {
    const current = await tx.objectStore("featureRecords").get(record.id);
    const epoch = (await tx.objectStore("syncMeta").get(BALANCE_EPOCH_KEY))?.value ?? INITIAL_BALANCE_EPOCH;
    if ((record.storageEpoch ?? INITIAL_BALANCE_EPOCH) !== epoch) throw new BalanceConflictError();
    if (!current || current.updatedAt !== record.updatedAt || !valid(current) || current.instanceId !== record.instanceId) throw new BalanceConflictError();
    await tx.objectStore("featureRecords").delete(record.id);
    for (const setting of await tx.objectStore("settings").getAll()) {
      if (!/^draft:(daily-balance|balance-moment):/.test(setting.key) || typeof setting.value !== "string" || !setting.value) continue;
      const parsed: unknown = JSON.parse(setting.value);
      if (isValidLocalDraftEnvelope(parsed) && (isDailyBalanceDraft(parsed.value) || isBalanceMomentDraft(parsed.value)) && parsed.value.record.id === record.id) {
        await tx.objectStore("settings").delete(setting.key); erased.push(setting.key.slice(6));
      }
    }
    await tx.objectStore("syncMeta").put({ key: balanceDeletionKey(record.id, record.instanceId), value: record.instanceId ?? Date.now() });
    await tx.done;
  } catch (error) { try { tx.abort(); } catch { /* already closed */ } await tx.done.catch(() => undefined); throw error; }
  erased.forEach(key => pendingDraftValues.delete(key));
}

export interface MoodTrackerPreview { entries: number; drafts: number; newDays: number; conflicts: number; dates: string[] }
function convertBackup(backup: Backup, importedAt: number) {
  const records = backup.entries.map(entry => {
    const { id, date, createdAt, updatedAt, revision: _revision, scaleVersion: _scaleVersion, ...content } = entry;
    const record: DailyBalanceRecord = { ...emptyDailyBalance(date), ...content, timestamp: Date.parse(createdAt), updatedAt: Date.parse(updatedAt), cravingScale: 3,
      provenance: { app: "moodtracker", sourceId: id, importedAt } };
    if (!isDailyBalanceRecord(record)) throw new Error("Invalid MoodTracker daily entry.");
    return record;
  });
  const drafts = backup.drafts.map(draft => {
    const { date, mainHours, mainMinutes, additionalHours, additionalMinutes, ...content } = draft.form;
    const current = records.find(record => record.date === date);
    const base = current ?? { ...emptyDailyBalance(date), cravingScale: 3 as const, provenance: { app: "moodtracker" as const, sourceId: `draft:${date}`, importedAt } };
    const value: DailyBalanceDraft = { ...dailyDraftFromRecord(base, current?.updatedAt ?? null), record: { ...base, ...content }, mainHours, mainMinutes, additionalHours, additionalMinutes };
    if (!isDailyBalanceDraft(value)) throw new Error("Invalid MoodTracker draft.");
    return value;
  });
  return { records, drafts, dates: [...new Set([...records.map(record => record.date), ...drafts.map(draft => draft.record.date)])].sort() };
}
export async function previewMoodTrackerImport(payload: unknown): Promise<MoodTrackerPreview> {
  const converted = convertBackup(validateBackup(payload), Date.now());
  const db = await getDB();
  const tx = db.transaction(["featureRecords", "settings"], "readonly");
  const records = await tx.objectStore("featureRecords").getAll();
  const settings = await tx.objectStore("settings").getAll();
  await tx.done;
  const occupied = new Set(records.filter(isDailyBalanceRecord).map(record => record.date));
  for (const setting of settings) if (setting.key.startsWith("draft:daily-balance:") && setting.value) occupied.add(setting.key.slice("draft:daily-balance:".length));
  const conflicts = converted.dates.filter(date => occupied.has(date)).length;
  return { entries: converted.records.length, drafts: converted.drafts.length, dates: converted.dates, conflicts, newDays: converted.dates.length - conflicts };
}
/** Dedicated atomic import: only incoming daily records/drafts; Anchor settings and contacts stay authoritative. */
export async function importMoodTrackerBackup(payload: unknown, conflicts: "keep" | "incoming" = "keep"): Promise<{ imported: number; skipped: number }> {
  const now = Date.now();
  const converted = convertBackup(validateBackup(payload), now);
  await flushLocalDrafts();
  const db = await getDB();
  const tx = db.transaction(["featureRecords", "settings", "syncMeta"], "readwrite");
  void tx.done.catch(() => undefined);
  let imported = 0, skipped = 0;
  const importedDates: string[] = [];
  try {
    const records = tx.objectStore("featureRecords"), settings = tx.objectStore("settings");
    const storageEpoch = String((await tx.objectStore("syncMeta").get(BALANCE_EPOCH_KEY))?.value ?? INITIAL_BALANCE_EPOCH);
    for (const date of converted.dates) {
      const incoming = converted.records.find(record => record.date === date);
      const draft = converted.drafts.find(value => value.record.date === date);
      const id = `daily-balance:${date}`, key = `draft:daily-balance:${date}`;
      const current = await records.get(id), oldDraft = await settings.get(key);
      if ((current || oldDraft?.value) && conflicts === "keep") { skipped++; continue; }
      const updatedAt = Math.max(now, (current?.updatedAt ?? 0) + 1);
      const saved = incoming ? { ...incoming, updatedAt, storageEpoch } : null;
      if (saved) await records.put(saved);
      else if (current) await records.delete(id);
      await settings.delete(key);
      if (draft) {
        const previous = oldDraft?.value ? JSON.parse(String(oldDraft.value)) : null;
        const revision = isValidLocalDraftEnvelope(previous) ? previous.revision + 1 : 1;
        const value = { ...draft, record: { ...draft.record, updatedAt, storageEpoch }, sourceUpdatedAt: saved?.updatedAt ?? null };
        await settings.put({ key, value: JSON.stringify({ version: 1, revision, updatedAt: now, clientId: "moodtracker-import", value }) });
      }
      await tx.objectStore("syncMeta").delete(balanceDeletionKey(id, saved?.instanceId ?? draft?.record.instanceId));
      importedDates.push(date);
      imported++;
    }
    await tx.done;
  } catch (error) { try { tx.abort(); } catch { /* already closed */ } await tx.done.catch(() => undefined); throw error; }
  for (const date of importedDates) pendingDraftValues.delete(`daily-balance:${date}`);
  return { imported, skipped };
}
