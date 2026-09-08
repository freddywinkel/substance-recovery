import { useRef, useState, type SetStateAction } from "react";
import type {
  AnxietyLog,
  BoredomLog,
  CravingLog,
  RelapseLog,
  RegistrationAnswerValue,
} from "@/db";
import { DRAFT_CATALOGS } from "@/contexts/activeRegistrationValidation";
import {
  canonicalizeLegacyOption,
  registrationText,
  explicitSafetyAnswer,
} from "@/lib/canonicalRegistration";
import { logicalTimestamp } from "@/lib/registrationIds";
import {
  acuteRiskCompatibilityAlias,
  normalizeAcuteRisks,
} from "@/db/relapseSafety";
import { relapseWhenForOccurrence } from "@/db/relapseTiming";
import type {
  QuickRegistrationRecord,
  RegistrationType,
} from "@/lib/recoveryFeatures";
import { useT } from "@/hooks/useTranslation";
import {
  RECOVERY_TARGET_VALUES,
  recoveryTargetLabel,
} from "@/lib/recoveryTargets";
import {
  encodeUseDetails,
  useDetailsForRecord,
  type UseDetail,
} from "@/lib/useDetails";
import { UseDetailsEditor } from "@/components/UseDetailsEditor";
import { CorrectionDraftCleanupError, RegistrationSourceConflictError, type RegistrationCorrectionDraft } from "@/lib/registrationCorrectionDraft";

export type DetailedCorrectionRecord =
  CravingLog | RelapseLog | AnxietyLog | BoredomLog;
