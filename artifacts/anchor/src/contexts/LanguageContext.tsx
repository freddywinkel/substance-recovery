import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { getSetting, setSetting } from "@/db";
import type { Language } from "@/lib/translations";
import { clearStorageIssue, registerStorageRetry, setStorageIssue } from "@/lib/storageIntegrity";
interface LanguageContextValue { language: Language; setLanguage: (lang: Language) => Promise<void>; }
const LanguageContext = createContext<LanguageContextValue>({ language: "nl", setLanguage: async () => {} });
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("nl");
  const pending = useRef<Language | null>(null);
  const load = useCallback(async () => {
    try {
      if (pending.current) { await setSetting("language", pending.current); setLanguageState(pending.current); pending.current = null; }
      else { const value = await getSetting("language", "nl"); if (value === "en" || value === "nl") setLanguageState(value); }
      clearStorageIssue("language");
    } catch (error) { setStorageIssue("language", pending.current ? "write" : "read", error); }
  }, []);
  useEffect(() => { const unregister = registerStorageRetry("language", load); void load(); return unregister; }, [load]);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  const setLanguage = useCallback(async (lang: Language) => {
    pending.current = lang;
    await load();
  }, [load]);
  return <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>;
}
export function useLanguage() { return useContext(LanguageContext); }
