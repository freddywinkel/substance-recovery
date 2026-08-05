import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Clock3, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRecoveryFeatures } from "@/contexts/RecoveryFeaturesContext";
import { useActiveRegistration } from "@/contexts/ActiveRegistrationContext";
import {
  recoveryToolLabel,
  registrationRoute,
  type ToolFollowUpRecord,
} from "@/lib/recoveryFeatures";
import {
  activeQuickReflections,
  completedToolFollowUp,
  dueToolFollowUps,
} from "@/lib/quickFollowUp";

const COPY = {
  en: {
    title: "Follow up",
    intro: "Return to something you recorded earlier. These check-ins describe what you report; they do not prove what caused a change.",
    quick: "Quick registration",
    reflect: "Add detailed reflection",
    continueReflection: "Continue detailed reflection",
    later: "You chose to add more detail later.",
    recorded: "Recorded {time}",
    typeLabel: "Type",
    safetyLabel: "Safety answer",
    actionLabel: "Chosen next action",
    urgentTitle: "Immediate danger was reported",
    urgentBody: "This app cannot assess whether the danger has passed. Call 112 now if you or someone else may still be in immediate danger.",
    supportTitle: "You reported needing support",
    supportBody: "Consider contacting a trusted person, professional support, or a crisis service now.",
    call112: "Call 112",
    openSupport: "Open support options",
    acknowledgeUrgent: "I have handled immediate safety — hide this reminder",
    dismiss: "Dismiss",
    tried: "Did you try {tool}?",
    yes: "Yes",
    no: "No",
    feeling: "How strong is the feeling now?",
    scale: "0 is none; 10 is the strongest",
    complete: "Save check-in",
    saving: "Saving…",
    error: "This check-in could not be saved. Please try again.",
    result: "Check-in saved",
    resultAttempted: "You reported trying {tool} and feeling {score}/10 at this check-in.",
    resultNotAttempted: "You reported not trying {tool} and feeling {score}/10 at this check-in.",
    close: "Close",
    types: {
      trek: "Heading toward use",
      craving: "Craving or urge",
      boredom: "Boredom or restlessness",
      anxiety: "Anxiety or tension",
      relapse: "Use or relapse",
    },
    safety: {
      "safe-for-now": "Safe for now",
      "need-support": "Support needed",
      "urgent-danger": "Immediate danger",
    },
    actions: {
      "trusted-contact": "Contact someone I trust",
      "coping-tool": "Use a coping tool",
      "wait-ten": "Pause for 10 minutes",
      "safer-place": "Move toward a safer place",
      "professional-help": "Contact professional support",
      other: "Something else",
    },
  },
  nl: {
    title: "Terugkoppeling",
    intro: "Kom terug op iets dat je eerder vastlegde. Deze check-ins beschrijven wat jij rapporteert; ze bewijzen niet waardoor een verandering kwam.",
    quick: "Snelle registratie",
    reflect: "Uitgebreide reflectie toevoegen",
    continueReflection: "Uitgebreide reflectie vervolgen",
    later: "Je koos ervoor om later meer details toe te voegen.",
    recorded: "Vastgelegd om {time}",
    typeLabel: "Type",
    safetyLabel: "Veiligheidsantwoord",
    actionLabel: "Gekozen vervolgstap",
    urgentTitle: "Er is direct gevaar aangegeven",
    urgentBody: "Deze app kan niet beoordelen of het gevaar voorbij is. Bel nu 112 als jij of iemand anders mogelijk nog direct gevaar loopt.",
    supportTitle: "Je gaf aan nu steun nodig te hebben",
    supportBody: "Overweeg nu contact met een vertrouwd persoon, professionele hulp of een crisisdienst.",
    call112: "Bel 112",
    openSupport: "Open hulpopties",
    acknowledgeUrgent: "Ik heb de directe veiligheid geregeld — verberg deze herinnering",
    dismiss: "Negeren",
    tried: "Heb je {tool} geprobeerd?",
    yes: "Ja",
    no: "Nee",
    feeling: "Hoe sterk is het gevoel nu?",
    scale: "0 is helemaal niet; 10 is het sterkst",
    complete: "Check-in opslaan",
    saving: "Opslaan…",
    error: "Deze check-in kon niet worden opgeslagen. Probeer het opnieuw.",
    result: "Check-in opgeslagen",
    resultAttempted: "Je rapporteerde dat je {tool} hebt geprobeerd en het gevoel nu {score}/10 is.",
    resultNotAttempted: "Je rapporteerde dat je {tool} niet hebt geprobeerd en het gevoel nu {score}/10 is.",
    close: "Sluiten",
    types: {
      trek: "Richting gebruik bewegen",
      craving: "Trek of drang",
      boredom: "Verveling of onrust",
      anxiety: "Angst of spanning",
      relapse: "Gebruik of terugval",
    },
    safety: {
      "safe-for-now": "Voor nu veilig",
      "need-support": "Steun nodig",
      "urgent-danger": "Direct gevaar",
    },
    actions: {
      "trusted-contact": "Contact opnemen met iemand die ik vertrouw",
      "coping-tool": "Een hulpmiddel gebruiken",
      "wait-ten": "10 minuten pauzeren",
      "safer-place": "Naar een veiligere plek gaan",
      "professional-help": "Professionele hulp inschakelen",
      other: "Iets anders",
    },
  },
} as const;

