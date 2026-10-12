import { useRef, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Check, ChevronRight, Moon, Plus, Waves } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { DraftStatus } from "@/components/DraftStatus";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRecoveryFeatures } from "@/contexts/RecoveryFeaturesContext";
import { useLocalDraft } from "@/hooks/useLocalDraft";
import { DraftConflictError, flushLocalDrafts } from "@/lib/localDrafts";
import { BALANCE_COPY } from "@/lib/dailyBalanceCopy";
import {
  emptyDailyBalance,
  localBalanceDate,
  type BalanceMomentRecord,
  type DailyBalanceRecord,
} from "@/lib/dailyBalance";
import {
  dailyDraftFromRecord,
  dailyRecordFromDraft,
  isDailyBalanceDraft,
  type DailyBalanceDraft,
} from "@/lib/dailyBalanceDraft";
import {
  BalanceRatingsFields,
  RatingChoices,
  RatingsComparison,
  balanceButtonClass,
  balanceInputClass,
  balancePrimaryClass,
  formatBalanceDate,
  sleepText,
} from "@/components/daily-balance/BalanceFields";
import { DailyBalanceInsights } from "@/components/daily-balance/DailyBalanceInsights";

function validDate(date: string | null): date is string {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T12:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
  );
}

export function DailyBalance() {
  const { language } = useLanguage();
  const c = BALANCE_COPY[language];
  const search = useSearch();
  const [, navigate] = useLocation();
  const {
    dailyBalances,
    dailyBalanceDraftDates,
    balanceMoments,
    loading,
    loadError,
    refresh,
  } = useRecoveryFeatures();
  const [initialDate] = useState(localBalanceDate);
  const params = new URLSearchParams(search);
  const requested = params.get("date");
  const date = validDate(requested) ? requested : initialDate;
  const requestedView = params.get("view");
  const view =
    requestedView === "history" || requestedView === "trends"
      ? requestedView
      : "day";
  const [navigationError, setNavigationError] = useState(false);
  const [generation, setGeneration] = useState(0);
  async function changePage(nextDate: string, nextView = "day") {
    try {
      await flushLocalDrafts();
      if (nextView === "history") await refresh();
      setNavigationError(false);
      navigate(
        `/daily?date=${nextDate}${nextView === "day" ? "" : `&view=${nextView}`}`,
      );
    } catch {
      setNavigationError(true);
    }
  }
  const days = [
    ...new Set([
      ...dailyBalances.map((item) => item.date),
      ...dailyBalanceDraftDates,
      ...balanceMoments.map((item) => item.date),
    ]),
  ]
    .sort()
    .reverse();
  const selected = dailyBalances.find((item) => item.date === date);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title={c.title} subtitle={c.subtitle} back />
      <div className="flex-1 overflow-y-auto px-4 py-5 pb-safe">
        <div className="mx-auto flex max-w-2xl flex-col gap-5 pb-8">
          <div
            role="group"
            aria-label={c.title}
            className="grid grid-cols-3 gap-2 rounded-2xl bg-muted/30 p-1.5"
          >
            {(["day", "history", "trends"] as const).map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={view === item}
                onClick={() => void changePage(date, item)}
                className={`min-h-12 rounded-xl px-2 text-sm font-medium ${view === item ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:bg-card/50"}`}
              >
                {c[item]}
              </button>
            ))}
          </div>
          {navigationError && (
            <p role="alert" className="text-sm text-destructive">
              {c.saveError}
            </p>
          )}
          {loading ? (
            <p role="status">{c.loading}</p>
          ) : loadError ? (
            <div role="alert">
              <p>{c.loadError}</p>
              <button
                type="button"
                className={balanceButtonClass}
                onClick={() => void refresh()}
              >
                {c.retry}
              </button>
            </div>
          ) : view === "trends" ? (
            <DailyBalanceInsights />
          ) : view === "history" ? (
            <>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {c.exportHint}
              </p>
              {days.length === 0 && (
                <p className="rounded-3xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                  {c.emptyHistory}
                </p>
              )}
              {days.map((day) => {
                const summary = dailyBalances.find((item) => item.date === day);
                const moments = balanceMoments.filter(
                  (item) => item.date === day,
                );
                const hasDraft = dailyBalanceDraftDates.includes(day);
                return (
                  <button
                    type="button"
                    key={day}
                    className="rounded-3xl border border-border bg-card/70 p-5 text-left hover:bg-muted/25"
                    onClick={() => void changePage(day)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="font-semibold">
                          {formatBalanceDate(day, language)}
                        </h2>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {summary
                            ? `${c.mood}: ${summary.mood ?? "—"} · ${c.intensityShort}: ${summary.emotionalIntensity ?? "—"} · ${c.craving}: ${summary.craving === null ? "—" : `${summary.craving}/${summary.cravingScale}`}`
                            : hasDraft
                              ? c.draftDay
                              : c.noSummary}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {moments.length} {c.moments.toLowerCase()}
                        </p>
                      </div>
                      <ChevronRight
                        size={20}
                        className="mt-1 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </div>
                    <span className="mt-3 inline-flex min-h-8 items-center text-sm font-medium text-primary">
                      {hasDraft ? c.continueDraft : c.edit}
                    </span>
                  </button>
                );
              })}
            </>
          ) : (
            <>
              <section className="rounded-3xl border border-border bg-card/70 p-4 sm:p-5">
                <p className="text-sm leading-relaxed">{c.intro}</p>
                <label htmlFor="balance-date" className="sr-only">
                  {c.date}
                </label>
                <div className="mt-3 flex items-center gap-2">
                  <input
                    id="balance-date"
                    type="date"
                    max={localBalanceDate()}
                    value={date}
                    onChange={(event) => {
                      if (validDate(event.target.value))
                        void changePage(event.target.value);
                    }}
                    className="min-h-12 min-w-0 flex-1 rounded-xl border border-input bg-card px-3 py-2 text-base"
                  />
                  <button
                    type="button"
                    className={balanceButtonClass}
                    onClick={() => void changePage(localBalanceDate())}
                  >
                    {c.today}
                  </button>
                </div>
              </section>
              <DayEditor
                key={`${date}:${generation}`}
                date={date}
                record={selected}
                onReload={() => setGeneration((value) => value + 1)}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DayEditor({
  date,
  record,
  onReload,
}: {
  date: string;
  record?: DailyBalanceRecord;
  onReload: () => void;
}) {
  const { language } = useLanguage();
  const c = BALANCE_COPY[language];
  const { saveDailyBalance, removeDailyBalance, balanceMoments, refresh } =
    useRecoveryFeatures();
  const [initial] = useState<DailyBalanceDraft>(() => ({
    ...dailyDraftFromRecord(record ?? emptyDailyBalance(date)),
    sourceUpdatedAt: record?.updatedAt ?? null,
  }));
  const draft = useLocalDraft(`daily-balance:${date}`, initial, {
    validate: isDailyBalanceDraft,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState<"delete" | "reload" | null>(null);
  const [needsReload, setNeedsReload] = useState(false);
  const busy = useRef(false);
  const blocked = saving || !draft.hydrated || !!draft.error || needsReload;
  const dayMoments = balanceMoments
    .filter((item) => item.date === date)
    .sort((a, b) => b.timestamp - a.timestamp);
  const latest = [...dayMoments]
    .sort((a, b) => (b.afterAt ?? b.timestamp) - (a.afterAt ?? a.timestamp))
    .find((item) => {
      const scores = item.after ?? item.before;
      return (
        scores.mood !== null ||
        scores.emotionalIntensity !== null ||
        scores.craving !== null
      );
    });
  const parsed = dailyRecordFromDraft(draft.value);
  const total =
    parsed.errors.length === 0 &&
    parsed.record.mainSleep !== null &&
    parsed.record.additionalSleep !== null
      ? parsed.record.mainSleep + parsed.record.additionalSleep
      : null;
  function update(patch: Partial<DailyBalanceRecord>) {
    setSaved(false);
    setCopied(false);
    draft.setValue((current) => ({
      ...current,
      record: { ...current.record, ...patch },
    }));
  }
  function duration(
    key: "mainHours" | "mainMinutes" | "additionalHours" | "additionalMinutes",
    value: string,
  ) {
    setSaved(false);
    draft.setValue((current) => ({ ...current, [key]: value }));
  }
  async function save() {
    if (blocked || busy.current) return;
    const result = dailyRecordFromDraft(draft.value);
    if (result.errors.length) {
      setError(c.invalidSleep);
      return;
    }
    busy.current = true;
    setSaving(true);
    setError("");
    let committed = false;
    try {
      await flushLocalDrafts();
      const next = await saveDailyBalance(
        result.record,
        draft.value.sourceUpdatedAt,
      );
      committed = true;
      await draft.clearDraft(
        { ...dailyDraftFromRecord(next), sourceUpdatedAt: next.updatedAt },
        { keepInputOnFailure: true },
      );
      setSaved(true);
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
  async function confirmed() {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setError("");
    try {
      if (confirm === "delete" && record) {
        await flushLocalDrafts();
        await removeDailyBalance(record);
      } else if (draft.conflict) await draft.reloadLatest();
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
    } catch {
      setError(confirm === "delete" ? c.deleteError : c.saveError);
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  function copyLatest() {
    if (!latest) return;
    const ratings = latest.after ?? latest.before;
    draft.setValue((current) => ({
      ...current,
      record: {
        ...current.record,
        mood: ratings.mood ?? current.record.mood,
        emotionalIntensity:
          ratings.emotionalIntensity ?? current.record.emotionalIntensity,
        craving:
          current.record.cravingScale === 10
            ? (ratings.craving ?? current.record.craving)
            : current.record.craving,
      },
    }));
    setSaved(false);
    setCopied(true);
  }
  return (
    <>
      <Link
        href={`/daily/moments/new?date=${date}`}
        className="flex min-h-11 items-center gap-2 text-sm font-medium text-primary underline underline-offset-4"
      >
        <Plus size={17} aria-hidden="true" />
        {c.addMoment}
      </Link>
      <DraftStatus {...draft} />
      {(saved ||
        (draft.hydrated &&
          !draft.hasDraft &&
          draft.value.sourceUpdatedAt !== null)) && (
        <div
          role="status"
          className="flex gap-3 rounded-2xl border border-primary/25 bg-primary/5 p-4"
        >
          <Check
            size={20}
            className="shrink-0 text-primary"
            aria-hidden="true"
          />
          <div>
            <p className="text-sm font-semibold">{c.saved}</p>
            <p className="mt-1 text-xs text-muted-foreground">{c.savedHint}</p>
          </div>
        </div>
      )}
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <fieldset disabled={blocked} className="min-w-0 space-y-5">
          <section className="rounded-3xl border border-border bg-card/70 p-4 sm:p-5">
            <BalanceRatingsFields
              value={draft.value.record}
              cravingScale={draft.value.record.cravingScale}
              onChange={(ratings) => update(ratings)}
            />
          </section>
          <section className="rounded-3xl border border-border bg-card/70 p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <Moon size={20} className="text-primary" aria-hidden="true" />
              <h2 className="font-semibold">{c.sleep}</h2>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {c.sleepHint}
            </p>
            {(["main", "additional"] as const).map((part) => (
              <fieldset key={part} className="mt-5">
                <legend className="text-sm font-medium">
                  {part === "main" ? c.mainSleep : c.extraSleep}
                </legend>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  {(["Hours", "Minutes"] as const).map((unit) => {
                    const key = `${part}${unit}` as
                      | "mainHours"
                      | "mainMinutes"
                      | "additionalHours"
                      | "additionalMinutes";
                    return (
                      <label
                        key={unit}
                        className="text-xs text-muted-foreground"
                      >
                        {unit === "Hours" ? c.hours : c.minutes}
                        <input
                          inputMode="numeric"
                          type="text"
                          value={draft.value[key]}
                          maxLength={5}
                          onChange={(event) =>
                            duration(key, event.target.value)
                          }
                          className={balanceInputClass}
                          placeholder="—"
                          aria-label={`${part === "main" ? c.mainSleep : c.extraSleep} · ${unit === "Hours" ? c.hours : c.minutes}`}
                        />
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ))}
            <button
              type="button"
              className="mt-2 min-h-11 text-sm text-primary underline underline-offset-4"
              onClick={() => {
                setSaved(false);
                draft.setValue((current) => ({
                  ...current,
                  additionalHours: "0",
                  additionalMinutes: "0",
                }));
              }}
            >
              {c.noExtra}
            </button>
            <p className="mt-3 border-t border-border pt-3 text-sm font-medium">
              {c.totalSleep}:{" "}
              <span className="tabular-nums">{sleepText(total)}</span>
            </p>
            {total === null && (
              <p className="mt-1 text-xs text-muted-foreground">
                {c.unknownTotal}
              </p>
            )}
          </section>
          <details className="rounded-3xl border border-border bg-card/70 p-4 sm:p-5">
            <summary className="cursor-pointer py-2 text-sm font-semibold">
              {c.details}
            </summary>
            <div className="mt-5 space-y-5">
              <RatingChoices
                label={c.drive}
                value={draft.value.record.drive}
                values={[-2, -1, 0, 1, 2]}
                labels={c.driveLabels}
                onChange={(drive) => update({ drive })}
              />
              <RatingChoices
                label={c.fatigue}
                value={draft.value.record.fatigue}
                values={[0, 1, 2, 3]}
                labels={c.fatigueLabels}
                onChange={(fatigue) => update({ fatigue })}
              />
              <RatingChoices
                label={c.enjoyment}
                value={draft.value.record.enjoyment}
                values={[0, 1, 2, 3]}
                labels={c.enjoymentLabels}
                onChange={(enjoyment) => update({ enjoyment })}
              />
              <label className="block text-sm font-medium">
                {c.use}
                <select
                  aria-label={c.use}
                  value={draft.value.record.use ?? ""}
                  className={balanceInputClass}
                  onChange={(event) =>
                    update({
                      use:
                        (event.target.value as DailyBalanceRecord["use"]) ||
                        null,
                    })
                  }
                >
                  <option value="">{c.unknown}</option>
                  <option value="none">{c.noUse}</option>
                  <option value="occurred">{c.occurred}</option>
                  <option value="prefer-not">{c.preferNot}</option>
                </select>
              </label>
              <label className="block text-sm font-medium">
                {c.change}
                <select
                  aria-label={c.change}
                  value={
                    draft.value.record.significantChange === null
                      ? ""
                      : String(draft.value.record.significantChange)
                  }
                  className={balanceInputClass}
                  onChange={(event) =>
                    update({
                      significantChange:
                        event.target.value === ""
                          ? null
                          : event.target.value === "true",
                    })
                  }
                >
                  <option value="">{c.unknown}</option>
                  <option value="true">{c.yes}</option>
                  <option value="false">{c.no}</option>
                </select>
              </label>
              {draft.value.record.significantChange === true && (
                <label className="block text-sm font-medium">
                  {c.changeNote}
                  <textarea
                    rows={2}
                    maxLength={4000}
                    className={balanceInputClass}
                    value={draft.value.record.changeNote}
                    onChange={(event) =>
                      update({ changeNote: event.target.value })
                    }
                  />
                </label>
              )}
              <label className="block text-sm font-medium">
                {c.supportedBy}
                <textarea
                  rows={2}
                  maxLength={4000}
                  className={balanceInputClass}
                  value={draft.value.record.supportedBy}
                  onChange={(event) =>
                    update({ supportedBy: event.target.value })
                  }
                />
              </label>
              <label className="block text-sm font-medium">
                {c.note}
                <textarea
                  rows={3}
                  maxLength={4000}
                  className={balanceInputClass}
                  value={draft.value.record.note}
                  onChange={(event) => update({ note: event.target.value })}
                />
              </label>
            </div>
          </details>
          <button type="submit" className={`${balancePrimaryClass} w-full`}>
            {saving ? c.saving : c.saveDay}
          </button>
        </fieldset>
      </form>
      <section className="rounded-3xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Waves size={20} className="text-primary" aria-hidden="true" />
          <h2 className="font-semibold">{c.moments}</h2>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {c.momentsIntro}
        </p>

        {dayMoments.length === 0 ? (
          <p className="mt-4 text-xs text-muted-foreground">{c.noMoments}</p>
        ) : (
          <>
            {dayMoments.find((moment) => moment.status === "open") && (
              <Link
                href={`/daily/moments/${encodeURIComponent(dayMoments.find((moment) => moment.status === "open")!.id)}`}
                className="mt-3 flex min-h-11 items-center justify-between text-sm font-medium text-primary"
              >
                {c.resume}
                <ChevronRight size={16} aria-hidden="true" />
              </Link>
            )}
            <details className="mt-3">
              <summary className="cursor-pointer py-3 text-sm font-medium">
                {c.viewMoments} ({dayMoments.length})
              </summary>
              <div className="mt-3 space-y-3">
                {dayMoments.map((moment) => (
                  <MomentCard key={moment.id} moment={moment} />
                ))}
              </div>
            </details>
          </>
        )}
        {latest && (
          <div className="mt-4 border-t border-primary/15 pt-3">
            <button
              type="button"
              disabled={blocked}
              className={`${balanceButtonClass} w-full bg-card text-primary`}
              onClick={copyLatest}
            >
              {c.useLatest}
            </button>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {c.useLatestHint}
            </p>
            {copied && (
              <p role="status" className="mt-2 text-sm">
                {draft.value.record.cravingScale === 3
                  ? c.copyScaleSkipped
                  : c.copied}
              </p>
            )}
          </div>
        )}
      </section>

      {error && (
        <p role="alert" className="text-sm leading-relaxed text-destructive">
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
      {record && (
        <button
          type="button"
          disabled={saving}
          className="min-h-12 text-sm text-muted-foreground underline underline-offset-4"
          onClick={() => setConfirm("delete")}
        >
          {c.deleteDay}
        </button>
      )}
      {confirm && (
        <div
          role="group"
          aria-label={confirm === "delete" ? c.deleteConfirm : c.confirmReload}
          className="rounded-2xl border border-border bg-card p-4"
        >
          <p className="text-sm leading-relaxed">
            {confirm === "delete" ? c.deleteConfirm : c.confirmReload}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              className={balanceButtonClass}
              onClick={() => void confirmed()}
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
    </>
  );
}

function MomentCard({ moment }: { moment: BalanceMomentRecord }) {
  const { language } = useLanguage();
  const c = BALANCE_COPY[language];
  return (
    <article className="rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-sm font-semibold">
          {moment.activity?.label || c.notChosen}
        </h3>
        <time
          dateTime={new Date(moment.timestamp).toISOString()}
          className="text-xs tabular-nums text-muted-foreground"
        >
          {new Intl.DateTimeFormat(language === "nl" ? "nl-NL" : "en-GB", {
            hour: "2-digit",
            minute: "2-digit",
          }).format(moment.timestamp)}
        </time>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {moment.attempted === true
          ? c.tried
          : moment.attempted === false
            ? c.notTried
            : c.waiting}
      </p>
      <div className="mt-3">
        <RatingsComparison before={moment.before} after={moment.after} />
      </div>
      <Link
        href={`/daily/moments/${encodeURIComponent(moment.id)}`}
        className="mt-2 flex min-h-11 items-center justify-between text-sm font-medium text-primary"
      >
        {moment.status === "open" ? c.resume : c.continueMoment}
        <ChevronRight size={16} aria-hidden="true" />
      </Link>
    </article>
  );
}
