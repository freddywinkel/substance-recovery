import { useState } from "react";
import { useStore } from "@/hooks/useStore";
import { useT } from "@/hooks/useT";
import { PageHeader } from "@/components/PageHeader";
import {
  CravingLog, RelapseLog, AnxietyLog, BoredomLog,
  updateCravingLog, updateRelapseLog, updateAnxietyLog, updateBoredomLog,
} from "@/db";
import { Zap, Flame, AlertTriangle, Brain, Coffee, Trash2, ChevronRight, Check, X, Gauge, Info } from "lucide-react";

// ── Types ────────────────────────────────────────────────────
type Category = "trek" | "craving" | "boredom" | "anxiety" | "relapse";
type AnyLog = CravingLog | RelapseLog | AnxietyLog | BoredomLog;

// ── Option lists (mirrored from tracker pages) ───────────────
const C_SITUATIONS = ["Home alone","On my way somewhere","After work","Conflict or argument","Feeling bored","Under stress","Bad news","Party or social event","Someone using nearby","Saw or smelled a trigger"];
const C_EMOTIONS = ["Anxious","Tense","Low / sad","Empty","Angry","Frustrated","Guilty","Ashamed","Lonely","Bored","Restless","Overwhelmed","Rejected","Hopeless","Excited / hyped","Numb"];
const C_PHYSICAL = ["Restlessness","Chest tightness","Head pressure","Nausea","Sweating","Trembling","Rapid heartbeat","Fatigue","Empty feeling","Nervous energy","Feeling rushed","Urge in the body"];
const C_THOUGHTS = ["I can't handle this","Just one won't matter","No one will notice","I've earned this","It doesn't matter anymore","I just want peace","I want to feel / stop feeling","I'll start fresh tomorrow"];
const C_LOCATIONS = ["Home","Work","Outside","Shop or bar","In transit","At someone else's place","Prefer not to say"];
const C_SOCIAL = ["Alone","With partner","With family","With friends","With colleagues","With strangers","With someone who uses","With someone who feels unsafe","With someone safe"];
// Behavioral outcome (used / didn't use / unsure) — maps the stored useOutcome value to its i18n key.
const USE_OUTCOME_KEYS: Record<string, string> = {
  not_used: "tracker.outcome.not_used",
  used: "tracker.outcome.used",
  unsure: "tracker.outcome.unsure",
};
const C_SUBSTANCES = ["Alcohol","Cannabis","Cocaine / stimulant","Benzodiazepines","Nicotine","Opioids","Gambling","Sex / pornography","Gaming","Food / binge eating"];
const C_BUILDUP = ["just-started","5-15min","15-60min","few-hours","since-morning","most-of-day","multiple-days"];
const C_BUILDUP_LABELS: Record<string, string> = {"just-started":"Just started","5-15min":"5–15 minutes","15-60min":"15–60 minutes","few-hours":"A few hours","since-morning":"Since this morning","most-of-day":"Most of the day","multiple-days":"Multiple days"};
const C_ACTIONS = ["document-only","urge-surfing","box-breathing","grounding","cold-water","play-tape","call-someone","leave-situation","walk-or-move","eat-drink-rest","toolbox","distraction","used","just-observed","remove-access","change-location","delay-timer","use-tool","just-observe"];
const C_ACTION_LABELS: Record<string, string> = {"document-only":"Just document this","urge-surfing":"Urge surfing","box-breathing":"Box breathing","grounding":"5-4-3-2-1 Grounding","cold-water":"Cold water reset","play-tape":"Play the tape forward","call-someone":"Call or text someone","leave-situation":"Leave the situation","walk-or-move":"Walk or move","eat-drink-rest":"Eat, drink, or rest","toolbox":"Open the toolbox","distraction":"Distraction","used":"Used","just-observed":"Just observed","remove-access":"Remove access or money","change-location":"Change location","delay-timer":"Use delay timer","use-tool":"Use a tool from the toolbox","just-observe":"Just observe — don't act"};
const C_OUTCOMES = ["decreased","same","increased"];
const C_OUTCOME_DISPLAY: Record<string, string> = {"decreased":"Decreased","same":"Same","increased":"Increased"};
const C_ONSET = ["Sudden cue (saw/smelled/heard)","Physical sensation","Memory or flashback","Social trigger","Random / no reason","Other"];

// Trek (active craving) option lists — mirrored from TrekTracker
const T_TREK_TYPES = ["Planning or thinking about it","Actively seeking it","Ritual / habit","Boredom-driven","Emotional escape","Social pressure"];
const T_PLANNING = ["Just thinking about it","Getting money or resources","On my way there","About to act"];
const T_LOCATIONS = ["Home","Work","Outside","Shop or bar","In transit","Someone else's place","Other"];
const T_TRIGGERS = ["Boredom","Stress","Habit / routine","Social pressure","Money available","Feeling good / celebratory","Conflict","Other"];
const T_NEEDS = ["Relief","Excitement","Reward","Numbness","Comfort","Connection","Stimulation","Escape","Other"];

const R_LABELS = ["lapse","setback","return-to-use","relapse","no-label"];
const R_LABEL_DISPLAY: Record<string, string> = {"lapse":"A lapse","setback":"A setback","return-to-use":"Return to use","relapse":"A relapse","no-label":"No label"};
const R_DURATIONS = ["single-moment","few-hours","whole-day","multiple-days"];
const R_DURATION_DISPLAY: Record<string, string> = {"single-moment":"A single moment","few-hours":"A few hours","whole-day":"The whole day","multiple-days":"Multiple days"};
const R_SUBSTANCES = ["Alcohol","Cannabis","Cocaine / stimulant","Benzodiazepines","Nicotine","Opioids","Gambling","Sex / pornography","Gaming","Food / binge eating"];
const R_AMOUNTS = ["small","moderate","a-lot","multiple-times","binge","prefer-not"];
const R_AMOUNT_DISPLAY: Record<string, string> = {"small":"Small","moderate":"Moderate","a-lot":"A lot","multiple-times":"Multiple times","binge":"A binge","prefer-not":"Prefer not to say"};
const R_TRIGGERS = ["Internal emotion","External event","Specific thought","Physical discomfort","Social pressure","Craving out of nowhere","Memory / flashback","Seeing or smelling a cue"];
const R_PRE_USE = ["Poor sleep","High stress","Conflict","Isolation","Boredom","Too much self-confidence","Stopped reaching out","Let go of routines","Sought out a trigger place","Had money available","Contact with a trigger person","Mood got worse gradually","Felt 'invincible' — too good"];
const R_WARNINGS = ["Withdrawing from others","Not talking about how I felt","Increased irritability","Poor self-care","Hungry / tired / overwhelmed","Bargaining with myself","Romanticizing past use","'Just once' thinking","Making a plan without admitting it","Seeking out triggers","Keeping secrets","Hopeless thinking","Physical tension building","Contact with a risky person","Bought or prepared"];
const R_THOUGHTS = ["I can't handle this","I'll stop tomorrow","One time won't matter","It's already ruined","I just want peace","I don't want to feel anything","I earned this","No one will know"];
const R_HELP = ["Text or call someone","Go outside / change location","Leave the trigger place","Eat or sleep first","Use a tool from the toolbox","Be honest with someone","Look at my plan","Block access / money","Make an appointment with a professional"];
const R_SUPPORT = ["No one right now","Partner","Friend","Family member","Sponsor","Therapist / counsellor","GP / doctor","Crisis line if needed"];
const R_NEXT = ["Water, food, rest first","Remove triggers from reach","Reach out to someone","Plan the next 24 hours","Get back to routine","Structure today","Make an appointment","Use a support tool","Start again from right now"];
const R_RISK = ["none","unsafe","fear-continued-use","withdrawal","self-harm-risk"];
const R_RISK_DISPLAY: Record<string, string> = {"none":"None","unsafe":"Unsafe","fear-continued-use":"Fear of continued use","withdrawal":"Withdrawal concern","self-harm-risk":"Self-harm risk"};
const R_WHAT_NEEDED = ["Relief","Sleep","Numbness","Pleasure / fun","Connection","Escape","Control","Comfort","Validation","Energy","Calm"];

