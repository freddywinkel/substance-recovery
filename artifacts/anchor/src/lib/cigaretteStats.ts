import type { CigaretteLog } from "@/db";

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;
const SIX_HOURS_MIN = 360;

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export interface CigaretteStats {
  todayCount: number;
  weekCount: number;
  monthCount: number;
  avgPerDayWeek: number | null;
  avgPerDayMonth: number | null;
  timeSinceLastMs: number | null;
  avgGapMinutes: number | null;
  longestGapTodayMinutes: number | null;
  trendDirection: "up" | "down" | "same" | null;
  trendPercent: number | null;
}

export function computeCigaretteStats(
  logs: CigaretteLog[],
  now = Date.now()
): CigaretteStats {
  const sorted = [...logs].sort((a, b) => a.timestamp - b.timestamp);
  const todayStart = startOfDay(now);
  const weekStart = now - 7 * DAY_MS;
  const monthStart = now - 30 * DAY_MS;

  const todayLogs = sorted.filter((l) => l.timestamp >= todayStart);
  const weekLogs = sorted.filter((l) => l.timestamp >= weekStart);
  const monthLogs = sorted.filter((l) => l.timestamp >= monthStart);

  const todayCount = todayLogs.length;
  const weekCount = weekLogs.length;
  const monthCount = monthLogs.length;

  const hasAnyLogs = sorted.length > 0;
  const avgPerDayWeek = hasAnyLogs ? weekCount / 7 : null;
  const avgPerDayMonth = hasAnyLogs ? monthCount / 30 : null;

  const timeSinceLastMs = hasAnyLogs
    ? now - sorted[sorted.length - 1].timestamp
    : null;

  // Gaps between consecutive timestamps (exclude > 6 hours = sleep / outliers)
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const gapMin = (sorted[i].timestamp - sorted[i - 1].timestamp) / MINUTE_MS;
    gaps.push(gapMin);
  }
  const validGaps = gaps.filter((g) => g <= SIX_HOURS_MIN);
  const avgGapMinutes = validGaps.length > 0
    ? validGaps.reduce((sum, g) => sum + g, 0) / validGaps.length
    : null;

  // Longest gap today
  let longestGapTodayMinutes: number | null = null;
  for (let i = 1; i < todayLogs.length; i++) {
    const gapMin = (todayLogs[i].timestamp - todayLogs[i - 1].timestamp) / MINUTE_MS;
    if (longestGapTodayMinutes === null || gapMin > longestGapTodayMinutes) {
      longestGapTodayMinutes = gapMin;
    }
  }

  // Trend: this week vs previous week
  const prevWeekStart = weekStart - 7 * DAY_MS;
  const thisWeekCount = sorted.filter(
    (l) => l.timestamp >= weekStart && l.timestamp < weekStart + 7 * DAY_MS
  ).length;
  const prevWeekCount = sorted.filter(
    (l) => l.timestamp >= prevWeekStart && l.timestamp < weekStart
  ).length;

  let trendDirection: "up" | "down" | "same" | null = null;
  let trendPercent: number | null = null;

  if (thisWeekCount === prevWeekCount) {
    trendDirection = "same";
    trendPercent = 0;
  } else if (prevWeekCount === 0) {
    trendDirection = thisWeekCount > 0 ? "up" : "same";
    trendPercent = thisWeekCount > 0 ? null : 0;
  } else if (thisWeekCount === 0) {
    trendDirection = "down";
    trendPercent = -100;
  } else {
    const change = ((thisWeekCount - prevWeekCount) / prevWeekCount) * 100;
    trendPercent = Math.round(change * 10) / 10;
    trendDirection = change > 0 ? "up" : change < 0 ? "down" : "same";
  }

  return {
    todayCount,
    weekCount,
    monthCount,
    avgPerDayWeek,
    avgPerDayMonth,
    timeSinceLastMs,
    avgGapMinutes,
    longestGapTodayMinutes,
    trendDirection,
    trendPercent,
  };
}

export function formatMinutes(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes < 1) return "<1m";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatTimeSince(ms: number | null): string {
  if (ms === null) return "—";
  const minutes = Math.floor(ms / MINUTE_MS);
  if (minutes < 1) return "<1m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
