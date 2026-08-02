import { useState, useCallback, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useStore } from "@/hooks/useStore";
import { useT } from "@/hooks/useTranslation";
import { RelapseLog as RelapseLogType, RelapseLabel, EpisodeDuration, AmountCategory, AcuteRisk } from "@/db";
import { useActiveRegistration } from "@/contexts/ActiveRegistrationContext";
import { PageHeader } from "@/components/PageHeader";
import { toStableOptionId, toStableOptionIds } from "@/lib/registrationIds";
import {
  getSubstanceSafetyWarnings,
  getUrgentSafetyCopy,
  phoneHref,
} from "@/lib/registrationSafety";
import { Heart, ArrowRight, AlertTriangle, Phone } from "lucide-react";

// ── Step type ────────────────────────────────────────────────
type Step =
  | "label"
  | "when"
  | "trigger"
  | "before"
  | "next"
  | "done";

const STEP_ORDER: Step[] = ["label", "when", "trigger", "before", "next"];

// ── Option lists ─────────────────────────────────────────────
const LABEL_OPTIONS: { value: RelapseLabel; label: string; sub: string }[] = [
  { value: "lapse", label: "A lapse", sub: "One instance, caught quickly" },
  { value: "relapse", label: "A relapse", sub: "A more serious return" },
  { value: "no-label", label: "No label", sub: "I just want to document this" },
];

const DURATION_OPTIONS: { value: EpisodeDuration; label: string }[] = [
  { value: "single-moment", label: "A single moment" },
  { value: "few-hours", label: "A few hours" },
  { value: "whole-day", label: "The whole day" },
  { value: "multiple-days", label: "Multiple days" },
];

const SUBSTANCES = [
  "Alcohol", "Cannabis", "Cocaine / stimulant", "Benzodiazepines",
  "Nicotine", "Opioids", "Gambling", "Sex / pornography",
  "Gaming", "Food / binge eating",
];

const AMOUNT_OPTIONS: { value: AmountCategory; label: string; sub: string }[] = [
  { value: "small", label: "Small", sub: "Less than usual" },
  { value: "moderate", label: "Moderate", sub: "About as expected" },
  { value: "a-lot", label: "A lot", sub: "More than usual" },
  { value: "multiple-times", label: "Multiple times", sub: "More than once" },
  { value: "binge", label: "A binge", sub: "Couldn't stop" },
  { value: "prefer-not", label: "Prefer not to say", sub: "" },
];

const FIRST_TRIGGER_TYPES = [
  "Internal emotion", "External event", "Specific thought",
  "Physical discomfort", "Social pressure", "Craving out of nowhere",
  "Memory / flashback", "Seeing or smelling a cue",
];

const PRE_USE_FACTORS = [
  "Poor sleep", "High stress", "Conflict", "Isolation",
  "Boredom", "Too much self-confidence", "Stopped reaching out",
  "Let go of routines", "Sought out a trigger place",
  "Had money available", "Contact with a trigger person",
  "Mood got worse gradually", "Felt 'invincible' — too good",
];

const MISSED_WARNINGS = [
  "Withdrawing from others", "Not talking about how I felt",
  "Increased irritability", "Poor self-care",
  "Hungry / tired / overwhelmed",
  "Bargaining with myself", "Romanticizing past use",
  "'Just once' thinking", "Making a plan without admitting it",
  "Seeking out triggers", "Keeping secrets",
  "Hopeless thinking", "Physical tension building",
  "Contact with a risky person", "Bought or prepared",
];

const THOUGHT_PRESETS = [
  "I can't handle this",
  "I'll stop tomorrow",
  "One time won't matter",
  "It's already ruined",
  "I just want peace",
  "I don't want to feel anything",
  "I earned this",
  "No one will know",
];

const COULD_HELP_OPTIONS = [
  "Text or call someone", "Go outside / change location",
  "Leave the trigger place", "Eat or sleep first",
  "Use a tool from the toolbox", "Be honest with someone",
  "Look at my plan", "Block access / money",
  "Make an appointment with a professional",
];

const SUPPORT_CONTACTS = [
  "No one right now", "Partner", "Friend", "Family member",
  "Sponsor", "Therapist / counsellor", "GP / doctor",
  "Crisis line if needed",
];

const NEXT_STEPS = [
  "Water, food, rest first", "Remove triggers from reach",
  "Reach out to someone", "Plan the next 24 hours",
  "Get back to routine", "Structure today", "Make an appointment",
  "Use a support tool", "Start again from right now",
];

