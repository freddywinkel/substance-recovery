import { useRef, useState } from "react";
import { Link } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRecoveryFeatures } from "@/contexts/RecoveryFeaturesContext";
import {
  importMoodTrackerBackup,
  previewMoodTrackerImport,
  type MoodTrackerPreview,
} from "@/db/dailyBalance";
import { flushLocalDrafts } from "@/lib/localDrafts";

export function MoodTrackerImportPanel({
  disabled = false,
}: {
  disabled?: boolean;
}) {
  const { language } = useLanguage();
  const nl = language === "nl";
  const { refresh } = useRecoveryFeatures();
  const [payload, setPayload] = useState<unknown>(null);
  const [preview, setPreview] = useState<MoodTrackerPreview | null>(null);
  const [choice, setChoice] = useState<"keep" | "incoming">("keep");
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    imported: number;
    skipped: number;
  } | null>(null);

  async function readFile(file?: File) {
    if (!file || locked.current || disabled) return;
    locked.current = true;
    setBusy(true);
    setError("");
    setResult(null);
    setPreview(null);
    setPayload(null);
    setChoice("keep");
    setAcknowledged(false);
    try {
      if (file.size > 50 * 1024 * 1024) throw new Error("size");
      const next: unknown = JSON.parse(await file.text());
      await flushLocalDrafts();
      const checked = await previewMoodTrackerImport(next);
      setPayload(next);
      setPreview(checked);
    } catch {
      setError(
        nl
          ? "Dit bestand kon niet worden ingelezen. Kies een geldige MoodTracker JSON-back-up van maximaal 50 MB. Er is niets geïmporteerd."
          : "This file could not be read. Choose a valid MoodTracker JSON backup up to 50 MB. Nothing was imported.",
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function commit() {
    if (
      !preview ||
      !payload ||
      locked.current ||
      disabled ||
      (choice === "incoming" && !acknowledged)
    )
      return;
    locked.current = true;
    setBusy(true);
    setError("");
    let committed = false;
    try {
      const imported = await importMoodTrackerBackup(payload, choice);
      committed = true;
      setResult(imported);
      setPreview(null);
      setPayload(null);
      await refresh();
    } catch {
      setError(
        committed
          ? nl
            ? "De import is opgeslagen. Herlaad de app om alle dagen te zien."
            : "The import was saved. Reload the app to see all days."
          : nl
            ? "De import is niet opgeslagen. Je huidige gegevens zijn behouden. Probeer opnieuw."
            : "The import was not saved. Your current data was preserved. Please retry.",
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      aria-labelledby="moodtracker-import-title"
      className="space-y-3 rounded-3xl border border-border/50 bg-card/50 p-4"
    >
      <h2 id="moodtracker-import-title" className="text-sm font-semibold">
        {nl ? "MoodTracker meenemen" : "Bring your MoodTracker days"}
      </h2>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {nl
          ? "Exporteer een JSON-back-up in MoodTracker en kies die hier. Je dagen en concepten komen in de dagelijkse check-in. Je MoodTracker-app houdt de oorspronkelijke gegevens."
          : "Export a JSON backup in MoodTracker and select it here. Your days and drafts join the daily check-in. The original data stays in MoodTracker."}
      </p>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {nl
          ? "Je Anchor-instellingen en contacten blijven behouden. Bestaande MoodTracker-trekcijfers houden hun schaal van 0–3. Dit is een eenmalige import, zonder automatische synchronisatie."
          : "Your Anchor settings and contacts are preserved. Existing MoodTracker craving ratings keep their 0–3 scale. This is a one-time import without automatic sync."}
      </p>
      <label className="block text-sm font-medium" htmlFor="moodtracker-backup">
        {nl ? "MoodTracker-back-up kiezen" : "Choose MoodTracker backup"}
      </label>
      <input
        id="moodtracker-backup"
        type="file"
        accept=".json,application/json"
        disabled={disabled || busy}
        onChange={(event) => {
          void readFile(event.target.files?.[0]);
          event.target.value = "";
        }}
        className="block min-h-11 w-full min-w-0 text-sm file:mr-2 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-3"
      />
      {busy && (
        <p role="status" className="text-sm">
          {nl ? "Bestand verwerken…" : "Processing file…"}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {preview && (
        <div className="space-y-3">
          <p className="text-sm">
            {nl
              ? `${preview.entries} dagen en ${preview.drafts} concepten; ${preview.newDays} nieuwe datums, ${preview.conflicts} bestaande datums.`
              : `${preview.entries} days and ${preview.drafts} drafts; ${preview.newDays} new dates, ${preview.conflicts} existing dates.`}
          </p>
          <fieldset disabled={disabled || busy} className="space-y-2 text-sm">
            <legend className="mb-2 font-medium">
              {nl ? "Als een datum al bestaat" : "When a date already exists"}
            </legend>
            <label className="flex min-h-11 items-center gap-2">
              <input
                type="radio"
                name="moodtracker-conflicts"
                checked={choice === "keep"}
                onChange={() => {
                  setChoice("keep");
                  setAcknowledged(false);
                }}
              />
              <span>
                {nl
                  ? "Mijn Anchor-dag en concept behouden"
                  : "Keep my Anchor day and draft"}
              </span>
            </label>
            <label className="flex min-h-11 items-center gap-2">
              <input
                type="radio"
                name="moodtracker-conflicts"
                checked={choice === "incoming"}
                onChange={() => setChoice("incoming")}
              />
              <span>
                {nl
                  ? "De MoodTracker-dag en het concept gebruiken"
                  : "Use the MoodTracker day and draft"}
              </span>
            </label>
            {choice === "incoming" && (
              <label className="flex min-h-11 items-center gap-2">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(event) => setAcknowledged(event.target.checked)}
                />
                <span>
                  {nl
                    ? "Ik begrijp dat dagen en concepten op dezelfde datum worden vervangen. Activiteitsmomenten blijven behouden."
                    : "I understand that days and drafts on matching dates will be replaced. Activity moments are preserved."}
                </span>
              </label>
            )}
          </fieldset>
          <button
            type="button"
            disabled={
              disabled ||
              busy ||
              preview.dates.length === 0 ||
              (choice === "incoming" && !acknowledged)
            }
            onClick={() => void commit()}
            className="min-h-11 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {nl ? "MoodTracker importeren" : "Import MoodTracker"}
          </button>
        </div>
      )}
      {result && (
        <div role="status" className="space-y-2 text-sm">
          <p>
            {nl
              ? `${result.imported} datums geïmporteerd; ${result.skipped} bestaande datums behouden.`
              : `${result.imported} dates imported; ${result.skipped} existing dates kept.`}
          </p>
          <Link
            href="/daily?view=history"
            className="inline-flex min-h-11 items-center text-primary underline"
          >
            {nl ? "Bekijk mijn dagen" : "View my days"}
          </Link>
        </div>
      )}
    </section>
  );
}
