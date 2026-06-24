import { useState } from "react";
import { useLocation } from "wouter";
import { useStore } from "@/hooks/useStore";
import { useT } from "@/hooks/useT";
import { PageHeader } from "@/components/PageHeader";
import { Plus, Trash2 } from "lucide-react";

function formatDate(ts: number, locale: string) {
  return new Date(ts).toLocaleString(locale === "nl" ? "nl-NL" : undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function Journal() {
  const { journal, removeEntry } = useStore();
  const { t, language } = useT();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [, navigate] = useLocation();

  return (
    <div className="flex flex-col min-h-dvh bg-background">
      <PageHeader title={t("journal.title")} subtitle={t("journal.subtitle")} />

      <div
        className="flex-1 overflow-y-auto scroll-smooth-ios px-4 py-4 flex flex-col gap-3"
        style={{ paddingBottom: "calc(5rem + env(safe-area-inset-bottom))" }}
      >
        {journal.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-4 text-center py-16">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <span className="text-3xl">📓</span>
            </div>
            <p className="text-muted-foreground text-sm max-w-xs leading-relaxed">
              {t("journal.empty")}
            </p>
          </div>
        ) : (
          journal.map((entry) => (
            <div
              key={entry.id}
              className="bg-card border border-border rounded-2xl p-4 animate-fade-up"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{["😔", "😟", "😐", "🙂", "😊"][entry.mood - 1]}</span>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {t("journal.mood")}: {entry.mood}/5
                      {entry.cravingIntensity !== null && ` · ${t("journal.craving")}: ${entry.cravingIntensity}/10`}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDate(entry.timestamp, language)}</p>
                  </div>
                </div>
                <button
                  onClick={() => setConfirmDelete(entry.id)}
                  className="touch-target text-muted-foreground hover:text-destructive transition-colors ml-2"
                  aria-label={t("journal.delete_aria")}
                >
                  <Trash2 size={16} strokeWidth={1.8} />
                </button>
              </div>
              {entry.note && (
                <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{entry.note}</p>
              )}
            </div>
          ))
        )}

        <div className="h-4" />
      </div>

      <button
        onClick={() => navigate("/journal/new")}
        className="fixed right-5 z-[60] w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:opacity-90 active:scale-95 transition-all"
        style={{ bottom: "calc(5rem + env(safe-area-inset-bottom))" }}
        aria-label={t("journal.add_aria")}
      >
        <Plus size={24} strokeWidth={2} />
      </button>

      {confirmDelete && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-background/80 backdrop-blur-sm px-4 pb-8">
          <div className="bg-card border border-border rounded-3xl p-6 w-full max-w-sm">
            <h3 className="font-semibold text-foreground mb-2">{t("journal.delete_title")}</h3>
            <p className="text-sm text-muted-foreground mb-5">{t("journal.delete_body")}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 border border-border rounded-xl py-3 font-medium text-muted-foreground touch-target"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={async () => {
                  await removeEntry(confirmDelete);
                  setConfirmDelete(null);
                }}
                className="flex-1 bg-destructive text-destructive-foreground rounded-xl py-3 font-semibold touch-target"
              >
                {t("journal.delete_confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
