import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildReviewRegistrations,
  buildSelectiveReport,
  buildWeeklyReviewSummary,
  getLocalWeekRange,
  formatSafetyObservations,
} from "../src/lib/recoveryProgress";
import { computeGoalProgress, type ProgressGoal } from "../src/lib/analytics";
import {
  applyRegistrationCorrection,
  correctionAnswers,
} from "../src/components/RegistrationCorrection";
import {
  headRelapseV2WithFollowUp,
  headTrekV2,
} from "./fixtures/deployed-v2-records";
import {
  clearAllData,
  addRelapseLog,
  saveFeatureRecord,
  updateRegistrationEpisode,
  getRelapseLogs,
  getFeatureRecords,
  exportAllData,
  deleteRegistrationEpisode,
  reconcileQuickReflectionLinks,
} from "../src/db/crud";
import type { QuickRegistrationRecord } from "../src/lib/recoveryFeatures";
import type { CravingLog, RelapseLog } from "../src/db/schema";
import { blankUseDetail } from "../src/lib/useDetails";
import {
  buildTrekAnswers,
  createBlankTrekDraft,
} from "../src/pages/TrekTracker";
import { validateImportedStoreRecord } from "../src/db/validation";

const sunday = new Date(2026, 8, 6, 20).getTime();
const monday = new Date(2026, 8, 7, 10).getTime();
const now = new Date(2026, 8, 8, 12).getTime();
const quick = (
  overrides: Partial<QuickRegistrationRecord> = {},
): QuickRegistrationRecord => ({
  id: "quick",
  recordType: "quick-registration",
  timestamp: monday,
  updatedAt: monday,
  registrationType: "relapse",
  intensity: 7,
  immediateSafety: "safe-for-now",
  chosenAction: "trusted-contact",
  chosenActionOther: "",
  note: "quick note",
  reflectionStatus: "completed",
  reflectionDueAt: monday + 600000,
  reflectionStartedAt: monday + 1,
  reflectionCompletedAt: monday + 100,
  linkedDetailedRecordId: "detail",
  ...overrides,
});
const relapse = (): RelapseLog => ({
  ...structuredClone(headRelapseV2WithFollowUp),
  id: "detail",
  timestamp: sunday,
  occurredAt: sunday,
  startedAt: monday,
  completedAt: monday + 100,
  answers: {
    ...headRelapseV2WithFollowUp.answers,
    quickRegistrationId: "quick",
    acuteRisks: ["withdrawal", "self-harm-risk"],
    substances: ["alcohol"],
  },
  acuteRisks: ["withdrawal", "self-harm-risk"],
  substances: ["Alcohol"],
});
const empty = () => ({
  cravingLogs: [],
  relapseLogs: [],
  anxietyLogs: [],
  boredomLogs: [],
  quickRegistrations: [],
});
const goal = (target = "Alcohol"): ProgressGoal => ({
  id: target,
  target,
  type: "abstinence",
  description: "Personal goal",
  startDate: "2026-09-01",
  active: true,
  showProgress: true,
});

