import { useState, useMemo } from "react";
import { useT } from "@/hooks/useTranslation";
import type { CigaretteLog } from "@/db";
import { hapticLight } from "@/lib/haptics";
import { Pencil, Trash2, X, Check, Plus } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTime, setEditTime] = useState("");
  const [editNote, setEditNote] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

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
    await onUpdate({ ...log, timestamp: newTs, note: editNote.trim() || undefined });
    setEditingId(null);
  };

  const handleRemove = async (id: string) => {
    await onRemove(id);
    setConfirmDelete(null);
  };

  const handleAdd = async () => {
    if (!onAdd) return;
    const now = Date.now();
    const newTs = now >= dayStart && now < dayEnd ? now : dayStart + 12 * 60 * 60 * 1000;
    await onAdd({ timestamp: newTs });
  };

  return (
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
                        className="flex-1 rounded-xl bg-primary text-primary-foreground py-2 text-xs font-semibold touch-target active:scale-95 transition-transform"
                      >
                        <span className="flex items-center justify-center gap-1">
                          <Check size={14} strokeWidth={2.5} /> {t("common.save")}
                        </span>
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="flex-1 rounded-xl border border-border py-2 text-xs font-medium text-muted-foreground touch-target active:scale-95 transition-transform"
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
                        className="touch-target p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                        aria-label={t("common.edit")}
                      >
                        <Pencil size={15} strokeWidth={1.8} />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(log.id)}
                        className="touch-target p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
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
              className="mt-1 flex items-center justify-center gap-2 w-full rounded-xl border border-dashed border-border py-3 text-sm text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors touch-target"
            >
              <Plus size={16} strokeWidth={2} />
              {t("cigarette.log_btn")}
            </button>
          )}
        </div>
      </DrawerContent>

      {confirmDelete && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-background/80 backdrop-blur-sm px-4 pb-[calc(2rem+env(safe-area-inset-bottom,0px))]">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="cig-delete-title"
            className="bg-card border border-border rounded-3xl p-6 w-full max-w-sm"
          >
            <h3 id="cig-delete-title" className="font-semibold text-foreground mb-2">
              {t("cigarette.delete_title")}
            </h3>
            <p className="text-sm text-muted-foreground mb-5">{t("cigarette.delete_body")}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 border border-border rounded-xl py-3 font-medium text-muted-foreground touch-target focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={() => handleRemove(confirmDelete)}
                className="flex-1 bg-destructive text-destructive-foreground rounded-xl py-3 font-semibold touch-target focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                {t("common.delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </Drawer>
  );
}
