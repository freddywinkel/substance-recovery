import { describe, expect, it, vi } from "vitest";
import type { RelapseLog } from "../src/db/schema";
import {
  computeGoalProgress,
  computeSobrietyStats,
  type ProgressGoal,
} from "../src/lib/analytics";
import type { QuickRegistrationRecord } from "../src/lib/recoveryFeatures";
import { toStableOptionId } from "../src/lib/registrationIds";
import { blankUseDetail } from "../src/lib/useDetails";
import type { UsePeriodRecord } from "../src/lib/usePeriods";
import { headRelapseV2 } from "./fixtures/deployed-v2-records";

const localAt = (date: string, time = "12:00:00") =>
  new Date(`${date}T${time}`).getTime();
const now = localAt("2026-10-09");
const goal: ProgressGoal = {
  id: "alcohol-goal",
  target: "Alcohol",
  type: "reduction",
  description: "My personal goal",
  startDate: "2026-09-01",
  active: true,
  showProgress: true,
};
const emptySources: Parameters<typeof computeGoalProgress>[1] = {
  cravingLogs: [],
  relapseLogs: [],
  cigaretteLogs: [],
  quickRegistrations: [],
  usePeriods: [],
};
const period = (overrides: Partial<UsePeriodRecord> = {}): UsePeriodRecord => ({
  id: "period-a",
  recordType: "use-period",
  timestamp: now,
  updatedAt: now,
  target: "Alcohol",
  startDate: "2026-09-01",
  endDate: "2026-09-14",
  frequency: "daily",
  note: "",
  ...overrides,
});
const moment = (id: string, date: string, target = "Alcohol"): RelapseLog => ({
  ...headRelapseV2,
  acuteRisks: [],
  id,
  timestamp: localAt(date),
  occurredAt: localAt(date),
  substances: [target],
  answers: { ...headRelapseV2.answers, substances: [toStableOptionId(target)] },
});
const quick = (id: string, date: string): QuickRegistrationRecord => ({
  id,
  recordType: "quick-registration",
  timestamp: localAt(date),
  occurredAt: localAt(date),
  updatedAt: now,
  registrationType: "relapse",
  intensity: null,
  target: "Alcohol",
  useOutcome: "used",
  immediateSafety: "safe-for-now",
  chosenAction: "document-only",
  chosenActionOther: "",
  note: "",
  reflectionStatus: "pending",
  reflectionDueAt: now,
  reflectionStartedAt: null,
  reflectionCompletedAt: null,
  linkedDetailedRecordId: null,
});

