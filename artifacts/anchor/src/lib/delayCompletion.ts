import type { BoredomLog } from "@/db";

export const DEFAULT_DELAY_DURATION_SECONDS = 10 * 60;

export type BoredomDelayDraft = {
  delayTimerStartedAt?: number | null;
  delayDuration?: number | null;
};

export function beginBoredomDelay<T extends BoredomDelayDraft>(
  draft: T,
  startedAt: number,
): T {
  return {
    ...draft,
    delayTimerStartedAt: startedAt,
    delayDuration: null,
  };
}

export function stopBoredomDelay<T extends BoredomDelayDraft>(draft: T): T {
  return {
    ...draft,
    delayTimerStartedAt: null,
  };
}

export function remainingDelaySeconds(
  startedAt: number,
  now: number,
  durationSeconds = DEFAULT_DELAY_DURATION_SECONDS,
): number {
  if (!Number.isFinite(startedAt) || !Number.isFinite(now) || durationSeconds <= 0) {
    return Math.max(0, Math.ceil(durationSeconds));
  }
  const elapsedSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  return Math.max(0, Math.ceil(durationSeconds) - elapsedSeconds);
}

/** A persisted duration is the durable completion marker across page reloads. */
export function hasCompletedBoredomDelay(
  draft: BoredomDelayDraft,
  durationSeconds = DEFAULT_DELAY_DURATION_SECONDS,
): boolean {
  return typeof draft.delayDuration === "number"
    && Number.isFinite(draft.delayDuration)
    && draft.delayDuration >= Math.max(0, Math.round(durationSeconds));
}

export function withCompletedBoredomDelay(
  log: BoredomLog,
  durationSeconds = DEFAULT_DELAY_DURATION_SECONDS,
): BoredomLog {
  const completedSeconds = Math.max(0, Math.round(durationSeconds));
  return {
    ...log,
    delayDuration: `${completedSeconds} seconds`,
    answers: {
      ...(log.answers ?? {}),
      delayDuration: completedSeconds,
    },
  };
}

export type PersistBoredomDelayCompletionArgs = {
  log: BoredomLog;
  draft: BoredomDelayDraft;
  durationSeconds?: number;
  updateLog: (log: BoredomLog) => Promise<void>;
  patchDraft: (draft: BoredomDelayDraft) => Promise<boolean>;
};

/**
 * Persist in recoverable order: the idempotent completed log first, then the
 * active draft marker. If the second write fails, the elapsed start timestamp
 * remains available after reload and the same completion can be retried.
 */
export async function persistBoredomDelayCompletion({
  log,
  draft,
  durationSeconds = DEFAULT_DELAY_DURATION_SECONDS,
  updateLog,
  patchDraft,
}: PersistBoredomDelayCompletionArgs): Promise<boolean> {
  const completedSeconds = Math.max(0, Math.round(durationSeconds));
  await updateLog(withCompletedBoredomDelay(log, completedSeconds));
  return patchDraft({
    ...draft,
    delayTimerStartedAt: null,
    delayDuration: completedSeconds,
  });
}
