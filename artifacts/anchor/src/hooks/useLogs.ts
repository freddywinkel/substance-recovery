import { useState, useEffect, useCallback } from "react";
import {
  CravingLog,
  RelapseLog,
  AnxietyLog,
  BoredomLog,
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
  SYNC_APPLIED_EVENT,
} from "@/db";

export function useLogs() {
  const [cravingLogs, setCravingLogs] = useState<CravingLog[]>([]);
  const [relapseLogs, setRelapseLogs] = useState<RelapseLog[]>([]);
  const [anxietyLogs, setAnxietyLogs] = useState<AnxietyLog[]>([]);
  const [boredomLogs, setBoredomLogs] = useState<BoredomLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [cravings, relapses, anxieties, boredoms] = await Promise.all([
      getCravingLogs(),
      getRelapseLogs(),
      getAnxietyLogs(),
      getBoredomLogs(),
    ]);
    setCravingLogs(cravings);
    setRelapseLogs(relapses);
    setAnxietyLogs(anxieties);
    setBoredomLogs(boredoms);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onApplied = () => {
      void load();
    };
    window.addEventListener(SYNC_APPLIED_EVENT, onApplied);
    return () => window.removeEventListener(SYNC_APPLIED_EVENT, onApplied);
  }, [load]);

  const logCraving = useCallback(
    async (entry: Omit<CravingLog, "id">) => {
      const result = await addCravingLog(entry);
      setCravingLogs(await getCravingLogs());
      return result;
    },
    []
  );

  const removeCraving = useCallback(async (id: string) => {
    await deleteCravingLog(id);
    setCravingLogs(await getCravingLogs());
  }, []);

  const updateCraving = useCallback(async (log: CravingLog) => {
    await updateCravingLog(log);
    setCravingLogs(await getCravingLogs());
  }, []);

  const logRelapse = useCallback(
    async (entry: Omit<RelapseLog, "id">) => {
      const result = await addRelapseLog(entry);
      setRelapseLogs(await getRelapseLogs());
      return result;
    },
    []
  );

  const removeRelapse = useCallback(async (id: string) => {
    await deleteRelapseLog(id);
    setRelapseLogs(await getRelapseLogs());
  }, []);

  const updateRelapse = useCallback(async (log: RelapseLog) => {
    await updateRelapseLog(log);
    setRelapseLogs(await getRelapseLogs());
  }, []);

  const logAnxiety = useCallback(
    async (entry: Omit<AnxietyLog, "id">) => {
      const result = await addAnxietyLog(entry);
      setAnxietyLogs(await getAnxietyLogs());
      return result;
    },
    []
  );

  const removeAnxiety = useCallback(async (id: string) => {
    await deleteAnxietyLog(id);
    setAnxietyLogs(await getAnxietyLogs());
  }, []);

  const updateAnxiety = useCallback(async (log: AnxietyLog) => {
    await updateAnxietyLog(log);
    setAnxietyLogs(await getAnxietyLogs());
  }, []);

  const logBoredom = useCallback(
    async (entry: Omit<BoredomLog, "id">) => {
      const result = await addBoredomLog(entry);
      setBoredomLogs(await getBoredomLogs());
      return result;
    },
    []
  );

  const removeBoredom = useCallback(async (id: string) => {
    await deleteBoredomLog(id);
    setBoredomLogs(await getBoredomLogs());
  }, []);

  const updateBoredom = useCallback(async (log: BoredomLog) => {
    await updateBoredomLog(log);
    setBoredomLogs(await getBoredomLogs());
  }, []);

  const reload = useCallback(async () => {
    await load();
  }, [load]);

  return {
    cravingLogs,
    relapseLogs,
    anxietyLogs,
    boredomLogs,
    loading,
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
