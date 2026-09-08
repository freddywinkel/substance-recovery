import { getDB } from "./schema";
import {
  isValidRecoveryPlan,
  parseRecoveryPlan,
  parseStoredRecoveryPlan,
  parseHomePreferences,
  parseJson,
  serializeFeatureSetting,
  type RecoveryPlan,
  type HomePreferences,
} from "@/lib/recoveryFeatures";
import { normalizePreventionPlan } from "@/lib/preventionPlan";

export class PlanConflictError extends Error {
  constructor() {
    super("The saved plan changed in another tab.");
    this.name = "PlanConflictError";
  }
}

/** Commit a reviewed personal plan and its related home choices as one unit. */
export async function commitRecoveryPlan(
  plan: RecoveryPlan,
  preferencePatch?: Partial<HomePreferences>,
  now = Date.now(),
) {
  if (!isValidRecoveryPlan(plan))
    throw new Error(
      "The plan contains unsupported values. Your input has been preserved.",
    );
  const db = await getDB();
  const tx = db.transaction("settings", "readwrite");
  void tx.done.catch(() => undefined);
  try {
    const stored = await tx.store.get("recoveryPlan");
    const previous = stored?.value === undefined || stored.value === ""
      ? null
      : parseStoredRecoveryPlan(stored.value);
    if ((previous?.updatedAt ?? null) !== (plan.updatedAt ?? null)) {
      throw new PlanConflictError();
    }
    const prevention = normalizePreventionPlan(plan.prevention);
    if (previous?.updatedAt) {
      const prior = normalizePreventionPlan(previous.prevention);
      prevention.revisions = [
        ...prevention.revisions,
        {
          revision: prior.revision,
          savedAt: previous.updatedAt,
          changeReason: prior.changeReason,
          content: JSON.stringify({
            ...previous,
            prevention: { ...prior, revisions: [] },
          }),
        },
      ];
    }
    prevention.revision = (previous?.prevention?.revision ?? 0) + 1;
    const normalized = parseRecoveryPlan({
      ...plan,
      prevention,
      updatedAt: Math.max(now, (previous?.updatedAt ?? 0) + 1),
    });
    const storedPreferences = await tx.store.get("homePreferences");
    const preferences = preferencePatch
      ? parseHomePreferences({
          ...parseHomePreferences(parseJson(storedPreferences?.value)),
          ...preferencePatch,
        })
      : null;
    await tx.store.put({
      key: "recoveryPlan",
      value: serializeFeatureSetting(normalized),
    });
    if (preferences)
      await tx.store.put({
        key: "homePreferences",
        value: serializeFeatureSetting(preferences),
      });
    await tx.done;
    return { plan: normalized, preferences };
  } catch (error) {
    try {
      tx.abort();
    } catch {
      /* Already aborted or completed. */
    }
    await tx.done.catch(() => undefined);
    throw error;
  }
}
