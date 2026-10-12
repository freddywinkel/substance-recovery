import { Link } from "wouter";
import { Moon, Plus } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRecoveryFeatures } from "@/contexts/RecoveryFeaturesContext";
import { localBalanceDate } from "@/lib/dailyBalance";

export function DailyBalanceHomeCard() {
  const { language } = useLanguage();
  const nl = language === "nl";
  const { dailyBalances, balanceMoments } = useRecoveryFeatures();
  const today = localBalanceDate();
  const saved = dailyBalances.some((record) => record.date === today);
  const moments = balanceMoments.filter((record) => record.date === today);
  return (
    <section className="rounded-3xl border border-border bg-card/70 p-5">
      <div className="flex items-start gap-3">
        <Moon
          size={22}
          className="mt-1 shrink-0 text-primary"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <h2 className="font-semibold">
            {nl ? "Dagelijkse check-in" : "Daily check-in"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {saved
              ? nl
                ? "Je dag is opgeslagen. Aanvullen kan altijd."
                : "Your day is saved. You can add to it anytime."
              : nl
                ? "Even stilstaan bij je stemming, slaap en dag."
                : "A moment for your mood, sleep and day."}
          </p>
          {moments.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {nl
                ? `${moments.length} activiteitsmomenten vandaag`
                : `${moments.length} activity moments today`}
            </p>
          )}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/daily"
          className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          {nl ? "Naar mijn dag" : "Go to my day"}
        </Link>
        <Link
          href="/daily/moments/new"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm"
        >
          <Plus size={16} aria-hidden="true" />
          {nl ? "Activiteitsmoment" : "Activity moment"}
        </Link>
      </div>
    </section>
  );
}
