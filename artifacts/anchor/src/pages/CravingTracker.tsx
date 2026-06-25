import { useState, useCallback, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useStore } from "@/hooks/useStore";
import { useT } from "@/hooks/useT";
import { PageHeader } from "@/components/PageHeader";
import { useResumableDraft } from "@/contexts/ActiveRegistrationContext";
import { updateCravingLog, getCravingLogs, type CravingLog } from "@/db";
import { CheckCircle2, ArrowRight, Zap, ChevronDown, ChevronUp, Info } from "lucide-react";

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
  { value: "call-someone", label: "Called someone" },
  { value: "used", label: "Used" },
  { value: "just-observed", label: "Just observed" },
];

const OUTCOMES = [
  { value: "decreased", label: "Decreased" },
  { value: "same", label: "Same" },
  { value: "increased", label: "Increased" },
  { value: "dont-know", label: "Don't know" },
];

const SUBSTANCES = ["Alcohol", "Cannabis", "Cocaine / stimulant", "Benzodiazepines", "Nicotine", "Opioids", "Gambling", "Sex / pornography", "Gaming", "Food / binge eating"];

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

// ── Helpers ──────────────────────────────────────────────────
function IntensitySlider({
  value, onChange, min = 0, max = 10, label, lowLabel, highLabel,
}: {
  value: number; onChange: (v: number) => void;
  min?: number; max?: number;
  label?: string; lowLabel?: string; highLabel?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="flex flex-col gap-4">
      <div className="text-center">
        <span className="text-7xl font-light text-primary tabular-nums">{value}</span>
        {label && <p className="text-sm text-muted-foreground mt-1">{label}</p>}
      </div>
      <input
        type="range" min={min} max={max} step={1} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="intensity-slider w-full"
        style={{ "--thumb-pct": `${pct}%` } as React.CSSProperties}
      />
      {(lowLabel || highLabel) && (
        <div className="flex justify-between px-1">
          <span className="text-xs text-muted-foreground">{lowLabel}</span>
          <span className="text-xs text-muted-foreground">{highLabel}</span>
        </div>
      )}
    </div>
  );
}

function ChipCol({
  options, value, onChange, translate,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  translate?: (s: string) => string;
}) {
  return (
    <div className="flex flex-col gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(value === opt ? "" : opt)}
          className={`w-full text-left px-4 py-3.5 rounded-2xl border text-sm font-medium transition-all touch-target ${
            value === opt
              ? "bg-primary/10 border-primary text-foreground"
              : "bg-card border-border text-muted-foreground hover:border-primary/30"
          }`}
        >
          {translate ? translate(opt) : opt}
        </button>
      ))}
    </div>
  );
}

function MultiSelectGrid({
  options, selected, onToggle, translate,
}: {
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
  translate?: (s: string) => string;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onToggle(opt)}
          className={`py-3 px-3 rounded-2xl border text-sm font-medium text-left leading-tight transition-all touch-target ${
            selected.includes(opt)
              ? "bg-primary/10 border-primary text-foreground"
              : "bg-card border-border text-muted-foreground hover:border-primary/30"
          }`}
        >
          {translate ? translate(opt) : opt}
        </button>
      ))}
    </div>
  );
}

// ── Draft state ───────────────────────────────────────────────
interface Draft {
  onsetType: string;
  intensity: number;
  confidenceBefore: number;
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
  substances: string[];
  cravingOutcome: string;
  intensityAfter: number;
  useOutcome: "" | "used" | "not_used" | "unsure";
}

function blankDraft(): Draft {
  return {
    onsetType: "",
    intensity: 5,
    confidenceBefore: 5,
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
    substances: [],
    cravingOutcome: "",
    intensityAfter: 5,
    useOutcome: "",
  };
}

