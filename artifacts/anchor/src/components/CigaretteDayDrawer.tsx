import { useState, useMemo } from "react";
import { useT } from "@/hooks/useTranslation";
import type { CigaretteLog } from "@/db";
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
  onUpdate: (log: CigaretteLog) => Promise<void>;
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTime, setEditTime] = useState("");
  const [editNote, setEditNote] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const dayEnd = dayStart + 86_400_000;
  const dayLogs = useMemo(() => {
    return logs
      .filter((l) => l.timestamp >= dayStart && l.timestamp < dayEnd)
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [logs, dayStart, dayEnd]);

  const startEdit = (log: CigaretteLog) => {
    hapticLight();
    setEditingId(log.id);
    setEditTime(toDateTimeLocalValue(log.timestamp));
    setEditNote(log.note ?? "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTime("");
    setEditNote("");
  };

  const saveEdit = async (log: CigaretteLog) => {
    const newTs = fromDateTimeLocalValue(editTime);
    if (Number.isNaN(newTs)) {
      cancelEdit();
      return;
    }
    setIsBusy(true);
    try {
      await onUpdate({ ...log, timestamp: newTs, note: editNote.trim() || undefined });
      toast({ title: t("common.save") });
    } catch (e) {
      toast({ title: t("common.save_error"), variant: "destructive" });
    } finally {
      setIsBusy(false);
    }
    setEditingId(null);
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
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="px-0 pb-safe">
          <DrawerHeader className="px-4 pb-2">
            <DrawerTitle>{formatDayTitle(dayStart, language)}</DrawerTitle>
          </DrawerHeader>

          <div className="px-4 pb-2 flex flex-col gap-2 max-h-[60vh] overflow-y-auto scroll-smooth-ios">
            {dayLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{t("cigarette.no_today")}</p>
            ) : (
              dayLogs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-2xl border border-border/50 bg-card/50 p-3 flex items-center gap-3"
                >
                  {editingId === log.id ? (
                    <div className="flex-1 flex flex-col gap-2">
                      <input
                        type="datetime-local"
                        value={editTime}
                        onChange={(e) => setEditTime(e.target.value)}
                        className="w-full rounded-xl border border-border/50 bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                      />
                      <input
                        type="text"
                        value={editNote}
                        onChange={(e) => setEditNote(e.target.value)}
                        placeholder={t("common.note_placeholder")}
                        className="w-full rounded-xl border border-border/50 bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEdit(log)}
                          disabled={isBusy}
                          className="flex-1 rounded-xl bg-primary text-primary-foreground py-2 text-xs font-semibold touch-target active:scale-95 transition-transform disabled:opacity-50"
                        >
                          <span className="flex items-center justify-center gap-1">
                            <Check size={14} strokeWidth={2.5} /> {t("common.save")}
                          </span>
                        </button>
                        <button
                          onClick={cancelEdit}
                          disabled={isBusy}
                          className="flex-1 rounded-xl border border-border py-2 text-xs font-medium text-muted-foreground touch-target active:scale-95 transition-transform disabled:opacity-50"
                        >
                          <span className="flex items-center justify-center gap-1">
                            <X size={14} strokeWidth={2.5} /> {t("common.cancel")}
                          </span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
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
                          disabled={isBusy}
                          className="touch-target p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-50"
                          aria-label={t("common.edit")}
                        >
                          <Pencil size={15} strokeWidth={1.8} />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(log.id)}
                          disabled={isBusy}
                          className="touch-target p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-50"
                          aria-label={t("common.delete")}
                        >
                          <Trash2 size={15} strokeWidth={1.8} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}

            {onAdd && (
              <button
                onClick={handleAdd}
                disabled={isBusy}
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
