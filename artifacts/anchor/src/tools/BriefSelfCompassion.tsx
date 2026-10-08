import { useRef, useState } from "react";
import { Link } from "wouter";
import { Heart } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { DraftStatus } from "@/components/DraftStatus";
import { useT } from "@/hooks/useTranslation";
import { useLocalDraft } from "@/hooks/useLocalDraft";
import { useRecoveryFeatures } from "@/contexts/RecoveryFeaturesContext";
import {
  COMPASSION_NOTE_ID,
  createCompassionDraft,
  isCompassionDraft,
  personalCompassionNote,
} from "@/lib/personalGrowth";
import { GROWTH_COPY } from "@/lib/growthCopy";
import { flushLocalDrafts } from "@/lib/localDrafts";
import { PersonalGrowthConflictError } from "@/db/personalGrowth";

export function BriefSelfCompassion() {
  const { loading, loadError, refresh } = useRecoveryFeatures();
  const { language } = useT();
  const copy = GROWTH_COPY[language];
  const [wordsSession, setWordsSession] = useState({
    key: 0,
    minimumTimestamp: 0,
  });
  // The exercise itself stays available if reading personal data failed.
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title={copy.compassionTitle} back />
      <div className="flex-1 overflow-y-auto px-4 py-5 pb-safe">
        <div className="mx-auto flex max-w-xl flex-col gap-4 pb-8">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {copy.compassionIntro}
          </p>
          <section className="rounded-3xl border border-border bg-card p-5">
            <h2 className="font-semibold">1 · {copy.acknowledge}</h2>
            <p className="mt-2 text-sm leading-relaxed">
              {copy.acknowledgeBody}
            </p>
          </section>
          <KindResponse />
          <section className="rounded-3xl border border-border bg-card p-5">
            <h2 className="font-semibold">3 · {copy.choose}</h2>
            <p className="mt-2 text-sm leading-relaxed">{copy.chooseBody}</p>
          </section>
          {loadError ? (
            <p role="alert" className="text-sm">
              {copy.loadError}{" "}
              <button
                onClick={() => void refresh()}
                className="min-h-12 underline"
              >
                {copy.retry}
              </button>
            </p>
          ) : loading ? (
            <p role="status">{copy.loading}</p>
          ) : (
            <PersonalWords
              key={wordsSession.key}
              minimumTimestamp={wordsSession.minimumTimestamp}
              afterDeletion={wordsSession.key > 0}
              onDeleted={(timestamp) =>
                setWordsSession((current) => ({
                  key: current.key + 1,
                  minimumTimestamp: Math.max(Date.now(), timestamp + 1),
                }))
              }
            />
          )}
          <Link
            href="/"
            className="flex min-h-12 items-center justify-center rounded-2xl bg-primary p-3 font-semibold text-primary-foreground"
          >
            {copy.leave}
          </Link>
          <Link
            href="/tools/self-compassion"
            className="flex min-h-12 items-center justify-center rounded-2xl border border-border p-3 text-center text-sm"
          >
            {copy.longVersion}
          </Link>
        </div>
      </div>
    </div>
  );
}

function KindResponse() {
  const { language } = useT();
  const copy = GROWTH_COPY[language];
  const [mode, setMode] = useState<"words" | "practical">("words");
  return (
    <section className="rounded-3xl border border-primary/25 bg-primary/5 p-5">
      <h2 className="font-semibold">2 · {copy.respond}</h2>
      <div
        className="my-3 flex flex-wrap gap-2"
        role="group"
        aria-label={copy.respond}
      >
        {(["words", "practical"] as const).map((item) => (
          <button
            key={item}
            aria-pressed={mode === item}
            onClick={() => setMode(item)}
            className={`min-h-12 rounded-xl border px-3 py-2 text-sm ${mode === item ? "border-primary bg-primary/10 text-primary" : "border-border"}`}
          >
            {copy[item]}
          </button>
        ))}
      </div>
      <p className="text-sm leading-relaxed">
        {mode === "words" ? copy.wordsBody : copy.practicalBody}
      </p>
    </section>
  );
}

