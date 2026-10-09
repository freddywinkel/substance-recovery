import { useRef, useState } from "react";
import { Link, useLocation, useParams, useSearch } from "wouter";
import { PageHeader } from "@/components/PageHeader";
import { DraftStatus } from "@/components/DraftStatus";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRecoveryFeatures } from "@/contexts/RecoveryFeaturesContext";
import { useLocalDraft } from "@/hooks/useLocalDraft";
import { flushLocalDrafts, DraftConflictError } from "@/lib/localDrafts";
import {
  createUsePeriodDraft,
  isUsePeriodDraft,
  isUsePeriodRecord,
  localDateString,
  type UsePeriodRecord,
} from "@/lib/usePeriods";
import { USE_PERIOD_COPY } from "@/lib/usePeriodCopy";
import {
  RECOVERY_TARGET_VALUES,
  recoveryTargetLabel,
  getTargetScopeCopy,
} from "@/lib/recoveryTargets";
import { normalizePreventionPlan } from "@/lib/preventionPlan";
import { UsePeriodConflictError, UsePeriodOverlapError } from "@/db/usePeriods";

export function UsePeriodEditor() {
  const { id } = useParams<{ id?: string }>();
  const { language } = useLanguage();
  const c = USE_PERIOD_COPY[language];
  const { usePeriods, loading, loadError, refresh } = useRecoveryFeatures();
  if (loading)
    return (
      <p role="status" className="p-5">
        {c.loading}
      </p>
    );
  if (loadError)
    return (
      <div role="alert" className="p-5">
        <p>{c.loadError}</p>
        <button className="min-h-12 underline" onClick={() => void refresh()}>
          {c.reload}
        </button>
      </div>
    );
  const record = usePeriods.find((item) => item.id === id);
  if (id && !record)
    return (
      <div className="p-5">
        <p>{c.missing}</p>
        <Link
          href="/use-periods"
          className="flex min-h-12 items-center underline"
        >
          {c.collection}
        </Link>
      </div>
    );
  return <Editor key={id ?? "new"} record={record} />;
}

