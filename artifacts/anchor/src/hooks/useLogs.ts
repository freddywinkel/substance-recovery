import { useState, useEffect, useCallback, useSyncExternalStore } from "react";
import {
  CigaretteLog,
  CravingLog,
  RelapseLog,
  AnxietyLog,
  BoredomLog,
  addCigaretteLog,
  getCigaretteLogs,
  updateCigaretteLog,
  deleteCigaretteLog,
  addCravingLog,
  getCravingLogs,
  updateCravingLog,
  deleteCravingLog,
  addRelapseLog,
  getRelapseLogs,
  updateRelapseLog,
  deleteRelapseLog,
  addAnxietyLog,
  getAnxietyLogs,
  updateAnxietyLog,
  deleteAnxietyLog,
  addBoredomLog,
  getBoredomLogs,
  updateBoredomLog,
  deleteBoredomLog,
} from "@/db";
import { cravingRegistrationKind } from "@/lib/canonicalRegistration";
import {
  useActiveRegistration,
  type RegistrationType,
} from "@/contexts/ActiveRegistrationContext";

export interface CommittedReadbackIssue {
  operation: string;
  /** The write completed; only the follow-up list refresh failed. */
  committed: true;
  recordId?: string;
  occurredAt: number;
  error: Error;
}

export interface LogIntegrityStatus {
  loadError: Error | null;
  readbackIssue: CommittedReadbackIssue | null;
}

let integrityStatus: LogIntegrityStatus = {
  loadError: null,
  readbackIssue: null,
};
const integrityListeners = new Set<() => void>();
const integrityReloaders = new Set<() => Promise<void>>();

function publishIntegrityStatus(update: Partial<LogIntegrityStatus>) {
  integrityStatus = { ...integrityStatus, ...update };
  integrityListeners.forEach((listener) => listener());
}

export function useLogIntegrityStatus(): LogIntegrityStatus {
  return useSyncExternalStore(
    (listener) => {
      integrityListeners.add(listener);
      return () => {
        integrityListeners.delete(listener);
      };
    },
    () => integrityStatus,
    () => integrityStatus,
  );
}

function readAllLogStores() {
  return Promise.all([
    getCigaretteLogs(),
    getCravingLogs(),
    getRelapseLogs(),
    getAnxietyLogs(),
    getBoredomLogs(),
  ]);
}

export async function retryLogIntegrityChecks(): Promise<void> {
  const reloaders = [...integrityReloaders];
  if (reloaders.length > 0) {
    await Promise.allSettled(reloaders.map((reload) => reload()));
    return;
  }

  // Some informational routes do not mount useStore. Keep the app-level retry
  // useful there by performing a direct integrity read.
  try {
    await readAllLogStores();
    publishIntegrityStatus({ loadError: null, readbackIssue: null });
  } catch (error) {
    publishIntegrityStatus({
      loadError: error instanceof Error ? error : new Error(String(error)),
    });
  }
}

type RegistrationLog = CravingLog | RelapseLog | AnxietyLog | BoredomLog;

function upsertNewest<T extends { id: string; timestamp: number }>(
  records: T[],
  record: T,
  limit = 200,
): T[] {
  return [record, ...records.filter((item) => item.id !== record.id)]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}

function withSessionMetadata<T extends RegistrationLog>(
  entry: Omit<T, "id">,
  expectedType: RegistrationType,
  session: ReturnType<typeof useActiveRegistration>["session"],
): Omit<T, "id"> & { id?: string } {
  const matching = session?.type === expectedType ? session : null;
  const occurredAt =
    entry.occurredAt ??
    (matching && expectedType !== "relapse"
      ? matching.quickRegistrationTimestamp ?? matching.startedAt
      : entry.timestamp);
  const startedAt = entry.startedAt ?? matching?.startedAt ?? occurredAt;
  const completedAt = entry.completedAt ?? Date.now();

  return {
    ...entry,
    id: matching?.recordId,
    timestamp: occurredAt,
    occurredAt,
    startedAt,
    completedAt,
  };
}

