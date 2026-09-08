import { useMemo, useRef, useState, type SetStateAction } from "react";
import { Link } from "wouter";
import {
  Check,
  Copy,
  MessageCircle,
  Phone,
  Save,
  ShieldAlert,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRecoveryFeatures } from "@/contexts/RecoveryFeaturesContext";
import { useStore } from "@/hooks/useStore";
import {
  localizedCallMessage,
  parseRecoveryPlan,
  parseJson,
  type RecoveryPlan as RecoveryPlanData,
  type RecoveryToolId,
} from "@/lib/recoveryFeatures";
import { useLocalDraft } from "@/hooks/useLocalDraft";
import { PlanVersionView } from "@/components/PlanVersionView";
import { DraftStatus } from "@/components/DraftStatus";
import { PreventionPlanEditor } from "@/components/PreventionPlanEditor";
import {
  normalizePreventionPlan,
} from "@/lib/preventionPlan";
import { isRecoveryPlanDraft } from "@/lib/planDraft";
import { getSetting } from "@/db";
import { PlanConflictError } from "@/db/planPersistence";
import { flushLocalDrafts } from "@/lib/localDrafts";

const COPY = {
  en: {
    title: "My recovery plan",
    subtitle: "Prepare support while things feel manageable",
    introTitle: "A plan for difficult moments",
    introBody:
      "Write this when you have some space. You can return to it quickly when an urge, worry or setback feels harder to think through.",
    onePerLine: "One item per line. Keep it specific and useful to you.",
    warningTitle: "My warning signs",
    warningBody:
      "Thoughts, feelings, body signals or behaviour that tell you a difficult moment may be building.",
    warningPlaceholder:
      "I start isolating\nI stop eating regularly\nI tell myself one time will not matter",
    reasonsTitle: "My reasons for recovery",
    reasonsBody:
      "People, values, health, freedom or future moments you want to protect.",
    reasonsPlaceholder:
      "Being present with my family\nWaking up clear-headed\nKeeping control of my choices",
    avoidTitle: "Situations I want to avoid or prepare for",
    avoidBody:
      "Places, people, times or circumstances that deserve an alternative plan.",
    avoidPlaceholder:
      "Going to the shop alone after work\nKeeping cash with me on Friday night",
    toolsTitle: "My preferred tools",
    toolsBody:
      "Choose up to two tools. They are also pinned on Home for fast access.",
    toolsCount: (count: number) => `${count} of 2 selected`,
    toolsLimit: "You can choose no more than two preferred tools.",
    contactTitle: "My support network",
    contactBody:
      "Choose the saved contacts you may want to reach during a difficult moment.",
    noSavedContacts: "No contacts have been saved yet.",
    selectedContacts: "Reach my selected support network",
    callContact: "Call",
    messageContact: "Message",
    homeContact: "Contact pinned on Home",
    homeContactBody:
      "Optionally choose one contact for the fastest call or message.",
    noContact: "No contact pinned on Home",
    addContact: "Add or edit contacts in Settings",
    messageTitle: "Message I can send",
    messageBody:
      "Prepare a short message now, so asking for support takes fewer steps later.",
    messagePlaceholder: "Can you call me? I could use some support right now.",
    copy: "Copy message",
    copied: "Copied",
    textContact: "Text this contact",
    textUnavailable:
      "Choose a contact with a phone number to text this message.",
    nextTitle: "My next 24 hours",
    nextBody:
      "Small, concrete next steps: who to contact, where to be and what to do first.",
    nextPlaceholder:
      "Call my support person before 10:00\nEat something and drink water\nAvoid being alone tonight",
    caveatTitle: "Personal preparation, not emergency care",
    caveatBody:
      "This plan is not medical advice and cannot assess your immediate safety. Review its wording with a qualified clinician or recovery professional where possible. If you or someone else is in immediate danger, call 112.",
    save: "Save recovery plan",
    saving: "Saving…",
    saved: "Saved offline on this device",
    saveError: "The plan could not be saved. Please try again.",
    updated: "Last saved",
    toolLabels: {
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
    title: "Mijn herstelplan",
    subtitle: "Bereid steun voor wanneer het rustig genoeg voelt",
    introTitle: "Een plan voor moeilijke momenten",
    introBody:
      "Schrijf dit op wanneer je ruimte hebt. Zo kun je er snel op terugvallen wanneer trek, onrust of een terugval helder nadenken moeilijker maakt.",
    onePerLine: "Eén punt per regel. Maak het concreet en bruikbaar voor jou.",
    warningTitle: "Mijn waarschuwingssignalen",
    warningBody:
      "Gedachten, gevoelens, lichamelijke signalen of gedrag waaraan je merkt dat een moeilijk moment opbouwt.",
    warningPlaceholder:
      "Ik zonder mij af\nIk eet niet meer regelmatig\nIk vertel mezelf dat één keer niet uitmaakt",
    reasonsTitle: "Mijn redenen voor herstel",
    reasonsBody:
      "Mensen, waarden, gezondheid, vrijheid of toekomstmomenten die je wilt beschermen.",
    reasonsPlaceholder:
      "Aanwezig zijn voor mijn familie\nHelder wakker worden\nZelf de regie houden",
    avoidTitle: "Situaties die ik wil vermijden of voorbereiden",
    avoidBody:
      "Plaatsen, mensen, tijden of omstandigheden waarvoor je een alternatief plan wilt.",
    avoidPlaceholder:
      "Na het werk alleen naar de winkel gaan\nOp vrijdagavond contant geld bij me hebben",
    toolsTitle: "Mijn voorkeurshulpmiddelen",
    toolsBody:
      "Kies maximaal twee hulpmiddelen. Ze worden ook op Thuis vastgezet voor snelle toegang.",
    toolsCount: (count: number) => `${count} van 2 gekozen`,
    toolsLimit: "Je kunt maximaal twee voorkeurshulpmiddelen kiezen.",
    contactTitle: "Mijn steunnetwerk",
    contactBody:
      "Kies de opgeslagen contactpersonen die je tijdens een moeilijk moment mogelijk wilt benaderen.",
    noSavedContacts: "Er zijn nog geen contactpersonen opgeslagen.",
    selectedContacts: "Mijn gekozen steunnetwerk bereiken",
    callContact: "Bellen",
    messageContact: "Bericht",
    homeContact: "Contact op Start vastzetten",
    homeContactBody:
      "Kies eventueel één contact voor de snelste bel- of berichtoptie.",
    noContact: "Geen contact op Start vastgezet",
    addContact: "Contacten toevoegen of wijzigen in Instellingen",
    messageTitle: "Bericht dat ik kan sturen",
    messageBody:
      "Bereid nu een kort bericht voor, zodat steun vragen later minder stappen kost.",
    messagePlaceholder: "Kun je me bellen? Ik kan nu wat steun gebruiken.",
    copy: "Bericht kopiëren",
    copied: "Gekopieerd",
    textContact: "Stuur dit contact een bericht",
    textUnavailable:
      "Kies een contact met telefoonnummer om dit bericht te sturen.",
    nextTitle: "Mijn volgende 24 uur",
    nextBody:
      "Kleine, concrete vervolgstappen: wie je benadert, waar je bent en wat je eerst doet.",
    nextPlaceholder:
      "Bel mijn steunpersoon vóór 10:00\nEet iets en drink water\nBlijf vanavond niet alleen",
    caveatTitle: "Persoonlijke voorbereiding, geen spoedzorg",
    caveatBody:
      "Dit plan is geen medisch advies en kan je directe veiligheid niet beoordelen. Bespreek de formulering waar mogelijk met een bevoegde behandelaar of herstelprofessional. Bel 112 als jij of iemand anders direct in gevaar is.",
    save: "Herstelplan opslaan",
    saving: "Opslaan…",
    saved: "Offline opgeslagen op dit apparaat",
    saveError: "Het plan kon niet worden opgeslagen. Probeer het opnieuw.",
    updated: "Laatst opgeslagen",
    toolLabels: {
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

type PlanSectionProps = {
  title: string;
  body: string;
  children: React.ReactNode;
};

function PlanSection({ title, body, children }: PlanSectionProps) {
  return (
    <section className="rounded-3xl border border-border/70 bg-card/75 p-4 shadow-sm">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {body}
      </p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function normalizePlanLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

export function RecoveryPlan() {
  const { language } = useLanguage();
  const c = COPY[language];
  const { emergencyContacts } = useStore();
  const {
    loading,
    loadError,
    refresh,
    recoveryPlan,
    homePreferences,
    saveRecoveryPlan,
  } = useRecoveryFeatures();
  const draft = useLocalDraft(
    "recovery-plan",
    {
      warningSigns: recoveryPlan.warningSigns.join("\n"),
      reasons: recoveryPlan.reasonsForRecovery.join("\n"),
      situations: recoveryPlan.situationsToAvoid.join("\n"),
      message: localizedCallMessage(recoveryPlan.callMessage, language),
      next24Hours: recoveryPlan.next24Hours.join("\n"),
      trustedContactIds: recoveryPlan.trustedContactIds,
      pinnedContactId: homePreferences.pinnedContactId,
      pinnedToolIds: homePreferences.pinnedToolIds,
      prevention: normalizePreventionPlan(recoveryPlan.prevention),
      baseUpdatedAt: recoveryPlan.updatedAt,
    },
    {
      ready: !loading && !loadError,
      validate: isRecoveryPlanDraft,
    },
  );
  const {
    warningSigns,
    reasons,
    situations,
    message,
    next24Hours,
    trustedContactIds,
    pinnedContactId,
    pinnedToolIds,
    prevention,
  } = draft.value;
  const fieldSetter =
    <K extends keyof typeof draft.value>(key: K) =>
    (update: SetStateAction<(typeof draft.value)[K]>) => {
      if (savingRef.current) return;
      draft.setValue((current) => ({
        ...current,
        [key]:
          typeof update === "function"
            ? (
                update as (
                  value: (typeof draft.value)[K],
                ) => (typeof draft.value)[K]
              )(current[key])
            : update,
      }));
    };
  const setWarningSigns = fieldSetter("warningSigns"),
    setReasons = fieldSetter("reasons"),
    setSituations = fieldSetter("situations"),
    setMessage = fieldSetter("message"),
    setNext24Hours = fieldSetter("next24Hours");
  const setTrustedContactIds = fieldSetter("trustedContactIds"),
    setPinnedContactId = fieldSetter("pinnedContactId"),
    setPinnedToolIds = fieldSetter("pinnedToolIds");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [saveError, setSaveError] = useState("");
  const [conflictingPlan, setConflictingPlan] =
    useState<RecoveryPlanData | null>(null);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [copied, setCopied] = useState(false);
  const [toolLimitReached, setToolLimitReached] = useState(false);

  const selectedContact = useMemo(
    () =>
      emergencyContacts.find((contact) => contact.id === pinnedContactId) ??
      null,
    [emergencyContacts, pinnedContactId],
  );
  const selectedTrustedContacts = useMemo(
    () =>
      trustedContactIds
        .map((id) => emergencyContacts.find((contact) => contact.id === id))
        .filter((contact): contact is (typeof emergencyContacts)[number] =>
          Boolean(contact),
        ),
    [emergencyContacts, trustedContactIds],
  );

  const toggleTool = (toolId: RecoveryToolId) => {
    setStatus("idle");
    setPinnedToolIds((current) => {
      if (current.includes(toolId)) {
        setToolLimitReached(false);
        return current.filter((id) => id !== toolId);
      }
      if (current.length >= 2) {
        setToolLimitReached(true);
        return current;
      }
      setToolLimitReached(false);
      return [...current, toolId];
    });
  };

  const toggleContact = (contactId: string) => {
    setStatus("idle");
    setTrustedContactIds((current) =>
      current.includes(contactId)
        ? current.filter((id) => id !== contactId)
        : [...current, contactId],
    );
  };

  const handleSave = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setStatus("idle");
    try {
      await flushLocalDrafts();
      const saved = await saveRecoveryPlan(
        {
          version: 1,
          warningSigns: normalizePlanLines(warningSigns),
          reasonsForRecovery: normalizePlanLines(reasons),
          situationsToAvoid: normalizePlanLines(situations),
          trustedContactIds: [
            ...new Set([
              ...trustedContactIds,
              ...(pinnedContactId ? [pinnedContactId] : []),
            ]),
          ],
          callMessage: message.trim().slice(0, 1000),
          next24Hours: normalizePlanLines(next24Hours),
          updatedAt: draft.value.baseUpdatedAt,
          prevention,
        },
        {
          pinnedContactId,
          pinnedToolIds,
        },
      );
      await draft
        .clearDraft({
          ...draft.value,
          baseUpdatedAt: saved.updatedAt,
          prevention: normalizePreventionPlan(saved.prevention),
        })
        .catch(() => undefined);
      setConflictingPlan(null);
      setStatus("saved");
      setSaveError("");
    } catch (error) {
      setStatus("error");
      if (error instanceof PlanConflictError) {
        setSaveError(
          language === "nl"
            ? "Een ander tabblad heeft een nieuwere versie opgeslagen. Bekijk die versie en kies wat je wilt bewaren."
            : "Another tab saved a newer version. Review it and choose what to keep.",
        );
        try {
          setConflictingPlan(
            parseRecoveryPlan(parseJson(await getSetting("recoveryPlan"))),
          );
        } catch {
          /* Original data remains untouched. */
        }
      } else
        setSaveError(
          language === "nl"
            ? "Je invoer is behouden. Controleer de conceptmelding en probeer opnieuw."
            : "Your input is preserved. Check the draft notice and retry.",
        );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleCopy = async () => {
    if (!message.trim()) return;
    try {
      await copyText(message.trim());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const inputClass =
    "min-h-32 w-full resize-y rounded-2xl border border-border bg-background/70 px-3 py-3 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/55 focus:border-primary/60 focus:ring-2 focus:ring-primary/15";

  if (loadError)
    return (
      <div className="flex h-full flex-col">
        <PageHeader title={c.title} back />
        <div role="alert" className="p-5 text-sm">
          {language === "nl"
            ? "Je plan kon niet worden gelezen. Je opgeslagen gegevens zijn niet vervangen."
            : "Your plan could not be read. Your saved data has not been replaced."}
          <button
            className="block min-h-11 underline"
            onClick={() => void refresh()}
          >
            {language === "nl" ? "Opnieuw proberen" : "Retry"}
          </button>
        </div>
      </div>
    );
  if (loading || !draft.hydrated)
    return (
      <div className="flex h-full flex-col">
        <PageHeader title={c.title} back />
        <p role="status" className="p-5">
          {language === "nl" ? "Plan laden…" : "Loading plan…"}
        </p>
      </div>
    );

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <PageHeader title={c.title} subtitle={c.subtitle} back />
      <div className="flex-1 overflow-y-auto scroll-smooth-ios px-4 py-4 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
        <fieldset disabled={saving} className="mx-auto flex w-full min-w-0 max-w-2xl flex-col gap-4">
          <section className="rounded-3xl border border-primary/25 bg-primary/8 p-4">
            <h2 className="font-semibold text-foreground">{c.introTitle}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {c.introBody}
            </p>
          </section>

          <DraftStatus {...draft} />
          <div className="flex flex-wrap gap-2">
            <Link
              href="/action-card"
              className="min-h-11 rounded-xl bg-primary/15 px-4 py-3 text-sm font-medium text-primary"
            >
              {language === "nl" ? "Mijn actiekaart" : "My action card"}
            </Link>
            <Link
              href="/report"
              className="min-h-11 rounded-xl border border-border px-4 py-3 text-sm"
            >
              {language === "nl"
                ? "Plan selectief afdrukken"
                : "Print selected plan sections"}
            </Link>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="min-h-11 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
            >
              {saving ? c.saving : c.save}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            {language === "nl"
              ? "Vul alleen in wat nu helpt. Je kunt onderdelen openklappen en later verdergaan."
              : "Fill in only what helps now. Open sections and continue later."}
          </p>
          {status === "error" && (
            <div
              role="alert"
              className="rounded-2xl border border-destructive/50 p-4 text-sm"
            >
              <p>
                {c.saveError} {saveError}
              </p>
              {conflictingPlan && (
                <>
                  <details className="mt-3">
                    <summary className="min-h-11 cursor-pointer">
                      {language === "nl"
                        ? "Nieuwste opgeslagen plan bekijken"
                        : "View the latest saved plan"}
                    </summary>
                    <PlanVersionView
                      content={JSON.stringify(conflictingPlan)}
                      onRestore={(previous) => {
                        draft.setValue((current) => ({
                          ...current,
                          warningSigns: previous.warningSigns.join("\n"),
                          reasons: previous.reasonsForRecovery.join("\n"),
                          situations: previous.situationsToAvoid.join("\n"),
                          message: previous.callMessage,
                          next24Hours: previous.next24Hours.join("\n"),
                          trustedContactIds: previous.trustedContactIds,
                          baseUpdatedAt: previous.updatedAt,
                          prevention: normalizePreventionPlan(
                            previous.prevention,
                          ),
                        }));
                        setConflictingPlan(null);
                        setStatus("idle");
                      }}
                    />
                  </details>
                  <button
                    className="mt-2 min-h-11 underline"
                    type="button"
                    onClick={() => {
                      draft.setValue((current) => ({
                        ...current,
                        baseUpdatedAt: conflictingPlan.updatedAt,
                        prevention: {
                          ...current.prevention,
                          revisions: normalizePreventionPlan(
                            conflictingPlan.prevention,
                          ).revisions,
                        },
                      }));
                      setConflictingPlan(null);
                      setStatus("idle");
                    }}
                  >
                    {language === "nl"
                      ? "Mijn invoer op de nieuwste versie toepassen en daarna opslaan"
                      : "Apply my input to the latest version, then save"}
                  </button>
                </>
              )}
            </div>
          )}
          <PreventionPlanEditor
            value={prevention}
            onChange={fieldSetter("prevention")}
            contacts={emergencyContacts}
          />

          <PlanSection title={c.warningTitle} body={c.warningBody}>
            <textarea
              aria-label={c.warningTitle}
              value={warningSigns}
              onChange={(event) => {
                setWarningSigns(event.target.value);
                setStatus("idle");
              }}
              placeholder={c.warningPlaceholder}
              maxLength={12000}
              className={inputClass}
              aria-describedby="warning-format-help"
            />
            <p
              id="warning-format-help"
              className="mt-2 text-[11px] text-muted-foreground"
            >
              {c.onePerLine}
            </p>
          </PlanSection>

          <PlanSection title={c.reasonsTitle} body={c.reasonsBody}>
            <textarea
              aria-label={c.reasonsTitle}
              value={reasons}
              onChange={(event) => {
                setReasons(event.target.value);
                setStatus("idle");
              }}
              placeholder={c.reasonsPlaceholder}
              maxLength={12000}
              className={inputClass}
            />
            <p className="mt-2 text-[11px] text-muted-foreground">
              {c.onePerLine}
            </p>
          </PlanSection>

          <PlanSection title={c.avoidTitle} body={c.avoidBody}>
            <textarea
              aria-label={c.avoidTitle}
              value={situations}
              onChange={(event) => {
                setSituations(event.target.value);
                setStatus("idle");
              }}
              placeholder={c.avoidPlaceholder}
              maxLength={12000}
              className={inputClass}
            />
            <p className="mt-2 text-[11px] text-muted-foreground">
              {c.onePerLine}
            </p>
          </PlanSection>

          <PlanSection title={c.toolsTitle} body={c.toolsBody}>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                Object.entries(c.toolLabels) as Array<[RecoveryToolId, string]>
              ).map(([id, label]) => {
                const selected = pinnedToolIds.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleTool(id)}
                    className={`min-h-12 rounded-2xl border px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${selected ? "border-primary/60 bg-primary/12 text-foreground" : "border-border bg-background/55 text-muted-foreground hover:text-foreground"}`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      {label}
                      {selected && (
                        <Check
                          size={17}
                          className="shrink-0 text-primary"
                          aria-hidden="true"
                        />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
            <p
              className={`mt-3 text-xs ${toolLimitReached ? "text-destructive" : "text-muted-foreground"}`}
              role={toolLimitReached ? "alert" : undefined}
            >
              {toolLimitReached
                ? c.toolsLimit
                : c.toolsCount(pinnedToolIds.length)}
            </p>
          </PlanSection>

          <PlanSection title={c.contactTitle} body={c.contactBody}>
            {emergencyContacts.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
                {c.noSavedContacts}
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {emergencyContacts.map((contact) => {
                  const selected = trustedContactIds.includes(contact.id);
                  return (
                    <button
                      key={contact.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleContact(contact.id)}
                      className={`flex min-h-12 items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-left ${selected ? "border-primary/60 bg-primary/10 text-foreground" : "border-border bg-background/55 text-muted-foreground"}`}
                    >
                      <span>
                        <span className="block text-sm font-semibold">
                          {contact.name}
                        </span>
                        {contact.relationship && (
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {contact.relationship}
                          </span>
                        )}
                      </span>
                      {selected && (
                        <Check
                          size={17}
                          className="shrink-0 text-primary"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            {selectedTrustedContacts.length > 0 && (
              <div className="mt-4 rounded-2xl border border-primary/25 bg-primary/5 p-3">
                <h3 className="text-sm font-semibold text-foreground">
                  {c.selectedContacts}
                </h3>
                <ul className="mt-3 space-y-2">
                  {selectedTrustedContacts.map((contact) => (
                    <li
                      key={contact.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/70 p-3"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-foreground">
                          {contact.name}
                        </span>
                        {contact.relationship && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {contact.relationship}
                          </span>
                        )}
                      </span>
                      {contact.phone && (
                        <span className="flex gap-2">
                          <a
                            href={`tel:${contact.phone}`}
                            className="flex min-h-11 items-center gap-1.5 rounded-xl border border-primary/35 px-3 text-xs font-semibold text-primary"
                            aria-label={`${c.callContact}: ${contact.name}`}
                          >
                            <Phone size={16} aria-hidden="true" />
                            {c.callContact}
                          </a>
                          <a
                            href={`sms:${contact.phone}${message.trim() ? `?&body=${encodeURIComponent(message.trim())}` : ""}`}
                            className="flex min-h-11 items-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground"
                            aria-label={`${c.messageContact}: ${contact.name}`}
                          >
                            <MessageCircle size={16} aria-hidden="true" />
                            {c.messageContact}
                          </a>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <label
              className="mt-4 block text-sm font-medium text-foreground"
              htmlFor="recovery-plan-contact"
            >
              {c.homeContact}
              <span className="mt-1 block text-xs font-normal leading-relaxed text-muted-foreground">
                {c.homeContactBody}
              </span>
            </label>
            <select
              id="recovery-plan-contact"
              aria-label={c.homeContact}
              value={pinnedContactId ?? ""}
              onChange={(event) => {
                setPinnedContactId(event.target.value || null);
                setStatus("idle");
              }}
              className="mt-2 min-h-12 w-full rounded-2xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15"
            >
              <option value="">{c.noContact}</option>
              {emergencyContacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.name}
                  {contact.relationship ? ` — ${contact.relationship}` : ""}
                </option>
              ))}
            </select>
            <Link
              href="/settings"
              className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-primary"
            >
              {c.addContact}
            </Link>
          </PlanSection>

          <PlanSection title={c.messageTitle} body={c.messageBody}>
            <textarea
              aria-label={c.messageTitle}
              value={message}
              onChange={(event) => {
                setMessage(event.target.value);
                setStatus("idle");
              }}
              placeholder={c.messagePlaceholder}
              maxLength={1000}
              className={`${inputClass} min-h-24`}
            />
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  void handleCopy();
                }}
                disabled={!message.trim()}
                className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-3 text-sm font-semibold text-foreground disabled:opacity-45"
              >
                {copied ? (
                  <Check size={18} className="text-primary" />
                ) : (
                  <Copy size={18} />
                )}
                {copied ? c.copied : c.copy}
              </button>
              {selectedContact?.phone && message.trim() ? (
                <a
                  href={`sms:${selectedContact.phone}?&body=${encodeURIComponent(message.trim())}`}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-3 text-center text-sm font-semibold text-primary-foreground"
                >
                  <MessageCircle size={18} />
                  {c.textContact}
                </a>
              ) : (
                <p className="flex min-h-12 items-center rounded-2xl border border-dashed border-border px-3 text-xs leading-relaxed text-muted-foreground">
                  {c.textUnavailable}
                </p>
              )}
            </div>
          </PlanSection>

          <PlanSection title={c.nextTitle} body={c.nextBody}>
            <textarea
              aria-label={c.nextTitle}
              value={next24Hours}
              onChange={(event) => {
                setNext24Hours(event.target.value);
                setStatus("idle");
              }}
              placeholder={c.nextPlaceholder}
              maxLength={12000}
              className={inputClass}
            />
            <p className="mt-2 text-[11px] text-muted-foreground">
              {c.onePerLine}
            </p>
          </PlanSection>

          <section className="rounded-3xl border border-amber-500/35 bg-amber-500/8 p-4">
            <div className="flex items-start gap-3">
              <ShieldAlert
                size={20}
                className="mt-0.5 shrink-0 text-amber-500"
                aria-hidden="true"
              />
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  {c.caveatTitle}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {c.caveatBody}
                </p>
              </div>
            </div>
          </section>

          {recoveryPlan.updatedAt && (
            <p className="px-1 text-center text-[11px] text-muted-foreground">
              {c.updated}:{" "}
              {new Intl.DateTimeFormat(language === "nl" ? "nl-NL" : "en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(recoveryPlan.updatedAt)}
            </p>
          )}

          <button
            type="button"
            onClick={() => {
              void handleSave();
            }}
            disabled={loading || saving}
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/15 transition-transform active:scale-[0.98] disabled:opacity-55"
          >
            {status === "saved" ? <Check size={19} /> : <Save size={19} />}
            {saving ? c.saving : status === "saved" ? c.saved : c.save}
          </button>

          {prevention.revisions.length > 0 && (
            <details className="rounded-2xl border border-border p-4">
              <summary className="min-h-11 cursor-pointer font-medium">
                {language === "nl"
                  ? "Eerdere planversies"
                  : "Earlier plan versions"}{" "}
                ({prevention.revisions.length})
              </summary>
              <p className="text-xs text-muted-foreground">
                {language === "nl"
                  ? "Versies blijven lokaal en gaan mee in een volledige back-up. Verwijderen wist de gekozen versie bij de volgende planopslag."
                  : "Versions stay local and are included in a full backup. Removing deletes the selected version when you next save the plan."}
              </p>
              {[...prevention.revisions].reverse().map((revision, index) => (
                <details
                  key={`${revision.savedAt}-${index}`}
                  className="mt-3 border-t border-border pt-3"
                >
                  <summary className="min-h-11 cursor-pointer text-sm">
                    {language === "nl" ? "Versie" : "Version"}{" "}
                    {revision.revision} ·{" "}
                    {new Date(revision.savedAt).toLocaleString(language)}
                  </summary>
                  <p className="whitespace-pre-wrap text-sm">
                    {revision.changeReason}
                  </p>
                  <PlanVersionView
                    content={revision.content}
                    onRestore={(previous) =>
                      draft.setValue((current) => ({
                        ...current,
                        warningSigns: previous.warningSigns.join("\n"),
                        reasons: previous.reasonsForRecovery.join("\n"),
                        situations: previous.situationsToAvoid.join("\n"),
                        message: previous.callMessage,
                        next24Hours: previous.next24Hours.join("\n"),
                        trustedContactIds: previous.trustedContactIds,
                        prevention: {
                          ...normalizePreventionPlan(previous.prevention),
                          revisions: current.prevention.revisions,
                          revision: current.prevention.revision,
                        },
                      }))
                    }
                  />
                  <button
                    type="button"
                    className="min-h-11 text-sm underline"
                    onClick={() =>
                      fieldSetter("prevention")({
                        ...prevention,
                        revisions: prevention.revisions.filter(
                          (item) => item !== revision,
                        ),
                      })
                    }
                  >
                    {language === "nl"
                      ? "Deze eerdere versie verwijderen"
                      : "Remove this earlier version"}
                  </button>
                </details>
              ))}
            </details>
          )}
        </fieldset>
      </div>
    </div>
  );
}
