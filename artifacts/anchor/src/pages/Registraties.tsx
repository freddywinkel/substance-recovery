import { useStore } from "@/hooks/useStore";
import { useT } from "@/hooks/useTranslation";
import { PageHeader } from "@/components/PageHeader";
import { Link } from "wouter";
import { RegistrationHistory } from "@/components/RegistrationHistory";
import { CATEGORY_META } from "@/lib/constants";

export function Registraties() {
  const { cravingLogs, relapseLogs, anxietyLogs, boredomLogs, loading } = useStore();
  const { t } = useT();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const lastCraving = cravingLogs[0];
  const lastRelapse = relapseLogs[0];
  const lastAnxiety = anxietyLogs[0];
  const lastBoredom = boredomLogs[0];

  const registrations = [
    {
      to: "/trek",
      type: "trek" as const,
      label: t("registrations.trek.title"),
      sub: t("registrations.trek.sub"),
      lastLog: lastCraving?.cravingType === "active" ? lastCraving.timestamp : undefined,
    },
    {
      to: "/craving",
      type: "craving" as const,
      label: t("registrations.craving.title"),
      sub: t("registrations.craving.sub"),
      lastLog: lastCraving && lastCraving.cravingType !== "active" ? lastCraving.timestamp : undefined,
    },
    {
      to: "/boredom",
      type: "boredom" as const,
      label: t("registrations.boredom.title"),
      sub: t("registrations.boredom.sub"),
      lastLog: lastBoredom?.timestamp,
    },
    {
      to: "/anxiety",
      type: "anxiety" as const,
      label: t("registrations.anxiety.title"),
      sub: t("registrations.anxiety.sub"),
      lastLog: lastAnxiety?.timestamp,
    },
    {
      to: "/relapse",
      type: "relapse" as const,
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

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title={t("registrations.title")} />

      <div className="flex-1 overflow-y-auto scroll-smooth-ios px-4 flex flex-col gap-3 pb-safe">

        <p className="text-sm text-muted-foreground leading-relaxed">
          {t("registrations.description")}
        </p>

        {registrations.map((reg, i) => {
          const meta = CATEGORY_META[reg.type];
          const lastText = formatLastLog(reg.lastLog);
          return (
            <Link key={reg.to} href={reg.to} asChild>
              <a className="block animate-fade-up" style={{ animationDelay: `${i * 0.03}s` }}>
                <div className="group h-[120px] rounded-[1.5rem] border border-border/50 bg-card/50 backdrop-blur-xl p-4 shadow-lg shadow-black/10 transition-all duration-300 hover:bg-card/70 hover:-translate-y-0.5 active:scale-[0.98] flex items-center gap-4">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${meta.bg} ${meta.color} ring-1 ${meta.ring} ${meta.ringHover} transition-all`}>
                    <meta.icon size={22} strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-sm leading-tight tracking-tight">
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
              </a>
            </Link>
          );
        })}

        <section className="mt-4 flex flex-col gap-3" aria-labelledby="registration-history-heading">
          <div className="px-1">
            <h2 id="registration-history-heading" className="text-sm font-semibold text-foreground">
              {t("logs.title")}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              {t("logs.subtitle")}
            </p>
          </div>
          <RegistrationHistory />
        </section>
      </div>
    </div>
  );
}
