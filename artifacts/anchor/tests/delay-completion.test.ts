import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  beginBoredomDelay,
  hasCompletedBoredomDelay,
  persistBoredomDelayCompletion,
  remainingDelaySeconds,
  stopBoredomDelay,
  withCompletedBoredomDelay,
} from "../src/lib/delayCompletion";

const boredomLog = {
  id: "boredom-1",
  timestamp: 1,
  dataVersion: 2,
  answers: { delayDuration: null },
  delayDuration: null,
} as never;

describe("Boredom delay completion", () => {
  it("records a start without claiming completion", () => {
    const opened = beginBoredomDelay({ action: "Delayed action", delayTimerStartedAt: null }, 1_000);
    expect(opened).toEqual({ action: "Delayed action", delayTimerStartedAt: 1_000, delayDuration: null });
    expect(withCompletedBoredomDelay(boredomLog, 600)).toMatchObject({
      delayDuration: "600 seconds",
      answers: { delayDuration: 600 },
    });
  });

  it("clears an earlier completion marker when a new delay attempt begins", () => {
    expect(beginBoredomDelay({ delayTimerStartedAt: null, delayDuration: 600 }, 2_000)).toEqual({
      delayTimerStartedAt: 2_000,
      delayDuration: null,
    });
    expect(withCompletedBoredomDelay(boredomLog, 600)).toMatchObject({
      delayDuration: "600 seconds",
      answers: { delayDuration: 600 },
    });
  });

  it("derives remaining time from the persisted start across reloads", () => {
    expect(remainingDelaySeconds(1_000, 1_000, 600)).toBe(600);
    expect(remainingDelaySeconds(1_000, 600_000, 600)).toBe(1);
    expect(remainingDelaySeconds(1_000, 601_000, 600)).toBe(0);
  });

  it("restores a durably completed timer as done instead of starting another countdown", () => {
    expect(hasCompletedBoredomDelay({ delayTimerStartedAt: null, delayDuration: 600 }, 600)).toBe(true);
    expect(hasCompletedBoredomDelay({ delayTimerStartedAt: null, delayDuration: 599 }, 600)).toBe(false);

    const source = readFileSync(new URL("../src/pages/DelayScreen.tsx", import.meta.url), "utf8");
    expect(source).toContain("hasCompletedBoredomDelay(activeDraft");
    expect(source).toContain("setSeconds(0)");
    expect(source).toContain('persistedCompleted ? "saved" : "idle"');
  });

  it("writes the completed log before the draft marker and passes the configured duration", async () => {
    const order: string[] = [];
    const updateLog = vi.fn(async (log) => {
      order.push("log");
      expect(log).toMatchObject({
        delayDuration: "420 seconds",
        answers: { delayDuration: 420 },
      });
    });
    const patchDraft = vi.fn(async (draft) => {
      order.push("draft");
      expect(draft).toMatchObject({
        delayTimerStartedAt: null,
        delayDuration: 420,
      });
      return true;
    });

    await expect(persistBoredomDelayCompletion({
      log: boredomLog,
      draft: { delayTimerStartedAt: 1_000, delayDuration: null },
      durationSeconds: 420,
      updateLog,
      patchDraft,
    })).resolves.toBe(true);
    expect(order).toEqual(["log", "draft"]);
  });

  it("does not mark the draft when the log write fails and remains idempotently retryable", async () => {
    const patchDraft = vi.fn(async () => true);
    const failedUpdate = vi.fn(async () => { throw new Error("write failed"); });
    await expect(persistBoredomDelayCompletion({
      log: boredomLog,
      draft: { delayTimerStartedAt: 1_000 },
      updateLog: failedUpdate,
      patchDraft,
    })).rejects.toThrow("write failed");
    expect(patchDraft).not.toHaveBeenCalled();

    const updated: unknown[] = [];
    await expect(persistBoredomDelayCompletion({
      log: boredomLog,
      draft: { delayTimerStartedAt: 1_000 },
      updateLog: async (log) => { updated.push(log); },
      patchDraft: async () => false,
    })).resolves.toBe(false);
    expect(updated).toHaveLength(1);
  });

  it("stopping early clears only the start marker", () => {
    expect(stopBoredomDelay({ delayTimerStartedAt: 1_000, delayDuration: null })).toEqual({
      delayTimerStartedAt: null,
      delayDuration: null,
    });
  });

  it("routes the top X through done handling after zero so it cannot destroy retry state", () => {
    const source = readFileSync(new URL("../src/pages/DelayScreen.tsx", import.meta.url), "utf8");
    expect(source).toContain("if (done) handleDone();");
    expect(source).toContain("if (!done || completionAttempted.current) return;");
    expect(source).toContain("completionState === \"error\"");
  });
});

describe("Insights unanswered attention state", () => {
  it("shows a dash and explicit no-answer copy instead of a reassuring zero of zero", () => {
    const source = readFileSync(new URL("../src/pages/Insights.tsx", import.meta.url), "utf8");
    expect(source).toContain('attentionStats.answeredCount === 0 ? "-"');
    expect(source).toContain('t("insights.attention.empty")');
  });
});
