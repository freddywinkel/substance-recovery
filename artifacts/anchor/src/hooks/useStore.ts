import { useState, useEffect, useCallback } from "react";
import {
  JournalEntry,
  CravingLog,
  RelapseLog,
  AnxietyLog,
  BoredomLog,
  CrisisService,
  EmergencyContact,
  addJournalEntry,
  getJournalEntries,
  deleteJournalEntry,
  getSetting,
  setSetting,
  clearAllData,
  addCravingLog,
  getCravingLogs,
  deleteCravingLog,
  addRelapseLog,
  getRelapseLogs,
  deleteRelapseLog,
  addAnxietyLog,
  getAnxietyLogs,
  deleteAnxietyLog,
  addBoredomLog,
  getBoredomLogs,
  deleteBoredomLog,
  getCrisisService,
  saveCrisisService,
  getEmergencyContacts,
  saveEmergencyContacts,
  SYNC_APPLIED_EVENT,
} from "@/db";
import { eraseAccountAndLocalData } from "@/lib/sync-engine";

export type Theme = "dark" | "light";

interface StoreState {
  journal: JournalEntry[];
  cravingLogs: CravingLog[];
  relapseLogs: RelapseLog[];
  anxietyLogs: AnxietyLog[];
  boredomLogs: BoredomLog[];
  theme: Theme;
  sobrietyStartDate: string | null;
  crisisService: CrisisService | null;
  emergencyContacts: EmergencyContact[];
  loading: boolean;
}

