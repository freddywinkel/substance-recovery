import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useStore } from "@/hooks/useStore";
import { useT } from "@/hooks/useTranslation";
import { useActiveRegistration } from "@/contexts/ActiveRegistrationContext";
import { getTodaysQuote } from "@/lib/recoveryQuotes";
import { hapticLight } from "@/lib/haptics";
import { usePinnedTools } from "@/hooks/usePinnedTools";
import { useRegistrationLauncher } from "@/contexts/RegistrationLauncherContext";
import { buildImpactInsights } from "@/lib/impactInsights";
import {
  completedStatusEntries,
  computeCompletedRegistrationActivity,
  computeSobrietyStats,
} from "@/lib/analytics";
import { CigaretteCounter } from "@/components/CigaretteCounter";
import { CigaretteDayDrawer } from "@/components/CigaretteDayDrawer";
import {
  Wind, Eye, Droplets, Waves, Rewind, Heart, Shuffle,
  CalendarCheck, RotateCcw, Settings,
  TrendingUp,
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

const RESUME_LABEL_KEYS: Record<string, string> = {
  craving: "home.craving.title",
  trek: "home.trek.title",
  anxiety: "home.anxiety_title",
  boredom: "home.boredom_title",
  relapse: "relapse.title",
};

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
  const { cravingLogs, relapseLogs, anxietyLogs, boredomLogs, sobrietyStartDate, loading, cigaretteLogs, logCigarette, updateCigarette, removeCigarette } = useStore();
  const { t, language } = useT();
  const { session, discardSession } = useActiveRegistration();
  const [, navigate] = useLocation();
  const { pinned } = usePinnedTools();
  const { openRegistrationLauncher } = useRegistrationLauncher();
  const todaysQuote = useMemo(() => getTodaysQuote(language), [language]);
  const [cigaretteDrawerOpen, setCigaretteDrawerOpen] = useState(false);
  const completedCravingLogs = useMemo(() => completedStatusEntries(cravingLogs), [cravingLogs]);
  const completedRelapseLogs = useMemo(() => completedStatusEntries(relapseLogs), [relapseLogs]);

  const sobriety = useMemo(
    () => computeSobrietyStats(sobrietyStartDate, completedRelapseLogs),
    [completedRelapseLogs, sobrietyStartDate],
  );

  const timeGreeting = () => {
    const h = new Date().getHours();
    if (h < 5) return t("home.greeting.night");
    if (h < 12) return t("home.greeting.morning");
    if (h < 17) return t("home.greeting.afternoon");
    if (h < 21) return t("home.greeting.evening");
    return t("home.greeting.late");
  };

  const registrationActivity = useMemo(() => computeCompletedRegistrationActivity({
    cravingLogs: completedCravingLogs,
    relapseLogs: completedRelapseLogs,
    anxietyLogs,
    boredomLogs,
  }), [anxietyLogs, boredomLogs, completedCravingLogs, completedRelapseLogs]);

  const topImpactInsight = useMemo(
    () =>
      buildImpactInsights(
        {
          cravingLogs: completedCravingLogs,
          relapseLogs: completedRelapseLogs,
          anxietyLogs,
          boredomLogs,
        },
        "30d",
      )[0] ?? null,
    [anxietyLogs, boredomLogs, completedCravingLogs, completedRelapseLogs],
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
        {session && (
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
                <button onClick={() => { void discardSession({ restoreSuspended: true }); }} className="px-4 border border-border rounded-xl py-2.5 text-sm font-medium text-muted-foreground active:scale-95 transition-transform touch-target">{t("resume.discard")}</button>
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
                <p className="mt-1 text-sm font-semibold text-foreground">{completedCravingLogs.length} {t("home.status.logged")}</p>
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

        {/* Cigarette counter */}
        <CigaretteCounter logs={cigaretteLogs} onLog={() => logCigarette({ timestamp: Date.now() })} onOpenDrawer={() => setCigaretteDrawerOpen(true)} />

        <CigaretteDayDrawer
          logs={cigaretteLogs}
          dayStart={new Date().setHours(0, 0, 0, 0)}
          open={cigaretteDrawerOpen}
          onOpenChange={setCigaretteDrawerOpen}
          onUpdate={updateCigarette}
          onRemove={removeCigarette}
          onAdd={logCigarette}
        />

        {/* Neutral completed-registration activity */}
        <section aria-label={t("home.activity.label")} className="animate-fade-up">
          <div className="rounded-[1.5rem] border border-border/50 bg-card/50 p-4">
            <div className="flex items-center gap-2">
              <CalendarCheck size={16} className="text-muted-foreground" />
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {t("home.activity.label")}
              </p>
            </div>
            {registrationActivity.completedCount === 0 ? (
              <p className="mt-2 text-sm text-foreground/80">{t("home.activity.empty")}</p>
            ) : (
              <div className="mt-3">
                <p className="text-2xl font-semibold text-foreground tabular-nums">
                  {registrationActivity.completedCount}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("home.activity.completed_count")}
                </p>
                <p className="mt-2 text-sm text-foreground/80">
                  {registrationActivity.daysSinceLastCompleted === 0
                    ? t("home.activity.last_today")
                    : t("home.activity.last_days").replace(
                      "{n}",
                      String(registrationActivity.daysSinceLastCompleted),
                    )}
                </p>
              </div>
            )}
            <button onClick={openRegistrationLauncher} className="mt-3 text-xs font-medium text-primary hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded">
              {t("home.activity.action")} →
            </button>
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