type Answers = Record<string, RegistrationAnswerValue>;
const ALIASES: Record<string, string> = {
  situations: "situationPresets",
  thoughts: "thoughtPresets",
  targets: "substances",
  needs: "needTypes",
  thoughtOther: "thoughtFreeText",
  preUseThoughts: "preUseThoughtPresets",
  leadUpContext: "context",
};
const TEXT_FIELDS = new Set([
  "note",
  "onsetOther",
  "situationOther",
  "emotionOther",
  "thoughtOther",
  "thoughtFreeText",
  "locationOther",
  "triggerNote",
  "needOther",
  "bodyPrediction",
  "urgeOther",
  "firstTriggerText",
  "leadUpContext",
  "preUseThoughtFreeText",
  "supportContactOther",
  "nextStepOther",
]);
const NUMBER_FIELDS = new Set([
  "intensity",
  "confidenceBefore",
  "confidenceAfter",
  "intensityAfter",
  "emotionAfter",
  "delayDuration",
]);
const BOOLEAN_FIELDS = new Set(["urgencyHigh", "actionAttempted"]);
const HIDDEN_FIELDS = new Set([
  "registrationType",
  "quickRegistrationId",
  "primarySubstance",
  "when",
  "couldHaveHelped",
  "useDetailsJson",
]);
const LABELS: Record<string, [string, string]> = {
  intensity: ["Intensiteit", "Intensity"],
  confidenceBefore: ["Vertrouwen vooraf", "Confidence before"],
  confidenceAfter: ["Vertrouwen achteraf", "Confidence after"],
  intensityAfter: ["Intensiteit achteraf", "Intensity after"],
  emotionAfter: ["Emotie achteraf", "Emotion after"],
  delayDuration: ["Uitstelduur in seconden", "Delay in seconds"],
  note: ["Notitie", "Note"],
  onsetType: ["Ontstaan", "Onset"],
  onsetOther: ["Ander ontstaan", "Other onset"],
  situations: ["Situaties", "Situations"],
  situationOther: ["Andere situatie", "Other situation"],
  physicalSensations: ["Lichamelijke sensaties", "Physical sensations"],
  buildupDuration: ["Duur van opbouw", "Build-up duration"],
  location: ["Locatie", "Location"],
  locationOther: ["Andere locatie", "Other location"],
  emotions: ["Emoties", "Emotions"],
  emotionOther: ["Andere emotie", "Other emotion"],
  thoughts: ["Gedachten", "Thoughts"],
  thoughtOther: ["Andere gedachte", "Other thought"],
  thoughtFreeText: ["Gedachten in eigen woorden", "Thoughts in your words"],
  targets: ["Middel of gedrag", "Substance or behavior"],
  substances: ["Middel of gedrag", "Substance or behavior"],
  chosenAction: ["Gekozen actie", "Chosen action"],
  actionAttempted: ["Actie geprobeerd", "Action attempted"],
  useOutcome: ["Gebruiksuitkomst", "Use outcome"],
  cravingOutcome: ["Verandering in craving", "Change in craving"],
  trekTypes: ["Vormen van trek", "Forms of urge"],
  planningStage: ["Nabijheid tot gebruik", "Proximity to use"],
  triggers: ["Aanleidingen", "Triggers"],
  triggerNote: ["Andere aanleiding", "Other trigger"],
  needs: ["Behoeften", "Needs"],
  needOther: ["Andere behoefte", "Other need"],
  anxietyTypes: ["Soorten angst", "Anxiety types"],
  bodyLocations: ["Plaats in het lichaam", "Body locations"],
  bodyPrediction: ["Verwachting over het lichaam", "Body prediction"],
  urgencyHigh: [
    "Dringende hulp nodig op dat moment",
    "Urgent help needed at the time",
  ],
  context: ["Context", "Context"],
  reassuranceSeeking: ["Geruststelling zoeken", "Reassurance seeking"],
  linkedStates: ["Samenhangende toestanden", "Linked states"],
  reaction: ["Reactie", "Reaction"],
  outcomeAfter: ["Verandering achteraf", "Later change"],
  restlessnessTypes: ["Vormen van onrust", "Forms of restlessness"],
  stimulationNeeds: ["Behoefte aan prikkels", "Stimulation needs"],
  convertCheck: ["Eigen duiding", "Your interpretation"],
  situation: ["Situatie", "Situation"],
  urge: ["Neiging", "Urge"],
  urgeOther: ["Andere neiging", "Other urge"],
  rescueMenu: ["Gekozen activiteiten", "Selected activities"],
  action: ["Actie", "Action"],
  acuteRisks: [
    "Veiligheidszorgen op dat moment",
    "Safety concerns at the time",
  ],
  label: ["Eigen benaming", "Your label"],
  episodeDuration: ["Duur van gebeurtenis", "Episode duration"],
  amountCategory: ["Globale hoeveelheid", "Amount category"],
  firstTriggerType: ["Eerste aanleiding", "First trigger"],
  firstTriggerText: ["Aanleiding in eigen woorden", "Trigger in your words"],
  preUseFactors: ["Voorafgaande factoren", "Preceding factors"],
  leadUpContext: ["Aanloop in eigen woorden", "Lead-up in your words"],
  missedWarnings: ["Signalen die je gemist hebt", "Missed warning signs"],
  preUseThoughts: ["Gedachten vooraf", "Thoughts before"],
  preUseThoughtFreeText: [
    "Gedachten vooraf in eigen woorden",
    "Earlier thoughts in your words",
  ],
  couldHaveHelpedEarly: [
    "Wat vroeg had kunnen helpen",
    "What could have helped early",
  ],
  couldHaveHelpedMiddle: [
    "Wat halverwege had kunnen helpen",
    "What could have helped midway",
  ],
  couldHaveHelpedLast: [
    "Wat op het laatste moment had kunnen helpen",
    "What could have helped last",
  ],
  supportContact: ["Steuncontact", "Support contact"],
  supportContactOther: ["Ander steuncontact", "Other support contact"],
  nextStep: ["Volgende stap", "Next step"],
  nextStepOther: ["Andere volgende stap", "Other next step"],
  whatNeeded: ["Wat je nodig had", "What you needed"],
  repairActions: ["Herstelacties", "Recovery actions"],
};

function optionsFor(
  type: RegistrationType,
  key: string,
): readonly string[] | undefined {
  if (key === "targets" || key === "substances") return RECOVERY_TARGET_VALUES;
  if (key === "outcomeAfter" || key === "cravingOutcome")
    return ["decreased", "same", "increased", "unknown"];
  const field = ALIASES[key] ?? key;
  return (
    DRAFT_CATALOGS[type].arrays[field] ?? DRAFT_CATALOGS[type].scalars[field]
  );
}
function isArrayField(type: RegistrationType, key: string): boolean {
  return (
    key === "targets" ||
    key === "substances" ||
    !!DRAFT_CATALOGS[type].arrays[ALIASES[key] ?? key]
  );
}

