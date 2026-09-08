import { useSyncExternalStore } from "react";
import { getDB } from "@/db/schema";

export interface StorageIssue { kind: "read" | "readback" | "write"; error: Error; }
let snapshot: Readonly<Record<string, StorageIssue>> = {};
const listeners = new Set<() => void>();
const retryCallbacks = new Map<string, () => Promise<void>>();
export function setStorageIssue(source: string, kind: StorageIssue["kind"], cause: unknown) {
  snapshot = { ...snapshot, [source]: { kind, error: cause instanceof Error ? cause : new Error(String(cause)) } };
  listeners.forEach(listener => listener());
}
export function clearStorageIssue(source: string) {
  if (!snapshot[source]) return;
  const next = { ...snapshot }; delete next[source]; snapshot = next;
  listeners.forEach(listener => listener());
}
export function registerStorageRetry(source: string, callback: () => Promise<void>) {
  retryCallbacks.set(source, callback);
  return () => { if (retryCallbacks.get(source) === callback) retryCallbacks.delete(source); };
}
export function useStorageIntegrity() {
  return useSyncExternalStore(callback => { listeners.add(callback); return () => { listeners.delete(callback); }; }, () => snapshot, () => snapshot);
}
export async function retryStorageIntegrity() {
  await Promise.allSettled(Object.keys(snapshot).map(async source => {
    const retry = retryCallbacks.get(source);
    if (retry) { await retry(); return; }
    if (snapshot[source]?.kind === "write") return;
    try {
      const db = await getDB();
      if (source === "settings") {
        const { getEmergencyContacts, getCrisisService } = await import("@/db/crud");
        await Promise.all([getEmergencyContacts(), getCrisisService()]);
      } else await db.getAll(source === "journal" ? "journal" : "settings");
      clearStorageIssue(source);
    } catch (error) { setStorageIssue(source, "read", error); }
  }));
}