// ── Main component ────────────────────────────────────────────
export function CravingTracker() {
  const { step, setStep, draft, setDraft, reg } = useResumableDraft<Step, Draft>({
    type: "craving",
    route: "/craving",
    firstStep: "onset",
    makeBlank: blankDraft,
    steps: STEP_ORDER,
  });
  const [saving, setSaving] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [savedLog, setSavedLog] = useState<CravingLog | null>(null);
  const { logCraving } = useStore();
  const [, navigate] = useLocation();
  const { t, tOpt } = useT();

  const STEP_LABELS: Record<Step, string> = {
    onset: t("craving.step.onset"),
    trigger: t("craving.step.trigger"),
    inner: t("craving.step.emotions"),
    substance: t("craving.step.substance"),
    action: t("craving.step.action"),
    outcome: t("craving.step.outcome"),
    done: t("common.done"),
  };

  const update = useCallback(<K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleArr = useCallback((key: "situationPresets" | "physicalSensations" | "substances", val: string) => {
    setDraft((prev) => {
      const arr = prev[key];
      return {
        ...prev,
        [key]: arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val],
      };
    });
  }, []);

  // Inner-experience toggles — capped (emotions 3, thoughts 2) via drop-oldest.
  const toggleEmotion = useCallback((v: string) => {
    setDraft((prev) => {
      const arr = prev.emotions;
      return { ...prev, emotions: arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v].slice(-3) };
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
      case "onset":   return draft.onsetType !== "" && (draft.onsetType !== "Other" || draft.onsetOther.trim() !== "");
      case "trigger": return draft.situationPresets.length > 0 && draft.buildupDuration !== "" && (!draft.situationPresets.includes("Other") || draft.triggerOther.trim() !== "");
      case "inner":   return draft.emotions.length > 0 || draft.emotionOther.trim() !== "" || draft.thoughtPresets.length > 0 || draft.thoughtFreeText.trim() !== "";
      case "substance": return draft.substances.length > 0;
      case "action":  return draft.chosenAction !== "";
      case "outcome": return draft.useOutcome !== "";
      default:        return true;
    }
  }, [step, draft.onsetType, draft.onsetOther, draft.situationPresets, draft.triggerOther, draft.buildupDuration, draft.emotions, draft.emotionOther, draft.thoughtPresets, draft.thoughtFreeText, draft.substances, draft.chosenAction, draft.useOutcome]);

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
    // "Used" on the action step short-circuits the outcome step → straight to relapse logging.
    if (step === "action" && draft.chosenAction === "used") {
      save();
      return;
    }
    if (stepIdx === STEP_ORDER.length - 1) {
      save();
    } else {
      setStep(STEP_ORDER[stepIdx + 1]);
    }
  };

  const save = async () => {
    setSaving(true);
    const usedSub = draft.chosenAction === "used";
    const saved = await logCraving({
      cravingType: "passive",
      timestamp: Date.now(),
      status: "completed",
      onsetType: draft.onsetType,
      intensity: draft.intensity,
      distressLevel: 0,
      riskLevel: "",
      situationPresets: draft.situationPresets,
      situationOther: draft.situationPresets.includes("Other") ? draft.triggerOther : "",
      emotions: draft.emotions,
      emotionOther: draft.emotionOther,
      physicalSensations: draft.physicalSensations,
      thoughtPresets: draft.thoughtPresets,
      thoughtFreeText: draft.thoughtFreeText,
      onsetOther: draft.onsetType === "Other" ? draft.onsetOther : "",
      location: draft.location,
      locationOther: "",
      socialContext: [],
      substances: draft.substances,
      primarySubstance: "",
      buildupDuration: draft.buildupDuration,
      chosenAction: draft.chosenAction,
      chosenActionOther: "",
      toolUsed: null,
      confidenceBefore: draft.confidenceBefore,
      intensityAfter: null,
      confidenceAfter: null,
      cravingOutcome: null,
      interventionUsed: null,
      markAsPattern: false,
      highRiskFlag: draft.intensity >= 8,
      note: "",
      useOutcome: usedSub ? "used" : (draft.useOutcome || undefined),
    });
    setSavedLog(saved);
    setSaving(false);
    if (usedSub) {
      reg.clearSession();
      navigate("/relapse");
    } else {
      reg.patchSession({ savedLogId: saved.id, step: "done" });
      setStep("done");
    }
  };

  const applyOutcome = useCallback(async (outcome: string, intensityAfter: number) => {
    if (!savedLog) return;
    const real = (["decreased", "same", "increased"] as const).find((o) => o === outcome) ?? null;
    const updated: CravingLog = { ...savedLog, cravingOutcome: real, intensityAfter: real ? intensityAfter : null };
    setSavedLog(updated);
    await updateCravingLog(updated);
  }, [savedLog]);

  // ── Done screen ───────────────────────────────────────────
  if (step === "done") {
    const outcomeMsg =
      draft.cravingOutcome === "decreased" ? t("craving.msg.decreased")
      : draft.cravingOutcome === "same" ? t("craving.msg.same")
      : draft.cravingOutcome === "increased" ? t("craving.msg.increased")
      : t("craving.done.sub");

    const chosenDef = OUTCOME_ACTIONS.find((a) => a.value === draft.chosenAction);
    const showMethod = chosenDef && draft.chosenAction !== "used" && draft.chosenAction !== "just-observed";

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

          {/* Chosen method card */}
          {showMethod && chosenDef && (
            <div className="w-full max-w-xs bg-primary/8 border border-primary/25 rounded-2xl p-4 flex flex-col gap-2 text-left">
              <p className="text-[11px] text-muted-foreground uppercase tracking-widest">{t("craving.action.chosen")}</p>
              <p className="text-sm font-semibold text-foreground">{tOpt(chosenDef.label)}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{t("craving.action.go_do_it")}</p>
              {chosenDef.tool && (
                <button
                  onClick={() => {
                    reg.patchSession({ pendingReturn: { returnRoute: "/craving", returnStep: "done" } });
                    navigate(chosenDef.tool!);
                  }}
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
                    update("cravingOutcome", next);
                    applyOutcome(next, draft.intensityAfter);
                  }}
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
            <button
              onClick={() => {
                reg.patchSession({ pendingReturn: { returnRoute: "/craving", returnStep: "done" } });
                navigate("/tools");
              }}
              className="w-full bg-primary text-primary-foreground rounded-2xl py-3.5 font-semibold touch-target hover:opacity-90 active:scale-95 transition-all"
            >
              {t("common.browse_tools")}
            </button>
            <button onClick={() => { reg.clearSession(); navigate("/"); }}
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
    <div className="flex flex-col min-h-dvh bg-background">
      <PageHeader title={t("craving.title")} back subtitle={STEP_LABELS[step]} />

      {/* Progress bar */}
      <div className="h-0.5 bg-muted shrink-0">
        <div className="h-full bg-primary transition-all duration-400" style={{ width: `${progressPct}%` }} />
      </div>

      {/* Step counter */}
      <div className="flex items-center justify-between px-4 pt-3 pb-0 shrink-0">
        <p className="text-xs text-muted-foreground">
          {t("common.step_of").replace("{n}", String(stepIdx + 1)).replace("{total}", String(STEP_ORDER.length))}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto scroll-smooth-ios px-4 pt-4 flex flex-col gap-4"
        style={{ paddingBottom: "calc(12rem + env(safe-area-inset-bottom))" }}>

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
                    onClick={() => navigate(path)}
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
            <p className="text-base font-medium text-foreground">{t("craving.q.onset")}</p>
            <p className="text-sm text-muted-foreground -mt-2">{t("craving.q.onset_sub")}</p>
            <ChipCol
              options={ONSET_TYPES}
              value={draft.onsetType}
              onChange={(v) => update("onsetType", v)}
              translate={tOpt}
            />
            {draft.onsetType === "Other" && (
              <textarea
                value={draft.onsetOther}
                onChange={(e) => update("onsetOther", e.target.value)}
                placeholder={t("craving.onset.other_placeholder")}
                rows={2}
                autoFocus
                className="w-full px-4 py-3 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
              />
            )}
            <div className="h-px bg-border my-1" />
            <p className="text-sm font-medium text-foreground">{t("craving.q.intensity")}</p>
            <IntensitySlider
              value={draft.intensity}
              onChange={(v) => update("intensity", v)}
              lowLabel={t("logs.cr_intensity_low")}
              highLabel={t("logs.cr_intensity_high")}
            />
            <div className="h-px bg-border my-1" />
            <p className="text-sm font-medium text-foreground">{t("craving.q.confidence")}</p>
            <IntensitySlider
              value={draft.confidenceBefore}
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
            <p className="text-base font-medium text-foreground">{t("craving.q.situation")}</p>
            <p className="text-sm text-muted-foreground -mt-2">{t("craving.q.situation_sub")}</p>
            <MultiSelectGrid
              options={TRIGGER_PRESETS}
              selected={draft.situationPresets}
              onToggle={(v) => toggleArr("situationPresets", v)}
              translate={tOpt}
            />
            {draft.situationPresets.includes("Other") && (
              <textarea
                value={draft.triggerOther}
                onChange={(e) => update("triggerOther", e.target.value)}
                placeholder={t("craving.onset.other_placeholder")}
                rows={2}
                autoFocus
                className="w-full px-4 py-3 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
              />
            )}
            <div className="h-px bg-border my-1" />
            <p className="text-base font-medium text-foreground">
              {t("craving.q.physical")}{" "}
              <span className="text-muted-foreground font-normal text-sm">({t("common.optional")})</span>
            </p>
            <p className="text-sm text-muted-foreground -mt-2">{t("craving.q.physical_sub")}</p>
            <MultiSelectGrid
              options={PHYSICAL_SENSATIONS}
              selected={draft.physicalSensations}
              onToggle={(v) => toggleArr("physicalSensations", v)}
              translate={tOpt}
            />
            <div className="h-px bg-border my-1" />
            <p className="text-base font-medium text-foreground">{t("craving.q.buildup")}</p>
            <div className="flex flex-col gap-2">
              {BUILDUP_OPTIONS.map(({ value, label, sub }) => (
                <button key={value}
                  onClick={() => update("buildupDuration", draft.buildupDuration === value ? "" : value)}
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
            <p className="text-base font-medium text-foreground">{t("craving.q.emotions")}</p>
            <p className="text-sm text-muted-foreground -mt-2">{t("craving.q.emotions_sub")}</p>
            <MultiSelectGrid
              options={EMOTIONS}
              selected={draft.emotions}
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
            <p className="text-base font-medium text-foreground">{t("craving.q.thoughts")}</p>
            <p className="text-sm text-muted-foreground -mt-2">{t("craving.q.thoughts_sub")}</p>
            <MultiSelectGrid
              options={THOUGHTS}
              selected={draft.thoughtPresets}
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

        {/* ── Substance ──────────────────────────────────────── */}
        {step === "substance" && (
          <>
            <p className="text-base font-medium text-foreground">{t("craving.q.substance")}</p>
            <p className="text-sm text-muted-foreground -mt-2">{t("craving.q.substance_sub")}</p>
            <MultiSelectGrid
              options={SUBSTANCES}
              selected={draft.substances}
              onToggle={(v) => toggleArr("substances", v)}
              translate={tOpt}
            />
          </>
        )}

        {/* ── Action ─────────────────────────────────────────── */}
        {step === "action" && (
          <>
            <p className="text-base font-medium text-foreground">{t("craving.q.action")}</p>
            <div className="flex flex-col gap-2">
              {OUTCOME_ACTIONS.map(({ value, label }) => (
                <button key={value}
                  onClick={() => update("chosenAction", draft.chosenAction === value ? "" : value)}
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
      </div>

      {/* Sticky bottom bar */}
      <div
        className="fixed left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border px-4 pt-3 pb-3 z-40"
        style={{ bottom: "calc(6.25rem + env(safe-area-inset-bottom))" }}
      >
        <div className="flex gap-3 max-w-lg mx-auto">
          {canGoBack && (
            <button onClick={goBack}
              className="touch-target px-5 py-3.5 border border-border rounded-2xl font-medium text-muted-foreground hover:text-foreground transition-colors">
              {t("common.back")}
            </button>
          )}
          <button
            disabled={saving || !canProceed}
            onClick={goNext}
            className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-2xl py-3.5 font-semibold touch-target hover:opacity-90 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {stepIdx === STEP_ORDER.length - 1
              ? (saving ? t("common.saving") : t("common.save"))
              : <><span>{t("common.next")}</span><ArrowRight size={16} /></>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