const A_TYPES = ["Panic spike","Health anxiety","Dread","Racing thoughts","Social anxiety","Generalized worry","Shame / fear after use","Future fear","Body anxiety"];
const A_BODY = ["Chest","Stomach","Throat","Head","Arms","Legs","Whole body"];
const A_CONTEXTS = ["Social — with unknowns","Work / performance","Alone","After using / crash","Nothing specific","Other"];
const A_REACTIONS = ["Sat with it — didn't react","Tried to fix myself","Avoided or left","Searched for distraction","Talked more / overcompensated","Used a tool (breathing, grounding…)","Reached out to someone"];
const A_LINKED = ["This is triggering a craving","This started from restlessness","Poor sleep contributed","After a conflict","After substance use","Not connected to anything specific"];
const A_TRIGGERS = ["Feeling observed","Thought about appearance","Silence / nothing to do","Social expectation","Fear of judgment","Something else"];

const B_TYPES = ["Bored","Understimulated","Physically agitated","Mentally noisy","Can't sit still","Empty","Irritated","Craving stimulation","Lonely and restless","Tired but wired"];
const B_SITUATIONS = ["Doing nothing","Between activities","Alone","After stimulation drops","Before sleep","Other"];
const B_NEEDS = ["calming","movement","sensory-reset","hands","mental","social"];
const B_NEED_LABELS: Record<string, string> = {"calming":"Calming","movement":"Movement","sensory-reset":"Sensory reset","hands":"Hands busy","mental":"Light mental","social":"Social contact"};
const B_RESCUE = ["Shower","Tea or water","Cold water on face","Breathe slowly","Lie down briefly","Short walk","Stretch","Shake tension out","Paced steps","2-minute movement","Fold laundry","Tidy one area","Doodle","Snack prep","Organize a drawer","Simple reading","Podcast","Low-intensity game","Recipe browsing","Light admin task","Open a window","Softer lights","Leave the room","Change clothes","Sit somewhere else"];
const B_CONVERT = ["No — this is restlessness","Maybe a craving","Maybe anxiety","Maybe loneliness","Maybe exhaustion","Not sure"];
const B_ACTIONS = ["Sat with it — didn't react","Delayed action","Replaced with healthy routine","Escaped immediately"];

