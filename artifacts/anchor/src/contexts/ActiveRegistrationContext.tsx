import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { getSetting, setSetting } from "@/db";
import { setRegistrationSessionState } from "@/db/registrationSessionSettings";
import { QUICK_REFLECTION_HANDOFF_KEY } from "@/lib/recoveryFeatures";
import {
  ACTIVE_REGISTRATION_VERSION,
  parseActiveRegistration,
  type ActiveRegistration,
  type PendingReturn,
  type RegistrationType,
} from "./activeRegistrationValidation";

export type {
  ActiveRegistration,
  PendingReturn,
  RegistrationType,
} from "./activeRegistrationValidation";

// ── Active registration session ───────────────────────────────
// One tracker is active at a time and persists through navigation/reloads.
// Explicitly preserved drafts are kept in a LIFO stack and restored after the
// newer registration is completed or discarded.

const SETTING_KEY = "activeRegistration";
const SUSPENDED_SETTING_KEY = "suspendedRegistrations";

function consumeQuickReflectionHandoff(type: RegistrationType): {
  id: string;
  timestamp: number;
} | undefined {
  try {
    const raw = sessionStorage.getItem(QUICK_REFLECTION_HANDOFF_KEY);
    if (!raw) return undefined;
    const value = JSON.parse(raw) as unknown;
    if (
      !value
      || typeof value !== "object"
      || Array.isArray(value)
      || (value as Record<string, unknown>).type !== type
      || typeof (value as Record<string, unknown>).id !== "string"
      || ((value as Record<string, unknown>).id as string).trim() === ""
      || typeof (value as Record<string, unknown>).timestamp !== "number"
      || !Number.isFinite((value as Record<string, unknown>).timestamp)
      || ((value as Record<string, unknown>).timestamp as number) < 0
      || ((value as Record<string, unknown>).timestamp as number) > 8_640_000_000_000_000
    ) return undefined;
    return {
      id: (value as Record<string, unknown>).id as string,
      timestamp: (value as Record<string, unknown>).timestamp as number,
    };
  } catch {
    return undefined;
  } finally {
    try {
      sessionStorage.removeItem(QUICK_REFLECTION_HANDOFF_KEY);
    } catch {
      // A blocked session store means no quick-to-detailed handoff is possible.
    }
  }
}

interface StartArgs {
  type: RegistrationType;
  route: string;
  step: string;
  draft: unknown;
  stepIndex?: number;
  stepCount?: number;
}

type PatchArgs = Partial<
  Pick<
    ActiveRegistration,
    "step" | "draft" | "savedLogId" | "pendingReturn" | "stepIndex" | "stepCount"
  >
>;

interface ActiveRegistrationValue {
  session: ActiveRegistration | null;
  storageError: Error | null;
  startSession: (args: StartArgs) => Promise<boolean>;
  patchSession: (updates: PatchArgs) => Promise<boolean>;
  clearSession: () => Promise<void>;
  suspendSession: () => Promise<boolean>;
  resumeQuickSession: (
    quickRegistrationId: string,
    type: ActiveRegistration["type"],
  ) => Promise<ActiveRegistration | null>;
  completeSession: () => Promise<boolean>;
  discardSession: (options?: { restoreSuspended?: boolean }) => Promise<boolean>;
  resetSessions: () => Promise<boolean>;
  retryPersistence: () => Promise<boolean>;
}

const ActiveRegistrationContext = createContext<ActiveRegistrationValue | null>(null);

export function parseSuspendedRegistrationStack(raw: unknown): ActiveRegistration[] {
  if (raw === undefined || raw === null || raw === "") return [];

  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("Suspended registrations are not valid JSON.");
    }
  }
  if (!Array.isArray(parsed)) {
    throw new Error("Suspended registrations must be an array.");
  }

  return parsed.map((candidate, index) => {
    const result = parseActiveRegistration(candidate);
    if (!result.ok || !result.value) {
      throw new Error(
        `Suspended registration ${index + 1} is invalid${result.ok ? "." : `: ${result.error}`}`,
      );
    }
    return result.value;
  });
}

function serializeSuspendedRegistrationStack(stack: ActiveRegistration[]): string {
  return stack.length > 0 ? JSON.stringify(stack) : "";
}

