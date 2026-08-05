import { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Phone, ShieldCheck } from "lucide-react";
import { useLocation } from "wouter";
import { PageHeader } from "@/components/PageHeader";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRecoveryFeatures } from "@/contexts/RecoveryFeaturesContext";
import { useActiveRegistration } from "@/contexts/ActiveRegistrationContext";
import {
  REGISTRATION_TYPES,
  registrationRoute,
  type QuickRegistrationRecord,
  type QuickSafety,
  type RegistrationType,
} from "@/lib/recoveryFeatures";
import { buildQuickRegistrationRecord } from "@/lib/quickFollowUp";

const COPY = {
  en: {
    title: "Quick registration",
    subtitle: "Record what matters in about 20 seconds",
    type: "What is happening?",
    types: {
      trek: "I am heading toward using",
      craving: "Craving or urge",
      boredom: "Boredom or restlessness",
      anxiety: "Anxiety or tension",
      relapse: "Use or relapse",
    },
    intensity: "Intensity now",
    intensityRequired: "Choose a score from 0 to 10.",
    intensityUnanswered: "Not chosen",
    low: "low",
    high: "high",
    safety: "Are you safe right now?",
    safetyOptions: {
      "safe-for-now": "Safe for now",
      "need-support": "I need support",
      "urgent-danger": "There is immediate danger",
    },
    supportTitle: "Put immediate safety first",
    supportBody: "This app cannot assess an emergency. Get human help now if you or someone else may be in immediate danger.",
    call112: "Call 112",
    openHelp: "Open support options",
    action: "What will you do next?",
    actions: {
      "trusted-contact": "Contact someone I trust",
      "coping-tool": "Use a coping tool",
      "wait-ten": "Pause for 10 minutes",
      "safer-place": "Move toward a safer place",
      "professional-help": "Contact professional support",
      other: "Something else",
    },
    other: "Describe your next action",
    note: "Optional note",
    notePlaceholder: "A few words, if useful",
    required: "Choose a type, intensity, safety answer and next action.",
    otherRequired: "Describe the other action before saving.",
    save: "Save quick registration",
    saving: "Saving…",
    saveError: "This could not be saved. Your answers remain on this screen; please try again.",
    saved: "Quick registration saved",
    savedBody: "You can add the detailed reflection now, or return to it later from Home.",
    reflectNow: "Continue with detailed questions",
    later: "Reflect later",
    reflectionError: "The detailed reflection could not be opened. Please try again.",
  },
  nl: {
    title: "Snelle registratie",
    subtitle: "Leg in ongeveer 20 seconden vast wat nu belangrijk is",
    type: "Wat gebeurt er?",
    types: {
      trek: "Ik beweeg richting gebruik",
      craving: "Trek of drang",
      boredom: "Verveling of onrust",
      anxiety: "Angst of spanning",
      relapse: "Gebruik of terugval",
    },
    intensity: "Intensiteit nu",
    intensityRequired: "Kies een score van 0 tot en met 10.",
    intensityUnanswered: "Niet gekozen",
    low: "laag",
    high: "hoog",
    safety: "Ben je nu veilig?",
    safetyOptions: {
      "safe-for-now": "Voor nu veilig",
      "need-support": "Ik heb ondersteuning nodig",
      "urgent-danger": "Er is direct gevaar",
    },
    supportTitle: "Zet directe veiligheid voorop",
    supportBody: "Deze app kan een noodgeval niet beoordelen. Schakel nu menselijke hulp in als jij of iemand anders mogelijk direct gevaar loopt.",
    call112: "Bel 112",
    openHelp: "Open hulpopties",
    action: "Wat ga je nu doen?",
    actions: {
      "trusted-contact": "Contact opnemen met iemand die ik vertrouw",
      "coping-tool": "Een hulpmiddel gebruiken",
      "wait-ten": "10 minuten pauzeren",
      "safer-place": "Naar een veiligere plek gaan",
      "professional-help": "Professionele hulp inschakelen",
      other: "Iets anders",
    },
    other: "Beschrijf je volgende actie",
    note: "Optionele notitie",
    notePlaceholder: "Een paar woorden, als dat helpt",
    required: "Kies een type, intensiteit, veiligheidsantwoord en volgende actie.",
    otherRequired: "Beschrijf de andere actie voordat je opslaat.",
    save: "Snelle registratie opslaan",
    saving: "Opslaan…",
    saveError: "Opslaan is niet gelukt. Je antwoorden blijven op dit scherm staan; probeer het opnieuw.",
    saved: "Snelle registratie opgeslagen",
    savedBody: "Je kunt de uitgebreide reflectie nu invullen of er later via Thuis op terugkomen.",
    reflectNow: "Doorgaan met uitgebreide vragen",
    later: "Later reflecteren",
    reflectionError: "De uitgebreide reflectie kon niet worden geopend. Probeer het opnieuw.",
  },
} as const;

