import { useCallback } from "react";
import {
  CigaretteLog,
  JournalEntry,
  CravingLog,
  RelapseLog,
  AnxietyLog,
  BoredomLog,
  CrisisService,
  EmergencyContact,
  clearAllData,
  exportAllData,
  importAllData,
} from "@/db";
import { useJournal } from "./useJournal";
import { useLogs } from "./useLogs";
import { useSettings } from "./useSettings";
import { useUI } from "./useUI";

export type { Theme } from "./useUI";

interface StoreState {
  journal: JournalEntry[];
  cigaretteLogs: CigaretteLog[];
  cravingLogs: CravingLog[];
  relapseLogs: RelapseLog[];
  anxietyLogs: AnxietyLog[];
  boredomLogs: BoredomLog[];
  theme: import("./useUI").Theme;
  sobrietyStartDate: string | null;
  crisisService: CrisisService | null;
  emergencyContacts: EmergencyContact[];
  loading: boolean;
}

interface StoreActions {
  logEntry: (entry: Omit<JournalEntry, "id">) => Promise<void>;
  removeEntry: (id: string) => Promise<void>;
  logCigarette: (entry: Omit<CigaretteLog, "id">) => Promise<CigaretteLog>;
  updateCigarette: (entry: CigaretteLog) => Promise<void>;
  removeCigarette: (id: string) => Promise<void>;
  logCraving: (entry: Omit<CravingLog, "id">) => Promise<CravingLog>;
  updateCraving: (entry: CravingLog) => Promise<void>;
  removeCraving: (id: string) => Promise<void>;
  logRelapse: (entry: Omit<RelapseLog, "id">) => Promise<RelapseLog>;
  updateRelapse: (entry: RelapseLog) => Promise<void>;
  removeRelapse: (id: string) => Promise<void>;
  logAnxiety: (entry: Omit<AnxietyLog, "id">) => Promise<AnxietyLog>;
  updateAnxiety: (entry: AnxietyLog) => Promise<void>;
  removeAnxiety: (id: string) => Promise<void>;
  logBoredom: (entry: Omit<BoredomLog, "id">) => Promise<BoredomLog>;
  updateBoredom: (entry: BoredomLog) => Promise<void>;
  removeBoredom: (id: string) => Promise<void>;
  setTheme: (t: import("./useUI").Theme) => Promise<void>;
  setSobrietyStartDate: (date: string | null) => Promise<void>;
  setCrisisService: (service: CrisisService | null) => Promise<void>;
  setEmergencyContacts: (contacts: EmergencyContact[]) => Promise<void>;
  resetAllData: () => Promise<void>;
  refresh: () => Promise<void>;
  exportData: () => Promise<Record<string, unknown>>;
  importData: (
    payload: Record<string, unknown>
  ) => Promise<{ imported: number; skipped: number; errors: string[] }>;
}

export function useStore(): StoreState & StoreActions {
  const journalHook = useJournal();
  const logsHook = useLogs();
  const settingsHook = useSettings();
  const uiHook = useUI();

  const loading =
    journalHook.loading ||
    logsHook.loading ||
    settingsHook.loading ||
    uiHook.loading;

  const refresh = useCallback(async () => {
    await Promise.all([
      journalHook.reload(),
      logsHook.reload(),
      settingsHook.reload(),
      uiHook.reload(),
    ]);
  }, [journalHook.reload, logsHook.reload, settingsHook.reload, uiHook.reload]);

  const resetAllData = useCallback(
    async () => {
      await clearAllData();
      await Promise.all([
        journalHook.reload(),
        logsHook.reload(),
        settingsHook.reload(),
        uiHook.reload(),
      ]);
    },
    [journalHook.reload, logsHook.reload, settingsHook.reload, uiHook.reload]
  );

  const exportData = useCallback(async () => {
    return exportAllData();
  }, []);

  const importData = useCallback(
    async (payload: Record<string, unknown>) => {
      const result = await importAllData(payload);
      await refresh();
      return result;
    },
    [refresh]
  );

  return {
    journal: journalHook.journal,
    cigaretteLogs: logsHook.cigaretteLogs,
    cravingLogs: logsHook.cravingLogs,
    relapseLogs: logsHook.relapseLogs,
    anxietyLogs: logsHook.anxietyLogs,
    boredomLogs: logsHook.boredomLogs,
    theme: uiHook.theme,
    sobrietyStartDate: settingsHook.sobrietyStartDate,
    crisisService: settingsHook.crisisService,
    emergencyContacts: settingsHook.emergencyContacts,
    loading,
    logEntry: journalHook.logEntry,
    removeEntry: journalHook.removeEntry,
    logCigarette: logsHook.logCigarette,
    updateCigarette: logsHook.updateCigarette,
    removeCigarette: logsHook.removeCigarette,
    logCraving: logsHook.logCraving,
    updateCraving: logsHook.updateCraving,
    removeCraving: logsHook.removeCraving,
    logRelapse: logsHook.logRelapse,
    updateRelapse: logsHook.updateRelapse,
    removeRelapse: logsHook.removeRelapse,
    logAnxiety: logsHook.logAnxiety,
    updateAnxiety: logsHook.updateAnxiety,
    removeAnxiety: logsHook.removeAnxiety,
    logBoredom: logsHook.logBoredom,
    updateBoredom: logsHook.updateBoredom,
    removeBoredom: logsHook.removeBoredom,
    setTheme: uiHook.setTheme,
    setSobrietyStartDate: settingsHook.setSobrietyStartDate,
    setCrisisService: settingsHook.setCrisisService,
    setEmergencyContacts: settingsHook.setEmergencyContacts,
    resetAllData,
    refresh,
    exportData,
    importData,
  };
}

// Barrel re-exports for gradual adoption
export { useJournal } from "./useJournal";
export { useLogs } from "./useLogs";
export { useSettings } from "./useSettings";
export { useUI } from "./useUI";