const WHAT_NEEDED_OPTIONS = [
  { value: "relief", label: "Relief", sub: "From pain or discomfort" },
  { value: "sleep", label: "Sleep or rest", sub: "Physical exhaustion" },
  { value: "numbness", label: "Numbness", sub: "To feel less" },
  { value: "comfort", label: "Comfort", sub: "To feel held or safe" },
  { value: "stimulation", label: "Stimulation", sub: "To feel something, anything" },
  { value: "escape", label: "Escape", sub: "From the situation or thoughts" },
  { value: "connection", label: "Connection", sub: "To not be alone" },
  { value: "reward", label: "Reward", sub: "A sense of deserving it" },
  { value: "silence", label: "Silence in my head", sub: "To stop the mental noise" },
  { value: "rebellion", label: "Rebellion", sub: "A sense of control or defiance" },
  { value: "other", label: "Something else", sub: "" },
];

const REPAIR_ACTIONS = [
  "Drink water or eat something",
  "Rest and sleep",
  "Remove access or substances",
  "Tell someone safe",
  "Block / delete contact",
  "Leave the place",
  "Re-enter my routine",
  "Open the toolbox",
  "Make a next-24-hour plan",
  "Let myself rest without shame",
];

// ── Helpers ──────────────────────────────────────────────────
function SelectList<T extends string>({
  options, selected, onSelect, multi = false, translate, disabled = false,
}: {
  options: { value: T; label: string; sub?: string }[];
  selected: T | T[];
  onSelect: (v: T) => void;
  multi?: boolean;
  translate?: (s: string) => string;
  disabled?: boolean;
}) {
  const isSelected = (v: T) =>
    multi ? (selected as T[]).includes(v) : selected === v;
  return (
    <div className="flex flex-col gap-2">
      {options.map(({ value, label, sub }) => (
        <button
          type="button"
          key={value}
          disabled={disabled}
          onClick={() => onSelect(value)}
          aria-pressed={isSelected(value)}
          className={`flex items-center justify-between px-4 py-3.5 rounded-2xl border transition-all touch-target ${
            isSelected(value)
              ? "bg-primary/10 border-primary text-foreground"
              : "bg-card border-border text-foreground hover:border-primary/30"
          } disabled:opacity-50`}
        >
          <div className="text-left">
            <p className="font-medium text-sm">{translate ? translate(label) : label}</p>
            {sub && <p className="text-xs text-muted-foreground">{translate ? translate(sub) : sub}</p>}
          </div>
          {isSelected(value) && (
            <div className="w-4 h-4 rounded-full bg-primary shrink-0 ml-2" />
          )}
        </button>
      ))}
    </div>
  );
}

