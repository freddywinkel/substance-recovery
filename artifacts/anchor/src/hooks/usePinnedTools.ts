import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "anchor-pinned-tools";

export function usePinnedTools(): {
  pinned: string[];
  isPinned: (id: string) => boolean;
  togglePin: (id: string) => void;
} {
  const [pinned, setPinned] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setPinned(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pinned));
  }, [pinned]);

  const isPinned = useCallback(
    (id: string) => pinned.includes(id),
    [pinned]
  );

  const togglePin = useCallback((id: string) => {
    setPinned((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }, []);

  return { pinned, isPinned, togglePin };
}