// ── Helpers ──────────────────────────────────────────────────
function fmtDate(ts: number) {
  return new Date(ts).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
function fmtShortDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function join(arr: string[] | undefined, fallback = "—") { return arr && arr.length > 0 ? arr.join(", ") : fallback; }
function joinT(arr: string[] | undefined, fn: (s: string) => string, fallback = "—") {
  return arr && arr.length > 0 ? arr.map(fn).join(", ") : fallback;
}
function orDash(s: string | undefined) { return s && s.trim() ? s : "—"; }
function arrOr(plural: string[] | undefined, singular: string | undefined): string[] {
  if (plural && plural.length > 0) return plural;
  return singular && singular.trim() ? [singular] : [];
}

// ── Step summaries ───────────────────────────────────────────
// Trek (active craving) registry — mirrors the "Ik heb trek" flow + editable reflection rows
function trekSteps(log: CravingLog, tOpt: (s: string) => string, t: (k: string) => string) {
  // Legacy active logs crammed needOther into thoughtFreeText. Read needOther dedicated field
  // first, falling back to thoughtFreeText for old records. Only treat thoughtFreeText as a real
  // "thought" once needOther exists (new records) so the old free text isn't shown twice.
  const needsOther = log.needOther !== undefined ? log.needOther : (log.thoughtFreeText || "");
  const thoughtsFree = log.needOther !== undefined ? (log.thoughtFreeText || "") : "";
  return [
    { id: "trektype",        label: t("trek.step.type"),          summary: joinT(log.trekTypes, tOpt) },
    { id: "trek_intensity",  label: t("craving.step.intensity"),  summary: `${log.intensity}/10` },
    { id: "confidence",      label: t("trek.q.confidence_before"), summary: `${log.confidenceBefore}/10` },
    { id: "planning",        label: t("trek.step.planning"),      summary: orDash(log.planningStage ? tOpt(log.planningStage) : undefined) },
    { id: "trek_location",   label: t("craving.step.location"),   summary: [log.location ? tOpt(log.location) : log.locationOther, ...(log.socialContext||[]).map(tOpt)].filter(Boolean).join(", ") || "—" },
    { id: "triggers",        label: t("trek.step.triggers"),      summary: [...((log.triggers?.length ? log.triggers : (log.situationPresets||[])).map(tOpt)), log.triggerNote].filter(Boolean).join(", ") || "—" },
    { id: "emotions",        label: t("craving.step.emotions"),   summary: [...(log.emotions||[]).map(tOpt), log.emotionOther].filter(Boolean).join(", ") || "—" },
    { id: "physical",        label: t("craving.step.physical"),   summary: joinT(log.physicalSensations, tOpt) },
    { id: "thoughts",        label: t("craving.step.thoughts"),   summary: [...(log.thoughtPresets||[]).map(tOpt), thoughtsFree].filter(Boolean).join(", ") || "—" },
    { id: "needs",           label: t("trek.step.need"),          summary: [...arrOr(log.needTypes, log.needType).map(tOpt), needsOther].filter(Boolean).join(", ") || "—" },
    { id: "substance",       label: t("craving.step.substance"),  summary: joinT(log.substances, tOpt) },
    { id: "action",          label: t("craving.step.action"),     summary: C_ACTION_LABELS[log.chosenAction] ? tOpt(C_ACTION_LABELS[log.chosenAction]) : log.chosenActionOther || "—" },
    { id: "confidence_after",label: t("trek.q.confidence_after"), summary: log.confidenceAfter != null ? `${log.confidenceAfter}/10` : "—" },
    { id: "use_outcome",     label: t("tracker.outcome.q"),       summary: log.useOutcome ? t(USE_OUTCOME_KEYS[log.useOutcome]) : "—" },
    { id: "outcome",         label: t("craving.step.outcome"),    summary: log.cravingOutcome ? [tOpt(C_OUTCOME_DISPLAY[log.cravingOutcome] || log.cravingOutcome), log.intensityAfter != null ? `${log.intensityAfter}/10` : ""].filter(Boolean).join(" · ") : "—" },
    { id: "note",            label: t("craving.step.note"),       summary: orDash(log.note) },
  ];
}
function cravingSteps(log: CravingLog, tOpt: (s: string) => string, t: (k: string) => string) {
  // Legacy passive logs crammed onsetOther into thoughtFreeText. Same de-duplication pattern as trek.
  const onsetOther = log.onsetOther !== undefined ? log.onsetOther : (log.onsetType === "Other" ? (log.thoughtFreeText || "") : "");
  const thoughtsFree = log.onsetOther !== undefined ? (log.thoughtFreeText || "") : "";
  return [
    { id: "onset",       label: t("craving.step.onset"),      summary: [log.onsetType ? tOpt(log.onsetType) : "", onsetOther].filter(Boolean).join(": ") || "—" },
    { id: "intensity",   label: t("craving.step.intensity"),  summary: `${log.intensity}/10${log.distressLevel >= 0 ? ` · ${log.distressLevel}/10` : ""}` },
    { id: "confidence",  label: t("craving.step.confidence"), summary: `${log.confidenceBefore}/10` },
    { id: "location",    label: t("craving.step.location"),   summary: [log.location ? tOpt(log.location) : log.locationOther, ...(log.socialContext||[]).map(tOpt)].filter(Boolean).join(", ") || "—" },
    { id: "situation",   label: t("craving.step.situation"),  summary: [...(log.situationPresets||[]).map(tOpt), log.situationOther].filter(Boolean).join(", ") || "—" },
    { id: "physical",    label: t("craving.step.physical"),   summary: joinT(log.physicalSensations, tOpt) },
    { id: "buildup",     label: t("craving.step.buildup"),    summary: C_BUILDUP_LABELS[log.buildupDuration] ? tOpt(C_BUILDUP_LABELS[log.buildupDuration]) : log.buildupDuration || "—" },
    { id: "emotions",    label: t("craving.step.emotions"),   summary: [...(log.emotions||[]).map(tOpt), log.emotionOther].filter(Boolean).join(", ") || "—" },
    { id: "thoughts",    label: t("craving.step.thoughts"),   summary: [...(log.thoughtPresets||[]).map(tOpt), thoughtsFree].filter(Boolean).join(", ") || "—" },
    { id: "substance",   label: t("craving.step.substance"),  summary: joinT(log.substances, tOpt) },
    { id: "action",      label: t("craving.step.action"),     summary: C_ACTION_LABELS[log.chosenAction] ? tOpt(C_ACTION_LABELS[log.chosenAction]) : log.chosenActionOther || "—" },
    { id: "use_outcome", label: t("tracker.outcome.q"),       summary: log.useOutcome ? t(USE_OUTCOME_KEYS[log.useOutcome]) : "—" },
    { id: "outcome",     label: t("craving.step.outcome"),    summary: log.cravingOutcome ? [tOpt(C_OUTCOME_DISPLAY[log.cravingOutcome] || log.cravingOutcome), log.intensityAfter != null ? `${log.intensityAfter}/10` : ""].filter(Boolean).join(" · ") : "—" },
    { id: "note",        label: t("craving.step.note"),       summary: orDash(log.note) },
  ];
}
function relapseSteps(log: RelapseLog, tOpt: (s: string) => string, t: (k: string) => string) {
  return [
    { id: "label",     label: t("relapse.step.label"),    summary: tOpt(R_LABEL_DISPLAY[log.label] || log.label || "—") },
    { id: "when",      label: t("relapse.step.when"),     summary: [tOpt(log.when), tOpt(R_DURATION_DISPLAY[log.episodeDuration])].filter(Boolean).join(" · ") || "—" },
    { id: "substance", label: t("relapse.step.substance"), summary: [...(log.substances||[]).map(tOpt), tOpt(R_AMOUNT_DISPLAY[log.amountCategory])].filter(Boolean).join(" · ") || "—" },
    { id: "trigger",   label: t("relapse.step.trigger"),  summary: [tOpt(log.firstTriggerType), log.firstTriggerText].filter(Boolean).join(": ") || "—" },
    { id: "before",    label: t("relapse.step.before"),   summary: joinT(log.preUseFactors, tOpt) },
    { id: "warnings",  label: t("relapse.step.warnings"), summary: joinT(log.missedWarnings, tOpt) },
    { id: "thought",   label: t("relapse.step.thought"),  summary: [...arrOr(log.preUseThoughtPresets, log.preUseThoughtPreset).map(tOpt), log.preUseThoughtFreeText].filter(Boolean).join(", ") || "—" },
    { id: "help",      label: t("relapse.step.help"),     summary: [...(log.couldHaveHelpedEarly||[]),...(log.couldHaveHelpedMiddle||[]),...(log.couldHaveHelpedLast||[])].map(tOpt).join(", ") || "—" },
    { id: "support",   label: t("relapse.step.support"),  summary: [tOpt(log.supportContact), log.supportContactOther].filter(Boolean).join(", ") || "—" },
    { id: "next",      label: t("relapse.step.next"),     summary: [tOpt(log.nextStep||log.nextStepOther), tOpt(R_RISK_DISPLAY[log.acuteRisk])].filter(Boolean).join(" · ") || "—" },
    { id: "needs",     label: t("relapse.step.needs"),    summary: orDash(log.whatNeeded) },
    { id: "note",      label: t("relapse.step.note"),     summary: orDash(log.note) },
  ];
}
function anxietySteps(log: AnxietyLog, tOpt: (s: string) => string, t: (k: string) => string) {
  return [
    { id: "type",      label: t("anxiety.step.type"),      summary: joinT(log.anxietyTypes, tOpt) },
    { id: "intensity", label: t("anxiety.step.intensity"), summary: `${log.intensity}/10` },
    { id: "body",      label: t("anxiety.step.body"),      summary: joinT(log.bodyLocations, tOpt) },
    { id: "context",   label: t("anxiety.step.context"),   summary: orDash(log.context ? tOpt(log.context) : undefined) },
    { id: "linked",    label: t("anxiety.step.linked"),    summary: joinT(arrOr(log.linkedStates, log.linkedState), tOpt) },
    { id: "trigger",   label: t("anxiety.step.trigger"),   summary: joinT(arrOr(log.triggers, log.trigger), tOpt) },
    { id: "reaction",  label: t("anxiety.step.reaction"),  summary: orDash(log.reaction ? tOpt(log.reaction) : undefined) },
    { id: "note",      label: t("anxiety.step.note"),      summary: orDash(log.note) },
    { id: "outcome",   label: t("anxiety.step.outcome"),   summary: log.outcomeAfter ? tOpt(C_OUTCOME_DISPLAY[log.outcomeAfter] || log.outcomeAfter) : "—" },
  ];
}
function boredomSteps(log: BoredomLog, tOpt: (s: string) => string, t: (k: string) => string) {
  return [
    { id: "type",      label: t("boredom.step.type"),      summary: joinT(log.restlessnessTypes || log.feelingTypes, tOpt) },
    { id: "intensity", label: t("boredom.step.intensity"), summary: `${log.intensity}/10` },
    { id: "need",      label: t("boredom.step.need"),      summary: joinT(arrOr(log.stimulationNeeds, log.stimulationNeed).map(k => B_NEED_LABELS[k] || k), tOpt) },
    { id: "convert",   label: t("boredom.step.convert"),   summary: orDash(log.convertCheck ? tOpt(log.convertCheck) : undefined) },
    { id: "situation", label: t("boredom.step.situation"), summary: orDash(log.situation ? tOpt(log.situation) : undefined) },
    { id: "rescue",    label: t("boredom.step.rescue"),    summary: joinT(log.rescueMenu, tOpt) },
    { id: "action",    label: t("boredom.step.action"),    summary: orDash(log.action ? tOpt(log.action) : undefined) },
    { id: "note",      label: t("boredom.step.note"),      summary: orDash(log.note) },
    { id: "outcome",   label: t("boredom.step.outcome"),   summary: log.outcomeAfter ? tOpt(C_OUTCOME_DISPLAY[log.outcomeAfter] || log.outcomeAfter) : "—" },
  ];
}

// ── Shared edit components ───────────────────────────────────
function IntensitySlider({ value, onChange, min = 0, max = 10, lowLabel, highLabel }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; lowLabel?: string; highLabel?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="flex flex-col gap-4">
      <div className="text-center">
        <span className="text-7xl font-light text-primary tabular-nums">{value}</span>
      </div>
      <input type="range" min={min} max={max} step={1} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="intensity-slider w-full"
        style={{ "--thumb-pct": `${pct}%` } as React.CSSProperties} />
      {(lowLabel || highLabel) && (
        <div className="flex justify-between px-1">
          <span className="text-xs text-muted-foreground">{lowLabel}</span>
          <span className="text-xs text-muted-foreground">{highLabel}</span>
        </div>
      )}
    </div>
  );
}

