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
import { updateAnxietyLog, type AnxietyLog } from "@/db";
import { useActiveRegistration } from "@/contexts/ActiveRegistrationContext";
import { useT } from "@/hooks/useT";
import { PageHeader } from "@/components/PageHeader";
import {
  CheckCircle2, Timer, Zap, Wind, Waves, AlertCircle,
  ArrowRight,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────
// Step types
// ─────────────────────────────────────────────────────────────
type Step = "type" | "body" | "urgency" | "details" | "reaction" | "done";
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
  "Arms", "Legs", "Whole body",
];

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

const REACTIONS = [
  "Sat with it — didn't react",
  "Tried to fix myself",
  "Avoided or left",
  "Searched for distraction",
  "Talked more / overcompensated",
  "Used a tool (breathing, grounding…)",
  "Reached out to someone",
];

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
// Small shared UI pieces
// ─────────────────────────────────────────────────────────────
function IntensitySlider({
  value, onChange, min = 1, max = 10, label, lowLabel, highLabel,
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
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
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
  options,
  value,
  onChange,
  translate,
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
          onClick={() => onChange(opt === value ? "" : opt)}
          className={`w-full text-left px-4 py-3 rounded-2xl border text-sm font-medium transition-all touch-target ${
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

function MultiChip({
  options,
  value,
  onToggle,
  translate,
}: {
  options: string[];
  value: string[];
  onToggle: (v: string) => void;
  translate?: (s: string) => string;
}) {
  return (
    <div className="flex flex-col gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onToggle(opt)}
          className={`w-full text-left px-4 py-3 rounded-2xl border text-sm font-medium transition-all touch-target ${
            value.includes(opt)
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

function GridMultiChip({
  options,
  value,
  onToggle,
  cols = 2,
  translate,
}: {
  options: string[];
  value: string[];
  onToggle: (v: string) => void;
  cols?: number;
  translate?: (s: string) => string;
}) {
  return (
    <div className={`grid gap-2 ${cols === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onToggle(opt)}
          className={`py-3 px-3 rounded-2xl border text-sm font-medium text-left leading-tight transition-all touch-target ${
            value.includes(opt)
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

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────
interface AnxietyDraft {
  anxietyTypes: string[];
  intensity: number;
  bodyLocations: string[];
  bodyPrediction: string;
  urgencyHigh: boolean;
  context: string;
  triggers: string[];
  reassuranceSeeking: string[];
  linkedStates: string[];
  reaction: string;
  showNote: boolean;
  note: string;
}

export function AnxietyTracker() {
  const [, navigate] = useLocation();
  const { logAnxiety } = useStore();
  const { t, tOpt } = useT();

  const reg = useActiveRegistration();
  const matchedRef = useRef(
    reg.session && reg.session.type === "anxiety" ? reg.session : null,
  );
  const m = matchedRef.current;
  const md = m?.draft as AnxietyDraft | undefined;

  const [step, setStep] = useState<Step>(() => (m ? (m.step as Step) : "type"));
  const [saving, setSaving] = useState(false);

  // Step 1 — type + intensity
  const [anxietyTypes, setAnxietyTypes] = useState<string[]>(() => md?.anxietyTypes ?? []);
  const [intensity, setIntensity] = useState(() => md?.intensity ?? 5);

  // Step 2 — body
  const [bodyLocations, setBodyLocations] = useState<string[]>(() => md?.bodyLocations ?? []);
  const [bodyPrediction, setBodyPrediction] = useState(() => md?.bodyPrediction ?? "");

  // Step 3 — urgency + context + reassurance
  const [urgencyHigh, setUrgencyHigh] = useState(() => md?.urgencyHigh ?? false);
  const [context, setContext] = useState(() => md?.context ?? "");
  const [triggers, setTriggers] = useState<string[]>(() => md?.triggers ?? []);
  const [reassuranceSeeking, setReassuranceSeeking] = useState<string[]>(() => md?.reassuranceSeeking ?? []);
  const [linkedStates, setLinkedStates] = useState<string[]>(() => md?.linkedStates ?? []);

  // Step 4 — reaction + note
  const [reaction, setReaction] = useState(() => md?.reaction ?? "");
  const [showNote, setShowNote] = useState(() => md?.showNote ?? false);
  const [note, setNote] = useState(() => md?.note ?? "");

  // Done — outcome follow-up
  const [savedLog, setSavedLog] = useState<AnxietyLog | null>(null);
  const [outcome, setOutcome] = useState("");

  // Persisted draft snapshot — resume after tab switch / reload.
  const draft = useMemo<AnxietyDraft>(
    () => ({
      anxietyTypes, intensity, bodyLocations, bodyPrediction, urgencyHigh,
      context, triggers, reassuranceSeeking, linkedStates, reaction, showNote, note,
    }),
    [anxietyTypes, intensity, bodyLocations, bodyPrediction, urgencyHigh,
     context, triggers, reassuranceSeeking, linkedStates, reaction, showNote, note],
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

  // Completion messages keyed by stored English reaction value
  const MESSAGES: Record<string, string> = {
    "Sat with it — didn't react": t("anxiety.msg.sat_with"),
    "Used a tool (breathing, grounding…)": t("anxiety.msg.used_tool"),
    "Reached out to someone": t("anxiety.msg.reached_out"),
    "Tried to fix myself": t("anxiety.msg.tried_fix"),
    "Avoided or left": t("anxiety.msg.avoided"),
    "Searched for distraction": t("anxiety.msg.distracted"),
    "Talked more / overcompensated": t("anxiety.msg.overcompensated"),
  };

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
  const canProceed = useMemo(() => {
    switch (step) {
      case "type":     return anxietyTypes.length > 0;
      case "body":     return bodyLocations.length > 0;
      case "urgency":  return true;
      case "reaction": return reaction !== "";
      default:         return true;
    }
  }, [step, anxietyTypes, bodyLocations, reaction]);

  async function handleSave() {
    setSaving(true);
    const saved = await logAnxiety({
      timestamp: Date.now(),
      intensity,
      context,
      trigger: triggers[0] ?? "",
      bodySensations: bodyLocations,
      reaction,
      note,
      anxietyTypes,
      bodyLocations,
      bodyPrediction,
      urgencyHigh,
      reassuranceSeeking,
      linkedState: linkedStates[0] ?? "",
      triggers,
      linkedStates,
      outcomeAfter: null,
    });
    setSavedLog(saved);
    setSaving(false);
    reg.clearSession();
    setStep("done");
  }

  const applyOutcome = useCallback(async (next: string) => {
    if (!savedLog) return;
    const real = (["decreased", "same", "increased"] as const).find((o) => o === next) ?? null;
    const updated: AnxietyLog = { ...savedLog, outcomeAfter: real };
    setSavedLog(updated);
    await updateAnxietyLog(updated);
  }, [savedLog]);

  function goNext() {
    if (step === "type") setStep("body");
    else if (step === "body") setStep("urgency");
    else if (step === "urgency") setStep("details");
    else if (step === "details") setStep("reaction");
    else if (step === "reaction") handleSave();
  }
  function goBack() {
    if (step === "body") setStep("type");
    else if (step === "urgency") setStep("body");
    else if (step === "details") setStep("urgency");
    else if (step === "reaction") setStep("details");
  }

  const completionMsg = MESSAGES[reaction] ?? t("anxiety.msg.default");

  return (
    <div className="flex flex-col min-h-dvh bg-background">
      <PageHeader
        title={t("anxiety.title")}
        subtitle={step !== "done" ? t("common.step_of").replace("{n}", String(stepIdx + 1)).replace("{total}", String(totalSteps)) : undefined}
        back
      />

      {/* Progress bar */}
      {step !== "done" && (
        <div className="h-0.5 bg-muted mx-4 shrink-0">
          <div
            className="h-full bg-primary transition-all duration-300 rounded-full"
            style={{ width: `${((stepIdx + 1) / totalSteps) * 100}%` }}
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto scroll-smooth-ios px-4 pt-5 flex flex-col gap-5"
        style={{ paddingBottom: "calc(9rem + env(safe-area-inset-bottom))" }}>

        {/* ── Step 1: Type + Intensity ─────────────────────── */}
        {step === "type" && (
          <>
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-1">{t("anxiety.q.type")}</h2>
              <p className="text-sm text-muted-foreground">{t("anxiety.q.type_sub")}</p>
            </div>
            <GridMultiChip options={ANXIETY_TYPES} value={anxietyTypes} onToggle={(v) => toggle(setAnxietyTypes, v)} translate={tOpt} />

            <div className="h-px bg-border" />

            <div>
              <h3 className="text-base font-medium text-foreground mb-1">{t("anxiety.q.intensity")}</h3>
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
              <h2 className="text-xl font-semibold text-foreground mb-1">{t("anxiety.q.body")}</h2>
              <p className="text-sm text-muted-foreground">{t("anxiety.q.body_sub")}</p>
            </div>
            <GridMultiChip
              options={BODY_LOCATIONS}
              value={bodyLocations}
              onToggle={(v) => toggle(setBodyLocations, v)}
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
              <h2 className="text-xl font-semibold text-foreground mb-1">{t("anxiety.q.urgency")}</h2>
            </div>

            {/* Urgency toggle */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setUrgencyHigh(true)}
                className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all touch-target ${
                  urgencyHigh
                    ? "bg-primary/10 border-primary text-foreground"
                    : "bg-card border-border text-muted-foreground hover:border-primary/30"
                }`}
              >
                <AlertCircle size={22} />
                <span className="text-sm font-medium text-center leading-tight">{t("anxiety.urgency.high")}</span>
              </button>
              <button
                onClick={() => setUrgencyHigh(false)}
                className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all touch-target ${
                  !urgencyHigh
                    ? "bg-primary/10 border-primary text-foreground"
                    : "bg-card border-border text-muted-foreground hover:border-primary/30"
                }`}
              >
                <Wind size={22} />
                <span className="text-sm font-medium text-center leading-tight">{t("anxiety.urgency.low")}</span>
              </button>
            </div>

            {/* Panic shortcuts (if urgent) */}
            {urgencyHigh && (
              <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3">
                <p className="text-sm font-medium text-foreground">{t("anxiety.quick_tools")}</p>
                {[
                  { labelKey: "anxiety.quick.breathing", path: "/tools/breathing", icon: <Wind size={15} /> },
                  { labelKey: "tools.grounding", path: "/tools/grounding", icon: <Waves size={15} /> },
                  { labelKey: "tools.cold_water", path: "/tools/cold-water", icon: <Zap size={15} /> },
                  { labelKey: "common.delay_timer", path: "/delay", icon: <Timer size={15} /> },
                ].map(({ labelKey, path, icon }) => (
                  <button
                    key={path}
                    onClick={() => navigate(path)}
                    className="flex items-center gap-3 text-sm text-foreground bg-muted rounded-xl px-4 py-3 hover:bg-muted/80 transition-colors touch-target text-left"
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
                onClick={() => setStep("reaction")}
                className="text-sm text-primary hover:opacity-75 transition-opacity touch-target"
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
              <MultiChip options={LINKED_STATES} value={linkedStates} onToggle={toggleLinkedState} translate={tOpt} />
            </div>

            {/* Reassurance-seeking */}
            <div>
              <h3 className="text-base font-medium text-foreground mb-1">
                {t("anxiety.q.patterns")}{" "}
                <span className="text-muted-foreground font-normal text-sm">({t("common.optional")})</span>
              </h3>
              <p className="text-xs text-muted-foreground mb-3">{t("anxiety.q.patterns_sub")}</p>
              <MultiChip options={REASSURANCE_SEEKING} value={reassuranceSeeking} onToggle={(v) => toggle(setReassuranceSeeking, v)} translate={tOpt} />
            </div>

            {/* Trigger (optional) */}
            <div>
              <h3 className="text-base font-medium text-foreground mb-3">
                {t("anxiety.q.trigger")}{" "}
                <span className="text-muted-foreground font-normal text-sm">({t("common.optional")})</span>
              </h3>
              <MultiChip options={TRIGGERS} value={triggers} onToggle={(v) => toggle(setTriggers, v)} translate={tOpt} />
            </div>
          </>
        )}

        {/* ── Step 5: Reaction + Note ───────────────────────── */}
        {step === "reaction" && (
          <>
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-1">{t("anxiety.q.reaction")}</h2>
              <p className="text-sm text-muted-foreground">{t("anxiety.q.reaction_sub")}</p>
            </div>
            <ChipCol options={REACTIONS} value={reaction} onChange={setReaction} translate={tOpt} />

            {!showNote ? (
              <button
                onClick={() => setShowNote(true)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors text-left"
              >
                {t("common.add_note")}
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

        {/* ── Done ──────────────────────────────────────────── */}
        {step === "done" && (
          <div className="flex flex-col items-center text-center gap-6 pt-8">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 size={32} className="text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-2">{t("common.logged")}</h2>
              <p className="text-base text-muted-foreground leading-relaxed max-w-xs mx-auto">
                {completionMsg}
              </p>
            </div>

            {/* Routing based on linked state */}
            {linkedStates.includes("This is triggering a craving") && (
              <button
                onClick={() => navigate("/craving")}
                className="flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-2xl px-5 py-3.5 text-sm font-medium text-foreground hover:bg-primary/15 transition-colors touch-target"
              >
                <Zap size={16} className="text-primary" />
                {t("craving.title")} →
              </button>
            )}
            {linkedStates.includes("This started from restlessness") && (
              <button
                onClick={() => navigate("/boredom")}
                className="flex items-center gap-2 bg-card border border-border rounded-2xl px-5 py-3.5 text-sm font-medium text-foreground hover:border-primary/40 transition-colors touch-target"
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
                    onClick={() => {
                      const next = outcome === value ? "" : value;
                      setOutcome(next);
                      applyOutcome(next);
                    }}
                    className={`py-3 px-3 rounded-2xl border text-sm font-medium transition-all touch-target ${
                      outcome === value
                        ? "bg-primary/10 border-primary text-foreground"
                        : "bg-card border-border text-muted-foreground"
                    }`}
                  >
                    {tOpt(label)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 w-full max-w-xs">
              <button
                onClick={() => navigate("/delay")}
                className="flex items-center justify-center gap-2 bg-card border border-border rounded-2xl px-5 py-3.5 text-sm font-medium text-foreground hover:border-primary/40 transition-colors touch-target"
              >
                <Timer size={16} className="text-primary" />
                {t("common.delay_timer")}
              </button>
              <button
                onClick={() => navigate("/tools")}
                className="flex items-center justify-center gap-2 bg-card border border-border rounded-2xl px-5 py-3.5 text-sm font-medium text-foreground hover:border-primary/40 transition-colors touch-target"
              >
                {t("common.browse_tools")}
              </button>
              <button
                onClick={() => navigate("/")}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors touch-target"
              >
                {t("common.done_home")}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom action bar ─────────────────────────────────── */}
      {step !== "done" && (
        <div
          className="fixed left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border px-4 pt-3 pb-3 z-40"
          style={{ bottom: "calc(3.5rem + env(safe-area-inset-bottom))" }}
        >
          <div className="flex gap-3 max-w-lg mx-auto">
            {step !== "type" && (
              <button
                onClick={goBack}
                className="touch-target px-5 py-3.5 border border-border rounded-2xl font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {t("common.back")}
              </button>
            )}
            <button
              onClick={goNext}
              disabled={saving || !canProceed}
              className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-2xl py-3.5 font-semibold touch-target hover:opacity-90 active:scale-95 transition-all disabled:opacity-60"
            >
              {step === "reaction"
                ? (saving ? t("common.saving") : t("common.save"))
                : <><span>{t("common.next")}</span><ArrowRight size={16} /></>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
