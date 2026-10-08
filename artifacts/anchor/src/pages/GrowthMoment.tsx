import { useRef, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { PageHeader } from "@/components/PageHeader";
import { DraftStatus } from "@/components/DraftStatus";
import { useT } from "@/hooks/useTranslation";
import { useLocalDraft } from "@/hooks/useLocalDraft";
import { useRecoveryFeatures } from "@/contexts/RecoveryFeaturesContext";
import {
  createGrowthMomentDraft,
  GROWTH_CATEGORIES,
  isGrowthMomentDraft,
} from "@/lib/personalGrowth";
import type { GrowthMomentRecord } from "@/lib/recoveryFeatures";
import { GROWTH_COPY } from "@/lib/growthCopy";
import { flushLocalDrafts } from "@/lib/localDrafts";
import { PersonalGrowthConflictError } from "@/db/personalGrowth";

export function GrowthMoment() {
  const { id } = useParams<{ id?: string }>();
  const { records, loading, loadError, refresh } = useRecoveryFeatures();
  const { language } = useT();
  const copy = GROWTH_COPY[language];
  if (loading)
    return (
      <p role="status" className="p-5">
        {copy.loading}
      </p>
    );
  if (loadError)
    return (
      <p role="alert" className="p-5">
        {copy.loadError}{" "}
        <button onClick={() => void refresh()} className="min-h-12 underline">
          {copy.retry}
        </button>
      </p>
    );
  const record = records.find(
    (item): item is GrowthMomentRecord =>
      item.recordType === "growth-moment" && item.id === id,
  );
  if (id && !record)
    return (
      <div className="p-5">
        <p>{copy.missing}</p>
        <Link href="/growth" className="flex min-h-12 items-center underline">
          {copy.collection}
        </Link>
      </div>
    );
  return <MomentEditor key={id ?? "new"} record={record} />;
}

function MomentEditor({ record }: { record?: GrowthMomentRecord }) {
  const { language } = useT();
  const copy = GROWTH_COPY[language];
  const { savePersonalRecord, refresh } = useRecoveryFeatures();
  const [initial] = useState(() => createGrowthMomentDraft(record));
  const draft = useLocalDraft(
    record
      ? `growth-moment:${encodeURIComponent(record.id)}`
      : "growth-moment:new",
    initial,
    { validate: isGrowthMomentDraft },
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [confirmReload, setConfirmReload] = useState(false);
  const busy = useRef(false);
  const [, navigate] = useLocation();
  const blocked = !draft.hydrated || !!draft.error || saving;

  async function save() {
    if (blocked || busy.current) return;
    if (!draft.value.note.trim()) {
      setError(copy.required);
      return;
    }
    busy.current = true;
    setSaving(true);
    setError("");
    setConflict(false);
    let committed = false;
    try {
      await flushLocalDrafts();
      const { sourceUpdatedAt, ...input } = draft.value;
      await savePersonalRecord(
        {
          ...input,
          recordType: "growth-moment",
          updatedAt: sourceUpdatedAt ?? input.timestamp,
          note: input.note.trim(),
        },
        sourceUpdatedAt,
      );
      committed = true;
      await draft.clearDraft(createGrowthMomentDraft(), {
        keepInputOnFailure: true,
      });
      setSaved(true);
    } catch (cause) {
      setConflict(cause instanceof PersonalGrowthConflictError);
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

  async function discard() {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setError("");
    try {
      await draft.clearDraft(record ? initial : createGrowthMomentDraft(), {
        keepInputOnFailure: true,
      });
      setConfirmDiscard(false);
      setConflict(false);
    } catch {
      setError(copy.deleteError);
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  async function discardAndReload() {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setError("");
    try {
      // Only the user's explicit confirmation removes their retained edit.
      // Refresh then remounts this editor from the latest saved record/token.
      await draft.clearDraft();
      await refresh();
    } catch {
      setError(copy.deleteError);
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title={record ? copy.editTitle : copy.title}
        subtitle={copy.local}
        back
        onBack={() => navigate("/growth")}
      />
      <div className="flex-1 overflow-y-auto px-4 py-5 pb-safe">
        <div className="mx-auto flex max-w-xl flex-col gap-5 pb-8">
          {saved ? (
            <>
              <p role="status" className="text-lg font-semibold">
                {copy.saved}
              </p>
              <section className="rounded-3xl border border-primary/25 bg-primary/5 p-5">
                <h2 className="font-semibold">{copy.savour}</h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {copy.savourBody}
                </p>
              </section>
              <Link
                href="/growth"
                className="flex min-h-12 items-center justify-center rounded-2xl bg-primary p-3 font-semibold text-primary-foreground"
              >
                {copy.done}
              </Link>
              {!record && (
                <button
                  onClick={() => setSaved(false)}
                  className="min-h-12 rounded-2xl border border-border p-3"
                >
                  {copy.again}
                </button>
              )}
            </>
          ) : (
            <>
              <DraftStatus {...draft} />
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void save();
                }}
                noValidate
              >
                <fieldset disabled={blocked} className="flex flex-col gap-5">
                  <div>
                    <label
                      htmlFor="moment-note"
                      className="block text-lg font-semibold leading-relaxed"
                    >
                      {copy.prompt}
                    </label>
                    <textarea
                      id="moment-note"
                      value={draft.value.note}
                      maxLength={2000}
                      onChange={(event) =>
                        draft.setValue((current) => ({
                          ...current,
                          note: event.target.value,
                        }))
                      }
                      placeholder={copy.placeholder}
                      rows={4}
                      className="mt-3 w-full resize-y rounded-2xl border border-input bg-card p-4 text-base leading-relaxed"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="moment-category"
                      className="block text-sm font-medium"
                    >
                      {copy.category}
                    </label>
                    <select
                      id="moment-category"
                      className="mt-2 min-h-12 w-full rounded-xl border border-input bg-card p-3"
                      value={draft.value.category ?? ""}
                      onChange={(event) =>
                        draft.setValue((current) => ({
                          ...current,
                          category: (event.target.value ||
                            null) as typeof current.category,
                        }))
                      }
                    >
                      <option value="">{copy.noCategory}</option>
                      {GROWTH_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {copy.categories[category]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-border p-3 text-sm">
                      <input
                        type="checkbox"
                        className="h-5 w-5 shrink-0 accent-primary"
                        checked={draft.value.favourite}
                        onChange={(event) =>
                          draft.setValue((current) => ({
                            ...current,
                            favourite: event.target.checked,
                          }))
                        }
                      />
                      {copy.keep}
                    </label>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {copy.favouriteHint}
                    </p>
                  </div>
                  <button
                    type="submit"
                    className="min-h-12 rounded-2xl bg-primary p-3 font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    {saving ? copy.saving : copy.save}
                  </button>
                </fieldset>
              </form>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              {conflict && (
                <div className="rounded-2xl border border-border p-4">
                  <p className="text-sm leading-relaxed">
                    {copy.conflictDraft}
                  </p>
                  <button
                    disabled={saving}
                    onClick={() => setConfirmReload(true)}
                    className="mt-2 min-h-12 text-left text-sm underline"
                  >
                    {copy.loadLatest}
                  </button>
                  {confirmReload && (
                    <div role="group" aria-label={copy.confirmLoadLatest}>
                      <p className="mt-2 text-sm">{copy.confirmLoadLatest}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          disabled={saving}
                          onClick={() => void discardAndReload()}
                          className="min-h-12 rounded-xl border border-border p-3 text-sm"
                        >
                          {copy.discardAndLoad}
                        </button>
                        <button
                          disabled={saving}
                          onClick={() => setConfirmReload(false)}
                          className="min-h-12 p-3 text-sm"
                        >
                          {copy.cancel}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="flex flex-col gap-1">
                <button
                  disabled={saving}
                  onClick={() => navigate("/growth")}
                  className="min-h-12 rounded-xl p-3 text-sm underline"
                >
                  {copy.skip}
                </button>
                <button
                  disabled={saving}
                  onClick={() => navigate("/")}
                  className="min-h-12 rounded-xl p-3 text-sm text-muted-foreground"
                >
                  {copy.nothing}
                </button>
                {draft.hasDraft && (
                  <>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {copy.skipDraft}
                    </p>
                    <button
                      disabled={saving}
                      onClick={() => setConfirmDiscard(true)}
                      className="min-h-12 p-3 text-sm underline"
                    >
                      {copy.discard}
                    </button>
                  </>
                )}
              </div>
              {confirmDiscard && (
                <div
                  role="group"
                  aria-label={copy.discardConfirm}
                  className="rounded-2xl border border-border p-4"
                >
                  <p className="text-sm">{copy.discardConfirm}</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      disabled={saving}
                      onClick={() => void discard()}
                      className="min-h-12 rounded-xl border border-border p-3"
                    >
                      {copy.confirm}
                    </button>
                    <button
                      disabled={saving}
                      onClick={() => setConfirmDiscard(false)}
                      className="min-h-12 p-3"
                    >
                      {copy.cancel}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