function ChipMulti({ options, value, onChange, displayMap, translate }: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  displayMap?: Record<string, string>;
  translate?: (s: string) => string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => {
        const on = (value || []).includes(opt);
        const display = displayMap ? (displayMap[opt] || opt) : opt;
        return (
          <button key={opt} onClick={() => onChange(on ? (value||[]).filter(x => x !== opt) : [...(value||[]), opt])}
            className={`px-3 py-2 rounded-2xl border text-sm font-medium transition-all touch-target ${on ? "bg-primary/15 border-primary text-foreground" : "bg-card border-border text-muted-foreground"}`}>
            {translate ? translate(display) : display}
          </button>
        );
      })}
    </div>
  );
}

function ChipSingle({ options, value, onChange, displayMap, translate }: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  displayMap?: Record<string, string>;
  translate?: (s: string) => string;
}) {
  return (
    <div className="flex flex-col gap-2">
      {options.map(opt => {
        const display = displayMap ? (displayMap[opt] || opt) : opt;
        return (
          <button key={opt} onClick={() => onChange(opt)}
            className={`w-full text-left px-4 py-3 rounded-2xl border text-sm font-medium transition-all touch-target ${value === opt ? "bg-primary/15 border-primary text-foreground" : "bg-card border-border text-muted-foreground"}`}>
            {translate ? translate(display) : display}
          </button>
        );
      })}
    </div>
  );
}

function TextEdit({ value, onChange, placeholder = "Write something..." }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={4}
      className="w-full bg-card border border-input rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground/60 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
  );
}

type OutcomeVal = "decreased" | "same" | "increased" | null;
function OutcomeSelect({ value, onChange, tOpt }: { value: OutcomeVal; onChange: (v: OutcomeVal) => void; tOpt: (s: string) => string }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {C_OUTCOMES.map(opt => (
        <button key={opt} onClick={() => onChange(value === opt ? null : (opt as OutcomeVal))}
          className={`py-3 px-3 rounded-2xl border text-sm font-medium transition-all touch-target ${value === opt ? "bg-primary/15 border-primary text-foreground" : "bg-card border-border text-muted-foreground"}`}>
          {tOpt(C_OUTCOME_DISPLAY[opt])}
        </button>
      ))}
    </div>
  );
}

