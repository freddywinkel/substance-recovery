import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  deleteFeatureRecord,
  getFeatureRecords,
  getSetting,
  reconcileQuickReflectionLinks,
  saveFeatureRecord,
  setSetting,
} from "@/db";
import {
  DEFAULT_HOME_PREFERENCES,
  DEFAULT_RECOVERY_PLAN,
  QUICK_REFLECTION_HANDOFF_KEY,
  parseHomePreferences,
  parseJson,
  parseStoredRecoveryPlan,
  serializeFeatureSetting,
  type FeatureRecord,
  type HomePreferences,
  type QuickRegistrationRecord,
  type RecoveryActionRecord,
  type RecoveryActionType,
  type RecoveryPlan,
  type RecoveryToolId,
  type RegistrationType,
  type ToolFollowUpRecord,
  type WeeklyReviewRecord,
} from "@/lib/recoveryFeatures";
import { commitRecoveryPlan } from "@/db/planPersistence";
import { commitPersonalGrowthRecord, removePersonalGrowthRecord } from "@/db/personalGrowth";
import type { PersonalGrowthRecord } from "@/lib/personalGrowth";

const LEGACY_PINNED_TOOLS_KEY = "anchor-pinned-tools";

type NewFeatureRecord<T extends FeatureRecord> = Omit<T, "id" | "updatedAt"> & {
  id?: string;
  updatedAt?: number;
};

type RecoveryFeaturesContextValue = {
  loading: boolean;
  loadError: Error | null;
  homePreferences: HomePreferences;
  recoveryPlan: RecoveryPlan;
  records: FeatureRecord[];
  quickRegistrations: QuickRegistrationRecord[];
  recoveryActions: RecoveryActionRecord[];
  toolFollowUps: ToolFollowUpRecord[];
  weeklyReviews: WeeklyReviewRecord[];
  saveHomePreferences: (preferences: HomePreferences) => Promise<void>;
  patchHomePreferences: (patch: Partial<HomePreferences>) => Promise<void>;
  togglePinnedTool: (toolId: RecoveryToolId) => Promise<void>;
  saveRecoveryPlan: (plan: RecoveryPlan, preferences?: Partial<HomePreferences>) => Promise<RecoveryPlan>;
  addRecord: <T extends FeatureRecord>(record: NewFeatureRecord<T>) => Promise<T>;
  updateRecord: <T extends FeatureRecord>(record: T) => Promise<T>;
  removeRecord: (id: string) => Promise<void>;
  savePersonalRecord: <T extends PersonalGrowthRecord>(record: T, expectedUpdatedAt: number | null) => Promise<T>;
  removePersonalRecord: (record: PersonalGrowthRecord) => Promise<void>;
  addRecoveryAction: (input: {
    actionType: RecoveryActionType;
    label: string;
    note?: string;
    sourceId?: string | null;
    timestamp?: number;
  }) => Promise<RecoveryActionRecord>;
  scheduleToolFollowUp: (input: {
    toolId: RecoveryToolId;
    toolLabel: string;
    feelingBefore: number | null;
    dueAt?: number;
  }) => Promise<ToolFollowUpRecord>;
  startQuickReflection: (id: string) => Promise<QuickRegistrationRecord | null>;
  completeQuickReflection: (
    quickRegistrationId: string | undefined,
    type: RegistrationType,
    detailedRecordId: string,
  ) => Promise<void>;
  refresh: () => Promise<void>;
};

const RecoveryFeaturesContext = createContext<RecoveryFeaturesContextValue | null>(null);

function sortRecords(records: FeatureRecord[]): FeatureRecord[] {
  return records.slice().sort((left, right) => right.timestamp - left.timestamp);
}

