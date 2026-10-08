import { Link } from "wouter";
import { Heart, Sprout } from "lucide-react";
import { useT } from "@/hooks/useTranslation";
import { useRecoveryFeatures } from "@/contexts/RecoveryFeaturesContext";
import { growthReminder } from "@/lib/personalGrowth";
import { GROWTH_COPY } from "@/lib/growthCopy";

export function GrowthHomeCard() {
  const { language } = useT();
  const copy = GROWTH_COPY[language];
  const { records, loading, loadError, refresh } = useRecoveryFeatures();
  const reminder = growthReminder(records);
  return (
    <section
      aria-labelledby="growth-home-title"
      className="rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card p-5"
    >
      <div className="flex items-start gap-3">
        <Sprout
          size={25}
          className="mt-1 shrink-0 text-primary"
          aria-hidden="true"
        />
        <div>
          <h2 id="growth-home-title" className="text-lg font-semibold">
            {copy.homeTitle}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {copy.homeIntro}
          </p>
        </div>
      </div>
      {loadError ? (
        <p role="alert" className="mt-4 text-sm">
          {copy.loadError}{" "}
          <button onClick={() => void refresh()} className="min-h-12 underline">
            {copy.retry}
          </button>
        </p>
      ) : loading ? (
        <p role="status" className="mt-4 text-sm">
          {copy.loading}
        </p>
      ) : reminder ? (
        <div className="mt-4 rounded-2xl border border-border/60 bg-background/60 p-4">
          <p className="text-xs text-muted-foreground">{copy.chosen}</p>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed line-clamp-4">
            {reminder.note}
          </p>
        </div>
      ) : (
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          {copy.homeEmpty}
        </p>
      )}
      <div className="mt-4 flex flex-col gap-2">
        <Link
          href="/moments/new"
          className="flex min-h-12 items-center justify-center rounded-2xl bg-primary px-4 py-3 text-center text-sm font-semibold text-primary-foreground"
        >
          {copy.add}
        </Link>
        <Link
          href="/growth?favourites=1"
          className="flex min-h-12 items-center justify-center rounded-2xl border border-border bg-card/70 px-4 py-3 text-center text-sm font-medium"
        >
          {copy.recall}
        </Link>
        <Link
          href="/tools/self-compassion/brief"
          className="flex min-h-12 items-center justify-center gap-2 rounded-2xl px-3 py-2 text-center text-sm text-primary"
        >
          <Heart size={17} aria-hidden="true" />
          {copy.short}
        </Link>
        <Link
          href="/actions"
          className="flex min-h-12 items-center justify-center text-sm text-muted-foreground underline underline-offset-4"
        >
          {copy.actions}
        </Link>
      </div>
    </section>
  );
}
