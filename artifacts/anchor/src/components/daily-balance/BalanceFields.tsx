import { useId } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { BALANCE_COPY } from "@/lib/dailyBalanceCopy";
import type { BalanceRatings } from "@/lib/dailyBalance";

export const balanceInputClass =
  "mt-2 min-h-12 w-full rounded-xl border border-input bg-card px-3 py-2 text-base text-foreground";
export const balanceButtonClass =
  "min-h-12 rounded-2xl border border-border px-4 py-3 text-sm font-medium transition-colors hover:bg-muted/50 disabled:opacity-50";
export const balancePrimaryClass =
  "min-h-12 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50";

export function RatingChoices({
  label,
  value,
  values,
  labels,
  onChange,
}: {
  label: string;
  value: number | null;
  values: readonly number[];
  labels?: readonly string[];
  onChange: (value: number | null) => void;
}) {
  const { language } = useLanguage();
  const c = BALANCE_COPY[language];
  return (
    <fieldset className="min-w-0">
      <legend className="text-sm font-semibold">{label}</legend>
      <div
        className={`mt-3 grid gap-1.5 ${values.length > 6 ? "grid-cols-6" : labels?.some((label) => label.length > 15) ? (values.length === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-5") : values.length === 4 ? "grid-cols-4" : "grid-cols-5"}`}
      >
        {values.map((score, index) => (
          <button
            type="button"
            key={score}
            aria-pressed={value === score}
            onClick={() => onChange(value === score ? null : score)}
            className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl border px-1 py-3 text-xs leading-snug ${value === score ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-muted/40"}`}
          >
            <span className="text-base font-semibold tabular-nums">
              {score > 0 && values[0] < 0 ? `+${score}` : score}
            </span>
            {labels && <span className="break-words">{labels[index]}</span>}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange(null)}
        className="mt-1 min-h-11 text-xs text-muted-foreground underline underline-offset-4"
      >
        {value === null ? c.unknown : c.clear}
      </button>
    </fieldset>
  );
}

export function BalanceRatingsFields({
  value,
  onChange,
  cravingScale = 10,
}: {
  value: BalanceRatings;
  onChange: (value: BalanceRatings) => void;
  cravingScale?: 3 | 10;
}) {
  const { language } = useLanguage();
  const c = BALANCE_COPY[language];
  const id = useId();
  return (
    <div className="space-y-5">
      <RatingChoices
        label={c.mood}
        value={value.mood}
        values={[-2, -1, 0, 1, 2]}
        labels={c.moodLabels}
        onChange={(mood) => onChange({ ...value, mood })}
      />
      <fieldset className="rounded-2xl bg-muted/25 p-4">
        <legend className="px-1 text-sm font-semibold">{c.eis}</legend>
        <p
          id={`${id}-hint`}
          className="text-xs leading-relaxed text-muted-foreground"
        >
          {c.eisHint}
        </p>
        <div className="mt-3 flex items-center gap-4">
          <input
            id={`${id}-eis`}
            aria-label={c.eis}
            aria-describedby={`${id}-hint`}
            inputMode="numeric"
            type="number"
            min={0}
            max={100}
            step={1}
            value={value.emotionalIntensity ?? ""}
            placeholder="—"
            className="min-h-12 w-24 rounded-xl border border-input bg-card px-3 text-center text-lg font-semibold tabular-nums"
            onChange={(event) => {
              const raw = event.target.value;
              if (raw === "") onChange({ ...value, emotionalIntensity: null });
              else {
                const n = Number(raw);
                if (Number.isInteger(n) && n >= 0 && n <= 100)
                  onChange({ ...value, emotionalIntensity: n });
              }
            }}
          />
          <span className="text-sm text-muted-foreground">/ 100</span>
          <button
            type="button"
            className="ml-auto min-h-11 px-2 text-xs underline"
            onClick={() => onChange({ ...value, emotionalIntensity: null })}
          >
            {c.clear}
          </button>
        </div>
        <div className="mt-3 grid grid-cols-5 gap-1.5">
          {[0, 25, 50, 75, 100].map((score) => (
            <button
              key={score}
              type="button"
              aria-label={`${c.intensityShort} ${score}`}
              aria-pressed={value.emotionalIntensity === score}
              className={`min-h-11 rounded-lg border text-sm tabular-nums ${value.emotionalIntensity === score ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}
              onClick={() => onChange({ ...value, emotionalIntensity: score })}
            >
              {score}
            </button>
          ))}
        </div>
        <div className="mt-2 flex justify-between gap-4 text-xs leading-relaxed text-muted-foreground">
          <span>{c.eisLow}</span>
          <span className="text-right">{c.eisHigh}</span>
        </div>
      </fieldset>
      <div>
        <RatingChoices
          label={cravingScale === 3 ? c.scale3 : c.craving}
          labels={cravingScale === 3 ? c.importedCravingLabels : undefined}
          value={value.craving}
          values={
            cravingScale === 3
              ? [0, 1, 2, 3]
              : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
          }
          onChange={(craving) => onChange({ ...value, craving })}
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          {cravingScale === 3 ? c.importedScale : c.cravingHint}
        </p>
      </div>
    </div>
  );
}

export function formatBalanceDate(date: string, language: "en" | "nl") {
  return new Intl.DateTimeFormat(language === "nl" ? "nl-NL" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

export function sleepText(minutes: number | null): string {
  return minutes === null
    ? "—"
    : `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}

export function RatingsComparison({
  before,
  after,
}: {
  before: BalanceRatings;
  after: BalanceRatings | null;
}) {
  const { language } = useLanguage();
  const c = BALANCE_COPY[language];
  const rows = [
    { label: c.mood, key: "mood" as const, max: "−2…+2" },
    {
      label: c.intensityShort,
      key: "emotionalIntensity" as const,
      max: "0–100",
    },
    { label: c.craving, key: "craving" as const, max: "0–10" },
  ];
  return (
    <table className="w-full text-left text-sm">
      <caption className="sr-only">{c.comparison}</caption>
      <thead>
        <tr className="text-xs text-muted-foreground">
          <th scope="col" className="pb-2 font-normal">
            {c.comparison}
          </th>
          <th scope="col" className="pb-2 text-right font-normal">
            {c.before}
          </th>
          <th scope="col" className="pb-2 text-right font-normal">
            {c.after}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key} className="border-t border-border/60">
            <th scope="row" className="py-2 font-medium">
              {row.label}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                {row.max}
              </span>
            </th>
            <td className="py-2 text-right tabular-nums">
              {before[row.key] ?? <span aria-label={c.noData}>—</span>}
            </td>
            <td className="py-2 text-right tabular-nums">
              {after?.[row.key] ?? <span aria-label={c.noData}>—</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
