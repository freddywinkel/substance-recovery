import { BriefCompassionButton } from "@/components/BriefCompassionButton";
import { CareContactCard } from "@/components/CareContactCard";
/**
 * AnxietyTracker v2 — 4-step awareness + action log.
 *
 * Steps: type → body → urgency/context → reaction
 * Done screen: completion + linked-state routing + outcome note
 *
 * Clinical framing: distress-tolerance training (DBT), worry postponement (CBT),
 * pattern recognition. NOT symptom control or obsessive self-monitoring.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useStore } from "@/hooks/useStore";
import { type AnxietyLog } from "@/db";
import {
  CURRENT_REGISTRATION_CONTENT_VERSION,
  CURRENT_REGISTRATION_DATA_VERSION,
} from "@/db/migrations";
import { useActiveRegistration } from "@/contexts/ActiveRegistrationContext";
import { useRecoveryFeatures } from "@/contexts/RecoveryFeaturesContext";
import { useT } from "@/hooks/useTranslation";
import { toStableOptionId, toStableOptionIds } from "@/lib/registrationIds";
import { getUrgentSafetyCopy } from "@/lib/registrationSafety";
import { IntensitySlider } from "@/components/tracker/IntensitySlider";
import { ChipCol } from "@/components/tracker/ChipCol";
import { MultiSelectGrid } from "@/components/tracker/MultiSelectGrid";
import { StepLayout } from "@/components/tracker/StepLayout";
import { ActionBar } from "@/components/tracker/ActionBar";
import {
  CheckCircle2, Timer, Zap, Wind, Waves, AlertCircle,
  ArrowRight,
  Check,
  Phone,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────
// Step types
// ─────────────────────────────────────────────────────────────
export type AnxietyTrackerStep = "type" | "body" | "urgency" | "details" | "reaction" | "done";
type Step = AnxietyTrackerStep;
const STEP_ORDER: Step[] = ["type", "body", "urgency", "details", "reaction"];

// ─────────────────────────────────────────────────────────────
// Option lists (stored as English canonical values)
// ─────────────────────────────────────────────────────────────
const ANXIETY_TYPES = [
  "Panic spike",
  "Health anxiety",
  "Dread",
  "Racing thoughts",
  "Social anxiety",
  "Generalized worry",
  "Shame / fear after use",
  "Future fear",
  "Body anxiety",
];

const BODY_LOCATIONS = [
  "Chest", "Stomach", "Throat", "Head",
  "Arms", "Legs", "Whole body", "Not in one place / not sure",
];
const WHOLE_BODY = "Whole body";
const NO_SPECIFIC_BODY_LOCATION = "Not in one place / not sure";
const ANXIETY_TYPE_MAX_SELECTIONS = 2;

/** Exact selection behavior used by the Anxiety type grid. */
export function toggleAnxietyTypeSelection(values: string[], value: string): string[] {
  if (values.includes(value)) return values.filter((item) => item !== value);
  if (values.length >= ANXIETY_TYPE_MAX_SELECTIONS) return values;
  return [...values, value];
}

/** Keep broad or uncertain answers from contradicting specific locations. */
export function normalizeAnxietyBodyLocations(values: string[]): string[] {
  let unique = [...new Set(values)];
  if (unique.length > 1 && unique.includes(NO_SPECIFIC_BODY_LOCATION)) {
    unique = unique.filter((value) => value !== NO_SPECIFIC_BODY_LOCATION);
  }
  if (unique.length > 1 && unique.includes(WHOLE_BODY)) {
    return unique.filter((value) => value !== WHOLE_BODY);
  }
  return unique;
}

export function toggleAnxietyBodyLocation(values: string[], value: string): string[] {
  const normalized = normalizeAnxietyBodyLocations(values);
  if (value === NO_SPECIFIC_BODY_LOCATION) {
    return normalized.includes(NO_SPECIFIC_BODY_LOCATION) ? [] : [NO_SPECIFIC_BODY_LOCATION];
  }
  if (value === WHOLE_BODY) {
    return normalized.includes(WHOLE_BODY) ? [] : [WHOLE_BODY];
  }
  const withoutBroadAnswer = normalized.filter((item) =>
    item !== WHOLE_BODY && item !== NO_SPECIFIC_BODY_LOCATION);
  return withoutBroadAnswer.includes(value)
    ? withoutBroadAnswer.filter((item) => item !== value)
    : [...withoutBroadAnswer, value];
}

