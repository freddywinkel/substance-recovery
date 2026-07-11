import { useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useStore } from "@/hooks/useStore";
import { useT } from "@/hooks/useTranslation";
import { useActiveRegistration } from "@/contexts/ActiveRegistrationContext";
import { getTodaysQuote } from "@/lib/recoveryQuotes";
import { hapticLight } from "@/lib/haptics";
import { calculateRiskScore } from "@/lib/riskScore";
import { usePinnedTools } from "@/hooks/usePinnedTools";
import { useRegistrationLauncher } from "@/contexts/RegistrationLauncherContext";
import { buildImpactInsights } from "@/lib/impactInsights";
import {
  Wind, Eye, Droplets, Waves, Rewind, Heart, Shuffle,
  CalendarCheck, RotateCcw, Settings,
  TrendingUp, HeartPulse, Info,
} from "lucide-react";

const TOOL_META: Record<string, { icon: typeof Wind; labelKey: string; to: string }> = {
  "/tools/breathing": { icon: Wind, labelKey: "tools.breathing.title", to: "/tools/breathing" },
  "/tools/grounding": { icon: Eye, labelKey: "tools.grounding.title", to: "/tools/grounding" },
  "/tools/cold-water": { icon: Droplets, labelKey: "tools.cold.title", to: "/tools/cold-water" },
  "/tools/urge-surfing": { icon: Waves, labelKey: "tools.urge.title", to: "/tools/urge-surfing" },
  "/tools/tape": { icon: Rewind, labelKey: "tools.tape.title", to: "/tools/tape" },
  "/tools/self-compassion": { icon: Heart, labelKey: "tools.compassion.title", to: "/tools/self-compassion" },
  "/tools/distraction": { icon: Shuffle, labelKey: "tools.distraction.title", to: "/tools/distraction" },
};
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const RESUME_LABEL_KEYS: Record<string, string> = {
  craving: "home.craving.title",
  trek: "home.trek.title",
  anxiety: "home.anxiety_title",
  boredom: "home.boredom_title",
  relapse: "relapse.title",
};

function computeSobrietyStats(
  sobrietyStartDate: string | null,
  relapseLogs: { timestamp: number }[],
) {
  if (!sobrietyStartDate) return null;
  const startMs = new Date(sobrietyStartDate + "T00:00:00").getTime();
  const nowMs = Date.now();
  if (isNaN(startMs) || startMs > nowMs) return null;
  const msPerDay = 1000 * 60 * 60 * 24;
  const totalDays = Math.floor((nowMs - startMs) / msPerDay);
  const relapseAfterStart = relapseLogs
    .filter((r) => r.timestamp >= startMs)
    .sort((a, b) => b.timestamp - a.timestamp)[0];
  const currentStreakDays = relapseAfterStart
    ? Math.floor((nowMs - relapseAfterStart.timestamp) / msPerDay)
    : totalDays;
  return { totalDays, currentStreakDays, hasRelapse: !!relapseAfterStart, startDate: sobrietyStartDate };
}

function milestoneLabel(days: number, t: (key: string) => string): string {
  if (days >= 365 * 2) return t("home.milestone.years").replace("{n}", String(Math.floor(days / 365)));
  if (days >= 365) return t("home.milestone.1year");
  if (days >= 180) return t("home.milestone.6mo");
  if (days >= 90) return t("home.milestone.90d");
  if (days >= 30) return t("home.milestone.30d");
  if (days >= 14) return t("home.milestone.14d");
  if (days >= 7) return t("home.milestone.7d");
  if (days >= 1) return t("home.milestone.1d");
  return t("home.milestone.0d");
}