function ChipGrid({ options, selected, onToggle, translate }: {
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
  translate?: (s: string) => string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          type="button"
          key={opt}
          onClick={() => onToggle(opt)}
          aria-pressed={selected.includes(opt)}
          className={`touch-target px-3.5 py-2.5 rounded-xl border text-sm font-medium transition-all ${
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

// ── Draft type ────────────────────────────────────────────────
type Draft = Omit<RelapseLogType, "id" | "timestamp" | "status" | "acuteRisk"> & {
  acuteRisk: AcuteRisk;
  occurrenceDateTime: string;
};

function toLocalDateTimeInput(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function occurrenceForWhen(when: string): string {
  const date = new Date();
  if (when === "today") {
    if (date.getHours() >= 3) date.setHours(date.getHours() - 3);
    else date.setHours(0, 0, 0, 0);
  }
  if (when === "yesterday") date.setDate(date.getDate() - 1);
  if (when === "few-days") date.setDate(date.getDate() - 3);
  return toLocalDateTimeInput(date);
}

function blankDraft(): Draft {
  return {
    label: "no-label",
    when: "just-now",
    episodeDuration: "unanswered",
    substances: [], primarySubstance: "", amountCategory: "unanswered",
    firstTriggerType: "", firstTriggerText: "",
    preUseFactors: [], missedWarnings: [],
    preUseThoughtPreset: "", preUseThoughtPresets: [], preUseThoughtFreeText: "",
    couldHaveHelpedEarly: [], couldHaveHelpedMiddle: [], couldHaveHelpedLast: [],
    supportContact: "", supportContactOther: "",
    nextStep: "", nextStepOther: "",
    acuteRisk: "unanswered",
    note: "", context: "", emotionAfter: null,
    whatNeeded: "", repairActions: [],
    occurrenceDateTime: occurrenceForWhen("just-now"),
  };
}

function restoreDraft(raw: unknown): Draft {
  const base = blankDraft();
  if (!raw || typeof raw !== "object") return base;
  const stored = raw as Partial<Draft> & { acuteRisk?: unknown };
  return {
    ...base,
    ...stored,
    substances: Array.isArray(stored.substances) ? stored.substances : [],
    preUseFactors: Array.isArray(stored.preUseFactors) ? stored.preUseFactors : [],
    missedWarnings: Array.isArray(stored.missedWarnings) ? stored.missedWarnings : [],
    preUseThoughtPresets: Array.isArray(stored.preUseThoughtPresets) ? stored.preUseThoughtPresets : [],
    couldHaveHelpedEarly: Array.isArray(stored.couldHaveHelpedEarly) ? stored.couldHaveHelpedEarly : [],
    couldHaveHelpedMiddle: Array.isArray(stored.couldHaveHelpedMiddle) ? stored.couldHaveHelpedMiddle : [],
    couldHaveHelpedLast: Array.isArray(stored.couldHaveHelpedLast) ? stored.couldHaveHelpedLast : [],
    repairActions: Array.isArray(stored.repairActions) ? stored.repairActions : [],
    acuteRisk:
      stored.acuteRisk === "none"
      || stored.acuteRisk === "unsafe"
      || stored.acuteRisk === "fear-continued-use"
      || stored.acuteRisk === "withdrawal"
      || stored.acuteRisk === "self-harm-risk"
        ? stored.acuteRisk
        : "unanswered",
    occurrenceDateTime:
      typeof stored.occurrenceDateTime === "string" && stored.occurrenceDateTime
        ? stored.occurrenceDateTime
        : occurrenceForWhen(typeof stored.when === "string" ? stored.when : base.when),
  };
}

const WHEN_OPTIONS = [
  { value: "just-now", label: "Just now", sub: "Within the last hour" },
  { value: "today", label: "Earlier today", sub: "A few hours ago" },
  { value: "yesterday", label: "Yesterday", sub: "Last night or yesterday" },
  { value: "few-days", label: "A few days ago", sub: "Earlier this week" },
];

// ── Main component ────────────────────────────────────────────
export function RelapseLog() {
  const [, navigate] = useLocation();
  const {
    logRelapse,
    updateRelapse,
    relapseLogs,
    crisisService,
  } = useStore();
  const { t, tOpt, language } = useT();
  const reg = useActiveRegistration();
  const matchedRef = useRef(
    reg.session && reg.session.type === "relapse" ? reg.session : null,
  );
  const matched = matchedRef.current;
  const restoredDraft = restoreDraft(matched?.draft);
  const resumableStep = matched && [...STEP_ORDER, "done"].includes(matched.step as Step)
    ? (matched.step as Step)
    : "label";
  // Older active sessions can resume beyond the former late safety question.
  // Bring only unanswered, unfinished sessions to the new first-step screen so
  // Save never becomes a silent no-op and urgent guidance is not skipped.
  const initialStep = resumableStep !== "done" && restoredDraft.acuteRisk === "unanswered"
    ? "label"
    : resumableStep;

  const [step, setStep] = useState<Step>(initialStep);
  const [draft, setDraft] = useState<Draft>(restoredDraft);
  const [savedLog, setSavedLog] = useState<RelapseLogType | null>(() => {
    const id = matched?.savedLogId;
    return id ? relapseLogs.find((log) => log.id === id) ?? null : null;
  });
  const [saving, setSaving] = useState(false);
  const [postSaveWriting, setPostSaveWriting] = useState(false);
  const [leavingHome, setLeavingHome] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saveLock = useRef(false);
  const postSaveLock = useRef(false);
  const isWriting = saving || postSaveWriting || leavingHome;
  const safetyCopy = getUrgentSafetyCopy(language);
  const substanceWarnings = getSubstanceSafetyWarnings(draft.substances, language);

  const STEP_LABELS: Record<Step, string> = {
    label: t("relapse.step.label"),
    when: t("relapse.step.when"),
    trigger: t("relapse.step.trigger"),
    before: t("relapse.step.before"),
    next: t("relapse.step.next"),
    done: t("relapse.done.title"),
  };

  useEffect(() => {
    if (!matchedRef.current) {
      reg.startSession({
        type: "relapse",
        route: "/relapse",
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
    const id = matched?.savedLogId;
    if (!savedLog && id) {
      const restored = relapseLogs.find((log) => log.id === id);
      if (restored) setSavedLog(restored);
    }
  }, [matched?.savedLogId, relapseLogs, savedLog]);

  const toggleHelp = (v: string) => {
    setDraft((prev) => {
      const arr = (prev.couldHaveHelpedEarly as string[]) ?? [];
      const next = arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
      return { ...prev, couldHaveHelpedEarly: next, couldHaveHelpedMiddle: next, couldHaveHelpedLast: next };
    });
  };

  const update = useCallback(<K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleArr = useCallback(<T extends string>(key: keyof Draft, val: T) => {
    setDraft((prev) => {
      const arr = (prev[key] as T[]) ?? [];
      return {
        ...prev,
        [key]: arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val],
      };
    });
  }, []);

  const toggleSubstance = useCallback((value: string) => {
    setDraft((previous) => {
      const substances = previous.substances.includes(value)
        ? previous.substances.filter((item) => item !== value)
        : [...previous.substances, value];
      return {
        ...previous,
        substances,
        amountCategory: substances.length > 0 ? previous.amountCategory : "unanswered",
      };
    });
  }, []);

  const stepIdx = STEP_ORDER.indexOf(step);
  const progressPct = ((stepIdx + 1) / STEP_ORDER.length) * 100;
  const canGoBack = stepIdx > 0;

  const goBack = () => {
    if (!isWriting && canGoBack) setStep(STEP_ORDER[stepIdx - 1]);
  };
  const goNext = () => {
    if (isWriting) return;
    if (step === "next") {
      save();
    } else {
      setStep(STEP_ORDER[stepIdx + 1]);
    }
  };
  const skip = () => {
    if (!isWriting) setStep(STEP_ORDER[stepIdx + 1]);
  };

  const save = async () => {
    if (saveLock.current || draft.acuteRisk === "unanswered") return;
    saveLock.current = true;
    setSaving(true);
    setError(null);
    try {
      const timestamp = new Date(draft.occurrenceDateTime).getTime();
      if (!Number.isFinite(timestamp) || timestamp > Date.now() + 60_000) {
        throw new Error("invalid-occurrence-time");
      }
      const completedAt = Date.now();
      const startedAt = reg.session?.startedAt ?? completedAt;
      const { occurrenceDateTime: _occurrenceDateTime, acuteRisk, ...persistedDraft } = draft;
      const saved = await logRelapse({
        ...persistedDraft,
        acuteRisk,
        preUseThoughtPreset: (draft.preUseThoughtPresets ?? [])[0] ?? "",
        timestamp,
        occurredAt: timestamp,
        startedAt,
        completedAt,
        dataVersion: 2,
        contentVersion: "registration-v2",
        answers: {
          acuteRisk,
          label: toStableOptionId(draft.label),
          when: toStableOptionId(draft.when),
          episodeDuration: toStableOptionId(draft.episodeDuration),
          substances: toStableOptionIds(draft.substances),
          primarySubstance: toStableOptionId(draft.primarySubstance),
          amountCategory: toStableOptionId(draft.amountCategory),
          firstTriggerType: toStableOptionId(draft.firstTriggerType),
          preUseFactors: toStableOptionIds(draft.preUseFactors),
          missedWarnings: toStableOptionIds(draft.missedWarnings),
          preUseThoughts: toStableOptionIds(draft.preUseThoughtPresets ?? []),
          couldHaveHelpedEarly: toStableOptionIds(draft.couldHaveHelpedEarly),
          couldHaveHelpedMiddle: toStableOptionIds(draft.couldHaveHelpedMiddle),
          couldHaveHelpedLast: toStableOptionIds(draft.couldHaveHelpedLast),
          supportContact: toStableOptionId(draft.supportContact),
          nextStep: toStableOptionId(draft.nextStep),
          emotionAfter: draft.emotionAfter,
          whatNeeded: toStableOptionId(draft.whatNeeded ?? ""),
          repairActions: toStableOptionIds(draft.repairActions ?? []),
        },
        status: "completed",
      });
      setSavedLog(saved);
      reg.patchSession({ savedLogId: saved.id, step: "done", draft });
      setStep("done");
    } catch {
      setError(
        language === "nl"
          ? "Opslaan is niet gelukt. Controleer het gekozen tijdstip en probeer opnieuw."
          : "Saving failed. Check the selected time and try again.",
      );
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };

  const updateSavedLog = async (changes: Partial<RelapseLogType>) => {
    if (!savedLog || postSaveLock.current) return;
    postSaveLock.current = true;
    setPostSaveWriting(true);
    setError(null);
    try {
      const updated: RelapseLogType = { ...savedLog, ...changes };
      await updateRelapse(updated);
      setSavedLog(updated);
      setDraft((prev) => ({
        ...prev,
        whatNeeded: updated.whatNeeded ?? "",
        repairActions: updated.repairActions ?? [],
      }));
    } catch {
      setError(
        language === "nl"
          ? "Deze aanvulling kon niet worden opgeslagen. Probeer het opnieuw."
          : "This follow-up could not be saved. Please try again.",
      );
    } finally {
      postSaveLock.current = false;
      setPostSaveWriting(false);
    }
  };

  const goHome = async () => {
    if (isWriting) return;
    setLeavingHome(true);
    setError(null);
    try {
      if (!(await reg.completeSession())) {
        throw new Error("Relapse registration could not be completed.");
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
  };

  const openSupportRoute = (path: string) => {
    if (isWriting) return;
    reg.patchSession({ pendingReturn: { returnRoute: "/relapse", returnStep: step } });
    navigate(path);
  };

  const isSafety = draft.acuteRisk !== "unanswered" && draft.acuteRisk !== "none";
  const isOptional = step === "before";

  const urgentSupportPanel = isSafety ? (
    <div className="bg-card border border-amber-500/50 rounded-2xl p-4 text-left max-w-xs w-full">
      <div className="flex items-center gap-2 mb-2">
        <Phone size={16} className="text-amber-500" />
        <p className="text-sm font-semibold text-foreground">{safetyCopy.title}</p>
      </div>
      <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
        <p>{safetyCopy.assessmentLimit}</p>
        <p>{safetyCopy.emergency}</p>
        {draft.acuteRisk === "self-harm-risk" && <p>{safetyCopy.selfHarm}</p>}
        <p>{safetyCopy.humanHelp}</p>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        <a href="tel:112" className="text-sm text-primary font-semibold touch-target inline-flex items-center">
          {safetyCopy.call112}
        </a>
        {draft.acuteRisk === "self-harm-risk" && (
          <>
            <a href="tel:113" className="text-sm text-primary font-semibold touch-target inline-flex items-center">
              {safetyCopy.call113}
            </a>
            <a href="tel:08000113" className="text-sm text-primary font-semibold touch-target inline-flex items-center">
              {safetyCopy.call0800}
            </a>
            <a href="https://www.113.nl" target="_blank" rel="noreferrer" className="text-sm text-primary font-semibold touch-target inline-flex items-center">
              {safetyCopy.visit113}
            </a>
          </>
        )}
        {crisisService?.number && (
          <a href={phoneHref(crisisService.number)} className="text-sm text-primary font-semibold touch-target inline-flex items-center">
            {safetyCopy.configuredService}: {crisisService.name} ({crisisService.number})
          </a>
        )}
      </div>
    </div>
  ) : null;

  // Gate "Next": every required question on the current step must be answered.
  const canProceed = (() => {
    switch (step) {
      case "label":   return draft.acuteRisk !== "unanswered";
      case "when": {
        const occurrence = new Date(draft.occurrenceDateTime).getTime();
        return Number.isFinite(occurrence)
          && occurrence <= Date.now() + 60_000;
      }
      case "trigger": return draft.firstTriggerType !== "";
      case "next":    return (draft.supportContact !== "" || draft.supportContactOther.trim() !== "")
        && (draft.nextStep !== "" || draft.nextStepOther.trim() !== "");
      default:        return true;
    }
  })();

  // ── Done / affirmation screen ─────────────────────────────
  if (step === "done") {
    const displayedNextStep = draft.nextStep
      ? tOpt(draft.nextStep)
      : draft.nextStepOther.trim();

    return (
      <div className="flex flex-col min-h-dvh bg-background">
        <PageHeader title={t("relapse.title")} back={!isWriting} />
        <div
          className="flex-1 overflow-y-auto scroll-smooth-ios flex flex-col items-center px-6 gap-6 pt-8 text-center animate-fade-up"
          style={{ paddingBottom: "calc(5rem + env(safe-area-inset-bottom))" }}
        >
          <Heart size={48} strokeWidth={1.5} className="text-primary fill-primary/20" />

          <div className="space-y-3 max-w-xs">
            <h2 className="text-2xl font-semibold">{t("relapse.done.title")}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {t("relapse.done.body")}
            </p>
          </div>

          {urgentSupportPanel}

          <div className="bg-card border border-border rounded-2xl p-5 text-left max-w-xs w-full space-y-2.5">
            {[
              t("relapse.done.line1"),
              t("relapse.done.line2"),
              t("relapse.done.line3"),
            ].map((line, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-primary mt-0.5 shrink-0 text-sm">·</span>
                <p className="text-sm text-muted-foreground leading-relaxed">{line}</p>
              </div>
            ))}
          </div>

          {displayedNextStep && (
            <div className="bg-primary/8 border border-primary/20 rounded-2xl px-4 py-3 max-w-xs w-full text-left">
              <p className="text-xs text-muted-foreground mb-1">{t("relapse.step.next")}</p>
              <p className="text-sm font-medium text-foreground">{displayedNextStep}</p>
            </div>
          )}

          <div className="w-full max-w-xs text-left">
            <p className="text-sm font-medium text-foreground mb-1">
              {language === "nl" ? "Wat had je op dat moment nodig?" : "What did you need in that moment?"}
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              {language === "nl" ? "Optioneel; je keuze wordt bij deze registratie opgeslagen." : "Optional; your choice is saved with this log."}
            </p>
            <SelectList
              options={WHAT_NEEDED_OPTIONS}
              selected={draft.whatNeeded ?? ""}
              onSelect={(value) => updateSavedLog({ whatNeeded: draft.whatNeeded === value ? "" : value })}
              translate={tOpt}
              disabled={isWriting || !savedLog}
            />
          </div>

          {/* Repair actions */}
          <div className="w-full max-w-xs text-left">
            <p className="text-sm font-medium text-foreground mb-3">{t("relapse.done.stabilize")}</p>
            <div className="flex flex-col gap-2">
              {REPAIR_ACTIONS.map((action) => {
                const chosen = (draft.repairActions ?? []).includes(action);
                return (
                  <button
                    key={action}
                    type="button"
                    disabled={isWriting || !savedLog}
                    onClick={() => updateSavedLog({
                      repairActions: chosen
                        ? (draft.repairActions ?? []).filter((item) => item !== action)
                        : [...(draft.repairActions ?? []), action],
                    })}
                    className={`w-full text-left px-4 py-3 rounded-2xl border text-sm font-medium transition-all touch-target ${
                      chosen
                        ? "bg-primary/10 border-primary text-foreground"
                        : "bg-card border-border text-muted-foreground hover:border-primary/30"
                    } disabled:opacity-50`}
                  >
                    {tOpt(action)}
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <p role="alert" className="w-full max-w-xs rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-left text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button
              type="button"
              disabled={isWriting}
              onClick={() => openSupportRoute("/tools")}
              className="w-full bg-primary text-primary-foreground rounded-2xl py-4 font-semibold touch-target hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
            >
              {t("common.browse_tools")}
            </button>
            <button
              type="button"
              disabled={isWriting}
              onClick={goHome}
              className="w-full border border-border rounded-2xl py-3 font-medium text-muted-foreground touch-target disabled:opacity-50"
            >
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
      <PageHeader title={t("relapse.title")} back={!isWriting} subtitle={STEP_LABELS[step]} />

      {/* Progress */}
      <div className="h-0.5 bg-muted shrink-0">
        <div className="h-full bg-primary transition-all duration-400" style={{ width: `${progressPct}%` }} />
      </div>

      {/* Step counter + framing */}
      <div className="flex items-center justify-between px-4 pt-3 shrink-0">
        <p className="text-xs text-muted-foreground">{t("common.step_of").replace("{n}", String(stepIdx + 1)).replace("{total}", String(STEP_ORDER.length))}</p>
        {isOptional && (
          <button disabled={isWriting} onClick={skip} className="text-xs text-primary hover:opacity-75 transition-opacity disabled:opacity-50">
            {t("common.skip")}
          </button>
        )}
      </div>

      {step === "label" && (
        <div className="mx-4 mt-3 bg-primary/8 border border-primary/20 rounded-2xl px-4 py-3 shrink-0">
          <p className="text-sm text-foreground/80 leading-relaxed">
            {t("relapse.private_note")}
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto scroll-smooth-ios px-4 pb-4 pt-4 flex flex-col gap-4">

        {step !== "label" && urgentSupportPanel}

        {/* ── Label ─────────────────────────────────────────── */}
        {step === "label" && (
          <>
            <p className="text-base font-medium text-foreground">{t("relapse.q.risk")}</p>
            <p className="text-sm text-muted-foreground -mt-2">{t("relapse.q.risk_sub")}</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: "none" as const, label: language === "nl" ? "Geen directe zorg" : "No immediate concern" },
                { value: "unsafe" as const, label: language === "nl" ? "Ik voel me niet veilig" : "I do not feel safe" },
                { value: "fear-continued-use" as const, label: language === "nl" ? "Bang dat ik doorga met gebruiken" : "Afraid I will continue using" },
                { value: "withdrawal" as const, label: language === "nl" ? "Zorgen over ontwenning" : "Withdrawal concern" },
                { value: "self-harm-risk" as const, label: language === "nl" ? "Risico dat ik mezelf of iemand anders iets aandoe" : "Risk I may hurt myself or someone else" },
              ].map(({ value, label }) => (
                <button
                  type="button"
                  key={value}
                  onClick={() => update("acuteRisk", draft.acuteRisk === value ? "unanswered" : value)}
                  aria-pressed={draft.acuteRisk === value}
                  className={`py-3.5 px-3 rounded-2xl border text-sm font-medium text-left leading-tight transition-all touch-target ${
                    draft.acuteRisk === value
                      ? "bg-primary/10 border-primary text-foreground"
                      : "bg-card border-border text-muted-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {urgentSupportPanel}
            <div className="h-px bg-border" />
            <p className="text-base font-medium text-foreground">{t("relapse.q.label")}</p>
            <SelectList
              options={LABEL_OPTIONS}
              selected={draft.label}
              onSelect={(v) => update("label", v)}
              translate={tOpt}
            />
          </>
        )}

        {/* ── When ──────────────────────────────────────────── */}
        {step === "when" && (
          <>
            <p className="text-base font-medium text-foreground">{t("relapse.q.when")}</p>
            <SelectList
              options={WHEN_OPTIONS}
              selected={draft.when}
              onSelect={(v) => setDraft((prev) => ({
                ...prev,
                when: v,
                occurrenceDateTime: occurrenceForWhen(v),
              }))}
              translate={tOpt}
            />
            <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
              {language === "nl" ? "Exact tijdstip van de gebeurtenis" : "Exact time the event occurred"}
              <input
                type="datetime-local"
                required
                value={draft.occurrenceDateTime}
                max={toLocalDateTimeInput(new Date())}
                onChange={(event) => update("occurrenceDateTime", event.target.value)}
                className="w-full rounded-2xl border border-input bg-card px-4 py-3.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <span className="text-xs font-normal text-muted-foreground">
                {language === "nl"
                  ? "Dit tijdstip wordt in je logboek gebruikt, niet het moment waarop je op Opslaan drukt."
                  : "Your log uses this time, not the moment you press Save."}
              </span>
            </label>
            <div className="h-px bg-border mt-1" />
            <p className="text-base font-medium text-foreground">
              {t("relapse.q.duration")}{" "}
              <span className="text-muted-foreground font-normal text-sm">({t("common.optional")})</span>
            </p>
            <SelectList
              options={DURATION_OPTIONS}
              selected={draft.episodeDuration}
              onSelect={(v) => update("episodeDuration", draft.episodeDuration === v ? "unanswered" : v)}
              translate={tOpt}
            />
            <div className="h-px bg-border" />
            <p className="text-base font-medium text-foreground">
              {t("relapse.q.substance")} {" "}
              <span className="text-muted-foreground font-normal text-sm">({t("common.optional")})</span>
            </p>
            <p className="text-sm text-muted-foreground -mt-2">{t("relapse.q.substance_sub")}</p>
            <ChipGrid
              options={SUBSTANCES}
              selected={draft.substances}
              onToggle={toggleSubstance}
              translate={tOpt}
            />
            {substanceWarnings.map((warning) => (
              <div key={warning.key} className="rounded-2xl border border-amber-500/50 bg-amber-500/10 p-4 text-left">
                <div className="mb-1 flex items-start gap-2">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-500" />
                  <p className="text-sm font-semibold text-foreground">{warning.title}</p>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">{warning.body}</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                  <a href="tel:112" className="text-sm font-semibold text-primary">{safetyCopy.call112}</a>
                  {crisisService?.number && (
                    <a href={phoneHref(crisisService.number)} className="text-sm font-semibold text-primary">
                      {crisisService.name}
                    </a>
                  )}
                </div>
              </div>
            ))}
            {draft.substances.length > 0 && (
              <>
                <div className="h-px bg-border" />
                <p className="text-base font-medium text-foreground">
                  {t("relapse.q.amount")} {" "}
                  <span className="text-muted-foreground font-normal text-sm">({t("common.optional")})</span>
                </p>
                <SelectList
                  options={AMOUNT_OPTIONS}
                  selected={draft.amountCategory}
                  onSelect={(v) => update("amountCategory", draft.amountCategory === v ? "unanswered" : v)}
                  translate={tOpt}
                />
              </>
            )}
          </>
        )}

        {/* ── First trigger ──────────────────────────────────── */}
        {step === "trigger" && (
          <>
            <p className="text-base font-medium text-foreground">{t("relapse.q.trigger")}</p>
            <p className="text-sm text-muted-foreground -mt-2">{t("relapse.q.trigger_sub")}</p>
            <ChipGrid
              options={FIRST_TRIGGER_TYPES}
              selected={draft.firstTriggerType ? [draft.firstTriggerType] : []}
              onToggle={(v) => update("firstTriggerType", draft.firstTriggerType === v ? "" : v)}
              translate={tOpt}
            />
            <textarea
              aria-label={t("relapse.q.trigger")}
              value={draft.firstTriggerText}
              onChange={(e) => update("firstTriggerText", e.target.value)}
              placeholder={t("relapse.q.trigger_placeholder")}
              rows={4}
              className="w-full bg-card border border-input rounded-2xl px-4 py-3.5 text-foreground placeholder:text-muted-foreground/50 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </>
        )}

        {/* ── Before ────────────────────────────────────────── */}
        {step === "before" && (
          <>
            <p className="text-base font-medium text-foreground">{t("relapse.q.before")}</p>
            <p className="text-sm text-muted-foreground -mt-2">{t("relapse.q.before_sub")}</p>
            <ChipGrid
              options={PRE_USE_FACTORS}
              selected={draft.preUseFactors}
              onToggle={(v) => toggleArr("preUseFactors", v)}
              translate={tOpt}
            />
            <textarea
              aria-label={t("relapse.q.before")}
              value={draft.context}
              onChange={(e) => update("context", e.target.value)}
              placeholder={t("relapse.q.before_other_placeholder")}
              rows={3}
              className="w-full bg-card border border-input rounded-2xl px-4 py-3.5 text-foreground placeholder:text-muted-foreground/50 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="h-px bg-border" />
            <p className="text-base font-medium text-foreground">{t("relapse.q.warnings")}</p>
            <p className="text-sm text-muted-foreground -mt-2">{t("relapse.q.warnings_sub")}</p>
            <ChipGrid
              options={MISSED_WARNINGS}
              selected={draft.missedWarnings}
              onToggle={(v) => toggleArr("missedWarnings", v)}
              translate={tOpt}
            />
            <div className="h-px bg-border" />
            <p className="text-base font-medium text-foreground">{t("relapse.q.thought")}</p>
            <p className="text-sm text-muted-foreground -mt-2">{t("relapse.q.thought_sub")}</p>
            <ChipGrid
              options={THOUGHT_PRESETS}
              selected={draft.preUseThoughtPresets ?? []}
              onToggle={(v) => toggleArr("preUseThoughtPresets", v)}
              translate={tOpt}
            />
            <textarea
              aria-label={t("relapse.q.thought")}
              value={draft.preUseThoughtFreeText}
              onChange={(e) => update("preUseThoughtFreeText", e.target.value)}
              placeholder={t("relapse.q.thought_placeholder")}
              rows={3}
              className="w-full bg-card border border-input rounded-2xl px-4 py-3.5 text-foreground placeholder:text-muted-foreground/50 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="h-px bg-border" />
            <p className="text-base font-medium text-foreground">{t("relapse.q.help")}</p>
            <p className="text-sm text-muted-foreground -mt-2">{t("relapse.q.help_sub")}</p>
            <ChipGrid
              options={COULD_HELP_OPTIONS}
              selected={(draft.couldHaveHelpedEarly as string[]) ?? []}
              onToggle={toggleHelp}
              translate={tOpt}
            />
          </>
        )}

        {/* ── Next step + safety ────────────────────────────── */}
        {step === "next" && (
          <>
            <p className="text-base font-medium text-foreground">{t("relapse.q.next_support")}</p>
            <ChipGrid
              options={SUPPORT_CONTACTS}
              selected={draft.supportContact ? [draft.supportContact] : []}
              onToggle={(v) => update("supportContact", draft.supportContact === v ? "" : v)}
              translate={tOpt}
            />
            <input
              type="text"
              aria-label={t("relapse.q.next_support")}
              value={draft.supportContactOther}
              onChange={(e) => update("supportContactOther", e.target.value)}
              placeholder={t("relapse.q.next_support_placeholder")}
              className="w-full bg-card border border-input rounded-2xl px-4 py-3.5 text-foreground placeholder:text-muted-foreground/50 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="h-px bg-border" />
            <p className="text-base font-medium text-foreground">{t("relapse.q.next_step")}</p>
            <ChipGrid
              options={NEXT_STEPS}
              selected={draft.nextStep ? [draft.nextStep] : []}
              onToggle={(v) => update("nextStep", draft.nextStep === v ? "" : v)}
              translate={tOpt}
            />
            <input
              type="text"
              aria-label={t("relapse.q.next_step")}
              value={draft.nextStepOther}
              onChange={(e) => update("nextStepOther", e.target.value)}
              placeholder={t("relapse.q.next_step_other_placeholder")}
              className="w-full bg-card border border-input rounded-2xl px-4 py-3.5 text-foreground placeholder:text-muted-foreground/50 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="h-px bg-border" />
            <p className="text-base font-medium text-foreground">
              {t("relapse.q.note")}{" "}
              <span className="text-muted-foreground font-normal text-xs">({t("common.optional")})</span>
            </p>
            <p className="text-sm text-muted-foreground -mt-2">{t("relapse.q.note_sub")}</p>
            <textarea
              aria-label={t("relapse.q.note")}
              value={draft.note}
              onChange={(e) => update("note", e.target.value)}
              placeholder={t("relapse.q.note_placeholder")}
              rows={5}
              className="w-full bg-card border border-input rounded-2xl px-4 py-3.5 text-foreground placeholder:text-muted-foreground/50 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring leading-relaxed"
            />
          </>
        )}

        {/* The primary action appears only after the step content. */}
        <div className="mt-auto border-t border-border/70 pb-1 pt-4">
          {error && (
            <p role="alert" className="mb-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex gap-3 max-w-lg mx-auto">
          {canGoBack && (
            <button type="button" disabled={isWriting} onClick={goBack}
              className="touch-target px-5 py-3.5 border border-border rounded-2xl font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50">
              {t("common.back")}
            </button>
          )}
          <button
            type="button"
            disabled={isWriting || !canProceed}
            onClick={goNext}
            className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-2xl py-3.5 font-semibold touch-target hover:opacity-90 active:scale-95 transition-all disabled:opacity-60"
          >
            {step === "next"
              ? (saving ? t("common.saving") : t("common.save"))
              : <><span>{t("common.next")}</span><ArrowRight size={16} /></>}
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}