function Editor({ record }: { record?: UsePeriodRecord }) {
  const { language } = useLanguage();
  const c = USE_PERIOD_COPY[language];
  const search = useSearch();
  const { saveUsePeriod, recoveryPlan, refresh } = useRecoveryFeatures();
  const [initial] = useState(() =>
    createUsePeriodDraft(
      record,
      new URLSearchParams(search).get("target") ?? undefined,
    ),
  );
  const draft = useLocalDraft(
    record ? `use-period:${encodeURIComponent(record.id)}` : "use-period:new",
    initial,
    { validate: isUsePeriodDraft },
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [overlapId, setOverlapId] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [discard, setDiscard] = useState(false);
  const busy = useRef(false);
  const [, navigate] = useLocation();
  const blocked = saving || !draft.hydrated || !!draft.error;
  const targetOrder = [
    ...new Set([
      ...normalizePreventionPlan(recoveryPlan.prevention)
        .goals.filter((g) => g.active)
        .map((g) => g.target)
        .filter((t) =>
          (RECOVERY_TARGET_VALUES as readonly string[]).includes(t),
        ),
      ...RECOVERY_TARGET_VALUES,
    ]),
  ];
  const today = localDateString();
  function dates(twoWeeks: boolean) {
    const first = new Date();
    first.setDate(first.getDate() - (twoWeeks ? 13 : 0));
    draft.setValue((previous) => ({
      ...previous,
      startDate: localDateString(first.getTime()),
      endDate: today,
    }));
  }
  async function save() {
    if (blocked || busy.current) return;
    const { sourceUpdatedAt, ...input } = draft.value;
    const candidate: UsePeriodRecord = {
      ...input,
      recordType: "use-period",
      updatedAt: sourceUpdatedAt ?? input.timestamp,
      note: input.note.trim(),
    };
    if (!isUsePeriodRecord(candidate) || candidate.endDate > today) {
      setError(c.required);
      return;
    }
    busy.current = true;
    setSaving(true);
    setError("");
    setOverlapId(null);
    setConflict(false);
    let committed = false;
    try {
      await flushLocalDrafts();
      await saveUsePeriod(candidate, sourceUpdatedAt);
      committed = true;
      await draft.clearDraft(createUsePeriodDraft(undefined, input.target), {
        keepInputOnFailure: true,
      });
      setSaved(true);
    } catch (cause) {
      if (cause instanceof UsePeriodOverlapError) {
        setOverlapId(cause.existingId);
        setError(c.overlap);
      } else if (cause instanceof UsePeriodConflictError) {
        setConflict(true);
        setError(c.conflict);
      } else setError(committed ? c.cleanup : c.error);
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  async function clear(reload = false) {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setError("");
    try {
      await draft.clearDraft(
        record ? createUsePeriodDraft(record) : createUsePeriodDraft(),
        { keepInputOnFailure: true },
      );
      setDiscard(false);
      setConflict(false);
      setOverlapId(null);
      if (reload) {
        await refresh();
        navigate("/use-periods");
      }
    } catch {
      setError(c.error);
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  const inputClass =
    "mt-2 w-full min-h-12 rounded-xl border border-border bg-background px-3 py-2 text-base";
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title={record ? c.editTitle : c.title}
        subtitle={c.local}
        back
        onBack={() => navigate("/use-periods")}
      />
      <div className="flex-1 overflow-y-auto px-4 py-5 pb-safe">
        <div className="mx-auto flex max-w-xl flex-col gap-5 pb-8">
          {saved ? (
            <>
              <p role="status" className="text-lg font-semibold">
                {c.saved}
              </p>
              <Link
                href="/"
                className="flex min-h-12 items-center justify-center rounded-2xl bg-primary p-3 font-semibold text-primary-foreground"
              >
                {c.home}
              </Link>
              <Link
                href="/use-periods"
                className="flex min-h-12 items-center justify-center rounded-2xl border border-border p-3"
              >
                {c.collection}
              </Link>
              {!record && (
                <button
                  onClick={() => setSaved(false)}
                  className="min-h-12 underline"
                >
                  {c.again}
                </button>
              )}
            </>
          ) : (
            <>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {c.intro}
              </p>
              <DraftStatus
                status={draft.status}
                error={draft.error}
                retry={draft.retry}
                conflict={draft.error instanceof DraftConflictError}
                keepMine={() => void draft.keepMine()}
              />
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void save();
                }}
                noValidate
                className="flex flex-col gap-5"
              >
                <fieldset
                  disabled={blocked}
                  className="flex min-w-0 flex-col gap-5"
                >
                  <label className="text-sm font-medium">
                    {c.target}
                    <select
                      className={inputClass}
                      value={draft.value.target}
                      onChange={(event) =>
                        draft.setValue((previous) => ({
                          ...previous,
                          target: event.target.value,
                        }))
                      }
                    >
                      <option value="">{c.choose}</option>
                      {targetOrder.map((target) => (
                        <option value={target} key={target}>
                          {recoveryTargetLabel(target, language)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {getTargetScopeCopy(
                      draft.value.target ? [draft.value.target] : [],
                      language,
                    )}{" "}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="min-h-11 rounded-xl border border-border px-3 text-sm"
                      onClick={() => dates(false)}
                    >
                      {c.today}
                    </button>
                    <button
                      type="button"
                      className="min-h-11 rounded-xl border border-border px-3 text-sm"
                      onClick={() => dates(true)}
                    >
                      {c.twoWeeks}
                    </button>
                  </div>
                  <p className="-mt-3 text-xs text-muted-foreground">
                    {c.presetHint}
                  </p>
                  <label className="min-w-0 text-sm font-medium">
                    {c.first}
                    <input
                      type="date"
                      max={today}
                      className={`${inputClass} min-w-0 max-w-full`}
                      value={draft.value.startDate}
                      onChange={(event) =>
                        draft.setValue((previous) => ({
                          ...previous,
                          startDate: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="min-w-0 text-sm font-medium">
                    {c.last}
                    <input
                      type="date"
                      max={today}
                      min={draft.value.startDate || undefined}
                      className={`${inputClass} min-w-0 max-w-full`}
                      value={draft.value.endDate}
                      onChange={(event) =>
                        draft.setValue((previous) => ({
                          ...previous,
                          endDate: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <p className="-mt-3 text-xs leading-relaxed text-muted-foreground">
                    {c.dateHint}
                  </p>
                  <label className="text-sm font-medium">
                    {c.frequency}
                    <select
                      className={inputClass}
                      value={draft.value.frequency}
                      onChange={(event) =>
                        draft.setValue((previous) => ({
                          ...previous,
                          frequency: event.target
                            .value as UsePeriodRecord["frequency"],
                        }))
                      }
                    >
                      <option value="unknown">{c.unknown}</option>
                      <option value="daily">{c.daily}</option>
                      <option value="some-days">{c.some}</option>
                    </select>
                  </label>
                  <p className="-mt-3 text-xs leading-relaxed text-muted-foreground">
                    {c.frequencyHint}
                  </p>
                  <label className="text-sm font-medium">
                    {c.note}
                    <textarea
                      maxLength={4000}
                      rows={3}
                      className={inputClass}
                      value={draft.value.note}
                      onChange={(event) =>
                        draft.setValue((previous) => ({
                          ...previous,
                          note: event.target.value,
                        }))
                      }
                    />
                  </label>
                </fieldset>
                {error && (
                  <div
                    role="alert"
                    className="rounded-2xl border border-destructive p-4 text-sm"
                  >
                    <p>{error}</p>
                    {overlapId && (
                      <Link
                        href={`/use-periods/${encodeURIComponent(overlapId)}/edit`}
                        className="flex min-h-12 items-center underline"
                      >
                        {c.editExisting}
                      </Link>
                    )}
                    {conflict && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => setDiscard(true)}
                        className="min-h-12 underline"
                      >
                        {c.reloadDraft}
                      </button>
                    )}
                  </div>
                )}
                <button
                  disabled={blocked || conflict}
                  type="submit"
                  className="min-h-12 rounded-2xl bg-primary p-3 font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {saving ? c.saving : c.save}
                </button>
                {draft.hasDraft && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setDiscard(true)}
                    className="min-h-12 underline"
                  >
                    {c.discard}
                  </button>
                )}
                {discard && (
                  <div className="rounded-2xl border border-border p-3 text-sm">
                    <p>{c.discardQuestion}</p>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void clear(conflict)}
                        className="min-h-12 underline"
                      >
                        {c.discardYes}
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => setDiscard(false)}
                        className="min-h-12 underline"
                      >
                        {c.cancel}
                      </button>
                    </div>
                  </div>
                )}
              </form>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {c.totalHint} {c.evidence}
              </p>
              <Link
                href="/use-periods"
                className="flex min-h-12 items-center underline"
              >
                {c.collection}
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