// ── Edit field renderers per category + step ─────────────────
function CravingStepEdit({ step, draft, patch, tOpt, t }: { step: string; draft: CravingLog; patch: (u: Partial<CravingLog>) => void; tOpt: (s: string) => string; t: (k: string) => string }) {
  switch (step) {
    case "situation":    return (<div className="flex flex-col gap-4"><ChipMulti options={C_SITUATIONS} value={draft.situationPresets||[]} onChange={v => patch({ situationPresets: v })} translate={tOpt} /><TextEdit value={draft.situationOther||""} onChange={v => patch({ situationOther: v })} placeholder={t("craving.q.situation_other")} /></div>);
    case "intensity":    return (<div className="flex flex-col gap-6"><IntensitySlider value={draft.intensity} onChange={v => patch({ intensity: v })} lowLabel={t("logs.cr_intensity_low")} highLabel={t("logs.cr_intensity_high")} /><div><p className="text-sm font-medium text-foreground mb-3">{t("logs.distress_level")}</p><IntensitySlider value={draft.distressLevel >= 0 ? draft.distressLevel : 5} onChange={v => patch({ distressLevel: v })} lowLabel={t("logs.cr_distress_low")} highLabel={t("logs.cr_distress_high")} /></div></div>);
    case "emotions":     return (<div className="flex flex-col gap-4"><ChipMulti options={C_EMOTIONS} value={draft.emotions||[]} onChange={v => patch({ emotions: v })} translate={tOpt} /><TextEdit value={draft.emotionOther||""} onChange={v => patch({ emotionOther: v })} placeholder={t("craving.q.emotions_other")} /></div>);
    case "physical":     return (<ChipMulti options={C_PHYSICAL} value={draft.physicalSensations||[]} onChange={v => patch({ physicalSensations: v })} translate={tOpt} />);
    case "thoughts":     return (<div className="flex flex-col gap-4"><ChipMulti options={C_THOUGHTS} value={draft.thoughtPresets||[]} onChange={v => patch({ thoughtPresets: v })} translate={tOpt} /><TextEdit value={draft.thoughtFreeText||""} onChange={v => patch({ thoughtFreeText: v })} placeholder={t("craving.q.thoughts_other")} /></div>);
    case "location":     return (<div className="flex flex-col gap-4"><ChipSingle options={C_LOCATIONS} value={draft.location||""} onChange={v => patch({ location: v })} translate={tOpt} /><p className="text-sm font-medium text-foreground">{t("logs.social_context")}</p><ChipMulti options={C_SOCIAL} value={draft.socialContext||[]} onChange={v => patch({ socialContext: v })} translate={tOpt} /></div>);
    case "substance":    return (<ChipMulti options={C_SUBSTANCES} value={draft.substances||[]} onChange={v => patch({ substances: v })} translate={tOpt} />);
    case "buildup":      return (<ChipSingle options={C_BUILDUP} value={draft.buildupDuration||""} onChange={v => patch({ buildupDuration: v })} displayMap={C_BUILDUP_LABELS} translate={tOpt} />);
    case "action":       return (<ChipSingle options={C_ACTIONS} value={draft.chosenAction||""} onChange={v => patch({ chosenAction: v })} displayMap={C_ACTION_LABELS} translate={tOpt} />);
    case "outcome":      return (<div className="flex flex-col gap-4"><div className="grid grid-cols-2 gap-2">{C_OUTCOMES.map(opt => (<button key={opt} onClick={() => { const next = draft.cravingOutcome === opt ? null : (opt as CravingLog["cravingOutcome"]); patch({ cravingOutcome: next, intensityAfter: next ? (draft.intensityAfter ?? 5) : null }); }} className={`py-3 px-3 rounded-2xl border text-sm font-medium transition-all touch-target ${draft.cravingOutcome === opt ? "bg-primary/15 border-primary text-foreground" : "bg-card border-border text-muted-foreground"}`}>{tOpt(C_OUTCOME_DISPLAY[opt])}</button>))}</div>{draft.cravingOutcome && (<><p className="text-sm font-medium text-foreground">{t("craving.q.intensity_after")}</p><IntensitySlider value={draft.intensityAfter ?? 5} onChange={v => patch({ intensityAfter: v })} lowLabel="0" highLabel="10" /></>)}</div>);
    case "confidence":   return (<IntensitySlider value={draft.confidenceBefore} onChange={v => patch({ confidenceBefore: v })} lowLabel={t("logs.cr_confidence_low")} highLabel={t("logs.cr_confidence_high")} />);
    case "confidence_after": return (<IntensitySlider value={draft.confidenceAfter ?? 5} onChange={v => patch({ confidenceAfter: v })} lowLabel="0" highLabel="10" />);
    case "onset":        return (<div className="flex flex-col gap-4"><ChipSingle options={C_ONSET} value={draft.onsetType||""} onChange={v => patch({ onsetType: v })} translate={tOpt} /><TextEdit value={draft.onsetOther||""} onChange={v => patch({ onsetOther: v })} placeholder={t("craving.onset.other_placeholder")} /></div>);
    case "trektype":     return (<ChipMulti options={T_TREK_TYPES} value={draft.trekTypes||[]} onChange={v => patch({ trekTypes: v })} translate={tOpt} />);
    case "trek_intensity": return (<IntensitySlider value={draft.intensity} onChange={v => patch({ intensity: v })} min={0} lowLabel={t("logs.cr_intensity_low")} highLabel={t("logs.cr_intensity_high")} />);
    case "planning":     return (<ChipSingle options={T_PLANNING} value={draft.planningStage||""} onChange={v => patch({ planningStage: v })} translate={tOpt} />);
    case "trek_location": return (<div className="flex flex-col gap-4"><ChipSingle options={T_LOCATIONS} value={draft.location||""} onChange={v => patch({ location: v })} translate={tOpt} /><TextEdit value={draft.locationOther||""} onChange={v => patch({ locationOther: v })} placeholder={t("trek.location.placeholder")} /><p className="text-sm font-medium text-foreground">{t("logs.social_context")}</p><ChipMulti options={C_SOCIAL} value={draft.socialContext||[]} onChange={v => patch({ socialContext: v })} translate={tOpt} /></div>);
    case "triggers":     return (<div className="flex flex-col gap-4"><ChipMulti options={T_TRIGGERS} value={draft.triggers||[]} onChange={v => patch({ triggers: v, situationPresets: v })} translate={tOpt} /><TextEdit value={draft.triggerNote||""} onChange={v => patch({ triggerNote: v })} placeholder={t("trek.triggerNote.placeholder")} /></div>);
    case "needs":        return (<div className="flex flex-col gap-4"><ChipMulti options={T_NEEDS} value={arrOr(draft.needTypes, draft.needType)} onChange={v => patch({ needTypes: v, needType: v[0] || "" })} translate={tOpt} /><TextEdit value={draft.needOther||""} onChange={v => patch({ needOther: v })} placeholder={t("trek.needOther.placeholder")} /></div>);
    case "use_outcome":  return (<div className="flex flex-col gap-2">{(["not_used","used","unsure"] as const).map(opt => (<button key={opt} onClick={() => patch({ useOutcome: draft.useOutcome === opt ? undefined : opt })} className={`w-full text-left px-4 py-3 rounded-2xl border text-sm font-medium transition-all touch-target ${draft.useOutcome === opt ? "bg-primary/15 border-primary text-foreground" : "bg-card border-border text-muted-foreground"}`}>{t(USE_OUTCOME_KEYS[opt])}</button>))}</div>);
    case "note":         return (<TextEdit value={draft.note||""} onChange={v => patch({ note: v })} placeholder={t("common.note_placeholder")} />);
    default:             return null;
  }
}

