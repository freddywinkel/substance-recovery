import { getDB } from "./schema";

export interface RegistrationSessionSnapshot {
  activeRegistration: unknown;
  suspendedRegistrations: unknown;
}

export class RegistrationSessionConflictError extends Error {
  constructor() {
    super("This registration was changed in another window. Reload the saved version before continuing.");
    this.name = "RegistrationSessionConflictError";
  }
}

/** Read the active draft and preserved stack from one consistent snapshot. */
export async function getRegistrationSessionState(): Promise<RegistrationSessionSnapshot> {
  const transaction = (await getDB()).transaction("settings", "readonly");
  void transaction.done.catch(() => undefined);
  const [active, suspended] = await Promise.all([
    transaction.store.get("activeRegistration"),
    transaction.store.get("suspendedRegistrations"),
  ]);
  await transaction.done;
  return { activeRegistration: active?.value ?? "", suspendedRegistrations: suspended?.value ?? "" };
}

/**
 * Atomically update the active registration and its suspended-draft stack.
 * Keeping both values in one IndexedDB transaction prevents a crash between
 * "preserve" and "start another" from orphaning either draft.
 */
export async function setRegistrationSessionState(
  activeRegistration: string,
  suspendedRegistrations: string,
  expected?: RegistrationSessionSnapshot,
): Promise<void> {
  const db = await getDB();
  const transaction = db.transaction("settings", "readwrite");
  void transaction.done.catch(() => undefined);
  try {
    if (expected) {
      const [active, suspended] = await Promise.all([
        transaction.store.get("activeRegistration"),
        transaction.store.get("suspendedRegistrations"),
      ]);
      if (!Object.is(active?.value ?? "", expected.activeRegistration)
        || !Object.is(suspended?.value ?? "", expected.suspendedRegistrations)) throw new RegistrationSessionConflictError();
    }
    await Promise.all([
      transaction.store.put({ key: "activeRegistration", value: activeRegistration }),
      transaction.store.put({ key: "suspendedRegistrations", value: suspendedRegistrations }),
    ]);
    await transaction.done;
  } catch (error) {
    try { transaction.abort(); } catch { /* already closed */ }
    await transaction.done.catch(() => undefined);
    throw error;
  }
}
