import { useRef, useState } from "react";
import { Link, useLocation, useParams, useSearch } from "wouter";
import {
  ArrowRight,
  Check,
  Footprints,
  Paintbrush,
  Pencil,
  Sparkles,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { DraftStatus } from "@/components/DraftStatus";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRecoveryFeatures } from "@/contexts/RecoveryFeaturesContext";
import { useLocalDraft } from "@/hooks/useLocalDraft";
import { DraftConflictError, flushLocalDrafts } from "@/lib/localDrafts";
import { BALANCE_COPY } from "@/lib/dailyBalanceCopy";
import {
  EMPTY_BALANCE_RATINGS,
  emptyBalanceMoment,
  localBalanceDate,
  validBalanceDate,
  type BalanceActivity,
  type BalanceMomentRecord,
} from "@/lib/dailyBalance";
import {
  isBalanceMomentDraft,
  type BalanceMomentDraft,
} from "@/lib/dailyBalanceDraft";
import {
  TOOL_IDS,
  recoveryToolLabel,
  type RecoveryToolId,
} from "@/lib/recoveryFeatures";
import {
  BalanceRatingsFields,
  RatingsComparison,
  balanceButtonClass,
  balanceInputClass,
  balancePrimaryClass,
  formatBalanceDate,
} from "@/components/daily-balance/BalanceFields";

export function BalanceMoment() {
  const { id } = useParams<{ id?: string }>();
  const { language } = useLanguage();
  const c = BALANCE_COPY[language];
  const { balanceMoments, loading, loadError, refresh } = useRecoveryFeatures();
  const [generation, setGeneration] = useState(0);
  const record = balanceMoments.find((item) => item.id === id);
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
        <button
          type="button"
          className={`${balanceButtonClass} mt-3`}
          onClick={() => void refresh()}
        >
          {c.retry}
        </button>
      </div>
    );
  if (id && id !== "new" && !record)
    return (
      <div className="p-5">
        <p>{c.missing}</p>
        <Link
          className="mt-3 flex min-h-12 items-center underline"
          href="/daily"
        >
          {c.title}
        </Link>
      </div>
    );
  return (
    <MomentEditor
      key={`${id ?? "new"}:${generation}`}
      record={record}
      onReload={() => setGeneration((value) => value + 1)}
    />
  );
}

