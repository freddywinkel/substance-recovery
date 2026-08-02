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
import { getBoredomLogs, type BoredomLog } from "@/db";
import { useActiveRegistration } from "@/contexts/ActiveRegistrationContext";
import { useT } from "@/hooks/useTranslation";
import { IntensitySlider } from "@/components/tracker/IntensitySlider";
import { ChipCol } from "@/components/tracker/ChipCol";
import { MultiSelectGrid } from "@/components/tracker/MultiSelectGrid";
import { StepLayout } from "@/components/tracker/StepLayout";
import { ActionBar } from "@/components/tracker/ActionBar";
import { CheckCircle2, Timer, Zap, Wind, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { removeHiddenOtherText, toStableOptionId, toStableOptionIds } from "@/lib/registrationIds";

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
  "Yes — this feels like restlessness",
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
const RESCUE_SENSORY = ["Hold something textured", "Notice one scent", "Cold or warm water on hands", "Listen to one sound", "Fresh air or softer light"];
const RESCUE_SOCIAL = ["Call or text someone", "Sit near other people", "Ask someone to join a short walk", "Send a simple check-in message"];

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
            aria-pressed={value.includes(item)}
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
  intensity: number | null;
  stimulationNeeds: string[];
  convertCheck: string;
  situation: string;
  situationOther: string;
  urge: string;
  urgeOther: string;
  rescueMenu: string[];
  action: string;
  showNote: boolean;
  note: string;
}

