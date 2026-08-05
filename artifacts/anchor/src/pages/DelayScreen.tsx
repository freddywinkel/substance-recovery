/** DelayScreen — configured grounding timer with optional Boredom completion capture. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { X } from "lucide-react";
import { getBoredomLogs } from "@/db";
import { useActiveRegistration } from "@/contexts/ActiveRegistrationContext";
import { useStore } from "@/hooks/useStore";
import { useT } from "@/hooks/useTranslation";
import { ToolFollowUpButton } from "@/components/ToolFollowUpButton";
import {
  DEFAULT_DELAY_DURATION_SECONDS,
  hasCompletedBoredomDelay,
  persistBoredomDelayCompletion,
  remainingDelaySeconds,
  stopBoredomDelay,
  type BoredomDelayDraft,
} from "@/lib/delayCompletion";

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

function isDraft(value: unknown): value is BoredomDelayDraft {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

type CompletionState = "idle" | "saving" | "saved" | "error";

export function DelayScreen() {
  const [, navigate] = useLocation();
  const { t } = useT();
  const registration = useActiveRegistration();
  const { boredomLogs, updateBoredom } = useStore();
  const localStartedAt = useRef(Date.now());
  const session = registration.session;
  const activeDraft = isDraft(session?.draft) ? session.draft : {};
  const isBoredomReturn = session?.type === "boredom"
    && session.pendingReturn?.returnRoute === "/boredom";
  const persistedCompleted = isBoredomReturn
    && hasCompletedBoredomDelay(activeDraft, DEFAULT_DELAY_DURATION_SECONDS);
  const completionAttempted = useRef(persistedCompleted);
  const persistedStartedAt = isBoredomReturn
    && typeof activeDraft.delayTimerStartedAt === "number"
    && Number.isFinite(activeDraft.delayTimerStartedAt)
      ? activeDraft.delayTimerStartedAt
      : null;
  const startedAt = persistedStartedAt ?? localStartedAt.current;
  const [seconds, setSeconds] = useState(() => persistedCompleted
    ? 0
    : remainingDelaySeconds(startedAt, Date.now(), DEFAULT_DELAY_DURATION_SECONDS));
  const [completionState, setCompletionState] = useState<CompletionState>(
    persistedCompleted ? "saved" : "idle",
  );
  const [exitError, setExitError] = useState(false);
  const done = seconds === 0;

  useEffect(() => {
    if (!persistedCompleted) return;
    completionAttempted.current = true;
    setCompletionState("saved");
    setSeconds(0);
  }, [persistedCompleted]);

  const instructions = useMemo(() => [
    t("delay.i0"), t("delay.i1"), t("delay.i2"), t("delay.i3"),
    t("delay.i4"), t("delay.i5"), t("delay.i6"), t("delay.i7"),
    t("delay.i8"), t("delay.i9"), t("delay.i10"), t("delay.i11"),
  ], [t]);

  useEffect(() => {
    const tick = () => setSeconds(persistedCompleted
      ? 0
      : remainingDelaySeconds(startedAt, Date.now(), DEFAULT_DELAY_DURATION_SECONDS));
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [persistedCompleted, startedAt]);

  const navigateToReturn = useCallback(() => {
    const returnRoute = registration.session?.pendingReturn?.returnRoute;
    if (returnRoute) {
      navigate(returnRoute);
    } else if (window.history.length > 1) {
      window.history.back();
    } else {
      navigate("/");
    }
  }, [navigate, registration.session?.pendingReturn?.returnRoute]);

  const captureCompletion = useCallback(async () => {
    if (!isBoredomReturn) {
      setCompletionState("saved");
      return true;
    }
    const savedLogId = session?.savedLogId;
    if (!savedLogId) {
      setCompletionState("error");
      return false;
    }
    setCompletionState("saving");
    try {
      const log = boredomLogs.find((entry) => entry.id === savedLogId)
        ?? (await getBoredomLogs()).find((entry) => entry.id === savedLogId);
      if (!log) throw new Error("Boredom log is unavailable.");
      const persisted = await persistBoredomDelayCompletion({
        log,
        draft: activeDraft,
        durationSeconds: DEFAULT_DELAY_DURATION_SECONDS,
        updateLog: updateBoredom,
        patchDraft: (draft) => registration.patchSession({ draft }),
      });
      if (!persisted) throw new Error("Boredom delay draft could not be saved.");
      setCompletionState("saved");
      return true;
    } catch {
      setCompletionState("error");
      return false;
    }
  }, [activeDraft, boredomLogs, isBoredomReturn, registration, session?.savedLogId, updateBoredom]);

  useEffect(() => {
    if (!done || completionAttempted.current) return;
    completionAttempted.current = true;
    void captureCompletion();
  }, [captureCompletion, done]);

  const retryCompletion = useCallback(() => {
    completionAttempted.current = true;
    void captureCompletion();
  }, [captureCompletion]);

  const handleStop = useCallback(async () => {
    if (isBoredomReturn && persistedStartedAt != null) {
      setExitError(false);
      const persisted = await registration.patchSession({
        draft: stopBoredomDelay(activeDraft),
        pendingReturn: undefined,
      });
      if (!persisted) {
        setExitError(true);
        return;
      }
    }
    navigateToReturn();
  }, [activeDraft, isBoredomReturn, navigateToReturn, persistedStartedAt, registration]);

  const handleDone = useCallback(() => {
    if (!isBoredomReturn || completionState === "saved") {
      navigateToReturn();
    } else if (completionState === "error") {
      retryCompletion();
    }
  }, [completionState, isBoredomReturn, navigateToReturn, retryCompletion]);

  const instructionIndex = Math.floor(
    (DEFAULT_DELAY_DURATION_SECONDS - seconds) / 30,
  ) % instructions.length;
  const instruction = instructions[instructionIndex];
  const progress = (DEFAULT_DELAY_DURATION_SECONDS - seconds)
    / DEFAULT_DELAY_DURATION_SECONDS;

  return (
    <div
      className="flex flex-col min-h-dvh bg-background"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <h1 className="sr-only">{t("delay.title")}</h1>
      <div className="flex justify-end px-5 pt-5 pb-2">
        <button
          type="button"
          onClick={() => {
            if (done) handleDone();
            else void handleStop();
          }}
          className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors touch-target"
          aria-label={t("common.stop")}
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 gap-10">
        <div className="relative w-52 h-52 flex items-center justify-center">
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="44" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
            <circle
              cx="50" cy="50" r="44" fill="none"
              stroke="hsl(var(--primary))" strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 44}`}
              strokeDashoffset={`${2 * Math.PI * 44 * (1 - progress)}`}
              className="transition-all duration-500"
            />
          </svg>
          <div className="text-center">
            <p className="text-5xl font-light text-foreground tabular-nums tracking-tight">
              {formatTime(seconds)}
            </p>
            {!done && (
              <p className="text-xs text-muted-foreground mt-1 uppercase tracking-widest">
                {t("delay.remaining")}
              </p>
            )}
          </div>
        </div>

        <div aria-live="polite" aria-atomic="true" className="text-center min-h-[3rem] flex items-center justify-center">
          {done ? (
            <div>
              <p className="text-xl font-medium text-foreground">{t("delay.done")}</p>
              {(completionState === "saving" || completionState === "error") && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {completionState === "saving" ? t("common.saving") : t("delay.save_error")}
                </p>
              )}
            </div>
          ) : (
            <p key={instructionIndex} className="text-xl font-medium text-foreground leading-snug animate-fade-up">
              {instruction}
            </p>
          )}
        </div>

        {!done && (
          <p className="text-xs text-muted-foreground/60 text-center max-w-[220px] leading-relaxed">
            {t("delay.hint")}
          </p>
        )}
        {exitError && (
          <p role="alert" className="text-sm text-destructive text-center">
            {t("delay.exit_error")}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3 px-6" style={{ paddingBottom: "calc(4rem + env(safe-area-inset-bottom) + var(--return-banner-h, 0px))" }}>
        {done && (
          <ToolFollowUpButton
            toolId="/delay"
            toolLabel={t("delay.title")}
            className="mx-auto"
          />
        )}
        <button
          type="button"
          disabled={done && completionState === "saving"}
          onClick={done ? handleDone : () => { void handleStop(); }}
          className={done
            ? "w-full bg-primary text-primary-foreground rounded-2xl py-4 font-semibold text-base touch-target hover:opacity-90 active:scale-95 transition-all disabled:opacity-60"
            : "w-full border border-border text-muted-foreground rounded-2xl py-4 font-medium text-sm touch-target hover:text-foreground hover:border-border/80 transition-colors"}
        >
          {done
            ? completionState === "error" ? t("delay.retry_save") : t("common.done")
            : t("delay.stop_early")}
        </button>
      </div>
    </div>
  );
}
