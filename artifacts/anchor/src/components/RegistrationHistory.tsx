import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Save, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useStore } from "@/hooks/useStore";
import { useT } from "@/hooks/useTranslation";
import { CATEGORY_META } from "@/lib/constants";
import type { AnxietyLog, BoredomLog, CigaretteLog, CravingLog, RelapseLog } from "@/db";
import { CigaretteDayDrawer } from "./CigaretteDayDrawer";
import { logicalTimestamp } from "@/lib/registrationIds";
import { completedStatusEntries } from "@/lib/analytics";
import {
  cravingRegistrationKind,
  registrationBoolean,
  registrationNumber,
  registrationOptionId,
  registrationOptionIds,
  registrationText,
  withCanonicalNote,
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

type HistoryItem = RegistrationEntry | CigaretteDayGroup;

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

function fmtDayDate(ts: number, locale: string) {
  return new Date(ts).toLocaleDateString(locale === "nl" ? "nl-NL" : "en-GB", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function textValue(value: unknown): string {
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  if (typeof value === "string") return value === "unanswered" ? "" : value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

export type DetailItem =
  | { kind: "option"; value: string }
  | { kind: "literal"; value: string | number };

export type Detail = { labelKey: string; items: DetailItem[] };

function optionItems(value: string | string[] | null | undefined): DetailItem[] {
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
    .map((item) => item.kind === "option" ? translateOption(item.value) : String(item.value))
    .filter(Boolean)
    .join(", ");
}

export function detailsFor(entry: RegistrationEntry): Detail[] {
  if (entry._type === "trek" || entry._type === "craving" || entry._type === "unknown") {
    const actionAttempted = registrationBoolean(entry, "actionAttempted", entry.actionAttempted);
    const thoughtTextKey = entry._type === "trek" ? "thoughtFreeText" : "thoughtOther";
    const common: Detail[] = [
      detail("logs.detail.intensity", literalItems(registrationNumber(entry, "intensity", entry.intensity))),
      detail("logs.detail.confidence_before", literalItems(registrationNumber(entry, "confidenceBefore", entry.confidenceBefore))),
      detail(
        "logs.detail.location",
        optionItems(registrationOptionId(entry, "location", entry.location)),
        literalItems(registrationText(entry, "locationOther", entry.locationOther)),
      ),
      detail(
        "logs.detail.emotions",
        optionItems(registrationOptionIds(entry, "emotions", entry.emotions)),
        literalItems(registrationText(entry, "emotionOther", entry.emotionOther)),
      ),
      detail("logs.detail.physical", optionItems(registrationOptionIds(entry, "physicalSensations", entry.physicalSensations))),
      detail(
        "logs.detail.thoughts",
        optionItems(registrationOptionIds(entry, "thoughts", entry.thoughtPresets)),
        literalItems(registrationText(entry, thoughtTextKey, entry.thoughtFreeText)),
      ),
      detail("logs.detail.substances", optionItems(registrationOptionIds(entry, "targets", entry.substances))),
      detail("logs.detail.action", optionItems(registrationOptionId(entry, "chosenAction", entry.chosenAction))),
      detail("logs.detail.action_attempted", optionItems(actionAttempted == null ? null : actionAttempted ? "Yes" : "No")),
      detail("logs.detail.use_outcome", optionItems(registrationOptionId(entry, "useOutcome", entry.useOutcome))),
      detail("logs.detail.symptom_outcome", optionItems(registrationOptionId(entry, "cravingOutcome", entry.cravingOutcome))),
      detail("logs.detail.intensity_after", literalItems(registrationNumber(entry, "intensityAfter", entry.intensityAfter))),
      detail("logs.detail.confidence_after", literalItems(registrationNumber(entry, "confidenceAfter", entry.confidenceAfter))),
    ];
    if (entry._type === "trek") {
      return [
        detail("logs.detail.type", optionItems(registrationOptionIds(entry, "trekTypes", entry.trekTypes))),
        detail("logs.detail.planning", optionItems(registrationOptionId(entry, "planningStage", entry.planningStage))),
        detail(
          "logs.detail.trigger",
          optionItems(registrationOptionIds(entry, "triggers", entry.triggers)),
          literalItems(registrationText(entry, "triggerNote", entry.triggerNote)),
        ),
        detail(
          "logs.detail.need",
          optionItems(registrationOptionIds(entry, "needs", entry.needTypes?.length ? entry.needTypes : entry.needType ? [entry.needType] : [])),
          literalItems(registrationText(entry, "needOther", entry.needOther)),
        ),
        ...common,
      ];
    }
    if (entry._type === "craving") {
      return [
        detail(
          "logs.detail.onset",
          optionItems(registrationOptionId(entry, "onsetType", entry.onsetType)),
          literalItems(registrationText(entry, "onsetOther", entry.onsetOther)),
        ),
        detail(
          "logs.detail.situation",
          optionItems(registrationOptionIds(entry, "situations", entry.situationPresets)),
          literalItems(registrationText(entry, "situationOther", entry.situationOther)),
        ),
        detail("logs.detail.buildup", optionItems(registrationOptionId(entry, "buildupDuration", entry.buildupDuration))),
        ...common,
      ];
    }
    return common;
  }

  if (entry._type === "anxiety") {
    const urgency = registrationBoolean(entry, "urgencyHigh", entry.urgencyHigh);
    return [
      detail("logs.detail.type", optionItems(registrationOptionIds(entry, "anxietyTypes", entry.anxietyTypes))),
      detail("logs.detail.intensity", literalItems(registrationNumber(entry, "intensity", entry.intensity))),
      detail("logs.detail.body_location", optionItems(registrationOptionIds(entry, "bodyLocations", entry.bodyLocations?.length ? entry.bodyLocations : entry.bodySensations))),
      detail("logs.detail.prediction", literalItems(registrationText(entry, "bodyPrediction", entry.bodyPrediction))),
      detail("logs.detail.urgency", optionItems(urgency == null ? null : urgency ? "Needs help now" : "Can stay with this")),
      detail("logs.detail.context", optionItems(registrationOptionId(entry, "context", entry.context))),
      detail("logs.detail.reassurance", optionItems(registrationOptionIds(entry, "reassuranceSeeking", entry.reassuranceSeeking))),
      detail("logs.detail.linked_state", optionItems(registrationOptionIds(entry, "linkedStates", entry.linkedStates?.length ? entry.linkedStates : entry.linkedState ? [entry.linkedState] : []))),
      detail("logs.detail.trigger", optionItems(registrationOptionIds(entry, "triggers", entry.triggers?.length ? entry.triggers : entry.trigger ? [entry.trigger] : []))),
      detail("logs.detail.action", optionItems(registrationOptionId(entry, "reaction", entry.reaction))),
      detail("logs.detail.symptom_outcome", optionItems(registrationOptionId(entry, "outcomeAfter", entry.outcomeAfter))),
    ];
  }

  if (entry._type === "boredom") {
    const delaySeconds = registrationNumber(entry, "delayDuration", null);
    return [
      detail("logs.detail.type", optionItems(registrationOptionIds(entry, "restlessnessTypes", entry.restlessnessTypes?.length ? entry.restlessnessTypes : entry.feelingTypes))),
      detail("logs.detail.intensity", literalItems(registrationNumber(entry, "intensity", entry.intensity))),
      detail("logs.detail.need", optionItems(registrationOptionIds(entry, "stimulationNeeds", entry.stimulationNeeds?.length ? entry.stimulationNeeds : entry.stimulationNeed ? [entry.stimulationNeed] : []))),
      detail("logs.detail.classification", optionItems(registrationOptionId(entry, "convertCheck", entry.convertCheck))),
      detail(
        "logs.detail.situation",
        optionItems(registrationOptionId(entry, "situation", entry.situation)),
        literalItems(registrationText(entry, "situationOther", entry.situationOther)),
      ),
      detail(
        "logs.detail.urge",
        optionItems(registrationOptionId(entry, "urge", entry.urge)),
        literalItems(registrationText(entry, "urgeOther", entry.urgeOther)),
      ),
      detail("logs.detail.rescue", optionItems(registrationOptionIds(entry, "rescueMenu", entry.rescueMenu))),
      detail("logs.detail.action", optionItems(registrationOptionId(entry, "action", entry.action))),
      detail("logs.detail.delay", literalItems(delaySeconds == null ? registrationText(entry, "delayDuration", entry.delayDuration) : `${Math.round(delaySeconds / 60)} min`)),
      detail("logs.detail.symptom_outcome", optionItems(registrationOptionId(entry, "outcomeAfter", entry.outcomeAfter))),
    ];
  }

  if (entry._type === "relapse") {
    return [
      detail("logs.detail.label", optionItems(registrationOptionId(entry, "label", entry.label))),
      detail("logs.detail.when", optionItems(registrationOptionId(entry, "when", entry.when))),
      detail("logs.detail.duration", optionItems(registrationOptionId(entry, "episodeDuration", entry.episodeDuration))),
      detail("logs.detail.substances", optionItems(registrationOptionIds(entry, "substances", entry.substances))),
      detail("logs.detail.amount", optionItems(registrationOptionId(entry, "amountCategory", entry.amountCategory))),
      detail(
        "logs.detail.trigger",
        optionItems(registrationOptionId(entry, "firstTriggerType", entry.firstTriggerType)),
        literalItems(registrationText(entry, "firstTriggerText", entry.firstTriggerText)),
      ),
      detail(
        "logs.detail.lead_up",
        optionItems(registrationOptionIds(entry, "preUseFactors", entry.preUseFactors)),
        literalItems(registrationText(entry, "leadUpContext", entry.context)),
      ),
      detail("logs.detail.warning_signs", optionItems(registrationOptionIds(entry, "missedWarnings", entry.missedWarnings))),
      detail(
        "logs.detail.thoughts",
        optionItems(registrationOptionIds(entry, "preUseThoughts", entry.preUseThoughtPresets?.length ? entry.preUseThoughtPresets : entry.preUseThoughtPreset ? [entry.preUseThoughtPreset] : [])),
        literalItems(registrationText(entry, "preUseThoughtFreeText", entry.preUseThoughtFreeText)),
      ),
      detail("logs.detail.could_help_early", optionItems(registrationOptionIds(entry, "couldHaveHelpedEarly", entry.couldHaveHelpedEarly))),
      detail("logs.detail.could_help_middle", optionItems(registrationOptionIds(entry, "couldHaveHelpedMiddle", entry.couldHaveHelpedMiddle))),
      detail("logs.detail.could_help_last", optionItems(registrationOptionIds(entry, "couldHaveHelpedLast", entry.couldHaveHelpedLast))),
      detail(
        "logs.detail.support",
        optionItems(registrationOptionId(entry, "supportContact", entry.supportContact)),
        literalItems(registrationText(entry, "supportContactOther", entry.supportContactOther)),
      ),
      detail(
        "logs.detail.next_step",
        optionItems(registrationOptionId(entry, "nextStep", entry.nextStep)),
        literalItems(registrationText(entry, "nextStepOther", entry.nextStepOther)),
      ),
      detail("logs.detail.risk", optionItems(registrationOptionIds(entry, "acuteRisks", entry.acuteRisks))),
      detail("logs.detail.need", optionItems(registrationOptionId(entry, "whatNeeded", entry.whatNeeded))),
      detail("logs.detail.repair", optionItems(registrationOptionIds(entry, "repairActions", entry.repairActions))),
      detail("logs.detail.emotion_after", literalItems(registrationNumber(entry, "emotionAfter", entry.emotionAfter))),
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
    ...completedStatusEntries(logs.cravingLogs).map((log) => ({
      ...log,
      _type: cravingRegistrationKind(log) ?? "unknown",
    } as RegistrationEntry)),
    ...completedStatusEntries(logs.relapseLogs).map((log) => ({
      ...log,
      _type: "relapse" as const,
    })),
    ...logs.anxietyLogs.map((log) => ({ ...log, _type: "anxiety" as const })),
    ...logs.boredomLogs.map((log) => ({ ...log, _type: "boredom" as const })),
  ];
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: unknown;
}) {
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

export function RegistrationHistory() {
  const {
    cravingLogs,
    relapseLogs,
    anxietyLogs,
    boredomLogs,
    cigaretteLogs,
    removeCraving,
    removeRelapse,
    removeAnxiety,
    removeBoredom,
    removeCigarette,
    updateCraving,
    updateRelapse,
    updateAnxiety,
    updateBoredom,
    updateCigarette,
    logCigarette,
  } = useStore();
  const { t, tOpt, language } = useT();
  const { toast } = useToast();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; note: string } | null>(null);
  const [cigaretteDrawerDay, setCigaretteDrawerDay] = useState<number | null>(null);

  const items = useMemo<HistoryItem[]>(() => {
    // Group cigarette logs by day
    const dayMap = new Map<number, CigaretteLog[]>();
    for (const log of cigaretteLogs) {
      const day = startOfDay(log.timestamp);
      const existing = dayMap.get(day) ?? [];
      existing.push(log);
      dayMap.set(day, existing);
    }
    const cigaretteDays: CigaretteDayGroup[] = [];
    for (const [dayStart, logs] of dayMap) {
      const latest = Math.max(...logs.map((l) => l.timestamp));
      cigaretteDays.push({
        _type: "cigarette-day",
        id: `cig-day-${dayStart}`,
        dayStart,
        count: logs.length,
        logs,
        timestamp: latest,
      });
    }

    const merged: HistoryItem[] = [
      ...registrationEntriesForHistory({ cravingLogs, relapseLogs, anxietyLogs, boredomLogs }),
      ...cigaretteDays,
    ];
    return merged.sort((a, b) => {
      const bTime = b._type === "cigarette-day" ? b.timestamp : logicalTimestamp(b);
      const aTime = a._type === "cigarette-day" ? a.timestamp : logicalTimestamp(a);
      return bTime - aTime;
    });
  }, [anxietyLogs, boredomLogs, cigaretteLogs, cravingLogs, relapseLogs]);

  const handleDelete = async (entry: HistoryItem) => {
    if (deleteConfirm !== entry.id) {
      setDeleteConfirm(entry.id);
      return;
    }

    try {
      if (entry._type === "trek" || entry._type === "craving" || entry._type === "unknown") {
        await removeCraving(entry.id);
      } else if (entry._type === "relapse") {
        await removeRelapse(entry.id);
      } else if (entry._type === "anxiety") {
        await removeAnxiety(entry.id);
      } else if (entry._type === "boredom") {
        await removeBoredom(entry.id);
      } else if (entry._type === "cigarette") {
        await removeCigarette(entry.id);
      } else if (entry._type === "cigarette-day") {
        // Delete all cigarettes in this day
        await Promise.all(entry.logs.map((l) => removeCigarette(l.id)));
      }
      toast({ title: t("logs.delete_success") });
    } catch (e) {
      toast({ title: t("logs.delete_error"), variant: "destructive" });
    } finally {
      setDeleteConfirm(null);
      setExpandedId((current) => (current === entry.id ? null : current));
    }
  };

  const startEdit = (entry: HistoryItem) => {
    setDeleteConfirm(null);
    if (entry._type === "cigarette-day") return;
    const registration = entry as RegistrationEntry;
    setEditing({
      id: entry.id,
      note: registrationText(registration, "note", registration.note) ?? "",
    });
  };

  const saveNote = async (entry: HistoryItem) => {
    if (editing?.id !== entry.id || entry._type === "cigarette-day") return;

    const regEntry = entry as RegistrationEntry;
    try {
      if (regEntry._type === "trek" || regEntry._type === "craving" || regEntry._type === "unknown") {
        const { _type, ...log } = regEntry;
        await updateCraving(withCanonicalNote(log as CravingLog, editing.note));
      } else if (regEntry._type === "relapse") {
        const { _type, ...log } = regEntry;
        await updateRelapse(withCanonicalNote(log as RelapseLog, editing.note));
      } else if (regEntry._type === "anxiety") {
        const { _type, ...log } = regEntry;
        await updateAnxiety(withCanonicalNote(log as AnxietyLog, editing.note));
      } else if (regEntry._type === "boredom") {
        const { _type, ...log } = regEntry;
        await updateBoredom(withCanonicalNote(log as BoredomLog, editing.note));
      } else if (regEntry._type === "cigarette") {
        const { _type, ...log } = regEntry;
        await updateCigarette(withCanonicalNote(log as CigaretteLog, editing.note));
      }
      toast({ title: t("common.save") });
    } catch (e) {
      toast({ title: t("common.save_error"), variant: "destructive" });
    } finally {
      setEditing(null);
    }
  };

  if (items.length === 0) {
    return (
      <div className="rounded-[1.5rem] border border-border/50 bg-card/50 p-5 text-center">
        <p className="text-sm text-muted-foreground">{t("logs.empty_all")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((entry) => {
        const isCigaretteDay = entry._type === "cigarette-day";
        const metaKey = isCigaretteDay || entry._type === "unknown"
          ? isCigaretteDay ? "cigarette" : "craving"
          : entry._type;
        const meta = CATEGORY_META[metaKey] || CATEGORY_META.craving;
        const Icon = meta.icon;
        const isExpanded = expandedId === entry.id;
        const isEditing = editing?.id === entry.id;
        const isConfirm = deleteConfirm === entry.id;
        const contentId = `registration-details-${entry.id}`;
        const details = isCigaretteDay ? [] : detailsFor(entry as RegistrationEntry);
        const intensity = !isCigaretteDay && "intensity" in entry
          ? registrationNumber(entry, "intensity", entry.intensity)
          : null;

        return (
          <article
            key={entry.id}
            className="rounded-[1.5rem] border border-border/50 bg-card/50 p-4 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card ring-1 ring-border/50 ${meta.color}`}>
                <Icon size={18} strokeWidth={1.8} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">
                  {isCigaretteDay
                    ? `${t("cigarette.title")} · ${fmtDayDate(entry.dayStart, language)}`
                    : t(LABEL_KEYS[entry._type as RegistrationEntry["_type"]])}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {isCigaretteDay
                    ? `${entry.count} ${entry.count === 1 ? t("cigarette.day_single") : t("cigarette.day_plural")}`
                    : fmtDate(logicalTimestamp(entry as RegistrationEntry), language)}
                </p>
              </div>
              {intensity !== null && (
                <span className="text-sm font-semibold tabular-nums text-primary">
                  {intensity}/10
                </span>
              )}
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                aria-label={isExpanded ? t("logs.collapse") : t("logs.expand")}
                aria-expanded={isExpanded}
                aria-controls={contentId}
              >
                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </div>

            {isExpanded && (
              <div id={contentId} className="mt-3 flex flex-col gap-2 border-t border-border/50 pt-3">
                {isCigaretteDay ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-muted-foreground">
                      {entry.count} {entry.count === 1 ? t("cigarette.day_single") : t("cigarette.day_plural")} {t("cigarette.day_logged")}
                    </p>
                    <button
                      onClick={() => setCigaretteDrawerDay(entry.dayStart)}
                      className="w-full rounded-xl bg-primary text-primary-foreground py-2.5 text-sm font-semibold touch-target active:scale-95 transition-transform"
                    >
                      {t("cigarette.manage_day")} →
                    </button>
                    <div className="mt-1 flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleDelete(entry)}
                        className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                          isConfirm
                            ? "border border-red-500/30 bg-red-500/20 text-red-300"
                            : "text-muted-foreground hover:bg-red-500/10 hover:text-red-300"
                        }`}
                      >
                        <Trash2 size={13} strokeWidth={2} />
                        {isConfirm ? t("logs.delete_confirm") : t("logs.delete")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {isEditing ? (
                      <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-medium text-foreground">{t("logs.detail.note")}</span>
                        <textarea
                          value={editing.note}
                          onChange={(event) => setEditing({ id: entry.id, note: event.currentTarget.value })}
                          placeholder={t("common.note_placeholder")}
                          rows={4}
                          className="min-h-28 resize-none rounded-2xl border border-border bg-background/70 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/60"
                        />
                      </label>
                    ) : (
                      <DetailRow
                        label={t("logs.detail.note")}
                        value={registrationText(
                          entry as RegistrationEntry,
                          "note",
                          (entry as RegistrationEntry).note,
                        )}
                      />
                    )}
                    {details.map((detail) => (
                      <DetailItemsRow
                        key={detail.labelKey}
                        label={t(detail.labelKey)}
                        items={detail.items}
                        translateOption={tOpt}
                      />
                    ))}
                    {(entry as RegistrationEntry).startedAt && (entry as RegistrationEntry).completedAt && (
                      <p className="text-[10px] text-muted-foreground/70">
                        {t("logs.detail.form_timing")}: {fmtDate((entry as RegistrationEntry).startedAt!, language)} → {fmtDate((entry as RegistrationEntry).completedAt!, language)}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground/70">{t("logs.detail.read_only_policy")}</p>

                    <div className="mt-1 flex flex-wrap justify-end gap-2">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setEditing(null)}
                            className="rounded-xl border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                          >
                            {t("logs.cancel")}
                          </button>
                          <button
                            type="button"
                            onClick={() => saveNote(entry)}
                            className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-all hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                          >
                            <Save size={13} strokeWidth={2} />
                            {t("logs.save_change")}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEdit(entry)}
                          className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                        >
                          <Pencil size={13} strokeWidth={2} />
                          {t("logs.edit_note")}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(entry)}
                        className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                          isConfirm
                            ? "border border-red-500/30 bg-red-500/20 text-red-300"
                            : "text-muted-foreground hover:bg-red-500/10 hover:text-red-300"
                        }`}
                      >
                        <Trash2 size={13} strokeWidth={2} />
                        {isConfirm ? t("logs.delete_confirm") : t("logs.delete")}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </article>
        );
      })}

      <CigaretteDayDrawer
        logs={cigaretteLogs}
        dayStart={cigaretteDrawerDay ?? Date.now()}
        open={cigaretteDrawerDay !== null}
        onOpenChange={(open) => { if (!open) setCigaretteDrawerDay(null); }}
        onUpdate={updateCigarette}
        onRemove={removeCigarette}
        onAdd={logCigarette}
      />
    </div>
  );
}
