import { useRef, useState, type SetStateAction } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Eye,
  EyeOff,
  Save,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRecoveryFeatures } from "@/contexts/RecoveryFeaturesContext";
import { useStore } from "@/hooks/useStore";
import {
  REGISTRATION_TYPES,
  type HomeWidgetId,
  type RecoveryToolId,
  type RegistrationType,
  type HomePreferences,
} from "@/lib/recoveryFeatures";
import { useLocalDraft } from "@/hooks/useLocalDraft";
import { DraftStatus } from "@/components/DraftStatus";
import { isHomeCustomizationDraft } from "@/lib/homeCustomizationDraft";
import { flushLocalDrafts } from "@/lib/localDrafts";

const COPY = {
  en: {
    title: "Edit Home",
    subtitle: "Choose what helps and where it appears",
    intro: "Your choices stay offline on this device. Hidden registration types remain available through ‘Show all’ in the + menu.",
    sectionsTitle: "Home sections",
    sectionsBody: "Show or hide sections and move them into the order you want.",
    shown: "Shown",
    hidden: "Hidden",
    alwaysWhenDue: "Always shown when a check-in is due",
    moveUp: "Move up",
    moveDown: "Move down",
    registrationTitle: "Registration types in the + menu",
    registrationBody: "Hide choices you do not use. At least one type must remain visible; ‘Show all’ always restores direct access to all five.",
    mustKeepOne: "At least one registration type must remain visible.",
    contactTitle: "Contact pinned on Home",
    contactBody: "Choose one trusted contact for a fast call or message. Contacts are managed in Settings.",
    noContact: "No contact pinned",
    toolsTitle: "Tools pinned on Home",
    toolsBody: "Choose up to two. The same preference is used in your recovery plan and on the Tools page.",
    toolsCount: (count: number) => `${count} of 2 selected`,
    toolsLimit: "Two tools are already selected. Remove one before choosing another.",
    save: "Save Home layout",
    saving: "Saving…",
    saved: "Home layout saved offline",
    saveError: "The Home layout could not be saved. Please try again.",
    widgets: {
      sobriety: { label: "Goals and journey", description: "Optional journey start and recorded progress per goal" },
      "quick-registration": { label: "Quick registration", description: "A short route for difficult moments" },
      "follow-ups": { label: "Follow-ups", description: "Always appears when a tool check-in or later reflection is due" },
      cigarettes: { label: "Cigarette counter", description: "Today’s cigarette total and add button" },
      "registration-activity": { label: "Registration activity", description: "Your recent registration activity" },
      "supportive-progress": { label: "Supportive progress", description: "Actions such as reaching out or using a tool" },
      "top-insight": { label: "Top insight", description: "One cautious pattern from your own entries" },
      "daily-anchor": { label: "Daily anchor", description: "A short supportive sentence" },
      "pinned-contact": { label: "Trusted contact", description: "Your selected contact on Home" },
      "pinned-tools": { label: "Preferred tools", description: "Up to two tools for fast access" },
    },
    registrations: {
      trek: "Trek — I am being pulled towards using",
      craving: "Craving — an urge is present",
      boredom: "Boredom or emptiness",
      anxiety: "Anxiety or tension",
      relapse: "Relapse or boundary crossed",
    },
    tools: {
      "/tools/breathing": "Box breathing",
      "/tools/grounding": "5-4-3-2-1 grounding",
      "/tools/cold-water": "Cold water reset",
      "/tools/urge-surfing": "Urge surfing",
      "/tools/tape": "Play the tape forward",
      "/tools/self-compassion": "Self-compassion reframe",
      "/tools/distraction": "Redirect attention",
    },
  },
  nl: {
    title: "Thuis aanpassen",
    subtitle: "Kies wat helpt en waar het staat",
    intro: "Je keuzes blijven offline op dit apparaat. Verborgen registratietypen blijven bereikbaar via ‘Alles tonen’ in het +-menu.",
    sectionsTitle: "Onderdelen op Thuis",
    sectionsBody: "Toon of verberg onderdelen en zet ze in de volgorde die jij wilt.",
    shown: "Getoond",
    hidden: "Verborgen",
    alwaysWhenDue: "Altijd zichtbaar zodra een check-in klaarstaat",
    moveUp: "Omhoog verplaatsen",
    moveDown: "Omlaag verplaatsen",
    registrationTitle: "Registratietypen in het +-menu",
    registrationBody: "Verberg keuzes die je niet gebruikt. Minimaal één type blijft zichtbaar; met ‘Alles tonen’ behoud je altijd directe toegang tot alle vijf.",
    mustKeepOne: "Minimaal één registratietype moet zichtbaar blijven.",
    contactTitle: "Contact vastgezet op Thuis",
    contactBody: "Kies één vertrouwd contact om snel te bellen of berichten. Je beheert contacten in Instellingen.",
    noContact: "Geen contact vastgezet",
    toolsTitle: "Hulpmiddelen vastgezet op Thuis",
    toolsBody: "Kies er maximaal twee. Dezelfde voorkeur wordt gebruikt in je herstelplan en op de pagina Hulpmiddelen.",
    toolsCount: (count: number) => `${count} van 2 gekozen`,
    toolsLimit: "Er zijn al twee hulpmiddelen gekozen. Verwijder er één voordat je een ander kiest.",
    save: "Indeling van Thuis opslaan",
    saving: "Opslaan…",
    saved: "Indeling offline opgeslagen",
    saveError: "De indeling kon niet worden opgeslagen. Probeer het opnieuw.",
    widgets: {
      sobriety: { label: "Doelen en traject", description: "Optionele trajectstart en vastgelegde voortgang per doel" },
      "quick-registration": { label: "Snelle registratie", description: "Een korte route voor moeilijke momenten" },
      "follow-ups": { label: "Opvolging", description: "Verschijnt altijd zodra een tool-check-in of latere reflectie klaarstaat" },
      cigarettes: { label: "Sigarettenteller", description: "Het aantal van vandaag en de toevoegknop" },
      "registration-activity": { label: "Registratieactiviteit", description: "Je recente registratieactiviteit" },
      "supportive-progress": { label: "Ondersteunende voortgang", description: "Acties zoals contact zoeken of een hulpmiddel gebruiken" },
      "top-insight": { label: "Belangrijkste inzicht", description: "Eén voorzichtig patroon uit je eigen invoer" },
      "daily-anchor": { label: "Anker van vandaag", description: "Een korte ondersteunende zin" },
      "pinned-contact": { label: "Vertrouwd contact", description: "Je gekozen contact op Thuis" },
      "pinned-tools": { label: "Voorkeurshulpmiddelen", description: "Maximaal twee hulpmiddelen voor snelle toegang" },
    },
    registrations: {
      trek: "Trek — ik word naar gebruik toe getrokken",
      craving: "Craving — er is een verlangen aanwezig",
      boredom: "Verveling of leegte",
      anxiety: "Angst of spanning",
      relapse: "Terugval of grens overschreden",
    },
    tools: {
      "/tools/breathing": "Box-ademhaling",
      "/tools/grounding": "5-4-3-2-1 aarding",
      "/tools/cold-water": "Koudwater-reset",
      "/tools/urge-surfing": "Gevoelsurfen",
      "/tools/tape": "Speel de band vooruit",
      "/tools/self-compassion": "Zelfcompassie-herkadering",
      "/tools/distraction": "Aandacht verleggen",
    },
  },
} as const;

