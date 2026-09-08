import type { AnxietyLog, BoredomLog, CravingLog, RegistrationAnswerValue, RelapseLog } from "@/db/schema";
import { validateImportedStoreRecord } from "@/db/validation";
import { parseFeatureRecord, REGISTRATION_TYPES, type QuickRegistrationRecord, type RegistrationType } from "./recoveryFeatures";
import { isKnownRecoveryTarget } from "./recoveryTargets";
import { isValidUseDetails, type UseDetail } from "./useDetails";

export type CorrectionDetailedRecord = CravingLog | RelapseLog | AnxietyLog | BoredomLog;
export interface RegistrationCorrectionDraft {
  version: 1;
  entryId: string;
  type: RegistrationType;
  detailed: CorrectionDetailedRecord | null;
  quick: QuickRegistrationRecord | null;
  answers: Record<string, RegistrationAnswerValue>;
  eventTime: string;
  quickValue: QuickRegistrationRecord | null;
  useDetails: UseDetail[];
}
export class RegistrationSourceConflictError extends Error {
  constructor() { super("The saved registration changed or was deleted. Your correction draft is preserved."); this.name = "RegistrationSourceConflictError"; }
}
export class CorrectionDraftCleanupError extends Error {
  constructor() { super("The correction is saved, but its draft could not be cleared. Your input is preserved."); this.name = "CorrectionDraftCleanupError"; }
}

/** Stable full-source comparison also protects legacy records lacking updatedAt. */
export function registrationSourceSignature(value: unknown): string {
  const canonical = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(canonical);
    if (item && typeof item === "object") return Object.fromEntries(Object.entries(item).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => [key, canonical(v)]));
    return item;
  };
  return JSON.stringify(canonical(value)) ?? "undefined";
}
export function correctionSourceRecord<T extends object>(record: T): T {
  const { _type: _viewOnly, ...source } = record as T & { _type?: string };
  return structuredClone(source) as T;
}
export const correctionStore = (type: RegistrationType) => type === "relapse" ? "relapseLogs" : type === "anxiety" ? "anxietyLogs" : type === "boredom" ? "boredomLogs" : "cravingLogs";

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, max: number): value is string => typeof value === "string" && value.length <= max;
const safeNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER;
const editableQuick = ["intensity", "immediateSafety", "target", "useOutcome", "usePrescribed", "chosenAction", "chosenActionOther", "note"];

export function isRegistrationCorrectionDraft(value: unknown): value is RegistrationCorrectionDraft | null {
  if (value === null) return true;
  if (!object(value) || value.version !== 1 || !text(value.entryId, 300) || !value.entryId.trim()
    || typeof value.type !== "string" || !REGISTRATION_TYPES.includes(value.type as RegistrationType)
    || Object.keys(value).some(key => !["version", "entryId", "type", "detailed", "quick", "answers", "eventTime", "quickValue", "useDetails"].includes(key))) return false;
  const type = value.type as RegistrationType;
  if (value.detailed !== null && (!object(value.detailed) || !validateImportedStoreRecord(correctionStore(type), value.detailed).ok)) return false;
  if (value.quick !== null && (!object(value.quick) || value.quick.registrationType !== type || parseFeatureRecord(value.quick)?.recordType !== "quick-registration")) return false;
  if (!value.detailed && !value.quick) return false;
  // Date fields can be blank or future while unfinished. Commit validates them.
  if (!text(value.eventTime, 32) || (value.eventTime !== "" && !/^\d{4,6}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(value.eventTime))) return false;
  if (!object(value.answers) || Object.keys(value.answers).length > 256 || !Object.entries(value.answers).every(([key, answer]) =>
    /^[a-zA-Z][a-zA-Z0-9_]{0,199}$/.test(key) && (answer === null || typeof answer === "boolean" || safeNumber(answer) || text(answer, 128000) || (Array.isArray(answer) && answer.length <= 200 && answer.every(item => text(item, 12000)))))) return false;
  if (!isValidUseDetails(value.useDetails)) return false;
  if (value.quick === null) return value.quickValue === null;
  if (!object(value.quickValue) || !object(value.quick)) return false;
  const current = value.quickValue;
  const immutable = (record: Record<string, unknown>) => Object.fromEntries(Object.entries(record).filter(([key]) => !editableQuick.includes(key)));
  if (registrationSourceSignature(immutable(current)) !== registrationSourceSignature(immutable(value.quick))) return false;
  return (current.intensity === null || safeNumber(current.intensity))
    && typeof current.immediateSafety === "string" && ["safe-for-now", "need-support", "urgent-danger"].includes(current.immediateSafety)
    && (current.target === undefined || current.target === "" || (typeof current.target === "string" && (isKnownRecoveryTarget(current.target) || current.target === value.quick.target)))
    && (current.useOutcome === undefined || (typeof current.useOutcome === "string" && ["used", "not_used", "unsure"].includes(current.useOutcome)))
    && (current.usePrescribed === undefined || typeof current.usePrescribed === "boolean")
    && text(current.chosenAction, 200) && text(current.chosenActionOther, 500) && text(current.note, 2000);
}
