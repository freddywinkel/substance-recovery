import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStore } from "@/hooks/useStore";
import { useT } from "@/hooks/useTranslation";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  computeAnxietyStats,
  computeBoredomStats,
  computeCravingStats,
  computeRelapseStats,
  computeWeeklyTrend,
  filterByRange,
  type FreqItem,
  type TimeRange,
} from "@/lib/analytics";
import { BarChart3, TrendingUp } from "lucide-react";

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card/50 p-4">
      <p className="text-[11px] text-muted-foreground uppercase tracking-widest mb-2">{label}</p>
      <p className="text-3xl font-bold text-foreground tabular-nums leading-none">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1 leading-snug">{sub}</p>}
    </div>
  );
}

function FreqBars({ items, labelMap, translate }: { items: FreqItem[]; labelMap?: Record<string, string>; translate?: (s: string) => string }) {
  const { t } = useT();
  if (items.length === 0) return <p className="text-sm text-muted-foreground italic">{t("common.no_data")}</p>;
  const cap = items[0]?.count ?? 1;
  return (
    <div className="flex flex-col gap-2.5">
      {items.map(({ label, count }) => (
        <div key={label} className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground flex-1 min-w-0 truncate">
            {translate ? translate(label) : labelMap ? (labelMap[label] ?? label) : label}
          </span>
          <div className="h-1.5 rounded-full bg-muted w-24 overflow-hidden shrink-0">
            <div className="h-full bg-primary/70 rounded-full transition-all" style={{ width: `${(count / cap) * 100}%` }} />
          </div>
          <span className="text-xs text-muted-foreground tabular-nums w-5 text-right shrink-0">{count}</span>
        </div>
      ))}
    </div>
  );
}

