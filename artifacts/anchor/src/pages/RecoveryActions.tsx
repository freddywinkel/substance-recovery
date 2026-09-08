import { useMemo, useRef, useState, type FormEvent } from "react";
import {
  CalendarCheck2,
  CheckCircle2,
  Goal,
  HeartHandshake,
  PhoneCall,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useRecoveryFeatures } from "@/contexts/RecoveryFeaturesContext";
import { useStore } from "@/hooks/useStore";
import { useT } from "@/hooks/useTranslation";
import {
  buildReviewRegistrations,
  buildSupportiveProgressSummary,
  getLocalWeekRange,
} from "@/lib/recoveryProgress";
import { recoveryToolLabel, type RecoveryActionRecord, type RecoveryActionType } from "@/lib/recoveryFeatures";
import { useLocalDraft } from "@/hooks/useLocalDraft";
import { DraftStatus } from "@/components/DraftStatus";
import { createSupportiveActionDraft, isSupportiveActionDraft } from "@/lib/supportiveActionDraft";
import { flushLocalDrafts } from "@/lib/localDrafts";

const COPY = {
  en: {
    title: "Supportive progress",
    subtitle: "Notice recovery-supporting actions, not only streaks.",
    thisWeek: "This week",
    recognised: "supportive steps in view",
    detailed: "Detailed registrations",
    quick: "Quick registrations",
    actions: "Actions you recorded",
    addTitle: "Record a supportive action",
    addIntro: "Choose what you followed through on. This is a personal record, not a score.",
    contact: "Contacted someone",
    contactHint: "Called, messaged or met someone for support",
    care: "Attended care",
    careHint: "Appointment, meeting, group or other care",
    goal: "Personal goal",
    goalHint: "A recovery-supporting commitment you completed",
    label: "What did you do?",
    labelPlaceholder: "For example: called my support person",
    note: "Optional note",
    notePlaceholder: "Anything you want to remember",
    save: "Save action",
    saving: "Saving…",
    saved: "Action saved on this device.",
    saveError: "The action could not be saved. Please try again.",
    required: "Describe the action before saving.",
    recent: "Recent supportive actions",
    empty: "No supportive actions recorded yet.",
    local: "Stored only on this device.",
    remove: "Delete action",
    confirmRemove: "Delete",
    cancel: "Cancel",
    removeError: "The action could not be deleted. Please try again.",
    loading: "Loading…",
    types: {
      contact: "Contact",
      care: "Care",
      tool: "Coping tool",
      goal: "Goal",
    },
  },
  nl: {
    title: "Ondersteunende vooruitgang",
    subtitle: "Zie ook herstelondersteunende acties, niet alleen reeksen.",
    thisWeek: "Deze week",
    recognised: "ondersteunende stappen in beeld",
    detailed: "Uitgebreide registraties",
    quick: "Snelle registraties",
    actions: "Zelf vastgelegde acties",
    addTitle: "Leg een ondersteunende actie vast",
    addIntro: "Kies wat je hebt opgevolgd. Dit is een persoonlijk overzicht, geen score.",
    contact: "Contact gezocht",
    contactHint: "Iemand gebeld, bericht of ontmoet voor steun",
    care: "Zorg bijgewoond",
    careHint: "Afspraak, bijeenkomst, groep of andere zorg",
    goal: "Persoonlijk doel",
    goalHint: "Een herstelondersteunende afspraak die je hebt uitgevoerd",
    label: "Wat heb je gedaan?",
    labelPlaceholder: "Bijvoorbeeld: mijn steunpersoon gebeld",
    note: "Optionele notitie",
    notePlaceholder: "Wat je hierover wilt onthouden",
    save: "Actie opslaan",
    saving: "Opslaan…",
    saved: "Actie op dit apparaat opgeslagen.",
    saveError: "De actie kon niet worden opgeslagen. Probeer het opnieuw.",
    required: "Beschrijf de actie voordat je opslaat.",
    recent: "Recente ondersteunende acties",
    empty: "Nog geen ondersteunende acties vastgelegd.",
    local: "Alleen op dit apparaat opgeslagen.",
    remove: "Actie verwijderen",
    confirmRemove: "Verwijderen",
    cancel: "Annuleren",
    removeError: "De actie kon niet worden verwijderd. Probeer het opnieuw.",
    loading: "Laden…",
    types: {
      contact: "Contact",
      care: "Zorg",
      tool: "Copingtool",
      goal: "Doel",
    },
  },
} as const;

const ACTION_OPTIONS: Array<{
  type: Exclude<RecoveryActionType, "tool">;
  icon: typeof PhoneCall;
  titleKey: "contact" | "care" | "goal";
  hintKey: "contactHint" | "careHint" | "goalHint";
}> = [
  { type: "contact", icon: PhoneCall, titleKey: "contact", hintKey: "contactHint" },
  { type: "care", icon: CalendarCheck2, titleKey: "care", hintKey: "careHint" },
  { type: "goal", icon: Goal, titleKey: "goal", hintKey: "goalHint" },
];

