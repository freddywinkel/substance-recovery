import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { ChevronDown, ChevronUp, Cigarette, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useStore } from "@/hooks/useStore";
import { useT } from "@/hooks/useTranslation";
import { CATEGORY_META } from "@/lib/constants";
import type {
  AnxietyLog,
  BoredomLog,
  CigaretteLog,
  CravingLog,
  RelapseLog,
} from "@/db";
import { CigaretteDayDrawer } from "./CigaretteDayDrawer";
import { logicalTimestamp } from "@/lib/registrationIds";
import { completedStatusEntries } from "@/lib/analytics";
import { useRecoveryFeatures } from "@/contexts/RecoveryFeaturesContext";
import {
  buildReviewRegistrations,
  formatSafetyObservations,
  formatIntensityObservations,
  type ReviewRegistration,
} from "@/lib/recoveryProgress";
import { deleteRegistrationEpisode, updateRegistrationEpisode } from "@/db";
import {
  RegistrationCorrection,
  correctionAnswers,
  localDateTime,
  type DetailedCorrectionRecord,
} from "./RegistrationCorrection";
import type {
  QuickRegistrationRecord,
  RegistrationType,
} from "@/lib/recoveryFeatures";
import { describeUseDetail, useDetailsForRecord } from "@/lib/useDetails";
import { useLocalDraft } from "@/hooks/useLocalDraft";
import { DraftStatus } from "./DraftStatus";
import { flushLocalDrafts } from "@/lib/localDrafts";
import { CorrectionDraftCleanupError, correctionSourceRecord, isRegistrationCorrectionDraft, type RegistrationCorrectionDraft } from "@/lib/registrationCorrectionDraft";
import {
  cravingRegistrationKind,
  registrationBoolean,
  registrationNumber,
  registrationOptionId,
  registrationOptionIds,
  registrationText,
} from "@/lib/canonicalRegistration";

export type RegistrationEntry =
  | (CravingLog & { _type: "trek" | "craving" | "unknown" })
  | (RelapseLog & { _type: "relapse" })
  | (AnxietyLog & { _type: "anxiety" })
  | (BoredomLog & { _type: "boredom" })
  | (CigaretteLog & { _type: "cigarette" });

type CigaretteDayGroup = {
  _type: "cigarette-day";
  id: string;
  dayStart: number;
  count: number;
  logs: CigaretteLog[];
  timestamp: number; // latest timestamp for sorting
};

const LABEL_KEYS: Record<RegistrationEntry["_type"], string> = {
  trek: "registrations.trek.title",
  craving: "registrations.craving.title",
  anxiety: "registrations.anxiety.title",
  boredom: "registrations.boredom.title",
  relapse: "registrations.relapse.title",
  cigarette: "registrations.cigarette.title",
  unknown: "registrations.unknown.title",
};

