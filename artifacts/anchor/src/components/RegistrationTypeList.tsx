import { Link } from "wouter";
import { useStore } from "@/hooks/useStore";
import { useT } from "@/hooks/useTranslation";
import { CATEGORY_META } from "@/lib/constants";

type RegistrationType = "trek" | "craving" | "boredom" | "anxiety" | "relapse";

type RegistrationTypeListProps = {
  onSelect?: () => void;
};

export function RegistrationTypeList({ onSelect }: RegistrationTypeListProps) {
  const { cravingLogs, relapseLogs, anxietyLogs, boredomLogs } = useStore();
  const { t } = useT();

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

  return (
    <div className="flex flex-col gap-3">
      {registrations.map((reg, i) => {
        const meta = CATEGORY_META[reg.type];
        const lastText = formatLastLog(reg.lastLog);
        return (
          <Link key={reg.to} href={reg.to} asChild>
            <a
              className="block animate-fade-up focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              style={{ animationDelay: `${i * 0.03}s` }}
              onClick={onSelect}
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
            </a>
          </Link>
        );
      })}
    </div>
  );
}
