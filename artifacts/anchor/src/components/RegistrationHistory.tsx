import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Save, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useStore } from "@/hooks/useStore";
import { useT } from "@/hooks/useTranslation";
import { CATEGORY_META } from "@/lib/constants";
import type { AnxietyLog, BoredomLog, CigaretteLog, CravingLog, RelapseLog } from "@/db";
import { CigaretteDayDrawer } from "./CigaretteDayDrawer";
import { logicalTimestamp } from "@/lib/registrationIds";

type RegistrationEntry =
  | (CravingLog & { _type: "trek" | "craving" })
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

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())))];
}

type Detail = { labelKey: string; value: unknown; translate?: boolean };

function detailsFor(entry: RegistrationEntry): Detail[] {
  if (entry._type === "trek" || entry._type === "craving") {
    const common: Detail[] = [
      { labelKey: "logs.detail.intensity", value: entry.intensity },
      { labelKey: "logs.detail.confidence_before", value: entry.confidenceBefore },
      { labelKey: "logs.detail.location", value: unique([entry.location, entry.locationOther]), translate: true },
      { labelKey: "logs.detail.emotions", value: unique([...(entry.emotions ?? []), entry.emotionOther]), translate: true },
      { labelKey: "logs.detail.physical", value: entry.physicalSensations, translate: true },
      { labelKey: "logs.detail.thoughts", value: unique([...(entry.thoughtPresets ?? []), entry.thoughtFreeText]), translate: true },
      { labelKey: "logs.detail.substances", value: entry.substances, translate: true },
      { labelKey: "logs.detail.action", value: entry.chosenAction, translate: true },
      { labelKey: "logs.detail.action_attempted", value: entry.actionAttempted == null ? "" : entry.actionAttempted ? "Yes" : "No", translate: true },
      { labelKey: "logs.detail.use_outcome", value: entry.useOutcome, translate: true },
      { labelKey: "logs.detail.symptom_outcome", value: entry.cravingOutcome, translate: true },
      { labelKey: "logs.detail.intensity_after", value: entry.intensityAfter },
      { labelKey: "logs.detail.confidence_after", value: entry.confidenceAfter },
    ];
    if (entry._type === "trek") {
      return [
        { labelKey: "logs.detail.type", value: entry.trekTypes, translate: true },
        { labelKey: "logs.detail.planning", value: entry.planningStage, translate: true },
        { labelKey: "logs.detail.trigger", value: unique([...(entry.triggers ?? []), entry.triggerNote]), translate: true },
        { labelKey: "logs.detail.need", value: unique([...(entry.needTypes ?? []), entry.needOther]), translate: true },
        ...common,
      ];
    }
    return [
      { labelKey: "logs.detail.onset", value: unique([entry.onsetType, entry.onsetOther]), translate: true },
      { labelKey: "logs.detail.situation", value: unique([...(entry.situationPresets ?? []), entry.situationOther]), translate: true },
      { labelKey: "logs.detail.buildup", value: entry.buildupDuration, translate: true },
      ...common,
    ];
  }

  if (entry._type === "anxiety") {
    return [
      { labelKey: "logs.detail.type", value: entry.anxietyTypes, translate: true },
      { labelKey: "logs.detail.intensity", value: entry.intensity },
      { labelKey: "logs.detail.body_location", value: entry.bodyLocations?.length ? entry.bodyLocations : entry.bodySensations, translate: true },
      { labelKey: "logs.detail.prediction", value: entry.bodyPrediction },
      { labelKey: "logs.detail.urgency", value: entry.urgencyHigh == null ? "" : entry.urgencyHigh ? "Needs help now" : "Can stay with this", translate: true },
      { labelKey: "logs.detail.context", value: entry.context, translate: true },
      { labelKey: "logs.detail.reassurance", value: entry.reassuranceSeeking, translate: true },
      { labelKey: "logs.detail.linked_state", value: entry.linkedStates?.length ? entry.linkedStates : entry.linkedState ? [entry.linkedState] : [], translate: true },
      { labelKey: "logs.detail.trigger", value: entry.triggers?.length ? entry.triggers : entry.trigger ? [entry.trigger] : [], translate: true },
      { labelKey: "logs.detail.action", value: entry.reaction, translate: true },
      { labelKey: "logs.detail.symptom_outcome", value: entry.outcomeAfter, translate: true },
    ];
  }

  if (entry._type === "boredom") {
    return [
      { labelKey: "logs.detail.type", value: entry.restlessnessTypes?.length ? entry.restlessnessTypes : entry.feelingTypes, translate: true },
      { labelKey: "logs.detail.intensity", value: entry.intensity },
      { labelKey: "logs.detail.need", value: entry.stimulationNeeds?.length ? entry.stimulationNeeds : entry.stimulationNeed ? [entry.stimulationNeed] : [], translate: true },
      { labelKey: "logs.detail.classification", value: entry.convertCheck, translate: true },
      { labelKey: "logs.detail.situation", value: unique([entry.situation, entry.situationOther]), translate: true },
      { labelKey: "logs.detail.urge", value: unique([entry.urge, entry.urgeOther]), translate: true },
      { labelKey: "logs.detail.rescue", value: entry.rescueMenu, translate: true },
      { labelKey: "logs.detail.action", value: entry.action, translate: true },
      { labelKey: "logs.detail.delay", value: entry.delayDuration },
      { labelKey: "logs.detail.symptom_outcome", value: entry.outcomeAfter, translate: true },
    ];
  }

  if (entry._type === "relapse") {
    const helped = unique([
      ...(entry.couldHaveHelpedEarly ?? []),
      ...(entry.couldHaveHelpedMiddle ?? []),
      ...(entry.couldHaveHelpedLast ?? []),
    ]);
    return [
      { labelKey: "logs.detail.label", value: entry.label, translate: true },
      { labelKey: "logs.detail.when", value: entry.when, translate: true },
      { labelKey: "logs.detail.duration", value: entry.episodeDuration, translate: true },
      { labelKey: "logs.detail.substances", value: entry.substances, translate: true },
      { labelKey: "logs.detail.amount", value: entry.amountCategory, translate: true },
      { labelKey: "logs.detail.trigger", value: unique([entry.firstTriggerType, entry.firstTriggerText]), translate: true },
      { labelKey: "logs.detail.lead_up", value: unique([...(entry.preUseFactors ?? []), entry.context]), translate: true },
      { labelKey: "logs.detail.warning_signs", value: entry.missedWarnings, translate: true },
      { labelKey: "logs.detail.thoughts", value: unique([...(entry.preUseThoughtPresets ?? []), entry.preUseThoughtPreset, entry.preUseThoughtFreeText]), translate: true },
      { labelKey: "logs.detail.could_help", value: helped, translate: true },
      { labelKey: "logs.detail.support", value: unique([entry.supportContact, entry.supportContactOther]), translate: true },
      { labelKey: "logs.detail.next_step", value: unique([entry.nextStep, entry.nextStepOther]), translate: true },
      { labelKey: "logs.detail.risk", value: entry.acuteRisk, translate: true },
      { labelKey: "logs.detail.need", value: entry.whatNeeded, translate: true },
      { labelKey: "logs.detail.repair", value: entry.repairActions, translate: true },
    ];
  }

  return [];
}