export function ActiveRegistrationProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<ActiveRegistration | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState<Error | null>(null);
  const sessionRef = useRef<ActiveRegistration | null>(null);
  const suspendedRef = useRef<ActiveRegistration[]>([]);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getSetting(SETTING_KEY, ""),
      getSetting(SUSPENDED_SETTING_KEY, ""),
    ])
      .then(async ([rawActive, rawSuspended]) => {
        if (cancelled) return;
        const activeResult = parseActiveRegistration(rawActive);
        if (!activeResult.ok) {
          setStorageError(new Error(activeResult.error));
          sessionRef.current = null;
          setSession(null);
          return;
        }

        let suspended: ActiveRegistration[];
        try {
          suspended = parseSuspendedRegistrationStack(rawSuspended);
        } catch (error) {
          setStorageError(error instanceof Error ? error : new Error(String(error)));
          suspended = [];
        }

        let active = activeResult.value;
        // An atomic switch prevents this state during normal use, but older
        // builds or an interrupted cross-tracker navigation may leave only a
        // preserved draft. Restore it automatically instead of stranding it.
        if (!active && suspended.length > 0) {
          active = suspended.at(-1) ?? null;
          suspended = suspended.slice(0, -1);
        }

        sessionRef.current = active;
        suspendedRef.current = suspended;
        setSession(active);

        const normalizedActive = active ? JSON.stringify(active) : "";
        const normalizedSuspended = serializeSuspendedRegistrationStack(suspended);
        const needsNormalization =
          activeResult.migrated ||
          normalizedActive !== (rawActive ?? "") ||
          normalizedSuspended !== (rawSuspended ?? "");
        if (needsNormalization) {
          await setRegistrationSessionState(normalizedActive, normalizedSuspended);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setStorageError(error instanceof Error ? error : new Error(String(error)));
        sessionRef.current = null;
        setSession(null);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const enqueueWrite = useCallback((next: ActiveRegistration | null): Promise<boolean> => {
    // IndexedDB writes can resolve out of order when several fields change in
    // quick succession. Serialize every snapshot so an older write can never
    // overwrite a newer draft (or resurrect a session after it was cleared).
    const write = writeQueue.current.then(() =>
      setSetting(SETTING_KEY, next ? JSON.stringify(next) : ""),
    );
    writeQueue.current = write.catch(() => {
      // Keep the queue usable after a failed write. The individual caller still
      // receives `false`, and the persistent banner exposes the failure.
    });

    return write.then(
      () => {
        setStorageError(null);
        return true;
      },
      (error: unknown) => {
        setStorageError(error instanceof Error ? error : new Error(String(error)));
        return false;
      },
    );
  }, []);

  const enqueueStateWrite = useCallback((
    next: ActiveRegistration | null,
    suspended: ActiveRegistration[],
  ): Promise<boolean> => {
    const write = writeQueue.current.then(() =>
      setRegistrationSessionState(
        next ? JSON.stringify(next) : "",
        serializeSuspendedRegistrationStack(suspended),
      ),
    );
    writeQueue.current = write.catch(() => {
      // Keep the queue usable; the caller receives false and the banner stays.
    });

    return write.then(
      () => {
        setStorageError(null);
        return true;
      },
      (error: unknown) => {
        setStorageError(error instanceof Error ? error : new Error(String(error)));
        return false;
      },
    );
  }, []);

  const commit = useCallback(
    (next: ActiveRegistration | null): Promise<boolean> => {
      sessionRef.current = next;
      setSession(next);
      return enqueueWrite(next);
    },
    [enqueueWrite],
  );

  const startSession = useCallback(
    (args: StartArgs): Promise<boolean> => {
      const now = Date.now();
      const quickHandoff = consumeQuickReflectionHandoff(args.type);
      const candidate = parseActiveRegistration({
        version: ACTIVE_REGISTRATION_VERSION,
        type: args.type,
        route: args.route,
        step: args.step,
        draft: args.draft,
        recordId: crypto.randomUUID(),
        quickRegistrationId: quickHandoff?.id,
        quickRegistrationTimestamp: quickHandoff?.timestamp,
        stepIndex: args.stepIndex,
        stepCount: args.stepCount,
        startedAt: now,
        updatedAt: now,
      });
      if (!candidate.ok || !candidate.value) {
        setStorageError(
          new Error(candidate.ok ? "Active registration is empty." : candidate.error),
        );
        return Promise.resolve(false);
      }
      return commit(candidate.value);
    },
    [commit],
  );

  const patchSession = useCallback(
    (updates: PatchArgs): Promise<boolean> => {
      const current = sessionRef.current;
      if (!current) return Promise.resolve(false);
      const candidate = parseActiveRegistration({
        ...current,
        ...updates,
        updatedAt: Date.now(),
      });
      if (!candidate.ok || !candidate.value) {
        setStorageError(
          new Error(candidate.ok ? "Active registration is empty." : candidate.error),
        );
        return Promise.resolve(false);
      }
      return commit(candidate.value);
    },
    [commit],
  );

  const clearSession = useCallback(async () => {
    sessionRef.current = null;
    setSession(null);
    const persisted = await enqueueWrite(null);
    if (!persisted) {
      throw new Error("Active registration could not be cleared from storage.");
    }
  }, [enqueueWrite]);

  const suspendSession = useCallback(async (): Promise<boolean> => {
    const current = sessionRef.current;
    if (!current) return false;
    const preserved: ActiveRegistration = {
      ...current,
      pendingReturn: undefined,
      updatedAt: Date.now(),
    };
    const nextSuspended = [...suspendedRef.current, preserved];
    const persisted = await enqueueStateWrite(null, nextSuspended);
    if (!persisted) return false;

    suspendedRef.current = nextSuspended;
    sessionRef.current = null;
    setSession(null);
    return true;
  }, [enqueueStateWrite]);

  const resumeQuickSession = useCallback(async (
    quickRegistrationId: string,
    type: ActiveRegistration["type"],
  ): Promise<ActiveRegistration | null> => {
    const current = sessionRef.current;
    if (current?.quickRegistrationId === quickRegistrationId && current.type === type) {
      return current;
    }

    const candidates = suspendedRef.current.filter(
      (item) => item.quickRegistrationId === quickRegistrationId && item.type === type,
    );
    if (candidates.length === 0) return null;
    const restored = candidates.reduce((latest, candidate) =>
      candidate.updatedAt > latest.updatedAt ? candidate : latest,
    );
    const nextSuspended = suspendedRef.current.filter(
      (item) => item.quickRegistrationId !== quickRegistrationId || item.type !== type,
    );
    if (current && !current.savedLogId && current.step !== "done") {
      nextSuspended.push({
        ...current,
        pendingReturn: undefined,
        updatedAt: Date.now(),
      });
    }

    const persisted = await enqueueStateWrite(restored, nextSuspended);
    if (!persisted) return null;
    suspendedRef.current = nextSuspended;
    sessionRef.current = restored;
    setSession(restored);
    return restored;
  }, [enqueueStateWrite]);

  const completeSession = useCallback(async (): Promise<boolean> => {
    const nextSuspended = [...suspendedRef.current];
    const restored = nextSuspended.pop() ?? null;
    const persisted = await enqueueStateWrite(restored, nextSuspended);
    if (!persisted) return false;

    suspendedRef.current = nextSuspended;
    sessionRef.current = restored;
    setSession(restored);
    return true;
  }, [enqueueStateWrite]);

  const discardSession = useCallback(async (
    options?: { restoreSuspended?: boolean },
  ): Promise<boolean> => {
    const nextSuspended = [...suspendedRef.current];
    const restored = options?.restoreSuspended ? nextSuspended.pop() ?? null : null;
    const persisted = await enqueueStateWrite(restored, nextSuspended);
    if (!persisted) return false;

    suspendedRef.current = nextSuspended;
    sessionRef.current = restored;
    setSession(restored);
    return true;
  }, [enqueueStateWrite]);

  const resetSessions = useCallback(async (): Promise<boolean> => {
    const persisted = await enqueueStateWrite(null, []);
    if (!persisted) return false;

    suspendedRef.current = [];
    sessionRef.current = null;
    setSession(null);
    return true;
  }, [enqueueStateWrite]);

  const retryPersistence = useCallback(
    () => enqueueWrite(sessionRef.current),
    [enqueueWrite],
  );

  if (!loaded) return null;

  return (
    <ActiveRegistrationContext.Provider
      value={{
        session,
        storageError,
        startSession,
        patchSession,
        clearSession,
        suspendSession,
        resumeQuickSession,
        completeSession,
        discardSession,
        resetSessions,
        retryPersistence,
      }}
    >
      {children}
    </ActiveRegistrationContext.Provider>
  );
}

export function useActiveRegistration(): ActiveRegistrationValue {
  const ctx = useContext(ActiveRegistrationContext);
  if (!ctx) {
    throw new Error(
      "useActiveRegistration must be used within ActiveRegistrationProvider",
    );
  }
  return ctx;
}

// ── Helper for single-draft trackers (Craving, Trek) ──────────
// Initializes step + draft from a matching active session (resume) or starts a
// fresh session, and keeps the session in sync as the draft/step change.
export function useResumableDraft<TStep extends string, TDraft>(config: {
  type: RegistrationType;
  route: string;
  firstStep: TStep;
  makeBlank: () => TDraft;
  steps: readonly TStep[];
}) {
  const reg = useActiveRegistration();
  const matchedRef = useRef(
    reg.session && reg.session.type === config.type ? reg.session : null,
  );
  const matched = matchedRef.current;

  const stepCount = config.steps.length;
  const stepIndexOf = (s: TStep) => {
    const i = config.steps.indexOf(s);
    return i >= 0 ? i + 1 : stepCount;
  };

  const [step, setStep] = useState<TStep>(() =>
    matched ? (matched.step as TStep) : config.firstStep,
  );
  const [draft, setDraft] = useState<TDraft>(() =>
    matched ? (matched.draft as TDraft) : config.makeBlank(),
  );

  // Start a fresh session on mount when nothing was resumed.
  useEffect(() => {
    if (!matchedRef.current) {
      reg.startSession({
        type: config.type,
        route: config.route,
        step,
        draft,
        stepIndex: stepIndexOf(step),
        stepCount,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist subsequent step/draft changes (skip the initial render).
  const firstSync = useRef(true);
  useEffect(() => {
    if (firstSync.current) {
      firstSync.current = false;
      return;
    }
    reg.patchSession({ step, draft, stepIndex: stepIndexOf(step), stepCount });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, draft]);

  return { step, setStep, draft, setDraft, reg };
}
