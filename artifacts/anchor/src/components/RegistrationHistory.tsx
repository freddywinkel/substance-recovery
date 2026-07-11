import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Save, Trash2 } from "lucide-react";
import { useStore } from "@/hooks/useStore";
import { useT } from "@/hooks/useTranslation";
import { CATEGORY_META } from "@/lib/constants";
import type { AnxietyLog, BoredomLog, CravingLog, RelapseLog } from "@/db";

type RegistrationEntry =
  | (CravingLog & { _type: "trek" | "craving" })
  | (RelapseLog & { _type: "relapse" })
  | (AnxietyLog & { _type: "anxiety" })
  | (BoredomLog & { _type: "boredom" });

const LABEL_KEYS: Record<RegistrationEntry["_type"], string> = {
  trek: "registrations.trek.title",
  craving: "registrations.craving.title",
  anxiety: "registrations.anxiety.title",
  boredom: "registrations.boredom.title",
  relapse: "registrations.relapse.title",
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
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

function DetailRow({ label, value, translate }: { label: string; value: unknown; translate?: (value: string) => string }) {
  const text = Array.isArray(value)
    ? value.filter(Boolean).map((item) => translate ? translate(String(item)) : String(item)).join(", ")
    : translate && typeof value === "string"
      ? translate(value.trim())
      : textValue(value);
  if (!text) return null;
  return (
    <p className="text-xs text-muted-foreground">
      <span className="font-medium text-foreground">{label}:</span> {text}
    </p>
  );
}

export function RegistrationHistory() {
  const {
    cravingLogs,
    relapseLogs,
    anxietyLogs,
    boredomLogs,
    removeCraving,
    removeRelapse,
    removeAnxiety,
    removeBoredom,
    updateCraving,
    updateRelapse,
    updateAnxiety,
    updateBoredom,
  } = useStore();
  const { t, tOpt, language } = useT();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; note: string } | null>(null);

  const entries = useMemo<RegistrationEntry[]>(() => {
    const merged: RegistrationEntry[] = [
      ...cravingLogs.map((log) => ({
        ...log,
        _type: log.cravingType === "active" ? "trek" : "craving",
      } as RegistrationEntry)),
      ...relapseLogs.map((log) => ({ ...log, _type: "relapse" as const })),
      ...anxietyLogs.map((log) => ({ ...log, _type: "anxiety" as const })),
      ...boredomLogs.map((log) => ({ ...log, _type: "boredom" as const })),
    ];
    return merged.sort((a, b) => b.timestamp - a.timestamp);
  }, [anxietyLogs, boredomLogs, cravingLogs, relapseLogs]);

  const handleDelete = async (entry: RegistrationEntry) => {
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
      } else {
        await removeBoredom(entry.id);
      }
    } finally {
      setDeleteConfirm(null);
      setExpandedId((current) => (current === entry.id ? null : current));
    }
  };

  const startEdit = (entry: RegistrationEntry) => {
    setDeleteConfirm(null);
    setEditing({ id: entry.id, note: entry.note ?? "" });
  };

  const saveNote = async (entry: RegistrationEntry) => {
    if (editing?.id !== entry.id) return;

    if (entry._type === "trek" || entry._type === "craving") {
      const { _type, ...log } = entry;
      await updateCraving({ ...log, note: editing.note } as CravingLog);
    } else if (entry._type === "relapse") {
      const { _type, ...log } = entry;
      await updateRelapse({ ...log, note: editing.note } as RelapseLog);
    } else if (entry._type === "anxiety") {
      const { _type, ...log } = entry;
      await updateAnxiety({ ...log, note: editing.note } as AnxietyLog);
    } else {
      const { _type, ...log } = entry;
      await updateBoredom({ ...log, note: editing.note } as BoredomLog);
    }

    setEditing(null);
  };

  if (entries.length === 0) {
    return (
      <div className="rounded-[1.5rem] border border-border/50 bg-card/50 p-5 text-center">
        <p className="text-sm text-muted-foreground">{t("logs.empty_all")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {entries.map((entry) => {
        const meta = CATEGORY_META[entry._type] || CATEGORY_META.craving;
        const Icon = meta.icon;
        const isExpanded = expandedId === entry.id;
        const isEditing = editing?.id === entry.id;
        const isConfirm = deleteConfirm === entry.id;
        const contentId = `registration-details-${entry.id}`;
        const intensity =
          "intensity" in entry && typeof entry.intensity === "number"
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
                  {t(LABEL_KEYS[entry._type])}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {fmtDate(entry.timestamp, language)}
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
                  <DetailRow label={t("logs.detail.note")} value={entry.note} />
                )}
                <DetailRow label={t("logs.detail.situation")} value={"situationPresets" in entry ? entry.situationPresets : "situation" in entry ? entry.situation : ""} translate={tOpt} />
                <DetailRow label={t("logs.detail.trigger")} value={"triggers" in entry ? entry.triggers : "trigger" in entry ? entry.trigger : "firstTriggerText" in entry ? entry.firstTriggerText : ""} translate={tOpt} />
                <DetailRow label={t("logs.detail.emotions")} value={"emotions" in entry ? entry.emotions : ""} translate={tOpt} />
                <DetailRow label={t("logs.detail.substances")} value={"substances" in entry ? entry.substances : ""} translate={tOpt} />
                <DetailRow label={t("logs.detail.action")} value={"chosenAction" in entry && entry.chosenAction ? entry.chosenAction : "action" in entry ? entry.action : ""} translate={tOpt} />
                <DetailRow label={t("logs.detail.outcome")} value={"cravingOutcome" in entry ? entry.cravingOutcome : "outcomeAfter" in entry ? entry.outcomeAfter : ""} translate={tOpt} />

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
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
