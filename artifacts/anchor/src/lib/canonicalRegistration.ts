import type {
  AnxietyLog,
  BoredomLog,
  CravingLog,
  RegistrationAnswerValue,
  RelapseLog,
} from "@/db";
import { toStableOptionId } from "@/lib/registrationIds";
import {
  migrateRelapseSafetyRecord,
  normalizeAcuteRisks,
} from "@/db/relapseSafety";
import { migrateCravingRegistrationType } from "@/db/migrations";
import { migrateCompletedTrekRecord } from "@/lib/trekMigration";
import { relapseFirstTriggerIdForRead } from "@/lib/relapseTrigger";
import { boredomClassificationIdForRead } from "@/lib/boredomClassification";

type RegistrationWithAnswers = {
  dataVersion?: number;
  contentVersion?: string;
  answers?: Record<string, RegistrationAnswerValue>;
};

type AnswerLookup = {
  present: boolean;
  value: RegistrationAnswerValue | undefined;
};

function lookupAnswer(record: RegistrationWithAnswers, key: string): AnswerLookup {
  const migrated = migrateCompletedTrekRecord(record);
  if (!migrated.answers || !Object.prototype.hasOwnProperty.call(migrated.answers, key)) {
    return { present: false, value: undefined };
  }
  return { present: true, value: migrated.answers[key] };
}

/**
 * A short-lived registration-v2 release wrote partial envelopes. Only these
 * exact non-safety fields may be read-backfilled when their canonical key is
 * absent. Presence (including null) always wins, and no intensity/risk proxy is
 * on this list.
 */
const PARTIAL_V2_BACKFILL_KEYS = new Set([
  // Craving / Trek free text and post-log outcome fields.
  "onsetOther",
  "situationOther",
  "emotionOther",
  "thoughtOther",
  "thoughtFreeText",
  "locationOther",
  "triggerNote",
  "needOther",
  "cravingOutcome",
  "intensityAfter",
  "note",
  // Anxiety free text and follow-up.
  "bodyPrediction",
  "outcomeAfter",
  // Boredom custom text and follow-up.
  "urgeOther",
  // Relapse custom text/context and combined retrospective help.
  "firstTriggerText",
  "leadUpContext",
  "preUseThoughtFreeText",
  "couldHaveHelped",
  "supportContactOther",
  "nextStepOther",
]);

function mayReadLegacy(record: RegistrationWithAnswers, key: string): boolean {
  return record.dataVersion == null
    || record.dataVersion < 2
    || (record.dataVersion === 2 && PARTIAL_V2_BACKFILL_KEYS.has(key));
}

function nonBlank(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && trimmed !== "unanswered" ? trimmed : null;
}

const OPTION_ID_ALIASES: Readonly<Record<string, string>> = {
  "just-thinking-about-it": "immediacy-thoughts-only",
  "getting-money-or-resources": "immediacy-steps-started",
  "on-my-way-there": "immediacy-access-close",
  "about-to-act": "immediacy-about-to-act",
};

function canonicalOptionAlias(value: string | null): string | null {
  return value ? OPTION_ID_ALIASES[value] ?? value : null;
}

/**
 * Legacy records stored a mixture of display copy and already-stable enum IDs.
 * Preserve an existing machine ID; otherwise convert the old display label to
 * the same language-neutral ID used by registration-v2 answers.
 */
export function canonicalizeLegacyOption(value: unknown): string | null {
  const text = nonBlank(value);
  if (!text) return null;
  return canonicalOptionAlias(/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(text)
    ? text
    : toStableOptionId(text) || null);
}

