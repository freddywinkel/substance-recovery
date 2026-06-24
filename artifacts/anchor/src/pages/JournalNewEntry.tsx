import { useState } from "react";
import { useLocation } from "wouter";
import { useStore } from "@/hooks/useStore";
import { useT } from "@/hooks/useT";
import { PageHeader } from "@/components/PageHeader";

function Slider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const { t } = useT();
  return (
    <div className="flex flex-col gap-4">
      <div className="text-center">
        <span className="text-7xl font-light text-primary tabular-nums">{value}</span>
      </div>
      <input
        type="range"
        min={0}
        max={10}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="intensity-slider w-full"
      />
      <div className="flex justify-between px-1">
        <span className="text-xs text-muted-foreground">{t("journal.craving.scale_min")}</span>
        <span className="text-xs text-muted-foreground">{t("journal.craving.scale_max")}</span>
      </div>
    </div>
  );
}

export function JournalNewEntry() {
  const { t } = useT();
  const [mood, setMood] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [craving, setCraving] = useState<number>(5);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const { logEntry } = useStore();
  const [, navigate] = useLocation();

  const MOOD_LABELS = [
    t("journal.mood.very_low"),
    t("journal.mood.low"),
    t("journal.mood.okay"),
    t("journal.mood.good"),
    t("journal.mood.great"),
  ];

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      await logEntry({
        timestamp: Date.now(),
        mood,
        cravingIntensity: craving,
        note: note.trim(),
        toolUsed: null,
      });
      navigate("/journal");
    } catch (e) {
      setError(t("common.save_error") ?? "Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col min-h-dvh bg-background">
      <PageHeader
        title={t("journal.new_title")}
        subtitle={t("journal.subtitle")}
        back
        onBack={() => navigate("/journal")}
      />

      <div
        className="flex-1 overflow-y-auto scroll-smooth-ios px-4 pt-4 flex flex-col gap-6"
        style={{ paddingBottom: "calc(9rem + env(safe-area-inset-bottom))" }}
      >
        {/* Mood */}
        <div>
          <p className="text-base font-medium text-foreground mb-3">{t("journal.mood_q")}</p>
          <div className="flex gap-2">
            {([1, 2, 3, 4, 5] as const).map((v) => (
              <button
                key={v}
                onClick={() => setMood(v)}
                className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-2xl border transition-all touch-target ${
                  mood === v
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:border-primary/30"
                }`}
              >
                <span className="text-xl">{["😔", "😟", "😐", "🙂", "😊"][v - 1]}</span>
                <span className="text-[10px] leading-tight text-center">{MOOD_LABELS[v - 1]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Craving */}
        <div>
          <p className="text-base font-medium text-foreground mb-1">{t("journal.craving_q")}</p>
          <p className="text-sm text-muted-foreground mb-4">{t("journal.craving_sub")}</p>
          <Slider value={craving} onChange={setCraving} />
        </div>

        {/* Note */}
        <div>
          <p className="text-base font-medium text-foreground mb-1">{t("journal.note_q")}</p>
          <p className="text-sm text-muted-foreground mb-3">{t("journal.note_sub")}</p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("journal.note_placeholder")}
            rows={6}
            className="w-full bg-card border border-input rounded-2xl px-4 py-3.5 text-foreground placeholder:text-muted-foreground/50 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="text-xs text-muted-foreground mt-2">
            {t("journal.privacy_note")}
          </p>
        </div>
      </div>

      <div
        className="fixed left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border px-4 pt-3 pb-3 z-40"
        style={{ bottom: "calc(3.5rem + env(safe-area-inset-bottom))" }}
      >
        {error && (
          <p className="text-sm text-red-500 mb-2 text-center">{error}</p>
        )}
        <div className="flex gap-3 max-w-lg mx-auto">
          <button
            onClick={() => navigate("/journal")}
            className="touch-target px-5 py-3.5 border border-border rounded-2xl font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-primary text-primary-foreground rounded-2xl py-3.5 font-semibold touch-target hover:opacity-90 active:scale-95 transition-all disabled:opacity-60"
          >
            {saving ? t("journal.saving") : t("journal.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
