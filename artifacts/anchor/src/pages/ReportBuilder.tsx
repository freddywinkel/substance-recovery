import { useMemo, useState } from "react";
import { FileText, LockKeyhole, Printer } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useRecoveryFeatures } from "@/contexts/RecoveryFeaturesContext";
import { useStore } from "@/hooks/useStore";
import { useT } from "@/hooks/useTranslation";
import {
  REPORT_FIELD_IDS,
  buildLocalDateRange,
  buildReviewRegistrations,
  buildSelectiveReport,
  type ReportFieldId,
  type ReportRegistrationField,
  type ReviewTextPart,
} from "@/lib/recoveryProgress";
import { recoveryToolLabel } from "@/lib/recoveryFeatures";

const COPY = {
  en: {
    title: "Printable report",
    subtitle: "Choose the period and exactly which information to include.",
    privacyTitle: "Local and under your control",
    privacy: "The report is prepared on this device. Nothing is uploaded or shared automatically. Your browser's print screen can print it or save it as a PDF.",
    period: "Date range",
    from: "From",
    through: "Through",
    fields: "Information to include",
    fieldHint: "Unticked information is left out of the printable report.",
    preview: "Recovery summary",
    created: "Prepared",
    reportPeriod: "Period",
    noRows: "No registrations were found in this date range.",
    noFields: "Select at least one item before printing.",
    invalidRange: "Choose a valid From and Through date before previewing or printing.",
    print: "Print or save as PDF",
    localOnly: "No automatic sharing",
    registrations: "Registrations",
    supportive: "Supportive actions",
    supportiveEmpty: "No supportive actions were recorded in this date range.",
    registrationCount: "Registrations in range",
    actionCount: "Supportive actions in range",
    noValue: "Not recorded",
    loading: "Loading…",
    fieldsMap: {
      summary: "Summary totals (registration and supportive-action counts)",
      date: "Registration date and time",
      source: "Quick or detailed registration",
      type: "Registration type",
      intensity: "Intensity",
      "immediate-safety": "Immediate-safety answer",
      context: "Situation or context",
      "chosen-action": "Chosen action",
      notes: "Registration notes",
      "supportive-date": "Supportive-action date and time",
      "supportive-category": "Supportive-action category",
      "supportive-description": "Supportive-action description",
      "supportive-notes": "Supportive-action notes",
    },
    columns: {
      date: "Date and time",
      source: "Source",
      type: "Type",
      intensity: "Intensity",
      "immediate-safety": "Safety answer",
      context: "Situation or context",
      "chosen-action": "Chosen action",
      notes: "Notes",
    },
    types: {
      trek: "Trek",
      craving: "Craving",
      boredom: "Boredom",
      anxiety: "Anxiety",
      relapse: "Return to use",
    },
    actionTypes: {
      contact: "Contact",
      care: "Care",
      tool: "Coping tool",
      goal: "Goal",
    },
    safety: {
      "safe-for-now": "Safe for now",
      "need-support": "Needs support now",
      "urgent-danger": "Urgent danger reported",
    },
    sources: { quick: "Quick", detailed: "Detailed", linked: "Quick + detailed" },
  },
  nl: {
    title: "Afdrukbaar verslag",
    subtitle: "Kies de periode en precies welke informatie je opneemt.",
    privacyTitle: "Lokaal en onder jouw controle",
    privacy: "Het verslag wordt op dit apparaat samengesteld. Niets wordt automatisch geüpload of gedeeld. Via het afdrukscherm van je browser kun je het afdrukken of als pdf bewaren.",
    period: "Datumbereik",
    from: "Van",
    through: "Tot en met",
    fields: "Informatie om op te nemen",
    fieldHint: "Niet-aangevinkte informatie wordt uit het afdrukbare verslag weggelaten.",
    preview: "Hersteloverzicht",
    created: "Samengesteld",
    reportPeriod: "Periode",
    noRows: "In dit datumbereik zijn geen registraties gevonden.",
    noFields: "Selecteer ten minste één onderdeel voordat je afdrukt.",
    invalidRange: "Kies geldige datums bij Van en Tot en met voordat je een voorbeeld maakt of afdrukt.",
    print: "Afdrukken of als pdf bewaren",
    localOnly: "Geen automatische deling",
    registrations: "Registraties",
    supportive: "Ondersteunende acties",
    supportiveEmpty: "In dit datumbereik zijn geen ondersteunende acties vastgelegd.",
    registrationCount: "Registraties in periode",
    actionCount: "Ondersteunende acties in periode",
    noValue: "Niet vastgelegd",
    loading: "Laden…",
    fieldsMap: {
      summary: "Samenvattende aantallen (registraties en ondersteunende acties)",
      date: "Datum en tijd van registratie",
      source: "Snelle of uitgebreide registratie",
      type: "Registratietype",
      intensity: "Intensiteit",
      "immediate-safety": "Antwoord over directe veiligheid",
      context: "Situatie of context",
      "chosen-action": "Gekozen actie",
      notes: "Notities bij registraties",
      "supportive-date": "Datum en tijd van ondersteunende actie",
      "supportive-category": "Categorie van ondersteunende actie",
      "supportive-description": "Beschrijving van ondersteunende actie",
      "supportive-notes": "Notitie bij ondersteunende actie",
    },
    columns: {
      date: "Datum en tijd",
      source: "Bron",
      type: "Type",
      intensity: "Intensiteit",
      "immediate-safety": "Veiligheidsantwoord",
      context: "Situatie of context",
      "chosen-action": "Gekozen actie",
      notes: "Notities",
    },
    types: {
      trek: "Trek",
      craving: "Craving",
      boredom: "Verveling",
      anxiety: "Angst",
      relapse: "Terugkeer naar gebruik",
    },
    actionTypes: {
      contact: "Contact",
      care: "Zorg",
      tool: "Copingtool",
      goal: "Doel",
    },
    safety: {
      "safe-for-now": "Voor nu veilig",
      "need-support": "Nu steun nodig",
      "urgent-danger": "Acuut gevaar aangegeven",
    },
    sources: { quick: "Snel", detailed: "Uitgebreid", linked: "Snel + uitgebreid" },
  },
} as const;