export function BoredomTracker() {
  const [, navigate] = useLocation();
  const { logBoredom, updateBoredom } = useStore();
  const { t, tOpt } = useT();
  const { toast } = useToast();

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
  const [intensity, setIntensity] = useState<number | null>(() => md?.intensity ?? null);

  // Step 2 — need + convert check
  const [stimulationNeeds, setStimulationNeeds] = useState<string[]>(() => md?.stimulationNeeds ?? []);
  const [convertCheck, setConvertCheck] = useState(() => md?.convertCheck ?? "");

  // Step 3 — situation + urge
  const [situation, setSituation] = useState(() => md?.situation ?? "");
  const [situationOther, setSituationOther] = useState(() => md?.situationOther ?? "");
  const [urge, setUrge] = useState(() => md?.urge ?? "");
  const [urgeOther, setUrgeOther] = useState(() => md?.urgeOther ?? "");

  // Step 4 — rescue menu + main action + note
  const [rescueMenu, setRescueMenu] = useState<string[]>(() => md?.rescueMenu ?? []);
  const [action, setAction] = useState(() => md?.action ?? "");
  const [showNote, setShowNote] = useState(() => md?.showNote ?? false);
  const [note, setNote] = useState(() => md?.note ?? "");

  // Done — outcome follow-up
  const [savedLog, setSavedLog] = useState<BoredomLog | null>(null);
  const [outcome, setOutcome] = useState("");
  const [outcomeSaving, setOutcomeSaving] = useState(false);
  const [navigationSaving, setNavigationSaving] = useState(false);
  const outcomeWriteLock = useRef(false);
  const navigationWriteLock = useRef(false);

  // Persisted draft snapshot — resume after tab switch / reload.
  const draft = useMemo<BoredomDraft>(
    () => ({
      restlessnessTypes, intensity, stimulationNeeds, convertCheck, situation,
      situationOther, urge, urgeOther, rescueMenu, action, showNote, note,
    }),
    [restlessnessTypes, intensity, stimulationNeeds, convertCheck, situation,
     situationOther, urge, urgeOther, rescueMenu, action, showNote, note],
  );

  useEffect(() => {
    if (!matchedRef.current) {
      void reg.startSession({
        type: "boredom",
        route: "/boredom",
        step,
        draft,
        stepIndex: STEP_ORDER.indexOf(step) + 1 || STEP_ORDER.length,
        stepCount: STEP_ORDER.length,
      });
    } else if (matchedRef.current.pendingReturn) {
      void reg.patchSession({ pendingReturn: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const firstSync = useRef(true);
  useEffect(() => {
    if (firstSync.current) {
      firstSync.current = false;
      return;
    }
    void reg.patchSession({
      step,
      draft,
      stepIndex: STEP_ORDER.indexOf(step) + 1 || STEP_ORDER.length,
      stepCount: STEP_ORDER.length,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, draft]);

  useEffect(() => {
    const id = reg.session?.savedLogId;
    if (!id || step !== "done") return;
    void getBoredomLogs().then((logs) => {
      const found = logs.find((log) => log.id === id);
      if (found) {
        setSavedLog(found);
        setOutcome(found.outcomeAfter === "unknown" ? "dont-know" : found.outcomeAfter ?? "");
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Completion messages keyed by stored English action value
  const MESSAGES: Record<string, string> = {
    "Sat with it — didn't react": t("boredom.msg.sat_with"),
    "Delayed action": t("boredom.msg.delayed"),
    "Replaced with healthy routine": t("boredom.msg.replaced"),
    "Escaped immediately": t("boredom.msg.escaped"),
  };

  const toggle = (
    set: React.Dispatch<React.SetStateAction<string[]>>,
    val: string,
    max?: number,
  ) => set((prev) => prev.includes(val)
    ? prev.filter((x) => x !== val)
    : max != null && prev.length >= max ? prev : [...prev, val]);

  const toggleRescue = (val: string) => toggle(setRescueMenu, val);

  const toggleStimulationNeed = (value: string) => {
    const groupByNeed: Record<string, string[]> = {
      calming: RESCUE_CALM,
      movement: RESCUE_MOVE,
      hands: RESCUE_HANDS,
      mental: RESCUE_MENTAL,
      "sensory-reset": RESCUE_SENSORY,
      social: RESCUE_SOCIAL,
    };
    const removing = stimulationNeeds.includes(value);
    setStimulationNeeds((previous) => removing
      ? previous.filter((item) => item !== value)
      : [...previous, value]);
    if (removing) {
      const hidden = new Set(groupByNeed[value] ?? []);
      setRescueMenu((previous) => previous.filter((item) => !hidden.has(item)));
    }
  };

  const stepIdx = STEP_ORDER.indexOf(step);
  const totalSteps = STEP_ORDER.length;

  // Gate "Next": every required question on the current step must be answered.
  const canProceed = useMemo(() => {
    switch (step) {
      case "type":      return restlessnessTypes.length > 0;
      case "need":      return stimulationNeeds.length > 0 && convertCheck !== "";
      case "situation": return situation !== "" && (situation !== "Other" || situationOther.trim() !== "");
      case "action":    return action !== "";
      default:          return true;
    }
  }, [step, restlessnessTypes, stimulationNeeds, convertCheck, situation, situationOther, action]);

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    const completedAt = Date.now();
    const startedAt = reg.session?.startedAt ?? completedAt;
    try {
      const saved = await logBoredom({
        timestamp: startedAt,
        occurredAt: startedAt,
        startedAt,
        completedAt,
        dataVersion: 2,
        contentVersion: "registration-v2",
        answers: {
          restlessnessTypes: toStableOptionIds(restlessnessTypes),
          intensity,
          stimulationNeeds,
          convertCheck: toStableOptionId(convertCheck),
          situation: toStableOptionId(situation),
          urge: toStableOptionId(urge),
          rescueMenu: toStableOptionIds(rescueMenu),
          action: toStableOptionId(action),
        },
        intensity,
        feelingTypes: restlessnessTypes,
        situation,
        situationOther: removeHiddenOtherText(situation, situationOther),
        urge,
        urgeOther: removeHiddenOtherText(urge === "Other stimulation" ? "Other" : urge, urgeOther),
        action,
        delayDuration: null,
        note: note.trim(),
        restlessnessTypes,
        stimulationNeed: stimulationNeeds[0] ?? "",
        stimulationNeeds,
        rescueMenu,
        convertCheck,
        environmentReset: [],
        outcomeAfter: null,
      });
      setSavedLog(saved);
      void reg.patchSession({ savedLogId: saved.id, step: "done" });
      setStep("done");
    } catch {
      toast({ title: t("common.save_error"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const applyOutcome = useCallback(async (next: string) => {
    if (!savedLog || outcomeWriteLock.current || navigationWriteLock.current) return;
    outcomeWriteLock.current = true;
    setOutcomeSaving(true);
    const normalized = next === "dont-know" ? "unknown" : next;
    const real = (["decreased", "same", "increased", "unknown"] as const).find((o) => o === normalized) ?? null;
    const updated: BoredomLog = { ...savedLog, outcomeAfter: real };
    try {
      await updateBoredom(updated);
      setSavedLog(updated);
      setOutcome(next);
    } catch {
      toast({ title: t("common.save_error"), variant: "destructive" });
    } finally {
      outcomeWriteLock.current = false;
      setOutcomeSaving(false);
    }
  }, [savedLog, t, toast, updateBoredom]);

  const openDelay = useCallback(async () => {
    if (!savedLog || navigationWriteLock.current || outcomeWriteLock.current) {
      if (!savedLog) toast({ title: t("common.save_error"), variant: "destructive" });
      return;
    }
    navigationWriteLock.current = true;
    setNavigationSaving(true);
    try {
      const updated: BoredomLog = { ...savedLog, delayDuration: "10" };
      await updateBoredom(updated);
      setSavedLog(updated);
      const returnSaved = await reg.patchSession({
        pendingReturn: { returnRoute: "/boredom", returnStep: "done" },
      });
      if (!returnSaved) {
        toast({ title: t("common.save_error"), variant: "destructive" });
        return;
      }
      navigate("/delay");
    } catch {
      toast({ title: t("common.save_error"), variant: "destructive" });
    } finally {
      navigationWriteLock.current = false;
      setNavigationSaving(false);
    }
  }, [navigate, reg, savedLog, t, toast, updateBoredom]);

  const openTools = useCallback(async () => {
    if (navigationWriteLock.current || outcomeWriteLock.current) return;
    navigationWriteLock.current = true;
    setNavigationSaving(true);
    try {
      const returnSaved = await reg.patchSession({
        pendingReturn: { returnRoute: "/boredom", returnStep: "done" },
      });
      if (!returnSaved) {
        toast({ title: t("common.save_error"), variant: "destructive" });
        return;
      }
      navigate("/tools");
    } finally {
      navigationWriteLock.current = false;
      setNavigationSaving(false);
    }
  }, [navigate, reg, t, toast]);

  function goNext() {
    if (step === "type") setStep("need");
    else if (step === "need") setStep("situation");
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
    <StepLayout
      title={t("boredom.title")}
      subtitle={step !== "done" ? t("common.step_of").replace("{n}", String(stepIdx + 1)).replace("{total}", String(totalSteps)) : undefined}
      back
      backDisabled={saving}
      step={step !== "done" ? { current: stepIdx + 1, total: totalSteps } : undefined}
      actionBar={
        step !== "done" ? (
          <ActionBar
            showBack={step !== "type"}
            onBack={goBack}
            onNext={goNext}
            nextIsSubmit={step === "action"}
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

        {/* ── Step 1: Restlessness type + intensity ─────────── */}
        {step === "type" && (
          <>
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-1">{t("boredom.q.type")}</h2>
              <p className="text-sm text-muted-foreground">{t("boredom.q.type_sub")}</p>
            </div>
            <MultiSelectGrid
              options={RESTLESSNESS_TYPES}
              value={restlessnessTypes}
              onToggle={(v) => toggle(setRestlessnessTypes, v, 2)}
              translate={tOpt}
              maxSelections={2}
              selectionLabel={t("tracker.selection_limit")}
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
                  onClick={() => toggleStimulationNeed(val)}
                  aria-pressed={stimulationNeeds.includes(val)}
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

            {/* Classification suggestions are logged before another tracker starts. */}
            {convertCheck === "Maybe a craving" && (
              <div className="bg-card border border-border rounded-2xl p-4 flex items-start gap-3">
                <Zap size={18} className="text-primary shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{t("boredom.route.craving_title")}</p>
                  <p className="text-xs text-muted-foreground">{t("boredom.route.craving_sub")}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t("boredom.route.after_save")}</p>
                </div>
              </div>
            )}
            {convertCheck === "Maybe anxiety" && (
              <div className="bg-card border border-border rounded-2xl p-4 flex items-start gap-3">
                <Wind size={18} className="text-primary shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{t("boredom.route.anxiety_title")}</p>
                  <p className="text-xs text-muted-foreground">{t("boredom.route.anxiety_sub")}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t("boredom.route.after_save")}</p>
                </div>
              </div>
            )}
            {convertCheck === "Maybe loneliness" && (
              <div className="bg-card border border-border rounded-2xl p-4 text-sm text-muted-foreground">
                {t("boredom.route.loneliness")}
              </div>
            )}
            {convertCheck === "Maybe exhaustion" && (
              <div className="bg-card border border-border rounded-2xl p-4 text-sm text-muted-foreground">
                {t("boredom.route.exhaustion")}
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
            <ChipCol
              options={SITUATIONS}
              value={situation}
              onChange={(value) => {
                setSituation(value);
                if (value !== "Other") setSituationOther("");
              }}
              translate={tOpt}
            />
            {situation === "Other" && (
              <textarea
                value={situationOther}
                onChange={(event) => setSituationOther(event.target.value)}
                placeholder={t("boredom.other_situation")}
                rows={2}
                className="w-full rounded-2xl border border-input bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
              />
            )}

            <div className="h-px bg-border" />

            <div>
              <h3 className="text-base font-medium text-foreground mb-3">
                {t("boredom.q.urge")}{" "}
                <span className="text-muted-foreground font-normal text-sm">({t("common.optional")})</span>
              </h3>
              <ChipCol
                options={URGES}
                value={urge}
                onChange={(value) => {
                  setUrge(value);
                  if (value !== "Other stimulation") setUrgeOther("");
                }}
                translate={tOpt}
              />
              {urge === "Other stimulation" && (
                <textarea
                  value={urgeOther}
                  onChange={(event) => setUrgeOther(event.target.value)}
                  placeholder={t("boredom.other_urge")}
                  rows={2}
                  className="w-full rounded-2xl border border-input bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
                />
              )}
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
              <RescueSection title={t("boredom.rescue.hands")} items={RESCUE_HANDS.filter((item) => urge !== "Eat" || item !== "Snack prep")} value={rescueMenu} onToggle={toggleRescue} translate={tOpt} />
            )}
            {stimulationNeeds.includes("mental") && (
              <RescueSection title={t("boredom.rescue.mental")} items={RESCUE_MENTAL.filter((item) => urge !== "Gaming" || item !== "Low-intensity game")} value={rescueMenu} onToggle={toggleRescue} translate={tOpt} />
            )}
            {stimulationNeeds.includes("sensory-reset") && (
              <RescueSection title={t("boredom.rescue.sensory")} items={RESCUE_SENSORY} value={rescueMenu} onToggle={toggleRescue} translate={tOpt} />
            )}
            {stimulationNeeds.includes("social") && (
              <RescueSection title={t("boredom.rescue.social")} items={RESCUE_SOCIAL} value={rescueMenu} onToggle={toggleRescue} translate={tOpt} />
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
                    type="button"
                    disabled={outcomeSaving || navigationSaving}
                    onClick={() => {
                      const next = outcome === value ? "" : value;
                      void applyOutcome(next);
                    }}
                    aria-pressed={outcome === value}
                    className={`py-3 px-3 rounded-2xl border text-sm font-medium transition-all touch-target disabled:opacity-60 ${
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
              {(convertCheck === "Maybe a craving" || convertCheck === "Maybe anxiety") && (
                <button
                  type="button"
                  disabled={navigationSaving || outcomeSaving}
                  onClick={async () => {
                    if (navigationWriteLock.current || outcomeWriteLock.current) return;
                    navigationWriteLock.current = true;
                    setNavigationSaving(true);
                    try {
                      await reg.clearSession();
                      navigate(convertCheck === "Maybe a craving" ? "/craving" : "/anxiety");
                    } catch {
                      toast({ title: t("common.save_error"), variant: "destructive" });
                    } finally {
                      navigationWriteLock.current = false;
                      setNavigationSaving(false);
                    }
                  }}
                  className="flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-2xl px-5 py-3.5 text-sm font-semibold touch-target disabled:opacity-60"
                >
                  {convertCheck === "Maybe a craving" ? t("boredom.route.craving_title") : t("boredom.route.anxiety_title")}
                  <ArrowRight size={15} />
                </button>
              )}
              <button
                type="button"
                disabled={navigationSaving || outcomeSaving || !savedLog}
                onClick={() => { void openDelay(); }}
                className="flex items-center justify-center gap-2 bg-card border border-border rounded-2xl px-5 py-3.5 text-sm font-medium text-foreground hover:border-primary/40 transition-colors touch-target disabled:opacity-60"
              >
                <Timer size={16} className="text-primary" />
                {t("common.delay_timer")}
              </button>
              <button
                type="button"
                disabled={navigationSaving || outcomeSaving}
                onClick={() => { void openTools(); }}
                className="flex items-center justify-center gap-2 bg-card border border-border rounded-2xl px-5 py-3.5 text-sm font-medium text-foreground hover:border-primary/40 transition-colors touch-target disabled:opacity-60"
              >
                {t("common.browse_tools")}
              </button>
              <button
                type="button"
                disabled={navigationSaving || outcomeSaving}
                onClick={async () => {
                  if (navigationWriteLock.current || outcomeWriteLock.current) return;
                  navigationWriteLock.current = true;
                  setNavigationSaving(true);
                  try {
                    if (!(await reg.completeSession())) {
                      throw new Error("Boredom registration could not be completed.");
                    }
                    navigate("/");
                  } catch {
                    toast({ title: t("common.save_error"), variant: "destructive" });
                  } finally {
                    navigationWriteLock.current = false;
                    setNavigationSaving(false);
                  }
                }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors touch-target disabled:opacity-60"
              >
                {t("common.done_home")}
              </button>
            </div>
          </div>
        )}
    </StepLayout>
  );
}
