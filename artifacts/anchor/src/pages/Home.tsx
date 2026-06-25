import { useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useStore } from "@/hooks/useStore";
import { useT } from "@/hooks/useT";
import { useActiveRegistration } from "@/contexts/ActiveRegistrationContext";
import { useClerkAvailable } from "@/lib/clerk-safe";
import { getTodaysQuote } from "@/lib/recoveryQuotes";
import { hapticLight } from "@/lib/haptics";
import {
  Zap, AlertTriangle, Brain, Coffee,
  Flame, CalendarCheck, RotateCcw, User, LogIn,
  BookOpen, TrendingUp, PenLine,
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
  const clerkAvailable = useClerkAvailable();
  const lastCraving = cravingLogs[0];
  const todaysQuote = useMemo(() => getTodaysQuote(), []);

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
      <div className="flex items-center justify-center min-h-dvh">
        <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ minHeight: "100dvh" }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <header
        className="px-5 pt-5 pb-2 flex items-start justify-between"
        style={{ paddingTop: "calc(1.25rem + env(safe-area-inset-top, 0px))" }}
      >
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-white/35 uppercase tracking-widest mb-0.5">Anchor - Substance Recovery</p>
          <h1 className="text-2xl font-semibold text-white/92 leading-snug tracking-[-0.03em]">{timeGreeting()}</h1>
          <p className="text-white/50 text-sm mt-0.5">{t("home.private")}</p>
        </div>
        <button
          onClick={() => navigate("/settings")}
          className="shrink-0 mt-0.5 p-2 rounded-full text-white/40 hover:text-white/80 hover:bg-white/5 transition-colors touch-target"
          aria-label={t("nav.settings")}
        >
          {clerkAvailable ? <User size={20} strokeWidth={1.8} /> : <LogIn size={20} strokeWidth={1.8} />}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto scroll-smooth-ios px-4 flex flex-col gap-4 pb-safe">

        {/* ── Resume in-progress check-in ─────────────────── */}
        {session && !session.pendingReturn && (
          <section aria-label="Resume check-in" className="animate-fade-up">
            <div className="bg-primary/10 border border-primary/30 rounded-[1.5rem] p-4 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-primary/20 w-10 h-10 flex items-center justify-center text-primary shrink-0">
                  <RotateCcw size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white/92 text-sm leading-tight">{t("resume.card_title")}</p>
                  <p className="text-xs text-white/50 mt-0.5 leading-snug">
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
                  className="px-4 border border-white/10 rounded-xl py-2.5 text-sm font-medium text-white/50 active:scale-95 transition-transform touch-target"
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
            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#2A211C]/90 via-[#1B1817]/95 to-[#111111] p-6 shadow-2xl shadow-black/40">
              {/* Glow effects */}
              <div className="absolute -top-24 -right-20 h-48 w-48 rounded-full bg-emerald-400/10 blur-3xl" />
              <div className="absolute -bottom-24 -left-20 h-48 w-48 rounded-full bg-amber-300/10 blur-3xl" />

              <p className="relative text-sm font-medium text-white/55">{t("home.streak_label")}</p>

              <div className="relative mt-4 flex items-end gap-2">
                <span className="text-6xl font-semibold tracking-[-0.06em] text-white tabular-nums">
                  {sobriety.currentStreakDays}
                </span>
                <span className="mb-2 text-lg font-medium text-white/60">
                  {sobriety.currentStreakDays === 1 ? t("home.day") : t("home.days")}
                </span>
              </div>

              <p className="relative mt-4 max-w-[260px] text-sm leading-6 text-white/55">
                {milestoneLabel(sobriety.currentStreakDays, t)}
              </p>

              <button
                onClick={() => { hapticLight(); navigate("/journal"); }}
                className="relative mt-6 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black shadow-lg shadow-white/10 active:scale-[0.98] transition-transform touch-target"
              >
                {t("home.log_today")}
              </button>

              {/* Total days / since date */}
              {sobriety.hasRelapse ? (
                <div className="relative mt-4 border-t border-white/10 pt-3 flex items-center gap-3">
                  <TrendingUp size={15} className="text-white/40 shrink-0" />
                  <div>
                    <p className="text-xs text-white/50">
                      <span className="font-semibold text-white/80">{sobriety.totalDays}</span>
                      {" "}{t("home.total_days")}
                    </p>
                    <p className="text-[10px] text-white/30 mt-0.5">
                      {t("home.since")} {new Date(sobriety.startDate + "T00:00:00").toLocaleDateString(language === "nl" ? "nl-NL" : undefined, {
                        month: "long", day: "numeric", year: "numeric",
                      })}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="relative mt-4 text-[10px] text-white/30">
                  {t("home.since")} {new Date(sobriety.startDate + "T00:00:00").toLocaleDateString(language === "nl" ? "nl-NL" : undefined, {
                    month: "long", day: "numeric", year: "numeric",
                  })}
                </p>
              )}
            </div>

            {/* Status row */}
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <p className="text-[11px] font-medium text-white/35">{t("home.status.cravings")}</p>
                <p className="mt-1 text-sm font-semibold text-white/80">{cravingLogs.length} {t("home.status.logged")}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <p className="text-[11px] font-medium text-white/35">{t("home.status.checkins")}</p>
                <p className="mt-1 text-sm font-semibold text-white/80">{anxietyLogs.length + boredomLogs.length}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <p className="text-[11px] font-medium text-white/35">{t("home.status.journal")}</p>
                <p className="mt-1 text-sm font-semibold text-white/80">{t("home.status.write")}</p>
              </div>
            </div>
          </section>
        ) : (
          <section aria-label="Sobriety streak" className="animate-fade-up">
            <Link href="/settings" asChild>
              <a className="block rounded-[1.5rem] border border-dashed border-white/15 bg-white/[0.03] p-5 flex flex-col gap-2 hover:border-primary/40 transition-colors active:scale-[0.98]">
                <div className="flex items-center gap-2">
                  <CalendarCheck size={18} className="text-white/40" />
                  <p className="text-sm font-semibold text-white/80">{t("home.set_date")}</p>
                </div>
                <p className="text-xs text-white/40 leading-relaxed">
                  {t("home.set_date_sub")}
                </p>
                <p className="text-xs text-primary mt-1">{t("home.open_settings")}</p>
              </a>
            </Link>
          </section>
        )}

        {/* ── Daily recovery insight ──────────────────────── */}
        <section aria-label="Daily insight" className="animate-fade-up">
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-white/35">
              {t("home.insight.label")}
            </p>
            <p className="mt-2 text-sm leading-6 text-white/65">
              {todaysQuote}
            </p>
          </div>
        </section>

        {/* ── All action cards ────────────────────────────── */}
        <section aria-label="Primary actions">
          <div className="grid grid-cols-2 gap-3" style={{ gridAutoRows: "160px" }}>

            {/* 1 — Trek (active desire) */}
            <Link href="/trek" asChild>
              <a className="block animate-fade-up group">
                <div className="h-full rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-4 shadow-lg shadow-black/20 backdrop-blur-xl transition-all duration-300 hover:bg-white/[0.075] active:scale-[0.98] flex flex-col gap-2">
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-200 ring-1 ring-amber-300/10">
                    <Flame size={20} strokeWidth={2} />
                  </div>
                  <div>
                    <p className="font-semibold text-white/90 text-sm leading-tight tracking-tight">{t("home.trek.title")}</p>
                    <p className="text-xs text-white/40 mt-0.5 leading-snug">{t("home.trek.sub")}</p>
                  </div>
                  {lastCraving && lastCraving.cravingType === "active" && (
                    <p className="text-[10px] text-white/25 mt-auto pt-1 border-t border-white/5">
                      {t("home.craving_last")} {new Date(lastCraving.timestamp).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </a>
            </Link>

            {/* 2 — Craving (passive) */}
            <Link href="/craving" asChild>
              <a className="block animate-fade-up group" style={{ animationDelay: "0.02s" }}>
                <div className="h-full rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-4 shadow-lg shadow-black/20 backdrop-blur-xl transition-all duration-300 hover:bg-white/[0.075] active:scale-[0.98] flex flex-col gap-2">
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-400/10 text-teal-200 ring-1 ring-teal-300/10">
                    <Zap size={20} strokeWidth={2} />
                  </div>
                  <div>
                    <p className="font-semibold text-white/90 text-sm leading-tight tracking-tight">{t("home.craving.title")}</p>
                    <p className="text-xs text-white/40 mt-0.5 leading-snug">{t("home.craving.sub")}</p>
                  </div>
                  {lastCraving && lastCraving.cravingType !== "active" && (
                    <p className="text-[10px] text-white/25 mt-auto pt-1 border-t border-white/5">
                      {t("home.craving_last")} {new Date(lastCraving.timestamp).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </a>
            </Link>

            {/* 3 — Boredom / restlessness */}
            <Link href="/boredom" asChild>
              <a className="block animate-fade-up group" style={{ animationDelay: "0.04s" }}>
                <div className="h-full rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-4 shadow-lg shadow-black/20 backdrop-blur-xl transition-all duration-300 hover:bg-white/[0.075] active:scale-[0.98] flex flex-col gap-2">
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-200 ring-1 ring-emerald-300/10">
                    <Coffee size={20} strokeWidth={1.8} />
                  </div>
                  <div>
                    <p className="font-semibold text-white/90 text-sm leading-tight tracking-tight">{t("home.boredom_title")}</p>
                    <p className="text-xs text-white/40 mt-0.5 leading-snug">{t("home.boredom_sub")}</p>
                  </div>
                  {boredomLogs.length > 0 && (
                    <p className="text-[10px] text-white/25 mt-auto pt-1 border-t border-white/5">
                      {boredomLogs.length} {boredomLogs.length === 1 ? t("home.entry") : t("home.entries")}
                    </p>
                  )}
                </div>
              </a>
            </Link>

            {/* 4 — Anxiety */}
            <Link href="/anxiety" asChild>
              <a className="block animate-fade-up group" style={{ animationDelay: "0.06s" }}>
                <div className="h-full rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-4 shadow-lg shadow-black/20 backdrop-blur-xl transition-all duration-300 hover:bg-white/[0.075] active:scale-[0.98] flex flex-col gap-2">
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-400/10 text-violet-200 ring-1 ring-violet-300/10">
                    <Brain size={20} strokeWidth={1.8} />
                  </div>
                  <div>
                    <p className="font-semibold text-white/90 text-sm leading-tight tracking-tight">{t("home.anxiety_title")}</p>
                    <p className="text-xs text-white/40 mt-0.5 leading-snug">{t("home.anxiety_sub")}</p>
                  </div>
                  {anxietyLogs.length > 0 && (
                    <p className="text-[10px] text-white/25 mt-auto pt-1 border-t border-white/5">
                      {anxietyLogs.length} {anxietyLogs.length === 1 ? t("home.entry") : t("home.entries")}
                    </p>
                  )}
                </div>
              </a>
            </Link>

            {/* 5 — Relapse log */}
            <Link href="/relapse" asChild>
              <a className="block animate-fade-up group" style={{ animationDelay: "0.10s" }}>
                <div className="h-full rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-4 shadow-lg shadow-black/20 backdrop-blur-xl transition-all duration-300 hover:bg-white/[0.075] active:scale-[0.98] flex flex-col gap-2">
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-400/10 text-rose-200 ring-1 ring-rose-300/10">
                    <AlertTriangle size={20} strokeWidth={1.8} />
                  </div>
                  <div>
                    <p className="font-semibold text-white/90 text-sm leading-tight tracking-tight">{t("home.relapse_title")}</p>
                    <p className="text-xs text-white/40 mt-0.5 leading-snug">{t("home.relapse_sub")}</p>
                  </div>
                  {relapseLogs.length > 0 && (
                    <p className="text-[10px] text-white/25 mt-auto pt-1 border-t border-white/5">
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