export function correctionAnswers(
  record: DetailedCorrectionRecord,
  type: RegistrationType,
): Answers {
  if (record.answers) {
    const result = {
      ...record.answers,
      note: registrationText(record, "note", record.note),
    };
    const textFields: Record<RegistrationType, string[]> = {
      craving: ["onsetOther", "situationOther", "emotionOther", "thoughtOther"],
      trek: [
        "locationOther",
        "triggerNote",
        "needOther",
        "emotionOther",
        "thoughtFreeText",
      ],
      anxiety: ["bodyPrediction"],
      boredom: ["situationOther", "urgeOther"],
      relapse: [
        "firstTriggerText",
        "leadUpContext",
        "preUseThoughtFreeText",
        "supportContactOther",
        "nextStepOther",
      ],
    };
    // Exact legacy text supported by the canonical reader remains correctable;
    // explicit null retains its unanswered meaning.
    for (const key of textFields[type])
      if (!Object.hasOwn(result, key)) {
        const legacy = (record as unknown as Record<string, unknown>)[
          ALIASES[key] ?? key
        ];
        const value = registrationText(
          record,
          key,
          typeof legacy === "string" ? legacy : undefined,
        );
        if (value !== null) (result as Answers)[key] = value;
      }
    return result;
  }
  const source = record as unknown as Record<string, unknown>;
  const result: Answers = {};
  for (const key of Object.keys(LABELS)) {
    if (
      (type === "relapse" && key === "targets") ||
      (type !== "relapse" && key === "substances")
    )
      continue;
    if (
      (type === "trek" && key === "thoughtOther") ||
      (type === "craving" && key === "thoughtFreeText")
    )
      continue;
    const field = ALIASES[key] ?? key;
    const value = source[field];
    if (value === undefined || HIDDEN_FIELDS.has(key)) continue;
    if (key === "urgencyHigh")
      result[key] = explicitSafetyAnswer("anxiety", record).answered
        ? value === true
        : null;
    else if (TEXT_FIELDS.has(key))
      result[key] = typeof value === "string" && value.trim() ? value : null;
    else if (NUMBER_FIELDS.has(key) || BOOLEAN_FIELDS.has(key))
      result[key] =
        typeof value === "number" || typeof value === "boolean" ? value : null;
    else if (optionsFor(type, key))
      result[key] = Array.isArray(value)
        ? value
            .map((item) => canonicalizeLegacyOption(item))
            .filter((item): item is string => !!item)
        : canonicalizeLegacyOption(value);
  }
  return result;
}

/** Updates both representations, preserving entry/completion time and stable identity. */
export function applyRegistrationCorrection(
  record: DetailedCorrectionRecord,
  type: RegistrationType,
  answers: Answers,
  occurredAt: number,
  useDetails: UseDetail[],
  now = Date.now(),
): DetailedCorrectionRecord {
  if (!Number.isFinite(occurredAt) || occurredAt < 0 || occurredAt > now)
    throw new Error("Choose a valid past event time.");
  const next = {
    ...record,
    answers: { ...answers },
    occurredAt,
    timestamp: occurredAt,
    editedAt: now,
    updatedAt: now,
  } as unknown as Record<string, unknown>;
  const canonical = next.answers as Answers;
  for (const [key, value] of Object.entries(canonical)) {
    if (HIDDEN_FIELDS.has(key)) continue;
    const field = ALIASES[key] ?? key;
    const options = optionsFor(type, key);
    const display = (item: string) =>
      options?.find((option) => canonicalizeLegacyOption(option) === item) ??
      item;
    if (key === "delayDuration")
      next[field] = typeof value === "number" ? String(value) : null;
    else if (Array.isArray(value)) next[field] = value.map(display);
    else if (typeof value === "string")
      next[field] = TEXT_FIELDS.has(key) ? value : display(value);
    else if (value === null)
      next[field] = isArrayField(type, key)
        ? []
        : NUMBER_FIELDS.has(key) ||
            BOOLEAN_FIELDS.has(key) ||
            key === "outcomeAfter" ||
            key === "cravingOutcome"
          ? null
          : "";
    else next[field] = value;
  }
  if (type === "trek" || type === "craving") {
    next.primarySubstance = "";
    if (type === "trek") next.needType = "";
    next.useDetails = useDetails;
    canonical.useDetailsJson = encodeUseDetails(useDetails);
  }
  if (type === "anxiety") {
    next.trigger = "";
    next.linkedState = "";
    next.bodySensations =
      next.bodyLocations ?? (record as AnxietyLog).bodySensations;
  }
  if (type === "boredom") {
    next.feelingTypes = next.restlessnessTypes ?? [];
    next.stimulationNeed = "";
  }
  if (type === "relapse") {
    if (canonical.label === null) next.label = "no-label";
    if (canonical.episodeDuration === null) next.episodeDuration = "unanswered";
    if (canonical.amountCategory === null) next.amountCategory = "unanswered";
    next.primarySubstance = "";
    next.preUseThoughtPreset = "";
    const risks = normalizeAcuteRisks(canonical.acuteRisks);
    next.acuteRisks = risks;
    next.acuteRisk = acuteRiskCompatibilityAlias(risks);
    canonical.acuteRisks = risks.length ? risks : null;
    next.when = relapseWhenForOccurrence(
      occurredAt,
      record.completedAt ?? record.startedAt ?? now,
    );
    canonical.when = next.when as string;
    const help = [
      ...new Set(
        [
          "couldHaveHelpedEarly",
          "couldHaveHelpedMiddle",
          "couldHaveHelpedLast",
        ].flatMap((key) =>
          Array.isArray(canonical[key]) ? (canonical[key] as string[]) : [],
        ),
      ),
    ];
    canonical.couldHaveHelped = help.length ? help : null;
    next.useDetails = useDetails;
    canonical.useDetailsJson = encodeUseDetails(useDetails);
  }
  return next as unknown as DetailedCorrectionRecord;
}

