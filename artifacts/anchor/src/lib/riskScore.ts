import type { JournalEntry, CravingLog, RelapseLog, AnxietyLog, BoredomLog } from "@/db";

export type RiskLevel = "low" | "medium" | "high" | "none";

export interface RiskResult {
  score: number;
  level: RiskLevel;
  label: string;
  factors: string[];
}

interface RiskInputs {
  cravingLogs: CravingLog[];
  relapseLogs: RelapseLog[];
  anxietyLogs: AnxietyLog[];
  boredomLogs: BoredomLog[];
  journalEntries: JournalEntry[];
}

const DAY_MS = 1000 * 60 * 60 * 24;

function daysSince(timestamp: number): number {
  return Math.floor((Date.now() - timestamp) / DAY_MS);
}

function daysSinceLastLog(inputs: RiskInputs): number | null {
  const allLogs = [
    ...inputs.cravingLogs,
    ...inputs.anxietyLogs,
    ...inputs.boredomLogs,
  ];
  if (!allLogs.length) return null;
  const last = allLogs.sort((a, b) => b.timestamp - a.timestamp)[0];
  return daysSince(last.timestamp);
}

function lastLogIntensity(inputs: RiskInputs): number | null {
  const allLogs = [
    ...inputs.cravingLogs,
    ...inputs.anxietyLogs,
    ...inputs.boredomLogs,
  ];
  if (!allLogs.length) return null;
  const last = allLogs.sort((a, b) => b.timestamp - a.timestamp)[0];
  return last.intensity ?? null;
}

function recentRelapseCount(inputs: RiskInputs): number {
  const thirtyDaysAgo = Date.now() - 30 * DAY_MS;
  return inputs.relapseLogs.filter((r) => r.timestamp >= thirtyDaysAgo).length;
}

function daysSinceLastJournal(inputs: RiskInputs): number | null {
  if (!inputs.journalEntries.length) return null;
  const last = inputs.journalEntries.reduce((latest, entry) =>
    entry.timestamp > latest.timestamp ? entry : latest,
  );
  return daysSince(last.timestamp);
}

export function calculateRiskScore(inputs: RiskInputs): RiskResult {
  const factors: string[] = [];

  // No data at all
  if (
    !inputs.cravingLogs.length &&
    !inputs.anxietyLogs.length &&
    !inputs.boredomLogs.length &&
    !inputs.relapseLogs.length &&
    !inputs.journalEntries.length
  ) {
    return { score: 0, level: "none", label: "home.risk.level.none", factors: [] };
  }

  let score = 0;

  // 1. Days since last log (max 35)
  const dsll = daysSinceLastLog(inputs);
  if (dsll != null) {
    if (dsll === 0) {
      score += 0;
    } else if (dsll <= 2) {
      score += 5;
    } else if (dsll <= 5) {
      score += 15;
      factors.push("home.risk.factor.several_days");
    } else if (dsll <= 10) {
      score += 25;
      factors.push("home.risk.factor.over_week");
    } else {
      score += 35;
      factors.push("home.risk.factor.over_ten_days");
    }
  } else {
    score += 20;
    factors.push("home.risk.factor.no_logs");
  }

  // 2. Last log intensity (max 25)
  const intensity = lastLogIntensity(inputs);
  if (intensity != null) {
    if (intensity <= 3) {
      score += 0;
    } else if (intensity <= 5) {
      score += 5;
    } else if (intensity <= 7) {
      score += 10;
    } else if (intensity <= 9) {
      score += 20;
      factors.push("home.risk.factor.high_intensity");
    } else {
      score += 25;
      factors.push("home.risk.factor.very_high_intensity");
    }
  }

  // 3. Relapse events (max 30)
  const rc = recentRelapseCount(inputs);
  if (rc >= 2) {
    score += 30;
    factors.push("home.risk.factor.multiple_relapses");
  } else if (rc === 1) {
    score += 15;
    factors.push("home.risk.factor.recent_relapse");
  }

  // 4. Missed journals (max 10)
  const dsj = daysSinceLastJournal(inputs);
  if (dsj != null) {
    if (dsj > 7) {
      score += 10;
      factors.push("home.risk.factor.no_journal_week");
    }
  } else {
    score += 5;
  }

  // Cap at 100
  score = Math.min(score, 100);

  let level: RiskLevel;
  let label: string;
  if (score <= 33) {
    level = "low";
    label = "home.risk.level.low";
  } else if (score <= 66) {
    level = "medium";
    label = "home.risk.level.medium";
  } else {
    level = "high";
    label = "home.risk.level.high";
  }

  return { score, level, label, factors };
}