function RelapseStepEdit({ step, draft, patch, tOpt, t }: { step: string; draft: RelapseLog; patch: (u: Partial<RelapseLog>) => void; tOpt: (s: string) => string; t: (k: string) => string }) {
  switch (step) {
    case "label":     return (<ChipSingle options={R_LABELS} value={draft.label||""} onChange={v => patch({ label: v as RelapseLog["label"] })} displayMap={R_LABEL_DISPLAY} translate={tOpt} />);
    case "when":      return (<div className="flex flex-col gap-4"><TextEdit value={draft.when||""} onChange={v => patch({ when: v })} placeholder={t("relapse.q.when")} /><p className="text-sm font-medium text-foreground">{t("logs.duration_label")}</p><ChipSingle options={R_DURATIONS} value={draft.episodeDuration||""} onChange={v => patch({ episodeDuration: v as RelapseLog["episodeDuration"] })} displayMap={R_DURATION_DISPLAY} translate={tOpt} /></div>);
    case "substance": return (<div className="flex flex-col gap-4"><ChipMulti options={R_SUBSTANCES} value={draft.substances||[]} onChange={v => patch({ substances: v })} translate={tOpt} /><p className="text-sm font-medium text-foreground">{t("logs.amount_label")}</p><ChipSingle options={R_AMOUNTS} value={draft.amountCategory||""} onChange={v => patch({ amountCategory: v as RelapseLog["amountCategory"] })} displayMap={R_AMOUNT_DISPLAY} translate={tOpt} /></div>);
    case "trigger":   return (<div className="flex flex-col gap-4"><ChipSingle options={R_TRIGGERS} value={draft.firstTriggerType||""} onChange={v => patch({ firstTriggerType: v })} translate={tOpt} /><TextEdit value={draft.firstTriggerText||""} onChange={v => patch({ firstTriggerText: v })} placeholder={t("relapse.q.trigger_placeholder")} /></div>);
    case "before":    return (<ChipMulti options={R_PRE_USE} value={draft.preUseFactors||[]} onChange={v => patch({ preUseFactors: v })} translate={tOpt} />);
    case "warnings":  return (<ChipMulti options={R_WARNINGS} value={draft.missedWarnings||[]} onChange={v => patch({ missedWarnings: v })} translate={tOpt} />);
    case "thought":   return (<div className="flex flex-col gap-4"><ChipMulti options={R_THOUGHTS} value={arrOr(draft.preUseThoughtPresets, draft.preUseThoughtPreset)} onChange={v => patch({ preUseThoughtPresets: v, preUseThoughtPreset: v[0] || "" })} translate={tOpt} /><TextEdit value={draft.preUseThoughtFreeText||""} onChange={v => patch({ preUseThoughtFreeText: v })} placeholder={t("craving.q.thoughts_other")} /></div>);
    case "help":      return (<div className="flex flex-col gap-4"><p className="text-sm text-muted-foreground">{t("logs.early_stage")}</p><ChipMulti options={R_HELP} value={draft.couldHaveHelpedEarly||[]} onChange={v => patch({ couldHaveHelpedEarly: v })} translate={tOpt} /><p className="text-sm text-muted-foreground">{t("logs.middle_stage")}</p><ChipMulti options={R_HELP} value={draft.couldHaveHelpedMiddle||[]} onChange={v => patch({ couldHaveHelpedMiddle: v })} translate={tOpt} /><p className="text-sm text-muted-foreground">{t("logs.last_stage")}</p><ChipMulti options={R_HELP} value={draft.couldHaveHelpedLast||[]} onChange={v => patch({ couldHaveHelpedLast: v })} translate={tOpt} /></div>);
    case "support":   return (<ChipSingle options={R_SUPPORT} value={draft.supportContact||""} onChange={v => patch({ supportContact: v })} translate={tOpt} />);
    case "next":      return (<div className="flex flex-col gap-4"><ChipSingle options={R_NEXT} value={draft.nextStep||""} onChange={v => patch({ nextStep: v })} translate={tOpt} /><p className="text-sm font-medium text-foreground">{t("logs.acute_risk")}</p><ChipSingle options={R_RISK} value={draft.acuteRisk||"none"} onChange={v => patch({ acuteRisk: v as RelapseLog["acuteRisk"] })} displayMap={R_RISK_DISPLAY} translate={tOpt} /></div>);
    case "needs":     return (<div className="flex flex-col gap-4"><ChipMulti options={R_WHAT_NEEDED} value={draft.whatNeeded ? [draft.whatNeeded] : []} onChange={v => patch({ whatNeeded: v[v.length - 1] || "" })} translate={tOpt} /><TextEdit value={draft.whatNeeded||""} onChange={v => patch({ whatNeeded: v })} placeholder={t("logs.ph_what_needed")} /></div>);
    case "note":      return (<TextEdit value={draft.note||""} onChange={v => patch({ note: v })} placeholder={t("common.note_placeholder")} />);
    default:          return null;
  }
}

function AnxietyStepEdit({ step, draft, patch, tOpt, t }: { step: string; draft: AnxietyLog; patch: (u: Partial<AnxietyLog>) => void; tOpt: (s: string) => string; t: (k: string) => string }) {
  switch (step) {
    case "intensity": return (<IntensitySlider value={draft.intensity} onChange={v => patch({ intensity: v })} min={1} lowLabel={t("anxiety.low_label")} highLabel={t("anxiety.high_label")} />);
    case "type":      return (<ChipMulti options={A_TYPES} value={draft.anxietyTypes||[]} onChange={v => patch({ anxietyTypes: v })} translate={tOpt} />);
    case "body":      return (<ChipMulti options={A_BODY} value={draft.bodyLocations||[]} onChange={v => patch({ bodyLocations: v })} translate={tOpt} />);
    case "trigger":   return (<ChipMulti options={A_TRIGGERS} value={arrOr(draft.triggers, draft.trigger)} onChange={v => patch({ triggers: v, trigger: v[0] || "" })} translate={tOpt} />);
    case "context":   return (<ChipSingle options={A_CONTEXTS} value={draft.context||""} onChange={v => patch({ context: v })} translate={tOpt} />);
    case "reaction":  return (<ChipSingle options={A_REACTIONS} value={draft.reaction||""} onChange={v => patch({ reaction: v })} translate={tOpt} />);
    case "linked":    return (<ChipMulti options={A_LINKED} value={arrOr(draft.linkedStates, draft.linkedState)} onChange={v => patch({ linkedStates: v, linkedState: v[0] || "" })} translate={tOpt} />);
    case "outcome":   return (<OutcomeSelect value={draft.outcomeAfter ?? null} onChange={v => patch({ outcomeAfter: v })} tOpt={tOpt} />);
    case "note":      return (<TextEdit value={draft.note||""} onChange={v => patch({ note: v })} placeholder={t("common.note_placeholder")} />);
    default:          return null;
  }
}

function BoredomStepEdit({ step, draft, patch, tOpt, t }: { step: string; draft: BoredomLog; patch: (u: Partial<BoredomLog>) => void; tOpt: (s: string) => string; t: (k: string) => string }) {
  switch (step) {
    case "intensity": return (<IntensitySlider value={draft.intensity} onChange={v => patch({ intensity: v })} min={1} lowLabel={t("boredom.low_label")} highLabel={t("boredom.high_label")} />);
    case "type":      return (<ChipMulti options={B_TYPES} value={draft.restlessnessTypes||draft.feelingTypes||[]} onChange={v => patch({ restlessnessTypes: v, feelingTypes: v })} translate={tOpt} />);
    case "situation": return (<ChipSingle options={B_SITUATIONS} value={draft.situation||""} onChange={v => patch({ situation: v })} translate={tOpt} />);
    case "need":      return (<ChipMulti options={B_NEEDS} value={arrOr(draft.stimulationNeeds, draft.stimulationNeed)} onChange={v => patch({ stimulationNeeds: v, stimulationNeed: v[0] || "" })} displayMap={B_NEED_LABELS} translate={tOpt} />);
    case "rescue":    return (<ChipMulti options={B_RESCUE} value={draft.rescueMenu||[]} onChange={v => patch({ rescueMenu: v })} translate={tOpt} />);
    case "action":    return (<ChipSingle options={B_ACTIONS} value={draft.action||""} onChange={v => patch({ action: v })} translate={tOpt} />);
    case "convert":   return (<ChipSingle options={B_CONVERT} value={draft.convertCheck||""} onChange={v => patch({ convertCheck: v })} translate={tOpt} />);
    case "outcome":   return (<OutcomeSelect value={draft.outcomeAfter ?? null} onChange={v => patch({ outcomeAfter: v })} tOpt={tOpt} />);
    case "note":      return (<TextEdit value={draft.note||""} onChange={v => patch({ note: v })} placeholder={t("common.note_placeholder")} />);
    default:          return null;
  }
}

