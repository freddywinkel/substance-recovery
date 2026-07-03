import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useStore } from "@/hooks/useStore";
import { useT } from "@/hooks/useTranslation";
import { RelapseLog as RelapseLogType, RelapseLabel, EpisodeDuration, AmountCategory, AcuteRisk } from "@/db";
import { PageHeader } from "@/components/PageHeader";
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
  options, selected, onSelect, multi = false, translate,
}: {
  options: { value: T; label: string; sub?: string }[];
  selected: T | T[];
  onSelect: (v: T) => void;
  multi?: boolean;
  translate?: (s: string) => string;
}) {
  const isSelected = (v: T) =>
    multi ? (selected as T[]).includes(v) : selected === v;
  return (
    <div className="flex flex-col gap-2">
      {options.map(({ value, label, sub }) => (
        <button
          key={value}
          onClick={() => onSelect(value)}
          className={`flex items-center justify-between px-4 py-3.5 rounded-2xl border transition-all touch-target ${
            isSelected(value)
              ? "bg-primary/10 border-primary text-foreground"
              : "bg-card border-border text-foreground hover:border-primary/30"
          }`}
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
          key={opt}
          onClick={() => onToggle(opt)}
          className={`px-3.5 py-2.5 rounded-xl border text-sm font-medium transition-all ${
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
type Draft = Omit<RelapseLogType, "id" | "timestamp" | "status">;

function blankDraft(): Draft {
  return {
    label: "no-label",
    when: "just-now",
    episodeDuration: "single-moment",
    substances: [], primarySubstance: "", amountCategory: "prefer-not",
    firstTriggerType: "", firstTriggerText: "",
    preUseFactors: [], missedWarnings: [],
    preUseThoughtPreset: "", preUseThoughtPresets: [], preUseThoughtFreeText: "",
    couldHaveHelpedEarly: [], couldHaveHelpedMiddle: [], couldHaveHelpedLast: [],
    supportContact: "", supportContactOther: "",
    nextStep: "", nextStepOther: "",
    acuteRisk: "none",
    note: "", context: "", emotionAfter: 3,
    whatNeeded: "", repairActions: [],
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
  const [step, setStep] = useState<Step>("label");
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [saving, setSaving] = useState(false);
  const { logRelapse } = useStore();
  const [, navigate] = useLocation();
  const { t, tOpt } = useT();

  const STEP_LABELS: Record<Step, string> = {
    label: t("relapse.step.label"),
    when: t("relapse.step.when"),
    trigger: t("relapse.step.trigger"),
    before: t("relapse.step.before"),
    next: t("relapse.step.next"),
    done: t("relapse.done.title"),
  };

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

  const stepIdx = STEP_ORDER.indexOf(step);
  const progressPct = ((stepIdx + 1) / STEP_ORDER.length) * 100;
  const canGoBack = stepIdx > 0;

  const goBack = () => setStep(STEP_ORDER[stepIdx - 1]);
  const goNext = () => {
    if (step === "next") {
      save();
    } else {
      setStep(STEP_ORDER[stepIdx + 1]);
    }
  };
  const skip = () => setStep(STEP_ORDER[stepIdx + 1]);

  const save = async () => {
    setSaving(true);
    await logRelapse({
      ...draft,
      preUseThoughtPreset: (draft.preUseThoughtPresets ?? [])[0] ?? "",
      timestamp: Date.now(),
      status: "completed",
    });
    setSaving(false);
    setStep("done");
  };

  const isSafety = draft.acuteRisk !== "none";
  const isOptional = step === "before";

  // Gate "Next": every required question on the current step must be answered.
  const canProceed = (() => {
    switch (step) {
      case "label":   return draft.label !== "";
      case "when":    return draft.substances.length > 0 && draft.episodeDuration !== "" && draft.amountCategory !== "";
      case "trigger": return draft.firstTriggerType !== "";
      case "next":    return (draft.supportContact !== "" || draft.supportContactOther.trim() !== "")
        && (draft.nextStep !== "" || draft.nextStepOther.trim() !== "");
      default:        return true;
    }
  })();

  // ── Done / affirmation screen ─────────────────────────────
  if (step === "done") {
    return (
      <div className="flex flex-col min-h-dvh bg-background">
        <PageHeader title={t("relapse.title")} back />
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

          {isSafety && (
            <div className="bg-card border border-border rounded-2xl p-4 text-left max-w-xs w-full">
              <div className="flex items-center gap-2 mb-2">
                <Phone size={14} className="text-primary" />
                <p className="text-sm font-medium text-foreground">{t("relapse.done.reach_out")}</p>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed mb-2">
                {t("relapse.done.safety")}
              </p>
              <a href="tel:0883581500" className="text-sm text-primary font-medium">
                {t("help.crisis_full")}
              </a>
              <p className="text-xs text-muted-foreground mt-1">{t("help.counselor")}</p>
            </div>
          )}

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

          {draft.nextStep && (
            <div className="bg-primary/8 border border-primary/20 rounded-2xl px-4 py-3 max-w-xs w-full text-left">
              <p className="text-xs text-muted-foreground mb-1">{t("relapse.step.next")}</p>
              <p className="text-sm font-medium text-foreground">
                {tOpt(NEXT_STEPS.includes(draft.nextStep) ? draft.nextStep : draft.nextStepOther || draft.nextStep)}
              </p>
            </div>
          )}

          {/* Repair actions */}
          <div className="w-full max-w-xs text-left">
            <p className="text-sm font-medium text-foreground mb-3">{t("relapse.done.stabilize")}</p>
            <div className="flex flex-col gap-2">
              {REPAIR_ACTIONS.map((action) => {
                const chosen = (draft.repairActions ?? []).includes(action);
                return (
                  <button
                    key={action}
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        repairActions: chosen
                          ? (prev.repairActions ?? []).filter((a) => a !== action)
                          : [...(prev.repairActions ?? []), action],
                      }))
                    }
                    className={`w-full text-left px-4 py-3 rounded-2xl border text-sm font-medium transition-all touch-target ${
                      chosen
                        ? "bg-primary/10 border-primary text-foreground"
                        : "bg-card border-border text-muted-foreground hover:border-primary/30"
                    }`}
                  >
                    {tOpt(action)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button
              onClick={() => navigate("/tools")}
              className="w-full bg-primary text-primary-foreground rounded-2xl py-4 font-semibold touch-target hover:opacity-90 active:scale-95 transition-all"
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
    <div className="flex flex-col min-h-dvh bg-background">
      <PageHeader title={t("relapse.title")} back subtitle={STEP_LABELS[step]} />

      {/* Progress */}
      <div className="h-0.5 bg-muted shrink-0">
        <div className="h-full bg-primary transition-all duration-400" style={{ width: `${progressPct}%` }} />
      </div>

      {/* Step counter + framing */}
      <div className="flex items-center justify-between px-4 pt-3 shrink-0">
        <p className="text-xs text-muted-foreground">{t("common.step_of").replace("{n}", String(stepIdx + 1)).replace("{total}", String(STEP_ORDER.length))}</p>
        {isOptional && (
          <button onClick={skip} className="text-xs text-primary hover:opacity-75 transition-opacity">
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

      <div className="flex-1 overflow-y-auto scroll-smooth-ios px-4 pt-4 flex flex-col gap-4"
        style={{ paddingBottom: "calc(9rem + env(safe-area-inset-bottom))" }}>

        {/* ── Label ─────────────────────────────────────────── */}
        {step === "label" && (
          <>
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
            <p className="text-base font-medium text-foreground">
              {t("relapse.q.when")}{" "}
              <span className="text-muted-foreground font-normal text-sm">({t("common.optional")})</span>
            </p>
            <SelectList
              options={WHEN_OPTIONS}
              selected={draft.when}
              onSelect={(v) => update("when", v)}
              translate={tOpt}
            />
            <div className="h-px bg-border mt-1" />
            <p className="text-base font-medium text-foreground">
              {t("relapse.q.duration")}{" "}
              <span className="text-muted-foreground font-normal text-sm">({t("common.optional")})</span>
            </p>
            <SelectList
              options={DURATION_OPTIONS}
              selected={draft.episodeDuration}
              onSelect={(v) => update("episodeDuration", v)}
              translate={tOpt}
            />
            <div className="h-px bg-border" />
            <p className="text-base font-medium text-foreground">{t("relapse.q.substance")}</p>
            <p className="text-sm text-muted-foreground -mt-2">{t("relapse.q.substance_sub")}</p>
            <ChipGrid
              options={SUBSTANCES}
              selected={draft.substances}
              onToggle={(v) => toggleArr("substances", v)}
              translate={tOpt}
            />
            {draft.substances.length > 0 && (
              <>
                <div className="h-px bg-border" />
                <p className="text-base font-medium text-foreground">{t("relapse.q.amount")}</p>
                <SelectList
                  options={AMOUNT_OPTIONS}
                  selected={draft.amountCategory}
                  onSelect={(v) => update("amountCategory", v)}
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
              value={draft.nextStepOther}
              onChange={(e) => update("nextStepOther", e.target.value)}
              placeholder={t("relapse.q.next_step_other_placeholder")}
              className="w-full bg-card border border-input rounded-2xl px-4 py-3.5 text-foreground placeholder:text-muted-foreground/50 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="h-px bg-border" />
            <p className="text-base font-medium text-foreground">{t("relapse.q.risk")} <span className="text-muted-foreground font-normal text-xs">({t("common.optional")})</span></p>
            <p className="text-sm text-muted-foreground -mt-2">{t("relapse.q.risk_sub")}</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: "none" as AcuteRisk, label: "No concern" },
                { value: "unsafe" as AcuteRisk, label: "Some safety concern" },
                { value: "fear-continued-use" as AcuteRisk, label: "Fear of continued use" },
                { value: "withdrawal" as AcuteRisk, label: "Withdrawal concern" },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => update("acuteRisk", draft.acuteRisk === value ? "none" : value)}
                  className={`py-3.5 px-3 rounded-2xl border text-sm font-medium text-left leading-tight transition-all touch-target ${
                    draft.acuteRisk === value
                      ? "bg-primary/10 border-primary text-foreground"
                      : "bg-card border-border text-muted-foreground"
                  }`}
                >
                  {tOpt(label)}
                </button>
              ))}
            </div>
            {isSafety && (
              <div className="bg-card border border-border rounded-2xl p-4 flex items-start gap-3">
                <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground mb-1">{t("relapse.support_resources")}</p>
                  <a href="tel:0883581500" className="text-sm text-primary font-medium">
                    Crisisdienst Antes — 088 358 1500
                  </a>
                </div>
              </div>
            )}
            <div className="h-px bg-border" />
            <p className="text-base font-medium text-foreground">
              {t("relapse.q.note")}{" "}
              <span className="text-muted-foreground font-normal text-xs">({t("common.optional")})</span>
            </p>
            <p className="text-sm text-muted-foreground -mt-2">{t("relapse.q.note_sub")}</p>
            <textarea
              value={draft.note}
              onChange={(e) => update("note", e.target.value)}
              placeholder={t("relapse.q.note_placeholder")}
              rows={5}
              className="w-full bg-card border border-input rounded-2xl px-4 py-3.5 text-foreground placeholder:text-muted-foreground/50 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring leading-relaxed"
            />
          </>
        )}
      </div>

      {/* Bottom action bar */}
      <div
        className="fixed left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border px-4 pt-3 pb-3 z-40"
        style={{ bottom: "calc(3.5rem + env(safe-area-inset-bottom))" }}
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
            className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-2xl py-3.5 font-semibold touch-target hover:opacity-90 active:scale-95 transition-all disabled:opacity-60"
          >
            {step === "next"
              ? (saving ? t("common.saving") : t("common.save"))
              : <><span>{t("common.next")}</span><ArrowRight size={16} /></>}
          </button>
        </div>
      </div>
    </div>
  );
}
