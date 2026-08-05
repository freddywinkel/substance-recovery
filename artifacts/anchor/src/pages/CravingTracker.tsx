import { useState, useCallback, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useStore } from "@/hooks/useStore";
import { useT } from "@/hooks/useTranslation";
import { PageHeader } from "@/components/PageHeader";
import { useResumableDraft } from "@/contexts/ActiveRegistrationContext";
import {
  updateCravingLog,
  getCravingLogs,
  type CravingLog,
  type RegistrationAnswerValue,
} from "@/db";
import {
  CURRENT_REGISTRATION_CONTENT_VERSION,
  CURRENT_REGISTRATION_DATA_VERSION,
} from "@/db/migrations";
import { IntensitySlider } from "@/components/tracker/IntensitySlider";
import { ChipCol } from "@/components/tracker/ChipCol";
import { MultiSelectGrid } from "@/components/tracker/MultiSelectGrid";
import { StepLayout } from "@/components/tracker/StepLayout";
import { ActionBar } from "@/components/tracker/ActionBar";
import { AlertTriangle, CheckCircle2, Zap, ChevronDown, ChevronUp, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { removeHiddenOtherText, toStableOptionId, toStableOptionIds } from "@/lib/registrationIds";
import { getSubstanceSafetyWarnings, getUrgentSafetyCopy } from "@/lib/registrationSafety";
import { useRecoveryFeatures } from "@/contexts/RecoveryFeaturesContext";

// ── Step type ────────────────────────────────────────────────
type Step = "onset" | "trigger" | "inner" | "substance" | "action" | "outcome" | "done";
const STEP_ORDER: Step[] = ["onset", "trigger", "inner", "substance", "action", "outcome"];

// ── Option lists ─────────────────────────────────────────────
const ONSET_TYPES = [
  "Sudden cue (saw/smelled/heard)",
  "Physical sensation",
  "Memory or flashback",
  "Social trigger",
  "Random / no reason",
  "Other",
];

const TRIGGER_PRESETS = [
  "No clear situation / not sure",
  "Home alone",
  "On my way somewhere",
  "After work",
  "Conflict or argument",
  "Feeling bored",
  "Under stress",
  "Bad news",
  "Party or social event",
  "Someone using nearby",
  "Saw or smelled a trigger",
  "Other",
];

const NO_CLEAR_SITUATION = "No clear situation / not sure";

/** "Not sure" is a complete answer and cannot coexist with specific situations. */
export function toggleCravingSituationSelection(
  selected: string[],
  value: string,
): string[] {
  if (value === NO_CLEAR_SITUATION) {
    return selected.includes(value) ? [] : [value];
  }
  const specific = selected.filter((item) => item !== NO_CLEAR_SITUATION);
  return specific.includes(value)
    ? specific.filter((item) => item !== value)
    : [...specific, value];
}

const PHYSICAL_SENSATIONS = [
  "Restlessness", "Chest tightness", "Head pressure",
  "Nausea", "Sweating", "Trembling", "Rapid heartbeat",
  "Fatigue", "Empty feeling", "Nervous energy", "Feeling rushed",
  "Urge in the body",
];

const BUILDUP_OPTIONS = [
  { value: "just-started", label: "Just started", sub: "A few minutes" },
  { value: "5-15min", label: "5–15 minutes", sub: "" },
  { value: "15-60min", label: "15–60 minutes", sub: "" },
  { value: "few-hours", label: "A few hours", sub: "" },
  { value: "since-morning", label: "Since this morning", sub: "" },
  { value: "most-of-day", label: "Most of the day", sub: "" },
  { value: "multiple-days", label: "Multiple days", sub: "" },
];

const OUTCOME_ACTIONS = [
  { value: "urge-surfing", label: "Urge surfing", tool: "/tools/urge-surfing" },
  { value: "box-breathing", label: "Box breathing", tool: "/tools/breathing" },
  { value: "grounding", label: "Grounding", tool: "/tools/grounding" },
  { value: "distraction", label: "Distraction", tool: "/tools/distraction" },
  { value: "call-someone", label: "Call or text someone" },
  { value: "just-observed", label: "Observe without acting" },
];

const OUTCOMES = [
  { value: "decreased", label: "Decreased" },
  { value: "same", label: "Same" },
  { value: "increased", label: "Increased" },
  { value: "dont-know", label: "Don't know" },
];

const SUBSTANCES = ["Alcohol", "Cannabis", "Cocaine / stimulant", "Benzodiazepines", "Nicotine", "Opioids", "Gambling", "Sex / pornography", "Gaming", "Food / binge eating"];

const BEHAVIOURAL_TARGETS = new Set([
  "Gambling",
  "Sex / pornography",
  "Gaming",
  "Food / binge eating",
]);

/**
 * Generic medical-emergency copy is useful when the target is unknown or may
 * be a substance. It is misleadingly alarmist when every selected target is a
 * behaviour, so behaviour-only entries retain the support/relapse route but
 * do not receive substance-oriented emergency copy.
 */
export function shouldShowMedicalSafetyForTargets(targets: string[]): boolean {
  return targets.length === 0 || targets.some((target) => !BEHAVIOURAL_TARGETS.has(target));
}

/** A hidden follow-up value must not survive "don't know" or deselection. */
export function normalizedIntensityAfter(
  outcome: string,
  intensityAfter: number | null,
): number | null {
  return outcome && outcome !== "dont-know" ? intensityAfter : null;
}

// Inner-experience + location vocab — mirrors Logs.tsx C_EMOTIONS / C_THOUGHTS / C_LOCATIONS
// so the Logbook display, editor and analytics stay consistent with what the tracker captures.
const EMOTIONS = ["Anxious", "Tense", "Low / sad", "Empty", "Angry", "Frustrated", "Guilty", "Ashamed", "Lonely", "Bored", "Restless", "Overwhelmed", "Rejected", "Hopeless", "Excited / hyped", "Numb"];
const THOUGHTS = ["I can't handle this", "Just one won't matter", "No one will notice", "I've earned this", "It doesn't matter anymore", "I just want peace", "I want to feel / stop feeling", "I'll start fresh tomorrow"];
const LOCATIONS = ["Home", "Work", "Outside", "Shop or bar", "In transit", "At someone else's place", "Prefer not to say"];

const USE_OUTCOMES: { value: "not_used" | "used" | "unsure"; labelKey: string }[] = [
  { value: "not_used", labelKey: "tracker.outcome.not_used" },
  { value: "used", labelKey: "tracker.outcome.used" },
  { value: "unsure", labelKey: "tracker.outcome.unsure" },
];

// ── Draft state ───────────────────────────────────────────────
export interface CravingDraft {
  onsetType: string;
  intensity: number | null;
  confidenceBefore: number | null;
  situationPresets: string[];
  physicalSensations: string[];
  buildupDuration: string;
  onsetOther: string;
  triggerOther: string;
  location: string;
  emotions: string[];
  emotionOther: string;
  thoughtPresets: string[];
  thoughtFreeText: string;
  chosenAction: string;
  actionAttempted: boolean | null;
  substances: string[];
  cravingOutcome: string;
  intensityAfter: number | null;
  useOutcome: "" | "used" | "not_used" | "unsure";
}

export function createBlankCravingDraft(): CravingDraft {
  return {
    onsetType: "",
    intensity: null,
    confidenceBefore: null,
    situationPresets: [],
    physicalSensations: [],
    buildupDuration: "",
    onsetOther: "",
    triggerOther: "",
    location: "",
    emotions: [],
    emotionOther: "",
    thoughtPresets: [],
    thoughtFreeText: "",
    chosenAction: "",
    actionAttempted: null,
    substances: [],
    cravingOutcome: "",
    intensityAfter: null,
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

export function buildCravingAnswers(
  draft: CravingDraft,
): Record<string, RegistrationAnswerValue> {
  return {
    registrationType: "craving",
    onsetType: toStableOptionId(draft.onsetType),
    onsetOther: textOrNull(removeHiddenOtherText(draft.onsetType, draft.onsetOther)),
    intensity: draft.intensity,
    confidenceBefore: draft.confidenceBefore,
    situations: toStableOptionIds(draft.situationPresets),
    situationOther: textOrNull(removeHiddenOtherText(draft.situationPresets, draft.triggerOther)),
    physicalSensations: stableIdsOrNull(draft.physicalSensations),
    buildupDuration: draft.buildupDuration,
    location: stableIdOrNull(draft.location),
    emotions: stableIdsOrNull(draft.emotions),
    emotionOther: textOrNull(draft.emotionOther),
    thoughts: stableIdsOrNull(draft.thoughtPresets),
    thoughtOther: textOrNull(draft.thoughtFreeText),
    targets: stableIdsOrNull(draft.substances),
    chosenAction: draft.chosenAction,
    actionAttempted: draft.actionAttempted,
    useOutcome: draft.useOutcome,
    cravingOutcome: null,
    intensityAfter: null,
  };
}

export async function navigateAfterCravingReturnSaved(
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
export function CravingTracker() {
  const { completeQuickReflection } = useRecoveryFeatures();
  const { step, setStep, draft, setDraft, reg } = useResumableDraft<Step, CravingDraft>({
    type: "craving",
    route: "/craving",
    firstStep: "onset",
    makeBlank: createBlankCravingDraft,
    steps: STEP_ORDER,
  });
  const [saving, setSaving] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [savedLog, setSavedLog] = useState<CravingLog | null>(null);
  const { logCraving } = useStore();
  const [, navigate] = useLocation();
  const { t, tOpt, language } = useT();
  const { toast } = useToast();
  const safetyCopy = getUrgentSafetyCopy(language);

  const STEP_LABELS: Record<Step, string> = {
    onset: t("craving.step.onset"),
    trigger: t("craving.step.trigger"),
    inner: t("craving.step.emotions"),
    substance: t("craving.step.substance"),
    action: t("craving.step.action"),
    outcome: t("craving.step.outcome"),
    done: t("common.done"),
  };

  const update = useCallback(<K extends keyof CravingDraft>(key: K, value: CravingDraft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleArr = useCallback((key: "situationPresets" | "physicalSensations" | "substances", val: string) => {
    setDraft((prev) => {
      const arr = prev[key];
      const next = key === "situationPresets"
        ? toggleCravingSituationSelection(arr, val)
        : arr.includes(val)
        ? arr.filter((x) => x !== val)
        : key === "physicalSensations" && arr.length >= 3
          ? arr
          : [...arr, val];
      return {
        ...prev,
        [key]: next,
        ...(key === "situationPresets" && !next.includes("Other") ? { triggerOther: "" } : {}),
      };
    });
  }, []);

  // Visible caps prevent accidental loss of an earlier answer.
  const toggleEmotion = useCallback((v: string) => {
    setDraft((prev) => {
      const arr = prev.emotions;
      return { ...prev, emotions: arr.includes(v) ? arr.filter((x) => x !== v) : arr.length < 3 ? [...arr, v] : arr };
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
      case "onset":   return draft.onsetType !== "" && (draft.onsetType !== "Other" || draft.onsetOther.trim() !== "");
      case "trigger": return draft.situationPresets.length > 0 && draft.buildupDuration !== "" && (!draft.situationPresets.includes("Other") || draft.triggerOther.trim() !== "");
      case "inner":   return true;
      case "substance": return true;
      case "action":  return draft.chosenAction !== "" && draft.actionAttempted !== null;
      case "outcome": return draft.useOutcome !== "";
      default:        return true;
    }
  }, [step, draft.onsetType, draft.onsetOther, draft.situationPresets, draft.triggerOther, draft.buildupDuration, draft.emotions, draft.emotionOther, draft.thoughtPresets, draft.thoughtFreeText, draft.chosenAction, draft.actionAttempted, draft.useOutcome]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  // On mount: returning from a help tool clears the pending-return flag, and a
  // resumed done screen restores the saved log so outcome edits keep working.
  useEffect(() => {
    if (reg.session?.pendingReturn) {
      reg.patchSession({ pendingReturn: undefined });
    }
    const id = reg.session?.savedLogId;
    if (id && step === "done") {
      getCravingLogs().then((logs) => {
        const found = logs.find((l) => l.id === id);
        if (found) setSavedLog(found);
      });
    }
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
    try {
      const saved = await logCraving({
        cravingType: "passive",
        timestamp: occurredAt,
        occurredAt,
        startedAt,
        completedAt,
        dataVersion: CURRENT_REGISTRATION_DATA_VERSION,
        contentVersion: CURRENT_REGISTRATION_CONTENT_VERSION,
        answers: {
          ...buildCravingAnswers(draft),
          quickRegistrationId: reg.session?.quickRegistrationId ?? null,
        },
        status: "completed",
        onsetType: draft.onsetType,
        intensity: draft.intensity,
        distressLevel: null,
        riskLevel: "",
        situationPresets: draft.situationPresets,
        situationOther: removeHiddenOtherText(draft.situationPresets, draft.triggerOther),
        emotions: draft.emotions,
        emotionOther: draft.emotionOther.trim(),
        physicalSensations: draft.physicalSensations,
        thoughtPresets: draft.thoughtPresets,
        thoughtFreeText: draft.thoughtFreeText.trim(),
        onsetOther: removeHiddenOtherText(draft.onsetType, draft.onsetOther),
        location: draft.location,
        locationOther: "",
        socialContext: [],
        substances: draft.substances,
        primarySubstance: "",
        buildupDuration: draft.buildupDuration,
        chosenAction: draft.chosenAction,
        chosenActionOther: "",
        actionAttempted: draft.actionAttempted,
        toolUsed: draft.actionAttempted && OUTCOME_ACTIONS.some((a) => a.value === draft.chosenAction && a.tool)
          ? draft.chosenAction
          : null,
        confidenceBefore: draft.confidenceBefore,
        intensityAfter: null,
        confidenceAfter: null,
        cravingOutcome: null,
        interventionUsed: draft.actionAttempted,
        markAsPattern: false,
        // Deprecated compatibility field. Intensity is not a safety answer and
        // must never be promoted to an inferred risk flag.
        highRiskFlag: false,
        note: "",
        useOutcome: draft.useOutcome || undefined,
      });
      setSavedLog(saved);
      reg.patchSession({ savedLogId: saved.id, step: "done" });
      setStep("done");
      void completeQuickReflection(reg.session?.quickRegistrationId, "craving", saved.id).catch(() => undefined);
    } catch {
      toast({ title: t("common.save_error"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const applyOutcome = useCallback(async (outcome: string, intensityAfter: number | null) => {
    if (!savedLog) return;
    const real = (["decreased", "same", "increased", "unknown"] as const).find((o) => o === (outcome === "dont-know" ? "unknown" : outcome)) ?? null;
    const normalizedAfter = real && real !== "unknown" ? intensityAfter : null;
    const updated: CravingLog = {
      ...savedLog,
      cravingOutcome: real,
      intensityAfter: normalizedAfter,
      answers: {
        ...(savedLog.answers ?? {}),
        cravingOutcome: real,
        intensityAfter: normalizedAfter,
      },
    };
    try {
      await updateCravingLog(updated);
      setSavedLog(updated);
      reg.patchSession({
        draft: {
          ...draft,
          cravingOutcome: outcome,
          intensityAfter: normalizedAfter,
        },
      });
    } catch {
      toast({ title: t("common.save_error"), variant: "destructive" });
    }
  }, [draft, reg, savedLog, t, toast]);

  const openToolPath = useCallback(async (path: string, returnStep: Step) => {
    const opened = await navigateAfterCravingReturnSaved(
      () => reg.patchSession({ pendingReturn: { returnRoute: "/craving", returnStep } }),
      () => navigate(path),
    );
    if (!opened) toast({ title: t("common.save_error"), variant: "destructive" });
    return opened;
  }, [navigate, reg, t, toast]);

  const openHelpPath = async (path: string) => {
    const switchesRegistration = path === "/anxiety" || path === "/boredom";
    if (switchesRegistration) {
      // Preserve this unfinished craving draft before opening another tracker.
      // It will be restored after the linked registration is completed.
      if (await reg.suspendSession()) navigate(path);
      return;
    }
    await openToolPath(path, step);
  };

  // ── Done screen ───────────────────────────────────────────
  if (step === "done") {
    const showMedicalSafety = draft.useOutcome === "used"
      && shouldShowMedicalSafetyForTargets(draft.substances);
    const usedSafetyWarnings = draft.useOutcome === "used"
      ? getSubstanceSafetyWarnings(draft.substances, language)
      : [];
    const outcomeMsg =
      draft.useOutcome === "used" ? t("tracker.done.used")
      : draft.useOutcome === "not_used" && draft.cravingOutcome === "decreased" ? t("craving.msg.decreased")
      : draft.useOutcome === "not_used" && draft.cravingOutcome === "same" ? t("craving.msg.same")
      : draft.useOutcome === "not_used" && draft.cravingOutcome === "increased" ? t("craving.msg.increased")
      : draft.useOutcome === "not_used" ? t("tracker.done.not_used")
      : t("tracker.done.unsure");

    const chosenDef = OUTCOME_ACTIONS.find((a) => a.value === draft.chosenAction);
    const showMethod = Boolean(chosenDef);

    return (
      <div className="flex flex-col min-h-dvh bg-background">
        <PageHeader title={t("craving.title")} back />
        <div className="flex-1 overflow-y-auto scroll-smooth-ios flex flex-col items-center px-6 pt-10 gap-6 animate-fade-up"
          style={{ paddingBottom: "calc(5rem + env(safe-area-inset-bottom))" }}>
          <CheckCircle2 size={48} strokeWidth={1.5} className="text-primary" />
          <div className="space-y-2 text-center">
            <h2 className="text-2xl font-semibold">{t("craving.done.title")}</h2>
            <p className="text-muted-foreground leading-relaxed max-w-xs">{outcomeMsg}</p>
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

          {/* Chosen method card */}
          {showMethod && chosenDef && (
            <div className="w-full max-w-xs bg-primary/8 border border-primary/25 rounded-2xl p-4 flex flex-col gap-2 text-left">
              <p className="text-[11px] text-muted-foreground uppercase tracking-widest">{t("craving.action.chosen")}</p>
              <p className="text-sm font-semibold text-foreground">{tOpt(chosenDef.label)}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {draft.actionAttempted ? t("tracker.action.reported_tried") : t("tracker.action.reported_not_yet")}
              </p>
              {chosenDef.tool && draft.actionAttempted === false && (
                <button
                  onClick={() => void openToolPath(chosenDef.tool!, "done")}
                  className="self-start text-xs font-semibold text-primary border border-primary/30 rounded-xl px-3 py-2 hover:bg-primary/10 active:scale-95 transition-all touch-target"
                >
                  {t("craving.action.launch")} →
                </button>
              )}
            </div>
          )}

          {/* Outcome — fill in after the method */}
          <div className="w-full max-w-xs flex flex-col gap-3 text-left">
            <div>
              <p className="text-base font-medium text-foreground">
                {t("craving.q.outcome")}
                <span className="text-muted-foreground font-normal text-xs ml-2">({t("common.optional")})</span>
              </p>
              <p className="text-sm text-muted-foreground">{t("craving.q.outcome_sub")}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {OUTCOMES.map(({ value, label }) => (
                <button key={value}
                  onClick={() => {
                    const next = draft.cravingOutcome === value ? "" : value;
                    const nextIntensity = normalizedIntensityAfter(next, draft.intensityAfter);
                    setDraft((prev) => ({
                      ...prev,
                      cravingOutcome: next,
                      intensityAfter: nextIntensity,
                    }));
                    void applyOutcome(next, nextIntensity);
                  }}
                  aria-pressed={draft.cravingOutcome === value}
                  className={`py-3 px-3 rounded-2xl border text-sm font-medium transition-all touch-target ${
                    draft.cravingOutcome === value
                      ? "bg-primary/10 border-primary text-foreground"
                      : "bg-card border-border text-muted-foreground"
                  }`}>
                  {tOpt(label)}
                </button>
              ))}
            </div>

            {draft.cravingOutcome && draft.cravingOutcome !== "dont-know" && (
              <>
                <p className="text-sm font-medium text-foreground mt-1">
                  {t("craving.q.intensity_after")}
                  <span className="text-muted-foreground font-normal text-xs ml-2">({t("common.optional")})</span>
                </p>
                <IntensitySlider
                  value={draft.intensityAfter}
                  ariaLabel={t("craving.q.intensity_after")}
                  onChange={(v) => {
                    update("intensityAfter", v);
                    applyOutcome(draft.cravingOutcome, v);
                  }}
                  lowLabel={t("logs.cr_intensity_low")}
                  highLabel={t("logs.cr_intensity_high")}
                />
              </>
            )}
          </div>

          {/* Navigation */}
          <div className="flex flex-col gap-3 w-full max-w-xs">
            {draft.useOutcome === "used" && (
              <button
                onClick={() => navigate("/relapse")}
                className="w-full bg-primary text-primary-foreground rounded-2xl py-3.5 font-semibold touch-target hover:opacity-90 active:scale-95 transition-all"
              >
                {t("tracker.done.open_relapse")}
              </button>
            )}
            <button
              onClick={() => void openToolPath("/tools", "done")}
              className="w-full bg-primary text-primary-foreground rounded-2xl py-3.5 font-semibold touch-target hover:opacity-90 active:scale-95 transition-all"
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
      title={t("craving.title")}
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

        {/* ── Help me now shortcut (onset step only) ─────────── */}
        {step === "onset" && (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 overflow-hidden">
            <button
              onClick={() => setHelpOpen((o) => !o)}
              className="w-full flex items-center justify-between px-4 py-3 touch-target"
            >
              <div className="flex items-center gap-2">
                <Zap size={15} className="text-primary" />
                <span className="text-sm font-semibold text-primary">{t("craving.help.title")}</span>
              </div>
              {helpOpen ? <ChevronUp size={15} className="text-primary" /> : <ChevronDown size={15} className="text-primary" />}
            </button>
            {helpOpen && (
              <div className="px-4 pb-4 flex flex-col gap-2 border-t border-primary/20 pt-3">
                <p className="text-xs text-muted-foreground mb-1">{t("craving.help.sub")}</p>
                {[
                  { label: t("common.delay_timer"), path: "/delay", sub: t("craving.help.delay_sub") },
                  { label: t("anxiety.quick.breathing"), path: "/tools/breathing", sub: t("craving.help.breathing_sub") },
                  { label: t("anxiety.title"), path: "/anxiety", sub: t("craving.help.anxiety_sub") },
                  { label: t("boredom.title"), path: "/boredom", sub: t("craving.help.boredom_sub") },
                ].map(({ label, path, sub }) => (
                  <button
                    key={path}
                    onClick={() => { void openHelpPath(path); }}
                    className="w-full text-left bg-background border border-border rounded-xl px-3.5 py-3 hover:border-primary/40 transition-colors touch-target"
                  >
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Onset ──────────────────────────────────────────── */}
        {step === "onset" && (
          <>
            <p className="text-base font-medium text-foreground">
              {t("craving.q.onset")}
              <RequiredMarker language={language} />
            </p>
            <p className="text-sm text-muted-foreground -mt-2">{t("craving.q.onset_sub")}</p>
            <ChipCol
              options={ONSET_TYPES}
              value={draft.onsetType}
              onChange={(v) => setDraft((prev) => ({
                ...prev,
                onsetType: v,
                onsetOther: v === "Other" ? prev.onsetOther : "",
              }))}
              translate={tOpt}
            />
            {draft.onsetType === "Other" && (
              <div className="flex flex-col gap-2">
                <label htmlFor="craving-onset-other" className="text-sm font-medium text-foreground">
                  {t("craving.onset.other_placeholder")}
                  <RequiredMarker language={language} />
                </label>
                <textarea
                  id="craving-onset-other"
                  aria-required="true"
                  value={draft.onsetOther}
                  onChange={(e) => update("onsetOther", e.target.value)}
                  placeholder={t("craving.onset.other_placeholder")}
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                />
              </div>
            )}
            <div className="h-px bg-border my-1" />
            <p className="text-sm font-medium text-foreground">
              {t("craving.q.intensity")} {" "}
              <span className="text-muted-foreground font-normal text-sm">({t("common.optional")})</span>
            </p>
            <IntensitySlider
              value={draft.intensity}
              ariaLabel={t("craving.q.intensity")}
              onChange={(v) => update("intensity", v)}
              lowLabel={t("logs.cr_intensity_low")}
              highLabel={t("logs.cr_intensity_high")}
            />
            <div className="h-px bg-border my-1" />
            <p className="text-sm font-medium text-foreground">
              {t("craving.q.confidence")} {" "}
              <span className="text-muted-foreground font-normal text-sm">({t("common.optional")})</span>
            </p>
            <IntensitySlider
              value={draft.confidenceBefore}
              ariaLabel={t("craving.q.confidence")}
              onChange={(v) => update("confidenceBefore", v)}
              lowLabel={t("logs.cr_confidence_low")}
              highLabel={t("logs.cr_confidence_high")}
            />
            <div className="h-px bg-border my-1" />
            <p className="text-base font-medium text-foreground">
              {t("craving.q.location")}{" "}
              <span className="text-muted-foreground font-normal text-sm">({t("common.optional")})</span>
            </p>
            <ChipCol
              options={LOCATIONS}
              value={draft.location}
              onChange={(v) => update("location", v)}
              translate={tOpt}
            />
          </>
        )}

        {/* ── Trigger & Body ─────────────────────────────────── */}
        {step === "trigger" && (
          <>
            <p className="text-base font-medium text-foreground">
              {t("craving.q.situation")}
              <RequiredMarker language={language} />
            </p>
            <p className="text-sm text-muted-foreground -mt-2">{t("craving.q.situation_sub")}</p>
            <MultiSelectGrid
              options={TRIGGER_PRESETS}
              value={draft.situationPresets}
              onToggle={(v) => toggleArr("situationPresets", v)}
              translate={tOpt}
            />
            {draft.situationPresets.includes("Other") && (
              <div className="flex flex-col gap-2">
                <label htmlFor="craving-situation-other" className="text-sm font-medium text-foreground">
                  {t("craving.q.situation_other")}
                  <RequiredMarker language={language} />
                </label>
                <textarea
                  id="craving-situation-other"
                  aria-required="true"
                  value={draft.triggerOther}
                  onChange={(e) => update("triggerOther", e.target.value)}
                  placeholder={t("craving.q.situation_other")}
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                />
              </div>
            )}
            <div className="h-px bg-border my-1" />
            <p className="text-base font-medium text-foreground">
              {t("craving.q.physical")}{" "}
              <span className="text-muted-foreground font-normal text-sm">({t("common.optional")})</span>
            </p>
            <p className="text-sm text-muted-foreground -mt-2">{t("craving.q.physical_sub")}</p>
            <MultiSelectGrid
              options={PHYSICAL_SENSATIONS}
              value={draft.physicalSensations}
              onToggle={(v) => toggleArr("physicalSensations", v)}
              translate={tOpt}
              maxSelections={3}
              selectionLabel={t("tracker.selection_limit")}
            />
            <div className="h-px bg-border my-1" />
            <p className="text-base font-medium text-foreground">
              {t("craving.q.buildup")}
              <RequiredMarker language={language} />
            </p>
            <div className="flex flex-col gap-2">
              {BUILDUP_OPTIONS.map(({ value, label, sub }) => (
                <button key={value}
                  onClick={() => update("buildupDuration", draft.buildupDuration === value ? "" : value)}
                  aria-pressed={draft.buildupDuration === value}
                  className={`flex items-center justify-between px-4 py-3.5 rounded-2xl border transition-all touch-target ${
                    draft.buildupDuration === value
                      ? "bg-primary/10 border-primary text-foreground"
                      : "bg-card border-border text-muted-foreground hover:border-primary/30"
                  }`}>
                  <div className="text-left">
                    <p className="font-medium text-sm">{tOpt(label)}</p>
                    {sub && <p className="text-xs text-muted-foreground">{tOpt(sub)}</p>}
                  </div>
                  {draft.buildupDuration === value && (
                    <div className="w-4 h-4 rounded-full bg-primary shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── Inner experience (emotions / thoughts) ─────────── */}
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

        {/* ── Substance ──────────────────────────────────────── */}
        {step === "substance" && (
          <>
            <p className="text-base font-medium text-foreground">{t("craving.q.substance")}</p>
            <p className="text-sm text-muted-foreground -mt-2">{t("craving.q.substance_sub")}</p>
            <MultiSelectGrid
              options={SUBSTANCES}
              value={draft.substances}
              onToggle={(v) => toggleArr("substances", v)}
              translate={tOpt}
            />
          </>
        )}

        {/* ── Action ─────────────────────────────────────────── */}
        {step === "action" && (
          <>
            <p className="text-base font-medium text-foreground">
              {t("craving.q.action")}
              <RequiredMarker language={language} />
            </p>
            <div className="flex flex-col gap-2">
              {OUTCOME_ACTIONS.map(({ value, label }) => (
                <button key={value}
                  onClick={() => {
                    const next = draft.chosenAction === value ? "" : value;
                    setDraft((prev) => ({ ...prev, chosenAction: next, actionAttempted: null }));
                  }}
                  aria-pressed={draft.chosenAction === value}
                  className={`w-full text-left px-4 py-3.5 rounded-2xl border text-sm font-medium transition-all touch-target flex items-center justify-between ${
                    draft.chosenAction === value
                      ? "bg-primary/10 border-primary text-foreground"
                      : "bg-card border-border text-muted-foreground hover:border-primary/30"
                  }`}>
                  <span>{tOpt(label)}</span>
                  {draft.chosenAction === value && (
                    <div className="w-4 h-4 rounded-full bg-primary shrink-0" />
                  )}
                </button>
              ))}
            </div>
            {draft.chosenAction && (() => {
              const selected = OUTCOME_ACTIONS.find((item) => item.value === draft.chosenAction);
              return (
                <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-3">
                  {selected?.tool && (
                    <button
                      type="button"
                      onClick={() => void openToolPath(selected.tool!, "action")}
                      className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground touch-target"
                    >
                      {t("tracker.action.open_tool")}
                    </button>
                  )}
                  <p className="text-sm font-medium text-foreground">
                    {t("tracker.action.attempted_q")}
                    <RequiredMarker language={language} />
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: true, label: t("tracker.action.tried") },
                      { value: false, label: t("tracker.action.not_yet") },
                    ].map((item) => (
                      <button
                        type="button"
                        key={String(item.value)}
                        onClick={() => update("actionAttempted", item.value)}
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