function RangeFilter({ value, onChange, opts }: { value: TimeRange; onChange: (r: TimeRange) => void; opts: { v: TimeRange; label: string }[] }) {
  return (
    <div className="flex gap-1.5">
      {opts.map(({ v, label }) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`flex-1 py-1.5 rounded-full text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
            value === v ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

type ImpactItem = {
  label: string;
  score: number;
  count: number;
  tone: string;
};

export function Insights() {
  const {
    cravingLogs,
    relapseLogs,
    anxietyLogs,
    boredomLogs,
    sobrietyStartDate,
    loading,
  } = useStore();
  const { t, tOpt } = useT();
  const [range, setRange] = useState<TimeRange>("30d");

  const rangeOpts: { v: TimeRange; label: string }[] = [
    { v: "7d", label: t("progress.range.7d") },
    { v: "30d", label: t("progress.range.30d") },
    { v: "90d", label: t("progress.range.90d") },
    { v: "all", label: t("progress.range.all") },
  ];

  const filteredCravings = useMemo(() => filterByRange(cravingLogs, range), [cravingLogs, range]);
  const filteredRelapses = useMemo(() => filterByRange(relapseLogs, range), [relapseLogs, range]);
  const filteredAnxiety = useMemo(() => filterByRange(anxietyLogs, range), [anxietyLogs, range]);
  const filteredBoredom = useMemo(() => filterByRange(boredomLogs, range), [boredomLogs, range]);

  const cStats = useMemo(() => computeCravingStats(filteredCravings), [filteredCravings]);
  const rStats = useMemo(() => computeRelapseStats(filteredRelapses), [filteredRelapses]);
  const aStats = useMemo(() => computeAnxietyStats(filteredAnxiety), [filteredAnxiety]);
  const bStats = useMemo(() => computeBoredomStats(filteredBoredom), [filteredBoredom]);
  const weekly = useMemo(() => computeWeeklyTrend(filteredCravings, 10), [filteredCravings]);

  const allPatternEntries = useMemo(() => {
    return [
      ...filteredCravings,
      ...filteredRelapses,
      ...filteredAnxiety,
      ...filteredBoredom,
    ];
  }, [filteredAnxiety, filteredBoredom, filteredCravings, filteredRelapses]);

  const timeOfDayData = useMemo(() => {
    const buckets = { morning: 0, afternoon: 0, evening: 0, night: 0 };
    const labels: Record<string, string> = {
      morning: t("insights.morning"),
      afternoon: t("insights.afternoon"),
      evening: t("insights.evening"),
      night: t("insights.night"),
    };
    for (const entry of allPatternEntries) {
      const h = new Date(entry.timestamp).getHours();
      if (h >= 6 && h < 12) buckets.morning++;
      else if (h >= 12 && h < 18) buckets.afternoon++;
      else if (h >= 18 && h < 22) buckets.evening++;
      else buckets.night++;
    }
    return Object.entries(buckets).map(([key, count]) => ({ name: labels[key], count }));
  }, [allPatternEntries, t]);

  const triggerData = useMemo(() => {
    return cStats.topSituations.slice(0, 6).map((item) => ({ name: item.label, count: item.count }));
  }, [cStats.topSituations]);

  const impactItems = useMemo<ImpactItem[]>(() => {
    const items: Array<ImpactItem | null> = [
      cStats.activeTotal > 0 && cStats.avgIntensityActive != null
        ? { label: t("logs.tab.trek"), score: cStats.avgIntensityActive, count: cStats.activeTotal, tone: "text-amber-300" }
        : null,
      cStats.passiveTotal > 0 && cStats.avgIntensityPassive != null
        ? { label: t("logs.tab.craving"), score: cStats.avgIntensityPassive, count: cStats.passiveTotal, tone: "text-teal-300" }
        : null,
      aStats.total > 0 && aStats.avgIntensity != null
        ? { label: t("logs.tab.anxiety"), score: aStats.avgIntensity, count: aStats.total, tone: "text-violet-300" }
        : null,
      bStats.total > 0 && bStats.avgIntensity != null
        ? { label: t("logs.tab.boredom"), score: bStats.avgIntensity, count: bStats.total, tone: "text-emerald-300" }
        : null,
      rStats.total > 0
        ? { label: t("logs.tab.relapse"), score: 10, count: rStats.total, tone: "text-rose-300" }
        : null,
    ];
    return items
      .filter((item): item is ImpactItem => Boolean(item))
      .sort((a, b) => b.score - a.score || b.count - a.count);
  }, [
    aStats.avgIntensity,
    aStats.total,
    bStats.avgIntensity,
    bStats.total,
    cStats.activeTotal,
    cStats.avgIntensityActive,
    cStats.avgIntensityPassive,
    cStats.passiveTotal,
    rStats.total,
    t,
  ]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const maxCount = Math.max(...weekly.map((p) => p.count), 1);

  return (
    <div className="flex flex-col min-h-dvh bg-background">
      <PageHeader title={t("nav.insights")} subtitle={t("progress.subtitle")} />

      <div className="flex-1 overflow-y-auto scroll-smooth-ios px-4 pt-2 pb-safe">
        <RangeFilter value={range} onChange={setRange} opts={rangeOpts} />

        <Tabs defaultValue="impact" className="mt-3 w-full">
          <TabsList className="w-full">
            <TabsTrigger value="impact" className="flex-1 gap-1.5">
              <TrendingUp size={14} strokeWidth={1.8} />
              {t("insights.impact.title")}
            </TabsTrigger>
            <TabsTrigger value="patterns" className="flex-1 gap-1.5">
              <BarChart3 size={14} strokeWidth={1.8} />
              {t("insights.patterns.title")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="impact" className="mt-3 flex flex-col gap-3">
            <div className="rounded-[1.5rem] border border-border/50 bg-card/50 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {t("insights.impact.summary")}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {t("insights.impact.subtitle")}
              </p>
            </div>

            {impactItems.length === 0 ? (
              <div className="rounded-[1.5rem] border border-border/50 bg-card/50 p-5 text-center">
                <p className="text-sm text-muted-foreground">{t("insights.impact.empty")}</p>
              </div>
            ) : (
              impactItems.map((item, index) => (
                <div key={item.label} className="rounded-[1.5rem] border border-border/50 bg-card/50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {index + 1}. {item.label}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("insights.impact.count").replace("{n}", String(item.count))}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-2xl font-semibold tabular-nums ${item.tone}`}>
                        {item.score.toFixed(1)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {t("insights.impact.score")}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="patterns" className="mt-3 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <StatCard label={t("progress.stat.streak")} value={sobrietyStartDate ? "-" : "-"} sub={t("progress.stat.streak_sub")} />
              <StatCard label={t("progress.stat.cravings")} value={cStats.total} />
              <StatCard label={t("progress.stat.lapses")} value={rStats.total} sub={t("progress.stat.in_period")} />
              <StatCard label={t("progress.stat.avg_intensity")} value={cStats.avgIntensity?.toFixed(1) ?? "-"} sub={t("progress.stat.avg_intensity_sub")} />
            </div>

            <div className="rounded-[1.5rem] border border-border/50 bg-card/50 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground mb-3">{t("progress.section.checkins")}</p>
              <div className="flex items-end gap-1.5 h-[60px]">
                {weekly.map((p, i) => {
                  const hPct = p.count === 0 ? 4 : (p.count / maxCount) * 100;
                  const opacity = p.avgIntensity != null ? 0.25 + (p.avgIntensity / 10) * 0.75 : 0.15;
                  return (
                    <div key={i} className="flex flex-col items-center gap-1 flex-1">
                      <div className="w-full relative" style={{ height: 48 }}>
                        <div className="absolute bottom-0 left-0 right-0 rounded-t-sm bg-primary transition-all" style={{ height: `${hPct}%`, opacity }} />
                      </div>
                      <span className="text-[8px] text-muted-foreground leading-none">{p.weekLabel}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-border/50 bg-card/50 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground mb-3">{t("insights.timeOfDay.title")}</p>
              {timeOfDayData.some((d) => d.count > 0) ? (
                <div className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={timeOfDayData}>
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={20} />
                      <Tooltip
                        contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: 12 }}
                        itemStyle={{ color: "hsl(var(--foreground))" }}
                        cursor={{ fill: "hsl(var(--primary) / 0.08)" }}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {timeOfDayData.map((_, i) => (
                          <Cell key={i} fill={`hsl(var(--primary) / ${0.5 + i * 0.12})`} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">{t("common.no_data")}</p>
              )}
            </div>

            <div className="rounded-[1.5rem] border border-border/50 bg-card/50 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground mb-3">{t("insights.byTrigger.title")}</p>
              {triggerData.length > 0 ? (
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={triggerData} layout="vertical">
                      <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={20} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={100} />
                      <Tooltip
                        contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: 12 }}
                        itemStyle={{ color: "hsl(var(--foreground))" }}
                        cursor={{ fill: "hsl(var(--primary) / 0.08)" }}
                      />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]} fill="hsl(var(--primary) / 0.7)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">{t("common.no_data")}</p>
              )}
            </div>

            {cStats.topEmotions.length > 0 && (
              <div className="rounded-[1.5rem] border border-border/50 bg-card/50 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground mb-3">{t("progress.patterns.emotions")}</p>
                <FreqBars items={cStats.topEmotions} translate={tOpt} />
              </div>
            )}
            {cStats.topSituations.length > 0 && (
              <div className="rounded-[1.5rem] border border-border/50 bg-card/50 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground mb-3">{t("progress.patterns.situations")}</p>
                <FreqBars items={cStats.topSituations} />
              </div>
            )}
            {cStats.topActions.length > 0 && (
              <div className="rounded-[1.5rem] border border-border/50 bg-card/50 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground mb-3">{t("progress.section.deescalation")}</p>
                <FreqBars items={cStats.topActions} />
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
