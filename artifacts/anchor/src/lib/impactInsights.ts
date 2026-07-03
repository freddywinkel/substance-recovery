import {
  computeAnxietyStats,
  computeBoredomStats,
  computeCravingStats,
  computeRelapseStats,
  filterByRange,
  type TimeRange,
} from "@/lib/analytics";
import type { AnxietyLog, BoredomLog, CravingLog, RelapseLog } from "@/db";

export type ImpactKind = "trek" | "craving" | "anxiety" | "boredom" | "relapse";

export type ImpactInsight = {
  kind: ImpactKind;
  labelKey: string;
  score: number;
  count: number;
  tone: string;
};

const IMPACT_META: Record<ImpactKind, { labelKey: string; tone: string }> = {
  trek: { labelKey: "logs.tab.trek", tone: "text-amber-300" },
  craving: { labelKey: "logs.tab.craving", tone: "text-teal-300" },
  anxiety: { labelKey: "logs.tab.anxiety", tone: "text-violet-300" },
  boredom: { labelKey: "logs.tab.boredom", tone: "text-emerald-300" },
  relapse: { labelKey: "logs.tab.relapse", tone: "text-rose-300" },
};

export function buildImpactInsights(
  logs: {
    cravingLogs: CravingLog[];
    relapseLogs: RelapseLog[];
    anxietyLogs: AnxietyLog[];
    boredomLogs: BoredomLog[];
  },
  range: TimeRange,
): ImpactInsight[] {
  const filteredCravings = filterByRange(logs.cravingLogs, range);
  const filteredRelapses = filterByRange(logs.relapseLogs, range);
  const filteredAnxiety = filterByRange(logs.anxietyLogs, range);
  const filteredBoredom = filterByRange(logs.boredomLogs, range);

  const cStats = computeCravingStats(filteredCravings);
  const rStats = computeRelapseStats(filteredRelapses);
  const aStats = computeAnxietyStats(filteredAnxiety);
  const bStats = computeBoredomStats(filteredBoredom);

  const items: Array<ImpactInsight | null> = [
    cStats.activeTotal > 0 && cStats.avgIntensityActive != null
      ? { kind: "trek", score: cStats.avgIntensityActive, count: cStats.activeTotal, ...IMPACT_META.trek }
      : null,
    cStats.passiveTotal > 0 && cStats.avgIntensityPassive != null
      ? { kind: "craving", score: cStats.avgIntensityPassive, count: cStats.passiveTotal, ...IMPACT_META.craving }
      : null,
    aStats.total > 0 && aStats.avgIntensity != null
      ? { kind: "anxiety", score: aStats.avgIntensity, count: aStats.total, ...IMPACT_META.anxiety }
      : null,
    bStats.total > 0 && bStats.avgIntensity != null
      ? { kind: "boredom", score: bStats.avgIntensity, count: bStats.total, ...IMPACT_META.boredom }
      : null,
    rStats.total > 0
      ? { kind: "relapse", score: 10, count: rStats.total, ...IMPACT_META.relapse }
      : null,
  ];

  return items
    .filter((item): item is ImpactInsight => Boolean(item))
    .sort((a, b) => b.score - a.score || b.count - a.count);
}
