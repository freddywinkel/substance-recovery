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
import { Flame, Info } from "lucide-react";

// ── Step type ────────────────────────────────────────────────
type Step = "type" | "planning" | "inner" | "need" | "substance" | "action" | "outcome" | "done";
const STEP_ORDER: Step[] = ["type", "planning", "inner", "need", "substance", "action", "outcome"];

// ── Option lists ─────────────────────────────────────────────
const TREK_TYPES = [
  "Planning or thinking about it",
  "Actively seeking it",
  "Ritual / habit",
  "Boredom-driven",
  "Emotional escape",
  "Social pressure",
];

const PLANNING_STAGES = [
  "Just thinking about it",
  "Getting money or resources",
  "On my way there",
  "About to act",
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
  "Boredom",
  "Stress",
  "Habit / routine",
  "Social pressure",
  "Money available",
  "Feeling good / celebratory",
  "Conflict",
  "Other",
];

const TREK_NEEDS = [
  "Relief",
  "Excitement",
  "Reward",
  "Numbness",
  "Comfort",
  "Connection",
  "Stimulation",
  "Escape",
  "Other",
];

const TREK_ACTIONS = [
  { value: "remove-access", label: "Remove access or money", msgKey: "trek.msg.remove_access" },
  { value: "change-location", label: "Change location", msgKey: "trek.msg.change_location" },
  { value: "delay-timer", label: "Use delay timer", msgKey: "trek.msg.delay", tool: "/delay" },
  { value: "call-someone", label: "Call or text someone", msgKey: "trek.msg.call" },
  { value: "use-tool", label: "Use a tool from the toolbox", msgKey: "trek.msg.tool", tool: "/tools" },
  { value: "just-observe", label: "Just observe — don't act", msgKey: "trek.msg.observe" },
];

const SUBSTANCES = ["Alcohol", "Cannabis", "Cocaine / stimulant", "Benzodiazepines", "Nicotine", "Opioids", "Gambling", "Sex / pornography", "Gaming", "Food / binge eating"];

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
interface TrekDraft {
  trekTypes: string[];
  intensity: number;
  confidenceBefore: number;
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
  confidenceAfter: number;
  useOutcome: "" | "used" | "not_used" | "unsure";
}

function blankDraft(): TrekDraft {
  return {
    trekTypes: [],
    intensity: 5,
    confidenceBefore: 5,
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
    confidenceAfter: 5,
    useOutcome: "",
  };
}

