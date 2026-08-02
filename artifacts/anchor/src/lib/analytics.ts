import type { CravingLog, RelapseLog, AnxietyLog, BoredomLog } from "@/db";
import { logicalTimestamp } from "@/lib/registrationIds";
import {
  cravingRegistrationKind,
  explicitSafetyAnswer,
  registrationBoolean,
  registrationNumber,
  registrationOptionId,
  registrationOptionIds,
  type AttentionReason,
} from "@/lib/canonicalRegistration";

export type TimeRange = "7d" | "30d" | "90d" | "all";

/** Draft Craving/Relapse records are form state, not completed registrations. */
export function completedStatusEntries<T extends { status: "draft" | "completed" }>(
  items: T[],
): T[] {
  return items.filter((item) => item.status === "completed");
}

export type SobrietyStats = {
  totalDays: number;
  currentStreakDays: number;
  hasRelapse: boolean;
  startDate: string;
};

export function computeSobrietyStats(
  sobrietyStartDate: string | null,
  relapseLogs: RelapseLog[],
  now = Date.now(),
): SobrietyStats | null {
  if (!sobrietyStartDate) return null;
  const start = new Date(`${sobrietyStartDate}T00:00:00`).getTime();
  if (!Number.isFinite(start) || start > now) return null;
  const completedRelapses = completedStatusEntries(relapseLogs)
    .filter((entry) => logicalTimestamp(entry) >= start && logicalTimestamp(entry) <= now)
  const latestRelapse = completedRelapses
    .reduce((latest, entry) => Math.max(latest, logicalTimestamp(entry)), start);
  return {
    totalDays: Math.max(0, Math.floor((now - start) / 86_400_000)),
    currentStreakDays: Math.max(0, Math.floor((now - latestRelapse) / 86_400_000)),
    hasRelapse: completedRelapses.length > 0,
    startDate: sobrietyStartDate,
  };
}

export function computeCurrentStreakDays(
  sobrietyStartDate: string | null,
  relapseLogs: RelapseLog[],
  now = Date.now(),
): number | null {
  return computeSobrietyStats(sobrietyStartDate, relapseLogs, now)?.currentStreakDays ?? null;
}

export type CompletedRegistrationActivity = {
  completedCount: number;
  lastCompletedAt: number | null;
  daysSinceLastCompleted: number | null;
};

/** Neutral, factual Home summary. It never assigns a score or severity level. */
export function computeCompletedRegistrationActivity(
  logs: {
    cravingLogs: CravingLog[];
    relapseLogs: RelapseLog[];
    anxietyLogs: AnxietyLog[];
    boredomLogs: BoredomLog[];
  },
  now = Date.now(),
): CompletedRegistrationActivity {
  const completed = [
    ...completedStatusEntries(logs.cravingLogs),
    ...completedStatusEntries(logs.relapseLogs),
    ...logs.anxietyLogs,
    ...logs.boredomLogs,
  ];
  const timestamps = completed
    // This card describes completion activity, not when the recorded event
    // occurred. Legacy records predate completedAt and fall back to timestamp.
    .map((entry) => entry.completedAt ?? entry.timestamp)
    .filter((timestamp) => Number.isFinite(timestamp) && timestamp <= now);
  const lastCompletedAt = timestamps.length > 0 ? Math.max(...timestamps) : null;
  return {
    completedCount: completed.length,
    lastCompletedAt,
    daysSinceLastCompleted: lastCompletedAt == null
      ? null
      : Math.max(0, Math.floor((now - lastCompletedAt) / 86_400_000)),
  };
}

export function filterByRange<T extends { timestamp: number; occurredAt?: number | null }>(
  items: T[],
  range: TimeRange
): T[] {
  if (range === "all") return items;
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const cutoff = Date.now() - days * 86_400_000;
  return items.filter((i) => logicalTimestamp(i) >= cutoff);
}

export interface FreqItem {
  label: string;
  count: number;
}

