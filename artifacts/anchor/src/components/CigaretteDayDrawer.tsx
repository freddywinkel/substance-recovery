import { useState, useMemo, useEffect, useRef } from "react";
import { useT } from "@/hooks/useTranslation";
import type { CigaretteLog } from "@/db";
import { useLocalDraft } from "@/hooks/useLocalDraft";
import { DraftStatus } from "@/components/DraftStatus";
import { HelpAccess } from "@/components/HelpAccess";
import { flushLocalDrafts } from "@/lib/localDrafts";
import { cigaretteDraftMatchesSource, isCigaretteEditDraft, type CigaretteEditDraft } from "@/lib/cigaretteEditDraft";
import { hapticLight } from "@/lib/haptics";
import { Pencil, Trash2, X, Check, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

interface CigaretteDayDrawerProps {
  logs: CigaretteLog[];
  dayStart: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (log: CigaretteLog, expected?: { timestamp: number; note?: string; updatedAt?: number | null }) => Promise<CigaretteLog>;
  onRemove: (id: string) => Promise<void>;
  onAdd?: (entry: Omit<CigaretteLog, "id">) => Promise<CigaretteLog>;
}

function formatTime(ts: number, locale: string): string {
  return new Date(ts).toLocaleTimeString(locale === "nl" ? "nl-NL" : "en-GB", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDayTitle(ts: number, locale: string): string {
  return new Date(ts).toLocaleDateString(locale === "nl" ? "nl-NL" : "en-GB", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function toDateTimeLocalValue(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDateTimeLocalValue(value: string): number {
  return new Date(value).getTime();
}

export function CigaretteDayDrawer({ logs, dayStart, open, onOpenChange, onUpdate, onRemove, onAdd }: CigaretteDayDrawerProps) {
  const { t, language } = useT();
  const { toast } = useToast();
  const draft = useLocalDraft<CigaretteEditDraft>("cigarette-edit", null, { validate: isCigaretteEditDraft });
  const edit = draft.value;
  const [resumeOpen, setResumeOpen] = useState(false);
  const resumeChecked = useRef(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [editError, setEditError] = useState("");

  useEffect(() => {
    if (!draft.hydrated || resumeChecked.current) return;
    resumeChecked.current = true;
    if (draft.value) setResumeOpen(true);
  }, [draft.hydrated, draft.value]);

  const closeDrawer = (next: boolean) => {
    if (!next) setResumeOpen(false);
    onOpenChange(next);
  };
  const editLog = edit ? logs.find(log => log.id === edit.id) : undefined;
  const sourceChanged = !!edit && (!editLog || !cigaretteDraftMatchesSource(edit, editLog));
  const controlsDisabled = isBusy || !draft.hydrated || draft.conflict || (!!draft.error && !draft.hasDraft);
  const selectedDayStart = edit ? new Date(edit.sourceTimestamp).setHours(0, 0, 0, 0) : dayStart;
  const dayEndDate = new Date(selectedDayStart);
  dayEndDate.setDate(dayEndDate.getDate() + 1);
  const dayEnd = dayEndDate.getTime();
  const dayLogs = useMemo(() => {
    return logs
      .filter((l) => l.timestamp >= selectedDayStart && l.timestamp < dayEnd && l.id !== edit?.id)
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [logs, selectedDayStart, dayEnd, edit?.id]);

  const startEdit = (log: CigaretteLog) => {
    hapticLight();
    setEditError("");
    draft.setValue({ id: log.id, editTime: toDateTimeLocalValue(log.timestamp), editNote: log.note ?? "", sourceTimestamp: log.timestamp, sourceNote: log.note ?? "", sourceUpdatedAt: log.updatedAt ?? null });
  };

  const cancelEdit = async () => {
    setIsBusy(true); setEditError("");
    try {
      await draft.clearDraft(null, { keepInputOnFailure: true });
    } catch {
      setEditError(language === "nl" ? "Het concept kon niet worden gewist. Je invoer staat hier nog." : "The draft could not be cleared. Your input is still here.");
    } finally { setIsBusy(false); }
  };

  const saveEdit = async (log: CigaretteLog) => {
    if (!edit || controlsDisabled || sourceChanged) return;
    const newTs = fromDateTimeLocalValue(edit.editTime);
    if (!Number.isFinite(newTs) || newTs < 0 || newTs > 8_640_000_000_000_000) {
      setEditError(language === "nl" ? "Vul een geldige datum en tijd in." : "Enter a valid date and time.");
      return;
    }
    setIsBusy(true); setEditError("");
    let committed = false;
    try {
      await flushLocalDrafts();
      const saved = await onUpdate({ ...log, timestamp: newTs, occurredAt: newTs, editedAt: Date.now(), note: edit.editNote.trim() || undefined }, { timestamp: edit.sourceTimestamp, note: edit.sourceNote, updatedAt: edit.sourceUpdatedAt });
      committed = true;
      // Keep the committed baseline if cleanup fails, so retry cannot overwrite
      // a later change or recreate a record deleted in another tab.
      draft.setValue({ ...edit, sourceTimestamp: saved.timestamp, sourceNote: saved.note ?? "", sourceUpdatedAt: saved.updatedAt ?? null });
      await flushLocalDrafts();
      await draft.clearDraft(null, { keepInputOnFailure: true });
      toast({ title: t("common.save") });
    } catch (e) {
      setEditError(committed
        ? (language === "nl" ? "De wijziging is opgeslagen; het concept kon niet worden gewist. Je invoer staat hier nog." : "The change was saved; the draft could not be cleared. Your input is still here.")
        : t("common.save_error"));
    } finally {
      setIsBusy(false);
    }
  };

  const handleRemove = async (id: string) => {
    setIsBusy(true);
    try {
      await onRemove(id);
      toast({ title: t("cigarette.delete_success") });
    } catch (e) {
      toast({ title: t("cigarette.delete_error"), variant: "destructive" });
    } finally {
      setIsBusy(false);
      setConfirmDelete(null);
    }
  };

  const handleAdd = async () => {
    if (!onAdd) return;
    setIsBusy(true);
    try {
      const now = Date.now();
      const newTs = now >= dayStart && now < dayEnd ? now : dayStart + 12 * 60 * 60 * 1000;
      await onAdd({ timestamp: newTs });
      toast({ title: t("cigarette.log_btn") });
    } catch (e) {
      toast({ title: t("common.save_error"), variant: "destructive" });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <>
      <Drawer open={open || resumeOpen} onOpenChange={closeDrawer}>
        <DrawerContent className="px-0 pb-safe" aria-describedby={undefined}>
          <DrawerHeader className="px-4 pb-2 flex items-center justify-between gap-2">
            <DrawerTitle>{formatDayTitle(selectedDayStart, language)}</DrawerTitle>
            <button type="button" onClick={() => closeDrawer(false)} className="touch-target rounded-xl p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label={language === "nl" ? "Sluiten" : "Close"}><X size={20} /></button>
          </DrawerHeader>
          <HelpAccess />

          <div className="px-4 pb-2 flex flex-col gap-2 max-h-[60vh] overflow-y-auto scroll-smooth-ios">
            <DraftStatus {...draft} />
            {edit && (
                    <div className="rounded-2xl border border-border/50 bg-card/50 p-3 flex flex-col gap-2">
                      <p className="text-xs text-muted-foreground">{language === "nl" ? "Je wijziging is nog niet afgerond." : "Your edit is not finished yet."}</p>
                      <input
                        aria-label={language === "nl" ? "Datum en tijd" : "Date and time"}
                        type="datetime-local"
                        value={edit.editTime}
                        disabled={controlsDisabled}
                        onChange={(e) => draft.setValue({ ...edit, editTime: e.target.value })}
                        className="min-w-0 w-full rounded-xl border border-border/50 bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                      />
                      <input
                        aria-label={t("common.note_placeholder")}
                        type="text"
                        maxLength={100_000}
                        value={edit.editNote}
                        disabled={controlsDisabled}
                        onChange={(e) => draft.setValue({ ...edit, editNote: e.target.value })}
                        placeholder={t("common.note_placeholder")}
                        className="w-full rounded-xl border border-border/50 bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                      />
                      {editError && <p role="alert" className="text-sm text-destructive">{editError}</p>}
                      {sourceChanged && <p role="alert" className="text-sm text-destructive">{language === "nl" ? "De opgeslagen registratie is gewijzigd of verwijderd. Je concept staat hier nog. Annuleer om de huidige registratie opnieuw te openen." : "The saved registration changed or was removed. Your draft is still here. Cancel to reopen the current registration."}</p>}
                      <div className="flex gap-2">
                        <button
                          onClick={() => editLog && saveEdit(editLog)}
                          disabled={controlsDisabled || sourceChanged}
                          className="flex-1 rounded-xl bg-primary text-primary-foreground py-2 text-xs font-semibold touch-target active:scale-95 transition-transform disabled:opacity-50"
                        >
                          <span className="flex items-center justify-center gap-1">
                            <Check size={14} strokeWidth={2.5} /> {t("common.save")}
                          </span>
                        </button>
                        <button
                          onClick={cancelEdit}
                          disabled={controlsDisabled}
                          className="flex-1 rounded-xl border border-border py-2 text-xs font-medium text-muted-foreground touch-target active:scale-95 transition-transform disabled:opacity-50"
                        >
                          <span className="flex items-center justify-center gap-1">
                            <X size={14} strokeWidth={2.5} /> {t("common.cancel")}
                          </span>
                        </button>
                      </div>
                    </div>
            )}
            {dayLogs.length === 0 && !edit && <p className="text-sm text-muted-foreground text-center py-8">{t("cigarette.no_today")}</p>}
            {dayLogs.map(log => (
                <div key={log.id} className="rounded-2xl border border-border/50 bg-card/50 p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground tabular-nums">
                          {formatTime(log.timestamp, language)}
                        </p>
                        {log.note && (
                          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{log.note}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => startEdit(log)}
                          disabled={controlsDisabled || !!edit}
                          className="touch-target p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-50"
                          aria-label={t("common.edit")}
                        >
                          <Pencil size={15} strokeWidth={1.8} />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(log.id)}
                          disabled={controlsDisabled || !!edit}
                          className="touch-target p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-50"
                          aria-label={t("common.delete")}
                        >
                          <Trash2 size={15} strokeWidth={1.8} />
                        </button>
                      </div>
                </div>
              ))}

            {onAdd && (
              <button
                onClick={handleAdd}
                disabled={controlsDisabled || !!edit}
                className="mt-1 flex items-center justify-center gap-2 w-full rounded-xl border border-dashed border-border py-3 text-sm text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors touch-target disabled:opacity-50"
              >
                <Plus size={16} strokeWidth={2} />
                {t("cigarette.log_btn")}
              </button>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      <AlertDialog open={confirmDelete !== null} onOpenChange={() => setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("cigarette.delete_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("cigarette.delete_body")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmDelete(null)} disabled={isBusy}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && handleRemove(confirmDelete)}
              disabled={isBusy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