// ── Main component ────────────────────────────────────────────
export function TrekTracker() {
  const { step, setStep, draft, setDraft, reg } = useResumableDraft<Step, TrekDraft>({
    type: "trek",
    route: "/trek",
    firstStep: "type",
    makeBlank: blankDraft,
    steps: STEP_ORDER,
  });
  const [saving, setSaving] = useState(false);
  const { logCraving } = useStore();
  const [, navigate] = useLocation();
  const { t, tOpt } = useT();

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
      const arr = prev.trekTypes;
      const next = arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v].slice(-2);
      return { ...prev, trekTypes: next };
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
    setDraft((prev) => ({
      ...prev,
      triggers: prev.triggers.includes(v)
        ? prev.triggers.filter((x) => x !== v)
        : [...prev.triggers, v],
    }));
  }, []);

  const toggleNeed = useCallback((v: string) => {
    setDraft((prev) => ({
      ...prev,
      needTypes: prev.needTypes.includes(v)
        ? prev.needTypes.filter((x) => x !== v)
        : [...prev.needTypes, v],
    }));
  }, []);

  // Inner-experience toggles — capped (emotions/physical 3, thoughts 2) via drop-oldest,
  // mirroring the trekTypes slice pattern above.
  const toggleEmotion = useCallback((v: string) => {
    setDraft((prev) => {
      const arr = prev.emotions;
      return { ...prev, emotions: arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v].slice(-3) };
    });
  }, []);

  const togglePhysical = useCallback((v: string) => {
    setDraft((prev) => {
      const arr = prev.physicalSensations;
      return { ...prev, physicalSensations: arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v].slice(-3) };
    });
  }, []);

  const toggleThought = useCallback((v: string) => {
    setDraft((prev) => {
      const arr = prev.thoughtPresets;
      return { ...prev, thoughtPresets: arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v].slice(-2) };
    });
  }, []);

  const canProceed = useMemo(() => {
    switch (step) {
      case "type":     return draft.trekTypes.length > 0;
      case "planning": return draft.planningStage !== "" && draft.location !== "" && (draft.location !== "Other" || draft.locationOther.trim() !== "") && draft.triggers.length > 0 && (!draft.triggers.includes("Other") || draft.triggerNote.trim() !== "");
      case "inner":    return draft.emotions.length > 0 || draft.emotionOther.trim() !== "" || draft.physicalSensations.length > 0 || draft.thoughtPresets.length > 0 || draft.thoughtFreeText.trim() !== "";
      case "need":     return draft.needTypes.length > 0 && (!draft.needTypes.includes("Other") || draft.needOther.trim() !== "");
      case "substance": return draft.substances.length > 0;
      case "action":   return draft.chosenAction !== "";
      case "outcome":  return draft.useOutcome !== "";
      default:         return true;
    }
  }, [step, draft.trekTypes, draft.planningStage, draft.location, draft.locationOther, draft.triggers, draft.triggerNote, draft.emotions, draft.emotionOther, draft.physicalSensations, draft.thoughtPresets, draft.thoughtFreeText, draft.needTypes, draft.needOther, draft.substances, draft.chosenAction, draft.useOutcome]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

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
    setSaving(true);
    const highRiskFlag = draft.intensity >= 8;
    await logCraving({
      cravingType: "active",
      timestamp: Date.now(),
      status: "completed",
      intensity: draft.intensity,
      distressLevel: 0,
      riskLevel: "",
      situationPresets: draft.triggers,
      situationOther: "",
      emotions: draft.emotions,
      emotionOther: draft.emotionOther,
      physicalSensations: draft.physicalSensations,
      thoughtPresets: draft.thoughtPresets,
      thoughtFreeText: draft.thoughtFreeText,
      location: draft.location,
      locationOther: draft.location === "Other" ? draft.locationOther : "",
      socialContext: [],
      substances: draft.substances,
      primarySubstance: "",
      buildupDuration: "",
      chosenAction: draft.chosenAction,
      chosenActionOther: "",
      toolUsed: null,
      confidenceBefore: draft.confidenceBefore,
      intensityAfter: null,
      confidenceAfter: draft.confidenceAfter,
      cravingOutcome: null,
      interventionUsed: null,
      markAsPattern: false,
      highRiskFlag,
      note: "",
      planningStage: draft.planningStage,
      needType: draft.needTypes[0] ?? "",
      needTypes: draft.needTypes,
      needOther: draft.needTypes.includes("Other") ? draft.needOther : "",
      triggers: draft.triggers,
      triggerNote: draft.triggerNote || undefined,
      trekTypes: draft.trekTypes,
      useOutcome: draft.useOutcome || undefined,
    });
    setSaving(false);
    reg.clearSession();
    setStep("done");
  };

  // ── Done screen ───────────────────────────────────────────
  if (step === "done") {
    const chosenDef = TREK_ACTIONS.find((a) => a.value === draft.chosenAction);
    const msg = chosenDef ? t(chosenDef.msgKey) : "";
    return (
      <div className="flex flex-col min-h-dvh bg-background">
        <PageHeader title={t("trek.title")} back />
        <div className="flex-1 overflow-y-auto scroll-smooth-ios flex flex-col items-center justify-center px-6 gap-6 text-center animate-fade-up"
          style={{ paddingBottom: "calc(5rem + env(safe-area-inset-bottom))" }}>
          <Flame size={48} strokeWidth={1.5} className="text-primary" />
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold">{t("trek.done.title")}</h2>
            {msg && (
              <p className="text-muted-foreground leading-relaxed max-w-xs">{msg}</p>
            )}
          </div>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            {chosenDef?.tool && (
              <button
                onClick={() => navigate(chosenDef.tool!)}
                className="w-full bg-primary text-primary-foreground rounded-2xl py-4 font-semibold touch-target hover:opacity-90 active:scale-95 transition-all"
              >
                {tOpt(chosenDef.label)}
              </button>
            )}
            <button
              onClick={() => navigate("/tools")}
              className={`w-full rounded-2xl py-3.5 font-semibold touch-target transition-all ${
                chosenDef?.tool
                  ? "border border-border text-muted-foreground"
                  : "bg-primary text-primary-foreground hover:opacity-90 active:scale-95"
              }`}
            >
              {t("common.browse_tools")}
            </button>
            <button onClick={() => navigate("/")}
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
            <p className="text-base font-medium text-foreground">{t("trek.q.type")}</p>
            <MultiSelectGrid
              options={TREK_TYPES}
              value={draft.trekTypes}
              onToggle={toggleType}
              translate={tOpt}
            />
            <div className="h-px bg-border my-1" />
            <p className="text-sm font-medium text-foreground">{t("trek.q.intensity")}</p>
            <IntensitySlider
              value={draft.intensity}
              onChange={(v) => update("intensity", v)}
              min={0}
              lowLabel="0"
              highLabel="10"
            />
            <div className="h-px bg-border my-1" />
            <p className="text-sm font-medium text-foreground">{t("trek.q.confidence_before")}</p>
            <IntensitySlider
              value={draft.confidenceBefore}
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
            <p className="text-base font-medium text-foreground">{t("trek.q.planning")}</p>
            <ChipCol
              options={PLANNING_STAGES}
              value={draft.planningStage}
              onChange={(v) => update("planningStage", v)}
              translate={tOpt}
            />
            <div className="h-px bg-border my-1" />
            <p className="text-base font-medium text-foreground">{t("trek.q.location")}</p>
            <ChipCol
              options={TREK_LOCATIONS}
              value={draft.location}
              onChange={(v) => update("location", v)}
              translate={tOpt}
            />
            {draft.location === "Other" && (
              <textarea
                value={draft.locationOther}
                onChange={(e) => update("locationOther", e.target.value)}
                placeholder={t("trek.location.placeholder")}
                rows={2}
                className="w-full px-4 py-3 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
              />
            )}
            <div className="h-px bg-border my-1" />
            <p className="text-base font-medium text-foreground">{t("trek.q.trigger")}</p>
            <MultiSelectGrid
              options={TREK_TRIGGERS}
              value={draft.triggers}
              onToggle={toggleTrigger}
              translate={tOpt}
            />
            {draft.triggers.includes("Other") && (
              <textarea
                value={draft.triggerNote}
                onChange={(e) => update("triggerNote", e.target.value)}
                placeholder={t("trek.triggerNote.placeholder")}
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
              />
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
            <p className="text-base font-medium text-foreground">{t("craving.q.emotions")}</p>
            <p className="text-sm text-muted-foreground -mt-2">{t("craving.q.emotions_sub")}</p>
            <MultiSelectGrid
              options={EMOTIONS}
              value={draft.emotions}
              onToggle={toggleEmotion}
              translate={tOpt}
            />
            <textarea
              value={draft.emotionOther}
              onChange={(e) => update("emotionOther", e.target.value)}
              placeholder={t("craving.q.emotions_other")}
              rows={2}
              className="w-full px-4 py-3 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
            />
            <div className="h-px bg-border my-1" />
            <p className="text-base font-medium text-foreground">{t("craving.q.physical")}</p>
            <p className="text-sm text-muted-foreground -mt-2">{t("craving.q.physical_sub")}</p>
            <MultiSelectGrid
              options={PHYSICAL}
              value={draft.physicalSensations}
              onToggle={togglePhysical}
              translate={tOpt}
            />
            <div className="h-px bg-border my-1" />
            <p className="text-base font-medium text-foreground">{t("craving.q.thoughts")}</p>
            <p className="text-sm text-muted-foreground -mt-2">{t("craving.q.thoughts_sub")}</p>
            <MultiSelectGrid
              options={THOUGHTS}
              value={draft.thoughtPresets}
              onToggle={toggleThought}
              translate={tOpt}
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
            <p className="text-base font-medium text-foreground">{t("trek.q.need")}</p>
            <MultiSelectGrid
              options={TREK_NEEDS}
              value={draft.needTypes}
              onToggle={toggleNeed}
              translate={tOpt}
            />
            {draft.needTypes.includes("Other") && (
              <textarea
                value={draft.needOther}
                onChange={(e) => update("needOther", e.target.value)}
                placeholder={t("trek.needOther.placeholder")}
                rows={2}
                className="w-full px-4 py-3 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
              />
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
            <p className="text-base font-medium text-foreground">{t("trek.q.action")}</p>
            <div className="flex flex-col gap-2">
              {TREK_ACTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => update("chosenAction", draft.chosenAction === value ? "" : value)}
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
            <div className="h-px bg-border my-1" />
            <p className="text-sm font-medium text-foreground">{t("trek.q.confidence_after")}</p>
            <IntensitySlider
              value={draft.confidenceAfter}
              onChange={(v) => update("confidenceAfter", v)}
              min={0}
              lowLabel="0"
              highLabel="10"
            />
          </>
        )}

        {/* ── Outcome (behavioral) ───────────────────────────── */}
        {step === "outcome" && (
          <>
            <p className="text-base font-medium text-foreground">{t("tracker.outcome.q")}</p>
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
          </>
        )}
    </StepLayout>
  );
}
