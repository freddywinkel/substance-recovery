import { useState, useCallback, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useStore } from "@/hooks/useStore";
import { useT } from "@/hooks/useTranslation";
import { PageHeader } from "@/components/PageHeader";
import { useResumableDraft } from "@/contexts/ActiveRegistrationContext";
import { IntensitySlider } from "@/components/tracker/IntensitySlider";
import { ChipCol } from "@/components/tracker/ChipCol";
import { MultiSelectGrid } from "@/components/tracker/MultiSelectGrid";
import { StepLayout } from "@/components/tracker/StepLayout";
import { ActionBar } from "@/components/tracker/ActionBar";
import { AlertTriangle, Flame, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { RegistrationAnswerValue } from "@/db";
import {
  CURRENT_REGISTRATION_CONTENT_VERSION,
  CURRENT_REGISTRATION_DATA_VERSION,
} from "@/db/migrations";
import { removeHiddenOtherText, toStableOptionId, toStableOptionIds } from "@/lib/registrationIds";
import { getSubstanceSafetyWarnings, getUrgentSafetyCopy } from "@/lib/registrationSafety";
import { useRecoveryFeatures } from "@/contexts/RecoveryFeaturesContext";

// ── Step type ────────────────────────────────────────────────
type Step = "type" | "planning" | "inner" | "need" | "substance" | "action" | "outcome" | "done";
const STEP_ORDER: Step[] = ["type", "planning", "inner", "need", "substance", "action", "outcome"];

// ── Option lists ─────────────────────────────────────────────
// One axis only: the observable form that movement toward acting is taking.
// Motive, trigger/context and immediacy each have their own later question.
// These explicit IDs are persisted as-is; labels live in the EN/NL option maps.
const TREK_TYPES = [
  "approach-mental-rehearsal",
  "approach-checking-availability",
  "approach-arranging-access",
  "approach-moving-toward",
  "approach-automatic-routine",
  "approach-responding-to-contact",
  "approach-not-sure",
];
const UNKNOWN_TREK_FORM = "approach-not-sure";

/** An explicit unknown form cannot coexist with a specific observed form. */
export function toggleTrekTypeSelection(selected: string[], value: string): string[] {
  if (value === UNKNOWN_TREK_FORM) {
    return selected.includes(value) ? [] : [value];
  }
  const specific = selected.filter((item) => item !== UNKNOWN_TREK_FORM);
  if (specific.includes(value)) return specific.filter((item) => item !== value);
  return specific.length < 2 ? [...specific, value] : specific;
}

// A separate axis: how immediate acting is, independent of its form or motive.
const PLANNING_STAGES = [
  "immediacy-thoughts-only",
  "immediacy-steps-started",
  "immediacy-access-close",
  "immediacy-about-to-act",
];

const TREK_LOCATIONS = [
  "Home",
  "Work",
  "Outside",
  "Shop or bar",
  "In transit",
  "Someone else's place",
  "Other",
];

const TREK_TRIGGERS = [
  "No clear trigger / not sure",
  "Boredom",
  "Stress",
  "Habit / routine",
  "Social pressure",
  "Money available",
  "Feeling good / celebratory",
  "Conflict",
  "Other",
];

const NO_CLEAR_TREK_TRIGGER = "No clear trigger / not sure";

/** "Not sure" is a complete answer and cannot coexist with specific triggers. */
export function toggleTrekTriggerSelection(
  selected: string[],
  value: string,
): string[] {
  if (value === NO_CLEAR_TREK_TRIGGER) {
    return selected.includes(value) ? [] : [value];
  }
  const specific = selected.filter((item) => item !== NO_CLEAR_TREK_TRIGGER);
  return specific.includes(value)
    ? specific.filter((item) => item !== value)
    : [...specific, value];
}

const TREK_NEEDS = [
  "Relief",
  "Excitement",
  "Reward",
  "Numbness",
  "Comfort",
  "Connection",
  "Stimulation",
  "Escape",
  "Not sure",
  "Other",
];
const UNKNOWN_TREK_NEED = "Not sure";

/** An explicit unknown need is an answer, but cannot coexist with guessed needs. */
export function toggleTrekNeedSelection(selected: string[], value: string): string[] {
  if (value === UNKNOWN_TREK_NEED) {
    return selected.includes(value) ? [] : [value];
  }
  const specific = selected.filter((item) => item !== UNKNOWN_TREK_NEED);
  return specific.includes(value)
    ? specific.filter((item) => item !== value)
    : [...specific, value];
}

const TREK_ACTIONS = [
  { value: "remove-access", label: "Remove access or money", msgKey: "trek.msg.remove_access" },
  { value: "change-location", label: "Change location", msgKey: "trek.msg.change_location" },
  { value: "delay-timer", label: "Use delay timer", msgKey: "trek.msg.delay", tool: "/delay" },
  { value: "call-someone", label: "Call or text someone", msgKey: "trek.msg.call" },
  { value: "use-tool", label: "Use a tool from the toolbox", msgKey: "trek.msg.tool", tool: "/tools" },
  { value: "just-observe", label: "Just observe — don't act", msgKey: "trek.msg.observe" },
];

const SUBSTANCES = ["Alcohol", "Cannabis", "Cocaine / stimulant", "Benzodiazepines", "Nicotine", "Opioids", "Gambling", "Sex / pornography", "Gaming", "Food / binge eating"];

const BEHAVIOURAL_TARGETS = new Set([
  "Gambling",
  "Sex / pornography",
  "Gaming",
  "Food / binge eating",
]);

/**
 * Keep generic medical-emergency copy when the target is unknown or may be a
 * substance, but do not apply substance-oriented copy to behaviour-only entries.
 */
export function shouldShowMedicalSafetyForTargets(targets: string[]): boolean {
  return targets.length === 0 || targets.some((target) => !BEHAVIOURAL_TARGETS.has(target));
}

/** An after-action score has no saved meaning unless the action was attempted. */
export function confidenceAfterForAttempt(
  actionAttempted: boolean | null,
  confidenceAfter: number | null,
): number | null {
  return actionAttempted === true ? confidenceAfter : null;
}

// Inner-experience vocab — mirrors Logs.tsx C_EMOTIONS / C_PHYSICAL / C_THOUGHTS so the
// Logbook display, editor and analytics stay consistent with what the tracker captures.
const EMOTIONS = ["Anxious", "Tense", "Low / sad", "Empty", "Angry", "Frustrated", "Guilty", "Ashamed", "Lonely", "Bored", "Restless", "Overwhelmed", "Rejected", "Hopeless", "Excited / hyped", "Numb"];
const PHYSICAL = ["Restlessness", "Chest tightness", "Head pressure", "Nausea", "Sweating", "Trembling", "Rapid heartbeat", "Fatigue", "Empty feeling", "Nervous energy", "Feeling rushed", "Urge in the body"];
const THOUGHTS = ["I can't handle this", "Just one won't matter", "No one will notice", "I've earned this", "It doesn't matter anymore", "I just want peace", "I want to feel / stop feeling", "I'll start fresh tomorrow"];

const USE_OUTCOMES: { value: "not_used" | "used" | "unsure"; labelKey: string }[] = [
  { value: "not_used", labelKey: "tracker.outcome.not_used" },
  { value: "used", labelKey: "tracker.outcome.used" },
  { value: "unsure", labelKey: "tracker.outcome.unsure" },
];

// ── Draft state ───────────────────────────────────────────────
export interface TrekDraft {
  trekTypes: string[];
  intensity: number | null;
  confidenceBefore: number | null;
  planningStage: string;
  location: string;
  locationOther: string;
  triggers: string[];
  triggerNote: string;
  emotions: string[];
  emotionOther: string;
  physicalSensations: string[];
  thoughtPresets: string[];
  thoughtFreeText: string;
  needTypes: string[];
  needOther: string;
  substances: string[];
  chosenAction: string;
  actionAttempted: boolean | null;
  confidenceAfter: number | null;
  useOutcome: "" | "used" | "not_used" | "unsure";
}

export function createBlankTrekDraft(): TrekDraft {
  return {
    trekTypes: [],
    intensity: null,
    confidenceBefore: null,
    planningStage: "",
    location: "",
    locationOther: "",
    triggers: [],
    triggerNote: "",
    emotions: [],
    emotionOther: "",
    physicalSensations: [],
    thoughtPresets: [],
    thoughtFreeText: "",
    needTypes: [],
    needOther: "",
    substances: [],
    chosenAction: "",
    actionAttempted: null,
    confidenceAfter: null,
    useOutcome: "",
  };
}

function textOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}

