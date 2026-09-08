import { getSetting, setSetting } from "@/db";
import { getDB } from "@/db/schema";

export interface LocalDraftEnvelope<T = unknown> {
  version: 1;
  revision: number;
  updatedAt: number;
  clientId: string;
  value: T;
}

export function isValidLocalDraftEnvelope(
  value: unknown,
): value is LocalDraftEnvelope {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  if (
    item.version !== 1 ||
    !Number.isSafeInteger(item.revision) ||
    Number(item.revision) < 1 ||
    typeof item.updatedAt !== "number" ||
    !Number.isFinite(item.updatedAt) ||
    item.updatedAt < 0 ||
    typeof item.clientId !== "string" ||
    item.clientId.length > 200 ||
    !("value" in item)
  )
    return false;
  try {
    return JSON.stringify(value).length <= 512_000;
  } catch {
    return false;
  }
}

const queues = new Map<string, Promise<void>>();
const failures = new Map<string, Error>();
export const pendingDraftValues = new Map<string, unknown>();
export const getDraftFailure = (key: string): Error | undefined =>
  failures.get(key);

export function resetLocalDraftMemory(): void {
  if (queues.size) throw new Error("Draft writes are still pending.");
  failures.clear();
  pendingDraftValues.clear();
}

export class DraftConflictError extends Error {
  constructor() {
    super("This draft was changed in another tab.");
    this.name = "DraftConflictError";
  }
}

export function queueDraftWrite(
  key: string,
  work: () => Promise<void>,
): Promise<void> {
  const next = (queues.get(key) ?? Promise.resolve())
    .catch(() => undefined)
    .then(work);
  queues.set(key, next);
  void next
    .then(
      () => {
        failures.delete(key);
      },
      (error) => {
        failures.set(
          key,
          error instanceof Error ? error : new Error(String(error)),
        );
      },
    )
    .finally(() => {
      if (queues.get(key) === next) queues.delete(key);
    });
  return next;
}

export async function flushLocalDrafts(): Promise<void> {
  await Promise.all([...queues.values()]);
  if (failures.size)
    throw new Error(
      "A draft has not been saved. Return to the form and retry before updating.",
    );
}

export async function readLocalDraft<T>(
  key: string,
): Promise<LocalDraftEnvelope<T> | null> {
  await queues.get(key)?.catch(() => undefined);
  const raw = await getSetting(`draft:${key}`, "");
  if (raw === "") return null;
  if (typeof raw !== "string")
    throw new Error("This saved draft cannot be read.");
  const parsed: unknown = JSON.parse(raw);
  if (!isValidLocalDraftEnvelope(parsed))
    throw new Error("This saved draft has an unsupported format.");
  return parsed as LocalDraftEnvelope<T>;
}

export async function writeLocalDraft<T>(
  key: string,
  value: T,
  expectedRevision: number,
  clientId: string,
): Promise<number> {
  // Read inside the same IndexedDB transaction as the write to avoid lost updates across tabs.
  const db = await getDB();
  const tx = db.transaction("settings", "readwrite");
  void tx.done.catch(() => undefined);
  const stored = await tx.store.get(`draft:${key}`);
  const raw = stored?.value;
  let previous: LocalDraftEnvelope | null = null;
  if (raw !== undefined && raw !== "") {
    if (typeof raw !== "string") {
      tx.abort();
      throw new Error("Unsupported saved draft. Your existing data has not been changed.");
    }
    let parsed: unknown;
    try { parsed = JSON.parse(raw); }
    catch {
      tx.abort();
      throw new Error("Unsupported saved draft. Your existing data has not been changed.");
    }
    if (!isValidLocalDraftEnvelope(parsed)) {
      tx.abort();
      throw new Error("Unsupported saved draft.");
    }
    previous = parsed;
  }
  if ((previous?.revision ?? 0) !== expectedRevision) {
    tx.abort();
    throw new DraftConflictError();
  }
  const envelope: LocalDraftEnvelope<T> = {
    version: 1,
    revision: expectedRevision + 1,
    updatedAt: Date.now(),
    clientId,
    value,
  };
  if (!isValidLocalDraftEnvelope(envelope)) {
    tx.abort();
    throw new Error("This draft is too large to save.");
  }
  await tx.store.put({ key: `draft:${key}`, value: JSON.stringify(envelope) });
  await tx.done;
  return envelope.revision;
}

export async function removeLocalDraft(
  key: string,
  expectedRevision?: number,
): Promise<void> {
  if (expectedRevision === undefined) await setSetting(`draft:${key}`, "");
  else {
    const db = await getDB();
    const tx = db.transaction("settings", "readwrite");
    void tx.done.catch(() => undefined);
    try {
      const stored = await tx.store.get(`draft:${key}`);
      const parsed: unknown = stored?.value
        ? JSON.parse(String(stored.value))
        : null;
      if (parsed !== null && !isValidLocalDraftEnvelope(parsed))
        throw new Error("Unsupported saved draft.");
      if ((parsed?.revision ?? 0) !== expectedRevision)
        throw new DraftConflictError();
      await tx.store.put({ key: `draft:${key}`, value: "" });
      await tx.done;
    } catch (error) {
      try {
        tx.abort();
      } catch {
        /* already closed */
      }
      await tx.done.catch(() => undefined);
      throw error;
    }
  }
  failures.delete(key);
  pendingDraftValues.delete(key);
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", (event) => {
    if (queues.size || failures.size) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
}