export function topFrequencies(items: unknown[], n = 5): FreqItem[] {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const t = typeof item === "string" ? item.trim() : "";
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

export interface StrategyOutcome {
  strategy: string;
  total: number;
  notUsed: number;
  used: number;
  unsure: number;
  notUsedPct: number | null;
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
  withActionCount: number;
  actionUsedPct: number | null;
  hasOutcomeData: boolean;
  usedCount: number;
  notUsedCount: number;
  unsureCount: number;
  withUseOutcomeCount: number;
  reportedNotUsedPct: number | null;
  reportedOutcomesByAttemptedAction: StrategyOutcome[];
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
    .map((l) => registrationNumber(l, "intensity", l.intensity))
    .filter((v): v is number => v != null && v >= 0);
  const confBefore = done
    .map((l) => registrationNumber(l, "confidenceBefore", l.confidenceBefore))
    .filter((v): v is number => v != null && v >= 0);

  const pairedIntensity = done
    .map((log) => ({
      before: registrationNumber(log, "intensity", log.intensity),
      after: registrationNumber(log, "intensityAfter", log.intensityAfter),
    }))
    .filter((pair): pair is { before: number; after: number } => pair.before != null && pair.after != null);
  const drops = pairedIntensity.map(({ before, after }) => before - after);

  const pairedConf = done
    .map((log) => ({
      before: registrationNumber(log, "confidenceBefore", log.confidenceBefore),
      after: registrationNumber(log, "confidenceAfter", log.confidenceAfter),
    }))
    .filter((pair): pair is { before: number; after: number } => pair.before != null && pair.after != null);
  const lifts = pairedConf.map(({ before, after }) => after - before);

  const decreasedCount = done.filter(
    (l) => registrationOptionId(l, "cravingOutcome", l.cravingOutcome) === "decreased"
  ).length;
  const withAction = done.filter(
    (l) => {
      const action = registrationOptionId(l, "chosenAction", l.chosenAction);
      return action != null && action !== "document-only";
    }
  );

  const activeLogs = done.filter((l) => cravingRegistrationKind(l) === "trek");
  const passiveLogs = done.filter((l) => cravingRegistrationKind(l) === "craving");

  const activeIntensities = activeLogs
    .map((l) => registrationNumber(l, "intensity", l.intensity))
    .filter((v): v is number => v != null && v >= 0);
  const passiveIntensities = passiveLogs
    .map((l) => registrationNumber(l, "intensity", l.intensity))
    .filter((v): v is number => v != null && v >= 0);

  // Behavioral outcome is self-reported. It is not an effectiveness or causal signal.
  const withUseOutcome = done.filter((l) => registrationOptionId(l, "useOutcome", l.useOutcome) != null);
  const usedCount = done.filter((l) => registrationOptionId(l, "useOutcome", l.useOutcome) === "used").length;
  const notUsedCount = done.filter((l) => registrationOptionId(l, "useOutcome", l.useOutcome) === "not_used").length;
  const unsureCount = done.filter((l) => registrationOptionId(l, "useOutcome", l.useOutcome) === "unsure").length;

  // Descriptive correlation only, and only where the action was explicitly attempted.
  const strategyMap: Record<string, { notUsed: number; used: number; unsure: number }> = {};
  for (const l of withUseOutcome.filter((entry) => registrationBoolean(entry, "actionAttempted", entry.actionAttempted) === true)) {
    const key = registrationOptionId(l, "chosenAction", l.chosenAction) ?? "";
    if (!key) continue;
    const bucket = strategyMap[key] ?? { notUsed: 0, used: 0, unsure: 0 };
    const outcome = registrationOptionId(l, "useOutcome", l.useOutcome);
    if (outcome === "not_used") bucket.notUsed += 1;
    else if (outcome === "used") bucket.used += 1;
    else bucket.unsure += 1;
    strategyMap[key] = bucket;
  }
  const reportedOutcomesByAttemptedAction: StrategyOutcome[] = Object.entries(strategyMap)
    .map(([strategy, b]) => {
      const stratTotal = b.notUsed + b.used + b.unsure;
      return {
        strategy,
        total: stratTotal,
        notUsed: b.notUsed,
        used: b.used,
        unsure: b.unsure,
        notUsedPct: stratTotal > 0 ? (b.notUsed / stratTotal) * 100 : null,
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
    withActionCount: withAction.length,
    actionUsedPct: n > 0 ? (withAction.length / n) * 100 : null,
    hasOutcomeData: pairedIntensity.length > 0 || done.some((l) => registrationOptionId(l, "cravingOutcome", l.cravingOutcome) != null),
    usedCount,
    notUsedCount,
    unsureCount,
    withUseOutcomeCount: withUseOutcome.length,
    reportedNotUsedPct: withUseOutcome.length > 0 ? (notUsedCount / withUseOutcome.length) * 100 : null,
    reportedOutcomesByAttemptedAction,
    topSituations: topFrequencies(done.flatMap((l) =>
      cravingRegistrationKind(l) === "trek"
        ? registrationOptionIds(l, "triggers", l.triggers)
        : cravingRegistrationKind(l) === "craving"
          ? registrationOptionIds(l, "situations", l.situationPresets)
          : [])),
    topEmotions: topFrequencies(done.flatMap((l) => registrationOptionIds(l, "emotions", l.emotions))),
    topPhysical: topFrequencies(done.flatMap((l) => registrationOptionIds(l, "physicalSensations", l.physicalSensations))),
    topThoughts: topFrequencies(done.flatMap((l) => registrationOptionIds(l, "thoughts", l.thoughtPresets))),
    topSubstances: topFrequencies(done.flatMap((l) => registrationOptionIds(l, "targets", l.substances))),
    topLocations: topFrequencies(done.map((l) => registrationOptionId(l, "location", l.location)).filter(Boolean)),
    topSocialContexts: topFrequencies(done.flatMap((l) => registrationOptionIds(l, "socialContexts", l.socialContext))),
    topActions: topFrequencies(done.map((l) => registrationOptionId(l, "chosenAction", l.chosenAction)).filter(Boolean)),
    buildupDurations: topFrequencies(done.map((l) => registrationOptionId(l, "buildupDuration", l.buildupDuration)).filter(Boolean)),
    topPlanningStages: topFrequencies(activeLogs.map((l) => registrationOptionId(l, "planningStage", l.planningStage)).filter(Boolean)),
    topNeeds: topFrequencies(activeLogs.flatMap((l) => registrationOptionIds(l, "needs", l.needTypes?.length ? l.needTypes : l.needType ? [l.needType] : []))),
    topOnsetTypes: topFrequencies(passiveLogs.map((l) => registrationOptionId(l, "onsetType", l.onsetType)).filter(Boolean)),
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
          (Date.now() - Math.max(...done.map((l) => logicalTimestamp(l)))) / 86_400_000
        );

  const allHelped = done.flatMap((l) => registrationOptionIds(l, "couldHaveHelped", [
    ...(l.couldHaveHelpedEarly ?? []),
    ...(l.couldHaveHelpedMiddle ?? []),
    ...(l.couldHaveHelpedLast ?? []),
  ]));

  const labelCounts: Record<string, number> = {};
  done.forEach((l) => {
    const label = registrationOptionId(l, "label", l.label);
    if (label) labelCounts[label] = (labelCounts[label] ?? 0) + 1;
  });

  return {
    total: n,
    daysSinceLast,
    topFirstTriggerTypes: topFrequencies(
      done.map((l) => registrationOptionId(l, "firstTriggerType", l.firstTriggerType)).filter(Boolean)
    ),
    topMissedWarnings: topFrequencies(
      done.flatMap((l) => registrationOptionIds(l, "missedWarnings", l.missedWarnings)),
      6
    ),
    topThoughtsBefore: topFrequencies(
      done.flatMap((l) => registrationOptionIds(
        l,
        "preUseThoughts",
        l.preUseThoughtPresets?.length
          ? l.preUseThoughtPresets
          : l.preUseThoughtPreset
            ? [l.preUseThoughtPreset]
            : [],
      ))
    ),
    topCouldHaveHelped: topFrequencies(allHelped, 5),
    // A blank/missing answer is not the explicit "no one" selection.
    noSupportContactCount: done.filter((l) =>
      registrationOptionId(l, "supportContact", l.supportContact) === "no-one-right-now").length,
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
  const satWithIt = logs.filter((l) =>
    registrationOptionId(l, "reaction", l.reaction) === "sat-with-it-didnt-react");
  const avoided = logs.filter((l) =>
    registrationOptionId(l, "reaction", l.reaction) === "avoided-or-left");
  const withOutcome = logs.filter((l) => {
    const outcome = registrationOptionId(l, "outcomeAfter", l.outcomeAfter);
    return outcome != null && outcome !== "unknown";
  });
  const improved = logs.filter((l) =>
    registrationOptionId(l, "outcomeAfter", l.outcomeAfter) === "decreased");
  return {
    total: n,
    avgIntensity: avgOf(logs
      .map((l) => registrationNumber(l, "intensity", l.intensity))
      .filter((value): value is number => value != null)),
    topContexts: topFrequencies(logs
      .map((l) => registrationOptionId(l, "context", l.context))
      .filter(Boolean)),
    topTriggers: topFrequencies(logs.flatMap((l) => registrationOptionIds(
      l,
      "triggers",
      l.triggers?.length ? l.triggers : l.trigger ? [l.trigger] : [],
    ))),
    topReactions: topFrequencies(logs
      .map((l) => registrationOptionId(l, "reaction", l.reaction))
      .filter(Boolean)),
    topBodySensations: topFrequencies(logs.flatMap((l) => registrationOptionIds(
      l,
      "bodyLocations",
      l.bodyLocations?.length ? l.bodyLocations : l.bodySensations ?? [],
    ))),
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
  hasOutcomeData: boolean;
  improvedCount: number;
  improvedPct: number | null;
}

export function computeBoredomStats(logs: BoredomLog[]): BoredomStats {
  const n = logs.length;
  const satWith = logs.filter((l) =>
    registrationOptionId(l, "action", l.action) === "sat-with-it-didnt-react");
  const escaped = logs.filter((l) =>
    registrationOptionId(l, "action", l.action) === "escaped-immediately");
  const delayed = logs.filter(
    (l) => {
      const action = registrationOptionId(l, "action", l.action);
      return action === "delayed-action" || action === "sat-with-it-didnt-react";
    }
  );

  const withOutcome = logs.filter((l) => {
    const outcome = registrationOptionId(l, "outcomeAfter", l.outcomeAfter);
    return outcome != null && outcome !== "unknown";
  });
  const improved = logs.filter((l) =>
    registrationOptionId(l, "outcomeAfter", l.outcomeAfter) === "decreased");

  return {
    total: n,
    avgIntensity: avgOf(logs
      .map((l) => registrationNumber(l, "intensity", l.intensity))
      .filter((value): value is number => value != null)),
    topFeelingTypes: topFrequencies(logs.flatMap((l) => registrationOptionIds(
      l,
      "restlessnessTypes",
      l.restlessnessTypes?.length ? l.restlessnessTypes : l.feelingTypes,
    ))),
    topStimulationNeeds: topFrequencies(logs.flatMap((l) => registrationOptionIds(
      l,
      "stimulationNeeds",
      l.stimulationNeeds?.length
        ? l.stimulationNeeds
        : l.stimulationNeed
          ? [l.stimulationNeed]
          : [],
    ))),
    topSituations: topFrequencies(logs
      .map((l) => registrationOptionId(l, "situation", l.situation))
      .filter(Boolean)),
    topUrges: topFrequencies(logs
      .map((l) => registrationOptionId(l, "urge", l.urge))
      .filter(Boolean)),
    topActions: topFrequencies(logs
      .map((l) => registrationOptionId(l, "action", l.action))
      .filter(Boolean)),
    satWithItCount: satWith.length,
    satWithItPct: n > 0 ? (satWith.length / n) * 100 : null,
    escapedCount: escaped.length,
    escapedPct: n > 0 ? (escaped.length / n) * 100 : null,
    delayedCount: delayed.length,
    delayedPct: n > 0 ? (delayed.length / n) * 100 : null,
    hasOutcomeData: withOutcome.length > 0,
    improvedCount: improved.length,
    improvedPct: withOutcome.length > 0 ? (improved.length / withOutcome.length) * 100 : null,
  };
}

export interface AttentionStats {
  answeredCount: number;
  needsAttentionCount: number;
  reasons: Record<AttentionReason, number>;
}

/**
 * Count only explicit answers to dedicated safety questions. The function does
 * not inspect intensity, legacy highRiskFlag, outcomes, or chosen actions.
 */
export function computeAttentionStats(logs: {
  cravingLogs: CravingLog[];
  relapseLogs: RelapseLog[];
  anxietyLogs: AnxietyLog[];
  boredomLogs: BoredomLog[];
}): AttentionStats {
  const entries = [
    ...logs.cravingLogs.filter((record) => record.status === "completed").map((record) => explicitSafetyAnswer(
      cravingRegistrationKind(record) ?? "craving",
      record,
    )),
    ...logs.relapseLogs.filter((record) => record.status === "completed").map((record) => explicitSafetyAnswer("relapse", record)),
    ...logs.anxietyLogs.map((record) => explicitSafetyAnswer("anxiety", record)),
    ...logs.boredomLogs.map((record) => explicitSafetyAnswer("boredom", record)),
  ];
  const reasons: Record<AttentionReason, number> = {
    "anxiety-urgent": 0,
    "relapse-unsafe": 0,
    "relapse-continued-use": 0,
    "relapse-withdrawal": 0,
    "relapse-self-harm": 0,
  };
  for (const entry of entries) {
    for (const reason of entry.reasons) reasons[reason] += 1;
  }
  return {
    answeredCount: entries.filter((entry) => entry.answered).length,
    needsAttentionCount: entries.filter((entry) => entry.needsAttention).length,
    reasons,
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
  weeks = 10,
  locale = "en-GB",
): WeeklyPoint[] {
  const now = Date.now();
  return Array.from({ length: weeks }, (_, i) => {
    const wEnd = now - (weeks - 1 - i) * 7 * 86_400_000;
    const wStart = wEnd - 7 * 86_400_000;
    const week = logs.filter(
      (l) =>
        logicalTimestamp(l) >= wStart &&
        logicalTimestamp(l) < wEnd &&
        l.status === "completed"
    );
    const d = new Date(wStart);
    const weekLabel = d.toLocaleDateString(locale, { day: "numeric", month: "numeric" });
    return {
      weekLabel,
      avgIntensity: avgOf(
        week
          .map((l) => registrationNumber(l, "intensity", l.intensity))
          .filter((value): value is number => value != null)
      ),
      avgConfidence: avgOf(
        week
          .map((l) => registrationNumber(l, "confidenceBefore", l.confidenceBefore))
          .filter((v): v is number => v != null)
      ),
      count: week.length,
    };
  });
}
