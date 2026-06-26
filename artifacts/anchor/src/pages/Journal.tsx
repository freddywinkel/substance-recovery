import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useStore } from "@/hooks/useStore";
import { useT } from "@/hooks/useT";
import { PageHeader } from "@/components/PageHeader";
import { Plus, Trash2, Star, Search, Calendar, X } from "lucide-react";

function formatDate(ts: number, locale: string) {
  return new Date(ts).toLocaleString(locale === "nl" ? "nl-NL" : undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
function formatShortDate(ts: number, locale: string) {
  return new Date(ts).toLocaleDateString(locale === "nl" ? "nl-NL" : undefined, {
    month: "short",
    day: "numeric",
  });
}

export function Journal() {
  const { journal, removeEntry } = useStore();
  const { t, language } = useT();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week" | "month">("all");
  const [, navigate] = useLocation();

  const filteredEntries = useMemo(() => {
    const now = Date.now();
    const dayMs = 1000 * 60 * 60 * 24;
    let entries = journal;

    // Date filter
    if (dateFilter === "today") {
      entries = entries.filter((e) => now - e.timestamp < dayMs);
    } else if (dateFilter === "week") {
      entries = entries.filter((e) => now - e.timestamp < 7 * dayMs);
    } else if (dateFilter === "month") {
      entries = entries.filter((e) => now - e.timestamp < 30 * dayMs);
    }

    // Keyword search
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      entries = entries.filter(
        (e) =>
          e.note.toLowerCase().includes(q) ||
          (e.trigger && e.trigger.toLowerCase().includes(q)) ||
          (e.coping && e.coping.toLowerCase().includes(q)) ||
          formatDate(e.timestamp, language).toLowerCase().includes(q)
      );
    }

    return entries;
  }, [journal, dateFilter, searchQuery, language]);

  const dateFilterOpts: { v: typeof dateFilter; label: string }[] = [
    { v: "all", label: t("journal.filter.all") },
    { v: "today", label: t("journal.filter.today") },
    { v: "week", label: t("journal.filter.week") },
    { v: "month", label: t("journal.filter.month") },
  ];

  return (
    <div className="flex flex-col min-h-dvh bg-background">
      <PageHeader title={t("journal.title")} subtitle={t("journal.subtitle")} />

      <div className="px-4 flex flex-col gap-3">
        {/* Search bar */}
        <div className="relative">
          <Search
            size={16}
            strokeWidth={2}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("journal.search_placeholder")}
            className="w-full rounded-xl border border-border/50 bg-card pl-9 pr-9 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={t("common.cancel")}
            >
              <X size={14} strokeWidth={2} />
            </button>
          )}
        </div>

        {/* Date filter chips */}
        <div className="flex gap-1.5">
          {dateFilterOpts.map(({ v, label }) => (
            <button
              key={v}
              onClick={() => setDateFilter(v)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                dateFilter === v
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-smooth-ios px-4 py-3 flex flex-col gap-3 pb-safe">
        {/* Local storage reassurance */}
        <p className="text-xs text-muted-foreground/70 text-center px-2">
          {t("journal.local_storage")}
        </p>

        {filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-4 text-center py-16">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <span className="text-3xl">📓</span>
            </div>
            <p className="text-muted-foreground text-sm max-w-xs leading-relaxed">
              {searchQuery || dateFilter !== "all"
                ? t("journal.no_results")
                : t("journal.empty")}
            </p>
          </div>
        ) : (
          filteredEntries.map((entry) => (
            <div
              key={entry.id}
              className="rounded-[1.5rem] border border-border/50 bg-card/50 p-4 animate-fade-up"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{["😔", "😟", "😐", "🙂", "😊"][entry.mood - 1]}</span>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {t("journal.mood")} {entry.mood}/5
                      {entry.cravingIntensity !== null && ` · ${t("journal.craving_label")} ${entry.cravingIntensity}/10`}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDate(entry.timestamp, language)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {entry.favourite && (
                    <Star
                      size={14}
                      strokeWidth={2}
                      className="text-amber-300 fill-amber-300 shrink-0"
                      aria-label={t("journal.favourite")}
                    />
                  )}
                  <button
                    onClick={() => setConfirmDelete(entry.id)}
                    className="touch-target text-muted-foreground hover:text-destructive transition-colors ml-2 p-1.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    aria-label={t("journal.delete_aria")}
                  >
                    <Trash2 size={16} strokeWidth={1.8} />
                  </button>
                </div>
              </div>
              {entry.trigger && (
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  <span className="font-medium text-foreground">{t("journal.trigger_label")}</span> {entry.trigger}
                </p>
              )}
              {entry.coping && (
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  <span className="font-medium text-foreground">{t("journal.coping_label")}</span> {entry.coping}
                </p>
              )}
              {entry.note && (
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{entry.note}</p>
              )}
            </div>
          ))
        )}

        <div className="h-2" />
      </div>

      <div className="shrink-0 border-t border-border bg-background/95 px-4 pb-3 pt-3 backdrop-blur-sm">
        <button
          onClick={() => navigate("/journal/new")}
          className="mx-auto flex w-full max-w-lg items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 font-semibold text-primary-foreground shadow-lg transition-all hover:opacity-90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          aria-label={t("journal.add_aria")}
        >
          <Plus size={20} strokeWidth={2.2} />
          <span>{t("journal.add_aria")}</span>
        </button>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-background/80 backdrop-blur-sm px-4 pb-8">
          <div className="bg-card border border-border rounded-3xl p-6 w-full max-w-sm">
            <h3 className="font-semibold text-foreground mb-2">{t("journal.delete_title")}</h3>
            <p className="text-sm text-muted-foreground mb-5">{t("journal.delete_body")}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 border border-border rounded-xl py-3 font-medium text-muted-foreground touch-target focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={async () => {
                  await removeEntry(confirmDelete);
                  setConfirmDelete(null);
                }}
                className="flex-1 bg-destructive text-destructive-foreground rounded-xl py-3 font-semibold touch-target focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
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