function DetailRow({
  label,
  value,
  translate,
  unansweredLabel,
}: {
  label: string;
  value: unknown;
  translate?: (value: string) => string;
  unansweredLabel?: string;
}) {
  const display = (item: unknown) => {
    const raw = String(item).trim();
    if (raw === "unanswered") return unansweredLabel ?? "";
    return translate ? translate(raw) : raw;
  };
  const text = Array.isArray(value)
    ? value.filter(Boolean).map(display).filter(Boolean).join(", ")
    : typeof value === "string"
      ? display(value)
      : textValue(value);
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
      ...cravingLogs.map((log) => ({
        ...log,
        _type: log.cravingType === "active" ? "trek" : "craving",
      } as RegistrationEntry)),
      ...relapseLogs.map((log) => ({ ...log, _type: "relapse" as const })),
      ...anxietyLogs.map((log) => ({ ...log, _type: "anxiety" as const })),
      ...boredomLogs.map((log) => ({ ...log, _type: "boredom" as const })),
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
      if (entry._type === "trek" || entry._type === "craving") {
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
    setEditing({ id: entry.id, note: (entry as RegistrationEntry).note ?? "" });
  };

  const saveNote = async (entry: HistoryItem) => {
    if (editing?.id !== entry.id || entry._type === "cigarette-day") return;

    const regEntry = entry as RegistrationEntry;
    try {
      if (regEntry._type === "trek" || regEntry._type === "craving") {
        const { _type, ...log } = regEntry;
        await updateCraving({ ...log, note: editing.note } as CravingLog);
      } else if (regEntry._type === "relapse") {
        const { _type, ...log } = regEntry;
        await updateRelapse({ ...log, note: editing.note } as RelapseLog);
      } else if (regEntry._type === "anxiety") {
        const { _type, ...log } = regEntry;
        await updateAnxiety({ ...log, note: editing.note } as AnxietyLog);
      } else if (regEntry._type === "boredom") {
        const { _type, ...log } = regEntry;
        await updateBoredom({ ...log, note: editing.note } as BoredomLog);
      } else if (regEntry._type === "cigarette") {
        const { _type, ...log } = regEntry;
        await updateCigarette({ ...log, note: editing.note } as CigaretteLog);
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
        const meta = CATEGORY_META[isCigaretteDay ? "cigarette" : entry._type] || CATEGORY_META.craving;
        const Icon = meta.icon;
        const isExpanded = expandedId === entry.id;
        const isEditing = editing?.id === entry.id;
        const isConfirm = deleteConfirm === entry.id;
        const contentId = `registration-details-${entry.id}`;
        const details = isCigaretteDay ? [] : detailsFor(entry as RegistrationEntry);
        const intensity =
          !isCigaretteDay && "intensity" in entry && typeof entry.intensity === "number"
            ? entry.intensity
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
                      <DetailRow label={t("logs.detail.note")} value={(entry as RegistrationEntry).note} />
                    )}
                    {details.map((detail) => (
                      <DetailRow
                        key={detail.labelKey}
                        label={t(detail.labelKey)}
                        value={detail.value}
                        translate={detail.translate ? tOpt : undefined}
                        unansweredLabel={t("logs.detail.unanswered")}
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
