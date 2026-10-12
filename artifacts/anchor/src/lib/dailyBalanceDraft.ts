import { balanceText, balanceTimestamp, isBalanceMomentRecord, isBalanceRatings, isDailyBalanceRecord, type BalanceMomentRecord, type DailyBalanceRecord } from "./dailyBalance";

export interface DailyBalanceDraft { record: DailyBalanceRecord; mainHours: string; mainMinutes: string; additionalHours: string; additionalMinutes: string; sourceUpdatedAt: number | null }
export interface BalanceMomentDraft { record: BalanceMomentRecord; sourceUpdatedAt: number | null }
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const revision = (value: unknown) => value === null || balanceTimestamp(value);
export function isDailyBalanceDraft(value: unknown): value is DailyBalanceDraft {
  return object(value) && Object.keys(value).every(key => ["record", "mainHours", "mainMinutes", "additionalHours", "additionalMinutes", "sourceUpdatedAt"].includes(key))
    && isDailyBalanceRecord(value.record) && revision(value.sourceUpdatedAt)
    && [value.mainHours, value.mainMinutes, value.additionalHours, value.additionalMinutes].every(part => balanceText(part, 4000));
}
export function isBalanceMomentDraft(value: unknown): value is BalanceMomentDraft {
  if (!object(value) || !Object.keys(value).every(key => ["record", "sourceUpdatedAt"].includes(key)) || !object(value.record) || !revision(value.sourceUpdatedAt)) return false;
  const record = value.record;
  if (record.after !== null && !isBalanceRatings(record.after)) return false;
  if (record.afterAt !== null && (!balanceTimestamp(record.afterAt) || !balanceTimestamp(record.timestamp) || record.afterAt < record.timestamp)) return false;
  // In-progress after answers and a just-selected custom activity belong in the
  // draft. Canonical completion still requires a real label and paired timestamp.
  const activity = object(record.activity) && record.activity.kind === "custom" && balanceText(record.activity.label, 500) && !record.activity.label.trim()
    ? { ...record.activity, label: "draft" } : record.activity;
  return isBalanceMomentRecord({ ...record, activity, ...(record.status === "open" ? { after: null, afterAt: null }
    : record.after !== null && record.afterAt === null ? { afterAt: record.timestamp } : {}) });
}
export function dailyDraftFromRecord(record: DailyBalanceRecord, sourceUpdatedAt: number | null = record.updatedAt): DailyBalanceDraft {
  return { record, sourceUpdatedAt,
    mainHours: record.mainSleep === null ? "" : String(Math.floor(record.mainSleep / 60)), mainMinutes: record.mainSleep === null ? "" : String(record.mainSleep % 60),
    additionalHours: record.additionalSleep === null ? "" : String(Math.floor(record.additionalSleep / 60)), additionalMinutes: record.additionalSleep === null ? "" : String(record.additionalSleep % 60) };
}
export function dailyRecordFromDraft(draft: DailyBalanceDraft): { record: DailyBalanceRecord; errors: string[] } {
  const errors: string[] = [];
  const duration = (hours: string, minutes: string, label: string): number | null => {
    if (hours === "" && minutes === "") return null;
    if (![hours, minutes].every(part => part === "" || /^\d+$/.test(part)) || Number(minutes) > 59 || Number(hours) * 60 + Number(minutes) > 1440) {
      errors.push(`${label}: enter 0–24 hours and 0–59 minutes (at most 24 hours).`); return null;
    }
    return Number(hours) * 60 + Number(minutes);
  };
  const record = { ...draft.record, mainSleep: duration(draft.mainHours, draft.mainMinutes, "Main sleep"), additionalSleep: duration(draft.additionalHours, draft.additionalMinutes, "Additional sleep") };
  if (!isDailyBalanceRecord(record)) errors.push("Check the daily ratings and text.");
  return { record, errors };
}