const REGISTRATION_FIELDS: ReportRegistrationField[] = [
  "date",
  "source",
  "type",
  "intensity",
  "immediate-safety",
  "context",
  "chosen-action",
  "notes",
];

function toDateInput(timestamp: number): string {
  const date = new Date(timestamp);
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function ReportBuilder() {
  const { language, tOpt } = useT();
  const copy = COPY[language];
  const locale = language === "nl" ? "nl-NL" : "en-GB";
  const store = useStore();
  const { loading: featureLoading, quickRegistrations, recoveryActions, toolFollowUps } = useRecoveryFeatures();
  const today = useMemo(() => new Date(), []);
  const monthAgo = useMemo(() => {
    const value = new Date(today);
    value.setDate(value.getDate() - 29);
    return value;
  }, [today]);
  const [from, setFrom] = useState(toDateInput(monthAgo.getTime()));
  const [through, setThrough] = useState(toDateInput(today.getTime()));
  const [fields, setFields] = useState<ReportFieldId[]>([
    "summary",
    "date",
    "source",
    "type",
    "intensity",
    "immediate-safety",
    "context",
    "chosen-action",
    "supportive-date",
    "supportive-category",
    "supportive-description",
  ]);

  const registrations = useMemo(
    () => buildReviewRegistrations({
      cravingLogs: store.cravingLogs,
      relapseLogs: store.relapseLogs,
      anxietyLogs: store.anxietyLogs,
      boredomLogs: store.boredomLogs,
      quickRegistrations,
    }),
    [
      quickRegistrations,
      store.anxietyLogs,
      store.boredomLogs,
      store.cravingLogs,
      store.relapseLogs,
    ],
  );
  const range = useMemo(() => buildLocalDateRange(from, through), [from, through]);
  const effectiveRange = range ?? { start: 0, endExclusive: 0 };
  const report = useMemo(
    () => buildSelectiveReport({ registrations, recoveryActions, range: effectiveRange, fields }),
    [effectiveRange.endExclusive, effectiveRange.start, fields, recoveryActions, registrations],
  );
  const selectedColumns = REGISTRATION_FIELDS.filter((field) => fields.includes(field));
  const hasSupportiveFields = fields.some((field) => field.startsWith("supportive-"));
  const formatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }),
    [locale],
  );

  const toggleField = (field: ReportFieldId) => {
    setFields((current) =>
      current.includes(field)
        ? current.filter((item) => item !== field)
        : [...current, field],
    );
  };

  const valueFor = (
    field: ReportRegistrationField,
    value: string | number | null | ReviewTextPart[] | undefined,
  ): string => {
    if (Array.isArray(value)) {
      if (value.length === 0) return copy.noValue;
      return value
        .map((part) => part.kind === "option" ? tOpt(part.value) : part.value)
        .join(" · ");
    }
    if (value === null || value === undefined || value === "") return copy.noValue;
    if (field === "date" && typeof value === "number") return formatter.format(value);
    if (field === "type" && typeof value === "string" && value in copy.types) {
      return copy.types[value as keyof typeof copy.types];
    }
    if (field === "source" && typeof value === "string" && value in copy.sources) {
      return copy.sources[value as keyof typeof copy.sources];
    }
    if (field === "immediate-safety" && typeof value === "string" && value in copy.safety) {
      return copy.safety[value as keyof typeof copy.safety];
    }
    if (field === "chosen-action" && typeof value === "string") return tOpt(value);
    // Context and notes may be the person's own words. Preserve them exactly;
    // generic option humanisation can otherwise alter hyphenated free text.
    return String(value);
  };

  if (store.loading || featureLoading) {
    return (
      <div role="status" className="flex min-h-dvh items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="sr-only">{copy.loading}</span>
      </div>
    );
  }

  const dateOnlyFormatter = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const printDisabled = fields.length === 0 || range === null;

  return (
    <div className="report-page flex h-full min-h-0 flex-col">
      <div className="report-controls">
        <PageHeader title={copy.title} subtitle={copy.subtitle} back />
      </div>
      <main className="flex-1 overflow-y-auto scroll-smooth-ios px-4 pb-safe pt-3">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 pb-8">
          <section className="report-controls rounded-[1.5rem] border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <LockKeyhole size={20} strokeWidth={1.8} />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-foreground">{copy.privacyTitle}</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{copy.privacy}</p>
              </div>
            </div>
          </section>

          <section className="report-controls rounded-[1.5rem] border border-border/70 bg-card p-4" aria-labelledby="report-period-title">
            <h2 id="report-period-title" className="text-base font-semibold text-foreground">{copy.period}</h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="text-sm font-medium text-foreground">
                {copy.from}
                <input
                  type="date"
                  value={from}
                  max={through}
                  required
                  onChange={(event) => setFrom(event.target.value)}
                  className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-3 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                />
              </label>
              <label className="text-sm font-medium text-foreground">
                {copy.through}
                <input
                  type="date"
                  value={through}
                  min={from}
                  required
                  onChange={(event) => setThrough(event.target.value)}
                  className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-3 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                />
              </label>
            </div>
          </section>

          <section className="report-controls rounded-[1.5rem] border border-border/70 bg-card p-4" aria-labelledby="report-fields-title">
            <h2 id="report-fields-title" className="text-base font-semibold text-foreground">{copy.fields}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{copy.fieldHint}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {REPORT_FIELD_IDS.map((field) => (
                <label key={field} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-border/70 bg-background px-3 py-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={fields.includes(field)}
                    onChange={() => toggleField(field)}
                    className="h-4 w-4 shrink-0 accent-primary"
                  />
                  <span>{copy.fieldsMap[field]}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="print-root rounded-[1.5rem] border border-border/70 bg-card p-4 sm:p-6" aria-labelledby="report-preview-title">
            <header className="border-b border-border pb-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="print-kicker text-xs font-medium uppercase tracking-[0.15em] text-primary">Anchor · Substance Recovery</p>
                  <h1 id="report-preview-title" className="mt-1 text-2xl font-semibold text-foreground">{copy.preview}</h1>
                </div>
                <FileText className="text-muted-foreground" size={28} strokeWidth={1.5} aria-hidden="true" />
              </div>
              <dl className="mt-4 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
                <div><dt className="inline font-medium text-foreground">{copy.reportPeriod}: </dt><dd className="inline">{range ? `${dateOnlyFormatter.format(range.start)} – ${dateOnlyFormatter.format(range.endExclusive - 1)}` : copy.invalidRange}</dd></div>
                <div><dt className="inline font-medium text-foreground">{copy.created}: </dt><dd className="inline">{dateOnlyFormatter.format(Date.now())}</dd></div>
              </dl>
            </header>

            {!range && <p role="alert" className="mt-5 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{copy.invalidRange}</p>}

            {fields.length === 0 && (
              <p className="mt-5 rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">{copy.noFields}</p>
            )}

            {range && report.summary && (
              <section className="mt-5 grid grid-cols-2 gap-3" aria-label={copy.fieldsMap.summary}>
                <div className="rounded-xl border border-border p-3">
                  <p className="text-2xl font-semibold tabular-nums text-foreground">{report.summary.registrationCount}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{copy.registrationCount}</p>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <p className="text-2xl font-semibold tabular-nums text-foreground">{report.summary.supportiveActionCount}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{copy.actionCount}</p>
                </div>
              </section>
            )}

            {range && selectedColumns.length > 0 && (
              <section className="mt-6" aria-labelledby="report-registrations-title">
                <h2 id="report-registrations-title" className="text-lg font-semibold text-foreground">{copy.registrations}</h2>
                {report.registrations.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">{copy.noRows}</p>
                ) : (
                  <>
                    <ol className="report-mobile-rows mt-3 grid gap-2 sm:hidden">
                      {report.registrations.map((row) => (
                        <li key={row.id} className="rounded-xl border border-border p-3">
                          <dl className="grid gap-2">
                            {selectedColumns.map((field) => (
                              <div key={field}>
                                <dt className="text-xs font-semibold text-foreground">{copy.columns[field]}</dt>
                                <dd className="mt-0.5 whitespace-pre-wrap text-sm leading-5 text-muted-foreground">{valueFor(field, row.values[field])}</dd>
                              </div>
                            ))}
                          </dl>
                        </li>
                      ))}
                    </ol>
                    <div className="report-table mt-3 hidden sm:block">
                      <table className="w-full border-collapse text-left text-xs">
                        <thead>
                          <tr className="border-b-2 border-border">
                            {selectedColumns.map((field) => (
                              <th key={field} scope="col" className="px-2 py-2 font-semibold text-foreground">{copy.columns[field]}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {report.registrations.map((row) => (
                            <tr key={row.id} className="break-inside-avoid border-b border-border/70 align-top">
                              {selectedColumns.map((field) => (
                                <td key={field} className="max-w-56 whitespace-pre-wrap px-2 py-2.5 leading-5 text-muted-foreground">
                                  {valueFor(field, row.values[field])}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </section>
            )}

            {range && hasSupportiveFields && (
              <section className="mt-6" aria-labelledby="report-supportive-title">
                <h2 id="report-supportive-title" className="text-lg font-semibold text-foreground">{copy.supportive}</h2>
                {report.supportiveActions.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">{copy.supportiveEmpty}</p>
                ) : (
                  <ol className="mt-3 grid gap-2">
                    {report.supportiveActions.map((action) => {
                      const sourceFollowUp = action.sourceId
                        ? toolFollowUps.find((followUp) => followUp.id === action.sourceId)
                        : undefined;
                      const storedDescription = action.values["supportive-description"];
                      const currentLabel = action.actionType === "tool" && sourceFollowUp
                        ? recoveryToolLabel(sourceFollowUp.toolId, language)
                        : typeof storedDescription === "string" ? storedDescription : "";
                      const supportiveDate = action.values["supportive-date"];
                      const supportiveNote = action.values["supportive-notes"];
                      return (
                        <li key={action.id} className="break-inside-avoid rounded-xl border border-border p-3">
                          <dl className="grid gap-2 text-sm">
                            {typeof supportiveDate === "number" && (
                              <div><dt className="text-xs font-semibold text-foreground">{copy.fieldsMap["supportive-date"]}</dt><dd className="mt-0.5 text-muted-foreground"><time dateTime={new Date(supportiveDate).toISOString()}>{formatter.format(supportiveDate)}</time></dd></div>
                            )}
                            {Object.prototype.hasOwnProperty.call(action.values, "supportive-category") && (
                              <div><dt className="text-xs font-semibold text-foreground">{copy.fieldsMap["supportive-category"]}</dt><dd className="mt-0.5 text-muted-foreground">{copy.actionTypes[action.actionType]}</dd></div>
                            )}
                            {Object.prototype.hasOwnProperty.call(action.values, "supportive-description") && (
                              <div><dt className="text-xs font-semibold text-foreground">{copy.fieldsMap["supportive-description"]}</dt><dd className="mt-0.5 whitespace-pre-wrap text-muted-foreground">{currentLabel || copy.noValue}</dd></div>
                            )}
                            {Object.prototype.hasOwnProperty.call(action.values, "supportive-notes") && (
                              <div><dt className="text-xs font-semibold text-foreground">{copy.fieldsMap["supportive-notes"]}</dt><dd className="mt-0.5 whitespace-pre-wrap text-muted-foreground">{supportiveNote || copy.noValue}</dd></div>
                            )}
                          </dl>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </section>
            )}
          </section>

          <div className="report-controls">
            <button
              type="button"
              disabled={printDisabled}
              onClick={() => window.print()}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <Printer size={19} strokeWidth={1.8} />
              {copy.print}
            </button>
            <p className="mt-2 text-center text-xs text-muted-foreground">{copy.localOnly}</p>
          </div>
        </div>
      </main>

      <style>{`
        @media print {
          @page { margin: 14mm; }
          body * { visibility: hidden !important; }
          .print-root, .print-root * { visibility: visible !important; }
          .print-root {
            position: absolute !important;
            inset: 0 auto auto 0 !important;
            width: 100% !important;
            border: 0 !important;
            border-radius: 0 !important;
            background: white !important;
            color: #111 !important;
            box-shadow: none !important;
          }
          .print-root * { color: #222 !important; border-color: #ccc !important; }
          .print-kicker { color: #9a5a00 !important; }
          .report-controls { display: none !important; }
          .report-mobile-rows { display: none !important; }
          .report-table { display: block !important; }
          .print-root table { min-width: 0 !important; font-size: 9pt !important; }
          .print-root h1 { font-size: 20pt !important; }
        }
      `}</style>
    </div>
  );
}
