import { getDB } from "./schema";

/**
 * Atomically update the active registration and its suspended-draft stack.
 * Keeping both values in one IndexedDB transaction prevents a crash between
 * "preserve" and "start another" from orphaning either draft.
 */
export async function setRegistrationSessionState(
  activeRegistration: string,
  suspendedRegistrations: string,
): Promise<void> {
  const db = await getDB();
  const transaction = db.transaction("settings", "readwrite");
  await Promise.all([
    transaction.store.put({ key: "activeRegistration", value: activeRegistration }),
    transaction.store.put({ key: "suspendedRegistrations", value: suspendedRegistrations }),
    transaction.done,
  ]);
}
