import { useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useStore } from "@/hooks/useStore";
import { useT } from "@/hooks/useT";
import { useActiveRegistration } from "@/contexts/ActiveRegistrationContext";
import {
  Zap, AlertTriangle, Brain, Coffee,
  Flame, TrendingUp, CalendarCheck, RotateCcw,
} from "lucide-react";

const RESUME_LABEL_KEYS: Record<string, string> = {
  craving: "home.craving.title",
  trek: "home.trek.title",
  anxiety: "home.anxiety_title",
  boredom: "home.boredom_title",
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

  return {
    totalDays,
    currentStreakDays,
    hasRelapse: !!relapseAfterStart,
    startDate: sobrietyStartDate,
  };
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
  const { cravingLogs, relapseLogs, anxietyLogs, boredomLogs, sobrietyStartDate, loading } = useStore();
  const { t, language } = useT();
  const { session, clearSession } = useActiveRegistration();
  const [, navigate] = useLocation();
  const lastCraving = cravingLogs[0];

  const sobriety = useMemo(
    () => computeSobrietyStats(sobrietyStartDate, relapseLogs),
    [sobrietyStartDate, relapseLogs],
  );

  const timeGreeting = () => {
    const h = new Date().getHours();
    if (h < 5) return t("home.greeting.night");
    if (h < 12) return t("home.greeting.morning");
    if (h < 17) return t("home.greeting.afternoon");
    if (h < 21) return t("home.greeting.evening");
    return t("home.greeting.late");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-background">
        <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-background" style={{ minHeight: "100dvh" }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <header
        className="px-5 pt-5 pb-4"
        style={{ paddingTop: "calc(1.25rem + env(safe-area-inset-top, 0px))" }}
      >
        <p className="text-[11px] text-muted-foreground uppercase tracking-widest mb-0.5">Substance Recovery</p>
        <h1 className="text-2xl font-semibold text-foreground leading-snug">{timeGreeting()}</h1>
        <p className="text-muted-foreground text-sm mt-0.5">{t("home.private")}</p>
      </header>

      <div className="flex-1 overflow-y-auto scroll-smooth-ios px-4 flex flex-col gap-4 pb-safe">

        {/* ── Resume in-progress check-in ─────────────────── */}
        {session && !session.pendingReturn && (
          <section aria-label="Resume check-in" className="animate-fade-up">
            <div className="bg-primary/10 border border-primary/30 rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-primary/20 w-10 h-10 flex items-center justify-center text-primary shrink-0">
                  <RotateCcw size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm leading-tight">{t("resume.card_title")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                    {t(RESUME_LABEL_KEYS[session.type] ?? "home.craving.title")}
                    {session.stepCount
                      ? ` · ${t("resume.step_progress")
                          .replace("{current}", String(session.stepIndex ?? 1))
                          .replace("{total}", String(session.stepCount))}`
                      : ""}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => navigate(session.route)}
                  className="flex-1 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold active:scale-95 transition-transform touch-target"
                >
                  {t("common.continue")}
                </button>
                <button
                  onClick={() => clearSession()}
                  className="px-4 border border-border rounded-xl py-2.5 text-sm font-medium text-muted-foreground active:scale-95 transition-transform touch-target"
                >
                  {t("resume.discard")}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ── Sobriety streak hero ────────────────────────── */}
        {sobriety ? (
          <section aria-label="Sobriety streak" className="animate-fade-up">
            <div className="bg-primary/8 border border-primary/20 rounded-2xl p-5 flex flex-col gap-4">

              {/* Current streak */}
              <div className="flex items-end gap-3">
                <div className="flex items-center gap-2 shrink-0">
                  <CalendarCheck size={22} className="text-primary" />
                </div>
                <div>
                  <p className="text-5xl font-bold text-foreground tabular-nums leading-none">
                    {sobriety.currentStreakDays}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {sobriety.currentStreakDays === 1 ? t("home.day") : t("home.days")} {t("home.sober")}
                  </p>
                </div>
              </div>

              <p className="text-sm text-foreground/70 leading-relaxed -mt-1">
                {milestoneLabel(sobriety.currentStreakDays, t)}
              </p>

              {/* Total days if different from current streak */}
              {sobriety.hasRelapse && (
                <div className="border-t border-primary/15 pt-3 flex items-center gap-3">
                  <TrendingUp size={15} className="text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">{sobriety.totalDays}</span>
                      {" "}{t("home.total_days")}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                      {t("home.since")} {new Date(sobriety.startDate + "T00:00:00").toLocaleDateString(language === "nl" ? "nl-NL" : undefined, {
                        month: "long", day: "numeric", year: "numeric",
                      })}
                    </p>
                  </div>
                </div>
              )}

              {!sobriety.hasRelapse && (
                <p className="text-[10px] text-muted-foreground/60 -mt-2">
                  {t("home.since")} {new Date(sobriety.startDate + "T00:00:00").toLocaleDateString(language === "nl" ? "nl-NL" : undefined, {
                    month: "long", day: "numeric", year: "numeric",
                  })}
                </p>
              )}
            </div>
          </section>
        ) : (
          <section aria-label="Sobriety streak" className="animate-fade-up">
            <Link href="/settings" asChild>
              <a className="block bg-card border border-dashed border-border rounded-2xl p-5 flex flex-col gap-2 hover:border-primary/40 transition-colors active:scale-[0.98]">
                <div className="flex items-center gap-2">
                  <CalendarCheck size={18} className="text-muted-foreground" />
                  <p className="text-sm font-semibold text-foreground">{t("home.set_date")}</p>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t("home.set_date_sub")}
                </p>
                <p className="text-xs text-primary mt-1">{t("home.open_settings")}</p>
              </a>
            </Link>
          </section>
        )}

        {/* ── All action cards ────────────────────────────── */}
        <section aria-label="Primary actions">
          <div className="grid grid-cols-2 gap-3" style={{ gridAutoRows: "160px" }}>

            {/* 1 — Trek (active desire) */}
            <Link href="/trek" asChild>
              <a className="block animate-fade-up">
                <div className="bg-primary/10 border border-primary/30 rounded-2xl p-4 h-full flex flex-col gap-2 hover:bg-primary/15 active:scale-[0.97] transition-all duration-200">
                  <div className="rounded-xl bg-primary/20 w-10 h-10 flex items-center justify-center text-primary">
                    <Flame size={20} strokeWidth={2} />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm leading-tight">{t("home.trek.title")}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{t("home.trek.sub")}</p>
                  </div>
                  {lastCraving && lastCraving.cravingType === "active" && (
                    <p className="text-[10px] text-muted-foreground/70 mt-auto pt-1 border-t border-border/50">
                      {t("home.craving_last")} {new Date(lastCraving.timestamp).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </a>
            </Link>

            {/* 2 — Craving (passive) — sky */}
            <Link href="/craving" asChild>
              <a className="block animate-fade-up" style={{ animationDelay: "0.02s" }}>
                <div className="bg-sky-500/10 border border-sky-500/30 rounded-2xl p-4 h-full flex flex-col gap-2 hover:bg-sky-500/15 active:scale-[0.97] transition-all duration-200">
                  <div className="rounded-xl bg-sky-500/20 w-10 h-10 flex items-center justify-center text-sky-500">
                    <Zap size={20} strokeWidth={2} />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm leading-tight">{t("home.craving.title")}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{t("home.craving.sub")}</p>
                  </div>
                  {lastCraving && lastCraving.cravingType !== "active" && (
                    <p className="text-[10px] text-muted-foreground/70 mt-auto pt-1 border-t border-border/50">
                      {t("home.craving_last")} {new Date(lastCraving.timestamp).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </a>
            </Link>

            {/* 3 — Boredom / restlessness — teal */}
            <Link href="/boredom" asChild>
              <a className="block animate-fade-up" style={{ animationDelay: "0.04s" }}>
                <div className="bg-teal-500/10 border border-teal-500/30 rounded-2xl p-4 h-full flex flex-col gap-2 hover:bg-teal-500/15 active:scale-[0.97] transition-all duration-200">
                  <div className="rounded-xl bg-teal-500/20 w-10 h-10 flex items-center justify-center text-teal-500">
                    <Coffee size={20} strokeWidth={1.8} />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm leading-tight">{t("home.boredom_title")}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{t("home.boredom_sub")}</p>
                  </div>
                  {boredomLogs.length > 0 && (
                    <p className="text-[10px] text-muted-foreground/70 mt-auto pt-1 border-t border-border/50">
                      {boredomLogs.length} {boredomLogs.length === 1 ? t("home.entry") : t("home.entries")}
                    </p>
                  )}
                </div>
              </a>
            </Link>

            {/* 4 — Anxiety — violet */}
            <Link href="/anxiety" asChild>
              <a className="block animate-fade-up" style={{ animationDelay: "0.06s" }}>
                <div className="bg-violet-500/10 border border-violet-500/30 rounded-2xl p-4 h-full flex flex-col gap-2 hover:bg-violet-500/15 active:scale-[0.97] transition-all duration-200">
                  <div className="rounded-xl bg-violet-500/20 w-10 h-10 flex items-center justify-center text-violet-500">
                    <Brain size={20} strokeWidth={1.8} />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm leading-tight">{t("home.anxiety_title")}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{t("home.anxiety_sub")}</p>
                  </div>
                  {anxietyLogs.length > 0 && (
                    <p className="text-[10px] text-muted-foreground/70 mt-auto pt-1 border-t border-border/50">
                      {anxietyLogs.length} {anxietyLogs.length === 1 ? t("home.entry") : t("home.entries")}
                    </p>
                  )}
                </div>
              </a>
            </Link>

            {/* 5 — Relapse log — rose */}
            <Link href="/relapse" asChild>
              <a className="block animate-fade-up" style={{ animationDelay: "0.10s" }}>
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 h-full flex flex-col gap-2 hover:bg-rose-500/15 active:scale-[0.97] transition-all duration-200">
                  <div className="rounded-xl bg-rose-500/20 w-10 h-10 flex items-center justify-center text-rose-500">
                    <AlertTriangle size={20} strokeWidth={1.8} />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm leading-tight">{t("home.relapse_title")}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{t("home.relapse_sub")}</p>
                  </div>
                  {relapseLogs.length > 0 && (
                    <p className="text-[10px] text-muted-foreground/70 mt-auto pt-1 border-t border-border/50">
                      {relapseLogs.length} {relapseLogs.length === 1 ? t("home.entry") : t("home.entries")}
                    </p>
                  )}
                </div>
              </a>
            </Link>

          </div>
        </section>

      </div>
    </div>
  );
}
