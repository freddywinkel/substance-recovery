import { describe, expect, it } from "vitest";
import { computeCigaretteStats } from "../src/lib/cigaretteStats";
import { validateImportedStoreRecord } from "../src/db/validation";

describe("cigarette statistics use observed history only", () => {
  const now = new Date(2026, 9, 12, 12).getTime();
  const record = (id: string, timestamp: number) => ({ id, timestamp });

  it("preserves valid future imports while excluding them from today's counts and elapsed time", () => {
    const future = record("synthetic-future", now + 86_400_000);
    expect(validateImportedStoreRecord("cigaretteLogs", future).ok).toBe(true);
    const logs = [future];
    expect(computeCigaretteStats(logs, now)).toMatchObject({ todayCount: 0, weekCount: 0, monthCount: 0, avgPerDayWeek: null, timeSinceLastMs: null });
    expect(logs).toEqual([future]);
    expect(computeCigaretteStats(logs, future.timestamp)).toMatchObject({ todayCount: 1, timeSinceLastMs: 0 });
  });

  it("excludes deleted and invalid rows from totals, intervals, and trends without mutating history", () => {
    const real = [record("synthetic-first", now - 7_200_000), record("synthetic-second", now - 3_600_000)];
    const logs = [...real, { ...record("synthetic-deleted", now - 1_000), deleted: true }, record("synthetic-invalid", NaN), record("synthetic-infinite", Infinity), record("synthetic-negative", -1), record("synthetic-future", now + 1_000)];
    const snapshot = structuredClone(logs);
    expect(computeCigaretteStats(logs, now)).toEqual(computeCigaretteStats(real, now));
    expect(logs).toEqual(snapshot);
    expect(computeCigaretteStats(real, now)).toMatchObject({ todayCount: 2, timeSinceLastMs: 3_600_000, avgGapMinutes: 60, longestGapTodayMinutes: 60 });
  });

  it("changes elapsed time and local day totals as the supplied clock advances without new records", () => {
    const beforeMidnight = new Date(2026, 9, 12, 23, 59).getTime();
    const logs = [record("synthetic-midnight", beforeMidnight)];
    expect(computeCigaretteStats(logs, beforeMidnight)).toMatchObject({ todayCount: 1, timeSinceLastMs: 0 });
    expect(computeCigaretteStats(logs, beforeMidnight + 60_000)).toMatchObject({ todayCount: 0, timeSinceLastMs: 60_000, weekCount: 1 });
  });
});