function stableIdOrNull(value: string): string | null {
  return textOrNull(toStableOptionId(value));
}

function stableIdsOrNull(values: string[]): string[] | null {
  const ids = toStableOptionIds(values);
  return ids.length ? ids : null;
}

export function buildTrekAnswers(
  draft: TrekDraft,
): Record<string, RegistrationAnswerValue> {
  return {
    registrationType: "trek",
    trekTypes: toStableOptionIds(draft.trekTypes),
    intensity: draft.intensity,
    confidenceBefore: draft.confidenceBefore,
    planningStage: toStableOptionId(draft.planningStage),
    location: stableIdOrNull(draft.location),
    locationOther: textOrNull(removeHiddenOtherText(draft.location, draft.locationOther)),
    triggers: toStableOptionIds(draft.triggers),
    triggerNote: textOrNull(removeHiddenOtherText(draft.triggers, draft.triggerNote)),
    emotions: stableIdsOrNull(draft.emotions),
    emotionOther: textOrNull(draft.emotionOther),
    physicalSensations: stableIdsOrNull(draft.physicalSensations),
    thoughts: stableIdsOrNull(draft.thoughtPresets),
    thoughtFreeText: textOrNull(draft.thoughtFreeText),
    needs: toStableOptionIds(draft.needTypes),
    needOther: textOrNull(removeHiddenOtherText(draft.needTypes, draft.needOther)),
    targets: stableIdsOrNull(draft.substances),
    chosenAction: draft.chosenAction,
    actionAttempted: draft.actionAttempted,
    confidenceAfter: confidenceAfterForAttempt(draft.actionAttempted, draft.confidenceAfter),
    useOutcome: draft.useOutcome,
  };
}

