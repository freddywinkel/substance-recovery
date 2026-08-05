import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { ChevronDown, ChevronUp, Compass, Zap } from "lucide-react";
import { HelpMeChoose } from "@/components/HelpMeChoose";
import { useStore } from "@/hooks/useStore";
import { useT } from "@/hooks/useTranslation";
import { CATEGORY_META } from "@/lib/constants";
import { useActiveRegistration } from "@/contexts/ActiveRegistrationContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRecoveryFeatures } from "@/contexts/RecoveryFeaturesContext";
import { cravingRegistrationKind } from "@/lib/canonicalRegistration";
import { logicalTimestamp } from "@/lib/registrationIds";
import { completedStatusEntries } from "@/lib/analytics";
import type { RegistrationType } from "@/lib/recoveryFeatures";

const LOCAL_COPY = {
  en: {
    quickTitle: "Quick registration",
    quickBody: "About 20 seconds: type, intensity, immediate safety and your next action. Reflect in more detail later.",
    chooserTitle: "Help me choose",
    chooserBody: "Not sure which registration fits? Answer one simple question.",
    fullTitle: "Full registration",
    visibleNote: "Your preferred registration types are shown below.",
    showAll: "Show all five types",
    showPreferred: "Show my preferred types",
  },
  nl: {
    quickTitle: "Snelle registratie",
    quickBody: "Ongeveer 20 seconden: type, intensiteit, directe veiligheid en je volgende actie. Reflecteer later uitgebreider.",
    chooserTitle: "Help me kiezen",
    chooserBody: "Weet je niet welke registratie past? Beantwoord één eenvoudige vraag.",
    fullTitle: "Volledige registratie",
    visibleNote: "Je gekozen registratietypen staan hieronder.",
    showAll: "Alle vijf typen tonen",
    showPreferred: "Mijn gekozen typen tonen",
  },
} as const;

type RegistrationTypeListProps = {
  onSelect?: () => void;
};

