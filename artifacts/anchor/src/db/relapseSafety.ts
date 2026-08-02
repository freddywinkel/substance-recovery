export const ACUTE_CONCERN_VALUES = [
  "unsafe",
  "fear-continued-use",
  "withdrawal",
  "self-harm-risk",
] as const;

export const ACUTE_RISK_SELECTION_VALUES = [
  "unsafe",
  "fear-continued-use",
  "withdrawal",
  "self-harm-risk",
  "none",
] as const;

export const UNANSWERED_ACUTE_RISK = "unanswered" as const;

export type AcuteConcern = (typeof ACUTE_CONCERN_VALUES)[number];
export type AcuteRiskSelection = (typeof ACUTE_RISK_SELECTION_VALUES)[number];
export type AcuteRisk = AcuteRiskSelection | "unanswered";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function isAcuteRiskSelection(value: unknown): value is AcuteRiskSelection {
  return typeof value === "string"
    && (ACUTE_RISK_SELECTION_VALUES as readonly string[]).includes(value);
}

export function isAcuteRisk(value: unknown): value is AcuteRisk {
  return value === "unanswered" || isAcuteRiskSelection(value);
}

export function isValidAcuteRiskSelectionArray(value: unknown): value is AcuteRiskSelection[] {
  if (!Array.isArray(value) || !value.every(isAcuteRiskSelection)) return false;
  if (new Set(value).size !== value.length) return false;
  return !(value.length > 1 && value.includes("none"));
}

/**
 * Return the canonical safety selection. A present array is authoritative;
 * the singular value is read only when migrating an older record or draft.
 * `none` is exclusive, while an empty array means genuinely unanswered.
 * A pre-v2 singular `none` was preselected and therefore cannot prove that the
 * safety question was answered. In v2 the blank state was `unanswered`, so a
 * stored singular `none` is deliberate; callers pass that version evidence via
 * `singularNoneIsDeliberate` while migrating the short-lived v2 shape.
 */
export function normalizeAcuteRisks(
  acuteRisks: unknown,
  legacyAcuteRisk?: unknown,
  singularNoneIsDeliberate = false,
): AcuteRiskSelection[] {
  if (Array.isArray(acuteRisks)) {
    const unique = [...new Set(acuteRisks.filter(isAcuteRiskSelection))];
    const concerns = unique.filter((value): value is AcuteConcern => value !== "none");
    if (concerns.length > 0) return concerns;
    return unique.includes("none") ? ["none"] : [];
  }

  if (!isAcuteRiskSelection(legacyAcuteRisk)) return [];
  if (legacyAcuteRisk !== "none") return [legacyAcuteRisk];
  return singularNoneIsDeliberate ? ["none"] : [];
}

/**
 * Compatibility alias for code and exported backups created before the array
 * schema. It is not canonical and cannot represent every simultaneous concern;
 * consumers must prefer `acuteRisks`. The canonical array remains on-record,
 * so choosing a deterministic highest-priority alias never discards data.
 */
export function acuteRiskCompatibilityAlias(acuteRisks: readonly AcuteRiskSelection[]): AcuteRisk {
  const priority: readonly AcuteRiskSelection[] = [
    "self-harm-risk",
    "withdrawal",
    "unsafe",
    "fear-continued-use",
    "none",
  ];
  return priority.find((value) => acuteRisks.includes(value)) ?? "unanswered";
}

/**
 * Add the canonical array to legacy records without mutating the source.
 * Precedence is deliberate and shared by storage/import consumers:
 *
 * 1. a present `answers.acuteRisks` key (including explicit null),
 * 2. a present top-level `acuteRisks` key,
 * 3. a pre-v3 singular legacy alias.
 *
 * A pre-v2 singular `none` remains unanswered because old releases preselected
 * it. A v2 singular `none` is promoted because that release used a distinct
 * `unanswered` blank state before the array field was introduced.
 */
export function migrateRelapseSafetyRecord<T extends object>(record: T): T & {
  acuteRisks: AcuteRiskSelection[];
  acuteRisk: AcuteRisk;
} {
  const source = record as Record<string, unknown>;
  const sourceAnswers = isRecord(source.answers) ? source.answers : undefined;
  const hasAnswerArray = !!sourceAnswers
    && Object.prototype.hasOwnProperty.call(sourceAnswers, "acuteRisks");
  const hasTopLevelArray = Object.prototype.hasOwnProperty.call(source, "acuteRisks");
  const canMigrateSingular = source.dataVersion == null
    || (typeof source.dataVersion === "number" && source.dataVersion < 3);
  const acuteRisks = hasAnswerArray
    ? normalizeAcuteRisks(sourceAnswers?.acuteRisks)
    : hasTopLevelArray
      ? normalizeAcuteRisks(source.acuteRisks)
      : canMigrateSingular
        ? normalizeAcuteRisks(
            undefined,
            source.acuteRisk ?? sourceAnswers?.acuteRisk,
            source.dataVersion === 2,
          )
        : [];
  const acuteRisk = acuteRiskCompatibilityAlias(acuteRisks);
  let answers = source.answers;

  if (isRecord(answers)) {
    // The singular answer key predates multi-select and cannot encode the
    // canonical meaning. Remove it rather than retaining a stale or partial
    // value beside the authoritative array.
    const { acuteRisk: _legacyAlias, ...otherAnswers } = answers;
    const migratedAnswers = {
      ...otherAnswers,
      acuteRisks: acuteRisks.length > 0 ? acuteRisks : null,
    };
    answers = migratedAnswers;
  }

  return {
    ...record,
    acuteRisks,
    // Documented compatibility alias; `acuteRisks` above is authoritative.
    acuteRisk,
    ...(answers === undefined ? {} : { answers }),
  };
}