export function localDateTime(timestamp: number): string {
  const value = new Date(timestamp);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}T${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
}

export function RegistrationCorrection({
  draft,
  onDraftChange,
  onSave,
  onCancel,
}: {
  draft: RegistrationCorrectionDraft;
  onDraftChange: (update: SetStateAction<RegistrationCorrectionDraft>) => void;
  onSave: (value: {
    detailedRecord?: DetailedCorrectionRecord;
    quickRecord?: QuickRegistrationRecord;
  }) => Promise<void>;
  onCancel: () => Promise<void>;
}) {
  const { language, tOpt } = useT();
  const nl = language === "nl";
  const { type, answers, eventTime, quickValue, useDetails } = draft;
  const detailed = draft.detailed ?? undefined;
  const quick = draft.quick ?? undefined;
  const setField = <K extends keyof RegistrationCorrectionDraft>(key: K, update: SetStateAction<RegistrationCorrectionDraft[K]>) => {
    if (savingRef.current) return;
    onDraftChange(current => ({ ...current, [key]: typeof update === "function" ? (update as (old: RegistrationCorrectionDraft[K]) => RegistrationCorrectionDraft[K])(current[key]) : update }));
  };
  const setAnswers = (update: SetStateAction<Answers>) => setField("answers", update);
  const setEventTime = (value: string) => setField("eventTime", value);
  const setQuickValue = (value: QuickRegistrationRecord) => setField("quickValue", value);
  const setUseDetails = (value: UseDetail[]) => setField("useDetails", value);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState("");
  const update = (key: string, value: RegistrationAnswerValue) => {
    setAnswers((current) => ({ ...current, [key]: value }));
    setError("");
  };
  const inputClass =
    "mt-1 min-h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-base";
  const targets = (
    Array.isArray(answers.targets)
      ? answers.targets
      : Array.isArray(answers.substances)
        ? answers.substances
        : []
  )
    .map((value) =>
      RECOVERY_TARGET_VALUES.find(
        (target) => canonicalizeLegacyOption(target) === value,
      ),
    )
    .filter(
      (value): value is (typeof RECOVERY_TARGET_VALUES)[number] => !!value,
    );
  const label = (key: string) => LABELS[key]?.[nl ? 0 : 1] ?? key;
  const save = async () => {
    if (savingRef.current) return;
    const originalTime = detailed
      ? logicalTimestamp(detailed)
      : (quick!.occurredAt ?? quick!.timestamp);
    const occurredAt =
      eventTime === localDateTime(originalTime)
        ? originalTime
        : new Date(eventTime).getTime();
    if (!eventTime || !Number.isFinite(occurredAt) || occurredAt > Date.now()) {
      setError(
        nl
          ? "Kies een geldige gebeurtenistijd in het verleden."
          : "Choose a valid past event time.",
      );
      return;
    }
    if (
      type === "relapse" &&
      detailed?.completedAt &&
      occurredAt > detailed.completedAt
    ) {
      setError(
        nl
          ? "De gebeurtenis kan niet na de oorspronkelijke reflectie liggen. Controleer de gebeurtenistijd; de oorspronkelijke opslagtijd blijft bewaard."
          : "The event cannot occur after the original reflection. Check the event time; the original save time is preserved.",
      );
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      const now = Date.now();
      await onSave({
        detailedRecord: detailed
          ? applyRegistrationCorrection(
              detailed,
              type,
              answers,
              occurredAt,
              useDetails.filter((detail) =>
                targets.includes(detail.target as (typeof targets)[number]),
              ),
              now,
            )
          : undefined,
        quickRecord: quickValue
          ? {
              ...quickValue,
              occurredAt,
              createdAt: quickValue.createdAt ?? quickValue.timestamp,
              editedAt: now,
              updatedAt: now,
            }
          : undefined,
      });
    } catch (cause) {
      setError(
        cause instanceof RegistrationSourceConflictError
          ? (nl ? "De opgeslagen registratie is gewijzigd of verwijderd. Je concept blijft hier. Vergelijk het met de huidige registratie; verwerp dit concept alleen als je dat zelf wilt." : "The saved registration changed or was deleted. Your draft is still here. Compare it with the current registration; discard this draft only if you choose to.")
          : cause instanceof CorrectionDraftCleanupError
            ? (nl ? "De correctie is opgeslagen; het concept kon nog niet worden gewist. Je invoer blijft bewaard. Herstel het concept met Opnieuw proberen en sla daarna opnieuw op." : "The correction is saved; its draft could not be cleared. Your input is preserved. Retry the draft, then save again.")
            : nl
          ? "Opslaan lukte niet. Controleer verplichte antwoorden en combinaties (zoals ‘Anders’ met toelichting). Je invoer blijft behouden."
          : "Could not save. Check required answers and combinations (such as Other with an explanation). Your input is preserved.",
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  return (
    <fieldset disabled={saving} className="grid min-w-0 gap-4">
      <p className="text-xs leading-5 text-muted-foreground">
        {nl
          ? "Corrigeer wat je toen bedoelde. De oorspronkelijke invoer- en reflectietijden blijven bewaard. Veiligheidsantwoorden gaan over dat moment."
          : "Correct what you meant at the time. Original entry and reflection times are preserved. Safety answers refer to that moment."}
      </p>
      <label className="text-sm font-medium">
        {nl ? "Wanneer gebeurde het?" : "When did it happen?"}
        <input
          type="datetime-local"
          value={eventTime}
          onChange={(e) => setEventTime(e.target.value)}
          className={inputClass}
        />
      </label>
      {quickValue && (
        <fieldset className="grid gap-3 rounded-xl border border-border p-3">
          <legend className="px-1 text-sm font-semibold">
            {nl ? "Snelle registratie" : "Quick registration"}
          </legend>
          <label className="text-sm">
            {nl
              ? "Intensiteit (leeg = niet vastgelegd)"
              : "Intensity (blank = not recorded)"}
            <input
              type="number"
              min={0}
              max={10}
              value={quickValue.intensity ?? ""}
              onChange={(e) =>
                setQuickValue({
                  ...quickValue,
                  intensity:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
              className={inputClass}
            />
          </label>
          <label className="text-sm">
            {nl ? "Veiligheidsantwoord toen" : "Safety answer then"}
            <select
              aria-label={
                nl ? "Veiligheidsantwoord toen" : "Safety answer then"
              }
              value={quickValue.immediateSafety}
              onChange={(e) =>
                setQuickValue({
                  ...quickValue,
                  immediateSafety: e.target
                    .value as QuickRegistrationRecord["immediateSafety"],
                })
              }
              className={inputClass}
            >
              {[
                ["safe-for-now", nl ? "Voor nu veilig" : "Safe for now"],
                ["need-support", nl ? "Steun nodig" : "Need support"],
                ["urgent-danger", nl ? "Direct gevaar" : "Immediate danger"],
              ].map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            {nl ? "Middel of gedrag" : "Substance or behavior"}
            <select
              aria-label={nl ? "Middel of gedrag" : "Substance or behavior"}
              value={quickValue.target ?? ""}
              onChange={(e) =>
                setQuickValue({ ...quickValue, target: e.target.value })
              }
              className={inputClass}
            >
              <option value="">
                {nl ? "Niet vastgelegd" : "Not recorded"}
              </option>
              {RECOVERY_TARGET_VALUES.map((target) => (
                <option key={target} value={target}>
                  {recoveryTargetLabel(target, language)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            {nl ? "Gebruiksuitkomst" : "Use outcome"}
            <select
              aria-label={nl ? "Gebruiksuitkomst" : "Use outcome"}
              value={quickValue.useOutcome ?? "unsure"}
              onChange={(e) =>
                setQuickValue({
                  ...quickValue,
                  useOutcome: e.target
                    .value as QuickRegistrationRecord["useOutcome"],
                })
              }
              className={inputClass}
            >
              {[
                ["unsure", nl ? "Onbekend" : "Unknown"],
                [
                  "used",
                  nl
                    ? "Gebruikt / gedrag uitgevoerd"
                    : "Used / behavior occurred",
                ],
                ["not_used", nl ? "Niet gebruikt" : "Not used"],
              ].map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={quickValue.usePrescribed === true}
              onChange={(e) =>
                setQuickValue({
                  ...quickValue,
                  usePrescribed: e.target.checked,
                })
              }
            />
            {nl
              ? "Dit was medicatie volgens voorschrift"
              : "This was medication taken as prescribed"}
          </label>
          <label className="text-sm">
            {nl ? "Gekozen volgende actie" : "Chosen next action"}
            <select
              aria-label={nl ? "Gekozen volgende actie" : "Chosen next action"}
              value={quickValue.chosenAction}
              onChange={(e) =>
                setQuickValue({
                  ...quickValue,
                  chosenAction: e.target.value,
                  chosenActionOther:
                    e.target.value === "other"
                      ? quickValue.chosenActionOther
                      : "",
                })
              }
              className={inputClass}
            >
              {[
                [
                  "trusted-contact",
                  nl
                    ? "Iemand die ik vertrouw benaderen"
                    : "Contact someone I trust",
                ],
                [
                  "coping-tool",
                  nl ? "Een copingtool gebruiken" : "Use a coping tool",
                ],
                [
                  "wait-ten",
                  nl ? "Tien minuten pauze" : "Pause for ten minutes",
                ],
                [
                  "safer-place",
                  nl ? "Naar een veiligere plek" : "Move to a safer place",
                ],
                [
                  "professional-help",
                  nl
                    ? "Professionele hulp benaderen"
                    : "Contact professional support",
                ],
                ["other", nl ? "Andere actie" : "Other action"],
              ].map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
              {![
                "trusted-contact",
                "coping-tool",
                "wait-ten",
                "safer-place",
                "professional-help",
                "other",
              ].includes(quickValue.chosenAction) && (
                <option value={quickValue.chosenAction}>
                  {tOpt(quickValue.chosenAction)}
                </option>
              )}
            </select>
          </label>
          {quickValue.chosenAction === "other" && (
            <label className="text-sm">
              {nl ? "Beschrijf de andere actie" : "Describe the other action"}
              <input
                value={quickValue.chosenActionOther}
                onChange={(e) =>
                  setQuickValue({
                    ...quickValue,
                    chosenActionOther: e.target.value,
                  })
                }
                className={inputClass}
                maxLength={500}
              />
            </label>
          )}
          <label className="text-sm">
            {nl ? "Notitie bij snelle registratie" : "Quick registration note"}
            <textarea
              aria-label={
                nl
                  ? "Notitie bij snelle registratie"
                  : "Quick registration note"
              }
              value={quickValue.note}
              onChange={(e) =>
                setQuickValue({ ...quickValue, note: e.target.value })
              }
              className={inputClass}
              maxLength={2000}
            />
          </label>
        </fieldset>
      )}
      {detailed && (
        <fieldset className="grid gap-3">
          <legend className="text-sm font-semibold">
            {nl ? "Uitgebreide registratie" : "Detailed registration"}
          </legend>
          {Object.entries(answers)
            .filter(([key]) => !HIDDEN_FIELDS.has(key) && LABELS[key])
            .map(([key, value]) => {
              const options = optionsFor(type, key)?.filter(
                (option) => option !== "" && option !== "unanswered",
              );
              if (BOOLEAN_FIELDS.has(key))
                return (
                  <label key={key} className="text-sm">
                    {label(key)}
                    <select
                      aria-label={label(key)}
                      value={value === null ? "" : String(value)}
                      onChange={(e) =>
                        update(
                          key,
                          e.target.value === ""
                            ? null
                            : e.target.value === "true",
                        )
                      }
                      className={inputClass}
                    >
                      <option value="">
                        {nl ? "Niet vastgelegd" : "Not recorded"}
                      </option>
                      <option value="true">{nl ? "Ja" : "Yes"}</option>
                      <option value="false">{nl ? "Nee" : "No"}</option>
                    </select>
                  </label>
                );
              if (NUMBER_FIELDS.has(key))
                return (
                  <label key={key} className="text-sm">
                    {label(key)}
                    <input
                      type="number"
                      min={0}
                      max={key === "delayDuration" ? undefined : 10}
                      value={typeof value === "number" ? value : ""}
                      onChange={(e) =>
                        update(
                          key,
                          e.target.value === "" ? null : Number(e.target.value),
                        )
                      }
                      className={inputClass}
                    />
                  </label>
                );
              if (TEXT_FIELDS.has(key))
                return (
                  <label key={key} className="text-sm">
                    {label(key)}
                    <textarea
                      aria-label={label(key)}
                      value={typeof value === "string" ? value : ""}
                      onChange={(e) =>
                        update(
                          key,
                          e.target.value.trim() ? e.target.value : null,
                        )
                      }
                      className={inputClass}
                      maxLength={4000}
                    />
                  </label>
                );
              if (options && isArrayField(type, key))
                return (
                  <fieldset
                    key={key}
                    className="rounded-xl border border-border p-3"
                  >
                    <legend className="px-1 text-sm">{label(key)}</legend>
                    <div className="grid gap-1">
                      {options.map((option) => {
                        const id = canonicalizeLegacyOption(option)!;
                        const values = Array.isArray(value) ? value : [];
                        return (
                          <label
                            key={option}
                            className="flex min-h-11 items-center gap-2 text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={values.includes(id)}
                              onChange={() => {
                                const neutral = [
                                  "none",
                                  "not-sure",
                                  "approach-not-sure",
                                  "no-clear-trigger-not-sure",
                                  "no-clear-situation-not-sure",
                                  "whole-body",
                                  "not-in-one-place-not-sure",
                                  "not-connected-to-anything-specific",
                                ];
                                const next = values.includes(id)
                                  ? values.filter((item) => item !== id)
                                  : neutral.includes(id)
                                    ? [id]
                                    : [
                                        ...values.filter(
                                          (item) => !neutral.includes(item),
                                        ),
                                        id,
                                      ];
                                update(key, next.length ? next : null);
                              }}
                            />
                            {key === "targets" || key === "substances"
                              ? recoveryTargetLabel(option, language)
                              : tOpt(option)}
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                );
              if (options)
                return (
                  <label key={key} className="text-sm">
                    {label(key)}
                    <select
                      aria-label={label(key)}
                      value={typeof value === "string" ? value : ""}
                      onChange={(e) => update(key, e.target.value || null)}
                      className={inputClass}
                    >
                      <option value="">
                        {nl ? "Niet vastgelegd" : "Not recorded"}
                      </option>
                      {options.map((option) => (
                        <option
                          key={option}
                          value={canonicalizeLegacyOption(option)!}
                        >
                          {tOpt(option)}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              return null;
            })}
          {(type === "craving" || type === "trek" || type === "relapse") && (
            <UseDetailsEditor
              targets={targets}
              value={useDetails}
              onChange={setUseDetails}
              language={language}
            />
          )}
        </fieldset>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => { if (savingRef.current) return; savingRef.current = true; setSaving(true); void onCancel().catch(() => setError(nl ? "Het concept kon niet worden verworpen. Je invoer blijft bewaard." : "The draft could not be discarded. Your input is preserved.")).finally(() => { savingRef.current = false; setSaving(false); }); }}
          className="min-h-11 flex-1 rounded-xl border border-border p-2"
        >
          {nl ? "Concept verwerpen" : "Discard draft"}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="min-h-11 flex-1 rounded-xl bg-primary p-2 font-semibold text-primary-foreground"
        >
          {saving
            ? nl
              ? "Opslaan…"
              : "Saving…"
            : nl
              ? "Correctie opslaan"
              : "Save correction"}
        </button>
      </div>
    </fieldset>
  );
}
