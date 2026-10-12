import { TOOL_IDS, type RecoveryToolId } from "./recoveryFeatures";
import { getBalanceEpoch } from "./balanceEpoch";

export interface BalanceRatings { mood: number | null; emotionalIntensity: number | null; craving: number | null }
export interface BalanceActivity { kind: "tool" | "custom"; label: string; toolId?: RecoveryToolId }
export interface BalanceSource { kind: "daily" | "craving" | "quick-registration" | "tool"; recordId: string | null }
export interface DailyBalanceRecord extends BalanceRatings {
  id: string; recordType: "daily-balance"; date: string; timestamp: number; updatedAt: number; storageEpoch?: string; instanceId?: string;
  mainSleep: number | null; additionalSleep: number | null; cravingScale: 3 | 10;
  drive: number | null; fatigue: number | null; enjoyment: number | null;
  use: "none" | "occurred" | "prefer-not" | null; significantChange: boolean | null;
  changeNote: string; supportedBy: string; note: string;
  provenance?: { app: "moodtracker"; sourceId: string; importedAt: number };
}
export interface BalanceMomentRecord {
  id: string; recordType: "balance-moment"; date: string; timestamp: number; updatedAt: number; storageEpoch?: string; instanceId?: string;
  before: BalanceRatings; after: BalanceRatings | null; afterAt: number | null;
  activity: BalanceActivity | null; attempted: boolean | null; status: "open" | "completed" | "skipped";
  source: BalanceSource; note: string;
}
export type BalanceRecord = DailyBalanceRecord | BalanceMomentRecord;
export const EMPTY_BALANCE_RATINGS: BalanceRatings = { mood: null, emotionalIntensity: null, craving: null };
export const DAILY_MOOD_LABELS = { en: ["Very low", "Low", "Okay", "Good", "Very good"], nl: ["Erg laag", "Laag", "Oké", "Goed", "Erg goed"] } as const;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const keys = (value: Record<string, unknown>, fields: string[]) => Object.keys(value).every(key => fields.includes(key));
export const balanceTimestamp = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 8_640_000_000_000_000;
export const balanceText = (value: unknown, max = 4000): value is string => typeof value === "string" && value.length <= max;
export const balanceScore = (value: unknown, min: number, max: number) => value === null || (typeof value === "number" && Number.isInteger(value) && value >= min && value <= max);
export function validBalanceDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function localBalanceDate(timestamp = Date.now()): string {
  const date = new Date(timestamp);
  return `${date.getFullYear().toString().padStart(4, "0")}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`;
}
export const dailyBalanceId = (date: string) => `daily-balance:${date}`;
export function isBalanceRatings(value: unknown, cravingScale = 10): value is BalanceRatings {
  return object(value) && keys(value, ["mood", "emotionalIntensity", "craving"]) && balanceScore(value.mood, -2, 2)
    && balanceScore(value.emotionalIntensity, 0, 100) && balanceScore(value.craving, 0, cravingScale);
}
export function isBalanceActivity(value: unknown): value is BalanceActivity {
  return object(value) && keys(value, ["kind", "label", "toolId"]) && balanceText(value.label, 500) && !!value.label.trim()
    && (value.kind === "custom" ? value.toolId === undefined : value.kind === "tool" && TOOL_IDS.includes(value.toolId as RecoveryToolId));
}
export function isBalanceSource(value: unknown): value is BalanceSource {
  return object(value) && keys(value, ["kind", "recordId"]) && ["daily", "craving", "quick-registration", "tool"].includes(String(value.kind))
    && (value.recordId === null || (balanceText(value.recordId, 200) && !!value.recordId.trim()));
}
export function isDailyBalanceRecord(value: unknown): value is DailyBalanceRecord {
  if (!object(value) || !keys(value, ["id", "recordType", "date", "timestamp", "updatedAt", "storageEpoch", "instanceId", "mainSleep", "additionalSleep", "mood", "emotionalIntensity", "craving", "cravingScale", "drive", "fatigue", "enjoyment", "use", "significantChange", "changeNote", "supportedBy", "note", "provenance"])) return false;
  return value.recordType === "daily-balance" && validBalanceDate(value.date) && value.id === dailyBalanceId(value.date)
    && balanceTimestamp(value.timestamp) && balanceTimestamp(value.updatedAt)
    && (value.storageEpoch === undefined || (balanceText(value.storageEpoch, 200) && !!value.storageEpoch))
    && (value.instanceId === undefined || (balanceText(value.instanceId, 200) && !!value.instanceId))
    && balanceScore(value.mainSleep, 0, 1440) && balanceScore(value.additionalSleep, 0, 1440)
    && (value.cravingScale === 3 || value.cravingScale === 10)
    && isBalanceRatings({ mood: value.mood, emotionalIntensity: value.emotionalIntensity, craving: value.craving }, value.cravingScale)
    && balanceScore(value.drive, -2, 2) && balanceScore(value.fatigue, 0, 3) && balanceScore(value.enjoyment, 0, 3)
    && [null, "none", "occurred", "prefer-not"].includes(value.use as null) && [null, true, false].includes(value.significantChange as null)
    && [value.changeNote, value.supportedBy, value.note].every(text => balanceText(text))
    && (value.provenance === undefined || (object(value.provenance) && keys(value.provenance, ["app", "sourceId", "importedAt"]) && value.provenance.app === "moodtracker" && balanceText(value.provenance.sourceId, 200) && !!value.provenance.sourceId.trim() && balanceTimestamp(value.provenance.importedAt)));
}
export function isBalanceMomentRecord(value: unknown): value is BalanceMomentRecord {
  if (!object(value) || !keys(value, ["id", "recordType", "date", "timestamp", "updatedAt", "storageEpoch", "instanceId", "before", "after", "afterAt", "activity", "attempted", "status", "source", "note"])) return false;
  return value.recordType === "balance-moment" && balanceText(value.id, 200) && !!value.id.trim() && value.id !== "new"
    && validBalanceDate(value.date) && balanceTimestamp(value.timestamp) && balanceTimestamp(value.updatedAt)
    && (value.storageEpoch === undefined || (balanceText(value.storageEpoch, 200) && !!value.storageEpoch))
    && (value.instanceId === undefined || (balanceText(value.instanceId, 200) && !!value.instanceId))
    && isBalanceRatings(value.before) && (value.after === null || isBalanceRatings(value.after))
    && (value.afterAt === null || (balanceTimestamp(value.afterAt) && value.afterAt >= value.timestamp))
    && (value.activity === null || isBalanceActivity(value.activity)) && [null, true, false].includes(value.attempted as null)
    && ["open", "completed", "skipped"].includes(String(value.status)) && isBalanceSource(value.source) && balanceText(value.note)
    && (value.status === "completed" ? value.after !== null && value.afterAt !== null
      : value.status === "open" ? value.after === null && value.afterAt === null
        : (value.after === null) === (value.afterAt === null));
}
export function emptyDailyBalance(date: string): DailyBalanceRecord {
  const timestamp = Date.now();
  return { id: dailyBalanceId(date), recordType: "daily-balance", date, timestamp, updatedAt: timestamp, storageEpoch: getBalanceEpoch(), instanceId: crypto.randomUUID(), ...EMPTY_BALANCE_RATINGS,
    mainSleep: null, additionalSleep: null, cravingScale: 10, drive: null, fatigue: null, enjoyment: null,
    use: null, significantChange: null, changeNote: "", supportedBy: "", note: "" };
}
export function emptyBalanceMoment(date = localBalanceDate(), source: BalanceSource = { kind: "daily", recordId: null }): BalanceMomentRecord {
  const timestamp = Date.now();
  return { id: crypto.randomUUID(), recordType: "balance-moment", date, timestamp, updatedAt: timestamp, storageEpoch: getBalanceEpoch(), instanceId: crypto.randomUUID(), before: { ...EMPTY_BALANCE_RATINGS },
    after: null, afterAt: null, activity: null, attempted: null, status: "open", source, note: "" };
}
/** Only answered, paired measurements contribute; a change is an observation, not a tool efficacy claim. */
export function pairedBalanceChange(moment: BalanceMomentRecord, field: keyof BalanceRatings): number | null {
  const before = moment.before[field], after = moment.after?.[field];
  return moment.status !== "open" && before !== null && after !== null && after !== undefined ? after - before : null;
}
