import { useRef, useState } from "react";
import { Link, useSearch } from "wouter";
import { Pencil, Sprout, Star, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useT } from "@/hooks/useTranslation";
import { useRecoveryFeatures } from "@/contexts/RecoveryFeaturesContext";
import { growthMoments } from "@/lib/personalGrowth";
import type { GrowthMomentRecord } from "@/lib/recoveryFeatures";
import { GROWTH_COPY } from "@/lib/growthCopy";
import { PersonalGrowthConflictError } from "@/db/personalGrowth";

export function MyGrowth() {
  const { language } = useT();
  const copy = GROWTH_COPY[language];
  const search = useSearch();
  const {
    records,
    loading,
    loadError,
    refresh,
    savePersonalRecord,
    removePersonalRecord,
  } = useRecoveryFeatures();
  const [favouritesOnly, setFavouritesOnly] = useState(
    () => new URLSearchParams(search).get("favourites") === "1",
  );
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const moments = growthMoments(records).filter(
    (moment) => !favouritesOnly || moment.favourite,
  );

  async function change(record: GrowthMomentRecord, remove = false) {
    if (busy.current || loadError) return;
    busy.current = true;
    setSaving(true);
    setError("");
    try {
      if (remove) {
        await removePersonalRecord(record);
        setPendingDelete(null);
      } else
        await savePersonalRecord(
          { ...record, favourite: !record.favourite },
          record.updatedAt,
        );
    } catch (cause) {
      setError(
        cause instanceof PersonalGrowthConflictError
          ? copy.conflict
          : remove
            ? copy.deleteError
            : copy.error,
      );
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title={copy.collection} subtitle={copy.local} back />
      <div className="flex-1 overflow-y-auto px-4 py-5 pb-safe">
        <div className="mx-auto flex max-w-xl flex-col gap-4 pb-8">
          <div className="flex gap-3">
            <Sprout
              size={27}
              className="shrink-0 text-primary"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm leading-relaxed">{copy.collectionIntro}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {copy.survives}
              </p>
            </div>
          </div>
          <Link
            href="/moments/new"
            className="flex min-h-12 items-center justify-center rounded-2xl bg-primary p-3 text-sm font-semibold text-primary-foreground"
          >
            {copy.add}
          </Link>
          <div
            className="grid grid-cols-2 gap-2"
            role="group"
            aria-label={copy.collection}
          >
            {[false, true].map((favourites) => (
              <button
                key={String(favourites)}
                aria-pressed={favouritesOnly === favourites}
                onClick={() => setFavouritesOnly(favourites)}
                className={`min-h-12 rounded-2xl border px-3 py-2 text-sm ${favouritesOnly === favourites ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
              >
                {favourites ? copy.favourites : copy.all}
              </button>
            ))}
          </div>
          {error && (
            <p
              role="alert"
              className="rounded-xl border border-destructive/30 p-3 text-sm"
            >
              {error}
            </p>
          )}
          {loadError ? (
            <p role="alert">
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
          ) : moments.length === 0 ? (
            <div className="rounded-3xl border border-border bg-card p-6">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {favouritesOnly ? copy.noFavourites : copy.empty}
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-4">
              {moments.map((moment) => (
                <li
                  key={moment.id}
                  className="rounded-3xl border border-border bg-card p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <time dateTime={new Date(moment.timestamp).toISOString()}>
                      {new Intl.DateTimeFormat(
                        language === "nl" ? "nl-NL" : "en-GB",
                        { day: "numeric", month: "short", year: "numeric" },
                      ).format(moment.timestamp)}
                    </time>
                    {moment.category && (
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-primary">
                        {copy.categories[moment.category]}
                      </span>
                    )}
                  </div>
                  <p className="mt-3 whitespace-pre-wrap break-words text-base leading-relaxed">
                    {moment.note}
                  </p>
                  <div className="mt-3 flex items-start justify-between gap-2 border-t border-border/60 pt-2">
                    <button
                      disabled={saving}
                      aria-pressed={moment.favourite}
                      aria-label={moment.favourite ? copy.unkeep : copy.keep}
                      onClick={() => void change(moment)}
                      className={`flex min-h-12 items-center gap-2 rounded-xl px-2 text-left text-xs ${moment.favourite ? "text-primary" : "text-muted-foreground"}`}
                    >
                      <Star
                        size={19}
                        className="shrink-0"
                        fill={moment.favourite ? "currentColor" : "none"}
                        aria-hidden="true"
                      />
                      <span>{moment.favourite ? copy.chosen : copy.keep}</span>
                    </button>
                    <Link
                      href={`/moments/${encodeURIComponent(moment.id)}/edit`}
                      aria-label={copy.edit}
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-muted-foreground"
                    >
                      <Pencil size={18} aria-hidden="true" />
                    </Link>
                    <button
                      disabled={saving}
                      onClick={() => setPendingDelete(moment.id)}
                      aria-label={copy.remove}
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-muted-foreground"
                    >
                      <Trash2 size={18} aria-hidden="true" />
                    </button>
                  </div>
                  {pendingDelete === moment.id && (
                    <div
                      role="group"
                      aria-label={copy.confirmRemove}
                      className="mt-2 rounded-xl bg-muted/40 p-3"
                    >
                      <p className="text-sm">{copy.confirmRemove}</p>
                      <div className="mt-2 flex gap-2">
                        <button
                          disabled={saving}
                          onClick={() => void change(moment, true)}
                          className="min-h-12 rounded-xl border border-destructive/40 px-4 text-sm"
                        >
                          {copy.confirm}
                        </button>
                        <button
                          disabled={saving}
                          onClick={() => setPendingDelete(null)}
                          className="min-h-12 px-4 text-sm"
                        >
                          {copy.cancel}
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/actions"
            className="flex min-h-12 items-center justify-center rounded-xl text-sm underline"
          >
            {copy.actions}
          </Link>
          <Link
            href="/tools/self-compassion/brief"
            className="flex min-h-12 items-center justify-center rounded-xl text-sm text-primary"
          >
            {copy.short}
          </Link>
        </div>
      </div>
    </div>
  );
}
