import { Link } from "wouter";
import { useStore } from "@/hooks/useStore";
import { useRecoveryFeatures } from "@/contexts/RecoveryFeaturesContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { computeGoalProgress, computeSobrietyStats } from "@/lib/analytics";
import { normalizePreventionPlan } from "@/lib/preventionPlan";
import { recoveryTargetLabel } from "@/lib/recoveryTargets";

export function GoalProgressHome() {
  const {
    cravingLogs,
    relapseLogs,
    cigaretteLogs,
    sobrietyStartDate,
    loadError,
    loading,
  } = useStore();
  const {
    recoveryPlan,
    quickRegistrations,
    loadError: planError,
    loading: planLoading,
  } = useRecoveryFeatures();
  const { language } = useLanguage();
  const nl = language === "nl";
  if (loadError || planError)
    return (
      <section
        role="alert"
        className="rounded-3xl border border-border p-5 text-sm"
      >
        {nl
          ? "Je doelen en voortgang konden niet volledig worden gelezen. Probeer het opnieuw via de gegevensmelding."
          : "Your goals and progress could not be read completely. Retry using the data notice."}
      </section>
    );
  if (loading || planLoading)
    return (
      <p role="status" className="p-5 text-sm">
        {nl ? "Voortgang laden…" : "Loading progress…"}
      </p>
    );
  const goals = normalizePreventionPlan(recoveryPlan.prevention).goals;
  const progress = computeGoalProgress(
    goals.filter((goal) => goal.active && goal.showProgress),
    { cravingLogs, relapseLogs, cigaretteLogs, quickRegistrations },
  );
  const journey = computeSobrietyStats(sobrietyStartDate, []);
  return (
    <section
      className="rounded-3xl border border-border bg-card/75 p-5"
      aria-label={nl ? "Mijn doelen en traject" : "My goals and journey"}
    >
      <h2 className="font-semibold">
        {nl ? "Mijn doelen en traject" : "My goals and journey"}
      </h2>
      {journey && (
        <p className="mt-2 text-sm text-muted-foreground">
          <strong className="text-foreground">{journey.totalDays}</strong>{" "}
          {nl
            ? "dagen sinds de gekozen trajectstart"
            : "days since your chosen journey start"}
        </p>
      )}
      {progress.length === 0 ? (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {nl
            ? "Je kiest zelf of je voortgang per doel wilt tonen. Een gebruiksmoment wist je eerdere inzet niet."
            : "You choose whether to display progress for each goal. A use event does not erase your earlier effort."}
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {progress.map((item) => (
            <div key={item.goal.id} className="border-t border-border pt-3">
              <h3 className="font-medium text-sm">
                {recoveryTargetLabel(item.goal.target, language)}
              </h3>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm">
                {item.goal.description}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {nl ? "Vastgelegde gebruiksmomenten" : "Recorded use events"}:{" "}
                {item.confirmedUseEpisodes}
              </p>
              <p className="text-sm text-muted-foreground">
                {nl
                  ? "Expliciet geen gebruik gemeld"
                  : "Explicit no-use observations"}
                : {item.explicitNotUsedObservations}
              </p>
              <p className="text-sm text-muted-foreground">
                {nl ? "Uitkomst niet vastgesteld" : "Outcome not established"}:{" "}
                {item.unknownOutcomeObservations}
              </p>
            </div>
          ))}
        </div>
      )}
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        {nl
          ? "Dit beschrijft je registraties. Een dag zonder invoer telt niet als bewezen abstinentie."
          : "This describes your entries. A day without an entry is not confirmed abstinence."}
      </p>
      <Link
        href="/recovery-plan"
        className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-primary underline"
      >
        {nl ? "Doelen en plan aanpassen" : "Edit goals and plan"}
      </Link>
    </section>
  );
}
