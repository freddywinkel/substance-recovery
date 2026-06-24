import type { CravingLog, RelapseLog, AnxietyLog, BoredomLog } from "@/db";

export type TimeRange = "7d" | "30d" | "90d" | "all";

export function filterByRange<T extends { timestamp: number }>(
  items: T[],
  range: TimeRange
): T[] {
  if (range === "all") return items;
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const cutoff = Date.now() - days * 86_400_000;
  return items.filter((i) => i.timestamp >= cutoff);
}

export interface FreqItem {
  label: string;
  count: number;
}

export function topFrequencies(items: string[], n = 5): FreqItem[] {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const t = item?.trim();
    if (t) counts[t] = (counts[t] ?? 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([label, count]) => ({ label, count }));
}

function avgOf(arr: number[]): number | null {
  return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null;
}

/** Normalize a field that may be a new plural array or a legacy singular string. */
function pluralOr(plural: string[] | undefined, singular: string | undefined): string[] {
  if (plural && plural.length) return plural;
  return singular ? [singular] : [];
}

export interface StrategyOutcome {
  strategy: string;
  total: number;
  notUsed: number;
  used: number;
  unsure: number;
  successRate: number | null;
}

export interface CravingStats {
  total: number;
  activeTotal: number;
  passiveTotal: number;
  avgIntensity: number | null;
  avgIntensityActive: number | null;
  avgIntensityPassive: number | null;
  avgConfidenceBefore: number | null;
  avgCravingDrop: number | null;
  avgConfidenceLift: number | null;
  decreasedCount: number;
  decreasedPct: number | null;
  highRiskCount: number;
  withActionCount: number;
  actionUsedPct: number | null;
  hasOutcomeData: boolean;
  usedCount: number;
  notUsedCount: number;
  unsureCount: number;
  withUseOutcomeCount: number;
  successRate: number | null;
  outcomeByStrategy: StrategyOutcome[];
  topSituations: FreqItem[];
  topEmotions: FreqItem[];
  topPhysical: FreqItem[];
  topThoughts: FreqItem[];
  topSubstances: FreqItem[];
  topLocations: FreqItem[];
  topSocialContexts: FreqItem[];
  topActions: FreqItem[];
  buildupDurations: FreqItem[];
  topPlanningStages: FreqItem[];
  topNeeds: FreqItem[];
  topOnsetTypes: FreqItem[];
}