const ACTION_IDS = [
  "trusted-contact",
  "coping-tool",
  "wait-ten",
  "safer-place",
  "professional-help",
  "other",
] as const;

const SAFETY_IDS: QuickSafety[] = ["safe-for-now", "need-support", "urgent-danger"];

export function QuickRegistration() {
  const { language } = useLanguage();
  const copy = COPY[language];
  const [, navigate] = useLocation();
  const activeRegistration = useActiveRegistration();
  const {
    addRecord,
    homePreferences,
    startQuickReflection,
  } = useRecoveryFeatures();
  const [registrationType, setRegistrationType] = useState<RegistrationType | null>(null);
  const [intensity, setIntensity] = useState<number | null>(null);
  const [immediateSafety, setImmediateSafety] = useState<QuickSafety | null>(null);
  const [chosenAction, setChosenAction] = useState<string>("");
  const [chosenActionOther, setChosenActionOther] = useState("");
  const [note, setNote] = useState("");
  const [savedRecord, setSavedRecord] = useState<QuickRegistrationRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const visibleTypes = useMemo(
    () => REGISTRATION_TYPES.filter((type) => !homePreferences.hiddenRegistrationTypes.includes(type)),
    [homePreferences.hiddenRegistrationTypes],
  );

  const save = async () => {
    if (savingRef.current) return;
    if (!registrationType || intensity === null || !immediateSafety || !chosenAction) {
      setError(copy.required);
      return;
    }
    if (chosenAction === "other" && !chosenActionOther.trim()) {
      setError(copy.otherRequired);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const input = buildQuickRegistrationRecord({
        registrationType,
        intensity,
        immediateSafety,
        chosenAction,
        chosenActionOther,
        note,
      });
      const saved = await addRecord<QuickRegistrationRecord>(input);
      setSavedRecord(saved);
    } catch {
      setError(copy.saveError);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const beginReflection = async () => {
    if (!savedRecord) return;
    setError(null);
    let suspendedDraft = false;
    try {
      if (activeRegistration.session) {
        if (activeRegistration.session.savedLogId || activeRegistration.session.step === "done") {
          await activeRegistration.clearSession();
        } else {
          suspendedDraft = await activeRegistration.suspendSession();
          if (!suspendedDraft) throw new Error("Active registration could not be preserved.");
        }
      }
      const started = await startQuickReflection(savedRecord.id);
      if (!started) {
        if (suspendedDraft) {
          const restored = await activeRegistration.completeSession();
          if (!restored) throw new Error("Active registration could not be restored.");
          suspendedDraft = false;
        }
        setError(copy.reflectionError);
        return;
      }
      navigate(registrationRoute(started.registrationType));
    } catch {
      if (suspendedDraft) await activeRegistration.completeSession().catch(() => false);
      setError(copy.reflectionError);
    }
  };

  if (savedRecord) {
    return (
      <div className="flex min-h-dvh flex-col bg-background">
        <PageHeader title={copy.title} back />
        <main className="flex flex-1 flex-col items-center justify-center gap-5 overflow-y-auto scroll-smooth-ios px-5 py-8 text-center pb-safe">
          <CheckCircle2 className="text-primary" size={56} strokeWidth={1.5} aria-hidden="true" />
          <div className="max-w-sm">
            <h2 className="text-2xl font-semibold text-foreground">{copy.saved}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{copy.savedBody}</p>
          </div>
          {savedRecord.immediateSafety !== "safe-for-now" && (
            <SupportRoute urgent={savedRecord.immediateSafety === "urgent-danger"} />
          )}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex w-full max-w-sm flex-col gap-3">
            <button
              type="button"
              onClick={() => { void beginReflection(); }}
              className="min-h-12 rounded-2xl bg-primary px-4 py-3 font-semibold text-primary-foreground active:scale-[0.98]"
            >
              {copy.reflectNow}
            </button>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="min-h-12 rounded-2xl border border-border px-4 py-3 font-medium text-foreground"
            >
              {copy.later}
            </button>
          </div>
        </main>
      </div>
    );
  }

  function SupportRoute({ urgent }: { urgent: boolean }) {
    return (
      <section
        role="alert"
        className="w-full max-w-sm rounded-2xl border border-red-800/50 bg-red-950/20 p-4 text-left"
      >
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 shrink-0 text-red-500" size={22} aria-hidden="true" />
          <div>
            <h2 className="font-semibold text-foreground">{copy.supportTitle}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{copy.supportBody}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {urgent && (
            <a href="tel:112" className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white">
              <Phone size={18} aria-hidden="true" /> {copy.call112}
            </a>
          )}
          <button
            type="button"
            onClick={() => navigate("/help")}
            className="min-h-12 rounded-xl border border-red-800/40 bg-card px-4 py-3 text-sm font-semibold text-foreground"
          >
            {copy.openHelp}
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <PageHeader title={copy.title} back subtitle={copy.subtitle} />
      <main className="flex-1 overflow-y-auto scroll-smooth-ios px-4 py-5 pb-safe">
        <form
          className="mx-auto flex w-full max-w-lg flex-col gap-5"
          onSubmit={(event) => { event.preventDefault(); void save(); }}
        >
          <fieldset className="rounded-3xl border border-border bg-card p-4">
            <legend className="px-1 text-sm font-semibold text-foreground">{copy.type}</legend>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {visibleTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  aria-pressed={registrationType === type}
                  onClick={() => setRegistrationType(type)}
                  className={`min-h-12 rounded-xl border px-3 py-3 text-left text-sm transition-colors ${registrationType === type ? "border-primary bg-primary/10 font-semibold text-foreground" : "border-border text-muted-foreground"}`}
                >
                  {copy.types[type]}
                </button>
              ))}
            </div>
          </fieldset>

          <section className="rounded-3xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <p id="quick-intensity-label" className="text-sm font-semibold text-foreground">{copy.intensity}</p>
              <output aria-live="polite" className="rounded-lg bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                {intensity === null ? copy.intensityUnanswered : `${intensity}/10`}
              </output>
            </div>
            <div
              role="radiogroup"
              aria-labelledby="quick-intensity-label"
              aria-describedby="quick-intensity-help"
              aria-required="true"
              className="mt-4 grid grid-cols-6 gap-2"
            >
              {Array.from({ length: 11 }, (_, value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={intensity === value}
                  aria-label={`${copy.intensity} ${value}/10`}
                  onClick={() => setIntensity(value)}
                  className={`min-h-11 rounded-xl border text-sm font-semibold transition-colors ${intensity === value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground"}`}
                >
                  {value}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground"><span>0 · {copy.low}</span><span>10 · {copy.high}</span></div>
            {intensity === null && <p id="quick-intensity-help" className="mt-2 text-xs text-muted-foreground">{copy.intensityRequired}</p>}
          </section>

          <fieldset className="rounded-3xl border border-border bg-card p-4">
            <legend className="px-1 text-sm font-semibold text-foreground">{copy.safety}</legend>
            <div className="mt-2 flex flex-col gap-2">
              {SAFETY_IDS.map((safety) => (
                <button
                  key={safety}
                  type="button"
                  aria-pressed={immediateSafety === safety}
                  onClick={() => setImmediateSafety(safety)}
                  className={`flex min-h-12 items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm ${immediateSafety === safety ? "border-primary bg-primary/10 font-semibold text-foreground" : "border-border text-muted-foreground"}`}
                >
                  <ShieldCheck size={18} className="shrink-0" aria-hidden="true" />
                  {copy.safetyOptions[safety]}
                </button>
              ))}
            </div>
          </fieldset>

          {immediateSafety && immediateSafety !== "safe-for-now" && (
            <SupportRoute urgent={immediateSafety === "urgent-danger"} />
          )}

          <fieldset className="rounded-3xl border border-border bg-card p-4">
            <legend className="px-1 text-sm font-semibold text-foreground">{copy.action}</legend>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {ACTION_IDS.map((action) => (
                <button
                  key={action}
                  type="button"
                  aria-pressed={chosenAction === action}
                  onClick={() => setChosenAction(action)}
                  className={`min-h-12 rounded-xl border px-3 py-3 text-left text-sm ${chosenAction === action ? "border-primary bg-primary/10 font-semibold text-foreground" : "border-border text-muted-foreground"}`}
                >
                  {copy.actions[action]}
                </button>
              ))}
            </div>
            {chosenAction === "other" && (
              <label className="mt-3 block text-sm text-foreground">
                <span className="sr-only">{copy.other}</span>
                <input
                  value={chosenActionOther}
                  onChange={(event) => setChosenActionOther(event.target.value)}
                  maxLength={500}
                  placeholder={copy.other}
                  className="min-h-12 w-full rounded-xl border border-border bg-background px-3 py-3 text-base text-foreground outline-none focus:border-primary"
                />
              </label>
            )}
          </fieldset>

          <label className="rounded-3xl border border-border bg-card p-4 text-sm font-semibold text-foreground">
            {copy.note}
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={2000}
              rows={2}
              placeholder={copy.notePlaceholder}
              className="mt-2 w-full resize-none rounded-xl border border-border bg-background px-3 py-3 text-base font-normal text-foreground outline-none focus:border-primary"
            />
          </label>

          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="min-h-14 rounded-2xl bg-primary px-5 py-4 font-semibold text-primary-foreground active:scale-[0.98] disabled:opacity-60"
          >
            {saving ? copy.saving : copy.save}
          </button>
        </form>
      </main>
    </div>
  );
}