describe("event and source provenance", () => {
  it("keeps a Sunday event in Sunday’s week despite a Monday quick entry and reflection", () => {
    const entries = buildReviewRegistrations({
      ...empty(),
      relapseLogs: [relapse()],
      quickRegistrations: [quick()],
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      timestamp: sunday,
      quickRecordedAt: monday,
      reflectionStartedAt: monday,
      reflectionCompletedAt: monday + 100,
    });
    expect(
      buildWeeklyReviewSummary(entries, getLocalWeekRange(sunday)).entries,
    ).toHaveLength(1);
    expect(
      buildWeeklyReviewSummary(entries, getLocalWeekRange(monday)).entries,
    ).toHaveLength(0);
  });
  it("exports every source-specific safety answer even with date and source columns omitted", () => {
    const entries = buildReviewRegistrations({
      ...empty(),
      relapseLogs: [relapse()],
      quickRegistrations: [quick()],
    });
    const report = buildSelectiveReport({
      registrations: entries,
      recoveryActions: [],
      range: { start: sunday - 1, endExclusive: now },
      fields: ["immediate-safety"],
    });
    expect(Object.keys(report.registrations[0].values)).toEqual([
      "immediate-safety",
    ]);
    const safety = entries[0].safetyObservations;
    expect(safety).toMatchObject([
      { source: "quick", recordedAt: monday, values: ["safe-for-now"] },
      {
        source: "detailed",
        recordedAt: monday + 100,
        values: ["relapse-withdrawal", "relapse-self-harm"],
      },
    ]);
    expect(formatSafetyObservations(safety, "nl")).toContain("ontwenning");
    expect(formatSafetyObservations(safety, "nl")).toContain(
      "schade aan zichzelf",
    );
    expect(
      buildSelectiveReport({
        registrations: entries,
        recoveryActions: [],
        range: { start: 0, endExclusive: now },
        fields: ["notes"],
      }).registrations[0].values,
    ).not.toHaveProperty("immediate-safety");
  });
  it("retains equal measurements as two observations and keeps canonical null unanswered", () => {
    const detail: CravingLog = {
      ...headTrekV2,
      id: "detail",
      intensity: 7,
      answers: {
        ...headTrekV2.answers,
        intensity: null,
        quickRegistrationId: "quick",
      },
    };
    const entry = buildReviewRegistrations({
      ...empty(),
      cravingLogs: [detail],
      quickRegistrations: [quick({ registrationType: "trek" })],
    })[0];
    expect(entry.intensityObservations.map((value) => value.value)).toEqual([
      7,
      null,
    ]);
    expect(entry.laterIntensity).toBeNull();
    detail.answers!.intensity = 7;
    expect(
      buildReviewRegistrations({
        ...empty(),
        cravingLogs: [detail],
        quickRegistrations: [quick({ registrationType: "trek" })],
      })[0].intensityObservations,
    ).toHaveLength(2);
  });
  it("reports the full selected range beyond former read limits", () => {
    const entries = buildReviewRegistrations({
      ...empty(),
      quickRegistrations: Array.from({ length: 1051 }, (_, i) =>
        quick({
          id: "q" + i,
          timestamp: sunday + i,
          linkedDetailedRecordId: null,
          intensity: null,
        }),
      ),
    });
    const report = buildSelectiveReport({
      registrations: entries,
      recoveryActions: [],
      range: { start: sunday, endExclusive: now },
      fields: ["summary", "date"],
    });
    expect(report.summary?.registrationCount).toBe(1051);
    expect(report.registrations).toHaveLength(1051);
    expect(
      buildWeeklyReviewSummary(entries, getLocalWeekRange(sunday))
        .intensityAnsweredCount,
    ).toBe(0);
  });
});

describe("goal-aware reported observations", () => {
  const sources = () => ({
    cravingLogs: [] as CravingLog[],
    relapseLogs: [] as RelapseLog[],
    cigaretteLogs: [],
    quickRegistrations: [] as QuickRegistrationRecord[],
  });
  it("does not invent abstinence when nothing or an unknown outcome is recorded", () => {
    expect(computeGoalProgress([goal()], sources(), now)[0]).toMatchObject({
      confirmedUseEpisodes: 0,
      lastRecordedUseAt: null,
      daysSinceLastRecordedUse: null,
      explicitNotUsedObservations: 0,
    });
    expect(
      computeGoalProgress(
        [goal()],
        {
          ...sources(),
          quickRegistrations: [
            quick({ target: "Alcohol", useOutcome: "unsure" }),
          ],
        },
        now,
      )[0],
    ).toMatchObject({
      confirmedUseEpisodes: 0,
      unknownOutcomeObservations: 1,
      lastRecordedUseAt: null,
    });
  });
  it("deduplicates linked use while preserving explicit quick evidence if reflection is unanswered", () => {
    const detail = {
      ...headTrekV2,
      id: "trek",
      occurredAt: sunday,
      timestamp: sunday,
      completedAt: monday,
      answers: {
        ...headTrekV2.answers,
        quickRegistrationId: "q",
        targets: ["alcohol"],
        useOutcome: "used",
      },
    } as CravingLog;
    const q = quick({
      id: "q",
      registrationType: "trek",
      linkedDetailedRecordId: "trek",
      target: "Alcohol",
      useOutcome: "used",
    });
    expect(
      computeGoalProgress(
        [goal()],
        { ...sources(), cravingLogs: [detail], quickRegistrations: [q] },
        now,
      )[0].confirmedUseEpisodes,
    ).toBe(1);
    detail.answers = { ...detail.answers, targets: null, useOutcome: "unsure" };
    expect(
      computeGoalProgress(
        [goal()],
        { ...sources(), cravingLogs: [detail], quickRegistrations: [q] },
        now,
      )[0],
    ).toMatchObject({ confirmedUseEpisodes: 1, lastRecordedUseAt: sunday });
  });
  it("keeps nicotine and unrelated targets separate and excludes prescribed medication", () => {
    const prescribed = {
      ...relapse(),
      substances: ["Benzodiazepines"],
      answers: {
        ...relapse().answers,
        substances: ["benzodiazepines"],
        useDetailsJson: JSON.stringify([
          {
            ...blankUseDetail("Benzodiazepines"),
            prescribedUse: "as-prescribed",
          },
        ]),
      },
    };
    const input = {
      ...sources(),
      relapseLogs: [prescribed],
      cigaretteLogs: [{ id: "cig", timestamp: sunday, note: "" }],
      quickRegistrations: [
        quick({ target: "Benzodiazepines", useOutcome: "used" }),
      ],
    };
    const values = computeGoalProgress(
      [goal(), goal("Nicotine"), goal("Benzodiazepines")],
      input as never,
      now,
    );
    expect(values[0].confirmedUseEpisodes).toBe(0);
    expect(values[1].confirmedUseEpisodes).toBe(1);
    expect(values[2]).toMatchObject({
      confirmedUseEpisodes: 0,
      excludedAsPrescribed: 1,
    });
  });
});

