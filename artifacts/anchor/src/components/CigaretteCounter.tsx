import { useMemo } from "react";
import { Plus } from "lucide-react";
import { useT } from "@/hooks/useTranslation";
import { computeCigaretteStats, formatMinutes, formatTimeSince } from "@/lib/cigaretteStats";
import type { CigaretteLog } from "@/db";
import { hapticLight } from "@/lib/haptics";

interface CigaretteCounterProps {
  logs: CigaretteLog[];
  onLog: () => void;
  onOpenDrawer?: () => void;
}

export function CigaretteCounter({ logs, onLog, onOpenDrawer }: CigaretteCounterProps) {
  const { t } = useT();
  const stats = useMemo(() => computeCigaretteStats(logs), [logs]);

  const trendText = () => {
    if (!stats.trendDirection || stats.trendDirection === "same") return null;
    const percent = stats.trendPercent;
    if (percent === null) return t(`cigarette.trend_${stats.trendDirection}`);
    const sign = percent > 0 ? "+" : "";
    return `${sign}${percent}% · ${t(`cigarette.trend_${stats.trendDirection}`)}`;
  };

  return (
    <section aria-label={t("cigarette.title")} className="animate-fade-up">
      <div className="rounded-[1.5rem] border border-border/50 bg-card/50 p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {t("cigarette.title")}
          </p>
          <button
            onClick={() => { hapticLight(); onLog(); }}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm active:scale-95 transition-transform touch-target"
            aria-label={t("cigarette.log_btn")}
          >
            <Plus size={18} strokeWidth={2.5} />
          </button>
        </div>

        {logs.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{t("cigarette.no_data")}</p>
        ) : (
          <>
            <button
              onClick={() => { hapticLight(); onOpenDrawer?.(); }}
              className="mt-3 flex items-baseline gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-lg"
            >
              <span className="text-5xl font-semibold tracking-[-0.06em] text-foreground tabular-nums">
                {stats.todayCount}
              </span>
              <span className="text-sm text-muted-foreground">{t("cigarette.today")}</span>
            </button>

            {trendText() && (
              <p className="mt-1 text-xs text-muted-foreground">{trendText()}</p>
            )}

            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-border/40 bg-card/40 p-3">
                <p className="text-[11px] font-medium text-muted-foreground">{t("cigarette.this_week")}</p>
                <p className="mt-1 text-lg font-semibold text-foreground tabular-nums">{stats.weekCount}</p>
              </div>
              <div className="rounded-2xl border border-border/40 bg-card/40 p-3">
                <p className="text-[11px] font-medium text-muted-foreground">{t("cigarette.this_month")}</p>
                <p className="mt-1 text-lg font-semibold text-foreground tabular-nums">{stats.monthCount}</p>
              </div>
              <div className="rounded-2xl border border-border/40 bg-card/40 p-3">
                <p className="text-[11px] font-medium text-muted-foreground">{t("cigarette.avg_per_day")}</p>
                <p className="mt-1 text-lg font-semibold text-foreground tabular-nums">
                  {stats.avgPerDayWeek !== null ? stats.avgPerDayWeek.toFixed(1) : "—"}
                </p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <div>
                <p className="text-[10px] font-medium text-muted-foreground">{t("cigarette.time_since_last")}</p>
                <p className="mt-0.5 text-sm font-medium text-foreground tabular-nums">{formatTimeSince(stats.timeSinceLastMs)}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium text-muted-foreground">{t("cigarette.avg_gap")}</p>
                <p className="mt-0.5 text-sm font-medium text-foreground tabular-nums">{formatMinutes(stats.avgGapMinutes)}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium text-muted-foreground">{t("cigarette.longest_gap_today")}</p>
                <p className="mt-0.5 text-sm font-medium text-foreground tabular-nums">{formatMinutes(stats.longestGapTodayMinutes)}</p>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