type EditorSectionProps = {
  title: string;
  body: string;
  children: React.ReactNode;
};

function EditorSection({ title, body, children }: EditorSectionProps) {
  return (
    <section className="rounded-3xl border border-border/70 bg-card/75 p-4 shadow-sm">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function moveHomeItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const destination = index + direction;
  if (destination < 0 || destination >= items.length) return items;
  const next = items.slice();
  [next[index], next[destination]] = [next[destination], next[index]];
  return next;
}

export function HomeCustomization() {
  const { language } = useLanguage();
  const c = COPY[language];
  const { emergencyContacts } = useStore();
  const { loading, loadError, homePreferences, saveHomePreferences } = useRecoveryFeatures();
  const draft = useLocalDraft("home-customization", homePreferences, {
    ready: !loading && !loadError,
    validate: isHomeCustomizationDraft,
  });
  const { widgetOrder, hiddenWidgets, hiddenRegistrationTypes, pinnedContactId, pinnedToolIds } = draft.value;
  const setField = <K extends keyof HomePreferences>(key: K) => (update: SetStateAction<HomePreferences[K]>) => {
    if (savingRef.current) return;
    draft.setValue(current => ({ ...current, [key]: typeof update === "function" ? (update as (value: HomePreferences[K]) => HomePreferences[K])(current[key]) : update }));
  };
  const setWidgetOrder = setField("widgetOrder"), setHiddenWidgets = setField("hiddenWidgets"),
    setHiddenRegistrationTypes = setField("hiddenRegistrationTypes"), setPinnedContactId = setField("pinnedContactId"), setPinnedToolIds = setField("pinnedToolIds");
  const [registrationWarning, setRegistrationWarning] = useState(false);
  const [toolWarning, setToolWarning] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [saveError, setSaveError] = useState("");
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  const toggleWidget = (id: HomeWidgetId) => {
    if (id === "follow-ups") return;
    setStatus("idle");
    setHiddenWidgets((current) => current.includes(id)
      ? current.filter((widgetId) => widgetId !== id)
      : [...current, id]);
  };

  const toggleRegistration = (type: RegistrationType) => {
    setStatus("idle");
    setHiddenRegistrationTypes((current) => {
      if (current.includes(type)) {
        setRegistrationWarning(false);
        return current.filter((registrationType) => registrationType !== type);
      }
      if (current.length >= REGISTRATION_TYPES.length - 1) {
        setRegistrationWarning(true);
        return current;
      }
      setRegistrationWarning(false);
      return [...current, type];
    });
  };

  const toggleTool = (id: RecoveryToolId) => {
    setStatus("idle");
    setPinnedToolIds((current) => {
      if (current.includes(id)) {
        setToolWarning(false);
        return current.filter((toolId) => toolId !== id);
      }
      if (current.length >= 2) {
        setToolWarning(true);
        return current;
      }
      setToolWarning(false);
      return [...current, id];
    });
  };

  const save = async () => {
    if (savingRef.current || !draft.hydrated || draft.error || loadError) return;
    savingRef.current = true;
    setSaving(true);
    setStatus("idle");
    setSaveError("");
    let committed = false;
    try {
      await flushLocalDrafts();
      await saveHomePreferences(draft.value);
      committed = true;
      await draft.clearDraft(draft.value);
      setStatus("saved");
    } catch {
      setSaveError(committed
        ? (language === "nl" ? "De indeling is opgeslagen; het concept kon niet worden gewist. Probeer opnieuw." : "The layout is saved; its draft could not be cleared. Please retry.")
        : c.saveError);
      setStatus("error");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <PageHeader title={c.title} subtitle={c.subtitle} back />
      <div className="flex-1 overflow-y-auto scroll-smooth-ios px-4 py-4 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
          <p className="rounded-2xl border border-primary/25 bg-primary/8 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
            {c.intro}
          </p>
          <DraftStatus {...draft} />
          <fieldset disabled={!draft.hydrated || saving || !!loadError} className="flex min-w-0 flex-col gap-4">

          <EditorSection title={c.sectionsTitle} body={c.sectionsBody}>
            <ol className="flex flex-col gap-2">
              {widgetOrder.map((id, index) => {
                const mandatoryWhenDue = id === "follow-ups";
                const isHidden = !mandatoryWhenDue && hiddenWidgets.includes(id);
                const copy = c.widgets[id];
                return (
                  <li key={id} className="flex items-center gap-2 rounded-2xl border border-border bg-background/60 p-2">
                    <button
                      type="button"
                      disabled={mandatoryWhenDue}
                      onClick={() => toggleWidget(id)}
                      aria-pressed={!isHidden}
                      aria-label={`${copy.label}: ${mandatoryWhenDue ? c.alwaysWhenDue : isHidden ? c.hidden : c.shown}`}
                      className={`flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-xl px-2 text-left transition-colors ${isHidden ? "text-muted-foreground" : "bg-primary/8 text-foreground"} disabled:opacity-100`}
                    >
                      {isHidden ? <EyeOff size={18} className="shrink-0" /> : <Eye size={18} className="shrink-0 text-primary" />}
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{copy.label}</span>
                        <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{copy.description}</span>
                      </span>
                    </button>
                    <div className="flex shrink-0 flex-col gap-1">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => { setWidgetOrder((current) => moveHomeItem(current, index, -1)); setStatus("idle"); }}
                        aria-label={`${c.moveUp}: ${copy.label}`}
                        className="flex h-11 w-11 items-center justify-center rounded-xl border border-border text-muted-foreground disabled:opacity-25"
                      >
                        <ArrowUp size={15} />
                      </button>
                      <button
                        type="button"
                        disabled={index === widgetOrder.length - 1}
                        onClick={() => { setWidgetOrder((current) => moveHomeItem(current, index, 1)); setStatus("idle"); }}
                        aria-label={`${c.moveDown}: ${copy.label}`}
                        className="flex h-11 w-11 items-center justify-center rounded-xl border border-border text-muted-foreground disabled:opacity-25"
                      >
                        <ArrowDown size={15} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
          </EditorSection>

          <EditorSection title={c.registrationTitle} body={c.registrationBody}>
            <div className="flex flex-col gap-2">
              {REGISTRATION_TYPES.map((type) => {
                const shown = !hiddenRegistrationTypes.includes(type);
                const isOnlyVisible = shown && hiddenRegistrationTypes.length === REGISTRATION_TYPES.length - 1;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleRegistration(type)}
                    aria-pressed={shown}
                    aria-disabled={isOnlyVisible}
                    className={`flex min-h-12 items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-left text-sm font-medium ${shown ? "border-primary/50 bg-primary/10 text-foreground" : "border-border bg-background/55 text-muted-foreground"}`}
                  >
                    <span>{c.registrations[type]}</span>
                    {shown ? <Eye size={17} className="shrink-0 text-primary" /> : <EyeOff size={17} className="shrink-0" />}
                  </button>
                );
              })}
            </div>
            {registrationWarning && <p role="alert" className="mt-3 text-xs text-destructive">{c.mustKeepOne}</p>}
          </EditorSection>

          <EditorSection title={c.contactTitle} body={c.contactBody}>
            <label className="sr-only" htmlFor="home-pinned-contact">{c.contactTitle}</label>
            <select
              id="home-pinned-contact"
              value={pinnedContactId ?? ""}
              onChange={(event) => { setPinnedContactId(event.target.value || null); setStatus("idle"); }}
              className="min-h-12 w-full rounded-2xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15"
            >
              <option value="">{c.noContact}</option>
              {emergencyContacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.name}{contact.relationship ? ` — ${contact.relationship}` : ""}
                </option>
              ))}
            </select>
          </EditorSection>

          <EditorSection title={c.toolsTitle} body={c.toolsBody}>
            <div className="grid gap-2 sm:grid-cols-2">
              {(Object.entries(c.tools) as Array<[RecoveryToolId, string]>).map(([id, label]) => {
                const selected = pinnedToolIds.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleTool(id)}
                    aria-pressed={selected}
                    className={`flex min-h-12 items-center justify-between gap-2 rounded-2xl border px-3 py-2 text-left text-sm font-medium ${selected ? "border-primary/55 bg-primary/10 text-foreground" : "border-border bg-background/55 text-muted-foreground"}`}
                  >
                    {label}
                    {selected && <Check size={17} className="shrink-0 text-primary" />}
                  </button>
                );
              })}
            </div>
            <p className={`mt-3 text-xs ${toolWarning ? "text-destructive" : "text-muted-foreground"}`} role={toolWarning ? "alert" : undefined}>
              {toolWarning ? c.toolsLimit : c.toolsCount(pinnedToolIds.length)}
            </p>
          </EditorSection>

          <button
            type="button"
            onClick={() => { void save(); }}
            disabled={loading || saving || !draft.hydrated || !!draft.error || !!loadError}
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/15 transition-transform active:scale-[0.98] disabled:opacity-55"
          >
            {status === "saved" ? <Check size={19} /> : <Save size={19} />}
            {saving ? c.saving : status === "saved" ? c.saved : c.save}
          </button>
          {status === "error" && <p role="alert" className="text-center text-sm text-destructive">{saveError}</p>}
          </fieldset>
        </div>
      </div>
    </div>
  );
}
