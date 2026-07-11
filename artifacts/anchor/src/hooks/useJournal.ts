import { useState, useEffect, useCallback } from "react";
import {
  JournalEntry,
  addJournalEntry,
  getJournalEntries,
  deleteJournalEntry,
} from "@/db";

export function useJournal() {
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const entries = await getJournalEntries();
    setJournal(entries);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const logEntry = useCallback(
    async (entry: Omit<JournalEntry, "id">) => {
      await addJournalEntry(entry);
      setJournal(await getJournalEntries());
    },
    []
  );

  const removeEntry = useCallback(async (id: string) => {
    await deleteJournalEntry(id);
    setJournal(await getJournalEntries());
  }, []);

  const reload = useCallback(async () => {
    await load();
  }, [load]);

  return { journal, loading, logEntry, removeEntry, reload };
}