export function Home() {
  const { cravingLogs, relapseLogs, anxietyLogs, boredomLogs, journal, sobrietyStartDate, loading } = useStore();
  const { t, language } = useT();
  const { session, clearSession } = useActiveRegistration();
  const [, navigate] = useLocation();
  const { pinned } = usePinnedTools();
  const { openRegistrationLauncher } = useRegistrationLauncher();
  const todaysQuote = useMemo(() => getTodaysQuote(language), [language]);

  const sobriety = useMemo(() => computeSobrietyStats(sobrietyStartDate, relapseLogs), [sobrietyStartDate, relapseLogs]);

  const timeGreeting = () => {
    const h = new Date().getHours();
    if (h < 5) return t("home.greeting.night");
    if (h < 12) return t("home.greeting.morning");
    if (h < 17) return t("home.greeting.afternoon");
    if (h < 21) return t("home.greeting.evening");
    return t("home.greeting.late");
  };

  // Risk assessment
  const riskInfo = useMemo(() => {
    const result = calculateRiskScore({
      cravingLogs,
      relapseLogs,
      anxietyLogs,
      boredomLogs,
      journalEntries: journal,
    });
    if (result.level === "none") {
      return { ...result, text: t("home.risk.no_data") };
    }
    const days = [...cravingLogs, ...anxietyLogs, ...boredomLogs]
      .sort((a, b) => b.timestamp - a.timestamp)[0];
    const daysSince = days ? Math.floor((Date.now() - days.timestamp) / (1000 * 60 * 60 * 24)) : 0;

    if (result.level === "low") {
      return { ...result, text: t("home.risk.low").replace("{n}", String(daysSince)) };
    }
    if (result.level === "medium") {
      return { ...result, text: t("home.risk.medium").replace("{n}", String(daysSince)) };
    }
    return { ...result, text: t("home.risk.high").replace("{n}", String(daysSince)) };
  }, [cravingLogs, relapseLogs, anxietyLogs, boredomLogs, journal, t]);

  const topImpactInsight = useMemo(
    () =>
      buildImpactInsights(
        { cravingLogs, relapseLogs, anxietyLogs, boredomLogs },
        "30d",
      )[0] ?? null,
    [anxietyLogs, boredomLogs, cravingLogs, relapseLogs],
  );

  if (loading) {
    return (
      <div role="status" className="flex items-center justify-center min-h-dvh">
        <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <span className="sr-only">{t("common.loading")}</span>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">

      {/* Header */}
      <header className="px-5 pt-5 pb-2 flex items-start justify-between" style={{ paddingTop: "calc(1.25rem + env(safe-area-inset-top, 0px))" }}>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-muted-foreground uppercase tracking-widest mb-0.5">Anchor - Substance Recovery</p>
          <h1 className="text-2xl font-semibold text-foreground leading-snug tracking-[-0.03em]">{timeGreeting()}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{t("home.private")}</p>
        </div>
        <button onClick={() => navigate("/settings")} className="shrink-0 mt-0.5 p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors touch-target focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50" aria-label={t("nav.settings")}>
          <Settings size={20} strokeWidth={1.8} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto scroll-smooth-ios px-4 flex flex-col gap-4 pb-safe">

        {/* Resume in-progress log entry */}
        {session && !session.pendingReturn && (
          <section aria-label={t("resume.card_title")} className="animate-fade-up">
            <div className="bg-primary/10 border border-primary/30 rounded-[1.5rem] p-4 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-primary/20 w-10 h-10 flex items-center justify-center text-primary shrink-0">
                  <RotateCcw size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm leading-tight">{t("resume.card_title")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                    {t(RESUME_LABEL_KEYS[session.type] ?? "home.craving.title")}
                    {session.stepCount ? ` · ${t("resume.step_progress").replace("{current}", String(session.stepIndex ?? 1)).replace("{total}", String(session.stepCount))}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => navigate(session.route)} className="flex-1 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold active:scale-95 transition-transform touch-target">{t("common.continue")}</button>
                <button onClick={() => clearSession()} className="px-4 border border-border rounded-xl py-2.5 text-sm font-medium text-muted-foreground active:scale-95 transition-transform touch-target">{t("resume.discard")}</button>
              </div>
            </div>
          </section>
        )}

        {/* Sobriety streak hero */}
        {sobriety ? (
          <section aria-label={t("home.streak_label")} className="animate-fade-up">
            <div className="relative overflow-hidden rounded-[2rem] border border-border/50 bg-gradient-to-br from-card/90 via-card/80 to-card/60 p-6 shadow-xl shadow-black/20">
              <div className="absolute -top-24 -right-20 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
              <div className="absolute -bottom-24 -left-20 h-48 w-48 rounded-full bg-emerald-400/10 blur-3xl" />

              <p className="relative text-sm font-medium text-muted-foreground">{t("home.streak_label")}</p>
              <div className="relative mt-4 flex items-end gap-2">
                <span className="text-6xl font-semibold tracking-[-0.06em] text-foreground tabular-nums">{sobriety.currentStreakDays}</span>
                <span className="mb-2 text-lg font-medium text-muted-foreground">{sobriety.currentStreakDays === 1 ? t("home.day") : t("home.days")}</span>
              </div>
              <p className="relative mt-4 max-w-[260px] text-sm leading-6 text-muted-foreground">{milestoneLabel(sobriety.currentStreakDays, t)}</p>

              <button onClick={() => { hapticLight(); openRegistrationLauncher(); }} className="relative mt-6 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 active:scale-[0.98] transition-transform touch-target">
                {t("home.log_today")}
              </button>

              {sobriety.hasRelapse ? (
                <div className="relative mt-4 border-t border-border/50 pt-3 flex items-center gap-3">
                  <TrendingUp size={15} className="text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">{sobriety.totalDays}</span> {" "}{t("home.total_days")}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">{t("home.since")} {new Date(sobriety.startDate + "T00:00:00").toLocaleDateString(language === "nl" ? "nl-NL" : "en-GB", { month: "long", day: "numeric", year: "numeric" })}</p>
                  </div>
                </div>
              ) : (
                <p className="relative mt-4 text-[10px] text-muted-foreground/60">{t("home.since")} {new Date(sobriety.startDate + "T00:00:00").toLocaleDateString(language === "nl" ? "nl-NL" : "en-GB", { month: "long", day: "numeric", year: "numeric" })}</p>
              )}
            </div>

            {/* Status row */}
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-border/50 bg-card/50 p-3">
                <p className="text-[11px] font-medium text-muted-foreground">{t("home.status.cravings")}</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{cravingLogs.length} {t("home.status.logged")}</p>
              </div>
              <div className="rounded-2xl border border-border/50 bg-card/50 p-3">
                <p className="text-[11px] font-medium text-muted-foreground">{t("home.status.checkins")}</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{anxietyLogs.length + boredomLogs.length}</p>
              </div>
              <div className="rounded-2xl border border-border/50 bg-card/50 p-3">
                <p className="text-[11px] font-medium text-muted-foreground">{t("home.status.journal")}</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{t("home.status.write")}</p>
              </div>
            </div>
          </section>
        ) : (
          <section aria-label={t("home.streak_label")} className="animate-fade-up">
            <Link href="/settings" asChild>
              <a className="block rounded-[1.5rem] border border-dashed border-border bg-card/30 p-5 flex flex-col gap-2 hover:border-primary/40 transition-colors active:scale-[0.98]">
                <div className="flex items-center gap-2">
                  <CalendarCheck size={18} className="text-muted-foreground" />
                  <p className="text-sm font-semibold text-foreground">{t("home.set_date")}</p>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{t("home.set_date_sub")}</p>
                <p className="text-xs text-primary mt-1">{t("home.open_settings")}</p>
              </a>
            </Link>
          </section>
        )}

        {/* Risk overview */}
        <section aria-label={t("home.risk.label")} className="animate-fade-up">
          <div className={`rounded-[1.5rem] border p-4 ${riskInfo.level === "high" ? "border-rose-300/30 bg-rose-400/5" : riskInfo.level === "medium" ? "border-amber-300/30 bg-amber-400/5" : "border-border/50 bg-card/50"}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HeartPulse size={16} className={riskInfo.level === "high" ? "text-rose-300" : riskInfo.level === "medium" ? "text-amber-300" : "text-emerald-300"} />
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{t("home.risk.label")}</p>
              </div>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="rounded-full p-1 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50" aria-label={t("home.risk.tooltip_aria")}>
                      <Info size={14} strokeWidth={2} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[240px] text-center">
                    {t("home.risk.tooltip")}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {riskInfo.level === "none" ? (
              <p className="mt-2 text-sm text-foreground/80">{riskInfo.text}</p>
            ) : (
              <div className="mt-3">
                <div className="flex items-baseline gap-2">
                  <span className={`text-2xl font-semibold tabular-nums ${riskInfo.level === "high" ? "text-rose-300" : riskInfo.level === "medium" ? "text-amber-300" : "text-emerald-300"}`}>
                    {t(riskInfo.label)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t("home.risk.score")}: {riskInfo.score}/100
                  </span>
                </div>
                {riskInfo.factors.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-0.5">
                    {riskInfo.factors.map((f, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                        <span className="mt-1.5 h-1 w-1 rounded-full bg-muted-foreground/50 shrink-0" />
                        {t(f)}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-sm text-foreground/80">{riskInfo.text}</p>
              </div>
            )}

            {riskInfo.level !== "none" && (
              <button onClick={openRegistrationLauncher} className="mt-3 text-xs font-medium text-primary hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded">
                {t("home.risk.action")} →
              </button>
            )}
          </div>
        </section>

        {topImpactInsight && (
          <section aria-label={t("home.top_insight.label")} className="animate-fade-up">
            <Link href="/insights" asChild>
              <a className="block rounded-[1.5rem] border border-border/50 bg-card/50 p-4 transition-all duration-300 hover:bg-card/70 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      {t("home.top_insight.label")}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      {t(topImpactInsight.labelKey)}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {t("home.top_insight.sub").replace("{n}", String(topImpactInsight.count))}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-2xl font-semibold tabular-nums ${topImpactInsight.tone}`}>
                      {topImpactInsight.score.toFixed(1)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {t("insights.impact.score")}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-xs font-medium text-primary">
                  {t("home.top_insight.open")} →
                </p>
              </a>
            </Link>
          </section>
        )}

        {/* Daily recovery insight */}
        <section aria-label={t("home.insight.label")} className="animate-fade-up">
          <div className="rounded-[1.5rem] border border-border/50 bg-card/50 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{t("home.insight.label")}</p>
            <p className="mt-2 text-sm leading-6 text-foreground/70">{todaysQuote}</p>
          </div>
        </section>

        {/* Pinned tools */}
        {pinned.length > 0 && (
          <section aria-label={t("tools.pinned.title")} className="animate-fade-up">
            <p className="text-xs text-muted-foreground uppercase tracking-widest px-1 mb-3">{t("tools.pinned.title")}</p>
            <div className="grid grid-cols-2 gap-3">
              {pinned.map((id) => {
                const meta = TOOL_META[id];
                if (!meta) return null;
                const Icon = meta.icon;
                return (
                  <Link key={id} href={meta.to} asChild>
                    <a className="block">
                      <div className="rounded-[1.5rem] border border-border/50 bg-card/50 p-4 flex items-center gap-3 transition-all duration-300 hover:bg-card/70 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
                        <Icon size={18} strokeWidth={1.8} className="text-primary shrink-0" />
                        <span className="text-sm font-medium text-foreground leading-tight">{t(meta.labelKey)}</span>
                      </div>
                    </a>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