describe("retrospective use in goal progress", () => {
  it("includes a two-week period without inventing fourteen individual moments or a use time", () => {
    const [result] = computeGoalProgress(
      [goal],
      { ...emptySources, usePeriods: [period()] },
      now,
    );
    expect(result).toMatchObject({
      confirmedUseEpisodes: 0,
      recordedUsePeriods: 1,
      totalUseRecords: 1,
      reportedUseDays: 14,
      useDaysAreMinimum: false,
      lastRecordedUseAt: null,
      lastRecordedUseDate: "2026-09-14",
      daysSinceLastRecordedUse: 25,
    });
  });

  it("retains linked moment evidence but does not add covered moments again to the total", () => {
    const detail = moment("detail-in-period", "2026-09-07");
    const linked = {
      ...quick("quick-in-period", "2026-09-07"),
      reflectionStatus: "completed" as const,
      reflectionCompletedAt: now,
      linkedDetailedRecordId: detail.id,
    };
    const [result] = computeGoalProgress(
      [goal],
      {
        ...emptySources,
        usePeriods: [period()],
        quickRegistrations: [linked],
        relapseLogs: [detail, moment("outside", "2026-09-20")],
      },
      now,
    );
    expect(result).toMatchObject({
      confirmedUseEpisodes: 2,
      coveredUseEpisodes: 1,
      recordedUsePeriods: 1,
      totalUseRecords: 2,
      reportedUseDays: 15,
      lastRecordedUseDate: "2026-09-20",
    });
  });

  it("uses explicit per-target time for period coverage, goal scope and linked quick day evidence", () => {
    const detail: RelapseLog = {
      ...moment("mixed-target-event", "2026-09-07"),
      substances: ["Alcohol", "Opioids"],
      answers: {
        ...headRelapseV2.answers,
        substances: ["alcohol", "opioids"],
        useDetailsJson: JSON.stringify([
          { ...blankUseDetail("Alcohol"), occurredAt: "2026-09-07T12:00" },
          { ...blankUseDetail("Opioids"), occurredAt: "2026-09-14T18:00" },
        ]),
      },
    };
    const linked: QuickRegistrationRecord = {
      ...quick("linked-opioids", "2026-09-07"),
      target: "Opioids",
      reflectionStatus: "completed",
      reflectionCompletedAt: now,
      linkedDetailedRecordId: detail.id,
    };
    const sources = {
      ...emptySources,
      relapseLogs: [detail],
      quickRegistrations: [linked],
      usePeriods: [
        period({
          target: "Opioids",
          startDate: "2026-09-14",
          endDate: "2026-09-14",
        }),
      ],
    };
    const [alcohol, opioids] = computeGoalProgress(
      [
        goal,
        { ...goal, id: "opioids", target: "Opioids", startDate: "2026-09-10" },
      ],
      sources,
      now,
    );
    expect(alcohol).toMatchObject({
      confirmedUseEpisodes: 1,
      totalUseRecords: 1,
      lastRecordedUseDate: "2026-09-07",
    });
    expect(opioids).toMatchObject({
      confirmedUseEpisodes: 1,
      coveredUseEpisodes: 1,
      totalUseRecords: 1,
      reportedUseDays: 1,
      lastRecordedUseDate: "2026-09-14",
      lastRecordedUseAt: localAt("2026-09-14", "18:00:00"),
    });
    expect(
      computeGoalProgress(
        [{ ...goal, target: "Opioids" }],
        { ...sources, usePeriods: [] },
        now,
      )[0],
    ).toMatchObject({
      confirmedUseEpisodes: 1,
      reportedUseDays: 1,
      lastRecordedUseDate: "2026-09-14",
    });
  });

  it("keeps as-prescribed linked evidence excluded when a target-specific use time differs", () => {
    const detail = moment("prescribed-target-time", "2026-09-07", "Opioids");
    detail.useDetails = [
      {
        ...blankUseDetail("Opioids"),
        occurredAt: "2026-09-14T18:00",
        prescribedUse: "as-prescribed",
      },
    ];
    const linked: QuickRegistrationRecord = {
      ...quick("linked-prescribed", "2026-09-07"),
      target: "Opioids",
      reflectionStatus: "completed",
      reflectionCompletedAt: now,
      linkedDetailedRecordId: detail.id,
    };
    const [result] = computeGoalProgress(
      [{ ...goal, target: "Opioids", startDate: "2026-09-10" }],
      {
        ...emptySources,
        relapseLogs: [detail],
        quickRegistrations: [linked],
      },
      now,
    );
    expect(result).toMatchObject({
      excludedAsPrescribed: 1,
      confirmedUseEpisodes: 0,
      reportedUseDays: 0,
      lastRecordedUseDate: null,
    });
  });

  it.each(["2099-01-01T12:00", "2026-02-30T12:00"])(
    "falls back to logical event time for an invalid or future target time: %s",
    (occurredAt) => {
      const detail = moment("unusable-target-time", "2026-09-07");
      detail.useDetails = [{ ...blankUseDetail("Alcohol"), occurredAt }];
      const [result] = computeGoalProgress(
        [goal],
        { ...emptySources, relapseLogs: [detail] },
        now,
      );
      expect(result).toMatchObject({
        confirmedUseEpisodes: 1,
        reportedUseDays: 1,
        lastRecordedUseDate: "2026-09-07",
        lastRecordedUseAt: detail.occurredAt,
      });
    },
  );

  it("counts only reported boundary days for unknown frequency and adds explicit interior evidence", () => {
    const [result] = computeGoalProgress(
      [goal],
      {
        ...emptySources,
        usePeriods: [period({ frequency: "unknown" })],
        relapseLogs: [
          moment("known-day", "2026-09-07"),
          moment("second-moment-same-day", "2026-09-07"),
        ],
      },
      now,
    );
    expect(result).toMatchObject({
      confirmedUseEpisodes: 2,
      coveredUseEpisodes: 2,
      totalUseRecords: 1,
      reportedUseDays: 3,
      useDaysAreMinimum: true,
      lastRecordedUseDate: "2026-09-14",
    });
    const [singleDay] = computeGoalProgress(
      [goal],
      {
        ...emptySources,
        usePeriods: [
          period({ startDate: "2026-09-14", frequency: "some-days" }),
        ],
      },
      now,
    );
    expect(singleDay).toMatchObject({
      reportedUseDays: 1,
      useDaysAreMinimum: false,
    });
  });

  it("does not claim an uncertain lower bound when every day has explicit evidence", () => {
    const [result] = computeGoalProgress(
      [goal],
      {
        ...emptySources,
        usePeriods: [period({ endDate: "2026-09-03", frequency: "some-days" })],
        relapseLogs: [moment("interior", "2026-09-02")],
      },
      now,
    );
    expect(result).toMatchObject({
      reportedUseDays: 3,
      useDaysAreMinimum: false,
    });
  });

  it("clips daily coverage to the goal start without manufacturing a some-days boundary", () => {
    const sources = { ...emptySources, usePeriods: [period()] };
    const [daily] = computeGoalProgress(
      [{ ...goal, startDate: "2026-09-10" }],
      sources,
      now,
    );
    expect(daily).toMatchObject({ reportedUseDays: 5, recordedUsePeriods: 1 });
    const [some] = computeGoalProgress(
      [{ ...goal, startDate: "2026-09-10" }],
      {
        ...sources,
        usePeriods: [period({ frequency: "some-days" })],
      },
      now,
    );
    expect(some).toMatchObject({ reportedUseDays: 1, useDaysAreMinimum: true });
  });

  it("defensively unions overlapping restored periods but retains adjacent distinct periods", () => {
    const [result] = computeGoalProgress(
      [goal],
      {
        ...emptySources,
        usePeriods: [
          period(),
          period(),
          period({
            id: "overlap",
            startDate: "2026-09-07",
            endDate: "2026-09-20",
          }),
          period({
            id: "adjacent",
            startDate: "2026-09-21",
            endDate: "2026-09-22",
          }),
        ],
      },
      now,
    );
    expect(result).toMatchObject({
      recordedUsePeriods: 2,
      totalUseRecords: 2,
      reportedUseDays: 22,
    });
  });

  it("shows opted-in goals without an optional start date and keeps target scopes separate", () => {
    const [all] = computeGoalProgress(
      [{ ...goal, startDate: "" }],
      {
        ...emptySources,
        relapseLogs: [moment("old", "2026-08-01")],
        usePeriods: [period({ target: "Cannabis" })],
      },
      now,
    );
    expect(all).toMatchObject({
      elapsedDays: null,
      confirmedUseEpisodes: 1,
      recordedUsePeriods: 0,
      reportedUseDays: 1,
    });
    expect(
      computeGoalProgress([{ ...goal, active: false }], emptySources, now),
    ).toEqual([]);
    expect(
      computeGoalProgress(
        [{ ...goal, showProgress: false }],
        emptySources,
        now,
      ),
    ).toEqual([]);
  });

  it("excludes invalid, future, out-of-goal, draft and prescribed evidence", () => {
    const prescribed = moment("prescribed", "2026-10-01", "Opioids");
    prescribed.useDetails = [
      { ...blankUseDetail("Opioids"), prescribedUse: "as-prescribed" },
    ];
    const [result] = computeGoalProgress(
      [{ ...goal, target: "Opioids" }],
      {
        ...emptySources,
        relapseLogs: [
          prescribed,
          { ...moment("draft", "2026-10-02", "Opioids"), status: "draft" },
        ],
        usePeriods: [
          period({ target: "Opioids", startDate: "2026-02-30" }),
          period({
            id: "future",
            target: "Opioids",
            startDate: "2026-10-09",
            endDate: "2026-10-10",
          }),
          period({
            id: "old",
            target: "Opioids",
            startDate: "2026-08-01",
            endDate: "2026-08-02",
          }),
        ],
      },
      now,
    );
    expect(result).toMatchObject({
      excludedAsPrescribed: 1,
      confirmedUseEpisodes: 0,
      recordedUsePeriods: 0,
      totalUseRecords: 0,
      reportedUseDays: 0,
      lastRecordedUseDate: null,
    });
    expect(
      computeGoalProgress(
        [{ ...goal, startDate: "2026-02-30" }],
        emptySources,
        now,
      ),
    ).toEqual([]);
    expect(
      computeGoalProgress(
        [{ ...goal, startDate: "2026-10-10" }],
        emptySources,
        now,
      ),
    ).toEqual([]);
  });

  it("uses calendar days across daylight saving and at midnight, instead of elapsed 24-hour blocks", () => {
    vi.stubEnv("TZ", "Europe/Amsterdam");
    try {
      const at = localAt("2026-03-30", "00:10:00");
      const [result] = computeGoalProgress(
        [{ ...goal, startDate: "2026-03-28" }],
        {
          ...emptySources,
          relapseLogs: [
            {
              ...moment("late-yesterday", "2026-03-29"),
              occurredAt: localAt("2026-03-29", "23:50:00"),
            },
          ],
        },
        at,
      );
      expect(result).toMatchObject({
        elapsedDays: 2,
        daysSinceLastRecordedUse: 1,
        lastRecordedUseDate: "2026-03-29",
      });
      expect(computeSobrietyStats("2026-03-28", [], at)).toMatchObject({
        totalDays: 2,
      });
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