function unique(values: Array<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

export function hasCanonicalRegistrationAnswer(
  record: RegistrationWithAnswers,
  key: string,
): boolean {
  return lookupAnswer(record, key).present;
}

/** Read free text without ever converting it into an option ID. */
export function registrationText(
  record: RegistrationWithAnswers,
  key: string,
  legacy: unknown = null,
): string | null {
  const answer = lookupAnswer(record, key);
  return nonBlank(answer.present ? answer.value : mayReadLegacy(record, key) ? legacy : null);
}

export function registrationNumber(
  record: RegistrationWithAnswers,
  key: string,
  legacy: unknown = null,
): number | null {
  const answer = lookupAnswer(record, key);
  const value = answer.present ? answer.value : mayReadLegacy(record, key) ? legacy : null;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function registrationBoolean(
  record: RegistrationWithAnswers,
  key: string,
  legacy: unknown = null,
): boolean | null {
  const answer = lookupAnswer(record, key);
  const value = answer.present ? answer.value : mayReadLegacy(record, key) ? legacy : null;
  return typeof value === "boolean" ? value : null;
}

export function registrationOptionId(
  record: RegistrationWithAnswers,
  key: string,
  legacy: unknown = null,
): string | null {
  const answer = lookupAnswer(record, key);
  const value = answer.present
    ? canonicalOptionAlias(nonBlank(answer.value))
    : mayReadLegacy(record, key)
      ? canonicalizeLegacyOption(legacy)
      : null;
  return key === "firstTriggerType"
    ? relapseFirstTriggerIdForRead(value, record.dataVersion)
    : key === "convertCheck"
      ? boredomClassificationIdForRead(value, record.dataVersion)
    : value;
}

export function registrationOptionIds(
  record: RegistrationWithAnswers,
  key: string,
  legacy: unknown = null,
): string[] {
  const answer = lookupAnswer(record, key);
  const value = answer.present ? answer.value : mayReadLegacy(record, key) ? legacy : null;
  if (!Array.isArray(value)) return [];
  return answer.present
    ? unique(value.map((item) => canonicalOptionAlias(nonBlank(item))))
    : unique(value.map(canonicalizeLegacyOption));
}

export type CravingRegistrationKind = "craving" | "trek";

export function migrateCravingRegistrationAnswersForRead(
  record: Pick<CravingLog, "dataVersion" | "answers" | "cravingType">,
): Record<string, RegistrationAnswerValue> {
  return migrateCompletedTrekRecord(migrateCravingRegistrationType(record)).answers ?? {};
}

/**
 * V2 records identify their tracker in the answer envelope. Pre-v2 records use
 * the old `cravingType` split; records predating Trek are passive cravings.
 */
export function cravingRegistrationKind(
  record: Pick<CravingLog, "dataVersion" | "answers" | "cravingType">,
): CravingRegistrationKind | null {
  const answers = migrateCravingRegistrationAnswersForRead(record);
  if (Object.prototype.hasOwnProperty.call(answers, "registrationType")) {
    const value = answers.registrationType;
    return value === "trek" || value === "craving"
      ? value
      : null;
  }
  if (!mayReadLegacy(record, "registrationType")) return null;
  return record.cravingType === "active" ? "trek" : "craving";
}

/**
 * Keep note edits in both the compatibility field and the versioned envelope.
 * A null answer is deliberate and prevents stale legacy note text resurfacing.
 */
export function withCanonicalNote<
  T extends RegistrationWithAnswers & { note?: string },
>(record: T, note: string): T {
  const trimmed = note.trim();
  return {
    ...record,
    note: trimmed,
    answers: {
      ...(record.answers ?? {}),
      note: trimmed || null,
    },
  };
}

const RELAPSE_ATTENTION_VALUES = new Set([
  "unsafe",
  "fear-continued-use",
  "withdrawal",
  "self-harm-risk",
]);

export type AttentionReason =
  | "anxiety-urgent"
  | "relapse-unsafe"
  | "relapse-continued-use"
  | "relapse-withdrawal"
  | "relapse-self-harm";

export type ExplicitSafetyAnswer = {
  answered: boolean;
  needsAttention: boolean;
  /** Canonical complete set; preserves simultaneous Relapse concerns. */
  reasons: AttentionReason[];
  /** Compatibility alias for consumers that still display one reason. */
  reason: AttentionReason | null;
};

/**
 * Insights attention is based only on an answer to a dedicated safety question.
 * Craving intensity, legacy highRiskFlag, and other inferred severity proxies are
 * intentionally absent. For pre-v2 records, only affirmative legacy values are
 * compatible because old neutral defaults cannot prove the question was answered.
 */
export function explicitSafetyAnswer(
  kind: "craving" | "trek" | "anxiety" | "boredom" | "relapse",
  record: CravingLog | AnxietyLog | BoredomLog | RelapseLog,
): ExplicitSafetyAnswer {
  if (kind === "anxiety") {
    const anxiety = record as AnxietyLog;
    const canonical = lookupAnswer(anxiety, "urgencyHigh");
    if (canonical.present) {
      const answered = typeof canonical.value === "boolean";
      return {
        answered,
        needsAttention: canonical.value === true,
        reasons: canonical.value === true ? ["anxiety-urgent"] : [],
        reason: canonical.value === true ? "anxiety-urgent" : null,
      };
    }
    // An old `true` required an affirmative selection; old `false` was once a
    // preselected default and is therefore treated as unanswered.
    return anxiety.dataVersion == null || anxiety.dataVersion < 2
      ? {
          answered: anxiety.urgencyHigh === true,
          needsAttention: anxiety.urgencyHigh === true,
          reasons: anxiety.urgencyHigh === true ? ["anxiety-urgent"] : [],
          reason: anxiety.urgencyHigh === true ? "anxiety-urgent" : null,
        }
      : { answered: false, needsAttention: false, reasons: [], reason: null };
  }

  if (kind === "relapse") {
    const relapse = record as RelapseLog;
    // Normalize the short-lived v2 singular shape into the array envelope
    // first. The attention reader itself then consumes only the canonical key.
    const migrated = migrateRelapseSafetyRecord(relapse);
    const canonical = lookupAnswer(migrated, "acuteRisks");
    const values = canonical.present
      ? normalizeAcuteRisks(canonical.value)
      : relapse.dataVersion == null || relapse.dataVersion < 2
        ? normalizeAcuteRisks(migrated.acuteRisks)
        : [];
    const answered = values.length > 0;
    const reasons = values
      .filter((value) => RELAPSE_ATTENTION_VALUES.has(value))
      .map((value): AttentionReason => value === "unsafe"
        ? "relapse-unsafe"
        : value === "fear-continued-use"
          ? "relapse-continued-use"
          : value === "withdrawal"
            ? "relapse-withdrawal"
            : "relapse-self-harm");
    return {
      answered,
      needsAttention: reasons.length > 0,
      reasons,
      reason: reasons[0] ?? null,
    };
  }

  return { answered: false, needsAttention: false, reasons: [], reason: null };
}