export function RecoveryActions() {
  const { language } = useT();
  const copy = COPY[language];
  const store = useStore();
  const {
    addRecord,
    loading: featureLoading,
    loadError: featureLoadError,
    quickRegistrations,
    recoveryActions,
    removeRecord,
    toolFollowUps,
  } = useRecoveryFeatures();
  const draft = useLocalDraft("supportive-action", createSupportiveActionDraft(), {
    ready: !featureLoading && !featureLoadError,
    validate: isSupportiveActionDraft,
  });
  const { actionType, label, note } = draft.value;
  const setActionType = (next: Exclude<RecoveryActionType, "tool">) => draft.setValue(current => ({ ...current, actionType: next }));
  const setLabel = (next: string) => draft.setValue(current => ({ ...current, label: next }));
  const setNote = (next: string) => draft.setValue(current => ({ ...current, note: next }));
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const actionButtons = useRef<Array<HTMLButtonElement | null>>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [listError, setListError] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const registrations = useMemo(
    () => buildReviewRegistrations({
      cravingLogs: store.cravingLogs,
      relapseLogs: store.relapseLogs,
      anxietyLogs: store.anxietyLogs,
      boredomLogs: store.boredomLogs,
      quickRegistrations,
    }),
    [
      quickRegistrations,
      store.anxietyLogs,
      store.boredomLogs,
      store.cravingLogs,
      store.relapseLogs,
    ],
  );
  const weekRange = useMemo(() => getLocalWeekRange(), []);
  const summary = useMemo(
    () => buildSupportiveProgressSummary({ registrations, recoveryActions, range: weekRange }),
    [recoveryActions, registrations, weekRange],
  );

  const recentActions = recoveryActions.slice(0, 20);

  const deleteAction = async (id: string) => {
    if (deletingId) return;
    setDeletingId(id);
    setListError("");
    try {
      await removeRecord(id);
      setPendingDeleteId(null);
    } catch {
      setListError(copy.removeError);
    } finally {
      setDeletingId(null);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (savingRef.current || !draft.hydrated || draft.error || featureLoadError) return;
    setMessage("");
    if (!label.trim()) {
      setError(copy.required);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError("");
    let committed = false;
    try {
      const submitted = { ...draft.value, timestamp: draft.value.timestamp ?? Date.now() };
      draft.setValue(submitted);
      await flushLocalDrafts();
      await addRecord<RecoveryActionRecord>({
        id: submitted.id, recordType: "recovery-action", timestamp: submitted.timestamp,
        actionType: submitted.actionType, label: submitted.label.trim(), note: submitted.note.trim(), sourceId: null,
      });
      committed = true;
      await draft.clearDraft(createSupportiveActionDraft(), { keepInputOnFailure: true });
      setMessage(copy.saved);
    } catch {
      setError(committed
        ? (language === "nl" ? "De actie is opgeslagen; het concept kon niet worden gewist. Probeer opnieuw: dezelfde actie wordt bijgewerkt." : "The action is saved; its draft could not be cleared. Retrying updates the same action.")
        : copy.saveError);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  if (store.loading || featureLoading) {
    return (
      <div role="status" className="flex min-h-dvh items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="sr-only">{copy.loading}</span>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title={copy.title} subtitle={copy.subtitle} back />
      <div className="flex-1 overflow-y-auto scroll-smooth-ios px-4 pb-safe pt-3">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 pb-8">
          <section className="rounded-[1.5rem] border border-primary/20 bg-primary/5 p-4" aria-labelledby="weekly-progress-title">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <HeartHandshake size={23} strokeWidth={1.8} />
              </span>
              <div className="min-w-0">
                <p id="weekly-progress-title" className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  {copy.thisWeek}
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                  {summary.totalRecognisedActions}
                </p>
                <p className="text-sm text-muted-foreground">{copy.recognised}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                [copy.detailed, summary.detailedRegistrations],
                [copy.quick, summary.quickRegistrations],
                [copy.actions, summary.supportiveActions],
              ].map(([labelText, value]) => (
                <div key={String(labelText)} className="rounded-xl border border-border/60 bg-card/70 p-3 text-center">
                  <p className="text-xl font-semibold tabular-nums text-foreground">{value}</p>
                  <p className="mt-1 text-[11px] leading-tight text-muted-foreground">{labelText}</p>
                </div>
              ))}
            </div>
          </section>

          <form onSubmit={submit} className="rounded-[1.5rem] border border-border/70 bg-card p-4" noValidate>
            <h2 className="text-base font-semibold text-foreground">{copy.addTitle}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{copy.addIntro}</p>
            <DraftStatus {...draft} />
            <fieldset disabled={!draft.hydrated || saving || !!featureLoadError}>

            <div className="mt-4 grid gap-2" role="radiogroup" aria-label={copy.addTitle}>
              {ACTION_OPTIONS.map(({ type, icon: Icon, titleKey, hintKey }, index) => {
                const selected = actionType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-labelledby={`supportive-action-${type}-label`}
                    aria-describedby={`supportive-action-${type}-hint`}
                    tabIndex={selected ? 0 : -1}
                    ref={element => { actionButtons.current[index] = element; }}
                    onClick={() => setActionType(type)}
                    onKeyDown={event => {
                      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
                      event.preventDefault();
                      const count = ACTION_OPTIONS.length;
                      const next = event.key === "Home" ? 0 : event.key === "End" ? count - 1
                        : (index + (["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : count - 1)) % count;
                      setActionType(ACTION_OPTIONS[next].type);
                      actionButtons.current[next]?.focus();
                    }}
                    className={`flex min-h-16 items-center gap-3 rounded-2xl border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                      selected
                        ? "border-primary bg-primary/10"
                        : "border-border/70 bg-background hover:bg-muted/40"
                    }`}
                  >
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      <Icon size={20} strokeWidth={1.8} />
                    </span>
                    <span>
                      <span id={`supportive-action-${type}-label`} className="block text-sm font-semibold text-foreground">{copy[titleKey]}</span>
                      <span id={`supportive-action-${type}-hint`} className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{copy[hintKey]}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <label className="mt-4 block text-sm font-medium text-foreground" htmlFor="recovery-action-label">
              {copy.label}
            </label>
            <input
              id="recovery-action-label"
              value={label}
              onChange={(event) => {
                setLabel(event.target.value);
                if (error) setError("");
              }}
              maxLength={500}
              placeholder={copy.labelPlaceholder}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "recovery-action-error" : undefined}
              className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-3 text-base text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/50"
            />
            {error && <p id="recovery-action-error" className="mt-2 text-sm text-destructive">{error}</p>}

            <label className="mt-4 block text-sm font-medium text-foreground" htmlFor="recovery-action-note">
              {copy.note}
            </label>
            <textarea
              id="recovery-action-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={2000}
              rows={3}
              placeholder={copy.notePlaceholder}
              className="mt-2 w-full resize-y rounded-xl border border-input bg-background px-3 py-3 text-base text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/50"
            />

            <button
              type="submit"
              disabled={saving || !draft.hydrated || !!draft.error || !!featureLoadError}
              className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <CheckCircle2 size={19} strokeWidth={1.8} />
              {saving ? copy.saving : copy.save}
            </button>
            <div aria-live="polite" className="mt-2 min-h-5 text-sm text-primary">{message}</div>
            </fieldset>
          </form>

          <section className="rounded-[1.5rem] border border-border/70 bg-card p-4" aria-labelledby="recent-actions-title">
            <div className="flex items-center justify-between gap-3">
              <h2 id="recent-actions-title" className="text-base font-semibold text-foreground">{copy.recent}</h2>
              <span className="text-[11px] text-muted-foreground">{copy.local}</span>
            </div>
            {listError && <p role="alert" className="mt-3 text-sm text-destructive">{listError}</p>}
            {recentActions.length === 0 ? (
              <p className="mt-4 rounded-xl bg-muted/40 px-3 py-4 text-sm text-muted-foreground">{copy.empty}</p>
            ) : (
              <ol className="mt-3 divide-y divide-border/60">
                {recentActions.map((action) => {
                  const sourceFollowUp = action.sourceId
                    ? toolFollowUps.find((followUp) => followUp.id === action.sourceId)
                    : undefined;
                  const currentLabel = action.actionType === "tool" && sourceFollowUp
                    ? recoveryToolLabel(sourceFollowUp.toolId, language)
                    : action.label;
                  return (
                  <li key={action.id} className="py-3 first:pt-1 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{currentLabel}</p>
                        {action.note && <p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-muted-foreground">{action.note}</p>}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary">{copy.types[action.actionType]}</span>
                        <button type="button" onClick={() => setPendingDeleteId(action.id)} aria-label={copy.remove} className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground"><Trash2 size={17} aria-hidden="true" /></button>
                      </div>
                    </div>
                    <time className="mt-1 block text-[11px] text-muted-foreground" dateTime={new Date(action.timestamp).toISOString()}>
                      {new Intl.DateTimeFormat(language === "nl" ? "nl-NL" : "en-GB", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(action.timestamp)}
                    </time>
                    {pendingDeleteId === action.id && (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => setPendingDeleteId(null)} className="min-h-11 rounded-xl border border-border px-3 text-sm font-semibold text-muted-foreground">{copy.cancel}</button>
                        <button type="button" disabled={deletingId === action.id} onClick={() => { void deleteAction(action.id); }} className="min-h-11 rounded-xl bg-destructive px-3 text-sm font-semibold text-destructive-foreground disabled:opacity-60">{copy.confirmRemove}</button>
                      </div>
                    )}
                  </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