export function useLogs() {
  const { session } = useActiveRegistration();
  const [cigaretteLogs, setCigaretteLogs] = useState<CigaretteLog[]>([]);
  const [cravingLogs, setCravingLogs] = useState<CravingLog[]>([]);
  const [relapseLogs, setRelapseLogs] = useState<RelapseLog[]>([]);
  const [anxietyLogs, setAnxietyLogs] = useState<AnxietyLog[]>([]);
  const [boredomLogs, setBoredomLogs] = useState<BoredomLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [readbackIssue, setReadbackIssue] = useState<CommittedReadbackIssue | null>(null);

  const noteReadbackFailure = useCallback((
    operation: string,
    error: unknown,
    recordId?: string,
  ) => {
    const issue: CommittedReadbackIssue = {
      operation,
      committed: true,
      recordId,
      occurredAt: Date.now(),
      error: error instanceof Error ? error : new Error(String(error)),
    };
    setReadbackIssue(issue);
    publishIntegrityStatus({ readbackIssue: issue });
  }, []);

  const clearReadbackIssue = useCallback(() => {
    setReadbackIssue(null);
    publishIntegrityStatus({ readbackIssue: null });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cigarettes, cravings, relapses, anxieties, boredoms] = await readAllLogStores();
      setCigaretteLogs(cigarettes);
      setCravingLogs(cravings);
      setRelapseLogs(relapses);
      setAnxietyLogs(anxieties);
      setBoredomLogs(boredoms);
      setLoadError(null);
      setReadbackIssue(null);
      publishIntegrityStatus({ loadError: null, readbackIssue: null });
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error(String(error));
      setLoadError(normalized);
      publishIntegrityStatus({ loadError: normalized });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    integrityReloaders.add(load);
    void load();
    return () => {
      integrityReloaders.delete(load);
    };
  }, [load]);

  const logCraving = useCallback(
    async (entry: Omit<CravingLog, "id">) => {
      const expectedType = cravingRegistrationKind(entry);
      if (!expectedType) {
        throw new Error("Craving registration is missing its canonical registrationType answer.");
      }
      const result = await addCravingLog(
        withSessionMetadata(entry, expectedType, session),
      );
      try {
        setCravingLogs(await getCravingLogs());
        clearReadbackIssue();
      } catch (error) {
        setCravingLogs((current) => upsertNewest(current, result));
        noteReadbackFailure("addCravingLog:refresh", error, result.id);
      }
      return result;
    },
    [clearReadbackIssue, noteReadbackFailure, session]
  );

  const removeCraving = useCallback(async (id: string) => {
    await deleteCravingLog(id);
    try {
      setCravingLogs(await getCravingLogs());
      clearReadbackIssue();
    } catch (error) {
      setCravingLogs((current) => current.filter((item) => item.id !== id));
      noteReadbackFailure("deleteCravingLog:refresh", error, id);
    }
  }, [clearReadbackIssue, noteReadbackFailure]);

  const updateCraving = useCallback(async (log: CravingLog) => {
    await updateCravingLog(log);
    try {
      setCravingLogs(await getCravingLogs());
      clearReadbackIssue();
    } catch (error) {
      setCravingLogs((current) => upsertNewest(current, log));
      noteReadbackFailure("updateCravingLog:refresh", error, log.id);
    }
  }, [clearReadbackIssue, noteReadbackFailure]);

  const logRelapse = useCallback(
    async (entry: Omit<RelapseLog, "id">) => {
      const result = await addRelapseLog(
        withSessionMetadata(entry, "relapse", session),
      );
      try {
        setRelapseLogs(await getRelapseLogs());
        clearReadbackIssue();
      } catch (error) {
        setRelapseLogs((current) => upsertNewest(current, result));
        noteReadbackFailure("addRelapseLog:refresh", error, result.id);
      }
      return result;
    },
    [clearReadbackIssue, noteReadbackFailure, session]
  );

  const removeRelapse = useCallback(async (id: string) => {
    await deleteRelapseLog(id);
    try {
      setRelapseLogs(await getRelapseLogs());
      clearReadbackIssue();
    } catch (error) {
      setRelapseLogs((current) => current.filter((item) => item.id !== id));
      noteReadbackFailure("deleteRelapseLog:refresh", error, id);
    }
  }, [clearReadbackIssue, noteReadbackFailure]);

  const updateRelapse = useCallback(async (log: RelapseLog) => {
    await updateRelapseLog(log);
    try {
      setRelapseLogs(await getRelapseLogs());
      clearReadbackIssue();
    } catch (error) {
      setRelapseLogs((current) => upsertNewest(current, log));
      noteReadbackFailure("updateRelapseLog:refresh", error, log.id);
    }
  }, [clearReadbackIssue, noteReadbackFailure]);

  const logAnxiety = useCallback(
    async (entry: Omit<AnxietyLog, "id">) => {
      const result = await addAnxietyLog(
        withSessionMetadata(entry, "anxiety", session),
      );
      try {
        setAnxietyLogs(await getAnxietyLogs());
        clearReadbackIssue();
      } catch (error) {
        setAnxietyLogs((current) => upsertNewest(current, result));
        noteReadbackFailure("addAnxietyLog:refresh", error, result.id);
      }
      return result;
    },
    [clearReadbackIssue, noteReadbackFailure, session]
  );

  const removeAnxiety = useCallback(async (id: string) => {
    await deleteAnxietyLog(id);
    try {
      setAnxietyLogs(await getAnxietyLogs());
      clearReadbackIssue();
    } catch (error) {
      setAnxietyLogs((current) => current.filter((item) => item.id !== id));
      noteReadbackFailure("deleteAnxietyLog:refresh", error, id);
    }
  }, [clearReadbackIssue, noteReadbackFailure]);

  const updateAnxiety = useCallback(async (log: AnxietyLog) => {
    await updateAnxietyLog(log);
    try {
      setAnxietyLogs(await getAnxietyLogs());
      clearReadbackIssue();
    } catch (error) {
      setAnxietyLogs((current) => upsertNewest(current, log));
      noteReadbackFailure("updateAnxietyLog:refresh", error, log.id);
    }
  }, [clearReadbackIssue, noteReadbackFailure]);

  const logBoredom = useCallback(
    async (entry: Omit<BoredomLog, "id">) => {
      const result = await addBoredomLog(
        withSessionMetadata(entry, "boredom", session),
      );
      try {
        setBoredomLogs(await getBoredomLogs());
        clearReadbackIssue();
      } catch (error) {
        setBoredomLogs((current) => upsertNewest(current, result));
        noteReadbackFailure("addBoredomLog:refresh", error, result.id);
      }
      return result;
    },
    [clearReadbackIssue, noteReadbackFailure, session]
  );

  const removeBoredom = useCallback(async (id: string) => {
    await deleteBoredomLog(id);
    try {
      setBoredomLogs(await getBoredomLogs());
      clearReadbackIssue();
    } catch (error) {
      setBoredomLogs((current) => current.filter((item) => item.id !== id));
      noteReadbackFailure("deleteBoredomLog:refresh", error, id);
    }
  }, [clearReadbackIssue, noteReadbackFailure]);

  const updateBoredom = useCallback(async (log: BoredomLog) => {
    await updateBoredomLog(log);
    try {
      setBoredomLogs(await getBoredomLogs());
      clearReadbackIssue();
    } catch (error) {
      setBoredomLogs((current) => upsertNewest(current, log));
      noteReadbackFailure("updateBoredomLog:refresh", error, log.id);
    }
  }, [clearReadbackIssue, noteReadbackFailure]);

  const logCigarette = useCallback(
    async (entry: Omit<CigaretteLog, "id">) => {
      const result = await addCigaretteLog(entry);
      try {
        setCigaretteLogs(await getCigaretteLogs());
        clearReadbackIssue();
      } catch (error) {
        setCigaretteLogs((current) => upsertNewest(current, result));
        noteReadbackFailure("addCigaretteLog:refresh", error, result.id);
      }
      return result;
    },
    [clearReadbackIssue, noteReadbackFailure]
  );

  const removeCigarette = useCallback(async (id: string) => {
    await deleteCigaretteLog(id);
    try {
      setCigaretteLogs(await getCigaretteLogs());
      clearReadbackIssue();
    } catch (error) {
      setCigaretteLogs((current) => current.filter((item) => item.id !== id));
      noteReadbackFailure("deleteCigaretteLog:refresh", error, id);
    }
  }, [clearReadbackIssue, noteReadbackFailure]);

  const updateCigarette = useCallback(async (log: CigaretteLog) => {
    await updateCigaretteLog(log);
    try {
      setCigaretteLogs(await getCigaretteLogs());
      clearReadbackIssue();
    } catch (error) {
      setCigaretteLogs((current) => upsertNewest(current, log));
      noteReadbackFailure("updateCigaretteLog:refresh", error, log.id);
    }
  }, [clearReadbackIssue, noteReadbackFailure]);

  const reload = useCallback(async () => {
    await load();
  }, [load]);

  return {
    cigaretteLogs,
    cravingLogs,
    relapseLogs,
    anxietyLogs,
    boredomLogs,
    loading,
    loadError,
    readbackIssue,
    clearReadbackIssue,
    logCigarette,
    updateCigarette,
    removeCigarette,
    logCraving,
    updateCraving,
    removeCraving,
    logRelapse,
    updateRelapse,
    removeRelapse,
    logAnxiety,
    updateAnxiety,
    removeAnxiety,
    logBoredom,
    updateBoredom,
    removeBoredom,
    reload,
  };
}
