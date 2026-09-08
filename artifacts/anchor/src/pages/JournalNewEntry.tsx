import { useLocalDraft } from "@/hooks/useLocalDraft";
import { DraftStatus } from "@/components/DraftStatus";
import { createJournalDraft, isJournalDraft, type JournalDraft } from "@/lib/journalDraft";
import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useStore } from "@/hooks/useStore";
import { useT } from "@/hooks/useTranslation";
import { PageHeader } from "@/components/PageHeader";
import { Star } from "lucide-react";

function CravingScore({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const { t, language } = useT();
  return <select aria-label={t("journal.craving_q")} value={value ?? ""} onChange={event => onChange(event.target.value === "" ? null : Number(event.target.value))} className="w-full rounded-xl border border-input bg-card p-3 text-foreground">
    <option value="">{language === "nl" ? "Niet ingevuld" : "Unanswered"}</option>
    {Array.from({ length: 11 }, (_, i) => <option key={i} value={i}>{i}/10</option>)}
  </select>;
}

export function JournalNewEntry() {
  const { t, language } = useT();
  const [initial] = useState(createJournalDraft);
  const draft = useLocalDraft("journal-entry", initial, { validate: isJournalDraft });
  const { mood, craving, note, trigger, coping, favourite } = draft.value;
  const setField = <K extends keyof JournalDraft>(key: K, value: JournalDraft[K]) => draft.setValue(previous => ({ ...previous, [key]: value }));
  const setMood = (value: JournalDraft["mood"]) => setField("mood", value);
  const setCraving = (value: number | null) => setField("craving", value);
  const setNote = (value: string) => setField("note", value);
  const setTrigger = (value: string) => setField("trigger", value);
  const setCoping = (value: string) => setField("coping", value);
  const savingRef = useRef(false);
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
    if (savingRef.current || !draft.hydrated) return;
    savingRef.current = true;
    setSaving(true);
    setError("");
    let committed = false;
    try {
      await logEntry({
        id: draft.value.id,
        timestamp: draft.value.timestamp,
        mood,
        cravingIntensity: craving,
        note: note.trim(),
        toolUsed: null,
        trigger: trigger.trim() || undefined,
        coping: coping.trim() || undefined,
        favourite: favourite || undefined,
      });
      committed = true;
      await draft.clearDraft();
      navigate("/journal");
    } catch (e) {
      setError(committed ? (language === "nl" ? "Je notitie is opgeslagen, maar het concept kon niet worden afgerond. Opnieuw proberen gebruikt dezelfde notitie." : "Your note was saved, but the draft could not be cleared. Retrying uses the same note.") : t("common.save_error"));
    } finally {
      savingRef.current = false;
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
        className="flex-1 overflow-y-auto scroll-smooth-ios px-4 pb-4 pt-4 flex flex-col gap-6"
      >
        <DraftStatus {...draft} />
        <fieldset disabled={!draft.hydrated || (!!draft.error && !draft.hasDraft) || saving} className="flex flex-col gap-6">
        {/* Mood */}
        <div>
          <p className="text-base font-medium text-foreground mb-3">{t("journal.mood_q")}</p>
          <div className="flex gap-2">
            {([1, 2, 3, 4, 5] as const).map((v) => (
              <button
                key={v}
                onClick={() => setMood(v)}
                aria-pressed={mood === v}
                className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-2xl border transition-all touch-target focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
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

        <button type="button" onClick={() => setMood(null)} className="self-start text-sm underline">{language === "nl" ? "Stemming niet invullen" : "Leave mood unanswered"}</button>
        {/* Craving */}
        <div>
          <p className="text-base font-medium text-foreground mb-1">{t("journal.craving_q")}</p>
          <p className="text-sm text-muted-foreground mb-4">{t("journal.craving_sub")}</p>
          <CravingScore value={craving} onChange={setCraving} />
        </div>

        {/* Optional prompt: Trigger */}
        <div>
          <p className="text-base font-medium text-foreground mb-1">{t("journal.trigger_q")}</p>
          <p className="text-sm text-muted-foreground mb-3">{t("journal.trigger_sub")}</p>
          <textarea
            aria-label={t("journal.trigger_q")}
            value={trigger}
            onChange={(e) => setTrigger(e.target.value)}
            placeholder={t("journal.trigger_placeholder")}
            rows={3}
            className="w-full bg-card border border-input rounded-2xl px-4 py-3.5 text-foreground placeholder:text-muted-foreground/50 text-sm resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          />
        </div>

        {/* Optional prompt: Coping */}
        <div>
          <p className="text-base font-medium text-foreground mb-1">{t("journal.coping_q")}</p>
          <p className="text-sm text-muted-foreground mb-3">{t("journal.coping_sub")}</p>
          <textarea
            aria-label={t("journal.coping_q")}
            value={coping}
            onChange={(e) => setCoping(e.target.value)}
            placeholder={t("journal.coping_placeholder")}
            rows={3}
            className="w-full bg-card border border-input rounded-2xl px-4 py-3.5 text-foreground placeholder:text-muted-foreground/50 text-sm resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          />
        </div>

        {/* Note */}
        <div>
          <p className="text-base font-medium text-foreground mb-1">{t("journal.note_q")}</p>
          <p className="text-sm text-muted-foreground mb-3">{t("journal.note_sub")}</p>
          <textarea
            aria-label={t("journal.note_q")}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("journal.note_placeholder")}
            rows={6}
            className="w-full bg-card border border-input rounded-2xl px-4 py-3.5 text-foreground placeholder:text-muted-foreground/50 text-sm resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          />
          <p className="text-xs text-muted-foreground mt-2">
            {t("journal.privacy_note")}
          </p>
        </div>

        {/* Favourite toggle */}
        <button
          type="button"
          onClick={() => setField("favourite", !favourite)}
          className={`flex items-center gap-2 self-start rounded-xl border px-4 py-3 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
            favourite
              ? "border-amber-300/40 bg-amber-400/10 text-amber-300"
              : "border-border/50 bg-card text-muted-foreground hover:text-foreground"
          }`}
          aria-pressed={favourite}
        >
          <Star size={16} strokeWidth={2} className={favourite ? "fill-amber-300" : ""} />
          <span className="text-sm font-medium">{t("journal.favourite")}</span>
        </button>

        </fieldset>
        {/* Form actions belong at the end of the form, not over its content. */}
        <div className="mt-auto border-t border-border/70 pb-1 pt-4">
        {error && (
          <p role="alert" className="text-sm text-red-500 mb-2 text-center">{error}</p>
        )}
        <div className="flex gap-3 max-w-lg mx-auto">
          <button
            type="button"
            onClick={() => navigate("/journal")}
            className="touch-target px-5 py-3.5 border border-border rounded-2xl font-medium text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !draft.hydrated || draft.conflict || (!!draft.error && !draft.hasDraft)}
            className="flex-1 bg-primary text-primary-foreground rounded-2xl py-3.5 font-semibold touch-target hover:opacity-90 active:scale-95 transition-all disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            {saving ? t("journal.saving") : t("journal.save")}
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}