// ── Main Logs page ───────────────────────────────────────────
export function Logs() {
  const { cravingLogs, relapseLogs, anxietyLogs, boredomLogs, removeCraving, removeRelapse, removeAnxiety, removeBoredom, refresh } = useStore();
  const { t, tOpt } = useT();

  const [category, setCategory] = useState<Category>("craving");
  const [view, setView] = useState<"list" | "detail" | "edit">("list");
  const [selectedLog, setSelectedLog] = useState<AnyLog | null>(null);
  const [draftLog, setDraftLog] = useState<AnyLog | null>(null);
  const [editStep, setEditStep] = useState<string>("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const logs: AnyLog[] =
    category === "trek" ? cravingLogs.filter(l => (l as CravingLog).cravingType === "active")
    : category === "craving" ? cravingLogs.filter(l => (l as CravingLog).cravingType !== "active")
    : category === "relapse" ? relapseLogs
    : category === "anxiety" ? anxietyLogs
    : boredomLogs;

  function openDetail(log: AnyLog) {
    let draft: AnyLog = { ...log };
    // Normalize legacy CravingLog records so edit controls prefill correctly and a save
    // gently migrates overloaded fields into their dedicated homes (no double-display).
    if (category === "trek" || category === "craving") {
      const cl = { ...(log as CravingLog) };
      if (category === "trek") {
        if (!(cl.triggers && cl.triggers.length) && cl.situationPresets?.length) cl.triggers = [...cl.situationPresets];
        if (cl.needOther === undefined) { cl.needOther = cl.thoughtFreeText || ""; cl.thoughtFreeText = ""; }
      } else {
        if (cl.onsetOther === undefined) { cl.onsetOther = cl.onsetType === "Other" ? (cl.thoughtFreeText || "") : ""; cl.thoughtFreeText = ""; }
      }
      draft = cl;
    }
    setSelectedLog(log);
    setDraftLog(draft);
    setView("detail");
  }

  function openEdit(stepId: string) {
    setEditStep(stepId);
    setView("edit");
  }

  function patch(updates: object) {
    setDraftLog(prev => prev ? { ...prev, ...updates } as AnyLog : null);
  }

  async function saveEdit() {
    if (!draftLog || saving) return;
    setSaving(true);
    try {
      if (category === "craving" || category === "trek") await updateCravingLog(draftLog as CravingLog);
      else if (category === "relapse") await updateRelapseLog(draftLog as RelapseLog);
      else if (category === "anxiety") await updateAnxietyLog(draftLog as AnxietyLog);
      else await updateBoredomLog(draftLog as BoredomLog);
      await refresh();
      setSelectedLog({ ...draftLog });
      setView("detail");
    } finally {
      setSaving(false);
    }
  }

  async function deleteLog(id: string) {
    if (category === "craving" || category === "trek") await removeCraving(id);
    else if (category === "relapse") await removeRelapse(id);
    else if (category === "anxiety") await removeAnxiety(id);
    else await removeBoredom(id);
    setConfirmDeleteId(null);
    setView("list");
    setSelectedLog(null);
  }

  const steps = selectedLog
    ? category === "trek" ? trekSteps(selectedLog as CravingLog, tOpt, t)
      : category === "craving" ? cravingSteps(selectedLog as CravingLog, tOpt, t)
      : category === "relapse" ? relapseSteps(selectedLog as RelapseLog, tOpt, t)
      : category === "anxiety" ? anxietySteps(selectedLog as AnxietyLog, tOpt, t)
      : boredomSteps(selectedLog as BoredomLog, tOpt, t)
    : [];

  const currentStep = steps.find(s => s.id === editStep);

  // ── Edit view ─────────────────────────────────────────────
  if (view === "edit" && draftLog && currentStep) {
    return (
      <div className="flex flex-col min-h-dvh bg-background">
        <PageHeader title={currentStep.label} back onBack={() => setView("detail")} />
        <div className="flex-1 overflow-y-auto scroll-smooth-ios px-4 pt-5 flex flex-col gap-5"
          style={{ paddingBottom: "calc(9rem + env(safe-area-inset-bottom))" }}>
          {/* Previously entered */}
          <div className="bg-muted/30 border border-border/40 rounded-2xl px-4 py-3">
            <p className="text-[11px] text-muted-foreground uppercase tracking-widest mb-1">{t("logs.prev_entered")}</p>
            <p className="text-sm text-foreground">{currentStep.summary}</p>
          </div>
          {/* Edit component */}
          {(category === "craving" || category === "trek") && <CravingStepEdit step={editStep} draft={draftLog as CravingLog} patch={p => patch(p)} tOpt={tOpt} t={t} />}
          {category === "relapse" && <RelapseStepEdit step={editStep} draft={draftLog as RelapseLog} patch={p => patch(p)} tOpt={tOpt} t={t} />}
          {category === "anxiety" && <AnxietyStepEdit step={editStep} draft={draftLog as AnxietyLog} patch={p => patch(p)} tOpt={tOpt} t={t} />}
          {category === "boredom" && <BoredomStepEdit step={editStep} draft={draftLog as BoredomLog} patch={p => patch(p)} tOpt={tOpt} t={t} />}
        </div>
        {/* Action bar */}
        <div className="fixed left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border px-4 pt-3 pb-3 z-40"
          style={{ bottom: "calc(3.5rem + env(safe-area-inset-bottom))" }}>
          <div className="flex gap-3 max-w-lg mx-auto">
            <button onClick={() => setView("detail")}
              className="touch-target px-5 py-3.5 border border-border rounded-2xl font-medium text-muted-foreground hover:text-foreground transition-colors">
              {t("logs.cancel")}
            </button>
            <button onClick={saveEdit} disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-2xl py-3.5 font-semibold touch-target hover:opacity-90 active:scale-95 transition-all disabled:opacity-60">
              <Check size={16} strokeWidth={2.5} />
              {saving ? t("common.saving") : t("logs.save_change")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Detail view ───────────────────────────────────────────
  if (view === "detail" && selectedLog) {
    return (
      <div className="flex flex-col min-h-dvh bg-background">
        <PageHeader title={fmtShortDate(selectedLog.timestamp)} back onBack={() => setView("list")} />
        <div className="flex-1 overflow-y-auto scroll-smooth-ios px-4 pt-4 flex flex-col gap-2 pb-safe">
          <p className="text-xs text-muted-foreground px-1 pb-1">{t("logs.tap_adjust")}</p>
          {steps.map(s => (
            <button key={s.id} onClick={() => openEdit(s.id)}
              className="w-full text-left bg-card border border-border rounded-2xl px-4 py-3.5 flex items-start justify-between gap-3 hover:border-primary/40 active:scale-[0.98] transition-all">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-0.5">{s.label}</p>
                <p className="text-sm text-foreground leading-snug break-words">{s.summary}</p>
              </div>
              <ChevronRight size={16} className="text-muted-foreground shrink-0 mt-1" />
            </button>
          ))}

          {/* Delete */}
          {confirmDeleteId === selectedLog.id ? (
            <div className="bg-destructive/10 border border-destructive/30 rounded-2xl p-4 flex flex-col gap-3">
              <p className="text-sm font-medium text-foreground">{t("logs.delete_title")}</p>
              <p className="text-sm text-muted-foreground">{t("logs.delete_body_short")}</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDeleteId(null)}
                  className="flex-1 py-2.5 border border-border rounded-xl text-sm font-medium text-muted-foreground">
                  {t("logs.cancel")}
                </button>
                <button onClick={() => deleteLog(selectedLog.id)}
                  className="flex-1 py-2.5 bg-destructive text-destructive-foreground rounded-xl text-sm font-semibold">
                  {t("logs.delete")}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDeleteId(selectedLog.id)}
              className="flex items-center gap-2 mx-auto mt-2 text-sm text-muted-foreground hover:text-destructive transition-colors touch-target px-4 py-2"
            >
              <Trash2 size={14} />
              {t("logs.delete")}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── List view ─────────────────────────────────────────────
  const TABS: { id: Category; label: string; icon: React.ReactNode }[] = [
    { id: "trek",     label: t("logs.tab.trek"),     icon: <Flame size={14} /> },
    { id: "craving",  label: t("logs.tab.craving"),  icon: <Zap size={14} /> },
    { id: "boredom",  label: t("logs.tab.boredom"),  icon: <Coffee size={14} /> },
    { id: "anxiety",  label: t("logs.tab.anxiety"),  icon: <Brain size={14} /> },
    { id: "relapse",  label: t("logs.tab.relapse"),  icon: <AlertTriangle size={14} /> },
  ];

  const categoryLabel = TABS.find(tb => tb.id === category)?.label ?? category;

  return (
    <div className="flex flex-col min-h-dvh bg-background">
      <PageHeader title={t("logs.title")} subtitle={t("logs.subtitle")} />

      {/* Tab bar */}
      <div className="px-4 pt-2 pb-1 flex gap-1.5 bg-background">
        {TABS.map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => setCategory(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full text-xs font-medium transition-colors ${
              category === id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {icon}
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {logs.length > 0 && (
        <p className="px-4 pt-1 pb-0.5 text-[11px] leading-snug text-muted-foreground/70 flex items-start gap-1">
          <Info size={12} className="opacity-70 shrink-0 mt-0.5" aria-hidden />
          {t(
            category === "trek" || category === "craving"
              ? "logs.legend_intensity_outcome"
              : category === "relapse"
              ? "logs.legend_duration"
              : "logs.intensity_legend",
          )}
        </p>
      )}

      <div className="flex-1 overflow-y-auto scroll-smooth-ios px-4 py-3 flex flex-col gap-2 pb-safe">
        {logs.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-muted-foreground text-center px-6">
              {t("logs.empty").replace("{category}", categoryLabel.toLowerCase())}
            </p>
          </div>
        )}

        {logs.map((log) => {
          const ts = log.timestamp;
          let preview = "";
          let badge = "";
          let outcomeBadge = "";
          let isIntensity = false;
          let typeIcon: React.ReactNode = null;
          if (category === "trek") {
            const cl = log as CravingLog;
            const firstType = (cl.trekTypes || [])[0];
            const firstTrig = (cl.triggers?.length ? cl.triggers : (cl.situationPresets || []))[0];
            preview = [firstType ? tOpt(firstType) : "", firstTrig ? tOpt(firstTrig) : ""].filter(Boolean).join(" · ") || tOpt(T_TREK_TYPES[0]);
            badge = `${cl.intensity}/10`;
            isIntensity = true;
            if (cl.cravingOutcome) {
              const arrow = cl.cravingOutcome === "decreased" ? "↓" : cl.cravingOutcome === "increased" ? "↑" : "→";
              outcomeBadge = cl.intensityAfter != null ? `${arrow} ${cl.intensityAfter}/10` : `${arrow} ${tOpt(C_OUTCOME_DISPLAY[cl.cravingOutcome])}`;
            }
            typeIcon = <Flame size={12} className="text-primary" />;
          } else if (category === "craving") {
            const cl = log as CravingLog;
            const firstSub = (cl.substances || [])[0];
            preview = [[(cl.situationPresets||[]).map(tOpt)[0], cl.situationOther].filter(Boolean)[0], firstSub ? tOpt(firstSub) : ""].filter(Boolean).join(" · ") || tOpt(C_EMOTIONS[0]);
            badge = `${cl.intensity}/10`;
            isIntensity = true;
            if (cl.cravingOutcome) {
              const arrow = cl.cravingOutcome === "decreased" ? "↓" : cl.cravingOutcome === "increased" ? "↑" : "→";
              outcomeBadge = cl.intensityAfter != null ? `${arrow} ${cl.intensityAfter}/10` : `${arrow} ${tOpt(C_OUTCOME_DISPLAY[cl.cravingOutcome])}`;
            }
            typeIcon = <Zap size={12} className="text-primary" />;
          } else if (category === "relapse") {
            const rl = log as RelapseLog;
            preview = tOpt(R_LABEL_DISPLAY[rl.label] || rl.label || "—");
            badge = tOpt(R_DURATION_DISPLAY[rl.episodeDuration] || rl.episodeDuration || "—");
          } else if (category === "anxiety") {
            const al = log as AnxietyLog;
            preview = ((al.anxietyTypes||[]).map(tOpt)[0]) || "—";
            badge = `${al.intensity}/10`;
            isIntensity = true;
          } else {
            const bl = log as BoredomLog;
            preview = ((bl.restlessnessTypes||bl.feelingTypes||[]).map(tOpt)[0]) || "—";
            badge = `${bl.intensity}/10`;
            isIntensity = true;
          }

          return (
            <button
              key={log.id}
              onClick={() => openDetail(log)}
              className="w-full text-left bg-card border border-border rounded-2xl px-4 py-3.5 flex items-center justify-between gap-3 hover:border-primary/40 active:scale-[0.98] transition-all touch-target"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-0.5">{fmtDate(ts)}</p>
                <p className="text-sm text-foreground truncate">{preview}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {typeIcon && (
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-muted">
                    {typeIcon}
                  </span>
                )}
                <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                  {isIntensity && <Gauge size={11} className="opacity-70" aria-hidden />}
                  {badge}
                </span>
                {outcomeBadge && (
                  <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                    {outcomeBadge}
                  </span>
                )}
                <ChevronRight size={14} className="text-muted-foreground" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