describe("corrected episode persistence and lifecycle", () => {
  beforeEach(async () => clearAllData());
  afterEach(async () => clearAllData());
  it("does not turn an old default safety false into an explicit answer while preparing a correction", () => {
    const answers = correctionAnswers({ id: "legacy", timestamp: sunday, dataVersion: 1, urgencyHigh: false, note: "keep note", intensity: null, context: "", trigger: "", reaction: "", bodySensations: [] }, "anxiety");
    expect(answers.urgencyHigh).toBeNull();
    expect(answers.note).toBe("keep note");
  });
  it("preserves explicit canonical null and allows correcting old v3 records without use-details fields", () => {
    expect(
      correctionAnswers(
        {
          ...headTrekV2,
          answers: { ...headTrekV2.answers, note: null },
          note: "stale hidden note",
        },
        "trek",
      ).note,
    ).toBeNull();
    const answers = buildTrekAnswers({
      ...createBlankTrekDraft(),
      trekTypes: ["approach-mental-rehearsal"],
      planningStage: "immediacy-thoughts-only",
      triggers: ["Stress"],
      needTypes: ["Relief"],
      chosenAction: "just-observe",
      actionAttempted: false,
      useOutcome: "unsure",
    });
    delete answers.useDetailsJson;
    const original = {
      ...headTrekV2,
      dataVersion: 3,
      contentVersion: "registration-v3",
      answers,
    };
    const corrected = applyRegistrationCorrection(
      original,
      "trek",
      { ...answers, note: "a correction" },
      original.occurredAt,
      [],
      now,
    );
    expect(corrected.answers?.useDetailsJson).toBeNull();
    expect((corrected as CravingLog).useDetails).toEqual([]);
    const result = validateImportedStoreRecord("cravingLogs", corrected);
    expect(result.ok, result.ok ? "" : result.error).toBe(true);
  });
  it("saves corrected time, target, safety and note consistently through reload/export", async () => {
    await addRelapseLog(relapse());
    await saveFeatureRecord(quick());
    const current = (await getRelapseLogs())[0];
    const answers = {
      ...correctionAnswers(current, "relapse"),
      substances: ["nicotine"],
      note: "corrected note",
      acuteRisks: ["none"],
    };
    const corrected = applyRegistrationCorrection(
      current,
      "relapse",
      answers,
      sunday - 3600000,
      [],
      now,
    );
    const correctedQuick = {
      ...quick(),
      occurredAt: sunday - 3600000,
      createdAt: monday,
      editedAt: now,
      updatedAt: now,
    };
    await updateRegistrationEpisode({
      type: "relapse",
      detailedRecord: corrected,
      quickRecord: correctedQuick,
    });
    const reloaded = (await getRelapseLogs())[0];
    expect(reloaded).toMatchObject({
      timestamp: sunday - 3600000,
      occurredAt: sunday - 3600000,
      startedAt: monday,
      completedAt: monday + 100,
      editedAt: now,
      substances: ["Nicotine"],
      note: "corrected note",
      acuteRisks: ["none"],
      answers: {
        substances: ["nicotine"],
        note: "corrected note",
        acuteRisks: ["none"],
      },
    });
    const backup = await exportAllData();
    expect(JSON.stringify(backup)).toContain("corrected note");
    const entries = buildReviewRegistrations({
      ...empty(),
      relapseLogs: [reloaded],
      quickRegistrations: (await getFeatureRecords()).filter(
        (record) => record.recordType === "quick-registration",
      ),
    });
    expect(entries).toHaveLength(1);
    expect(entries[0].timestamp).toBe(sunday - 3600000);
  });
  it("clearly retains only quick after reflection deletion, then removes episode without resurrection", async () => {
    await addRelapseLog(relapse());
    await saveFeatureRecord(quick());
    await deleteRegistrationEpisode({
      type: "relapse",
      detailedId: "detail",
      quickId: "quick",
      scope: "reflection",
    });
    await reconcileQuickReflectionLinks();
    expect(await getRelapseLogs()).toHaveLength(0);
    expect(await getFeatureRecords()).toHaveLength(1);
    await deleteRegistrationEpisode({ type: "relapse", quickId: "quick" });
    await reconcileQuickReflectionLinks();
    expect(await getFeatureRecords()).toHaveLength(0);
  });
});