export function RecoveryFeaturesProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [homePreferences, setHomePreferencesState] = useState<HomePreferences>(() => ({
    ...DEFAULT_HOME_PREFERENCES,
    widgetOrder: [...DEFAULT_HOME_PREFERENCES.widgetOrder],
  }));
  const [recoveryPlan, setRecoveryPlanState] = useState<RecoveryPlan>({ ...DEFAULT_RECOVERY_PLAN });
  const [records, setRecords] = useState<FeatureRecord[]>([]);
  const homePreferencesRef = useRef(homePreferences);
  const preferenceWriteQueue = useRef<Promise<void>>(Promise.resolve());

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      await preferenceWriteQueue.current;
      await reconcileQuickReflectionLinks();
      const [storedPreferences, storedPlan, storedRecords] = await Promise.all([
        getSetting("homePreferences", ""),
        getSetting("recoveryPlan", ""),
        getFeatureRecords(),
      ]);
      const storedRecoveryPlan = parseStoredRecoveryPlan(storedPlan);
      const preferences = parseHomePreferences(parseJson(storedPreferences));

      // Migrate once only when the typed setting does not exist. An explicit
      // empty list in IndexedDB (including one restored from backup) must win.
      if (storedPreferences === "" && preferences.pinnedToolIds.length === 0) {
        try {
          const legacy = JSON.parse(localStorage.getItem(LEGACY_PINNED_TOOLS_KEY) ?? "[]");
          const migrated = parseHomePreferences({ ...preferences, pinnedToolIds: legacy });
          if (migrated.pinnedToolIds.length > 0) {
            preferences.pinnedToolIds = migrated.pinnedToolIds;
            await setSetting("homePreferences", serializeFeatureSetting(preferences));
          }
        } catch {
          // Invalid legacy pins are ignored; the typed setting stays authoritative.
        }
      }
      try {
        localStorage.removeItem(LEGACY_PINNED_TOOLS_KEY);
      } catch {
        // IndexedDB remains authoritative when localStorage is unavailable.
      }

      homePreferencesRef.current = preferences;
      setHomePreferencesState(preferences);
      setRecoveryPlanState(storedRecoveryPlan);
      setRecords(sortRecords(storedRecords));
    } catch (error) {
      setLoadError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const enqueuePreferenceWrite = useCallback((
    build: (current: HomePreferences) => HomePreferences,
  ): Promise<void> => {
    const write = preferenceWriteQueue.current.then(async () => {
      const next = parseHomePreferences(build(homePreferencesRef.current));
      await setSetting("homePreferences", serializeFeatureSetting(next));
      homePreferencesRef.current = next;
      setHomePreferencesState(next);
      try {
        localStorage.removeItem(LEGACY_PINNED_TOOLS_KEY);
      } catch {
        // A localStorage failure must not turn a successful IndexedDB write
        // into a false save error.
      }
    });
    preferenceWriteQueue.current = write.catch(() => undefined);
    return write;
  }, []);

  const saveHomePreferences = useCallback((preferences: HomePreferences) => {
    const normalized = parseHomePreferences(preferences);
    return enqueuePreferenceWrite(() => normalized);
  }, [enqueuePreferenceWrite]);

  const patchHomePreferences = useCallback((patch: Partial<HomePreferences>) =>
    enqueuePreferenceWrite((current) => ({ ...current, ...patch })),
  [enqueuePreferenceWrite]);

  const togglePinnedTool = useCallback((toolId: RecoveryToolId) =>
    enqueuePreferenceWrite((current) => {
      const pinned = current.pinnedToolIds;
      const pinnedToolIds = pinned.includes(toolId)
        ? pinned.filter((value) => value !== toolId)
        : pinned.length < 2
          ? [...pinned, toolId]
          : pinned;
      return pinnedToolIds === pinned ? current : { ...current, pinnedToolIds };
    }),
  [enqueuePreferenceWrite]);

  const saveRecoveryPlan = useCallback((plan: RecoveryPlan, preferences?: Partial<HomePreferences>) => {
    const write = preferenceWriteQueue.current.then(async () => {
      const saved = await commitRecoveryPlan(plan, preferences);
      setRecoveryPlanState(saved.plan);
      if (saved.preferences) {
        homePreferencesRef.current = saved.preferences;
        setHomePreferencesState(saved.preferences);
      }
      return saved.plan;
    });
    preferenceWriteQueue.current = write.then(() => undefined, () => undefined);
    return write;
  }, []);

  const addRecord = useCallback(async <T extends FeatureRecord>(record: NewFeatureRecord<T>): Promise<T> => {
    const full = {
      ...record,
      id: record.id ?? crypto.randomUUID(),
      updatedAt: record.updatedAt ?? Date.now(),
    } as T;
    await saveFeatureRecord(full);
    setRecords((current) => sortRecords([full, ...current.filter((item) => item.id !== full.id)]));
    return full;
  }, []);

  const updateRecord = useCallback(async <T extends FeatureRecord>(record: T): Promise<T> => {
    const updated = { ...record, updatedAt: Date.now() } as T;
    await saveFeatureRecord(updated);
    setRecords((current) => sortRecords([updated, ...current.filter((item) => item.id !== updated.id)]));
    return updated;
  }, []);

  const removeRecord = useCallback(async (id: string) => {
    await deleteFeatureRecord(id);
    setRecords((current) => current.filter((record) => record.id !== id));
  }, []);

  const savePersonalRecord = useCallback(async <T extends PersonalGrowthRecord>(record: T, expectedUpdatedAt: number | null): Promise<T> => {
    const saved = await commitPersonalGrowthRecord(record, expectedUpdatedAt);
    setRecords(current => sortRecords([saved, ...current.filter(item => item.id !== saved.id)]));
    return saved;
  }, []);

  const removePersonalRecord = useCallback(async (record: PersonalGrowthRecord) => {
    await removePersonalGrowthRecord(record);
    setRecords(current => current.filter(item => item.id !== record.id));
  }, []);

  const addRecoveryAction = useCallback(async (input: {
    actionType: RecoveryActionType;
    label: string;
    note?: string;
    sourceId?: string | null;
    timestamp?: number;
  }) => addRecord<RecoveryActionRecord>({
    recordType: "recovery-action",
    timestamp: input.timestamp ?? Date.now(),
    actionType: input.actionType,
    label: input.label.trim(),
    note: input.note?.trim() ?? "",
    sourceId: input.sourceId ?? null,
  }), [addRecord]);

  const scheduleToolFollowUp = useCallback(async (input: {
    toolId: RecoveryToolId;
    toolLabel: string;
    feelingBefore: number | null;
    dueAt?: number;
  }) => {
    const timestamp = Date.now();
    return addRecord<ToolFollowUpRecord>({
      recordType: "tool-follow-up",
      timestamp,
      dueAt: input.dueAt ?? timestamp + 10 * 60 * 1000,
      toolId: input.toolId,
      toolLabel: input.toolLabel,
      feelingBefore: input.feelingBefore,
      feelingAfter: null,
      attempted: null,
      status: "pending",
      completedAt: null,
    });
  }, [addRecord]);

  const startQuickReflection = useCallback(async (id: string) => {
    const record = records.find((item): item is QuickRegistrationRecord =>
      item.id === id && item.recordType === "quick-registration");
    if (!record) return null;
    const updated = await updateRecord<QuickRegistrationRecord>({
      ...record,
      reflectionStatus: "started",
      reflectionStartedAt: record.reflectionStartedAt ?? Date.now(),
    });
    sessionStorage.setItem(QUICK_REFLECTION_HANDOFF_KEY, JSON.stringify({
      id: updated.id,
      type: updated.registrationType,
      timestamp: updated.timestamp,
    }));
    return updated;
  }, [records, updateRecord]);

  const completeQuickReflection = useCallback(async (
    quickRegistrationId: string | undefined,
    type: RegistrationType,
    detailedRecordId: string,
  ) => {
    if (!quickRegistrationId) return;
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const latest = await getFeatureRecords();
        const record = latest.find((item): item is QuickRegistrationRecord =>
          item.id === quickRegistrationId && item.recordType === "quick-registration");
        if (!record || record.registrationType !== type) return;
        await updateRecord<QuickRegistrationRecord>({
          ...record,
          reflectionStatus: "completed",
          reflectionCompletedAt: Date.now(),
          linkedDetailedRecordId: detailedRecordId,
        });
        setLoadError(null);
        return;
      } catch (error) {
        lastError = error;
      }
    }
    const error = new Error("The detailed registration was saved, but its quick-registration link still needs repair.", {
      cause: lastError,
    });
    setLoadError(error);
    throw error;
  }, [updateRecord]);

  const value = useMemo<RecoveryFeaturesContextValue>(() => ({
    loading,
    loadError,
    homePreferences,
    recoveryPlan,
    records,
    quickRegistrations: records.filter((record): record is QuickRegistrationRecord => record.recordType === "quick-registration"),
    recoveryActions: records.filter((record): record is RecoveryActionRecord => record.recordType === "recovery-action"),
    toolFollowUps: records.filter((record): record is ToolFollowUpRecord => record.recordType === "tool-follow-up"),
    weeklyReviews: records.filter((record): record is WeeklyReviewRecord => record.recordType === "weekly-review"),
    saveHomePreferences,
    patchHomePreferences,
    togglePinnedTool,
    saveRecoveryPlan,
    addRecord,
    updateRecord,
    removeRecord,
    savePersonalRecord,
    removePersonalRecord,
    addRecoveryAction,
    scheduleToolFollowUp,
    startQuickReflection,
    completeQuickReflection,
    refresh: load,
  }), [
    addRecord,
    addRecoveryAction,
    completeQuickReflection,
    homePreferences,
    load,
    loadError,
    loading,
    patchHomePreferences,
    togglePinnedTool,
    records,
    recoveryPlan,
    removeRecord,
    savePersonalRecord,
    removePersonalRecord,
    saveHomePreferences,
    saveRecoveryPlan,
    scheduleToolFollowUp,
    startQuickReflection,
    updateRecord,
  ]);

  return (
    <RecoveryFeaturesContext.Provider value={value}>
      {children}
    </RecoveryFeaturesContext.Provider>
  );
}

export function useRecoveryFeatures(): RecoveryFeaturesContextValue {
  const context = useContext(RecoveryFeaturesContext);
  if (!context) throw new Error("useRecoveryFeatures must be used within RecoveryFeaturesProvider");
  return context;
}