export function canProceedAnxietyStep(
  step: AnxietyTrackerStep,
  anxietyTypes: string[],
  bodyLocations: string[],
  urgencyHigh: boolean | null,
  reaction: string,
): boolean {
  switch (step) {
    case "type":     return anxietyTypes.length > 0;
    case "body":     return bodyLocations.length > 0;
    case "urgency":  return urgencyHigh !== null;
    case "reaction": return reaction !== "";
    default:          return true;
  }
}

export function withAnxietyOutcome(
  log: AnxietyLog,
  outcomeAfter: AnxietyLog["outcomeAfter"],
): AnxietyLog {
  return {
    ...log,
    outcomeAfter,
    answers: { ...log.answers, outcomeAfter: outcomeAfter ?? null },
  };
}

interface AnxietyAnswersInput {
  anxietyTypes: string[];
  intensity: number | null;
  bodyLocations: string[];
  bodyPrediction: string;
  urgencyHigh: boolean;
  context: string;
  triggers: string[];
  reassuranceSeeking: string[];
  linkedStates: string[];
  reaction: string;
  note: string;
}

function optionalStableOptionId(value: string): string | null {
  return value === "" ? null : toStableOptionId(value);
}

function optionalStableOptionIds(values: string[]): string[] | null {
  return values.length === 0 ? null : toStableOptionIds(values);
}

function optionalTrimmedText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function buildAnxietyAnswers(
  input: AnxietyAnswersInput,
): NonNullable<AnxietyLog["answers"]> {
  return {
    anxietyTypes: toStableOptionIds(input.anxietyTypes),
    intensity: input.intensity,
    bodyLocations: toStableOptionIds(input.bodyLocations),
    bodyPrediction: optionalTrimmedText(input.bodyPrediction),
    urgencyHigh: input.urgencyHigh,
    context: optionalStableOptionId(input.context),
    triggers: optionalStableOptionIds(input.triggers),
    reassuranceSeeking: optionalStableOptionIds(input.reassuranceSeeking),
    linkedStates: optionalStableOptionIds(input.linkedStates),
    reaction: toStableOptionId(input.reaction),
    note: optionalTrimmedText(input.note),
    outcomeAfter: null,
  };
}

const CONTEXTS = [
  "Social — with unknowns",
  "Work / performance",
  "Alone",
  "After using / crash",
  "Nothing specific",
  "Other",
];

const TRIGGERS = [
  "Feeling observed",
  "Thought about appearance",
  "Silence / nothing to do",
  "Social expectation",
  "Fear of judgment",
  "Something else",
];

const REASSURANCE_SEEKING = [
  "Googling symptoms / reassurance",
  "Checking body or pulse",
  "Asking others repeatedly",
  "Avoiding the situation",
  "Ruminating / replaying",
  "Compulsive distraction",
];

export const REACTIONS = [
  "Sat with it — didn't react",
  "Tried to fix myself",
  "Avoided or left",
  "Searched for distraction",
  "Talked more / overcompensated",
  "Used a tool (breathing, grounding…)",
  "Reached out to someone",
  "Not yet / just logging",
];

const ANXIETY_COMPLETION_MESSAGE_KEYS: Record<string, string> = {
  "Sat with it — didn't react": "anxiety.msg.sat_with",
  "Used a tool (breathing, grounding…)": "anxiety.msg.used_tool",
  "Reached out to someone": "anxiety.msg.reached_out",
  "Tried to fix myself": "anxiety.msg.tried_fix",
  "Avoided or left": "anxiety.msg.avoided",
  "Searched for distraction": "anxiety.msg.distracted",
  "Talked more / overcompensated": "anxiety.msg.overcompensated",
};

export function getAnxietyCompletionCopy(
  reaction: string,
  urgencyHigh: boolean,
  language: "en" | "nl",
  translate: (key: string) => string,
): { message: string; medicalCaveat: string } {
  const message = urgencyHigh
    ? (language === "nl"
        ? "Je registratie is opgeslagen. Omdat je dit als dringend hebt gemarkeerd, is beoordeling of ondersteuning door een persoon belangrijk."
        : "Your log is saved. Because you marked this as urgent, assessment or support from a person is important.")
    : translate(ANXIETY_COMPLETION_MESSAGE_KEYS[reaction] ?? "anxiety.msg.default");
  return {
    message,
    medicalCaveat: translate("anxiety.medical_caveat"),
  };
}

