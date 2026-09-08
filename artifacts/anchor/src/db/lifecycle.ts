export type DatabaseLifecycleKind = "opening" | "blocked" | "outdated" | "unavailable" | "reload-required";
export interface DatabaseLifecycleStatus { kind: DatabaseLifecycleKind; error?: Error; }
let status: DatabaseLifecycleStatus | null = { kind: "opening" };
const listeners = new Set<() => void>();
let recoveryRequiresReload = false;

export class DatabaseBlockedError extends Error {
  constructor() { super("Close other Anchor tabs and installed app windows, then retry the database upgrade."); this.name = "DatabaseBlockedError"; }
}
export class DatabaseOutdatedError extends Error {
  constructor() { super("A newer app has opened this database. Reload the updated app before editing."); this.name = "DatabaseOutdatedError"; }
}
export function getDatabaseLifecycleStatus() { return status; }
export function subscribeDatabaseLifecycle(listener: () => void) {
  listeners.add(listener); return () => { listeners.delete(listener); };
}
export function publishDatabaseLifecycle(next: DatabaseLifecycleStatus | null) {
  // A blocked/failed first read can leave several independent providers only
  // partly hydrated. Do not silently reveal those caches when opening succeeds.
  if (next && next.kind !== "opening") recoveryRequiresReload = true;
  status = next ?? (recoveryRequiresReload ? { kind: "reload-required" } : null);
  listeners.forEach(listener => listener());
}