type FollowUpDraft = {
  attempted: boolean | null;
  feelingAfter: number | null;
};

type CompletionNotice = {
  toolLabel: string;
  attempted: boolean;
  feelingAfter: number;
};

export function DeferredFollowUpCard() {
  const { language } = useLanguage();
  const copy = COPY[language];
  const locale = language === "nl" ? "nl-NL" : "en-GB";
  const [, navigate] = useLocation();
  const activeRegistration = useActiveRegistration();
  const {
    addRecoveryAction,
    quickRegistrations,
    recoveryActions,
    removeRecord,
    startQuickReflection,
    toolFollowUps,
    updateRecord,
  } = useRecoveryFeatures();
  const [now, setNow] = useState(() => Date.now());
  const [drafts, setDrafts] = useState<Record<string, FollowUpDraft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const savingIdsRef = useRef(new Set<string>());
  const [errorId, setErrorId] = useState<string | null>(null);
  const [notice, setNotice] = useState<CompletionNotice | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const quickItems = useMemo(() => activeQuickReflections(quickRegistrations), [quickRegistrations]);
  const toolItems = useMemo(() => dueToolFollowUps(toolFollowUps, now), [now, toolFollowUps]);

  const patchDraft = (id: string, patch: Partial<FollowUpDraft>) => {
    setDrafts((current) => ({
      ...current,
      [id]: current[id]
        ? { ...current[id], ...patch }
        : { attempted: patch.attempted ?? null, feelingAfter: patch.feelingAfter ?? null },
    }));
  };

  const openReflection = async (id: string) => {
    setErrorId(null);
    let suspendedDraft = false;
    try {
      const quick = quickRegistrations.find((item) => item.id === id);
      if (!quick) throw new Error("Quick registration no longer exists.");
      const resumed = await activeRegistration.resumeQuickSession(id, quick.registrationType);
      if (resumed) {
        navigate(resumed.route);
        return;
      }
      if (activeRegistration.session) {
        if (activeRegistration.session.savedLogId || activeRegistration.session.step === "done") {
          await activeRegistration.clearSession();
        } else {
          suspendedDraft = await activeRegistration.suspendSession();
          if (!suspendedDraft) throw new Error("Active registration could not be preserved.");
        }
      }
      const record = await startQuickReflection(id);
      if (!record) {
        if (suspendedDraft) {
          const restored = await activeRegistration.completeSession();
          if (!restored) throw new Error("Active registration could not be restored.");
          suspendedDraft = false;
        }
        setErrorId(id);
        return;
      }
      navigate(registrationRoute(record.registrationType));
    } catch {
      if (suspendedDraft) await activeRegistration.completeSession().catch(() => false);
      setErrorId(id);
    }
  };

  const dismissQuick = async (id: string) => {
    const record = quickRegistrations.find((item) => item.id === id);
    if (!record) return;
    setErrorId(null);
    try {
      await updateRecord({ ...record, reflectionStatus: "dismissed" });
    } catch {
      setErrorId(id);
    }
  };

  const dismissTool = async (record: ToolFollowUpRecord) => {
    setErrorId(null);
    try {
      await updateRecord({ ...record, status: "dismissed" });
    } catch {
      setErrorId(record.id);
    }
  };

  const completeTool = async (record: ToolFollowUpRecord) => {
    const draft = drafts[record.id];
    if (!draft || draft.attempted === null || draft.feelingAfter === null || savingIdsRef.current.has(record.id)) return;
    savingIdsRef.current.add(record.id);
    setSavingId(record.id);
    setErrorId(null);
    try {
      const currentToolLabel = recoveryToolLabel(record.toolId, language);
      const recordedAction = recoveryActions.find((action) => action.sourceId === record.id);
      if (draft.attempted && !recordedAction) {
        await addRecoveryAction({
          actionType: "tool",
          label: currentToolLabel,
          sourceId: record.id,
        });
      }
      if (!draft.attempted && recordedAction) {
        await removeRecord(recordedAction.id);
      }
      await updateRecord(completedToolFollowUp(record, draft.attempted, draft.feelingAfter));
      setNotice({
        toolLabel: currentToolLabel,
        attempted: draft.attempted,
        feelingAfter: draft.feelingAfter,
      });
    } catch {
      setErrorId(record.id);
    } finally {
      savingIdsRef.current.delete(record.id);
      setSavingId(null);
    }
  };

  if (quickItems.length === 0 && toolItems.length === 0 && !notice) return null;

  return (
    <section aria-labelledby="deferred-follow-up-title" className="rounded-3xl border border-primary/25 bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-primary/10 p-2 text-primary"><Clock3 size={20} aria-hidden="true" /></div>
        <div>
          <h2 id="deferred-follow-up-title" className="font-semibold text-foreground">{copy.title}</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{copy.intro}</p>
        </div>
      </div>

      {notice && (
        <div className="mt-4 rounded-2xl border border-primary/25 bg-primary/5 p-4" role="status">
          <div className="flex items-center gap-2 font-semibold text-foreground"><CheckCircle2 size={18} className="text-primary" aria-hidden="true" />{copy.result}</div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {(notice.attempted ? copy.resultAttempted : copy.resultNotAttempted)
              .replace("{tool}", notice.toolLabel)
              .replace("{score}", String(notice.feelingAfter))}
          </p>
          <button type="button" onClick={() => setNotice(null)} className="mt-3 text-sm font-semibold text-primary">{copy.close}</button>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {quickItems.map((record) => {
          const actionLabel = record.chosenAction === "other" && record.chosenActionOther
            ? record.chosenActionOther
            : record.chosenAction in copy.actions
              ? copy.actions[record.chosenAction as keyof typeof copy.actions]
              : record.chosenAction;
          const urgent = record.immediateSafety === "urgent-danger";
          return (
            <article key={record.id} className={`rounded-2xl border p-4 ${urgent ? "border-red-500/60 bg-red-500/8" : "border-border bg-background/70"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{copy.quick} · {record.intensity}/10</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {copy.recorded.replace("{time}", new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(record.timestamp))}
                  </p>
                </div>
                {!urgent && (
                  <button type="button" onClick={() => { void dismissQuick(record.id); }} aria-label={copy.dismiss} className="-mr-1 -mt-1 flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground"><X size={18} aria-hidden="true" /></button>
                )}
              </div>
              <dl className="mt-3 grid gap-1.5 text-xs">
                <div><dt className="inline font-semibold text-foreground">{copy.typeLabel}: </dt><dd className="inline text-muted-foreground">{copy.types[record.registrationType]}</dd></div>
                <div><dt className="inline font-semibold text-foreground">{copy.safetyLabel}: </dt><dd className={`inline ${urgent ? "font-semibold text-red-500" : "text-muted-foreground"}`}>{copy.safety[record.immediateSafety]}</dd></div>
                <div><dt className="inline font-semibold text-foreground">{copy.actionLabel}: </dt><dd className="inline text-muted-foreground">{actionLabel}</dd></div>
              </dl>
              {record.immediateSafety !== "safe-for-now" && (
                <div role="alert" className={`mt-3 rounded-xl border p-3 ${urgent ? "border-red-500/50 bg-red-500/10" : "border-primary/30 bg-primary/5"}`}>
                  <p className="text-sm font-semibold text-foreground">{urgent ? copy.urgentTitle : copy.supportTitle}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{urgent ? copy.urgentBody : copy.supportBody}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {urgent && <a href="tel:112" className="flex min-h-11 items-center justify-center rounded-xl bg-red-600 px-3 text-sm font-semibold text-white">{copy.call112}</a>}
                    <Link href="/help" className={`flex min-h-11 items-center justify-center rounded-xl border px-3 text-center text-sm font-semibold ${urgent ? "border-red-500/50 text-red-500" : "col-span-2 border-primary/40 text-primary"}`}>
                      {copy.openSupport}
                    </Link>
                  </div>
                </div>
              )}
              <p className="mt-3 text-xs text-muted-foreground">{copy.later}</p>
              <button
                type="button"
                onClick={() => { void openReflection(record.id); }}
                className="mt-3 min-h-11 w-full rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
              >
                {record.reflectionStatus === "started" ? copy.continueReflection : copy.reflect}
              </button>
              {urgent && (
                <button type="button" onClick={() => { void dismissQuick(record.id); }} className="mt-2 min-h-11 w-full rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted-foreground">
                  {copy.acknowledgeUrgent}
                </button>
              )}
              {errorId === record.id && <p role="alert" className="mt-2 text-xs text-destructive">{copy.error}</p>}
            </article>
          );
        })}

        {toolItems.map((record) => {
          const draft = drafts[record.id] ?? { attempted: null, feelingAfter: null };
          const canSave = draft.attempted !== null && draft.feelingAfter !== null;
          const currentToolLabel = recoveryToolLabel(record.toolId, language);
          return (
            <article key={record.id} className="rounded-2xl border border-border bg-background/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-semibold text-foreground">{copy.tried.replace("{tool}", currentToolLabel)}</h3>
                <button type="button" onClick={() => { void dismissTool(record); }} aria-label={copy.dismiss} className="-mr-1 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground"><X size={18} aria-hidden="true" /></button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {([true, false] as const).map((attempted) => (
                  <button
                    key={String(attempted)}
                    type="button"
                    aria-pressed={draft.attempted === attempted}
                    onClick={() => patchDraft(record.id, { attempted })}
                    className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-semibold ${draft.attempted === attempted ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground"}`}
                  >
                    {attempted ? copy.yes : copy.no}
                  </button>
                ))}
              </div>
              <fieldset className="mt-4">
                <legend className="text-sm font-medium text-foreground">{copy.feeling}</legend>
                <p className="mt-0.5 text-xs text-muted-foreground">{copy.scale}</p>
                <div className="mt-2 grid grid-cols-6 gap-1.5">
                  {Array.from({ length: 11 }, (_, score) => (
                    <button
                      key={score}
                      type="button"
                      aria-pressed={draft.feelingAfter === score}
                      onClick={() => patchDraft(record.id, { feelingAfter: score })}
                      className={`min-h-11 rounded-lg border text-sm font-semibold ${draft.feelingAfter === score ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}
                    >
                      {score}
                    </button>
                  ))}
                </div>
              </fieldset>
              <button
                type="button"
                disabled={!canSave || savingId === record.id}
                onClick={() => { void completeTool(record); }}
                className="mt-4 min-h-11 w-full rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {savingId === record.id ? copy.saving : copy.complete}
              </button>
              {errorId === record.id && <p role="alert" className="mt-2 text-xs text-destructive">{copy.error}</p>}
            </article>
          );
        })}
      </div>
    </section>
  );
}