function fmtDate(ts: number, locale: string) {
  return new Date(ts).toLocaleString(locale === "nl" ? "nl-NL" : "en-GB", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function textValue(value: unknown): string {
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  if (typeof value === "string")
    return value === "unanswered" ? "" : value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

export type DetailItem =
  | { kind: "option"; value: string }
  | { kind: "literal"; value: string | number };

export type Detail = { labelKey: string; items: DetailItem[] };

function optionItems(
  value: string | string[] | null | undefined,
): DetailItem[] {
  const values = Array.isArray(value) ? value : [value];
  return values
    .filter((item): item is string => Boolean(item?.trim()))
    .map((item) => ({ kind: "option", value: item }));
}

function literalItems(value: string | number | null | undefined): DetailItem[] {
  if (typeof value === "number") {
    return Number.isFinite(value) ? [{ kind: "literal", value }] : [];
  }
  if (typeof value !== "string") return [];
  const trimmed = value.trim();
  return trimmed && trimmed !== "unanswered"
    ? [{ kind: "literal", value: trimmed }]
    : [];
}

function detail(labelKey: string, ...groups: DetailItem[][]): Detail {
  const seen = new Set<string>();
  const items = groups.flat().filter((item) => {
    const key = `${item.kind}:${typeof item.value}:${item.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { labelKey, items };
}

export function formatDetailItems(
  items: DetailItem[],
  translateOption: (value: string) => string,
): string {
  return items
    .map((item) =>
      item.kind === "option" ? translateOption(item.value) : String(item.value),
    )
    .filter(Boolean)
    .join(", ");
}

export function detailsFor(entry: RegistrationEntry): Detail[] {
  if (
    entry._type === "trek" ||
    entry._type === "craving" ||
    entry._type === "unknown"
  ) {
    const actionAttempted = registrationBoolean(
      entry,
      "actionAttempted",
      entry.actionAttempted,
    );
    const thoughtTextKey =
      entry._type === "trek" ? "thoughtFreeText" : "thoughtOther";
    const common: Detail[] = [
      detail(
        "logs.detail.intensity",
        literalItems(registrationNumber(entry, "intensity", entry.intensity)),
      ),
      detail(
        "logs.detail.confidence_before",
        literalItems(
          registrationNumber(entry, "confidenceBefore", entry.confidenceBefore),
        ),
      ),
      detail(
        "logs.detail.location",
        optionItems(registrationOptionId(entry, "location", entry.location)),
        literalItems(
          registrationText(entry, "locationOther", entry.locationOther),
        ),
      ),
      detail(
        "logs.detail.emotions",
        optionItems(registrationOptionIds(entry, "emotions", entry.emotions)),
        literalItems(
          registrationText(entry, "emotionOther", entry.emotionOther),
        ),
      ),
      detail(
        "logs.detail.physical",
        optionItems(
          registrationOptionIds(
            entry,
            "physicalSensations",
            entry.physicalSensations,
          ),
        ),
      ),
      detail(
        "logs.detail.thoughts",
        optionItems(
          registrationOptionIds(entry, "thoughts", entry.thoughtPresets),
        ),
        literalItems(
          registrationText(entry, thoughtTextKey, entry.thoughtFreeText),
        ),
      ),
      detail(
        "logs.detail.substances",
        optionItems(registrationOptionIds(entry, "targets", entry.substances)),
      ),
      detail(
        "logs.detail.action",
        optionItems(
          registrationOptionId(entry, "chosenAction", entry.chosenAction),
        ),
      ),
      detail(
        "logs.detail.action_attempted",
        optionItems(
          actionAttempted == null ? null : actionAttempted ? "Yes" : "No",
        ),
      ),
      detail(
        "logs.detail.use_outcome",
        optionItems(
          registrationOptionId(entry, "useOutcome", entry.useOutcome),
        ),
      ),
      detail(
        "logs.detail.symptom_outcome",
        optionItems(
          registrationOptionId(entry, "cravingOutcome", entry.cravingOutcome),
        ),
      ),
      detail(
        "logs.detail.intensity_after",
        literalItems(
          registrationNumber(entry, "intensityAfter", entry.intensityAfter),
        ),
      ),
      detail(
        "logs.detail.confidence_after",
        literalItems(
          registrationNumber(entry, "confidenceAfter", entry.confidenceAfter),
        ),
      ),
    ];
    if (entry._type === "trek") {
      return [
        detail(
          "logs.detail.type",
          optionItems(
            registrationOptionIds(entry, "trekTypes", entry.trekTypes),
          ),
        ),
        detail(
          "logs.detail.planning",
          optionItems(
            registrationOptionId(entry, "planningStage", entry.planningStage),
          ),
        ),
        detail(
          "logs.detail.trigger",
          optionItems(registrationOptionIds(entry, "triggers", entry.triggers)),
          literalItems(
            registrationText(entry, "triggerNote", entry.triggerNote),
          ),
        ),
        detail(
          "logs.detail.need",
          optionItems(
            registrationOptionIds(
              entry,
              "needs",
              entry.needTypes?.length
                ? entry.needTypes
                : entry.needType
                  ? [entry.needType]
                  : [],
            ),
          ),
          literalItems(registrationText(entry, "needOther", entry.needOther)),
        ),
        ...common,
      ];
    }
    if (entry._type === "craving") {
      return [
        detail(
          "logs.detail.onset",
          optionItems(
            registrationOptionId(entry, "onsetType", entry.onsetType),
          ),
          literalItems(registrationText(entry, "onsetOther", entry.onsetOther)),
        ),
        detail(
          "logs.detail.situation",
          optionItems(
            registrationOptionIds(entry, "situations", entry.situationPresets),
          ),
          literalItems(
            registrationText(entry, "situationOther", entry.situationOther),
          ),
        ),
        detail(
          "logs.detail.buildup",
          optionItems(
            registrationOptionId(
              entry,
              "buildupDuration",
              entry.buildupDuration,
            ),
          ),
        ),
        ...common,
      ];
    }
    return common;
  }

  if (entry._type === "anxiety") {
    const urgency = registrationBoolean(
      entry,
      "urgencyHigh",
      entry.urgencyHigh,
    );
    return [
      detail(
        "logs.detail.type",
        optionItems(
          registrationOptionIds(entry, "anxietyTypes", entry.anxietyTypes),
        ),
      ),
      detail(
        "logs.detail.intensity",
        literalItems(registrationNumber(entry, "intensity", entry.intensity)),
      ),
      detail(
        "logs.detail.body_location",
        optionItems(
          registrationOptionIds(
            entry,
            "bodyLocations",
            entry.bodyLocations?.length
              ? entry.bodyLocations
              : entry.bodySensations,
          ),
        ),
      ),
      detail(
        "logs.detail.prediction",
        literalItems(
          registrationText(entry, "bodyPrediction", entry.bodyPrediction),
        ),
      ),
      detail(
        "logs.detail.urgency",
        optionItems(
          urgency == null
            ? null
            : urgency
              ? "Needs help now"
              : "Can stay with this",
        ),
      ),
      detail(
        "logs.detail.context",
        optionItems(registrationOptionId(entry, "context", entry.context)),
      ),
      detail(
        "logs.detail.reassurance",
        optionItems(
          registrationOptionIds(
            entry,
            "reassuranceSeeking",
            entry.reassuranceSeeking,
          ),
        ),
      ),
      detail(
        "logs.detail.linked_state",
        optionItems(
          registrationOptionIds(
            entry,
            "linkedStates",
            entry.linkedStates?.length
              ? entry.linkedStates
              : entry.linkedState
                ? [entry.linkedState]
                : [],
          ),
        ),
      ),
      detail(
        "logs.detail.trigger",
        optionItems(
          registrationOptionIds(
            entry,
            "triggers",
            entry.triggers?.length
              ? entry.triggers
              : entry.trigger
                ? [entry.trigger]
                : [],
          ),
        ),
      ),
      detail(
        "logs.detail.action",
        optionItems(registrationOptionId(entry, "reaction", entry.reaction)),
      ),
      detail(
        "logs.detail.symptom_outcome",
        optionItems(
          registrationOptionId(entry, "outcomeAfter", entry.outcomeAfter),
        ),
      ),
    ];
  }

  if (entry._type === "boredom") {
    const delaySeconds = registrationNumber(entry, "delayDuration", null);
    return [
      detail(
        "logs.detail.type",
        optionItems(
          registrationOptionIds(
            entry,
            "restlessnessTypes",
            entry.restlessnessTypes?.length
              ? entry.restlessnessTypes
              : entry.feelingTypes,
          ),
        ),
      ),
      detail(
        "logs.detail.intensity",
        literalItems(registrationNumber(entry, "intensity", entry.intensity)),
      ),
      detail(
        "logs.detail.need",
        optionItems(
          registrationOptionIds(
            entry,
            "stimulationNeeds",
            entry.stimulationNeeds?.length
              ? entry.stimulationNeeds
              : entry.stimulationNeed
                ? [entry.stimulationNeed]
                : [],
          ),
        ),
      ),
      detail(
        "logs.detail.classification",
        optionItems(
          registrationOptionId(entry, "convertCheck", entry.convertCheck),
        ),
      ),
      detail(
        "logs.detail.situation",
        optionItems(registrationOptionId(entry, "situation", entry.situation)),
        literalItems(
          registrationText(entry, "situationOther", entry.situationOther),
        ),
      ),
      detail(
        "logs.detail.urge",
        optionItems(registrationOptionId(entry, "urge", entry.urge)),
        literalItems(registrationText(entry, "urgeOther", entry.urgeOther)),
      ),
      detail(
        "logs.detail.rescue",
        optionItems(
          registrationOptionIds(entry, "rescueMenu", entry.rescueMenu),
        ),
      ),
      detail(
        "logs.detail.action",
        optionItems(registrationOptionId(entry, "action", entry.action)),
      ),
      detail(
        "logs.detail.delay",
        literalItems(
          delaySeconds == null
            ? registrationText(entry, "delayDuration", entry.delayDuration)
            : `${Math.round(delaySeconds / 60)} min`,
        ),
      ),
      detail(
        "logs.detail.symptom_outcome",
        optionItems(
          registrationOptionId(entry, "outcomeAfter", entry.outcomeAfter),
        ),
      ),
    ];
  }

  if (entry._type === "relapse") {
    return [
      detail(
        "logs.detail.label",
        optionItems(registrationOptionId(entry, "label", entry.label)),
      ),
      detail(
        "logs.detail.when",
        optionItems(registrationOptionId(entry, "when", entry.when)),
      ),
      detail(
        "logs.detail.duration",
        optionItems(
          registrationOptionId(entry, "episodeDuration", entry.episodeDuration),
        ),
      ),
      detail(
        "logs.detail.substances",
        optionItems(
          registrationOptionIds(entry, "substances", entry.substances),
        ),
      ),
      detail(
        "logs.detail.amount",
        optionItems(
          registrationOptionId(entry, "amountCategory", entry.amountCategory),
        ),
      ),
      detail(
        "logs.detail.trigger",
        optionItems(
          registrationOptionId(
            entry,
            "firstTriggerType",
            entry.firstTriggerType,
          ),
        ),
        literalItems(
          registrationText(entry, "firstTriggerText", entry.firstTriggerText),
        ),
      ),
      detail(
        "logs.detail.lead_up",
        optionItems(
          registrationOptionIds(entry, "preUseFactors", entry.preUseFactors),
        ),
        literalItems(registrationText(entry, "leadUpContext", entry.context)),
      ),
      detail(
        "logs.detail.warning_signs",
        optionItems(
          registrationOptionIds(entry, "missedWarnings", entry.missedWarnings),
        ),
      ),
      detail(
        "logs.detail.thoughts",
        optionItems(
          registrationOptionIds(
            entry,
            "preUseThoughts",
            entry.preUseThoughtPresets?.length
              ? entry.preUseThoughtPresets
              : entry.preUseThoughtPreset
                ? [entry.preUseThoughtPreset]
                : [],
          ),
        ),
        literalItems(
          registrationText(
            entry,
            "preUseThoughtFreeText",
            entry.preUseThoughtFreeText,
          ),
        ),
      ),
      detail(
        "logs.detail.could_help_early",
        optionItems(
          registrationOptionIds(
            entry,
            "couldHaveHelpedEarly",
            entry.couldHaveHelpedEarly,
          ),
        ),
      ),
      detail(
        "logs.detail.could_help_middle",
        optionItems(
          registrationOptionIds(
            entry,
            "couldHaveHelpedMiddle",
            entry.couldHaveHelpedMiddle,
          ),
        ),
      ),
      detail(
        "logs.detail.could_help_last",
        optionItems(
          registrationOptionIds(
            entry,
            "couldHaveHelpedLast",
            entry.couldHaveHelpedLast,
          ),
        ),
      ),
      detail(
        "logs.detail.support",
        optionItems(
          registrationOptionId(entry, "supportContact", entry.supportContact),
        ),
        literalItems(
          registrationText(
            entry,
            "supportContactOther",
            entry.supportContactOther,
          ),
        ),
      ),
      detail(
        "logs.detail.next_step",
        optionItems(registrationOptionId(entry, "nextStep", entry.nextStep)),
        literalItems(
          registrationText(entry, "nextStepOther", entry.nextStepOther),
        ),
      ),
      detail(
        "logs.detail.risk",
        optionItems(
          registrationOptionIds(entry, "acuteRisks", entry.acuteRisks),
        ),
      ),
      detail(
        "logs.detail.need",
        optionItems(
          registrationOptionId(entry, "whatNeeded", entry.whatNeeded),
        ),
      ),
      detail(
        "logs.detail.repair",
        optionItems(
          registrationOptionIds(entry, "repairActions", entry.repairActions),
        ),
      ),
      detail(
        "logs.detail.emotion_after",
        literalItems(
          registrationNumber(entry, "emotionAfter", entry.emotionAfter),
        ),
      ),
    ];
  }

  return [];
}

export function registrationEntriesForHistory(logs: {
  cravingLogs: CravingLog[];
  relapseLogs: RelapseLog[];
  anxietyLogs: AnxietyLog[];
  boredomLogs: BoredomLog[];
}): RegistrationEntry[] {
  return [
    ...completedStatusEntries(logs.cravingLogs).map(
      (log) =>
        ({
          ...log,
          _type: cravingRegistrationKind(log) ?? "unknown",
        }) as RegistrationEntry,
    ),
    ...completedStatusEntries(logs.relapseLogs).map((log) => ({
      ...log,
      _type: "relapse" as const,
    })),
    ...logs.anxietyLogs.map((log) => ({ ...log, _type: "anxiety" as const })),
    ...logs.boredomLogs.map((log) => ({ ...log, _type: "boredom" as const })),
  ];
}

function DetailRow({ label, value }: { label: string; value: unknown }) {
  const text = textValue(value);
  if (!text) return null;
  return (
    <p className="text-xs text-muted-foreground">
      <span className="font-medium text-foreground">{label}:</span> {text}
    </p>
  );
}

function DetailItemsRow({
  label,
  items,
  translateOption,
}: {
  label: string;
  items: DetailItem[];
  translateOption: (value: string) => string;
}) {
  const text = formatDetailItems(items, translateOption);
  if (!text) return null;
  return (
    <p className="text-xs text-muted-foreground">
      <span className="font-medium text-foreground">{label}:</span> {text}
    </p>
  );
}

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

type EpisodeHistoryItem =
  | {
      id: string;
      timestamp: number;
      type: RegistrationType | "unknown";
      review?: ReviewRegistration;
      detailed?: RegistrationEntry;
      quick?: QuickRegistrationRecord;
    }
  | CigaretteDayGroup;

export function RegistrationHistory() {
  const store = useStore();
  const features = useRecoveryFeatures();
  const { t, tOpt, language } = useT();
  const nl = language === "nl";
  const { toast } = useToast();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const correctionDraft = useLocalDraft<RegistrationCorrectionDraft | null>("registration-correction", null, {
    ready: !store.loading && !features.loading && !store.loadError && !features.loadError,
    validate: isRegistrationCorrectionDraft,
  });
  const correctionRef = useRef<HTMLElement>(null);
  useEffect(() => { if (correctionDraft.value) correctionRef.current?.scrollIntoView({ block: "start" }); }, [correctionDraft.value?.entryId]);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    scope: "episode" | "reflection";
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [visibleCount, setVisibleCount] = useState(50);
  const [cigaretteDrawerDay, setCigaretteDrawerDay] = useState<number | null>(
    null,
  );
  const items = useMemo<EpisodeHistoryItem[]>(() => {
    const detailed = registrationEntriesForHistory(store);
    const reviews = buildReviewRegistrations({
      ...store,
      quickRegistrations: features.quickRegistrations,
    });
    const represented = new Set<string>();
    const episodes: EpisodeHistoryItem[] = reviews.map((review) => {
      const detail = detailed.find(
        (item) =>
          item.id === review.detailedId &&
          (item._type === review.type || item._type === "unknown"),
      );
      if (detail) represented.add(detail.id);
      return {
        id: review.id,
        timestamp: review.timestamp,
        type: detail?._type === "unknown" ? "unknown" : review.type,
        review,
        detailed: detail,
        quick: features.quickRegistrations.find(
          (item) => item.id === review.quickId,
        ),
      };
    });
    for (const detail of detailed)
      if (!represented.has(detail.id))
        episodes.push({
          id: "legacy:" + detail.id,
          timestamp: logicalTimestamp(detail),
          type: detail._type === "cigarette" ? "unknown" : detail._type,
          detailed: detail,
        });
    const days = new Map<number, CigaretteLog[]>();
    for (const log of store.cigaretteLogs) {
      const day = startOfDay(logicalTimestamp(log));
      days.set(day, [...(days.get(day) ?? []), log]);
    }
    for (const [dayStart, logs] of days)
      episodes.push({
        _type: "cigarette-day",
        id: "cig-day-" + dayStart,
        dayStart,
        count: logs.length,
        logs,
        timestamp: Math.max(...logs.map(logicalTimestamp)),
      });
    return episodes.sort(
      (a, b) => b.timestamp - a.timestamp || a.id.localeCompare(b.id),
    );
  }, [
    store.cravingLogs,
    store.relapseLogs,
    store.anxietyLogs,
    store.boredomLogs,
    store.cigaretteLogs,
    features.quickRegistrations,
  ]);

  const reload = async () => {
    await Promise.all([store.refresh(), features.refresh()]);
  };
  const beginCorrection = (entry: Exclude<EpisodeHistoryItem, CigaretteDayGroup>) => {
    if (!correctionDraft.hydrated || correctionDraft.error || correctionDraft.value) return;
    const type = entry.type === "unknown" ? "craving" : entry.type;
    const detailed = entry.detailed ? correctionSourceRecord(entry.detailed) as DetailedCorrectionRecord : null;
    const quick = entry.quick ? structuredClone(entry.quick) : null;
    const value: RegistrationCorrectionDraft = {
      version: 1, entryId: entry.id, type, detailed, quick,
      answers: detailed ? correctionAnswers(detailed, type) : {},
      eventTime: localDateTime(detailed ? logicalTimestamp(detailed) : logicalTimestamp(quick!)),
      quickValue: quick ? structuredClone(quick) : null,
      useDetails: detailed ? useDetailsForRecord(detailed) : [],
    };
    if (!isRegistrationCorrectionDraft(value)) {
      toast({ title: nl ? "Deze registratie kan niet veilig als concept worden geopend. De opgeslagen gegevens blijven behouden." : "This registration cannot safely be opened as a draft. Saved data is preserved.", variant: "destructive" });
      return;
    }
    correctionDraft.setValue(value);
    setDeleteConfirm(null);
  };
  const saveCorrection = async (value: { detailedRecord?: DetailedCorrectionRecord; quickRecord?: QuickRegistrationRecord }) => {
    const source = correctionDraft.value;
    if (!source || !correctionDraft.hydrated || correctionDraft.error) throw new Error("Restore the correction draft before saving.");
    await flushLocalDrafts();
    const saved = await updateRegistrationEpisode({ type: source.type, ...value, expectedSource: { detailed: source.detailed, quick: source.quick } });
    try {
      // Rebase to the committed source before cleanup. A cleanup failure can
      // then be retried without overwriting newer source or inventing an entry.
      correctionDraft.setValue({ ...source, detailed: saved.detailedRecord ?? null, quick: saved.quickRecord ?? null, quickValue: saved.quickRecord ?? null });
      await flushLocalDrafts();
      await correctionDraft.clearDraft(null, { keepInputOnFailure: true });
    } catch { throw new CorrectionDraftCleanupError(); }
    setExpandedId(null);
    try { await reload(); } catch {
      toast({ title: nl ? "De correctie is opgeslagen. De geschiedenis kon nog niet worden vernieuwd; herlaad de pagina." : "The correction was saved. History could not be refreshed yet; reload the page." });
      return;
    }
    toast({ title: t("logs.save_change") });
  };
  const remove = async (
    entry: EpisodeHistoryItem,
    scope: "episode" | "reflection",
  ) => {
    if (busy) return;
    if (deleteConfirm?.id !== entry.id || deleteConfirm.scope !== scope) {
      setDeleteConfirm({ id: entry.id, scope });
      return;
    }
    setBusy(true);
    try {
      if ("_type" in entry)
        await Promise.all(
          entry.logs.map((log) => store.removeCigarette(log.id)),
        );
      else
        await deleteRegistrationEpisode({
          type: entry.type === "unknown" ? "craving" : entry.type,
          detailedId: entry.detailed?.id,
          quickId: entry.quick?.id,
          scope,
        });
      setDeleteConfirm(null);
      setExpandedId(null);
      await reload();
      toast({ title: t("logs.delete_success") });
    } catch {
      toast({ title: t("logs.delete_error"), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };
  if (store.loading || features.loading)
    return (
      <p role="status" className="p-4 text-sm">
        {nl ? "Geschiedenis laden…" : "Loading history…"}
      </p>
    );
  if (store.loadError || features.loadError)
    return (
      <div role="alert" className="rounded-xl border border-destructive/40 p-4">
        <p className="text-sm">
          {nl
            ? "De geschiedenis kon niet volledig worden geladen. Opgeslagen gegevens zijn niet verwijderd."
            : "The complete history could not be loaded. Stored data has not been removed."}
        </p>
        <button
          type="button"
          onClick={() => void reload()}
          className="min-h-11 text-sm underline"
        >
          {nl ? "Opnieuw proberen" : "Retry"}
        </button>
      </div>
    );
  if (items.length === 0 && !correctionDraft.value && !correctionDraft.error)
    return (
      <p className="rounded-2xl border border-border p-5 text-center text-sm text-muted-foreground">
        {t("logs.empty_all")}
      </p>
    );
  return (
    <div className="flex flex-col gap-3">
      <DraftStatus {...correctionDraft} />
      {correctionDraft.error && <p className="text-sm">{nl ? "Een onleesbaar concept wordt niet verwijderd. Bewaar zo nodig eerst een back-up via " : "Unreadable drafts are not deleted. If needed, first save a backup through "}<Link href="/settings" className="underline">{nl ? "Instellingen" : "Settings"}</Link>.</p>}
      {correctionDraft.value && <section ref={correctionRef} aria-label={nl ? "Concept van correctie" : "Correction draft"} className="scroll-mt-3 rounded-2xl border border-primary/50 bg-card p-4">
        <h2 className="mb-2 font-semibold">{nl ? "Concept van correctie" : "Correction draft"}</h2>
        <p className="mb-3 text-xs text-muted-foreground">{nl ? "Dit concept blijft bewaard als je hulp opent of herlaadt. Sla het op of verwerp het voordat je een andere registratie corrigeert." : "This draft stays available when you open Help or reload. Save or discard it before correcting another registration."}</p>
        <RegistrationCorrection
          key={correctionDraft.value.entryId}
          draft={correctionDraft.value}
          onDraftChange={update => correctionDraft.setValue(current => current ? (typeof update === "function" ? update(current) : update) : current)}
          onCancel={() => correctionDraft.clearDraft(null, { keepInputOnFailure: true })}
          onSave={saveCorrection}
        />
      </section>}
      <p className="text-xs leading-5 text-muted-foreground">
        {nl
          ? "Snelle invoer en gekoppelde reflectie staan samen. Alle opgeslagen gebeurtenissen zijn bereikbaar; sigaretten zijn per dag gegroepeerd."
          : "Quick entries and linked reflections appear together. All saved episodes are available; cigarettes are grouped by day."}{" "}
        {Math.min(visibleCount, items.length)} / {items.length}
      </p>
      {items.slice(0, visibleCount).map((entry) => {
        const cigarette = "_type" in entry;
        const type = cigarette ? "cigarette" : entry.type;
        const meta = cigarette ? { icon: Cigarette, color: "text-muted-foreground" } : CATEGORY_META[type === "unknown" ? "craving" : type];
        const Icon = meta.icon;
        const expanded = expandedId === entry.id;
        return (
          <article
            key={entry.id}
            className="rounded-2xl border border-border/60 bg-card/50 p-4"
          >
            <button
              type="button"
              onClick={() => {
                setExpandedId(expanded ? null : entry.id);
                setDeleteConfirm(null);
              }}
              aria-expanded={expanded}
              aria-controls={"history-" + entry.id}
              className="flex min-h-11 w-full items-center gap-3 text-left"
            >
              <Icon size={20} className={meta.color} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">
                  {cigarette
                    ? t("cigarette.title") + " · " + entry.count
                    : t(LABEL_KEYS[entry.type])}
                </span>
                <time
                  dateTime={new Date(entry.timestamp).toISOString()}
                  className="block text-xs text-muted-foreground"
                >
                  {fmtDate(entry.timestamp, language)}
                </time>
                {!cigarette && (
                  <span className="block text-xs text-muted-foreground">
                    {entry.quick && entry.detailed
                      ? nl
                        ? "Snel + uitgebreid"
                        : "Quick + detailed"
                      : entry.quick
                        ? nl
                          ? "Snel"
                          : "Quick"
                        : nl
                          ? "Uitgebreid"
                          : "Detailed"}
                  </span>
                )}
              </span>
              {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            {expanded && (
              <div
                id={"history-" + entry.id}
                className="mt-3 grid gap-3 border-t border-border pt-3"
              >
                {cigarette ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setCigaretteDrawerDay(entry.dayStart)}
                      className="min-h-11 rounded-xl bg-primary p-3 font-semibold text-primary-foreground"
                    >
                      {t("cigarette.manage_day")}
                    </button>
                    <p className="text-xs">
                      {nl
                        ? "Verwijderen wist alle sigaretten in deze daggroep."
                        : "Deleting removes every cigarette in this day group."}
                    </p>
                  </>
                ) : correctionDraft.value?.entryId === entry.id ? (
                  <button type="button" className="min-h-11 rounded-xl border px-3 text-sm" onClick={() => correctionRef.current?.scrollIntoView({ block: "start" })}>{nl ? "Verder met het concept hierboven" : "Continue the draft above"}</button>
                ) : (
                  <>
                    {entry.quick && (
                      <section className="rounded-xl border border-border/50 p-3">
                        <h3 className="text-sm font-semibold">
                          {nl ? "Snelle invoer" : "Quick entry"}
                        </h3>
                        <p className="mt-1 text-sm whitespace-pre-wrap">
                          {entry.quick.note}
                        </p>
                        <p className="mt-1 text-xs">
                          {tOpt(entry.quick.chosenAction)}{" "}
                          {entry.quick.chosenActionOther}
                        </p>
                      </section>
                    )}
                    {entry.detailed && (
                      <section className="grid gap-2">
                        <h3 className="text-sm font-semibold">
                          {nl ? "Uitgebreide reflectie" : "Detailed reflection"}
                        </h3>
                        <DetailRow
                          label={t("logs.detail.note")}
                          value={registrationText(
                            entry.detailed,
                            "note",
                            entry.detailed.note,
                          )}
                        />
                        {detailsFor(entry.detailed).map((value) => (
                          <DetailItemsRow
                            key={value.labelKey}
                            label={t(value.labelKey)}
                            items={value.items}
                            translateOption={tOpt}
                          />
                        ))}
                        {useDetailsForRecord(entry.detailed).map((detail) => (
                          <p key={detail.target} className="text-xs">
                            {describeUseDetail(detail, language)}
                          </p>
                        ))}
                      </section>
                    )}
                    {entry.review && (
                      <>
                        <p className="whitespace-pre-wrap text-xs leading-5">
                          {formatIntensityObservations(
                            entry.review.intensityObservations,
                            language,
                          )}
                        </p>
                        <p className="whitespace-pre-wrap text-xs leading-5">
                          {formatSafetyObservations(
                            entry.review.safetyObservations,
                            language,
                          )}
                        </p>
                      </>
                    )}
                    {entry.detailed?.startedAt && (
                      <p className="text-xs text-muted-foreground">
                        {nl ? "Reflectie gestart" : "Reflection started"}:{" "}
                        {fmtDate(entry.detailed.startedAt, language)}
                      </p>
                    )}
                    {entry.detailed?.completedAt && (
                      <p className="text-xs text-muted-foreground">
                        {nl ? "Reflectie opgeslagen" : "Reflection saved"}:{" "}
                        {fmtDate(entry.detailed.completedAt, language)}
                      </p>
                    )}
                    {entry.detailed?.editedAt && (
                      <p className="text-xs text-muted-foreground">
                        {nl ? "Gecorrigeerd" : "Corrected"}:{" "}
                        {fmtDate(entry.detailed.editedAt, language)}
                      </p>
                    )}
                    <button
                      type="button"
                      disabled={!correctionDraft.hydrated || !!correctionDraft.error || !!correctionDraft.value}
                      onClick={() => beginCorrection(entry)}
                      className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border text-sm"
                    >
                      <Pencil size={16} />
                      {nl
                        ? "Antwoorden en gebeurtenistijd corrigeren"
                        : "Correct answers and event time"}
                    </button>
                    {entry.quick && entry.detailed && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void remove(entry, "reflection")}
                        className="min-h-11 text-sm text-muted-foreground underline"
                      >
                        {nl
                          ? "Alleen uitgebreide reflectie verwijderen; snelle invoer behouden"
                          : "Delete detailed reflection only; keep quick entry"}
                      </button>
                    )}
                  </>
                )}
                {correctionDraft.value?.entryId !== entry.id && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void remove(entry, "episode")}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-destructive/40 text-sm text-destructive"
                  >
                    <Trash2 size={16} />
                    {nl
                      ? "Hele gebeurtenis verwijderen"
                      : "Delete entire episode"}
                  </button>
                )}
                {deleteConfirm?.id === entry.id && (
                  <div
                    role="alert"
                    className="rounded-xl border border-destructive/40 p-3 text-sm"
                  >
                    <p>
                      {deleteConfirm.scope === "reflection"
                        ? nl
                          ? "Dit verwijdert alleen de uitgebreide reflectie. De snelle invoer blijft als eigen gebeurtenis zichtbaar. Klik nogmaals op dezelfde verwijderknop om te bevestigen."
                          : "This removes only the detailed reflection. The quick entry remains visible. Click the same delete button again to confirm."
                        : nl
                          ? "Dit verwijdert deze gebeurtenis met de gekoppelde snelle en uitgebreide invoer. Klik nogmaals op dezelfde verwijderknop om te bevestigen."
                          : "This removes the episode including linked quick and detailed entries. Click the same delete button again to confirm."}
                    </p>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm(null)}
                      className="min-h-11 underline"
                    >
                      {t("logs.cancel")}
                    </button>
                  </div>
                )}
              </div>
            )}
          </article>
        );
      })}
      {visibleCount < items.length && (
        <button
          type="button"
          onClick={() => setVisibleCount((count) => count + 50)}
          className="min-h-12 rounded-xl border border-border text-sm font-semibold"
        >
          {nl ? "Meer geschiedenis laden" : "Show more history"}
        </button>
      )}
      <CigaretteDayDrawer
        logs={store.cigaretteLogs}
        dayStart={cigaretteDrawerDay ?? Date.now()}
        open={cigaretteDrawerDay !== null}
        onOpenChange={(open) => {
          if (!open) setCigaretteDrawerDay(null);
        }}
        onUpdate={store.updateCigarette}
        onRemove={store.removeCigarette}
        onAdd={store.logCigarette}
      />
    </div>
  );
}
