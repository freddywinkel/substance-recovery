import { useState } from "react";
import { useLocation } from "wouter";
import { useStore } from "@/hooks/useStore";
import { useT } from "@/hooks/useTranslation";
import { CATEGORY_META } from "@/lib/constants";
import { useActiveRegistration } from "@/contexts/ActiveRegistrationContext";

type RegistrationType = "trek" | "craving" | "boredom" | "anxiety" | "relapse";

type RegistrationTypeListProps = {
  onSelect?: () => void;
};

export function RegistrationTypeList({ onSelect }: RegistrationTypeListProps) {
  const { cravingLogs, relapseLogs, anxietyLogs, boredomLogs } = useStore();
  const { t } = useT();
  const regSession = useActiveRegistration();
  const [, navigate] = useLocation();
  const [pendingSelection, setPendingSelection] = useState<{
    to: string;
    type: RegistrationType;
    label: string;
  } | null>(null);
  const [switching, setSwitching] = useState(false);

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

  const lastActiveCraving = cravingLogs.find((log) => log.cravingType === "active");
  const lastPassiveCraving = cravingLogs.find((log) => log.cravingType !== "active");
  const lastRelapse = relapseLogs[0];
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
      lastLog: lastActiveCraving?.timestamp,
    },
    {
      to: "/craving",
      type: "craving",
      label: t("registrations.craving.title"),
      sub: t("registrations.craving.sub"),
      lastLog: lastPassiveCraving?.timestamp,
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
            onClick={() => setPendingSelection(null)}
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
      {registrations.map((reg, i) => {
        const meta = CATEGORY_META[reg.type];
        const lastText = formatLastLog(reg.lastLog);
        return (
          <button
              type="button"
              key={reg.to}
              onClick={() => { void selectRegistration(reg); }}
              className="block w-full animate-fade-up text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              style={{ animationDelay: `${i * 0.03}s` }}
            >
              <div className="group min-h-[112px] rounded-[1.5rem] border border-border/50 bg-card/70 p-4 shadow-lg shadow-black/10 transition-all duration-300 hover:bg-card/85 active:scale-[0.98] flex items-center gap-4">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${meta.bg} ${meta.color} ring-1 ${meta.ring} ${meta.ringHover} transition-all`}>
                  <meta.icon size={22} strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm leading-tight tracking-normal">
                    {reg.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                    {reg.sub}
                  </p>
                  {lastText && (
                    <p className="text-[10px] text-muted-foreground/60 mt-1">
                      {lastText}
                    </p>
                  )}
                </div>
              </div>
          </button>
        );
      })}
    </div>
  );
}
