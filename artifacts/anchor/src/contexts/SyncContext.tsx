import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@clerk/react";
import { runSync } from "@/lib/sync-engine";
import { SYNC_DIRTY_EVENT } from "@/db";
import { useClerkAvailable } from "@/lib/clerk-safe";

export type SyncStatus = "idle" | "syncing" | "synced" | "error" | "offline";

interface SyncContextValue {
  /** Current engine state. "idle" whenever signed out. */
  status: SyncStatus;
  /** Epoch ms of the last successful sync this session, or null. */
  lastSyncedAt: number | null;
  /** Whether a cloud account is connected (sync is active). */
  isSignedIn: boolean;
  /** Manually trigger a sync (no-op when signed out / offline). */
  syncNow: () => void;
}

const SyncContext = createContext<SyncContextValue>({
  status: "idle",
  lastSyncedAt: null,
  isSignedIn: false,
  syncNow: () => {},
});

const DEBOUNCE_MS = 2000;
const PERIODIC_MS = 5 * 60 * 1000;

// Dummy provider used when Clerk is not configured (offline-only mode).
function DummySyncProvider({ children }: { children: ReactNode }) {
  return (
    <SyncContext.Provider
      value={{ status: "idle", lastSyncedAt: null, isSignedIn: false, syncNow: () => {} }}
    >
      {children}
    </SyncContext.Provider>
  );
}

/**
 * Drives optional cloud sync. Completely inert when signed out: no network, no
 * timers, status stays "idle" — the app behaves exactly as the local-only build.
 * When signed in, syncs on mount/sign-in, on reconnect, on tab focus, debounced
 * after local writes, and periodically.
 */
function RealSyncProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const signedIn = isLoaded && !!isSignedIn && !!userId;

  const [status, setStatus] = useState<SyncStatus>("idle");
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  const runningRef = useRef(false);
  const rerunRef = useRef(false);
  const signedInRef = useRef(signedIn);
  signedInRef.current = signedIn;
  const userIdRef = useRef<string | null>(userId ?? null);
  userIdRef.current = userId ?? null;

  const doSync = useCallback(async () => {
    if (!signedInRef.current) return;
    const uid = userIdRef.current;
    if (!uid) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setStatus("offline");
      return;
    }
    if (runningRef.current) {
      rerunRef.current = true;
      return;
    }
    runningRef.current = true;
    setStatus("syncing");
    try {
      await runSync(uid);
      // Ignore a result that arrived after sign-out or an account switch.
      if (!signedInRef.current || userIdRef.current !== uid) return;
      setStatus("synced");
      setLastSyncedAt(Date.now());
    } catch {
      // Ignore a failure from a sync that is no longer current (signed out or
      // switched accounts mid-flight) — don't surface a stale error/offline.
      if (!signedInRef.current || userIdRef.current !== uid) return;
      // Network/HTTP failure — stay usable, retry on the next trigger.
      setStatus(
        typeof navigator !== "undefined" && !navigator.onLine
          ? "offline"
          : "error",
      );
    } finally {
      runningRef.current = false;
      if (rerunRef.current) {
        rerunRef.current = false;
        void doSync();
      }
    }
  }, []);

  // Sync on sign-in / mount / account switch; reset to idle on sign-out.
  useEffect(() => {
    if (!signedIn) {
      setStatus("idle");
      return;
    }
    void doSync();
  }, [signedIn, userId, doSync]);

  // Reconnect / focus / post-write / periodic triggers (only while signed in).
  useEffect(() => {
    if (!signedIn) return;

    let debounce: ReturnType<typeof setTimeout> | null = null;
    const onOnline = () => void doSync();
    const onVisible = () => {
      if (document.visibilityState === "visible") void doSync();
    };
    const onDirty = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => void doSync(), DEBOUNCE_MS);
    };
    const interval = setInterval(() => void doSync(), PERIODIC_MS);

    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(SYNC_DIRTY_EVENT, onDirty);

    return () => {
      if (debounce) clearTimeout(debounce);
      clearInterval(interval);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(SYNC_DIRTY_EVENT, onDirty);
    };
  }, [signedIn, doSync]);

  const syncNow = useCallback(() => void doSync(), [doSync]);

  return (
    <SyncContext.Provider
      value={{ status, lastSyncedAt, isSignedIn: signedIn, syncNow }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const clerkAvailable = useClerkAvailable();
  if (!clerkAvailable) {
    return <DummySyncProvider>{children}</DummySyncProvider>;
  }
  return <RealSyncProvider>{children}</RealSyncProvider>;
}

export function useSync(): SyncContextValue {
  return useContext(SyncContext);
}
