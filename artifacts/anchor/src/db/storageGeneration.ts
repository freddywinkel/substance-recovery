import type { IDBPDatabase } from "idb";
import { publishDatabaseLifecycle } from "./lifecycle";

/** Content-free local metadata. Never exported or interpreted as user data. */
export const STORAGE_GENERATION_KEY = "storage-generation";
export const INITIAL_STORAGE_GENERATION = "initial";
let loadedGeneration: string | null = null;

/** Capture once per app load, even if an interrupted connection later reopens. */
export function captureStorageGeneration(generation: string): void {
  loadedGeneration ??= generation;
}
export function getLoadedStorageGeneration(): string {
  return loadedGeneration ?? INITIAL_STORAGE_GENERATION;
}
export class DatabaseResetError extends Error {
  constructor() {
    super("Local data was erased or restored. Reload this window before saving; its previous input cannot overwrite the new data.");
    this.name = "DatabaseResetError";
  }
}

/**
 * Keep the generation check in the SAME transaction as every write, including
 * idb convenience methods and callers that retain a database handle. syncMeta
 * serializes reset/restore against those writes, independently of clocks.
 * A stale window can still read/export; only a full app load grants a new write
 * generation, so refreshing one provider cannot reauthorize its old forms.
 */
export function guardDatabaseWrites<DB>(
  database: IDBPDatabase<DB>,
  generation: () => string = getLoadedStorageGeneration,
  onReset: (error: DatabaseResetError) => void = error => publishDatabaseLifecycle({ kind: "reset", error }),
): IDBPDatabase<DB> {
  // The guard does not reinterpret values; erase only the schema type locally
  // so a caller can keep its precise store types at the returned boundary.
  const raw = database as IDBPDatabase;
  const writes = new Set(["put", "add", "delete", "clear"]);
  const guarded = new Proxy(raw, {
    get(target, property) {
      if (property === "transaction") return (names: string | string[], mode?: IDBTransactionMode, options?: IDBTransactionOptions) => {
        if (mode !== "readwrite") return target.transaction(names, mode, options);
        const requested = typeof names === "string" ? [names] : Array.from(names);
        const tx = target.transaction([...new Set([...requested, "syncMeta"])], mode, options);
        let resetError: DatabaseResetError | null = null;
        let guardError: unknown;
        let generationRead: Promise<{ value?: unknown } | undefined>;
        try { generationRead = tx.objectStore("syncMeta").get(STORAGE_GENERATION_KEY); }
        catch (error) {
          tx.abort();
          void tx.done.catch(() => undefined);
          throw error;
        }
        // Queue this request before returning the transaction to its caller.
        const checked = generationRead.then(row => {
          if ((row?.value ?? INITIAL_STORAGE_GENERATION) !== generation()) {
            resetError = new DatabaseResetError();
            tx.abort();
            onReset(resetError);
            throw resetError;
          }
        }).catch(error => {
          guardError = error;
          try { tx.abort(); } catch { /* already aborted */ }
          throw error;
        });
        const done = Promise.all([checked, tx.done]).then(() => undefined, error => { throw resetError ?? guardError ?? error; });
        void done.catch(() => undefined);
        return new Proxy(tx, {
          get(transaction, key) {
            if (key === "done") return done;
            // Adding the private guard store must not change idb's tx.store API.
            if (key === "store") return requested.length === 1 ? transaction.objectStore(requested[0]) : undefined;
            const value = Reflect.get(transaction, key, transaction);
            return typeof value === "function" ? value.bind(transaction) : value;
          },
        });
      };
      if (typeof property === "string" && writes.has(property)) return async (store: string, ...args: unknown[]) => {
        const tx = guarded.transaction(store, "readwrite");
        try {
          const operation = tx.store![property as "put"] as (...values: unknown[]) => Promise<unknown>;
          const result = await operation.apply(tx.store, args);
          await tx.done;
          return result;
        } catch (error) {
          // Prefer the explanatory generation error over a request AbortError.
          await tx.done;
          throw error;
        }
      };
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return guarded as IDBPDatabase<DB>;
}
