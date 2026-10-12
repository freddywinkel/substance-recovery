import { Link } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRecoveryFeatures } from "@/contexts/RecoveryFeaturesContext";
import { BALANCE_COPY } from "@/lib/dailyBalanceCopy";
import { localBalanceDate } from "@/lib/dailyBalance";
import { sleepText } from "./BalanceFields";

/** Daily summaries retain their scale; no interpolation or mixed-scale averages. */
export function DailyBalanceInsights({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { language } = useLanguage();
  const c = BALANCE_COPY[language];
  const { dailyBalances, balanceMoments } = useRecoveryFeatures();
  const today = localBalanceDate();
  const dates = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(`${today}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() - (13 - index));
    return date.toISOString().slice(0, 10);
  });
  const count = dailyBalances.filter((item) =>
    dates.includes(item.date),
  ).length;
  return (
    <section className="rounded-3xl border border-border bg-card/70 p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">
          {compact ? c.title : c.period}
        </h2>
        <p className="text-xs text-muted-foreground">
          {count}/14 {c.daysFilled}
        </p>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {c.patternsIntro}
      </p>
      {compact ? (
        <Link
          className="mt-3 flex min-h-12 items-center text-sm font-medium text-primary underline"
          href="/daily?view=trends"
        >
          {c.trends}
        </Link>
      ) : (
        <>
          <div
            className="mt-4 overflow-x-auto rounded-xl border border-border"
            tabIndex={0}
            role="region"
            aria-label={c.period}
          >
            <table className="w-full min-w-[520px] text-left text-xs">
              <caption className="sr-only">
                {c.period}. {c.noData}: —. {c.importedScale}
              </caption>
              <thead className="bg-muted/50">
                <tr>
                  <th scope="col" className="px-3 py-3">
                    {c.day}
                  </th>
                  <th scope="col" className="px-2 py-3">
                    {c.mood}
                    <span className="block font-normal">−2…+2</span>
                  </th>
                  <th scope="col" className="px-2 py-3">
                    {c.intensityShort}
                    <span className="block font-normal">0–100</span>
                  </th>
                  <th scope="col" className="px-2 py-3">
                    {c.craving}
                    <span className="block font-normal">0–10 / 0–3</span>
                  </th>
                  <th scope="col" className="px-2 py-3">
                    {c.sleepShort}
                  </th>
                  <th scope="col" className="px-2 py-3">
                    {c.moments}
                  </th>
                </tr>
              </thead>
              <tbody>
                {dates.map((date) => {
                  const day = dailyBalances.find((item) => item.date === date);
                  const moments = balanceMoments.filter(
                    (item) => item.date === date,
                  ).length;
                  return (
                    <tr key={date} className="border-t border-border/60">
                      <th scope="row" className="px-3 py-3 font-medium">
                        <Link
                          href={`/daily?date=${date}`}
                          className="inline-flex min-h-11 items-center underline underline-offset-4"
                        >
                          {date}
                        </Link>
                      </th>
                      <td className="px-2 tabular-nums">{day?.mood ?? "—"}</td>
                      <td className="px-2 tabular-nums">
                        {day?.emotionalIntensity ?? "—"}
                      </td>
                      <td className="px-2 tabular-nums">
                        {day?.craving == null
                          ? "—"
                          : `${day.craving}/${day.cravingScale}`}
                      </td>
                      <td className="px-2 tabular-nums">
                        {day &&
                        day.mainSleep !== null &&
                        day.additionalSleep !== null
                          ? sleepText(day.mainSleep + day.additionalSleep)
                          : "—"}
                      </td>
                      <td className="px-2 tabular-nums">{moments || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            — {c.noData}. {c.importedScale}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {c.noClinical}
          </p>
        </>
      )}
    </section>
  );
}
