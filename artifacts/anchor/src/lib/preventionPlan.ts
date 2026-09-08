export interface RecoveryGoal {
  id: string;
  target: string;
  type: "abstinence" | "reduction" | "harm-reduction" | "personal";
  description: string;
  startDate: string;
  active: boolean;
  showProgress: boolean;
}

export interface SignalAction {
  id: string;
  signal: string;
  firstAction: string;
  alternative: string;
  contactId: string | null;
  toolId: string | null;
}

export interface PlanRevision {
  revision: number;
  savedAt: number;
  changeReason: string;
  /** Exact previous plan with its history omitted, avoiding recursive snapshots. */
  content: string;
}

export interface PreventionPlan {
  version: 1;
  revision: number;
  goals: RecoveryGoal[];
  signalActions: SignalAction[];
  strengths: string;
  routines: string;
  careAgreements: string;
  medicalPrecautions: string;
  afterUse: string;
  aftercare: string;
  reviewDate: string;
  reviewedWith: string;
  sharingPreferences: string;
  changeReason: string;
  revisions: PlanRevision[];
}

const TEXT_FIELDS = [
  "strengths",
  "routines",
  "careAgreements",
  "medicalPrecautions",
  "afterUse",
  "aftercare",
  "reviewedWith",
  "sharingPreferences",
  "changeReason",
] as const;
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, max = 12000): value is string =>
  typeof value === "string" && value.length <= max;
const id = (value: unknown): value is string =>
  text(value, 200) && value.trim().length > 0;
const date = (value: unknown): value is string => {
  if (value === "") return true;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
};
const unique = (values: { id: string }[]) =>
  new Set(values.map((value) => value.id)).size === values.length;

export function isValidRecoveryGoal(value: unknown): value is RecoveryGoal {
  return (
    record(value) &&
    id(value.id) &&
    text(value.target, 200) &&
    ["abstinence", "reduction", "harm-reduction", "personal"].includes(
      String(value.type),
    ) &&
    text(value.description) &&
    date(value.startDate) &&
    typeof value.active === "boolean" &&
    typeof value.showProgress === "boolean"
  );
}
export function isValidSignalAction(value: unknown): value is SignalAction {
  return (
    record(value) &&
    id(value.id) &&
    text(value.signal) &&
    text(value.firstAction) &&
    text(value.alternative) &&
    (value.contactId === null || id(value.contactId)) &&
    (value.toolId === null || id(value.toolId))
  );
}
export function isValidPreventionPlan(value: unknown): value is PreventionPlan {
  if (
    !record(value) ||
    value.version !== 1 ||
    !Number.isSafeInteger(value.revision) ||
    Number(value.revision) < 0
  )
    return false;
  if (
    !Array.isArray(value.goals) ||
    value.goals.length > 50 ||
    !value.goals.every(isValidRecoveryGoal) ||
    !unique(value.goals)
  )
    return false;
  if (
    !Array.isArray(value.signalActions) ||
    value.signalActions.length > 100 ||
    !value.signalActions.every(isValidSignalAction) ||
    !unique(value.signalActions)
  )
    return false;
  if (!TEXT_FIELDS.every((key) => text(value[key])) || !date(value.reviewDate))
    return false;
  if (!Array.isArray(value.revisions) || value.revisions.length > 1000)
    return false;
  if (
    !value.revisions.every(
      (item) =>
        record(item) &&
        Number.isSafeInteger(item.revision) &&
        Number(item.revision) >= 0 &&
        typeof item.savedAt === "number" &&
        Number.isFinite(item.savedAt) &&
        item.savedAt >= 0 &&
        text(item.changeReason) &&
        text(item.content, 250_000),
    )
  )
    return false;
  return JSON.stringify(value).length <= 2_000_000;
}

export function emptyPreventionPlan(): PreventionPlan {
  return {
    version: 1,
    revision: 0,
    goals: [],
    signalActions: [],
    strengths: "",
    routines: "",
    careAgreements: "",
    medicalPrecautions: "",
    afterUse: "",
    aftercare: "",
    reviewDate: "",
    reviewedWith: "",
    sharingPreferences: "",
    changeReason: "",
    revisions: [],
  };
}

export function normalizePreventionPlan(value: unknown): PreventionPlan {
  if (value === undefined || value === null) return emptyPreventionPlan();
  if (!isValidPreventionPlan(value))
    throw new Error(
      "Unsupported prevention plan. Your existing data has not been changed.",
    );
  return structuredClone(value);
}

export function newRecoveryGoal(): RecoveryGoal {
  return {
    id: crypto.randomUUID(),
    target: "",
    type: "personal",
    description: "",
    startDate: "",
    active: true,
    showProgress: false,
  };
}

export function newSignalAction(): SignalAction {
  return {
    id: crypto.randomUUID(),
    signal: "",
    firstAction: "",
    alternative: "",
    contactId: null,
    toolId: null,
  };
}
