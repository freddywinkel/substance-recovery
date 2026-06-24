import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { getSetting, setSetting } from "@/db";

// ── Active registration session ───────────────────────────────
// A single in-progress tracker registration, persisted to IndexedDB so it
// survives bottom-nav navigation and full reloads. Only one is active at a
// time; starting a different tracker replaces it.

export type RegistrationType = "craving" | "trek" | "anxiety" | "boredom";

export interface PendingReturn {
  returnRoute: string;
  returnStep: string;
}

export interface ActiveRegistration {
  version: 1;
  type: RegistrationType;
  route: string;
  step: string;
  draft: unknown;
  startedAt: number;
  updatedAt: number;
  savedLogId?: string;
  pendingReturn?: PendingReturn;
  stepIndex?: number;
  stepCount?: number;
}

const SETTING_KEY = "activeRegistration";
const REG_TYPES: RegistrationType[] = ["craving", "trek", "anxiety", "boredom"];

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
  startSession: (args: StartArgs) => void;
  patchSession: (updates: PatchArgs) => void;
  clearSession: () => void;
}

const ActiveRegistrationContext = createContext<ActiveRegistrationValue | null>(null);

function parseSession(raw: unknown): ActiveRegistration | null {
  if (typeof raw !== "string" || raw === "") return null;
  try {
    const data = JSON.parse(raw);
    if (
      data &&
      data.version === 1 &&
      REG_TYPES.includes(data.type) &&
      typeof data.route === "string" &&
      typeof data.step === "string"
    ) {
      return data as ActiveRegistration;
    }
  } catch {
    /* ignore corrupt data */
  }
  return null;
}

export function ActiveRegistrationProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<ActiveRegistration | null>(null);
  const [loaded, setLoaded] = useState(false);
  const sessionRef = useRef<ActiveRegistration | null>(null);
  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSetting(SETTING_KEY, "").then((raw) => {
      if (cancelled) return;
      const parsed = parseSession(raw);
      sessionRef.current = parsed;
      setSession(parsed);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const flushWrite = useCallback((next: ActiveRegistration | null) => {
    setSetting(SETTING_KEY, next ? JSON.stringify(next) : "");
  }, []);

  const commit = useCallback(
    (next: ActiveRegistration | null, immediate: boolean) => {
      sessionRef.current = next;
      setSession(next);
      if (writeTimer.current) {
        clearTimeout(writeTimer.current);
        writeTimer.current = null;
      }
      if (immediate) {
        flushWrite(next);
      } else {
        writeTimer.current = setTimeout(() => flushWrite(next), 300);
      }
    },
    [flushWrite],
  );

  const startSession = useCallback(
    (args: StartArgs) => {
      const now = Date.now();
      commit(
        {
          version: 1,
          type: args.type,
          route: args.route,
          step: args.step,
          draft: args.draft,
          stepIndex: args.stepIndex,
          stepCount: args.stepCount,
          startedAt: now,
          updatedAt: now,
        },
        true,
      );
    },
    [commit],
  );

  const patchSession = useCallback(
    (updates: PatchArgs) => {
      const current = sessionRef.current;
      if (!current) return;
      commit({ ...current, ...updates, updatedAt: Date.now() }, false);
    },
    [commit],
  );

  const clearSession = useCallback(() => {
    commit(null, true);
  }, [commit]);

  if (!loaded) return null;

  return (
    <ActiveRegistrationContext.Provider
      value={{ session, startSession, patchSession, clearSession }}
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
