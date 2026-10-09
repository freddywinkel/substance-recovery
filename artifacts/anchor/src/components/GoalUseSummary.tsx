import type { GoalProgress } from "@/lib/analytics";

export function GoalUseSummary({
  progress,
  language,
}: {
  progress: GoalProgress;
  language: "nl" | "en";
}) {
  const nl = language === "nl";
  const moments = progress.confirmedUseEpisodes - progress.coveredUseEpisodes;
  return (
    <div className="mt-2 space-y-1 text-sm text-muted-foreground">
      <p className="font-medium text-foreground">
        {nl ? "Vastgelegd gebruik" : "Recorded use"}: {progress.totalUseRecords}
      </p>
      <p>
        {nl
          ? `${moments} losse momenten + ${progress.recordedUsePeriods} achteraf vastgelegde perioden`
          : `${moments} individual events + ${progress.recordedUsePeriods} retrospective periods`}
      </p>
      {progress.coveredUseEpisodes > 0 && (
        <p className="text-xs">
          {nl
            ? `${progress.coveredUseEpisodes} eerder vastgelegde momenten vallen binnen deze perioden en tellen niet dubbel.`
            : `${progress.coveredUseEpisodes} previously recorded events fall within these periods and are not counted twice.`}
        </p>
      )}
      <p>
        {nl ? "Gemelde gebruiksdagen" : "Reported use days"}:{" "}
        {progress.useDaysAreMinimum ? (nl ? "Minstens " : "At least ") : ""}
        {progress.reportedUseDays}
      </p>
      {progress.lastRecordedUseDate && (
        <>
          <p>
            {nl ? "Laatste gemelde gebruiksdag" : "Last reported use day"}:{" "}
            <time dateTime={progress.lastRecordedUseDate}>
              {new Date(
                `${progress.lastRecordedUseDate}T12:00:00`,
              ).toLocaleDateString(nl ? "nl-NL" : "en-GB")}
            </time>
          </p>
          <p>
            {nl ? "Dagen sinds die datum" : "Days since that date"}:{" "}
            {progress.daysSinceLastRecordedUse}
          </p>
        </>
      )}
      <p>
        {nl ? "Expliciet geen gebruik gemeld" : "Explicit no-use observations"}:{" "}
        {progress.explicitNotUsedObservations}
      </p>
      <p>
        {nl ? "Uitkomst niet vastgesteld" : "Outcome not established"}:{" "}
        {progress.unknownOutcomeObservations}
      </p>
    </div>
  );
}
