/**
 * BoredomTracker v2 — 4-step restlessness + action log.
 *
 * Steps: type → need/convert → situation → action
 * Done screen: outcome check + timer option
 *
 * Clinical framing: building tolerance for boredom/emptiness in early recovery,
 * dopamine regulation awareness. NOT for obsessive self-monitoring.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useStore } from "@/hooks/useStore";
import { updateBoredomLog, type BoredomLog } from "@/db";
import { useActiveRegistration } from "@/contexts/ActiveRegistrationContext";
import { useT } from "@/hooks/useT";
import { PageHeader } from "@/components/PageHeader";
import { CheckCircle2, Timer, Zap, Wind, ArrowRight } from "lucide-react";

// ─────────────────────────────────────────────────────────────
// Step types
// ─────────────────────────────────────────────────────────────
type Step = "type" | "need" | "situation" | "action" | "done";
const STEP_ORDER: Step[] = ["type", "need", "situation", "action"];

// ─────────────────────────────────────────────────────────────
// Option lists (stored as English canonical values)
// ─────────────────────────────────────────────────────────────
const RESTLESSNESS_TYPES = [
  "Bored",
  "Understimulated",
  "Physically agitated",
  "Mentally noisy",
  "Can't sit still",
  "Empty",
  "Irritated",
  "Craving stimulation",
  "Lonely and restless",
  "Tired but wired",
];

const STIMULATION_NEEDS = [
  { value: "calming", label: "Calming", sub: "I need to slow down" },
  { value: "movement", label: "Movement", sub: "My body needs to move" },
  { value: "sensory-reset", label: "Sensory reset", sub: "Temperature, texture, smell" },
  { value: "hands", label: "Hands busy", sub: "Something to do with my hands" },
  { value: "mental", label: "Light mental", sub: "Easy thinking or reading" },
  { value: "social", label: "Social contact", sub: "A voice or presence" },
];

const CONVERT_CHECKS = [
  "No — this is restlessness",
  "Maybe a craving",
  "Maybe anxiety",
  "Maybe loneliness",
  "Maybe exhaustion",
  "Not sure",
];

const SITUATIONS = [
  "Doing nothing",
  "Between activities",
  "Alone",
  "After stimulation drops",
  "Before sleep",
  "Other",
];

const URGES = [
  "Scroll / phone",
  "Gaming",
  "Eat",
  "Use substances",
  "Seek people",
  "Other stimulation",
];

// Grouped rescue actions
const RESCUE_CALM = ["Shower", "Tea or water", "Cold water on face", "Breathe slowly", "Lie down briefly"];
const RESCUE_MOVE = ["Short walk", "Stretch", "Shake tension out", "Paced steps", "2-minute movement"];
const RESCUE_HANDS = ["Fold laundry", "Tidy one area", "Doodle", "Snack prep", "Organize a drawer"];
const RESCUE_MENTAL = ["Simple reading", "Podcast", "Low-intensity game", "Recipe browsing", "Light admin task"];
const RESCUE_ENV = ["Open a window", "Softer lights", "Leave the room", "Change clothes", "Sit somewhere else"];

const MAIN_ACTIONS = [
  "Sat with it — didn't react",
  "Delayed action",
  "Replaced with healthy routine",
  "Escaped immediately",
];

const OUTCOMES = [
  { value: "decreased", label: "Decreased" },
  { value: "same", label: "Same" },
  { value: "increased", label: "Increased" },
  { value: "dont-know", label: "Don't know" },
];

// ─────────────────────────────────────────────────────────────
// Shared UI components
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

function GridMultiChip({
  options, value, onToggle, cols = 2, translate,
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

function RescueSection({
  title, items, value, onToggle, translate,
}: {
  title: string;
  items: string[];
  value: string[];
  onToggle: (v: string) => void;
  translate?: (s: string) => string;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">{title}</p>
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <button
            key={item}
            onClick={() => onToggle(item)}
            className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm font-medium transition-all touch-target ${
              value.includes(item)
                ? "bg-primary/10 border-primary text-foreground"
                : "bg-card border-border text-muted-foreground hover:border-primary/30"
            }`}
          >
            {translate ? translate(item) : item}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────
interface BoredomDraft {
  restlessnessTypes: string[];
  intensity: number;
  stimulationNeeds: string[];
  convertCheck: string;
  situation: string;
  urge: string;
  rescueMenu: string[];
  action: string;
  showNote: boolean;
  note: string;
}

export function BoredomTracker() {
  const [, navigate] = useLocation();
  const { logBoredom } = useStore();
  const { t, tOpt } = useT();

  const reg = useActiveRegistration();
  const matchedRef = useRef(
    reg.session && reg.session.type === "boredom" ? reg.session : null,
  );
  const m = matchedRef.current;
  const md = m?.draft as BoredomDraft | undefined;

  const [step, setStep] = useState<Step>(() => (m ? (m.step as Step) : "type"));
  const [saving, setSaving] = useState(false);

  // Step 1 — type + intensity
  const [restlessnessTypes, setRestlessnessTypes] = useState<string[]>(() => md?.restlessnessTypes ?? []);
  const [intensity, setIntensity] = useState(() => md?.intensity ?? 5);

  // Step 2 — need + convert check
  const [stimulationNeeds, setStimulationNeeds] = useState<string[]>(() => md?.stimulationNeeds ?? []);
  const [convertCheck, setConvertCheck] = useState(() => md?.convertCheck ?? "");

  // Step 3 — situation + urge
  const [situation, setSituation] = useState(() => md?.situation ?? "");
  const [urge, setUrge] = useState(() => md?.urge ?? "");

  // Step 4 — rescue menu + main action + note
  const [rescueMenu, setRescueMenu] = useState<string[]>(() => md?.rescueMenu ?? []);
  const [action, setAction] = useState(() => md?.action ?? "");
  const [showNote, setShowNote] = useState(() => md?.showNote ?? false);
  const [note, setNote] = useState(() => md?.note ?? "");

  // Done — outcome follow-up
  const [savedLog, setSavedLog] = useState<BoredomLog | null>(null);
  const [outcome, setOutcome] = useState("");

  // Persisted draft snapshot — resume after tab switch / reload.
  const draft = useMemo<BoredomDraft>(
    () => ({
      restlessnessTypes, intensity, stimulationNeeds, convertCheck, situation,
      urge, rescueMenu, action, showNote, note,
    }),
    [restlessnessTypes, intensity, stimulationNeeds, convertCheck, situation,
     urge, rescueMenu, action, showNote, note],
  );

  useEffect(() => {
    if (!matchedRef.current) {
      reg.startSession({
        type: "boredom",
        route: "/boredom",
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

  // Completion messages keyed by stored English action value
  const MESSAGES: Record<string, string> = {
    "Sat with it — didn't react": t("boredom.msg.sat_with"),
    "Delayed action": t("boredom.msg.delayed"),
    "Replaced with healthy routine": t("boredom.msg.replaced"),
    "Escaped immediately": t("boredom.msg.escaped"),
  };

  const toggle = (set: React.Dispatch<React.SetStateAction<string[]>>, val: string) =>
    set((prev) => prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]);

  const toggleRescue = (val: string) => toggle(setRescueMenu, val);

  const stepIdx = STEP_ORDER.indexOf(step);
  const totalSteps = STEP_ORDER.length;

  // Gate "Next": every required question on the current step must be answered.
  const canProceed = useMemo(() => {
    switch (step) {
      case "type":      return restlessnessTypes.length > 0;
      case "need":      return stimulationNeeds.length > 0 && convertCheck !== "";
      case "situation": return situation !== "";
      case "action":    return action !== "";
      default:          return true;
    }
  }, [step, restlessnessTypes, stimulationNeeds, convertCheck, situation, action]);

  async function handleSave() {
    setSaving(true);
    const saved = await logBoredom({
      timestamp: Date.now(),
      intensity,
      feelingTypes: restlessnessTypes,
      situation,
      urge,
      action,
      delayDuration: "",
      note,
      restlessnessTypes,
      stimulationNeed: stimulationNeeds[0] ?? "",
      stimulationNeeds,
      rescueMenu,
      convertCheck,
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
    const updated: BoredomLog = { ...savedLog, outcomeAfter: real };
    setSavedLog(updated);
    await updateBoredomLog(updated);
  }, [savedLog]);

  function goNext() {
    if (step === "type") setStep("need");
    else if (step === "need") {
      if (convertCheck === "Maybe a craving") { navigate("/craving"); return; }
      if (convertCheck === "Maybe anxiety") { navigate("/anxiety"); return; }
      setStep("situation");
    }
    else if (step === "situation") setStep("action");
    else if (step === "action") handleSave();
  }
  function goBack() {
    if (step === "need") setStep("type");
    else if (step === "situation") setStep("need");
    else if (step === "action") setStep("situation");
  }

  const completionMsg = MESSAGES[action] ?? t("boredom.msg.default");

  return (
    <div className="flex flex-col min-h-dvh bg-background">
      <PageHeader
        title={t("boredom.title")}
        subtitle={step !== "done" ? t("common.step_of").replace("{n}", String(stepIdx + 1)).replace("{total}", String(totalSteps)) : undefined}
        back
      />

      {step !== "done" && (
        <div className="h-0.5 bg-muted mx-4 shrink-0">
          <div
            className="h-full bg-primary transition-all duration-300 rounded-full"
            style={{ width: `${((stepIdx + 1) / totalSteps) * 100}%` }}
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto scroll-smooth-ios px-4 pt-5 flex flex-col gap-5"
        style={{ paddingBottom: "1.5rem" }}>

        {/* ── Step 1: Restlessness type + intensity ─────────── */}
        {step === "type" && (
          <>
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-1">{t("boredom.q.type")}</h2>
              <p className="text-sm text-muted-foreground">{t("boredom.q.type_sub")}</p>
            </div>
            <GridMultiChip
              options={RESTLESSNESS_TYPES}
              value={restlessnessTypes}
              onToggle={(v) => toggle(setRestlessnessTypes, v)}
              translate={tOpt}
            />

            <div className="h-px bg-border" />

            <div>
              <h3 className="text-base font-medium text-foreground mb-1">{t("boredom.q.intensity")}</h3>
              <p className="text-xs text-muted-foreground mb-3">{t("boredom.q.intensity_note")}</p>
              <IntensitySlider
                value={intensity}
                onChange={setIntensity}
                label={t("boredom.intensity_slider")}
                min={0}
                lowLabel="0"
                highLabel="10"
              />
            </div>
          </>
        )}

        {/* ── Step 2: Stimulation need + convert check ──────── */}
        {step === "need" && (
          <>
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-1">{t("boredom.q.need")}</h2>
              <p className="text-sm text-muted-foreground">{t("boredom.q.need_sub")}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {STIMULATION_NEEDS.map(({ value: val, label, sub }) => (
                <button
                  key={val}
                  onClick={() => toggle(setStimulationNeeds, val)}
                  className={`flex flex-col p-4 rounded-2xl border text-left transition-all touch-target ${
                    stimulationNeeds.includes(val)
                      ? "bg-primary/10 border-primary text-foreground"
                      : "bg-card border-border text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  <span className="text-sm font-semibold leading-tight">{tOpt(label)}</span>
                  <span className="text-xs mt-0.5 leading-snug">{tOpt(sub)}</span>
                </button>
              ))}
            </div>

            <div className="h-px bg-border" />

            <div>
              <h3 className="text-base font-medium text-foreground mb-1">{t("boredom.q.convert")}</h3>
              <p className="text-xs text-muted-foreground mb-3">{t("boredom.q.convert_sub")}</p>
              <ChipCol options={CONVERT_CHECKS} value={convertCheck} onChange={setConvertCheck} translate={tOpt} />
            </div>

            {/* Inline routing suggestions */}
            {convertCheck === "Maybe a craving" && (
              <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
                <Zap size={18} className="text-primary shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{t("boredom.route.craving_title")}</p>
                  <p className="text-xs text-muted-foreground">{t("boredom.route.craving_sub")}</p>
                </div>
                <button
                  onClick={() => navigate("/craving")}
                  className="text-xs text-primary font-medium whitespace-nowrap"
                >
                  {t("common.switch")} <ArrowRight size={12} className="inline" />
                </button>
              </div>
            )}
            {convertCheck === "Maybe anxiety" && (
              <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
                <Wind size={18} className="text-primary shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{t("boredom.route.anxiety_title")}</p>
                  <p className="text-xs text-muted-foreground">{t("boredom.route.anxiety_sub")}</p>
                </div>
                <button
                  onClick={() => navigate("/anxiety")}
                  className="text-xs text-primary font-medium whitespace-nowrap"
                >
                  {t("common.switch")} <ArrowRight size={12} className="inline" />
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Step 3: Situation + Urge ──────────────────────── */}
        {step === "situation" && (
          <>
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-1">{t("boredom.q.situation")}</h2>
            </div>
            <ChipCol options={SITUATIONS} value={situation} onChange={setSituation} translate={tOpt} />

            <div className="h-px bg-border" />

            <div>
              <h3 className="text-base font-medium text-foreground mb-3">
                {t("boredom.q.urge")}{" "}
                <span className="text-muted-foreground font-normal text-sm">({t("common.optional")})</span>
              </h3>
              <ChipCol options={URGES} value={urge} onChange={setUrge} translate={tOpt} />
            </div>
          </>
        )}

        {/* ── Step 4: Rescue menu + main action ─────────────── */}
        {step === "action" && (
          <>
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-1">{t("boredom.q.action")}</h2>
              <p className="text-sm text-muted-foreground">{t("boredom.q.action_sub")}</p>
            </div>

            {stimulationNeeds.includes("calming") && (
              <RescueSection title={t("boredom.rescue.calm")} items={RESCUE_CALM} value={rescueMenu} onToggle={toggleRescue} translate={tOpt} />
            )}
            {stimulationNeeds.includes("movement") && (
              <RescueSection title={t("boredom.rescue.move")} items={RESCUE_MOVE} value={rescueMenu} onToggle={toggleRescue} translate={tOpt} />
            )}
            {stimulationNeeds.includes("hands") && (
              <RescueSection title={t("boredom.rescue.hands")} items={RESCUE_HANDS} value={rescueMenu} onToggle={toggleRescue} translate={tOpt} />
            )}
            {stimulationNeeds.includes("mental") && (
              <RescueSection title={t("boredom.rescue.mental")} items={RESCUE_MENTAL} value={rescueMenu} onToggle={toggleRescue} translate={tOpt} />
            )}
            {stimulationNeeds.includes("sensory-reset") && (
              <RescueSection title={t("boredom.rescue.env")} items={RESCUE_ENV} value={rescueMenu} onToggle={toggleRescue} translate={tOpt} />
            )}

            <div className="h-px bg-border" />

            <div>
              <h3 className="text-base font-medium text-foreground mb-3">{t("boredom.q.action_handled")}</h3>
              <ChipCol options={MAIN_ACTIONS} value={action} onChange={setAction} translate={tOpt} />
            </div>

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

            {/* Outcome follow-up */}
            <div className="w-full max-w-xs flex flex-col gap-3 text-left">
              <div>
                <p className="text-base font-medium text-foreground">
                  {t("boredom.q.outcome")}
                  <span className="text-muted-foreground font-normal text-xs ml-2">({t("common.optional")})</span>
                </p>
                <p className="text-sm text-muted-foreground">{t("boredom.q.outcome_sub")}</p>
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
          className="shrink-0 bg-background/95 backdrop-blur-sm border-t border-border px-4 pt-3 pb-3"
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
              {step === "action"
                ? (saving ? t("common.saving") : t("common.save"))
                : <><span>{t("common.next")}</span><ArrowRight size={16} /></>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
