import { useState, useMemo } from "react";
import { useStore } from "@/hooks/useStore";
import { useT } from "@/hooks/useTranslation";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import {
  filterByRange,
  computeCravingStats,
  computeRelapseStats,
  computeAnxietyStats,
  computeBoredomStats,
  computeWeeklyTrend,
  type TimeRange,
  type FreqItem,
} from "@/lib/analytics";
import {
  Trash2, ChevronDown, ChevronUp,
  BookOpen, BarChart3, TrendingUp,
} from "lucide-react";
import { CATEGORY_META } from "@/lib/constants";

const LABEL_KEYS: Record<string, string> = {
  trek: "registrations.trek.title",
  craving: "registrations.craving.title",
  anxiety: "registrations.anxiety.title",
  boredom: "registrations.boredom.title",
  relapse: "registrations.relapse.title",
};

function fmtDate(ts: number) {
  return new Date(ts).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function join(arr: string[] | undefined, fallback = "—") { return arr && arr.length > 0 ? arr.join(", ") : fallback; }

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

export function Insights() {
  const {
    cravingLogs, relapseLogs, anxietyLogs, boredomLogs,
    sobrietyStartDate, loading,
    removeCraving, removeRelapse, removeAnxiety, removeBoredom,
  } = useStore();
  const { t, tOpt } = useT();
  const [range, setRange] = useState<TimeRange>("30d");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

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
  const weekly = useMemo(() => computeWeeklyTrend(cravingLogs, 10), [cravingLogs]);

  // All entries merged and sorted
  const allEntries = useMemo(() => {
    const entries = [
      ...cravingLogs.map((l) => ({ ...l, _type: l.cravingType === "active" ? "trek" : "craving" as string })),
      ...relapseLogs.map((l) => ({ ...l, _type: "relapse" as string })),
      ...anxietyLogs.map((l) => ({ ...l, _type: "anxiety" as string })),
      ...boredomLogs.map((l) => ({ ...l, _type: "boredom" as string })),
    ];
    return entries.sort((a, b) => b.timestamp - a.timestamp);
  }, [cravingLogs, relapseLogs, anxietyLogs, boredomLogs]);

  // Time-of-day data for Recharts
  const timeOfDayData = useMemo(() => {
    const buckets = { morning: 0, afternoon: 0, evening: 0, night: 0 };
    const labels: Record<string, string> = {
      morning: t("insights.morning"),
      afternoon: t("insights.afternoon"),
      evening: t("insights.evening"),
      night: t("insights.night"),
    };
    for (const e of allEntries) {
      const h = new Date(e.timestamp).getHours();
      if (h >= 6 && h < 12) buckets.morning++;
      else if (h >= 12 && h < 18) buckets.afternoon++;
      else if (h >= 18 && h < 22) buckets.evening++;
      else buckets.night++;
    }
    return Object.entries(buckets).map(([key, count]) => ({ name: labels[key], count }));
  }, [allEntries, t]);

  // Trigger data for Recharts (top situations from cravings)
  const triggerData = useMemo(() => {
    return cStats.topSituations.slice(0, 6).map((item) => ({ name: item.label, count: item.count }));
  }, [cStats.topSituations]);

  const handleDelete = async (entry: typeof allEntries[0]) => {
    if (deleteConfirm !== entry.id) {
      setDeleteConfirm(entry.id);
      return;
    }
    try {
      if (entry._type === "trek" || entry._type === "craving") await removeCraving(entry.id);
      else if (entry._type === "relapse") await removeRelapse(entry.id);
      else if (entry._type === "anxiety") await removeAnxiety(entry.id);
      else if (entry._type === "boredom") await removeBoredom(entry.id);
    } finally {
      setDeleteConfirm(null);
    }
  };

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

      <div className="px-4 pt-2">
        <Tabs defaultValue="entries" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="entries" className="flex-1 gap-1.5">
              <BookOpen size={14} strokeWidth={1.8} />
              {t("insights.entries.title")}
            </TabsTrigger>
            <TabsTrigger value="patterns" className="flex-1 gap-1.5">
              <BarChart3 size={14} strokeWidth={1.8} />
              {t("insights.patterns.title")}
            </TabsTrigger>
          </TabsList>

          {/* ── Entries Tab ───────────────────────────── */}
          <TabsContent value="entries" className="pb-safe mt-3">
            {allEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{t("insights.entries.empty")}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {allEntries.map((entry) => {
                  const meta = CATEGORY_META[entry._type] || CATEGORY_META.craving;
                  const Icon = meta.icon;
                  const isExpanded = expandedId === entry.id;
                  const isConfirm = deleteConfirm === entry.id;
                  const contentId = `entry-details-${entry.id}`;
                  return (
                    <div
                      key={entry.id}
                      className="rounded-[1.5rem] border border-border/50 bg-card/50 p-4 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card ring-1 ring-border/50 ${meta.color}`}>
                          <Icon size={18} strokeWidth={1.8} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground">{t(LABEL_KEYS[entry._type] || LABEL_KEYS.craving)}</p>
                          <p className="text-[10px] text-muted-foreground">{fmtDate(entry.timestamp)}</p>
                        </div>
                        {(entry as any).intensity != null && (
                          <span className="text-sm font-semibold tabular-nums text-primary">{(entry as any).intensity}/10</span>
                        )}
                        <button
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                          aria-label={isExpanded ? "Collapse" : "Expand"}
                          aria-expanded={isExpanded}
                          aria-controls={contentId}
                        >
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>

                      {isExpanded && (
                        <div id={contentId} className="mt-3 pt-3 border-t border-border/50 flex flex-col gap-2">
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">Note:</span> {(entry as any).note || "—"}
                          </p>
                          {(entry as any).emotions && (entry as any).emotions.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">Emotions:</span> {join((entry as any).emotions)}
                            </p>
                          )}
                          {(entry as any).substances && (entry as any).substances.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">Substances:</span> {join((entry as any).substances)}
                            </p>
                          )}
                          {(entry as any).chosenAction && (
                            <p className="text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">Action:</span> {(entry as any).chosenAction}
                            </p>
                          )}
                          {(entry as any).cravingOutcome && (
                            <p className="text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">Outcome:</span> {(entry as any).cravingOutcome}
                            </p>
                          )}
                          <div className="flex justify-end mt-1">
                            <button
                              type="button"
                              onClick={() => handleDelete(entry)}
                              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                                isConfirm
                                  ? "bg-red-500/20 text-red-300 border border-red-500/30"
                                  : "text-muted-foreground hover:text-red-300 hover:bg-red-500/10"
                              }`}
                            >
                              <Trash2 size={13} strokeWidth={2} />
                              {isConfirm ? "Confirm delete" : "Delete"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ── Patterns Tab ──────────────────────────── */}
          <TabsContent value="patterns" className="pb-safe mt-3 flex flex-col gap-4">
            <RangeFilter value={range} onChange={setRange} opts={rangeOpts} />

            {/* Overview stats */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard label={t("progress.stat.streak")} value={sobrietyStartDate ? "—" : "—"} sub={t("progress.stat.streak_sub")} />
              <StatCard label={t("progress.stat.cravings")} value={cStats.total} />
              <StatCard label={t("progress.stat.lapses")} value={rStats.total} sub={t("progress.stat.in_period")} />
              <StatCard label={t("progress.stat.avg_intensity")} value={cStats.avgIntensity?.toFixed(1) ?? "—"} sub={t("progress.stat.avg_intensity_sub")} />
            </div>

            {/* Weekly activity chart */}
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

            {/* Recharts: By time of day */}
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

            {/* Recharts: By trigger */}
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

            {/* Frequency bars */}
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