const LINKED_STATES = [
  "This is triggering a craving",
  "This started from restlessness",
  "Poor sleep contributed",
  "After a conflict",
  "After substance use",
  "Not connected to anything specific",
];
const NONE_LINKED = "Not connected to anything specific";

const OUTCOMES = [
  { value: "decreased", label: "Decreased" },
  { value: "same", label: "Same" },
  { value: "increased", label: "Increased" },
  { value: "dont-know", label: "Don't know" },
];

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────
interface AnxietyDraft {
  anxietyTypes: string[];
  intensity: number | null;
  bodyLocations: string[];
  bodyPrediction: string;
  urgencyHigh: boolean | null;
  context: string;
  triggers: string[];
  reassuranceSeeking: string[];
  linkedStates: string[];
  reaction: string;
  showNote: boolean;
  note: string;
  outcome: string;
}

export function AnxietyTracker() {
  const { completeQuickReflection } = useRecoveryFeatures();
  const [, navigate] = useLocation();
  const {
    logAnxiety,
    updateAnxiety,
    anxietyLogs,
    crisisService,
  } = useStore();
  const { t, tOpt, language } = useT();
  const safetyCopy = getUrgentSafetyCopy(language);

  const reg = useActiveRegistration();
  const matchedRef = useRef(
    reg.session && reg.session.type === "anxiety" ? reg.session : null,
  );
  const m = matchedRef.current;
  const md = m?.draft as AnxietyDraft | undefined;

  const [step, setStep] = useState<Step>(() => (m ? (m.step as Step) : "type"));
  const [saving, setSaving] = useState(false);
  const [outcomeWriting, setOutcomeWriting] = useState(false);
  const [leavingHome, setLeavingHome] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saveLock = useRef(false);
  const outcomeLock = useRef(false);
  const isWriting = saving || outcomeWriting || leavingHome;

  // Step 1 — type + intensity
  const [anxietyTypes, setAnxietyTypes] = useState<string[]>(() => md?.anxietyTypes ?? []);
  const [intensity, setIntensity] = useState<number | null>(() => md?.intensity ?? null);

  // Step 2 — body
  const [bodyLocations, setBodyLocations] = useState<string[]>(() =>
    normalizeAnxietyBodyLocations(md?.bodyLocations ?? []));
  const [bodyPrediction, setBodyPrediction] = useState(() => md?.bodyPrediction ?? "");

  // Step 3 — urgency + context + reassurance
  const [urgencyHigh, setUrgencyHigh] = useState<boolean | null>(() => md?.urgencyHigh ?? null);
  const [context, setContext] = useState(() => md?.context ?? "");
  const [triggers, setTriggers] = useState<string[]>(() => md?.triggers ?? []);
  const [reassuranceSeeking, setReassuranceSeeking] = useState<string[]>(() => md?.reassuranceSeeking ?? []);
  const [linkedStates, setLinkedStates] = useState<string[]>(() => md?.linkedStates ?? []);

  // Step 4 — reaction + note
  const [reaction, setReaction] = useState(() => md?.reaction ?? "");
  const [showNote, setShowNote] = useState(() => md?.showNote ?? false);
  const [note, setNote] = useState(() => md?.note ?? "");

  // Done — outcome follow-up
  const [savedLog, setSavedLog] = useState<AnxietyLog | null>(() => {
    const id = m?.savedLogId;
    return id ? anxietyLogs.find((log) => log.id === id) ?? null : null;
  });
  const [outcome, setOutcome] = useState(() => md?.outcome ?? "");

  // Persisted draft snapshot — resume after tab switch / reload.
  const draft = useMemo<AnxietyDraft>(
    () => ({
      anxietyTypes, intensity, bodyLocations, bodyPrediction, urgencyHigh,
      context, triggers, reassuranceSeeking, linkedStates, reaction, showNote, note, outcome,
    }),
    [anxietyTypes, intensity, bodyLocations, bodyPrediction, urgencyHigh,
     context, triggers, reassuranceSeeking, linkedStates, reaction, showNote, note, outcome],
  );

  useEffect(() => {
    if (!matchedRef.current) {
      reg.startSession({
        type: "anxiety",
        route: "/anxiety",
        step,
        draft,
        stepIndex: STEP_ORDER.indexOf(step) + 1 || STEP_ORDER.length,
        stepCount: STEP_ORDER.length,
      });
    } else if (matchedRef.current.pendingReturn) {
      reg.patchSession({ pendingReturn: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const firstSync = useRef(true);
  useEffect(() => {
    if (firstSync.current) {
      firstSync.current = false;
      return;
    }
    reg.patchSession({
      step,
      draft,
      stepIndex: STEP_ORDER.indexOf(step) + 1 || STEP_ORDER.length,
      stepCount: STEP_ORDER.length,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, draft]);

  useEffect(() => {
    const id = m?.savedLogId;
    if (!savedLog && id) {
      const restored = anxietyLogs.find((log) => log.id === id);
      if (restored) {
        setSavedLog(restored);
        if (!outcome && restored.outcomeAfter) {
          setOutcome(restored.outcomeAfter === "unknown" ? "dont-know" : restored.outcomeAfter);
        }
      }
    }
  }, [anxietyLogs, m?.savedLogId, outcome, savedLog]);

  const toggle = (set: React.Dispatch<React.SetStateAction<string[]>>, val: string) =>
    set((prev) => prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]);

  // "Not connected to anything specific" is mutually exclusive with the rest
  const toggleLinkedState = (val: string) => {
    setLinkedStates((prev) => {
      if (val === NONE_LINKED) return prev.includes(val) ? [] : [val];
      const next = prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val];
      return next.filter((x) => x !== NONE_LINKED);
    });
  };

  const stepIdx = STEP_ORDER.indexOf(step);
  const totalSteps = STEP_ORDER.length;

  // Gate "Next": every required question on the current step must be answered.
  const canProceed = useMemo(
    () => canProceedAnxietyStep(step, anxietyTypes, bodyLocations, urgencyHigh, reaction),
    [step, anxietyTypes, bodyLocations, urgencyHigh, reaction],
  );

  async function handleSave() {
    if (
      saveLock.current ||
      anxietyTypes.length === 0 ||
      bodyLocations.length === 0 ||
      urgencyHigh === null ||
      reaction === ""
    ) return;
    saveLock.current = true;
    setSaving(true);
    setError(null);
    try {
      const completedAt = Date.now();
      const startedAt = reg.session?.startedAt ?? completedAt;
      const occurredAt = reg.session?.quickRegistrationTimestamp ?? startedAt;
      const saved = await logAnxiety({
        timestamp: occurredAt,
        occurredAt,
        startedAt,
        completedAt,
        dataVersion: CURRENT_REGISTRATION_DATA_VERSION,
        contentVersion: CURRENT_REGISTRATION_CONTENT_VERSION,
        answers: {
          ...buildAnxietyAnswers({
            anxietyTypes,
            intensity,
            bodyLocations,
            bodyPrediction,
            urgencyHigh,
            context,
            triggers,
            reassuranceSeeking,
            linkedStates,
            reaction,
            note,
          }),
          quickRegistrationId: reg.session?.quickRegistrationId ?? null,
        },
        intensity,
        context,
        // The UI asks for multiple triggers/linked states and never asks the
        // person to nominate a primary one. Keep the legacy scalar fields
        // empty instead of silently promoting the first selected answer.
        trigger: "",
        bodySensations: bodyLocations,
        reaction,
        note: note.trim(),
        anxietyTypes,
        bodyLocations,
        bodyPrediction: bodyPrediction.trim(),
        urgencyHigh,
        reassuranceSeeking,
        linkedState: "",
        triggers,
        linkedStates,
        outcomeAfter: null,
      });
      setSavedLog(saved);
      reg.patchSession({ savedLogId: saved.id, step: "done", draft });
      setStep("done");
      void completeQuickReflection(reg.session?.quickRegistrationId, "anxiety", saved.id).catch(() => undefined);
    } catch {
      setError(
        language === "nl"
          ? "Opslaan is niet gelukt. Probeer het opnieuw."
          : "Saving failed. Please try again.",
      );
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }

  const applyOutcome = useCallback(async (next: string) => {
    if (!savedLog || outcomeLock.current) return;
    outcomeLock.current = true;
    setOutcomeWriting(true);
    setError(null);
    try {
      const real = next === "dont-know"
        ? "unknown"
        : (["decreased", "same", "increased"] as const).find((item) => item === next) ?? null;
      const updated = withAnxietyOutcome(savedLog, real);
      await updateAnxiety(updated);
      setSavedLog(updated);
      setOutcome(next);
    } catch {
      setError(
        language === "nl"
          ? "De uitkomst kon niet worden opgeslagen. Probeer het opnieuw."
          : "The outcome could not be saved. Please try again.",
      );
    } finally {
      outcomeLock.current = false;
      setOutcomeWriting(false);
    }
  }, [language, savedLog, updateAnxiety]);

  const openSupportRoute = useCallback(async (path: string) => {
    if (isWriting) return;
    if (path === "/craving" || path === "/boredom") {
      setLeavingHome(true);
      setError(null);
      try {
        // The Anxiety record is already saved on the done screen. Close its
        // resumable session before starting a different registration type so
        // the destination cannot silently replace a pending Anxiety return.
        await reg.clearSession();
        navigate(path);
      } catch {
        setError(
          language === "nl"
            ? "De registratie is opgeslagen, maar de volgende registratie kon niet worden gestart. Probeer opnieuw."
            : "The log is saved, but the next registration could not be started. Please try again.",
        );
        setLeavingHome(false);
      }
      return;
    }
    setLeavingHome(true);
    setError(null);
    try {
      const returnSaved = await reg.patchSession({
        pendingReturn: { returnRoute: "/anxiety", returnStep: step },
      });
      if (!returnSaved) throw new Error("Anxiety return route could not be saved.");
      navigate(path);
    } catch {
      setError(
        language === "nl"
          ? "Het hulpmiddel kon niet veilig worden geopend. Je blijft op deze registratie; probeer opnieuw."
          : "The tool could not be opened safely. You are still on this log; please try again.",
      );
      setLeavingHome(false);
    }
  }, [isWriting, language, navigate, reg, step]);

  const goHome = useCallback(async () => {
    if (isWriting) return;
    setLeavingHome(true);
    setError(null);
    try {
      if (!(await reg.completeSession())) {
        throw new Error("Anxiety registration could not be completed.");
      }
      navigate("/");
    } catch {
      setError(
        language === "nl"
          ? "De registratie is opgeslagen, maar afsluiten lukte niet. Probeer opnieuw."
          : "The log is saved, but closing it failed. Please try again.",
      );
    } finally {
      setLeavingHome(false);
    }
  }, [isWriting, language, navigate, reg]);

  function goNext() {
    if (isWriting) return;
    if (step === "type") setStep("body");
    else if (step === "body") setStep("urgency");
    else if (step === "urgency") setStep("details");
    else if (step === "details") setStep("reaction");
    else if (step === "reaction") handleSave();
  }
  function goBack() {
    if (isWriting) return;
    if (step === "body") setStep("type");
    else if (step === "urgency") setStep("body");
    else if (step === "details") setStep("urgency");
    else if (step === "reaction") setStep("details");
  }

  const completionCopy = getAnxietyCompletionCopy(reaction, urgencyHigh === true, language, t);

  const urgentSupportPanel = (
    <div className="w-full max-w-xs rounded-2xl border border-amber-500/50 bg-card p-4 text-left">
      <div className="mb-2 flex items-center gap-2">
        <Phone size={16} className="text-amber-500" />
        <p className="text-sm font-semibold text-foreground">{safetyCopy.title}</p>
      </div>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
        <p>{safetyCopy.assessmentLimit}</p>
        <p>{safetyCopy.emergency}</p>
        <p>{safetyCopy.selfHarm}</p>
        <p>{safetyCopy.humanHelp}</p>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        <a href="tel:112" className="text-sm font-semibold text-primary">{safetyCopy.call112}</a>
        <a href="tel:113" className="text-sm font-semibold text-primary">{safetyCopy.call113}</a>
        <a href="tel:08000113" className="text-sm font-semibold text-primary">{safetyCopy.call0800}</a>
        <a href="https://www.113.nl" target="_blank" rel="noreferrer" className="text-sm font-semibold text-primary">{safetyCopy.visit113}</a>
        {crisisService?.number && <CareContactCard service={crisisService} language={language} />}
      </div>
    </div>
  );

  return (
    <StepLayout
      title={t("anxiety.title")}
      subtitle={step !== "done" ? t("common.step_of").replace("{n}", String(stepIdx + 1)).replace("{total}", String(totalSteps)) : undefined}
      back={!isWriting}
      step={step !== "done" ? { current: stepIdx + 1, total: totalSteps } : undefined}
      actionBar={
        step !== "done" ? (
          <ActionBar
            showBack={step !== "type"}
            onBack={goBack}
            onNext={goNext}
            nextIsSubmit={step === "reaction"}
            saving={saving}
            canProceed={canProceed}
            backLabel={t("common.back")}
            nextLabel={t("common.next")}
            saveLabel={t("common.save")}
            savingLabel={t("common.saving")}
          />
        ) : undefined
      }
    >

        {/* ── Step 1: Type + Intensity ─────────────────────── */}
        {step === "type" && (
          <>
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-1">
                {t("anxiety.q.type")}{" "}
                <span className="text-muted-foreground font-normal text-sm">({t("common.required")})</span>
              </h2>
              <p className="text-sm text-muted-foreground">{t("anxiety.q.type_sub")}</p>
            </div>
            <MultiSelectGrid
              options={ANXIETY_TYPES}
              value={anxietyTypes}
              onToggle={(value) => setAnxietyTypes((previous) =>
                toggleAnxietyTypeSelection(previous, value))}
              translate={tOpt}
              maxSelections={ANXIETY_TYPE_MAX_SELECTIONS}
              selectionLabel={t("tracker.selection_limit")}
            />

            <div className="h-px bg-border" />

            <div>
              <h3 className="text-base font-medium text-foreground mb-1">
                {t("anxiety.q.intensity")}{" "}
                <span className="text-muted-foreground font-normal text-sm">({t("common.optional")})</span>
              </h3>
              <p className="text-xs text-muted-foreground mb-3">{t("anxiety.q.intensity_note")}</p>
              <IntensitySlider
                value={intensity}
                onChange={setIntensity}
                label={t("anxiety.intensity_slider")}
                min={0}
                lowLabel="0"
                highLabel="10"
              />
            </div>
          </>
        )}

        {/* ── Step 2: Body + Prediction ─────────────────────── */}
        {step === "body" && (
          <>
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-1">
                {t("anxiety.q.body")}{" "}
                <span className="text-muted-foreground font-normal text-sm">({t("common.required")})</span>
              </h2>
              <p className="text-sm text-muted-foreground">{t("anxiety.q.body_sub")}</p>
            </div>
            <MultiSelectGrid
              options={BODY_LOCATIONS}
              value={bodyLocations}
              onToggle={(value) => setBodyLocations((previous) =>
                toggleAnxietyBodyLocation(previous, value))}
              cols={3}
              translate={tOpt}
            />

            <div className="h-px bg-border" />

            <div>
              <h3 className="text-base font-medium text-foreground mb-1">
                {t("anxiety.q.prediction")}{" "}
                <span className="text-muted-foreground font-normal text-sm">({t("common.optional")})</span>
              </h3>
              <p className="text-xs text-muted-foreground mb-3">{t("anxiety.q.prediction_sub")}</p>
              <textarea
                value={bodyPrediction}
                onChange={(e) => setBodyPrediction(e.target.value)}
                placeholder={t("anxiety.q.prediction_placeholder")}
                rows={3}
                className="w-full bg-card border border-input rounded-2xl px-4 py-3.5 text-foreground placeholder:text-muted-foreground/40 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </>
        )}

        {/* ── Step 3: Urgency + Context + Reassurance ──────── */}
        {step === "urgency" && (
          <>
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-1">
                {t("anxiety.q.urgency")}{" "}
                <span className="text-muted-foreground font-normal text-sm">({t("common.required")})</span>
              </h2>
            </div>

            {/* Urgency toggle */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setUrgencyHigh(urgencyHigh === true ? null : true)}
                aria-pressed={urgencyHigh === true}
                className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all touch-target ${
                  urgencyHigh === true
                    ? "bg-primary border-primary text-primary-foreground"
                    : "bg-card border-border text-muted-foreground hover:border-primary/30"
                }`}
              >
                <AlertCircle size={22} />
                <span className="text-sm font-medium text-center leading-tight flex items-center gap-1">
                  {t("anxiety.urgency.high")}
                  {urgencyHigh === true && <Check size={14} strokeWidth={3} />}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setUrgencyHigh(urgencyHigh === false ? null : false)}
                aria-pressed={urgencyHigh === false}
                className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all touch-target ${
                  urgencyHigh === false
                    ? "bg-primary border-primary text-primary-foreground"
                    : "bg-card border-border text-muted-foreground hover:border-primary/30"
                }`}
              >
                <Wind size={22} />
                <span className="text-sm font-medium text-center leading-tight flex items-center gap-1">
                  {t("anxiety.urgency.low")}
                  {urgencyHigh === false && <Check size={14} strokeWidth={3} />}
                </span>
              </button>
            </div>

            {urgencyHigh === true && urgentSupportPanel}

            {/* Coping shortcuts complement, but do not replace, human help. */}
            {urgencyHigh === true && (
              <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3">
                <p className="text-sm font-medium text-foreground">{t("anxiety.quick_tools")}</p>
                {[
                  { labelKey: "anxiety.quick.breathing", path: "/tools/breathing", icon: <Wind size={15} /> },
                  { labelKey: "tools.grounding", path: "/tools/grounding", icon: <Waves size={15} /> },
                  { labelKey: "tools.cold_water", path: "/tools/cold-water", icon: <Zap size={15} /> },
                  { labelKey: "common.delay_timer", path: "/delay", icon: <Timer size={15} /> },
                ].map(({ labelKey, path, icon }) => (
                  <button
                    type="button"
                    key={path}
                    disabled={isWriting}
                    onClick={() => openSupportRoute(path)}
                    className="flex items-center gap-3 text-sm text-foreground bg-muted rounded-xl px-4 py-3 hover:bg-muted/80 transition-colors touch-target text-left disabled:opacity-50"
                  >
                    <span className="text-primary">{icon}</span>
                    <span className="font-medium">{t(labelKey)}</span>
                    <ArrowRight size={14} className="ml-auto text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}

          </>
        )}

        {/* ── Step 4: Context & patterns ───────────────────── */}
        {step === "details" && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">{t("anxiety.q.details")}</h2>
              <button
                type="button"
                disabled={isWriting}
                onClick={() => setStep("reaction")}
                className="text-sm text-primary hover:opacity-75 transition-opacity touch-target disabled:opacity-50"
              >
                {t("common.skip")}
              </button>
            </div>

            {/* Context */}
            <div>
              <h3 className="text-base font-medium text-foreground mb-3">
                {t("anxiety.q.context")}{" "}
                <span className="text-muted-foreground font-normal text-sm">({t("common.optional")})</span>
              </h3>
              <ChipCol options={CONTEXTS} value={context} onChange={setContext} translate={tOpt} />
            </div>

            {/* Linked state */}
            <div>
              <h3 className="text-base font-medium text-foreground mb-3">
                {t("anxiety.q.linked")}{" "}
                <span className="text-muted-foreground font-normal text-sm">({t("common.optional")})</span>
              </h3>
              <MultiSelectGrid cols={1} options={LINKED_STATES} value={linkedStates} onToggle={toggleLinkedState} translate={tOpt} />
            </div>

            {/* Reassurance-seeking */}
            <div>
              <h3 className="text-base font-medium text-foreground mb-1">
                {t("anxiety.q.patterns")}{" "}
                <span className="text-muted-foreground font-normal text-sm">({t("common.optional")})</span>
              </h3>
              <p className="text-xs text-muted-foreground mb-3">{t("anxiety.q.patterns_sub")}</p>
              <MultiSelectGrid cols={1} options={REASSURANCE_SEEKING} value={reassuranceSeeking} onToggle={(v) => toggle(setReassuranceSeeking, v)} translate={tOpt} />
            </div>

            {/* Trigger (optional) */}
            <div>
              <h3 className="text-base font-medium text-foreground mb-3">
                {t("anxiety.q.trigger")}{" "}
                <span className="text-muted-foreground font-normal text-sm">({t("common.optional")})</span>
              </h3>
              <MultiSelectGrid cols={1} options={TRIGGERS} value={triggers} onToggle={(v) => toggle(setTriggers, v)} translate={tOpt} />
            </div>
          </>
        )}

        {/* ── Step 5: Reaction + Note ───────────────────────── */}
        {step === "reaction" && (
          <>
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-1">
                {t("anxiety.q.reaction")}{" "}
                <span className="text-muted-foreground font-normal text-sm">({t("common.required")})</span>
              </h2>
              <p className="text-sm text-muted-foreground">{t("anxiety.q.reaction_sub")}</p>
            </div>
            <ChipCol options={REACTIONS} value={reaction} onChange={setReaction} translate={tOpt} />

            {!showNote ? (
              <button
                type="button"
                onClick={() => setShowNote(true)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors text-left"
              >
                {t("common.add_note")} ({t("common.optional")})
              </button>
            ) : (
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("common.note_placeholder")}
                rows={3}
                className="w-full bg-card border border-input rounded-2xl px-4 py-3.5 text-foreground placeholder:text-muted-foreground/50 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
            )}
          </>
        )}

        {step !== "done" && error && (
          <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}

        {/* ── Done ──────────────────────────────────────────── */}
        {step === "done" && (
          <div className="flex flex-col items-center text-center gap-6 pt-8">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 size={32} className="text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-2">{t("common.logged")}</h2>
              <p className="text-base text-muted-foreground leading-relaxed max-w-xs mx-auto">
                {completionCopy.message}
              </p>
            </div>

            <p
              role="note"
              className="w-full max-w-xs rounded-2xl border border-border bg-card px-4 py-3 text-left text-sm leading-relaxed text-muted-foreground"
            >
              {completionCopy.medicalCaveat}
            </p>

            {urgencyHigh === true && urgentSupportPanel}

            {/* Routing based on linked state */}
            {linkedStates.includes("This is triggering a craving") && (
              <button
                type="button"
                disabled={isWriting}
                onClick={() => openSupportRoute("/craving")}
                className="flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-2xl px-5 py-3.5 text-sm font-medium text-foreground hover:bg-primary/15 transition-colors touch-target disabled:opacity-50"
              >
                <Zap size={16} className="text-primary" />
                {t("craving.title")} →
              </button>
            )}
            {linkedStates.includes("This started from restlessness") && (
              <button
                type="button"
                disabled={isWriting}
                onClick={() => openSupportRoute("/boredom")}
                className="flex items-center gap-2 bg-card border border-border rounded-2xl px-5 py-3.5 text-sm font-medium text-foreground hover:border-primary/40 transition-colors touch-target disabled:opacity-50"
              >
                {t("boredom.title")} →
              </button>
            )}

            {/* Outcome follow-up */}
            <div className="w-full max-w-xs flex flex-col gap-3 text-left">
              <div>
                <p className="text-base font-medium text-foreground">
                  {t("anxiety.q.outcome")}
                  <span className="text-muted-foreground font-normal text-xs ml-2">({t("common.optional")})</span>
                </p>
                <p className="text-sm text-muted-foreground">{t("anxiety.q.outcome_sub")}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {OUTCOMES.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    disabled={isWriting || !savedLog}
                    onClick={() => {
                      const next = outcome === value ? "" : value;
                      void applyOutcome(next);
                    }}
                    aria-pressed={outcome === value}
                    className={`py-3 px-3 rounded-2xl border text-sm font-medium transition-all touch-target ${
                      outcome === value
                        ? "bg-primary/10 border-primary text-foreground"
                        : "bg-card border-border text-muted-foreground"
                    } disabled:opacity-50`}
                  >
                    {tOpt(label)}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p role="alert" className="w-full max-w-xs rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-left text-sm text-destructive">
                {error}
              </p>
            )}

            <div className="flex flex-col gap-3 w-full max-w-xs">
              <BriefCompassionButton disabled={isWriting} onOpen={() => void openSupportRoute("/tools/self-compassion/brief")} />
              <button
                type="button"
                disabled={isWriting}
                onClick={() => openSupportRoute("/delay")}
                className="flex items-center justify-center gap-2 bg-card border border-border rounded-2xl px-5 py-3.5 text-sm font-medium text-foreground hover:border-primary/40 transition-colors touch-target disabled:opacity-50"
              >
                <Timer size={16} className="text-primary" />
                {t("common.delay_timer")}
              </button>
              <button
                type="button"
                disabled={isWriting}
                onClick={() => openSupportRoute("/tools")}
                className="flex items-center justify-center gap-2 bg-card border border-border rounded-2xl px-5 py-3.5 text-sm font-medium text-foreground hover:border-primary/40 transition-colors touch-target disabled:opacity-50"
              >
                {t("common.browse_tools")}
              </button>
              <button
                type="button"
                disabled={isWriting}
                onClick={goHome}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors touch-target disabled:opacity-50"
              >
                {t("common.done_home")}
              </button>
            </div>
          </div>
        )}
    </StepLayout>
  );
}
