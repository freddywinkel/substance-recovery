import { useState, useEffect, useCallback } from "react";
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

export function useLogs() {
  const [cigaretteLogs, setCigaretteLogs] = useState<CigaretteLog[]>([]);
  const [cravingLogs, setCravingLogs] = useState<CravingLog[]>([]);
  const [relapseLogs, setRelapseLogs] = useState<RelapseLog[]>([]);
  const [anxietyLogs, setAnxietyLogs] = useState<AnxietyLog[]>([]);
  const [boredomLogs, setBoredomLogs] = useState<BoredomLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [cigarettes, cravings, relapses, anxieties, boredoms] = await Promise.all([
      getCigaretteLogs(),
      getCravingLogs(),
      getRelapseLogs(),
      getAnxietyLogs(),
      getBoredomLogs(),
    ]);
    setCigaretteLogs(cigarettes);
    setCravingLogs(cravings);
    setRelapseLogs(relapses);
    setAnxietyLogs(anxieties);
    setBoredomLogs(boredoms);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
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

  const logCigarette = useCallback(
    async (entry: Omit<CigaretteLog, "id">) => {
      const result = await addCigaretteLog(entry);
      setCigaretteLogs(await getCigaretteLogs());
      return result;
    },
    []
  );

  const removeCigarette = useCallback(async (id: string) => {
    await deleteCigaretteLog(id);
    setCigaretteLogs(await getCigaretteLogs());
  }, []);

  const updateCigarette = useCallback(async (log: CigaretteLog) => {
    await updateCigaretteLog(log);
    setCigaretteLogs(await getCigaretteLogs());
  }, []);

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