export function computeCravingStats(logs: CravingLog[]): CravingStats {
  const done = logs.filter((l) => l.status === "completed");
  const n = done.length;

  const intensities = done
    .map((l) => l.intensity)
    .filter((v): v is number => v != null && v >= 0);
  const confBefore = done
    .map((l) => l.confidenceBefore)
    .filter((v): v is number => v != null && v >= 0);

  const pairedIntensity = done.filter((l) => l.intensityAfter != null);
  const drops = pairedIntensity.map(
    (l) => l.intensity - (l.intensityAfter as number)
  );

  const pairedConf = done.filter(
    (l) => l.confidenceAfter != null && l.confidenceBefore != null
  );
  const lifts = pairedConf.map(
    (l) => (l.confidenceAfter as number) - l.confidenceBefore
  );

  const decreasedCount = done.filter(
    (l) => l.cravingOutcome === "decreased"
  ).length;
  const withAction = done.filter(
    (l) => l.chosenAction && l.chosenAction !== "document-only"
  );

  const activeLogs = done.filter((l) => l.cravingType === "active");
  const passiveLogs = done.filter((l) => l.cravingType !== "active");

  const activeIntensities = activeLogs
    .map((l) => l.intensity)
    .filter((v): v is number => v != null && v >= 0);
  const passiveIntensities = passiveLogs
    .map((l) => l.intensity)
    .filter((v): v is number => v != null && v >= 0);

  // Behavioral outcome ("did you end up using?") — the headline success signal.
  const withUseOutcome = done.filter((l) => l.useOutcome);
  const usedCount = done.filter((l) => l.useOutcome === "used").length;
  const notUsedCount = done.filter((l) => l.useOutcome === "not_used").length;
  const unsureCount = done.filter((l) => l.useOutcome === "unsure").length;

  // Per-coping-strategy breakdown: of logs that recorded an outcome, how did each action fare?
  const strategyMap: Record<string, { notUsed: number; used: number; unsure: number }> = {};
  for (const l of withUseOutcome) {
    const key = l.chosenAction || "";
    if (!key) continue;
    const bucket = strategyMap[key] ?? { notUsed: 0, used: 0, unsure: 0 };
    if (l.useOutcome === "not_used") bucket.notUsed += 1;
    else if (l.useOutcome === "used") bucket.used += 1;
    else bucket.unsure += 1;
    strategyMap[key] = bucket;
  }
  const outcomeByStrategy: StrategyOutcome[] = Object.entries(strategyMap)
    .map(([strategy, b]) => {
      const stratTotal = b.notUsed + b.used + b.unsure;
      return {
        strategy,
        total: stratTotal,
        notUsed: b.notUsed,
        used: b.used,
        unsure: b.unsure,
        successRate: stratTotal > 0 ? (b.notUsed / stratTotal) * 100 : null,
      };
    })
    .sort((a, b) => b.total - a.total);

  return {
    total: n,
    activeTotal: activeLogs.length,
    passiveTotal: passiveLogs.length,
    avgIntensity: avgOf(intensities),
    avgIntensityActive: avgOf(activeIntensities),
    avgIntensityPassive: avgOf(passiveIntensities),
    avgConfidenceBefore: avgOf(confBefore),
    avgCravingDrop: avgOf(drops),
    avgConfidenceLift: avgOf(lifts),
    decreasedCount,
    decreasedPct: n > 0 ? (decreasedCount / n) * 100 : null,
    highRiskCount: done.filter((l) => l.highRiskFlag).length,
    withActionCount: withAction.length,
    actionUsedPct: n > 0 ? (withAction.length / n) * 100 : null,
    hasOutcomeData: pairedIntensity.length > 0 || done.some((l) => l.cravingOutcome),
    usedCount,
    notUsedCount,
    unsureCount,
    withUseOutcomeCount: withUseOutcome.length,
    successRate: withUseOutcome.length > 0 ? (notUsedCount / withUseOutcome.length) * 100 : null,
    outcomeByStrategy,
    topSituations: topFrequencies(done.flatMap((l) => l.situationPresets ?? [])),
    topEmotions: topFrequencies(done.flatMap((l) => l.emotions ?? [])),
    topPhysical: topFrequencies(done.flatMap((l) => l.physicalSensations ?? [])),
    topThoughts: topFrequencies(done.flatMap((l) => l.thoughtPresets ?? [])),
    topSubstances: topFrequencies(done.flatMap((l) => l.substances ?? [])),
    topLocations: topFrequencies(
      done.map((l) => l.location ?? "").filter(Boolean)
    ),
    topSocialContexts: topFrequencies(
      done.flatMap((l) => l.socialContext ?? [])
    ),
    topActions: topFrequencies(
      done.map((l) => l.chosenAction ?? "").filter(Boolean)
    ),
    buildupDurations: topFrequencies(
      done.map((l) => l.buildupDuration ?? "").filter(Boolean)
    ),
    topPlanningStages: topFrequencies(
      activeLogs.map((l) => l.planningStage ?? "").filter(Boolean)
    ),
    topNeeds: topFrequencies(
      activeLogs.flatMap((l) => pluralOr(l.needTypes, l.needType))
    ),
    topOnsetTypes: topFrequencies(
      passiveLogs.map((l) => l.onsetType ?? "").filter(Boolean)
    ),
  };
}

export interface RelapseStats {
  total: number;
  daysSinceLast: number | null;
  topFirstTriggerTypes: FreqItem[];
  topMissedWarnings: FreqItem[];
  topThoughtsBefore: FreqItem[];
  topCouldHaveHelped: FreqItem[];
  noSupportContactCount: number;
  labelCounts: Record<string, number>;
}

export function computeRelapseStats(logs: RelapseLog[]): RelapseStats {
  const done = logs.filter((l) => l.status === "completed");
  const n = done.length;

  const daysSinceLast =
    n === 0
      ? null
      : Math.floor(
          (Date.now() - Math.max(...done.map((l) => l.timestamp))) / 86_400_000
        );

  const allHelped = done.flatMap((l) => [
    ...(l.couldHaveHelpedEarly ?? []),
    ...(l.couldHaveHelpedMiddle ?? []),
    ...(l.couldHaveHelpedLast ?? []),
  ]);

  const labelCounts: Record<string, number> = {};
  done.forEach((l) => {
    labelCounts[l.label] = (labelCounts[l.label] ?? 0) + 1;
  });

  return {
    total: n,
    daysSinceLast,
    topFirstTriggerTypes: topFrequencies(
      done.map((l) => l.firstTriggerType ?? "").filter(Boolean)
    ),
    topMissedWarnings: topFrequencies(
      done.flatMap((l) => l.missedWarnings ?? []),
      6
    ),
    topThoughtsBefore: topFrequencies(
      done.flatMap((l) => pluralOr(l.preUseThoughtPresets, l.preUseThoughtPreset))
    ),
    topCouldHaveHelped: topFrequencies(allHelped, 5),
    noSupportContactCount: done.filter((l) => !l.supportContact).length,
    labelCounts,
  };
}

// ── Anxiety analytics ─────────────────────────────────────────
export interface AnxietyStats {
  total: number;
  avgIntensity: number | null;
  topContexts: FreqItem[];
  topTriggers: FreqItem[];
  topReactions: FreqItem[];
  topBodySensations: FreqItem[];
  satWithItCount: number;
  satWithItPct: number | null;
  avoidedCount: number;
  avoidedPct: number | null;
  hasOutcomeData: boolean;
  improvedCount: number;
  improvedPct: number | null;
}

