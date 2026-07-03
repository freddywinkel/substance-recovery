import { openDB, DBSchema, IDBPDatabase } from "idb";

/**
 * Convert a legacy 1–5 journal craving value to its 0–10 equivalent.
 * Linear map: 1→2, 2→4, 3→6, 4→8, 5→10. Values outside 1–5 (including null
 * and already-0–10 values) are returned unchanged.
 */
export function migrateCravingTo0to10(value: number | null): number | null {
  if (value != null && value >= 1 && value <= 5) return value * 2;
  return value;
}