export async function navigateAfterTrekReturnSaved(
  saveReturn: () => Promise<boolean>,
  navigate: () => void,
): Promise<boolean> {
  try {
    if (!(await saveReturn())) return false;
    navigate();
    return true;
  } catch {
    return false;
  }
}

function RequiredMarker({ language }: { language: "en" | "nl" }) {
  return (
    <span data-field-status="required" className="text-primary font-normal text-xs ml-2">
      ({language === "nl" ? "verplicht" : "required"})
    </span>
  );
}

// ── Main component ────────────────────────────────────────────
export function TrekTracker() {
  const { completeQuickReflection } = useRecoveryFeatures();
  const { step, setStep, draft, setDraft, reg } = useResumableDraft<Step, TrekDraft>({
    type: "trek",
    route: "/trek",
    firstStep: "type",
    makeBlank: createBlankTrekDraft,
    steps: STEP_ORDER,
  });
  const [saving, setSaving] = useState(false);
  const { logCraving } = useStore();
  const [, navigate] = useLocation();
  const { t, tOpt, language } = useT();
  const { toast } = useToast();
  const safetyCopy = getUrgentSafetyCopy(language);

  const STEP_LABELS: Record<Step, string> = {
    type: t("trek.step.type"),
    planning: t("trek.step.planning"),
    inner: t("craving.step.emotions"),
    need: t("trek.step.need"),
    substance: t("trek.step.substance"),
    action: t("trek.step.action"),
    outcome: t("craving.step.outcome"),
    done: t("trek.done.title"),
  };

  const update = useCallback(<K extends keyof TrekDraft>(key: K, value: TrekDraft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleType = useCallback((v: string) => {
    setDraft((prev) => {
      return { ...prev, trekTypes: toggleTrekTypeSelection(prev.trekTypes, v) };
    });
  }, []);

  const toggleSubstance = useCallback((v: string) => {
    setDraft((prev) => ({
      ...prev,
      substances: prev.substances.includes(v)
        ? prev.substances.filter((x) => x !== v)
        : [...prev.substances, v],
    }));
  }, []);

  const toggleTrigger = useCallback((v: string) => {
    setDraft((prev) => {
      const triggers = toggleTrekTriggerSelection(prev.triggers, v);
      return {
        ...prev,
        triggers,
        triggerNote: triggers.includes("Other") ? prev.triggerNote : "",
      };
    });
  }, []);

  const toggleNeed = useCallback((v: string) => {
    setDraft((prev) => {
      const needTypes = toggleTrekNeedSelection(prev.needTypes, v);
      return {
        ...prev,
        needTypes,
        needOther: needTypes.includes("Other") ? prev.needOther : "",
      };
    });
  }, []);

  // Selection limits are visible in the UI. Reaching a cap never removes an
  // earlier answer without the person explicitly deselecting it.
  const toggleEmotion = useCallback((v: string) => {
    setDraft((prev) => {
      const arr = prev.emotions;
      return { ...prev, emotions: arr.includes(v) ? arr.filter((x) => x !== v) : arr.length < 3 ? [...arr, v] : arr };
    });
  }, []);

  const togglePhysical = useCallback((v: string) => {
    setDraft((prev) => {
      const arr = prev.physicalSensations;
      return { ...prev, physicalSensations: arr.includes(v) ? arr.filter((x) => x !== v) : arr.length < 3 ? [...arr, v] : arr };
    });
  }, []);

  const toggleThought = useCallback((v: string) => {
    setDraft((prev) => {
      const arr = prev.thoughtPresets;
      return { ...prev, thoughtPresets: arr.includes(v) ? arr.filter((x) => x !== v) : arr.length < 2 ? [...arr, v] : arr };
    });
  }, []);

  const canProceed = useMemo(() => {
    switch (step) {
      case "type":     return draft.trekTypes.length > 0;
      case "planning": return draft.planningStage !== "" && (draft.location !== "Other" || draft.locationOther.trim() !== "") && draft.triggers.length > 0 && (!draft.triggers.includes("Other") || draft.triggerNote.trim() !== "");
      case "inner":    return true;
      case "need":     return draft.needTypes.length > 0 && (!draft.needTypes.includes("Other") || draft.needOther.trim() !== "");
      case "substance": return true;
      case "action":   return draft.chosenAction !== "" && draft.actionAttempted !== null;
      case "outcome":  return draft.useOutcome !== "";
      default:         return true;
    }
  }, [step, draft.trekTypes, draft.planningStage, draft.location, draft.locationOther, draft.triggers, draft.triggerNote, draft.emotions, draft.emotionOther, draft.physicalSensations, draft.thoughtPresets, draft.thoughtFreeText, draft.needTypes, draft.needOther, draft.chosenAction, draft.actionAttempted, draft.useOutcome]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  useEffect(() => {
    if (reg.session?.pendingReturn) {
      reg.patchSession({ pendingReturn: undefined });
    }
    // Only clear the return marker when this matching tracker is first opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stepIdx = STEP_ORDER.indexOf(step);
  const progressPct = ((stepIdx + 1) / STEP_ORDER.length) * 100;

  const canGoBack = stepIdx > 0;
  const goBack = () => setStep(STEP_ORDER[stepIdx - 1]);
  const goNext = () => {
    if (stepIdx === STEP_ORDER.length - 1) {
      save();
    } else {
      setStep(STEP_ORDER[stepIdx + 1]);
    }
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    const completedAt = Date.now();
    const startedAt = reg.session?.startedAt ?? completedAt;
    const occurredAt = reg.session?.quickRegistrationTimestamp ?? startedAt;
    const confidenceAfter = confidenceAfterForAttempt(draft.actionAttempted, draft.confidenceAfter);
    try {
      const saved = await logCraving({
        cravingType: "active",
        timestamp: occurredAt,
        occurredAt,
        startedAt,
        completedAt,
        dataVersion: CURRENT_REGISTRATION_DATA_VERSION,
        contentVersion: CURRENT_REGISTRATION_CONTENT_VERSION,
        answers: {
          ...buildTrekAnswers(draft),
          quickRegistrationId: reg.session?.quickRegistrationId ?? null,
        },
        status: "completed",
        intensity: draft.intensity,
        distressLevel: null,
        riskLevel: "",
        situationPresets: [],
        situationOther: "",
        emotions: draft.emotions,
        emotionOther: draft.emotionOther.trim(),
        physicalSensations: draft.physicalSensations,
        thoughtPresets: draft.thoughtPresets,
        thoughtFreeText: draft.thoughtFreeText.trim(),
        location: draft.location,
        locationOther: removeHiddenOtherText(draft.location, draft.locationOther),
        socialContext: [],
        substances: draft.substances,
        // Trek targets are an unordered plural answer; no primary target is asked.
        primarySubstance: "",
        buildupDuration: "",
        chosenAction: draft.chosenAction,
        chosenActionOther: "",
        actionAttempted: draft.actionAttempted,
        toolUsed: draft.actionAttempted && TREK_ACTIONS.some((a) => a.value === draft.chosenAction && a.tool)
          ? draft.chosenAction
          : null,
        confidenceBefore: draft.confidenceBefore,
        intensityAfter: null,
        confidenceAfter,
        cravingOutcome: null,
        interventionUsed: draft.actionAttempted,
        markAsPattern: false,
        // Deprecated compatibility field. Intensity is not a safety answer and
        // must never be promoted to an inferred risk flag.
        highRiskFlag: false,
        note: "",
        planningStage: draft.planningStage,
        // No primary need is asked, so do not manufacture one from array order.
        needType: "",
        needTypes: draft.needTypes,
        needOther: removeHiddenOtherText(draft.needTypes, draft.needOther),
        triggers: draft.triggers,
        triggerNote: removeHiddenOtherText(draft.triggers, draft.triggerNote) || undefined,
        trekTypes: draft.trekTypes,
        useOutcome: draft.useOutcome || undefined,
      });
      reg.patchSession({ savedLogId: saved.id, step: "done" });
      setStep("done");
      // The detailed record is already durable. Linking the earlier quick
      // entry is secondary and must never turn success into a duplicate-prone
      // save error.
      void completeQuickReflection(reg.session?.quickRegistrationId, "trek", saved.id).catch(() => undefined);
    } catch {
      toast({ title: t("common.save_error"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const openToolPath = useCallback(async (path: string, returnStep: Step) => {
    const opened = await navigateAfterTrekReturnSaved(
      () => reg.patchSession({ pendingReturn: { returnRoute: "/trek", returnStep } }),
      () => navigate(path),
    );
    if (!opened) toast({ title: t("common.save_error"), variant: "destructive" });
    return opened;
  }, [navigate, reg, t, toast]);

  // ── Done screen ───────────────────────────────────────────
  if (step === "done") {
    const chosenDef = TREK_ACTIONS.find((a) => a.value === draft.chosenAction);
    const showMedicalSafety = draft.useOutcome === "used"
      && shouldShowMedicalSafetyForTargets(draft.substances);
    const usedSafetyWarnings = draft.useOutcome === "used"
      ? getSubstanceSafetyWarnings(draft.substances, language)
      : [];
    const msg = draft.useOutcome === "used"
      ? t("tracker.done.used")
      : draft.useOutcome === "not_used"
        ? t("tracker.done.not_used")
        : t("tracker.done.unsure");
    return (
      <div className="flex flex-col min-h-dvh bg-background">
        <PageHeader title={t("trek.title")} back />
        <div className="flex-1 overflow-y-auto scroll-smooth-ios flex flex-col items-center px-6 pt-8 gap-6 text-center animate-fade-up"
          style={{ paddingBottom: "calc(5rem + env(safe-area-inset-bottom))" }}>
          <Flame size={48} strokeWidth={1.5} className="text-primary" />
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold">{t("trek.done.title")}</h2>
            {msg && (
              <p className="text-muted-foreground leading-relaxed max-w-xs">{msg}</p>
            )}
          </div>
          {showMedicalSafety && (
            <div className="w-full max-w-xs space-y-3 text-left">
              <div className="rounded-2xl border border-amber-500/50 bg-card p-4">
                <div className="mb-2 flex items-start gap-2">
                  <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-500" />
                  <p className="text-sm font-semibold text-foreground">{safetyCopy.title}</p>
                </div>
                <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
                  <p>{safetyCopy.assessmentLimit}</p>
                  <p>{safetyCopy.emergency}</p>
                  <p>{safetyCopy.humanHelp}</p>
                </div>
                <a href="tel:112" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-primary">
                  {safetyCopy.call112}
                </a>
              </div>
              {usedSafetyWarnings.map((warning) => (
                <div key={warning.key} className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
                  <p className="text-sm font-semibold text-foreground">{warning.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{warning.body}</p>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-3 w-full max-w-xs">
            {draft.useOutcome === "used" && (
              <button
                onClick={() => navigate("/relapse")}
                className="w-full bg-primary text-primary-foreground rounded-2xl py-4 font-semibold touch-target hover:opacity-90 active:scale-95 transition-all"
              >
                {t("tracker.done.open_relapse")}
              </button>
            )}
            {chosenDef?.tool && draft.actionAttempted === false && (
              <button
                onClick={() => void openToolPath(chosenDef.tool!, "done")}
                className="w-full bg-primary text-primary-foreground rounded-2xl py-4 font-semibold touch-target hover:opacity-90 active:scale-95 transition-all"
              >
                {tOpt(chosenDef.label)}
              </button>
            )}
            <button
              onClick={() => void openToolPath("/tools", "done")}
              className={`w-full rounded-2xl py-3.5 font-semibold touch-target transition-all ${
                chosenDef?.tool
                  ? "border border-border text-muted-foreground"
                  : "bg-primary text-primary-foreground hover:opacity-90 active:scale-95"
              }`}
            >
              {t("common.browse_tools")}
            </button>
            <button onClick={async () => { if (await reg.completeSession()) navigate("/"); }}
              className="w-full border border-border rounded-2xl py-3 font-medium text-muted-foreground touch-target">
              {t("common.done_home")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step content ──────────────────────────────────────────
  return (
    <StepLayout
      title={t("trek.title")}
      back
      backDisabled={saving}
      subtitle={STEP_LABELS[step]}
      step={{ current: stepIdx + 1, total: STEP_ORDER.length }}
      showStepCounter
      contentClassName="pt-4 flex flex-col gap-4"
      actionBar={
        <ActionBar
          showBack={canGoBack}
          onBack={goBack}
          onNext={goNext}
          nextIsSubmit={stepIdx === STEP_ORDER.length - 1}
          saving={saving}
          canProceed={canProceed}
          backLabel={t("common.back")}
          nextLabel={t("common.next")}
          saveLabel={t("common.save")}
          savingLabel={t("common.saving")}
        />
      }
    >

        {/* ── Type & Intensity ───────────────────────────────── */}
        {step === "type" && (
          <>
            <p className="text-base font-medium text-foreground">
              {t("trek.q.type")}
              <RequiredMarker language={language} />
            </p>
            <p className="text-sm text-muted-foreground">{t("trek.q.type_sub")}</p>
            <MultiSelectGrid
              options={TREK_TYPES}
              value={draft.trekTypes}
              onToggle={toggleType}
              translate={tOpt}
              maxSelections={2}
              selectionLabel={t("tracker.selection_limit")}
            />
            <div className="h-px bg-border my-1" />
            <p className="text-sm font-medium text-foreground">
              {t("trek.q.intensity")} {" "}
              <span className="text-muted-foreground font-normal text-sm">({t("common.optional")})</span>
            </p>
            <IntensitySlider
              value={draft.intensity}
              ariaLabel={t("trek.q.intensity")}
              onChange={(v) => update("intensity", v)}
              min={0}
              lowLabel="0"
              highLabel="10"
            />
            <div className="h-px bg-border my-1" />
            <p className="text-sm font-medium text-foreground">
              {t("trek.q.confidence_before")} {" "}
              <span className="text-muted-foreground font-normal text-sm">({t("common.optional")})</span>
            </p>
            <IntensitySlider
              value={draft.confidenceBefore}
              ariaLabel={t("trek.q.confidence_before")}
              onChange={(v) => update("confidenceBefore", v)}
              min={0}
              lowLabel="0"
              highLabel="10"
            />
          </>
        )}

        {/* ── Planning ───────────────────────────────────────── */}
        {step === "planning" && (
          <>
            <p className="text-base font-medium text-foreground">
              {t("trek.q.planning")}
              <RequiredMarker language={language} />
            </p>
            <p className="text-sm text-muted-foreground">{t("trek.q.planning_sub")}</p>
            <ChipCol
              options={PLANNING_STAGES}
              value={draft.planningStage}
              onChange={(v) => update("planningStage", v)}
              translate={tOpt}
            />
            <div className="h-px bg-border my-1" />
            <p className="text-base font-medium text-foreground">
              {t("trek.q.location")} {" "}
              <span className="text-muted-foreground font-normal text-sm">({t("common.optional")})</span>
            </p>
            <ChipCol
              options={TREK_LOCATIONS}
              value={draft.location}
              onChange={(v) => setDraft((prev) => ({
                ...prev,
                location: v,
                locationOther: v === "Other" ? prev.locationOther : "",
              }))}
              translate={tOpt}
            />
            {draft.location === "Other" && (
              <div className="flex flex-col gap-2">
                <label htmlFor="trek-location-other" className="text-sm font-medium text-foreground">
                  {t("trek.location.label")}
                  <RequiredMarker language={language} />
                </label>
                <textarea
                  id="trek-location-other"
                  aria-required="true"
                  value={draft.locationOther}
                  onChange={(e) => update("locationOther", e.target.value)}
                  placeholder={t("trek.location.placeholder")}
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                />
              </div>
            )}
            <div className="h-px bg-border my-1" />
            <p className="text-base font-medium text-foreground">
              {t("trek.q.trigger")}
              <RequiredMarker language={language} />
            </p>
            <MultiSelectGrid
              options={TREK_TRIGGERS}
              value={draft.triggers}
              onToggle={toggleTrigger}
              translate={tOpt}
            />
            {draft.triggers.includes("Other") && (
              <div className="flex flex-col gap-2">
                <label htmlFor="trek-trigger-other" className="text-sm font-medium text-foreground">
                  {t("trek.triggerNote.label")}
                  <RequiredMarker language={language} />
                </label>
                <textarea
                  id="trek-trigger-other"
                  aria-required="true"
                  value={draft.triggerNote}
                  onChange={(e) => update("triggerNote", e.target.value)}
                  placeholder={t("trek.triggerNote.placeholder")}
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                />
              </div>
            )}
          </>
        )}

        {/* ── Inner experience (emotions / physical / thoughts) ── */}
        {step === "inner" && (
          <>
            <div className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5">
              <Info size={15} className="text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">{t("craving.inner.hint")}</p>
            </div>
            <p className="text-base font-medium text-foreground">
              {t("craving.q.emotions")} {" "}
              <span className="text-muted-foreground font-normal text-sm">({t("common.optional")})</span>
            </p>
            <p className="text-sm text-muted-foreground -mt-2">{t("craving.q.emotions_sub")}</p>
            <MultiSelectGrid
              options={EMOTIONS}
              value={draft.emotions}
              onToggle={toggleEmotion}
              translate={tOpt}
              maxSelections={3}
              selectionLabel={t("tracker.selection_limit")}
            />
            <textarea
              value={draft.emotionOther}
              onChange={(e) => update("emotionOther", e.target.value)}
              placeholder={t("craving.q.emotions_other")}
              rows={2}
              className="w-full px-4 py-3 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
            />
            <div className="h-px bg-border my-1" />
            <p className="text-base font-medium text-foreground">
              {t("craving.q.physical")} {" "}
              <span className="text-muted-foreground font-normal text-sm">({t("common.optional")})</span>
            </p>
            <p className="text-sm text-muted-foreground -mt-2">{t("craving.q.physical_sub")}</p>
            <MultiSelectGrid
              options={PHYSICAL}
              value={draft.physicalSensations}
              onToggle={togglePhysical}
              translate={tOpt}
              maxSelections={3}
              selectionLabel={t("tracker.selection_limit")}
            />
            <div className="h-px bg-border my-1" />
            <p className="text-base font-medium text-foreground">
              {t("craving.q.thoughts")} {" "}
              <span className="text-muted-foreground font-normal text-sm">({t("common.optional")})</span>
            </p>
            <p className="text-sm text-muted-foreground -mt-2">{t("craving.q.thoughts_sub")}</p>
            <MultiSelectGrid
              options={THOUGHTS}
              value={draft.thoughtPresets}
              onToggle={toggleThought}
              translate={tOpt}
              maxSelections={2}
              selectionLabel={t("tracker.selection_limit")}
            />
            <textarea
              value={draft.thoughtFreeText}
              onChange={(e) => update("thoughtFreeText", e.target.value)}
              placeholder={t("craving.q.thoughts_other")}
              rows={2}
              className="w-full px-4 py-3 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
            />
          </>
        )}

        {/* ── Need ───────────────────────────────────────────── */}
        {step === "need" && (
          <>
            <p className="text-base font-medium text-foreground">
              {t("trek.q.need")}
              <RequiredMarker language={language} />
            </p>
            <MultiSelectGrid
              options={TREK_NEEDS}
              value={draft.needTypes}
              onToggle={toggleNeed}
              translate={tOpt}
            />
            {draft.needTypes.includes("Other") && (
              <div className="flex flex-col gap-2">
                <label htmlFor="trek-need-other" className="text-sm font-medium text-foreground">
                  {t("trek.needOther.placeholder")}
                  <RequiredMarker language={language} />
                </label>
                <textarea
                  id="trek-need-other"
                  aria-required="true"
                  value={draft.needOther}
                  onChange={(e) => update("needOther", e.target.value)}
                  placeholder={t("trek.needOther.placeholder")}
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                />
              </div>
            )}
          </>
        )}

        {/* ── Substance ──────────────────────────────────────── */}
        {step === "substance" && (
          <>
            <p className="text-base font-medium text-foreground">{t("craving.q.substance")}</p>
            <p className="text-sm text-muted-foreground -mt-2">{t("craving.q.substance_sub")}</p>
            <MultiSelectGrid
              options={SUBSTANCES}
              value={draft.substances}
              onToggle={toggleSubstance}
              translate={tOpt}
            />
          </>
        )}

        {/* ── Action ─────────────────────────────────────────── */}
        {step === "action" && (
          <>
            <p className="text-base font-medium text-foreground">
              {t("trek.q.action")}
              <RequiredMarker language={language} />
            </p>
            <div className="flex flex-col gap-2">
              {TREK_ACTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => {
                    const next = draft.chosenAction === value ? "" : value;
                    setDraft((prev) => ({
                      ...prev,
                      chosenAction: next,
                      actionAttempted: null,
                      confidenceAfter: null,
                    }));
                  }}
                  aria-pressed={draft.chosenAction === value}
                  className={`w-full text-left px-4 py-3.5 rounded-2xl border text-sm font-medium transition-all touch-target flex items-center justify-between ${
                    draft.chosenAction === value
                      ? "bg-primary/10 border-primary text-foreground"
                      : "bg-card border-border text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  <span>{tOpt(label)}</span>
                  {draft.chosenAction === value && (
                    <div className="w-4 h-4 rounded-full bg-primary shrink-0" />
                  )}
                </button>
              ))}
            </div>
            {draft.chosenAction && (() => {
              const selected = TREK_ACTIONS.find((item) => item.value === draft.chosenAction);
              return (
                <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-3">
                  <p className="text-sm font-medium text-foreground">
                    {t("tracker.action.attempted_q")}
                    <RequiredMarker language={language} />
                  </p>
                  {selected?.tool && (
                    <button
                      type="button"
                      onClick={() => void openToolPath(selected.tool!, "action")}
                      className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground touch-target"
                    >
                      {t("tracker.action.open_tool")}
                    </button>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: true, label: t("tracker.action.tried") },
                      { value: false, label: t("tracker.action.not_yet") },
                    ].map((item) => (
                      <button
                        type="button"
                        key={String(item.value)}
                        onClick={() => setDraft((prev) => ({
                          ...prev,
                          actionAttempted: item.value,
                          confidenceAfter: confidenceAfterForAttempt(item.value, prev.confidenceAfter),
                        }))}
                        aria-pressed={draft.actionAttempted === item.value}
                        className={`rounded-xl border px-3 py-3 text-sm font-medium touch-target ${
                          draft.actionAttempted === item.value
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border bg-background text-muted-foreground"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}
            {draft.actionAttempted === true && (
              <>
                <div className="h-px bg-border my-1" />
                <p className="text-sm font-medium text-foreground">
                  {t("trek.q.confidence_after")} {" "}
                  <span className="text-muted-foreground font-normal text-sm">({t("common.optional")})</span>
                </p>
                <IntensitySlider
                  value={draft.confidenceAfter}
                  ariaLabel={t("trek.q.confidence_after")}
                  onChange={(v) => update("confidenceAfter", v)}
                  min={0}
                  lowLabel="0"
                  highLabel="10"
                />
              </>
            )}
          </>
        )}

        {/* ── Outcome (behavioral) ───────────────────────────── */}
        {step === "outcome" && (
          <>
            <p className="text-base font-medium text-foreground">
              {t("tracker.outcome.q")}
              <RequiredMarker language={language} />
            </p>
            <p className="text-sm text-muted-foreground -mt-2">{t("tracker.outcome.sub")}</p>
            <div className="flex flex-col gap-2">
              {USE_OUTCOMES.map(({ value, labelKey }) => (
                <button
                  key={value}
                  onClick={() => update("useOutcome", draft.useOutcome === value ? "" : value)}
                  aria-pressed={draft.useOutcome === value}
                  className={`w-full text-left px-4 py-3.5 rounded-2xl border text-sm font-medium transition-all touch-target flex items-center justify-between ${
                    draft.useOutcome === value
                      ? "bg-primary/10 border-primary text-foreground"
                      : "bg-card border-border text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  <span>{t(labelKey)}</span>
                  {draft.useOutcome === value && (
                    <div className="w-4 h-4 rounded-full bg-primary shrink-0" />
                  )}
                </button>
              ))}
            </div>
            {draft.useOutcome === "used" && shouldShowMedicalSafetyForTargets(draft.substances) && (
              <div role="alert" className="space-y-3 rounded-2xl border border-amber-500/50 bg-card p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-500" />
                  <p className="text-sm font-semibold text-foreground">{safetyCopy.title}</p>
                </div>
                <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
                  <p>{safetyCopy.assessmentLimit}</p>
                  <p>{safetyCopy.emergency}</p>
                  <p>{safetyCopy.humanHelp}</p>
                </div>
                <a href="tel:112" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary">
                  {safetyCopy.call112}
                </a>
                {getSubstanceSafetyWarnings(draft.substances, language).map((warning) => (
                  <div key={warning.key} className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
                    <p className="text-sm font-semibold text-foreground">{warning.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{warning.body}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
    </StepLayout>
  );
}
