import { useState, useEffect, useCallback, useRef } from "react";
import { getSetting, setSetting } from "@/db";

export interface ReminderSettings {
  enabled: boolean;
  time: string; // "HH:MM" in 24h format
}

export function useReminders() {
  const [settings, setSettings] = useState<ReminderSettings>({ enabled: false, time: "09:00" });
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [lastReminded, setLastReminded] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load settings from IndexedDB
  useEffect(() => {
    getSetting("reminderSettings", "").then((val) => {
      if (val && typeof val === "string") {
        try {
          const parsed = JSON.parse(val) as ReminderSettings;
          setSettings(parsed);
        } catch {
          // ignore
        }
      }
    });
    getSetting("lastRemindedDate", "").then((val) => {
      if (val && typeof val === "string") {
        setLastReminded(val);
      }
    });
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const saveSettings = useCallback(async (next: ReminderSettings) => {
    setSettings(next);
    await setSetting("reminderSettings", JSON.stringify(next));
  }, []);

  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) return false;
    const result = await Notification.requestPermission();
    setPermission(result);
    return result === "granted";
  }, []);

  const showReminder = useCallback(() => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Anchor - Substance Recovery", {
        body: "How are you feeling today? Take a moment to check in.",
        icon: "/icon-192.png",
        tag: "daily-checkin",
        requireInteraction: false,
      });
    }
  }, []);

  // Check every minute if it's time to remind
  useEffect(() => {
    if (!settings.enabled) return;
    intervalRef.current = setInterval(() => {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const todayStr = now.toISOString().slice(0, 10);
      if (currentTime === settings.time && lastReminded !== todayStr) {
        showReminder();
        setLastReminded(todayStr);
        setSetting("lastRemindedDate", todayStr);
      }
    }, 60000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [settings.enabled, settings.time, lastReminded, showReminder]);

  return { settings, saveSettings, permission, requestPermission, showReminder };
}