function MomentEditor({
  record,
  onReload,
}: {
  record?: BalanceMomentRecord;
  onReload: () => void;
}) {
  const { language } = useLanguage();
  const c = BALANCE_COPY[language];
  const search = useSearch();
  const [, navigate] = useLocation();
  const { saveBalanceMoment, removeBalanceMoment, refresh } =
    useRecoveryFeatures();
  const [initial] = useState<BalanceMomentDraft>(() => {
    const date = new URLSearchParams(search).get("date");
    return {
      record:
        record ??
        emptyBalanceMoment(
          validBalanceDate(date) && date <= localBalanceDate()
            ? date
            : localBalanceDate(),
        ),
      sourceUpdatedAt: record?.updatedAt ?? null,
    };
  });
  const draft = useLocalDraft(
    record
      ? `balance-moment:${encodeURIComponent(record.id)}`
      : "balance-moment:new",
    initial,
    { validate: isBalanceMomentDraft },
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [needsReload, setNeedsReload] = useState(false);
  const [confirm, setConfirm] = useState<"reload" | "delete" | null>(null);
  const busy = useRef(false);
  const blocked = !draft.hydrated || !!draft.error || saving || needsReload;
  const value = draft.value.record;
  const started = draft.value.sourceUpdatedAt !== null;
  const chosenActivity = value.activity;
  const activityChoice =
    chosenActivity?.kind === "tool"
      ? "tool"
      : chosenActivity?.label === BALANCE_COPY.en.walking ||
          chosenActivity?.label === BALANCE_COPY.nl.walking
        ? "walking"
        : chosenActivity?.label === BALANCE_COPY.en.painting ||
            chosenActivity?.label === BALANCE_COPY.nl.painting
          ? "painting"
          : chosenActivity?.kind === "custom"
            ? "custom"
            : null;
  const sourceLabel =
    value.source.kind === "craving"
      ? c.sourceCraving
      : value.source.kind === "quick-registration"
        ? c.sourceQuick
        : value.source.kind === "tool"
          ? c.sourceTool
          : c.sourceDaily;
  function update(patch: Partial<BalanceMomentRecord>) {
    setSaved(false);
    draft.setValue((current) => ({
      ...current,
      record: { ...current.record, ...patch },
    }));
  }
  function choose(kind: "walking" | "painting" | "custom" | "tool") {
    if (activityChoice === kind) return;
    const activity: BalanceActivity =
      kind === "tool"
        ? {
            kind: "tool",
            label: recoveryToolLabel(TOOL_IDS[0], language),
            toolId: TOOL_IDS[0],
          }
        : {
            kind: "custom",
            label:
              kind === "walking"
                ? c.walking
                : kind === "painting"
                  ? c.painting
                  : "",
          };
    update({ activity });
  }
  async function save(mode: "start" | "complete" | "changes") {
    if (blocked || busy.current) return;
    if (!value.activity?.label.trim()) {
      setError(c.activityRequired);
      return;
    }
    if (mode === "complete" && value.attempted === null) {
      setError(c.attemptRequired);
      return;
    }
    const candidate: BalanceMomentRecord = {
      ...value,
      activity: { ...value.activity, label: value.activity.label.trim() },
      ...(mode === "complete"
        ? {
            status:
              value.attempted === false
                ? ("skipped" as const)
                : ("completed" as const),
            after: value.after ?? { ...EMPTY_BALANCE_RATINGS },
            afterAt: Math.max(Date.now(), value.timestamp),
          }
        : mode === "start" && value.status === "open"
          ? { after: null, afterAt: null }
          : {}),
    };
    busy.current = true;
    setSaving(true);
    setError("");
    let committed = false;
    try {
      await flushLocalDrafts();
      const next = await saveBalanceMoment(
        candidate,
        draft.value.sourceUpdatedAt,
      );
      committed = true;
      if (
        mode === "start" &&
        value.status === "open" &&
        value.after !== null &&
        record
      ) {
        // A second visit to a tool must retain an unfinished after-check-in.
        draft.setValue({
          record: { ...next, after: value.after },
          sourceUpdatedAt: next.updatedAt,
        });
        await flushLocalDrafts();
      } else
        await draft.clearDraft(
          { record: next, sourceUpdatedAt: next.updatedAt },
          { keepInputOnFailure: true },
        );
      setSaved(
        !(
          mode === "start" &&
          value.status === "open" &&
          value.after !== null &&
          record
        ),
      );
      if (
        mode === "start" &&
        next.activity?.kind === "tool" &&
        next.activity.toolId
      )
        navigate(
          `${next.activity.toolId}?balanceMoment=${encodeURIComponent(next.id)}`,
        );
      else if (!record)
        navigate(`/daily/moments/${encodeURIComponent(next.id)}`);
    } catch (cause) {
      const conflict = cause instanceof Error && /Conflict/.test(cause.name);
      setNeedsReload(conflict || committed);
      setError(
        committed ? c.cleanupError : conflict ? c.conflict : c.saveError,
      );
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  async function confirmAction() {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setError("");
    try {
      if (confirm === "delete" && record) {
        await flushLocalDrafts();
        await removeBalanceMoment(record);
        navigate(`/daily?date=${value.date}`);
      } else {
        if (draft.conflict) await draft.reloadLatest();
        else {
          try {
            await draft.clearDraft();
          } catch (cause) {
            if (cause instanceof DraftConflictError) await draft.reloadLatest();
            else throw cause;
          }
        }
        await refresh();
        onReload();
      }
    } catch {
      setError(confirm === "delete" ? c.deleteError : c.saveError);
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  async function back() {
    try {
      await flushLocalDrafts();
      navigate(`/daily?date=${value.date}`);
    } catch {
      setError(c.saveError);
    }
  }
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title={c.momentTitle}
        subtitle={formatBalanceDate(value.date, language)}
        back
        onBack={() => void back()}
      />
      <div className="flex-1 overflow-y-auto px-4 py-5 pb-safe">
        <div className="mx-auto flex max-w-2xl flex-col gap-5 pb-8">
          <div className="rounded-3xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
            <p className="text-sm leading-relaxed">{c.momentIntro}</p>
            <p className="mt-2 text-xs text-muted-foreground">{sourceLabel}</p>
          </div>
          <DraftStatus {...draft} />
          {(saved ||
            (draft.hydrated &&
              !draft.hasDraft &&
              draft.value.sourceUpdatedAt !== null)) && (
            <div
              role="status"
              className="flex items-center gap-2 rounded-2xl bg-primary/10 p-4 text-sm"
            >
              <Check size={18} className="text-primary" aria-hidden="true" />
              {c.momentSaved}
            </div>
          )}
          <fieldset disabled={blocked} className="min-w-0 space-y-5">
            <section
              aria-labelledby="balance-before-title"
              className="rounded-3xl border border-border bg-card/70 p-4 sm:p-5"
            >
              <div className="mb-5">
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
                    aria-hidden="true"
                  >
                    1
                  </span>
                  <h2 id="balance-before-title" className="font-semibold">
                    {c.before}
                  </h2>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {c.beforeHint}
                </p>
              </div>
              <BalanceRatingsFields
                value={value.before}
                onChange={(before) => update({ before })}
              />
            </section>
            <section
              aria-labelledby="balance-activity-title"
              className="rounded-3xl border border-border bg-card/70 p-4 sm:p-5"
            >
              <div className="flex items-center gap-3">
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
                  aria-hidden="true"
                >
                  2
                </span>
                <h2 id="balance-activity-title" className="font-semibold">
                  {c.chooseActivity}
                </h2>
              </div>
              <div
                role="group"
                aria-label={c.activity}
                className="mt-4 grid grid-cols-2 gap-2"
              >
                {(
                  [
                    { kind: "walking", label: c.walking, Icon: Footprints },
                    { kind: "painting", label: c.painting, Icon: Paintbrush },
                    { kind: "custom", label: c.ownActivity, Icon: Pencil },
                    { kind: "tool", label: c.appTool, Icon: Sparkles },
                  ] as const
                ).map(({ kind, label, Icon }) => (
                  <button
                    key={kind}
                    type="button"
                    aria-pressed={activityChoice === kind}
                    onClick={() => choose(kind)}
                    className={`flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl border p-3 text-sm ${activityChoice === kind ? "border-primary bg-primary/10 text-primary" : "border-border bg-card hover:bg-muted/30"}`}
                  >
                    <Icon size={20} aria-hidden="true" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
              {activityChoice === "custom" && (
                <label className="mt-4 block text-sm font-medium">
                  {c.ownLabel}
                  <input
                    type="text"
                    maxLength={500}
                    value={chosenActivity?.label ?? ""}
                    placeholder={c.ownPlaceholder}
                    className={balanceInputClass}
                    onChange={(event) =>
                      update({
                        activity: { kind: "custom", label: event.target.value },
                      })
                    }
                  />
                </label>
              )}
              {activityChoice === "tool" && (
                <label className="mt-4 block text-sm font-medium">
                  {c.toolLabel}
                  <select
                    aria-label={c.toolLabel}
                    value={chosenActivity?.toolId ?? TOOL_IDS[0]}
                    className={balanceInputClass}
                    onChange={(event) => {
                      const toolId = event.target.value as RecoveryToolId;
                      update({
                        activity: {
                          kind: "tool",
                          label: recoveryToolLabel(toolId, language),
                          toolId,
                        },
                      });
                    }}
                  >
                    {TOOL_IDS.map((id) => (
                      <option key={id} value={id}>
                        {recoveryToolLabel(id, language)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button
                type="button"
                className={`${balancePrimaryClass} mt-5 flex w-full items-center justify-center gap-2`}
                onClick={() => void save("start")}
              >
                {saving
                  ? c.saving
                  : chosenActivity?.kind === "tool"
                    ? started
                      ? c.resumeTool
                      : c.openTool
                    : c.start}
                <ArrowRight size={17} aria-hidden="true" />
              </button>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {c.startHint}
              </p>
            </section>
            {started && (
              <section
                aria-labelledby="balance-after-title"
                className="rounded-3xl border border-primary/25 bg-card/70 p-4 sm:p-5"
              >
                <div className="mb-5">
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
                      aria-hidden="true"
                    >
                      3
                    </span>
                    <h2 id="balance-after-title" className="font-semibold">
                      {c.after}
                    </h2>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {value.status === "open" ? c.startRecorded : c.afterHint}
                  </p>
                </div>
                <fieldset className="mb-5">
                  <legend className="text-sm font-semibold">
                    {c.attempted}
                  </legend>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {([true, false] as const).map((attempted) => (
                      <button
                        key={String(attempted)}
                        type="button"
                        aria-pressed={value.attempted === attempted}
                        onClick={() => update({ attempted })}
                        className={`${balanceButtonClass} ${value.attempted === attempted ? "border-primary bg-primary/10 text-primary" : "bg-card"}`}
                      >
                        {attempted ? c.yes : c.no}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <BalanceRatingsFields
                  value={value.after ?? EMPTY_BALANCE_RATINGS}
                  onChange={(after) => update({ after })}
                />
                <label className="mt-5 block text-sm font-medium">
                  {c.momentNote}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {c.optional}
                  </span>
                  <textarea
                    rows={3}
                    maxLength={4000}
                    className={balanceInputClass}
                    value={value.note}
                    onChange={(event) => update({ note: event.target.value })}
                  />
                </label>
                <button
                  type="button"
                  className={`${balancePrimaryClass} mt-5 w-full`}
                  onClick={() => void save("complete")}
                >
                  {saving ? c.saving : c.saveAfter}
                </button>
              </section>
            )}
          </fieldset>
          {record?.after && (
            <section className="rounded-3xl border border-border bg-muted/20 p-4 sm:p-5">
              <h2 className="mb-4 font-semibold">{c.comparison}</h2>
              <RatingsComparison before={record.before} after={record.after} />
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                {c.noClinical}
              </p>
            </section>
          )}
          {error && (
            <p
              role="alert"
              className="text-sm leading-relaxed text-destructive"
            >
              {error}
            </p>
          )}
          {(needsReload || draft.conflict) && (
            <button
              type="button"
              className={balanceButtonClass}
              onClick={() => setConfirm("reload")}
            >
              {c.loadLatest}
            </button>
          )}
          <button
            type="button"
            className={balanceButtonClass}
            onClick={() => void back()}
          >
            {c.returnDay}
          </button>
          {record && (
            <button
              type="button"
              disabled={saving}
              className="min-h-12 text-sm text-muted-foreground underline underline-offset-4"
              onClick={() => setConfirm("delete")}
            >
              {c.deleteMoment}
            </button>
          )}
          {confirm && (
            <div
              role="group"
              aria-label={
                confirm === "delete" ? c.deleteMomentConfirm : c.confirmReload
              }
              className="rounded-2xl border border-border bg-card p-4"
            >
              <p className="text-sm leading-relaxed">
                {confirm === "delete" ? c.deleteMomentConfirm : c.confirmReload}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving}
                  className={balanceButtonClass}
                  onClick={() => void confirmAction()}
                >
                  {c.confirm}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  className={balanceButtonClass}
                  onClick={() => setConfirm(null)}
                >
                  {c.cancel}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