export function computeAnxietyStats(logs: AnxietyLog[]): AnxietyStats {
  const n = logs.length;
  const satWithIt = logs.filter((l) => l.reaction === "Sat with it — didn't react");
  const avoided = logs.filter((l) => l.reaction === "Avoided or left");
  const withOutcome = logs.filter((l) => l.outcomeAfter != null);
  const improved = logs.filter((l) => l.outcomeAfter === "decreased");
  return {
    total: n,
    avgIntensity: avgOf(logs.map((l) => l.intensity)),
    topContexts: topFrequencies(logs.map((l) => l.context).filter(Boolean)),
    topTriggers: topFrequencies(logs.flatMap((l) => pluralOr(l.triggers, l.trigger))),
    topReactions: topFrequencies(logs.map((l) => l.reaction).filter(Boolean)),
    topBodySensations: topFrequencies(logs.flatMap((l) => l.bodySensations ?? [])),
    satWithItCount: satWithIt.length,
    satWithItPct: n > 0 ? (satWithIt.length / n) * 100 : null,
    avoidedCount: avoided.length,
    avoidedPct: n > 0 ? (avoided.length / n) * 100 : null,
    hasOutcomeData: withOutcome.length > 0,
    improvedCount: improved.length,
    improvedPct: withOutcome.length > 0 ? (improved.length / withOutcome.length) * 100 : null,
  };
}

// ── Boredom analytics ─────────────────────────────────────────
export interface BoredomStats {
  total: number;
  avgIntensity: number | null;
  topFeelingTypes: FreqItem[];
  topStimulationNeeds: FreqItem[];
  topSituations: FreqItem[];
  topUrges: FreqItem[];
  topActions: FreqItem[];
  satWithItCount: number;
  satWithItPct: number | null;
  escapedCount: number;
  escapedPct: number | null;
  delayedCount: number;
  delayedPct: number | null;
  avgDelayDuration: string | null;
  hasOutcomeData: boolean;
  improvedCount: number;
  improvedPct: number | null;
}

export function computeBoredomStats(logs: BoredomLog[]): BoredomStats {
  const n = logs.length;
  const satWith = logs.filter((l) => l.action === "Sat with it — didn't react");
  const escaped = logs.filter((l) => l.action === "Escaped immediately");
  const delayed = logs.filter(
    (l) => l.action === "Delayed action" || l.action === "Sat with it — didn't react"
  );

  // Most common delay duration among those who delayed
  const durations = logs
    .filter((l) => l.delayDuration)
    .map((l) => l.delayDuration);
  const durFreq = topFrequencies(durations, 1);
  const avgDelayDuration = durFreq[0]?.label ?? null;

  const withOutcome = logs.filter((l) => l.outcomeAfter != null);
  const improved = logs.filter((l) => l.outcomeAfter === "decreased");

  return {
    total: n,
    avgIntensity: avgOf(logs.map((l) => l.intensity)),
    topFeelingTypes: topFrequencies(logs.flatMap((l) => l.feelingTypes ?? [])),
    topStimulationNeeds: topFrequencies(
      logs.flatMap((l) => pluralOr(l.stimulationNeeds, l.stimulationNeed))
    ),
    topSituations: topFrequencies(logs.map((l) => l.situation).filter(Boolean)),
    topUrges: topFrequencies(logs.map((l) => l.urge).filter(Boolean)),
    topActions: topFrequencies(logs.map((l) => l.action).filter(Boolean)),
    satWithItCount: satWith.length,
    satWithItPct: n > 0 ? (satWith.length / n) * 100 : null,
    escapedCount: escaped.length,
    escapedPct: n > 0 ? (escaped.length / n) * 100 : null,
    delayedCount: delayed.length,
    delayedPct: n > 0 ? (delayed.length / n) * 100 : null,
    avgDelayDuration,
    hasOutcomeData: withOutcome.length > 0,
    improvedCount: improved.length,
    improvedPct: withOutcome.length > 0 ? (improved.length / withOutcome.length) * 100 : null,
  };
}

export interface WeeklyPoint {
  weekLabel: string;
  avgIntensity: number | null;
  avgConfidence: number | null;
  count: number;
}

export function computeWeeklyTrend(
  logs: CravingLog[],
  weeks = 10
): WeeklyPoint[] {
  const now = Date.now();
  return Array.from({ length: weeks }, (_, i) => {
    const wEnd = now - (weeks - 1 - i) * 7 * 86_400_000;
    const wStart = wEnd - 7 * 86_400_000;
    const week = logs.filter(
      (l) =>
        l.timestamp >= wStart &&
        l.timestamp < wEnd &&
        l.status === "completed"
    );
    const d = new Date(wStart);
    const weekLabel = `${d.getMonth() + 1}/${d.getDate()}`;
    return {
      weekLabel,
      avgIntensity: avgOf(week.map((l) => l.intensity)),
      avgConfidence: avgOf(
        week
          .map((l) => l.confidenceBefore)
          .filter((v): v is number => v != null)
      ),
      count: week.length,
    };
  });
}
