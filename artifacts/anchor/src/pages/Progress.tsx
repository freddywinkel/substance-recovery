import { useState, useMemo } from "react";
import { useStore } from "@/hooks/useStore";
import { useT } from "@/hooks/useT";
import { PageHeader } from "@/components/PageHeader";
import {
  Flame,
  CalendarCheck,
  Zap,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Shield,
  Heart,
  Wind,
  Brain,
} from "lucide-react";
import {
  filterByRange,
  computeCravingStats,
  computeRelapseStats,
  computeAnxietyStats,
  computeBoredomStats,
  computeWeeklyTrend,
  type TimeRange,
  type FreqItem,
  type WeeklyPoint,
} from "@/lib/analytics";
// ── Sobriety streak (mirrors Home.tsx) ───────────────────────
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

// ── Sub-components ────────────────────────────────────────────

function RangeFilter({
  value,
  onChange,
  opts,
}: {
  value: TimeRange;
  onChange: (r: TimeRange) => void;
  opts: { v: TimeRange; label: string }[];
}) {
  return (
    <div className="px-4 pt-2 pb-1 flex gap-1.5 bg-background">
      {opts.map(({ v, label }) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`flex-1 py-1.5 rounded-full text-xs font-medium transition-colors ${
            value === v
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function SectionHeading({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest whitespace-nowrap">
        {title}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-4 ${
        accent
          ? "bg-primary/10 border border-primary/25"
          : "bg-card border border-border"
      }`}
    >
      {icon && (
        <div className="flex items-center gap-1.5 mb-2">
          {icon}
          <span className="text-[11px] text-muted-foreground uppercase tracking-widest">
            {label}
          </span>
        </div>
      )}
      {!icon && (
        <p className="text-[11px] text-muted-foreground uppercase tracking-widest mb-2">
          {label}
        </p>
      )}
      <p className="text-3xl font-bold text-foreground tabular-nums leading-none">
        {value}
      </p>
      {sub && (
        <p className="text-xs text-muted-foreground mt-1 leading-snug">{sub}</p>
      )}
    </div>
  );
}

function FreqBars({
  items,
  labelMap,
}: {
  items: FreqItem[];
  labelMap?: Record<string, string>;
}) {
  const { t } = useT();
  if (items.length === 0)
    return (
      <p className="text-sm text-muted-foreground italic">{t("common.no_data")}</p>
    );
  const cap = items[0]?.count ?? 1;
  return (
    <div className="flex flex-col gap-2.5">
      {items.map(({ label, count }) => (
        <div key={label} className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground flex-1 min-w-0 truncate">
            {labelMap ? (labelMap[label] ?? label) : label}
          </span>
          <div className="h-1.5 rounded-full bg-muted w-24 overflow-hidden shrink-0">
            <div
              className="h-full bg-primary/70 rounded-full transition-all"
              style={{ width: `${(count / cap) * 100}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground tabular-nums w-5 text-right shrink-0">
            {count}
          </span>
        </div>
      ))}
    </div>
  );
}

function FreqList({ items, translate }: { items: FreqItem[]; translate?: (s: string) => string }) {
  const { t } = useT();
  if (items.length === 0)
    return <p className="text-sm text-muted-foreground italic">{t("common.no_data")}</p>;
  return (
    <div className="flex flex-col gap-1.5">
      {items.map(({ label, count }) => (
        <div key={label} className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground truncate flex-1">
            {translate ? translate(label) : label}
          </span>
          <span className="text-xs text-muted-foreground tabular-nums ml-3">{count}×</span>
        </div>
      ))}
    </div>
  );
}

function WeeklyChart({ points, description }: { points: WeeklyPoint[]; description: string }) {
  const { t } = useT();
  const maxCount = Math.max(...points.map((p) => p.count), 1);
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-3">{description}</p>
      <div className="flex items-end gap-1.5" style={{ height: 60 }}>
        {points.map((p, i) => {
          const hPct = p.count === 0 ? 4 : (p.count / maxCount) * 100;
          const opacity =
            p.avgIntensity != null
              ? 0.25 + (p.avgIntensity / 10) * 0.75
              : 0.15;
          return (
            <div
              key={i}
              className="flex flex-col items-center gap-1 flex-1"
              title={
                p.count === 0
                  ? t("progress.weekly.tip_none").replace("{week}", p.weekLabel)
                  : t("progress.weekly.tip")
                      .replace("{week}", p.weekLabel)
                      .replace("{n}", String(p.count))
                      .replace("{avg}", p.avgIntensity?.toFixed(1) ?? "—")
              }
            >
              <div className="w-full relative" style={{ height: 48 }}>
                <div
                  className="absolute bottom-0 left-0 right-0 rounded-t-sm bg-primary transition-all"
                  style={{ height: `${hPct}%`, opacity }}
                />
              </div>
              <span className="text-[8px] text-muted-foreground leading-none">
                {p.weekLabel}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InlineNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-muted-foreground/70 italic leading-relaxed">
      {children}
    </p>
  );
}

function fmt1(n: number | null): string {
  return n == null ? "—" : n.toFixed(1);
}

function fmtPct(n: number | null): string {
  return n == null ? "—" : `${Math.round(n)}%`;
}

// ── Main component ────────────────────────────────────────────

export function Progress() {
  const { cravingLogs, relapseLogs, anxietyLogs, boredomLogs, sobrietyStartDate } = useStore();
  const { t, tOpt } = useT();
  const [range, setRange] = useState<TimeRange>("30d");

  const sobriety = useMemo(
    () => computeSobrietyStats(sobrietyStartDate, relapseLogs),
    [sobrietyStartDate, relapseLogs],
  );
  const streakDays = sobriety?.currentStreakDays ?? 0;

  // ── Translated label maps ──────────────────────────────────
  const ACTION_LABELS: Record<string, string> = {
    "document-only": tOpt("Just document this"),
    "urge-surfing": tOpt("Urge surfing"),
    "box-breathing": t("tools.breathing"),
    grounding: t("tools.grounding"),
    "cold-water": t("tools.cold_water"),
    "play-tape": t("tools.tape"),
    "call-someone": tOpt("Call or text someone"),
    "leave-situation": tOpt("Leave the situation"),
    "walk-or-move": tOpt("Walk or move"),
    "eat-drink-rest": tOpt("Eat, drink, or rest"),
    toolbox: tOpt("Open the toolbox"),
    // TrekTracker actions
    "remove-access": tOpt("Remove access or money"),
    "change-location": tOpt("Change location"),
    "delay-timer": tOpt("Use delay timer"),
    "use-tool": tOpt("Use a tool from the toolbox"),
    "just-observe": tOpt("Just observe — don't act"),
    // CravingTracker actions
    distraction: tOpt("Distraction"),
    "just-observed": tOpt("Just observed"),
    used: tOpt("Used"),
  };

  const RELAPSE_LABEL_DISPLAY: Record<string, string> = {
    lapse: tOpt("A lapse"),
    setback: tOpt("A setback"),
    "return-to-use": tOpt("Return to use"),
    relapse: tOpt("A relapse"),
    "no-label": tOpt("No label"),
  };

  // ── Days-since helpers ─────────────────────────────────────
  function daysShort(n: number | null): string {
    if (n === null) return "—";
    if (n === 0) return t("progress.stat.today");
    if (n === 1) return t("progress.stat.1day");
    return t("progress.stat.ndays").replace("{n}", String(n));
  }

  function daysSub(n: number | null, total: number): string {
    if (n === null) return t("progress.stat.no_lapses");
    if (n === 0) return t("progress.stat.total_happened_today").replace("{n}", String(total));
    if (n === 1) return t("progress.stat.total_yesterday").replace("{n}", String(total));
    return t("progress.stat.total_ndays_ago").replace("{n}", String(total)).replace("{d}", String(n));
  }

  const rangeOpts: { v: TimeRange; label: string }[] = [
    { v: "7d", label: t("progress.range.7d") },
    { v: "30d", label: t("progress.range.30d") },
    { v: "90d", label: t("progress.range.90d") },
    { v: "all", label: t("progress.range.all") },
  ];

  const filteredCravings = useMemo(
    () => filterByRange(cravingLogs, range),
    [cravingLogs, range]
  );
  const filteredRelapses = useMemo(
    () => filterByRange(relapseLogs, range),
    [relapseLogs, range]
  );
  const cStats = useMemo(
    () => computeCravingStats(filteredCravings),
    [filteredCravings]
  );
  const rStats = useMemo(
    () => computeRelapseStats(filteredRelapses),
    [filteredRelapses]
  );
  const allRStats = useMemo(
    () => computeRelapseStats(relapseLogs),
    [relapseLogs]
  );
  const weekly = useMemo(() => computeWeeklyTrend(cravingLogs, 10), [cravingLogs]);
  const filteredAnxiety = useMemo(
    () => filterByRange(anxietyLogs, range),
    [anxietyLogs, range]
  );
  const filteredBoredom = useMemo(
    () => filterByRange(boredomLogs, range),
    [boredomLogs, range]
  );
  const aStats = useMemo(() => computeAnxietyStats(filteredAnxiety), [filteredAnxiety]);
  const bStats = useMemo(() => computeBoredomStats(filteredBoredom), [filteredBoredom]);

  const hasPatternData =
    cStats.topEmotions.length > 0 ||
    cStats.topSituations.length > 0 ||
    cStats.topThoughts.length > 0;

  const hasCopingData =
    cStats.topActions.length > 0 || cStats.hasOutcomeData;

  const rangeSuffix = range === "all" ? t("progress.last_ever") : range;

  const encourageText =
    streakDays === 0
      ? t("progress.encourage.0")
      : streakDays < 7
      ? t("progress.encourage.7")
      : streakDays < 30
      ? t("progress.encourage.n").replace("{n}", String(streakDays))
      : t("progress.encourage.long").replace("{n}", String(streakDays));

  return (
    <div className="flex flex-col min-h-dvh bg-background">
      <PageHeader title={t("progress.title")} subtitle={t("progress.subtitle")} />
      <RangeFilter value={range} onChange={setRange} opts={rangeOpts} />

      <div className="flex-1 overflow-y-auto scroll-smooth-ios px-4 py-3 flex flex-col gap-4 pb-safe">

        {/* ── 1. Overview ──────────────────────────────────────── */}
        <SectionHeading title={t("progress.section.overview")} />

        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label={t("progress.stat.days_sober")}
            value={streakDays}
            sub={milestoneLabel(streakDays, t)}
            icon={<CalendarCheck size={13} className="text-primary" />}
            accent={streakDays > 0}
          />
          <StatCard
            label={t("progress.stat.last_event")}
            value={daysShort(allRStats.daysSinceLast)}
            sub={daysSub(allRStats.daysSinceLast, allRStats.total)}
            icon={<Shield size={13} className="text-muted-foreground" />}
          />
          <StatCard
            label={t("progress.stat.cravings")}
            value={cStats.total}
            sub={t("progress.stat.in_period")}
            icon={<Zap size={13} className="text-muted-foreground" />}
          />
          <StatCard
            label={t("progress.stat.lapses")}
            value={rStats.total}
            sub={t("progress.stat.in_period")}
            icon={<CalendarCheck size={13} className="text-muted-foreground" />}
          />
        </div>

        {cStats.total > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label={t("progress.stat.avg_intensity")}
              value={fmt1(cStats.avgIntensity)}
              sub={t("progress.stat.avg_intensity_sub")}
            />
            <StatCard
              label={t("progress.stat.avg_confidence")}
              value={fmt1(cStats.avgConfidenceBefore)}
              sub={t("progress.stat.avg_confidence_sub")}
            />
            {cStats.actionUsedPct != null && (
              <StatCard
                label={t("progress.stat.coping_actions")}
                value={fmtPct(cStats.actionUsedPct)}
                sub={`${cStats.withActionCount} of ${cStats.total}`}
              />
            )}
            {cStats.highRiskCount > 0 && (
              <StatCard
                label={t("progress.stat.high_risk")}
                value={cStats.highRiskCount}
                sub={t("progress.stat.high_risk_sub")}
                icon={<AlertTriangle size={13} className="text-amber-500" />}
              />
            )}
          </div>
        )}

        {/* ── Active vs Passive breakdown ───────────────────── */}
        {(cStats.activeTotal > 0 || cStats.passiveTotal > 0) && (
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label={t("progress.active.title")}
              value={cStats.activeTotal}
              sub={t("progress.stat.in_period")}
              icon={<Flame size={13} className="text-primary" />}
            />
            <StatCard
              label={t("progress.passive.title")}
              value={cStats.passiveTotal}
              sub={t("progress.stat.in_period")}
              icon={<Zap size={13} className="text-primary" />}
            />
          </div>
        )}

        {/* ── Behavioral outcome (did you end up using?) ─────── */}
        {cStats.withUseOutcomeCount > 0 && (
          <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield size={14} className="text-primary" />
                <p className="text-sm font-medium text-foreground">{t("progress.outcome.title")}</p>
              </div>
              <span className="text-2xl font-bold text-foreground tabular-nums leading-none">
                {fmtPct(cStats.successRate)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground -mt-1">
              {t("progress.outcome.success_sub")
                .replace("{n}", String(cStats.notUsedCount))
                .replace("{total}", String(cStats.withUseOutcomeCount))}
            </p>
            <FreqBars
              items={[
                { label: "not_used", count: cStats.notUsedCount },
                { label: "used", count: cStats.usedCount },
                { label: "unsure", count: cStats.unsureCount },
              ].filter((i) => i.count > 0)}
              labelMap={{
                not_used: t("tracker.outcome.not_used"),
                used: t("tracker.outcome.used"),
                unsure: t("tracker.outcome.unsure"),
              }}
            />
          </div>
        )}

        {(cStats.avgIntensityActive != null || cStats.avgIntensityPassive != null) && (
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label={t("progress.outcome.avg_intensity_active")}
              value={fmt1(cStats.avgIntensityActive)}
              sub={t("progress.active.title")}
              icon={<Flame size={13} className="text-primary" />}
            />
            <StatCard
              label={t("progress.outcome.avg_intensity_passive")}
              value={fmt1(cStats.avgIntensityPassive)}
              sub={t("progress.passive.title")}
              icon={<Zap size={13} className="text-primary" />}
            />
          </div>
        )}

        {cStats.activeTotal > 0 && cStats.topPlanningStages.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-sm font-medium text-foreground mb-3">
              {t("progress.active.planning")}
            </p>
            <FreqBars
              items={cStats.topPlanningStages}
              labelMap={Object.fromEntries(cStats.topPlanningStages.map(({ label }) => [label, tOpt(label)]))}
            />
          </div>
        )}

        {cStats.passiveTotal > 0 && cStats.topOnsetTypes.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-sm font-medium text-foreground mb-3">
              {t("progress.passive.onset")}
            </p>
            <FreqBars
              items={cStats.topOnsetTypes}
              labelMap={Object.fromEntries(cStats.topOnsetTypes.map(({ label }) => [label, tOpt(label)]))}
            />
          </div>
        )}

        {cStats.total === 0 && rStats.total === 0 && (
          <div className="bg-card border border-border rounded-2xl p-5 text-center">
            <p className="text-sm text-muted-foreground">
              {t("progress.empty")}
            </p>
          </div>
        )}

        {/* ── 2. Patterns in your logs ─────────────────────────── */}
        {hasPatternData && (
          <>
            <SectionHeading title={t("progress.section.patterns")} />
            <InlineNote>{t("progress.patterns.note")}</InlineNote>

            {cStats.topEmotions.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Heart size={14} className="text-primary" />
                  <p className="text-sm font-medium text-foreground">
                    {t("progress.patterns.emotions")}
                  </p>
                </div>
                <FreqBars items={cStats.topEmotions} labelMap={Object.fromEntries(cStats.topEmotions.map(({ label }) => [label, tOpt(label)]))} />
              </div>
            )}

            {cStats.topSituations.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Wind size={14} className="text-primary" />
                  <p className="text-sm font-medium text-foreground">
                    {t("progress.patterns.situations")}
                  </p>
                </div>
                <FreqBars items={cStats.topSituations} labelMap={Object.fromEntries(cStats.topSituations.map(({ label }) => [label, tOpt(label)]))} />
              </div>
            )}

            {cStats.topThoughts.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Brain size={14} className="text-primary" />
                  <p className="text-sm font-medium text-foreground">
                    {t("progress.patterns.thoughts")}
                  </p>
                </div>
                <FreqBars items={cStats.topThoughts} labelMap={Object.fromEntries(cStats.topThoughts.map(({ label }) => [label, tOpt(label)]))} />
              </div>
            )}

            {cStats.topPhysical.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-4">
                <p className="text-sm font-medium text-foreground mb-3">
                  {t("progress.patterns.physical")}
                </p>
                <FreqBars items={cStats.topPhysical} labelMap={Object.fromEntries(cStats.topPhysical.map(({ label }) => [label, tOpt(label)]))} />
              </div>
            )}

            {cStats.topSubstances.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-4">
                <p className="text-sm font-medium text-foreground mb-3">
                  {t("progress.patterns.substances")}
                </p>
                <FreqBars items={cStats.topSubstances} labelMap={Object.fromEntries(cStats.topSubstances.map(({ label }) => [label, tOpt(label)]))} />
              </div>
            )}

            {cStats.topLocations.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-4">
                <p className="text-sm font-medium text-foreground mb-3">
                  {t("progress.patterns.locations")}
                </p>
                <FreqBars items={cStats.topLocations} labelMap={Object.fromEntries(cStats.topLocations.map(({ label }) => [label, tOpt(label)]))} />
              </div>
            )}

            {cStats.buildupDurations.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-4">
                <p className="text-sm font-medium text-foreground mb-3">
                  {t("progress.patterns.buildup")}
                </p>
                <FreqBars items={cStats.buildupDurations} labelMap={Object.fromEntries(cStats.buildupDurations.map(({ label }) => [label, tOpt(label)]))} />
              </div>
            )}
          </>
        )}

        {/* ── 3. De-escalation patterns ────────────────────────── */}
        {hasCopingData && (
          <>
            <SectionHeading title={t("progress.section.deescalation")} />
            <InlineNote>{t("progress.deesc.note")}</InlineNote>

            {cStats.hasOutcomeData && (
              <div className="grid grid-cols-2 gap-3">
                {cStats.decreasedPct != null && (
                  <StatCard
                    label={t("progress.deesc.decreased")}
                    value={fmtPct(cStats.decreasedPct)}
                    sub={t("progress.deesc.of")
                      .replace("{n}", String(cStats.decreasedCount))
                      .replace("{total}", String(cStats.total))}
                    icon={<TrendingDown size={13} className="text-emerald-500" />}
                  />
                )}
                {cStats.avgCravingDrop != null && (
                  <StatCard
                    label={t("progress.deesc.avg_drop")}
                    value={
                      cStats.avgCravingDrop >= 0
                        ? `−${fmt1(cStats.avgCravingDrop)}`
                        : `+${fmt1(Math.abs(cStats.avgCravingDrop))}`
                    }
                    sub={t("progress.deesc.avg_drop_sub")}
                  />
                )}
                {cStats.avgConfidenceLift != null && (
                  <StatCard
                    label={t("progress.deesc.confidence_lift")}
                    value={
                      cStats.avgConfidenceLift >= 0
                        ? `+${fmt1(cStats.avgConfidenceLift)}`
                        : fmt1(cStats.avgConfidenceLift)
                    }
                    sub={t("progress.deesc.confidence_lift_sub")}
                    icon={<TrendingUp size={13} className="text-emerald-500" />}
                  />
                )}
              </div>
            )}

            {cStats.topActions.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-4">
                <p className="text-sm font-medium text-foreground mb-3">
                  {t("progress.deesc.coping_choices")}
                </p>
                <FreqBars
                  items={cStats.topActions}
                  labelMap={ACTION_LABELS}
                />
              </div>
            )}
          </>
        )}

        {/* ── 4. Lapse insights ────────────────────────────────── */}
        {rStats.total > 0 && (
          <>
            <SectionHeading title={t("progress.section.lapse")} />
            <InlineNote>{t("progress.lapse.note")}</InlineNote>

            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label={t("progress.lapse.events")}
                value={rStats.total}
                sub={Object.entries(rStats.labelCounts)
                  .map(([k, v]) => `${v} ${RELAPSE_LABEL_DISPLAY[k] ?? k}`)
                  .join(", ")}
              />
              <StatCard
                label={t("progress.lapse.most_recent")}
                value={daysShort(rStats.daysSinceLast)}
                sub={
                  rStats.daysSinceLast === 0
                    ? t("progress.stat.logged_today")
                    : rStats.daysSinceLast === 1
                    ? t("progress.stat.yesterday")
                    : t("progress.stat.ndays_ago").replace("{n}", String(rStats.daysSinceLast ?? 0))
                }
              />
            </div>

            {rStats.topMissedWarnings.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-4">
                <p className="text-sm font-medium text-foreground mb-1">
                  {t("progress.lapse.missed_warnings")}
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  {t("progress.lapse.missed_warnings_sub")}
                </p>
                <FreqBars items={rStats.topMissedWarnings} labelMap={Object.fromEntries(rStats.topMissedWarnings.map(({ label }) => [label, tOpt(label)]))} />
              </div>
            )}

            {rStats.topFirstTriggerTypes.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-4">
                <p className="text-sm font-medium text-foreground mb-3">
                  {t("progress.lapse.trigger_type")}
                </p>
                <FreqBars items={rStats.topFirstTriggerTypes} labelMap={Object.fromEntries(rStats.topFirstTriggerTypes.map(({ label }) => [label, tOpt(label)]))} />
              </div>
            )}

            {rStats.topThoughtsBefore.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-4">
                <p className="text-sm font-medium text-foreground mb-3">
                  {t("progress.lapse.thoughts_before")}
                </p>
                <FreqBars items={rStats.topThoughtsBefore} labelMap={Object.fromEntries(rStats.topThoughtsBefore.map(({ label }) => [label, tOpt(label)]))} />
              </div>
            )}

            {rStats.topCouldHaveHelped.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-4">
                <p className="text-sm font-medium text-foreground mb-1">
                  {t("progress.lapse.could_help")}
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  {t("progress.lapse.could_help_sub")}
                </p>
                <FreqBars items={rStats.topCouldHaveHelped} labelMap={Object.fromEntries(rStats.topCouldHaveHelped.map(({ label }) => [label, tOpt(label)]))} />
              </div>
            )}

            {rStats.noSupportContactCount > 0 && (
              <div className="bg-amber-500/8 border border-amber-500/20 rounded-2xl p-4">
                <p className="text-sm text-foreground font-medium mb-1">
                  {t("progress.lapse.no_support")
                    .replace("{n}", String(rStats.noSupportContactCount))
                    .replace("{total}", String(rStats.total))}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("progress.lapse.no_support_sub")}
                </p>
              </div>
            )}
          </>
        )}

        {/* ── 5. Anxiety patterns ──────────────────────────────── */}
        {aStats.total >= 2 && (
          <>
            <SectionHeading title={t("progress.section.anxiety")} />
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label={t("progress.anxiety.checkins")}
                value={aStats.total}
                sub={rangeSuffix === t("progress.last_ever") ? rangeSuffix : t("progress.last_range").replace("{range}", rangeSuffix)}
                icon={<Brain size={13} className="text-primary" />}
              />
              <StatCard
                label={t("progress.anxiety.avg")}
                value={aStats.avgIntensity !== null ? aStats.avgIntensity.toFixed(1) : "—"}
                sub={t("progress.anxiety.avg_sub")}
              />
            </div>

            {aStats.satWithItPct !== null && (
              <div className="bg-card border border-border rounded-2xl p-4">
                <p className="text-sm font-medium text-foreground mb-3">{t("progress.anxiety.reactions")}</p>
                <div className="flex flex-col gap-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{t("progress.anxiety.sat_with")}</span>
                      <span className="text-foreground font-medium">
                        {aStats.satWithItPct.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${aStats.satWithItPct}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{t("progress.anxiety.avoided")}</span>
                      <span className="text-foreground font-medium">
                        {aStats.avoidedPct !== null ? aStats.avoidedPct.toFixed(0) : 0}%
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary/40 rounded-full"
                        style={{ width: `${aStats.avoidedPct ?? 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {aStats.hasOutcomeData && aStats.improvedPct != null && (
              <StatCard
                label={t("progress.anxiety.improved")}
                value={fmtPct(aStats.improvedPct)}
                sub={t("progress.anxiety.improved_sub")}
                icon={<TrendingDown size={13} className="text-emerald-500" />}
              />
            )}

            {aStats.topContexts.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-4">
                <p className="text-sm font-medium text-foreground mb-3">{t("progress.anxiety.common_contexts")}</p>
                <FreqList items={aStats.topContexts} translate={tOpt} />
              </div>
            )}
            {aStats.topTriggers.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-4">
                <p className="text-sm font-medium text-foreground mb-3">{t("progress.anxiety.common_triggers")}</p>
                <FreqList items={aStats.topTriggers} translate={tOpt} />
              </div>
            )}
          </>
        )}

        {/* ── 6. Restlessness patterns ─────────────────────────── */}
        {bStats.total >= 2 && (
          <>
            <SectionHeading title={t("progress.section.boredom")} />
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label={t("progress.boredom.checkins")}
                value={bStats.total}
                sub={rangeSuffix === t("progress.last_ever") ? rangeSuffix : t("progress.last_range").replace("{range}", rangeSuffix)}
                icon={<Wind size={13} className="text-primary" />}
              />
              <StatCard
                label={t("progress.stat.avg_intensity")}
                value={bStats.avgIntensity !== null ? bStats.avgIntensity.toFixed(1) : "—"}
                sub={t("progress.boredom.avg_sub")}
              />
            </div>

            {bStats.satWithItPct !== null && (
              <div className="bg-card border border-border rounded-2xl p-4">
                <p className="text-sm font-medium text-foreground mb-3">{t("progress.boredom.responses")}</p>
                <div className="flex flex-col gap-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{t("progress.boredom.sat_with")}</span>
                      <span className="text-foreground font-medium">
                        {bStats.satWithItPct.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${bStats.satWithItPct}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{t("progress.boredom.escaped")}</span>
                      <span className="text-foreground font-medium">
                        {bStats.escapedPct !== null ? bStats.escapedPct.toFixed(0) : 0}%
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary/40 rounded-full"
                        style={{ width: `${bStats.escapedPct ?? 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {bStats.hasOutcomeData && bStats.improvedPct != null && (
              <StatCard
                label={t("progress.boredom.improved")}
                value={fmtPct(bStats.improvedPct)}
                sub={t("progress.boredom.improved_sub")}
                icon={<TrendingDown size={13} className="text-emerald-500" />}
              />
            )}

            {bStats.topSituations.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-4">
                <p className="text-sm font-medium text-foreground mb-3">{t("progress.boredom.common_situations")}</p>
                <FreqList items={bStats.topSituations} translate={tOpt} />
              </div>
            )}
            {bStats.topUrges.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-4">
                <p className="text-sm font-medium text-foreground mb-3">{t("progress.boredom.common_urges")}</p>
                <FreqList items={bStats.topUrges} translate={tOpt} />
              </div>
            )}
          </>
        )}

        {/* ── 7. Activity ──────────────────────────────────────── */}
        {cravingLogs.length > 0 && (
          <>
            <SectionHeading title={t("progress.section.activity")} />
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-sm font-medium text-foreground mb-4">
                {t("progress.weekly_label")}
              </p>
              <WeeklyChart
                points={weekly}
                description={t("progress.weekly_chart")}
              />
            </div>
          </>
        )}

        {/* ── Encouragement ────────────────────────────────────── */}
        <div className="bg-primary/8 border border-primary/20 rounded-2xl p-5 text-center">
          <p className="text-foreground font-medium mb-1.5">{encourageText}</p>
          <p className="text-sm text-muted-foreground">
            {t("progress.encourage.sub")}
          </p>
        </div>

        <div className="bg-muted/25 border border-border/30 rounded-2xl p-4 text-center">
          <p className="text-xs text-muted-foreground/80 leading-relaxed">
            {t("progress.privacy")}
          </p>
        </div>
      </div>
    </div>
  );
}
