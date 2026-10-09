import { useRef, useState } from "react";
import { Link } from "wouter";
import { PageHeader } from "@/components/PageHeader";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRecoveryFeatures } from "@/contexts/RecoveryFeaturesContext";
import type { UsePeriodRecord } from "@/lib/usePeriods";
import { USE_PERIOD_COPY } from "@/lib/usePeriodCopy";
import { recoveryTargetLabel } from "@/lib/recoveryTargets";
import { UsePeriodConflictError } from "@/db/usePeriods";

export function UsePeriods() {
  const { language } = useLanguage();
  const c = USE_PERIOD_COPY[language];
  const { usePeriods, loading, loadError, refresh, removeUsePeriod } =
    useRecoveryFeatures();
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  async function remove(record: UsePeriodRecord) {
    if (busy.current || loadError) return;
    busy.current = true;
    setSaving(true);
    setError("");
    try {
      await removeUsePeriod(record);
      setPendingDelete(null);
    } catch (cause) {
      setError(
        cause instanceof UsePeriodConflictError ? c.conflict : c.deleteError,
      );
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  const format = (date: string) =>
    new Date(`${date}T12:00:00`).toLocaleDateString(
      language === "nl" ? "nl-NL" : "en-GB",
    );
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title={c.history} subtitle={c.local} back />
      <div className="flex-1 overflow-y-auto px-4 py-5 pb-safe">
        <div className="mx-auto flex max-w-xl flex-col gap-4 pb-8">
          <Link
            href="/use-periods/new"
            className="flex min-h-12 items-center justify-center rounded-2xl bg-primary p-3 font-semibold text-primary-foreground"
          >
            {c.title}
          </Link>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {c.totalHint}
          </p>
          {loading && <p role="status">{c.loading}</p>}
          {(loadError || error) && (
            <div
              role="alert"
              className="rounded-2xl border border-destructive p-4"
            >
              <p>{error || c.loadError}</p>
              <button
                className="min-h-12 underline"
                onClick={() => {
                  setError("");
                  void refresh();
                }}
              >
                {c.reload}
              </button>
            </div>
          )}
          {!loading && !loadError && usePeriods.length === 0 && (
            <p className="rounded-2xl border border-border p-5 text-sm">
              {c.empty}
            </p>
          )}
          {!loading &&
            !loadError &&
            [...usePeriods]
              .sort((a, b) => b.endDate.localeCompare(a.endDate))
              .map((record) => (
                <article
                  key={record.id}
                  className="rounded-3xl border border-border bg-card p-5"
                >
                  <h2 className="font-semibold">
                    {recoveryTargetLabel(record.target, language)}
                  </h2>
                  <p className="mt-2">
                    <time dateTime={record.startDate}>
                      {format(record.startDate)}
                    </time>
                    {record.endDate !== record.startDate && (
                      <>
                        {" "}
                        –{" "}
                        <time dateTime={record.endDate}>
                          {format(record.endDate)}
                        </time>
                      </>
                    )}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {c.retrospective} ·{" "}
                    {record.frequency === "daily"
                      ? c.daily
                      : record.frequency === "some-days"
                        ? c.some
                        : c.unknown}
                  </p>
                  {record.note && (
                    <p className="mt-3 whitespace-pre-wrap break-words text-sm">
                      {record.note}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-3">
                    <Link
                      href={`/use-periods/${encodeURIComponent(record.id)}/edit`}
                      className="inline-flex min-h-12 items-center underline"
                    >
                      {c.edit}
                    </Link>
                    <button
                      disabled={saving}
                      onClick={() => setPendingDelete(record.id)}
                      className="min-h-12 text-destructive underline"
                    >
                      {c.remove}
                    </button>
                  </div>
                  {pendingDelete === record.id && (
                    <div className="mt-3 rounded-2xl border border-border p-3">
                      <p className="text-sm">{c.confirm}</p>
                      <div className="flex flex-wrap gap-3">
                        <button
                          disabled={saving}
                          onClick={() => void remove(record)}
                          className="min-h-12 text-destructive underline"
                        >
                          {c.yes}
                        </button>
                        <button
                          disabled={saving}
                          onClick={() => setPendingDelete(null)}
                          className="min-h-12 underline"
                        >
                          {c.cancel}
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              ))}
          <p className="text-xs text-muted-foreground">{c.evidence}</p>
          <Link href="/" className="flex min-h-12 items-center underline">
            {c.home}
          </Link>
        </div>
      </div>
    </div>
  );
}
