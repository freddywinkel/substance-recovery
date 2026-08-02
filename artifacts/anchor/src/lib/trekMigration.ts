import type { RegistrationAnswerValue } from "@/db";
import { toStableOptionId } from "@/lib/registrationIds";

export type TrekAxisMigration = {
  form?: string;
  need?: string;
  trigger?: string;
};

/** Shared semantic map for retired Trek values. Destinations are stable IDs. */
export const RETIRED_TREK_AXIS_MIGRATIONS: Readonly<Record<string, TrekAxisMigration>> = {
  "Planning or thinking about it": { form: "approach-mental-rehearsal" },
  "planning-or-thinking-about-it": { form: "approach-mental-rehearsal" },
  "Actively seeking it": { form: "approach-checking-availability" },
  "actively-seeking-it": { form: "approach-checking-availability" },
  "Ritual / habit": { form: "approach-automatic-routine" },
  "ritual-habit": { form: "approach-automatic-routine" },
  "Boredom-driven": { need: "stimulation" },
  "boredom-driven": { need: "stimulation" },
  "Emotional escape": { need: "escape" },
  "emotional-escape": { need: "escape" },
  "Social pressure": { trigger: "social-pressure" },
  "social-pressure": { trigger: "social-pressure" },
};

export const RETIRED_TREK_IMMEDIACY_MIGRATIONS: Readonly<Record<string, string>> = {
  "Just thinking about it": "immediacy-thoughts-only",
  "just-thinking-about-it": "immediacy-thoughts-only",
  "Getting money or resources": "immediacy-steps-started",
  "getting-money-or-resources": "immediacy-steps-started",
  "On my way there": "immediacy-access-close",
  "on-my-way-there": "immediacy-access-close",
  "About to act": "immediacy-about-to-act",
  "about-to-act": "immediacy-about-to-act",
};

type TrekRecord = {
  dataVersion?: number;
  cravingType?: string;
  answers?: Record<string, RegistrationAnswerValue>;
  trekTypes?: string[];
  planningStage?: string;
  needTypes?: string[];
  triggers?: string[];
};

function stableId(value: string): string {
  return /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(value)
    ? value
    : toStableOptionId(value);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function appendUnique(values: string[], additions: string[]): string[] {
  return [...new Set([...values, ...additions])];
}

/**
 * Read/storage migration for saved pre-v3 Trek records. It splits the retired
 * mixed `trekTypes` taxonomy into form, need and trigger axes without dropping
 * unknown answers or manufacturing a primary need/target from array order.
 */
export function migrateCompletedTrekRecord<T extends TrekRecord>(record: T): T {
  if (record.dataVersion != null && record.dataVersion >= 3) return record;
  const sourceAnswers = record.answers ?? {};
  const hasCanonicalType = Object.prototype.hasOwnProperty.call(sourceAnswers, "registrationType");
  const isTrek = hasCanonicalType
    ? sourceAnswers.registrationType === "trek"
    : record.cravingType === "active";
  if (!isTrek) return record;

  const sourceTypes = stringArray(
    Object.prototype.hasOwnProperty.call(sourceAnswers, "trekTypes")
      ? sourceAnswers.trekTypes
      : record.trekTypes,
  );
  const forms: string[] = [];
  const inferredNeeds: string[] = [];
  const inferredTriggers: string[] = [];
  let retiredFound = false;

  for (const value of sourceTypes) {
    const replacement = RETIRED_TREK_AXIS_MIGRATIONS[value];
    if (!replacement) {
      forms.push(stableId(value));
      continue;
    }
    retiredFound = true;
    if (replacement.form) forms.push(replacement.form);
    if (replacement.need) inferredNeeds.push(replacement.need);
    if (replacement.trigger) inferredTriggers.push(replacement.trigger);
  }

  const sourceNeeds = stringArray(
    Object.prototype.hasOwnProperty.call(sourceAnswers, "needs")
      ? sourceAnswers.needs
      : record.needTypes,
  ).map(stableId);
  const needs = inferredNeeds.length > 0
    ? appendUnique(sourceNeeds.filter((value) => value !== "not-sure"), inferredNeeds)
    : sourceNeeds;

  const sourceTriggers = stringArray(
    Object.prototype.hasOwnProperty.call(sourceAnswers, "triggers")
      ? sourceAnswers.triggers
      : record.triggers,
  ).map(stableId);
  const triggers = inferredTriggers.length > 0
    ? appendUnique(sourceTriggers.filter((value) => value !== "no-clear-trigger-not-sure"), inferredTriggers)
    : sourceTriggers;

  const sourcePlanning = typeof sourceAnswers.planningStage === "string"
    ? sourceAnswers.planningStage
    : record.planningStage;
  const planningStage = typeof sourcePlanning === "string"
    ? RETIRED_TREK_IMMEDIACY_MIGRATIONS[sourcePlanning] ?? stableId(sourcePlanning)
    : null;

  const needsWasMissing = !Object.prototype.hasOwnProperty.call(sourceAnswers, "needs");
  const changed = retiredFound
    || needsWasMissing
    || planningStage !== sourceAnswers.planningStage
    || sourceAnswers.registrationType !== "trek";
  if (!changed) return record;

  return {
    ...record,
    answers: {
      ...sourceAnswers,
      registrationType: "trek",
      // A retired motive-only answer proves a need, not the newly introduced
      // observable approach form. Keep that axis unanswered instead of
      // manufacturing the explicit "not sure" choice.
      trekTypes: forms.length > 0 ? [...new Set(forms)] : null,
      planningStage,
      needs: needs.length > 0 ? needs : null,
      triggers: triggers.length > 0 ? triggers : null,
    },
  };
}