function PersonalWords({
  minimumTimestamp,
  afterDeletion,
  onDeleted,
}: {
  minimumTimestamp: number;
  afterDeletion: boolean;
  onDeleted: (timestamp: number) => void;
}) {
  const { language } = useT();
  const copy = GROWTH_COPY[language];
  const { records, savePersonalRecord, removePersonalRecord } =
    useRecoveryFeatures();
  const note = personalCompassionNote(records);
  const initialDraft = createCompassionDraft(note);
  if (!note)
    initialDraft.timestamp = Math.max(initialDraft.timestamp, minimumTimestamp);
  const draft = useLocalDraft("compassion-note", initialDraft, {
    validate: isCompassionDraft,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState(
    afterDeletion ? copy.wordsDeleted : "",
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const busy = useRef(false);

  async function save() {
    if (busy.current || !draft.hydrated || draft.error) return;
    if (!draft.value.text.trim()) {
      setError(copy.wordsRequired);
      return;
    }
    busy.current = true;
    setSaving(true);
    setError("");
    setMessage("");
    let committed = false;
    try {
      await flushLocalDrafts();
      const saved = await savePersonalRecord(
        {
          id: COMPASSION_NOTE_ID,
          recordType: "compassion-note",
          text: draft.value.text.trim(),
          timestamp: draft.value.timestamp,
          updatedAt: draft.value.sourceUpdatedAt ?? draft.value.timestamp,
        },
        draft.value.sourceUpdatedAt,
      );
      committed = true;
      await draft.clearDraft(createCompassionDraft(saved), {
        keepInputOnFailure: true,
      });
      setMessage(copy.wordsSaved);
    } catch (cause) {
      setError(
        cause instanceof PersonalGrowthConflictError
          ? copy.conflict
          : committed
            ? copy.cleanupError
            : copy.error,
      );
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  async function remove() {
    if (!note || busy.current) return;
    busy.current = true;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await removePersonalRecord(note);
      // Deletion already removes its draft atomically. A fresh editor avoids
      // clearing that draft again with the old revision or reusing its identity.
      onDeleted(note.timestamp);
    } catch (cause) {
      setError(
        cause instanceof PersonalGrowthConflictError
          ? copy.conflict
          : copy.deleteError,
      );
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  async function discard() {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await draft.clearDraft(initialDraft, {
        keepInputOnFailure: true,
      });
      setConfirmDiscard(false);
    } catch {
      setError(copy.deleteError);
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  return (
    <section className="rounded-3xl border border-border bg-card p-5">
      {note && (
        <div className="mb-4">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Heart size={15} aria-hidden="true" />
            {copy.ownWords}
          </p>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">
            {note.text}
          </p>
        </div>
      )}
      <details>
        <summary className="min-h-12 cursor-pointer py-3 text-sm font-semibold">
          {copy.personalWords}
        </summary>
        <DraftStatus {...draft} />
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <fieldset
            disabled={!draft.hydrated || saving || !!draft.error}
            className="flex flex-col gap-3"
          >
            <label htmlFor="compassion-words" className="sr-only">
              {copy.personalWords}
            </label>
            <textarea
              id="compassion-words"
              rows={3}
              maxLength={500}
              value={draft.value.text}
              onChange={(event) => {
                setMessage("");
                draft.setValue((current) => ({
                  ...current,
                  text: event.target.value,
                }));
              }}
              placeholder={copy.wordsPlaceholder}
              className="w-full rounded-2xl border border-input bg-background p-3 text-base leading-relaxed"
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              {copy.wordsHint}
            </p>
            <button
              type="submit"
              className="min-h-12 rounded-xl border border-primary/40 bg-primary/10 p-3 text-sm font-semibold text-primary"
            >
              {saving ? copy.saving : copy.saveWords}
            </button>
          </fieldset>
        </form>
        {draft.hasDraft && (
          <button
            disabled={saving}
            onClick={() => setConfirmDiscard(true)}
            className="mt-2 min-h-12 text-sm underline"
          >
            {copy.discard}
          </button>
        )}
        {confirmDiscard && (
          <div
            role="group"
            aria-label={copy.discardConfirm}
            className="mt-2 rounded-xl border border-border p-3"
          >
            <p className="text-sm">{copy.discardConfirm}</p>
            <div className="flex gap-2">
              <button
                disabled={saving}
                onClick={() => void discard()}
                className="min-h-12 p-3 text-sm"
              >
                {copy.confirm}
              </button>
              <button
                disabled={saving}
                onClick={() => setConfirmDiscard(false)}
                className="min-h-12 p-3 text-sm"
              >
                {copy.cancel}
              </button>
            </div>
          </div>
        )}
        {note && (
          <button
            disabled={saving}
            onClick={() => setConfirmDelete(true)}
            className="mt-2 min-h-12 text-sm underline"
          >
            {copy.removeWords}
          </button>
        )}
        {confirmDelete && (
          <div
            role="group"
            aria-label={copy.confirmWords}
            className="mt-2 rounded-xl border border-border p-3"
          >
            <p className="text-sm">{copy.confirmWords}</p>
            <div className="flex gap-2">
              <button
                disabled={saving}
                onClick={() => void remove()}
                className="min-h-12 p-3 text-sm"
              >
                {copy.confirm}
              </button>
              <button
                disabled={saving}
                onClick={() => setConfirmDelete(false)}
                className="min-h-12 p-3 text-sm"
              >
                {copy.cancel}
              </button>
            </div>
          </div>
        )}
      </details>
      {message && (
        <p role="status" className="mt-3 text-sm">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
