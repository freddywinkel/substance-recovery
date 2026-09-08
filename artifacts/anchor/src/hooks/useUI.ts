import { clearStorageIssue, registerStorageRetry, setStorageIssue } from "@/lib/storageIntegrity";
import { useState, useEffect, useCallback } from "react";
import { getSetting, setSetting } from "@/db";

export type Theme = "dark" | "light";

const THEME_STORAGE_KEY = "anchor-theme";

function getBootTheme(): Theme {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function persistBootTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // IndexedDB remains the source of truth when localStorage is unavailable.
  }
}

export function useUI() {
  const [theme, setThemeState] = useState<Theme>(getBootTheme);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const savedTheme = await getSetting("theme", "dark");
      const nextTheme: Theme = savedTheme === "light" ? "light" : "dark";
      persistBootTheme(nextTheme); setThemeState(nextTheme);
      setLoadError(null); clearStorageIssue("theme");
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error(String(cause));
      setLoadError(error); setStorageIssue("theme", "read", error);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { const unregister = registerStorageRetry("theme", load); void load(); return unregister; }, [load]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
    const themeColor = theme === "light" ? "#F7F5F3" : "#0D0C0B";
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute("content", themeColor);
  }, [theme]);

  const setTheme = useCallback(async (t: Theme) => {
    await setSetting("theme", t);
    persistBootTheme(t);
    setThemeState(t);
  }, []);

  const reload = useCallback(async () => {
    await load();
  }, [load]);

  return { theme, loading, loadError, setTheme, reload };
}
