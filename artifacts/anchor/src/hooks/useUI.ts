import { useState, useEffect, useCallback } from "react";
import { getSetting, setSetting, SYNC_APPLIED_EVENT } from "@/db";

export type Theme = "dark" | "light";

export function useUI() {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const savedTheme = await getSetting("theme", "dark");
    setThemeState((savedTheme as Theme) ?? "dark");
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

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const setTheme = useCallback(async (t: Theme) => {
    await setSetting("theme", t);
    setThemeState(t);
  }, []);

  const reload = useCallback(async () => {
    await load();
  }, [load]);

  return { theme, loading, setTheme, reload };
}