interface StoreActions {
  logEntry: (entry: Omit<JournalEntry, "id">) => Promise<void>;
  removeEntry: (id: string) => Promise<void>;
  logCraving: (entry: Omit<CravingLog, "id">) => Promise<CravingLog>;
  removeCraving: (id: string) => Promise<void>;
  logRelapse: (entry: Omit<RelapseLog, "id">) => Promise<RelapseLog>;
  removeRelapse: (id: string) => Promise<void>;
  logAnxiety: (entry: Omit<AnxietyLog, "id">) => Promise<AnxietyLog>;
  removeAnxiety: (id: string) => Promise<void>;
  logBoredom: (entry: Omit<BoredomLog, "id">) => Promise<BoredomLog>;
  removeBoredom: (id: string) => Promise<void>;
  setTheme: (t: Theme) => Promise<void>;
  setSobrietyStartDate: (date: string | null) => Promise<void>;
  setCrisisService: (service: CrisisService | null) => Promise<void>;
  setEmergencyContacts: (contacts: EmergencyContact[]) => Promise<void>;
  resetAllData: (opts?: {
    signedIn?: boolean;
    userId?: string | null;
  }) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useStore(): StoreState & StoreActions {
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [cravingLogs, setCravingLogs] = useState<CravingLog[]>([]);
  const [relapseLogs, setRelapseLogs] = useState<RelapseLog[]>([]);
  const [anxietyLogs, setAnxietyLogs] = useState<AnxietyLog[]>([]);
  const [boredomLogs, setBoredomLogs] = useState<BoredomLog[]>([]);
  const [theme, setThemeState] = useState<Theme>("dark");
  const [sobrietyStartDate, setSobrietyStartDateState] = useState<string | null>(null);
  const [crisisService, setCrisisServiceState] = useState<CrisisService | null>(null);
  const [emergencyContacts, setEmergencyContactsState] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [entries, cravings, relapses, anxieties, boredoms, savedTheme, savedSobrietyDate, svc, contacts] = await Promise.all([
      getJournalEntries(),
      getCravingLogs(),
      getRelapseLogs(),
      getAnxietyLogs(),
      getBoredomLogs(),
      getSetting("theme", "dark"),
      getSetting("sobrietyStartDate", ""),
      getCrisisService(),
      getEmergencyContacts(),
    ]);
    setJournal(entries);
    setCravingLogs(cravings);
    setRelapseLogs(relapses);
    setAnxietyLogs(anxieties);
    setBoredomLogs(boredoms);
    setThemeState((savedTheme as Theme) ?? "dark");
    const raw = savedSobrietyDate as string;
    setSobrietyStartDateState(raw && raw.length > 0 ? raw : null);
    setCrisisServiceState(svc);
    setEmergencyContactsState(contacts);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Refresh when a cloud sync pulls in remote changes (cross-device updates).
  useEffect(() => {
    const onApplied = () => { void load(); };
    window.addEventListener(SYNC_APPLIED_EVENT, onApplied);
    return () => window.removeEventListener(SYNC_APPLIED_EVENT, onApplied);
  }, [load]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const logEntry = useCallback(async (entry: Omit<JournalEntry, "id">) => {
    await addJournalEntry(entry);
    setJournal(await getJournalEntries());
  }, []);

  const removeEntry = useCallback(async (id: string) => {
    await deleteJournalEntry(id);
    setJournal(await getJournalEntries());
  }, []);

  const logCraving = useCallback(async (entry: Omit<CravingLog, "id">) => {
    const result = await addCravingLog(entry);
    setCravingLogs(await getCravingLogs());
    return result;
  }, []);

  const removeCraving = useCallback(async (id: string) => {
    await deleteCravingLog(id);
    setCravingLogs(await getCravingLogs());
  }, []);

  const logRelapse = useCallback(async (entry: Omit<RelapseLog, "id">) => {
    const result = await addRelapseLog(entry);
    setRelapseLogs(await getRelapseLogs());
    return result;
  }, []);

  const removeRelapse = useCallback(async (id: string) => {
    await deleteRelapseLog(id);
    setRelapseLogs(await getRelapseLogs());
  }, []);

  const logAnxiety = useCallback(async (entry: Omit<AnxietyLog, "id">) => {
    const result = await addAnxietyLog(entry);
    setAnxietyLogs(await getAnxietyLogs());
    return result;
  }, []);

  const removeAnxiety = useCallback(async (id: string) => {
    await deleteAnxietyLog(id);
    setAnxietyLogs(await getAnxietyLogs());
  }, []);

  const logBoredom = useCallback(async (entry: Omit<BoredomLog, "id">) => {
    const result = await addBoredomLog(entry);
    setBoredomLogs(await getBoredomLogs());
    return result;
  }, []);

  const removeBoredom = useCallback(async (id: string) => {
    await deleteBoredomLog(id);
    setBoredomLogs(await getBoredomLogs());
  }, []);

  const setTheme = useCallback(async (t: Theme) => {
    await setSetting("theme", t);
    setThemeState(t);
  }, []);

  const setSobrietyStartDate = useCallback(async (date: string | null) => {
    await setSetting("sobrietyStartDate", date ?? "");
    setSobrietyStartDateState(date);
  }, []);

  const setCrisisService = useCallback(async (service: CrisisService | null) => {
    await saveCrisisService(service);
    setCrisisServiceState(service);
  }, []);

  const setEmergencyContacts = useCallback(async (contacts: EmergencyContact[]) => {
    await saveEmergencyContacts(contacts);
    setEmergencyContactsState(contacts);
  }, []);

  const resetAllData = useCallback(async (opts?: {
    signedIn?: boolean;
    userId?: string | null;
  }) => {
    if (opts?.signedIn && opts.userId) {
      // Signed in: also wipe the cloud copy (tombstones pushed) so erased data
      // does not survive on the account and re-sync back to this or other devices.
      await eraseAccountAndLocalData(opts.userId);
    } else {
      await clearAllData();
    }
    setJournal([]);
    setCravingLogs([]);
    setRelapseLogs([]);
    setAnxietyLogs([]);
    setBoredomLogs([]);
    setSobrietyStartDateState(null);
    setCrisisServiceState(null);
    setEmergencyContactsState([]);
    setThemeState("dark");
    document.documentElement.setAttribute("data-theme", "dark");
  }, []);

  const refresh = useCallback(async () => { await load(); }, [load]);

  const exportData = useCallback(async () => {
    return import("@/db").then((mod) => mod.exportAllData());
  }, []);

  const importData = useCallback(async (payload: Record<string, unknown>) => {
    const result = await import("@/db").then((mod) => mod.importAllData(payload));
    await load();
    return result;
  }, [load]);

  return {
    journal, cravingLogs, relapseLogs, anxietyLogs, boredomLogs,
    theme, sobrietyStartDate, crisisService, emergencyContacts, loading,
    logEntry, removeEntry,
    logCraving, removeCraving,
    logRelapse, removeRelapse,
    logAnxiety, removeAnxiety,
    logBoredom, removeBoredom,
    setTheme, setSobrietyStartDate,
    setCrisisService, setEmergencyContacts,
    resetAllData, refresh, exportData, importData,
  };
}
