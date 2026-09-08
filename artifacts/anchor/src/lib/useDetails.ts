import { isKnownRecoveryTarget, recoveryTargetLabel } from "./recoveryTargets";

/** Optional self-report, never a dose calculation or an automated severity assessment. */
export interface UseDetail {
  target: string;
  substanceName: string;
  amount: string;
  unit: string;
  amountStatus: "unanswered" | "approximate" | "unknown" | "prefer-not";
  route: string;
  /** Person-entered local occurrence time, distinct from registration/edit time. */
  occurredAt: string;
  prescribedUse: "unanswered" | "as-prescribed" | "outside-prescription" | "not-applicable" | "unknown";
}
export function blankUseDetail(target: string): UseDetail {
  return { target, substanceName: "", amount: "", unit: "", amountStatus: "unanswered", route: "", occurredAt: "", prescribedUse: "unanswered" };
}
export function isValidUseDetails(value: unknown): value is UseDetail[] {
  if (!Array.isArray(value) || value.length > 30) return false;
  const targets = new Set<string>();
  return value.every((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const v = item as Record<string, unknown>;
    if (Object.keys(v).some(key => !["target", "substanceName", "amount", "unit", "amountStatus", "route", "occurredAt", "prescribedUse"].includes(key))) return false;
    if (!["target", "substanceName", "amount", "unit", "route", "occurredAt"].every(k => typeof v[k] === "string" && (v[k] as string).length <= 500)) return false;
    if (!isKnownRecoveryTarget(v.target as string) || targets.has(v.target as string)) return false;
    targets.add(v.target as string);
    if (!["unanswered", "approximate", "unknown", "prefer-not"].includes(v.amountStatus as string)) return false;
    if (!["unanswered", "as-prescribed", "outside-prescription", "not-applicable", "unknown"].includes(v.prescribedUse as string)) return false;
    if (v.amountStatus !== "approximate" && (v.amount !== "" || v.unit !== "")) return false;
    return v.occurredAt === "" || (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v.occurredAt as string) && Number.isFinite(new Date(v.occurredAt as string).getTime()));
  });
}
export function selectedUseDetails(value: UseDetail[] | undefined, targets: readonly string[]): UseDetail[] {
  return (value ?? []).filter(item => targets.includes(item.target));
}
/** Canonical answer encoding stays compatible with registration-v3 primitive answer values. */
export function encodeUseDetails(value: UseDetail[] | undefined): string | null {
  return value?.length ? JSON.stringify(value) : null;
}
export function decodeUseDetails(value: unknown): UseDetail[] | null {
  if (value === null || value === undefined) return [];
  if (typeof value !== "string") return null;
  try { const parsed: unknown = JSON.parse(value); return isValidUseDetails(parsed) ? parsed : null; } catch { return null; }
}
export function useDetailsForRecord(record: { useDetails?: UseDetail[]; answers?: Record<string, unknown> }): UseDetail[] {
  if (record.answers && Object.prototype.hasOwnProperty.call(record.answers, "useDetailsJson")) return decodeUseDetails(record.answers.useDetailsJson) ?? [];
  return isValidUseDetails(record.useDetails) ? record.useDetails : [];
}
export function describeUseDetail(item: UseDetail, language: "en" | "nl"): string {
  const nl = language === "nl";
  const status = item.amountStatus === "unknown" ? (nl ? "hoeveelheid onbekend" : "amount unknown") : item.amountStatus === "prefer-not" ? (nl ? "hoeveelheid niet gedeeld" : "amount not shared") : item.amountStatus === "approximate" ? `${nl ? "ongeveer" : "approximately"} ${item.amount || "?"} ${item.unit}`.trim() : "";
  const prescribed = item.prescribedUse === "as-prescribed" ? (nl ? "volgens voorschrift" : "as prescribed") : item.prescribedUse === "outside-prescription" ? (nl ? "buiten voorschrift" : "outside prescription") : "";
  return [recoveryTargetLabel(item.target, language), item.substanceName, status, item.route, item.occurredAt, prescribed].filter(Boolean).join(" · ");
}
