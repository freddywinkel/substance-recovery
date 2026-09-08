import { useState, useEffect, useCallback } from "react";
import { type JournalEntry, addJournalEntry, getJournalEntries, deleteJournalEntry } from "@/db";
import { clearStorageIssue, registerStorageRetry, setStorageIssue } from "@/lib/storageIntegrity";

export type NewJournalEntry = Omit<JournalEntry, "id"> & { id?: string };
export function useJournal() {
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setJournal(await getJournalEntries()); setLoadError(null); clearStorageIssue("journal");
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error(String(error));
      setLoadError(normalized); setStorageIssue("journal", "read", normalized);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { const unregister = registerStorageRetry("journal", load); void load(); return unregister; }, [load]);
  const logEntry = useCallback(async (entry: NewJournalEntry) => {
    const saved = await addJournalEntry(entry);
    try {
      setJournal(await getJournalEntries()); setLoadError(null); clearStorageIssue("journal");
    } catch (error) {
      // The write committed: preserve its stable ID and never ask the user to add it again.
      setJournal(current => [saved, ...current.filter(item => item.id !== saved.id)].sort((a,b) => b.timestamp - a.timestamp));
      setStorageIssue("journal", "readback", error);
    }
    return saved;
  }, []);
  const removeEntry = useCallback(async (id: string) => {
    await deleteJournalEntry(id);
    try { setJournal(await getJournalEntries()); setLoadError(null); clearStorageIssue("journal"); }
    catch (error) { setJournal(current => current.filter(item => item.id !== id)); setStorageIssue("journal", "readback", error); }
  }, []);
  return { journal, loading, loadError, logEntry, removeEntry, reload: load };
}