export function RegistrationTypeList({ onSelect }: RegistrationTypeListProps) {
  const { cravingLogs, relapseLogs, anxietyLogs, boredomLogs } = useStore();
  const { t } = useT();
  const { language } = useLanguage();
  const c = LOCAL_COPY[language];
  const { homePreferences } = useRecoveryFeatures();
  const regSession = useActiveRegistration();
  const [, navigate] = useLocation();
  const [pendingSelection, setPendingSelection] = useState<{
    to: string;
    type: RegistrationType;
    label: string;
  } | null>(null);
  const [switching, setSwitching] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [showChooser, setShowChooser] = useState(false);
  const chooserTriggerRef = useRef<HTMLButtonElement>(null);
  const registrationTriggerRef = useRef<HTMLButtonElement | null>(null);

  const closeChooser = () => {
    setShowChooser(false);
    window.requestAnimationFrame(() => chooserTriggerRef.current?.focus());
  };

  const cancelDraftSwitch = () => {
    setPendingSelection(null);
    window.requestAnimationFrame(() => registrationTriggerRef.current?.focus());
  };

  const selectRegistration = async (next: { to: string; type: RegistrationType }) => {
    const active = regSession.session;
    if (active && active.type !== next.type) {
      // A completed record is already durable, so it does not need to be kept
      // as a resumable draft when another registration starts.
      if (active.savedLogId || active.step === "done") {
        try {
          await regSession.clearSession();
        } catch {
          return;
        }
      } else {
        const selected = registrations.find((registration) => registration.type === next.type);
        setPendingSelection({ ...next, label: selected?.label ?? next.type });
        return;
      }
    }
    onSelect?.();
    navigate(next.to);
  };

  const completedCravings = completedStatusEntries(cravingLogs);
  const completedRelapses = completedStatusEntries(relapseLogs);
  const lastActiveCraving = completedCravings.find((log) => cravingRegistrationKind(log) === "trek");
  const lastPassiveCraving = completedCravings.find((log) => cravingRegistrationKind(log) === "craving");
  const lastRelapse = completedRelapses[0];
  const lastAnxiety = anxietyLogs[0];
  const lastBoredom = boredomLogs[0];

  const registrations: Array<{
    to: string;
    type: RegistrationType;
    label: string;
    sub: string;
    lastLog?: number;
  }> = [
    {
      to: "/trek",
      type: "trek",
      label: t("registrations.trek.title"),
      sub: t("registrations.trek.sub"),
      lastLog: lastActiveCraving ? logicalTimestamp(lastActiveCraving) : undefined,
    },
    {
      to: "/craving",
      type: "craving",
      label: t("registrations.craving.title"),
      sub: t("registrations.craving.sub"),
      lastLog: lastPassiveCraving ? logicalTimestamp(lastPassiveCraving) : undefined,
    },
    {
      to: "/boredom",
      type: "boredom",
      label: t("registrations.boredom.title"),
      sub: t("registrations.boredom.sub"),
      lastLog: lastBoredom?.timestamp,
    },
    {
      to: "/anxiety",
      type: "anxiety",
      label: t("registrations.anxiety.title"),
      sub: t("registrations.anxiety.sub"),
      lastLog: lastAnxiety?.timestamp,
    },
    {
      to: "/relapse",
      type: "relapse",
      label: t("registrations.relapse.title"),
      sub: t("registrations.relapse.sub"),
      lastLog: lastRelapse?.timestamp,
    },
  ];

  const visibleRegistrations = showAll
    ? registrations
    : registrations.filter((registration) => !homePreferences.hiddenRegistrationTypes.includes(registration.type));
  const hasHiddenTypes = homePreferences.hiddenRegistrationTypes.length > 0;

  const chooseGuidedRegistration = (type: RegistrationType) => {
    const registration = registrations.find((item) => item.type === type);
    if (registration) void selectRegistration(registration);
  };

  const openQuickRegistration = () => {
    onSelect?.();
    navigate("/quick");
  };

  const formatLastLog = (ts: number | undefined) => {
    if (!ts) return undefined;
    const days = Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
    if (days === 0) return t("registrations.today");
    if (days === 1) return t("registrations.yesterday");
    return t("registrations.days_ago").replace("{n}", String(days));
  };

  const resolveDraftSwitch = async (choice: "resume" | "preserve" | "discard") => {
    const active = regSession.session;
    const next = pendingSelection;
    if (!next || switching) return;

    if (choice === "resume") {
      if (active) navigate(active.route);
      onSelect?.();
      return;
    }

    setSwitching(true);
    try {
      const persisted = choice === "preserve"
        ? await regSession.suspendSession()
        : await regSession.discardSession({ restoreSuspended: false });
      if (!persisted) return;
      onSelect?.();
      navigate(next.to);
    } finally {
      setSwitching(false);
    }
  };

  if (pendingSelection) {
    return (
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="registration-switch-title"
        aria-describedby="registration-switch-description"
        className="rounded-[1.5rem] border border-primary/30 bg-card p-4 shadow-xl"
      >
        <h2 id="registration-switch-title" className="text-base font-semibold text-foreground">
          {t("registration.switch_title")}
        </h2>
        <p id="registration-switch-description" className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {t("registration.switch_body").replace("{next}", pendingSelection.label)}
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <button
            autoFocus
            type="button"
            disabled={switching}
            onClick={() => { void resolveDraftSwitch("resume"); }}
            className="min-h-12 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {t("registration.switch_resume")}
          </button>
          <button
            type="button"
            disabled={switching}
            onClick={() => { void resolveDraftSwitch("preserve"); }}
            className="min-h-12 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm font-semibold text-foreground disabled:opacity-60"
          >
            {t("registration.switch_preserve")}
          </button>
          <button
            type="button"
            disabled={switching}
            onClick={() => { void resolveDraftSwitch("discard"); }}
            className="min-h-12 rounded-xl border border-border px-4 py-3 text-sm font-medium text-muted-foreground disabled:opacity-60"
          >
            {t("registration.switch_discard")}
          </button>
          <button
            type="button"
            disabled={switching}
            onClick={cancelDraftSwitch}
            className="min-h-11 px-4 py-2 text-sm font-medium text-muted-foreground disabled:opacity-60"
          >
            {t("common.cancel")}
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={openQuickRegistration}
        className="flex min-h-[88px] w-full items-center gap-3 rounded-3xl border border-primary/45 bg-primary/12 p-4 text-left shadow-lg shadow-primary/5 transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
          <Zap size={22} strokeWidth={2.2} aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-foreground">{c.quickTitle}</span>
          <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{c.quickBody}</span>
        </span>
      </button>

      {!showChooser && (
        <button
          ref={chooserTriggerRef}
          type="button"
          onClick={() => setShowChooser(true)}
          className="flex min-h-[76px] w-full items-center gap-3 rounded-3xl border border-border/70 bg-card/70 p-4 text-left transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/8 text-primary">
            <Compass size={21} strokeWidth={2} aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-foreground">{c.chooserTitle}</span>
            <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{c.chooserBody}</span>
          </span>
        </button>
      )}

      {showChooser ? (
        <HelpMeChoose
          onChoose={chooseGuidedRegistration}
          onCancel={closeChooser}
        />
      ) : (
        <>
          <div className="px-1 pt-1">
            <h3 className="text-sm font-semibold text-foreground">{c.fullTitle}</h3>
            {hasHiddenTypes && !showAll && (
              <p className="mt-1 text-xs text-muted-foreground">{c.visibleNote}</p>
            )}
          </div>
          {visibleRegistrations.map((reg, i) => {
            const meta = CATEGORY_META[reg.type];
            const lastText = formatLastLog(reg.lastLog);
            return (
              <button
                type="button"
                key={reg.to}
                onClick={(event) => {
                  registrationTriggerRef.current = event.currentTarget;
                  void selectRegistration(reg);
                }}
                className="block w-full animate-fade-up text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                style={{ animationDelay: `${i * 0.03}s` }}
              >
                <div className="group flex min-h-[112px] items-center gap-4 rounded-[1.5rem] border border-border/50 bg-card/70 p-4 shadow-lg shadow-black/10 transition-all duration-300 hover:bg-card/85 active:scale-[0.98]">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${meta.bg} ${meta.color} ring-1 ${meta.ring} ${meta.ringHover} transition-all`}>
                    <meta.icon size={22} strokeWidth={2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-tight tracking-normal text-foreground">
                      {reg.label}
                    </p>
                    <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                      {reg.sub}
                    </p>
                    {lastText && (
                      <p className="mt-1 text-[10px] text-muted-foreground/60">
                        {lastText}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
          {hasHiddenTypes && (
            <button
              type="button"
              onClick={() => setShowAll((current) => !current)}
              className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-background/60 px-4 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
            >
              {showAll ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
              {showAll ? c.showPreferred : c.showAll}
            </button>
          )}
        </>
      )}
    </div>
  );
}
