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

  const load = useCallback(async () => {
    const [savedSobrietyDate, svc, contacts] = await Promise.all([
      getSetting("sobrietyStartDate", ""),
      getCrisisService(),
      getEmergencyContacts(),
    ]);
    const raw = savedSobrietyDate as string;
    setSobrietyStartDateState(raw && raw.length > 0 ? raw : null);
    setCrisisServiceState(svc);
    setEmergencyContactsState(contacts);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
    setSobrietyStartDate,
    setCrisisService,
    setEmergencyContacts,
    reload,
  };
}
