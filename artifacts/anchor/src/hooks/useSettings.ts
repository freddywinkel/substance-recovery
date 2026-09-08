import { clearStorageIssue, registerStorageRetry, setStorageIssue } from "@/lib/storageIntegrity";
import { useState, useEffect, useCallback } from "react";
import {
  CrisisService,
  EmergencyContact,
  getSetting,
  setSetting,
  getCrisisService,
  getEmergencyContacts,
  saveCrisisService,
  saveEmergencyContacts,
} from "@/db";

export function useSettings() {
  const [sobrietyStartDate, setSobrietyStartDateState] = useState<string | null>(
    null
  );
  const [crisisService, setCrisisServiceState] = useState<CrisisService | null>(
    null
  );
  const [emergencyContacts, setEmergencyContactsState] = useState<
    EmergencyContact[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [savedSobrietyDate, svc, contacts] = await Promise.all([getSetting("sobrietyStartDate", ""), getCrisisService(), getEmergencyContacts()]);
      const raw = savedSobrietyDate as string;
      setSobrietyStartDateState(raw && raw.length > 0 ? raw : null);
      setCrisisServiceState(svc); setEmergencyContactsState(contacts);
      setLoadError(null); clearStorageIssue("settings");
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error(String(cause));
      setLoadError(error); setStorageIssue("settings", "read", error);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { const unregister = registerStorageRetry("settings", load); void load(); return unregister; }, [load]);

  const setSobrietyStartDate = useCallback(
    async (date: string | null) => {
      await setSetting("sobrietyStartDate", date ?? "");
      setSobrietyStartDateState(date);
    },
    []
  );

  const setCrisisService = useCallback(
    async (service: CrisisService | null) => {
      await saveCrisisService(service);
      setCrisisServiceState(service);
    },
    []
  );

  const setEmergencyContacts = useCallback(
    async (contacts: EmergencyContact[]) => {
      await saveEmergencyContacts(contacts);
      setEmergencyContactsState(contacts);
    },
    []
  );

  const reload = useCallback(async () => {
    await load();
  }, [load]);

  return {
    sobrietyStartDate,
    crisisService,
    emergencyContacts,
    loading,
    loadError,
    setSobrietyStartDate,
    setCrisisService,
    setEmergencyContacts,
    reload,
  };
}
