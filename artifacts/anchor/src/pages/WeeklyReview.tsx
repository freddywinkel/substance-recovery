import { useMemo, useRef, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { CalendarDays, ChevronDown, ClipboardList, Save } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useRecoveryFeatures } from "@/contexts/RecoveryFeaturesContext";
import { useStore } from "@/hooks/useStore";
import { useT } from "@/hooks/useTranslation";
import type {
  RegistrationType,
  WeeklyReviewRecord,
} from "@/lib/recoveryFeatures";
import {
  buildReviewRegistrations,
  buildWeeklyReviewSummary,
  getLocalWeekRange,
  formatSafetyObservations,
  formatIntensityObservations,
  type ReviewRegistration,
  type TimeOfDay,
  type WeeklyPattern,
} from "@/lib/recoveryProgress";
import { normalizePreventionPlan } from "@/lib/preventionPlan";
import { useLocalDraft } from "@/hooks/useLocalDraft";
import { DraftStatus } from "@/components/DraftStatus";
import { recoveryTargetLabel } from "@/lib/recoveryTargets";
import {
  isWeeklyReviewDraft,
  type WeeklyReviewDraft,
} from "@/lib/weeklyReviewDraft";
import {
  WEEKLY_GROWTH_COPY,
  WEEKLY_GROWTH_FIELDS,
} from "@/lib/weeklyGrowthCopy";
import { flushLocalDrafts } from "@/lib/localDrafts";
import { WeeklyReviewConflictError } from "@/db/weeklyReview";

const COPY = {
  en: {
    title: "Weekly review",
    subtitle: "Inspect what you recorded and make one plan for the next week.",
    current: "Current week",
    previous: "Previous week",
    period: "Review period",
    registrations: "registrations in this period",
    quick: "quick",
    detailed: "detailed",
    patterns: "Observed patterns",
    patternsIntro:
      "These descriptions only summarise what you recorded. They do not prove why something happened or whether an action works.",
    noData: "There are no completed or quick registrations in this week yet.",
    inspect: "Inspect matching registrations",
    noneMatching: "No matching registrations for this description.",
    allRegistrations: "Inspect all registrations in this period",
    intensity: "Intensity",
    note: "Note",
    noIntensity: "not recorded",
    choose: "Choose one observed pattern",
    plan: "One plan for the next week",
    planPlaceholder:
      "For example: If I notice this pattern, I will call my support person and open the breathing tool.",
    save: "Save weekly plan",
    saving: "Saving…",
    saved: "Weekly plan saved on this device.",
    saveError: "The weekly plan could not be saved. Please try again.",
    chooseError: "Choose one observed pattern.",
    planError: "Write a concrete plan for the next week.",
    priorPlan: "Saved plan for this review period",
    recorded: "Recorded",
    loading: "Loading…",
    denominator: "{count} of {total} registrations",
    answeredDenominator:
      "{count} of {total} registrations with an intensity answer",
    patternType: "{type} was among the most frequently recorded types",
    patternTime: "One of the largest shares was recorded in the {time}",
    patternIntensity: "An intensity from 7 to 10 was recorded",
    sourceQuick: "Quick registration",
    sourceDetailed: "Detailed registration",
    sourceLinked: "Quick + detailed reflection",
    safetyLabel: "Safety answer",
    safety: {
      "safe-for-now": "Safe for now",
      "need-support": "Support needed",
      "urgent-danger": "Immediate danger reported",
    },
    types: {
      trek: "Trek",
      craving: "Craving",
      boredom: "Boredom",
      anxiety: "Anxiety",
      relapse: "Return to use",
    },
    times: {
      morning: "morning",
      afternoon: "afternoon",
      evening: "evening",
      night: "night",
    },
  },
  nl: {
    title: "Weekoverzicht",
    subtitle: "Bekijk wat je vastlegde en maak één plan voor de volgende week.",
    current: "Huidige week",
    previous: "Vorige week",
    period: "Beoordeelde periode",
    registrations: "registraties in deze periode",
    quick: "snel",
    detailed: "uitgebreid",
    patterns: "Waargenomen patronen",
    patternsIntro:
      "Deze beschrijvingen vatten alleen samen wat je vastlegde. Ze bewijzen niet waarom iets gebeurde of dat een actie werkt.",
    noData: "Er zijn in deze week nog geen voltooide of snelle registraties.",
    inspect: "Bijbehorende registraties bekijken",
    noneMatching: "Geen bijbehorende registraties voor deze beschrijving.",
    allRegistrations: "Alle registraties in deze periode bekijken",
    intensity: "Intensiteit",
    note: "Notitie",
    noIntensity: "niet vastgelegd",
    choose: "Kies één waargenomen patroon",
    plan: "Eén plan voor de volgende week",
    planPlaceholder:
      "Bijvoorbeeld: als ik dit patroon opmerk, bel ik mijn steunpersoon en open ik de ademhalingstool.",
    save: "Weekplan opslaan",
    saving: "Opslaan…",
    saved: "Weekplan op dit apparaat opgeslagen.",
    saveError: "Het weekplan kon niet worden opgeslagen. Probeer het opnieuw.",
    chooseError: "Kies één waargenomen patroon.",
    planError: "Schrijf een concreet plan voor de volgende week.",
    priorPlan: "Opgeslagen plan voor deze beoordelingsperiode",
    recorded: "Vastgelegd",
    loading: "Laden…",
    denominator: "{count} van {total} registraties",
    answeredDenominator:
      "{count} van {total} registraties met een intensiteitsantwoord",
    patternType: "{type} hoorde bij de vaakst vastgelegde typen",
    patternTime: "Een van de grootste delen werd in de {time} vastgelegd",
    patternIntensity: "Een intensiteit van 7 tot en met 10 werd vastgelegd",
    sourceQuick: "Snelle registratie",
    sourceDetailed: "Uitgebreide registratie",
    sourceLinked: "Snelle + uitgebreide reflectie",
    safetyLabel: "Veiligheidsantwoord",
    safety: {
      "safe-for-now": "Voor nu veilig",
      "need-support": "Steun nodig",
      "urgent-danger": "Direct gevaar aangegeven",
    },
    types: {
      trek: "Trek",
      craving: "Craving",
      boredom: "Verveling",
      anxiety: "Angst",
      relapse: "Terugkeer naar gebruik",
    },
    times: {
      morning: "ochtend",
      afternoon: "middag",
      evening: "avond",
      night: "nacht",
    },
  },
} as const;

function replaceCounts(template: string, count: number, total: number): string {
  return template
    .replace("{count}", String(count))
    .replace("{total}", String(total));
}

function formatPeriod(
  start: number,
  endExclusive: number,
  locale: string,
): string {
  const formatter = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${formatter.format(start)} – ${formatter.format(endExclusive - 1)}`;
}

export function WeeklyReview() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [session, setSession] = useState(0);
  const [notice, setNotice] = useState("");
  const { loading } = useRecoveryFeatures();
  const store = useStore();
  const { language } = useT();
  if (loading || store.loading)
    return (
      <p role="status" className="p-5">
        {COPY[language].loading}
      </p>
    );
  return (
    <WeeklyReviewEditor
      key={`${weekOffset}:${session}`}
      weekOffset={weekOffset}
      setWeekOffset={(offset) => {
        setWeekOffset(offset);
        setNotice("");
      }}
      notice={notice}
      onDeleted={() => {
        setNotice(WEEKLY_GROWTH_COPY[language].removed);
        setSession((value) => value + 1);
      }}
    />
  );
}

function reviewDraft(record: WeeklyReviewRecord | null): WeeklyReviewDraft {
  return {
    recordId: record?.id ?? crypto.randomUUID(),
    timestamp: record?.timestamp ?? Date.now(),
    sourceUpdatedAt: record?.updatedAt ?? null,
    selectedPatternId:
      record?.patternKind === "registration-type"
        ? `type:${record.patternValue}`
        : record?.patternKind === "time-of-day"
          ? `time:${record.patternValue}`
          : record?.patternKind === "high-intensity"
            ? "intensity:7-10"
            : record?.chosenPattern
              ? "own"
              : "",
    nextWeekPlan: record?.nextWeekPlan ?? "",
    linkedGoalId: record?.linkedGoalId ?? "",
    ownObservation: record && !record.patternKind ? record.chosenPattern : "",
    rememberFromWeek: record?.rememberFromWeek ?? "",
    choseForMyself: record?.choseForMyself ?? "",
    makeRoomForNextWeek: record?.makeRoomForNextWeek ?? "",
    pleasantActivity: record?.pleasantActivity ?? "",
  };
}

function WeeklyReviewEditor({
  weekOffset,
  setWeekOffset,
  notice,
  onDeleted,
}: {
  weekOffset: number;
  setWeekOffset: (value: number) => void;
  notice: string;
  onDeleted: () => void;
}) {
  const { language, tOpt } = useT();
  const copy = COPY[language];
  const growthCopy = WEEKLY_GROWTH_COPY[language];
  const locale = language === "nl" ? "nl-NL" : "en-GB";
  const store = useStore();
  const {
    saveWeeklyReview,
    removeWeeklyReview,
    refresh,
    loading: featureLoading,
    quickRegistrations,
    weeklyReviews,
    recoveryPlan,
    loadError: featureError,
  } = useRecoveryFeatures();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const busy = useRef(false);
  const [confirmation, setConfirmation] = useState<
    "discard" | "remove" | "latest" | null
  >(null);
  const [conflict, setConflict] = useState(false);

  const allRegistrations = useMemo(
    () =>
      buildReviewRegistrations({
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
  const range = useMemo(
    () => getLocalWeekRange(Date.now(), weekOffset),
    [weekOffset],
  );
  const summary = useMemo(
    () => buildWeeklyReviewSummary(allRegistrations, range),
    [allRegistrations, range],
  );
  const savedReview = useMemo(
    () =>
      weeklyReviews.find(
        (review) =>
          review.periodStart === range.start &&
          review.periodEnd === range.endExclusive - 1,
      ) ?? null,
    [range, weeklyReviews],
  );

  const prevention = useMemo(
    () => normalizePreventionPlan(recoveryPlan.prevention),
    [recoveryPlan.prevention],
  );
  const [initialRecord] = useState(savedReview);
  const [initial] = useState(() => reviewDraft(savedReview));
  const draft = useLocalDraft(`weekly-review:${range.start}`, initial, {
    ready: !store.loading && !featureLoading,
    validate: isWeeklyReviewDraft,
  });
  const {
    selectedPatternId,
    nextWeekPlan,
    linkedGoalId,
    ownObservation = "",
  } = draft.value;
  const changeDraft = (patch: Partial<WeeklyReviewDraft>) => {
    setMessage("");
    setError("");
    draft.setValue((current) => ({ ...initial, ...current, ...patch }));
  };
  const setSelectedPatternId = (value: string) =>
    changeDraft({ selectedPatternId: value });
  const setNextWeekPlan = (value: string) =>
    changeDraft({ nextWeekPlan: value });

  const patternText = (pattern: WeeklyPattern): string => {
    if (pattern.kind === "registration-type") {
      return copy.patternType.replace("{type}", copy.types[pattern.value]);
    }
    if (pattern.kind === "time-of-day") {
      return copy.patternTime.replace("{time}", copy.times[pattern.value]);
    }
    return copy.patternIntensity;
  };

  const denominatorText = (pattern: WeeklyPattern): string =>
    replaceCounts(
      pattern.kind === "high-intensity"
        ? copy.answeredDenominator
        : copy.denominator,
      pattern.count,
      pattern.denominator,
    );

  const savedPatternText = (review: WeeklyReviewRecord): string => {
    const count = review.patternCount;
    const denominator = review.patternDenominator;
    const patternValue = review.patternValue;
    if (count === undefined || denominator === undefined)
      return review.chosenPattern;
    let description: string | null = null;
    if (
      review.patternKind === "registration-type" &&
      patternValue &&
      patternValue in copy.types
    ) {
      description = copy.patternType.replace(
        "{type}",
        copy.types[patternValue as RegistrationType],
      );
    } else if (
      review.patternKind === "time-of-day" &&
      patternValue &&
      patternValue in copy.times
    ) {
      description = copy.patternTime.replace(
        "{time}",
        copy.times[patternValue as TimeOfDay],
      );
    } else if (review.patternKind === "high-intensity") {
      description = copy.patternIntensity;
    }
    return description
      ? `${description} (${count}/${denominator})`
      : review.chosenPattern;
  };

  const matchingEntries = (pattern: WeeklyPattern): ReviewRegistration[] => {
    const ids = new Set(pattern.entryIds);
    return summary.entries.filter((entry) => ids.has(entry.id));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (
      busy.current ||
      !draft.hydrated ||
      draft.error ||
      store.loadError ||
      featureError
    )
      return;
    setMessage("");
    const pattern = summary.patterns.find(
      (item) => item.id === selectedPatternId,
    );
    const retainedPattern =
      !pattern &&
      selectedPatternId !== "own" &&
      selectedPatternId === initial.selectedPatternId
        ? initialRecord
        : null;
    const hasPlanning = !!(
      selectedPatternId ||
      nextWeekPlan.trim() ||
      ownObservation.trim() ||
      linkedGoalId
    );
    const hasReflection = WEEKLY_GROWTH_FIELDS.some((field) =>
      draft.value[field]?.trim(),
    );
    if (
      hasPlanning &&
      !pattern &&
      !retainedPattern?.chosenPattern &&
      !(selectedPatternId === "own" && ownObservation.trim())
    ) {
      setError(copy.chooseError);
      return;
    }
    if (hasPlanning && !nextWeekPlan.trim()) {
      setError(copy.planError);
      return;
    }
    if (!hasPlanning && !hasReflection) {
      setError(growthCopy.empty);
      return;
    }
    if (selectedPatternId === "own" && ownObservation.trim().length > 1000) {
      setError(growthCopy.longObservation);
      return;
    }
    busy.current = true;
    setSaving(true);
    setError("");
    setConflict(false);
    let committed = false;
    try {
      await flushLocalDrafts();
      const expectedUpdatedAt =
        draft.value.sourceUpdatedAt === undefined
          ? (initial.sourceUpdatedAt ?? null)
          : draft.value.sourceUpdatedAt;
      const reviewInput: WeeklyReviewRecord = {
        ...initialRecord,
        id: draft.value.recordId ?? initial.recordId!,
        recordType: "weekly-review" as const,
        timestamp: draft.value.timestamp ?? initial.timestamp!,
        updatedAt:
          expectedUpdatedAt ?? draft.value.timestamp ?? initial.timestamp!,
        periodStart: range.start,
        periodEnd: range.endExclusive - 1,
        chosenPattern: pattern
          ? `${patternText(pattern)} (${pattern.count}/${pattern.denominator})`
          : (retainedPattern?.chosenPattern ??
            (selectedPatternId === "own" ? ownObservation.trim() : "")),
        nextWeekPlan: nextWeekPlan.trim(),
        patternKind: pattern?.kind ?? retainedPattern?.patternKind,
        patternValue: pattern?.value ?? retainedPattern?.patternValue,
        patternCount: pattern?.count ?? retainedPattern?.patternCount,
        patternDenominator:
          pattern?.denominator ?? retainedPattern?.patternDenominator,
        reviewedEntryIds:
          pattern?.entryIds ?? retainedPattern?.reviewedEntryIds ?? [],
        linkedGoalId: linkedGoalId || null,
        planRevisionAt: hasPlanning ? recoveryPlan.updatedAt : undefined,
        rememberFromWeek: draft.value.rememberFromWeek?.trim() ?? "",
        choseForMyself: draft.value.choseForMyself?.trim() ?? "",
        makeRoomForNextWeek: draft.value.makeRoomForNextWeek?.trim() ?? "",
        pleasantActivity: draft.value.pleasantActivity?.trim() ?? "",
      };
      const saved = await saveWeeklyReview(reviewInput, expectedUpdatedAt);
      committed = true;
      await draft.clearDraft(reviewDraft(saved), { keepInputOnFailure: true });
      setMessage(growthCopy.saved);
    } catch (cause) {
      setConflict(cause instanceof WeeklyReviewConflictError);
      setError(
        cause instanceof WeeklyReviewConflictError
          ? growthCopy.conflict
          : committed
            ? growthCopy.cleanupError
            : growthCopy.saveError,
      );
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  async function confirmAction() {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      if (confirmation === "remove" && savedReview) {
        await removeWeeklyReview(savedReview);
        onDeleted();
      } else if (confirmation === "latest") {
        await draft.clearDraft();
        await refresh();
      } else if (confirmation === "discard") {
        await draft.clearDraft(reviewDraft(savedReview), {
          keepInputOnFailure: true,
        });
        setConflict(false);
      }
      setConfirmation(null);
    } catch (cause) {
      setConflict(cause instanceof WeeklyReviewConflictError);
      setError(
        cause instanceof WeeklyReviewConflictError
          ? growthCopy.conflict
          : growthCopy.deleteError,
      );
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  const renderEntry = (entry: ReviewRegistration) => (
    <li
      key={entry.id}
      className="rounded-xl border border-border/60 bg-background px-3 py-2.5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            {copy.types[entry.type]}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {entry.source === "quick"
              ? copy.sourceQuick
              : entry.source === "linked"
                ? copy.sourceLinked
                : copy.sourceDetailed}
          </p>
        </div>
        <time
          className="shrink-0 text-right text-[11px] text-muted-foreground"
          dateTime={new Date(entry.timestamp).toISOString()}
        >
          {new Intl.DateTimeFormat(locale, {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(entry.timestamp)}
        </time>
      </div>
      {(entry.contextParts.length > 0 || entry.actionParts.length > 0) && (
        <p className="mt-2 text-sm leading-5 text-muted-foreground">
          {[...entry.contextParts, ...entry.actionParts]
            .map((part) =>
              part.kind === "option" ? tOpt(part.value) : part.value,
            )
            .join(" · ")}
        </p>
      )}
      {entry.safetyObservations.some((observation) => observation.answered) && (
        <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {copy.safetyLabel}:{" "}
          </span>
          {formatSafetyObservations(entry.safetyObservations, language)}
        </p>
      )}
      <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
        {copy.intensity}:{" "}
        {formatIntensityObservations(entry.intensityObservations, language)}
      </p>
      {entry.note && (
        <p className="mt-2 whitespace-pre-wrap text-sm leading-5 text-muted-foreground">
          <span className="font-medium text-foreground">{copy.note}: </span>
          {entry.note}
        </p>
      )}
    </li>
  );

  if (store.loading || featureLoading || !draft.hydrated) {
    return (
      <div role="status" className="flex min-h-dvh items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="sr-only">{copy.loading}</span>
      </div>
    );
  }

  const quickCount = summary.entries.filter(
    (entry) => entry.source === "quick",
  ).length;
  const blocked =
    saving || !!store.loadError || !!featureError || !!draft.error;
  const confirmationTitle =
    confirmation === "remove"
      ? growthCopy.confirmRemove
      : confirmation === "latest"
        ? growthCopy.confirmLatest
        : growthCopy.confirmDiscard;
  const confirmationAction =
    confirmation === "remove"
      ? growthCopy.removeAction
      : confirmation === "latest"
        ? growthCopy.latestAction
        : growthCopy.discardAction;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title={copy.title} subtitle={growthCopy.subtitle} back />
      <div className="flex-1 overflow-y-auto scroll-smooth-ios px-4 pb-safe pt-3">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 pb-8">
          <DraftStatus {...draft} />
          {notice && (
            <p role="status" className="text-sm text-primary">
              {notice}
            </p>
          )}
          <Link
            href="/"
            className="inline-flex min-h-12 items-center text-sm underline"
          >
            {growthCopy.leave}
          </Link>
          {(store.loadError || featureError) && (
            <p role="alert" className="text-sm text-destructive">
              {language === "nl"
                ? "Niet alle gegevens zijn geladen. Herlaad voordat je deze review opslaat."
                : "Some records could not be loaded. Reload before saving this review."}
            </p>
          )}
          <div className="flex justify-between gap-2">
            <button
              type="button"
              disabled={saving}
              className="min-h-11 text-sm underline"
              onClick={() => {
                setWeekOffset(weekOffset - 1);
                setMessage("");
              }}
            >
              {language === "nl" ? "Een week terug" : "Previous week"}
            </button>
            <button
              type="button"
              className="min-h-11 text-sm underline disabled:opacity-40"
              disabled={saving || weekOffset >= 0}
              onClick={() => {
                setWeekOffset(weekOffset + 1);
                setMessage("");
              }}
            >
              {language === "nl" ? "Een week vooruit" : "Next week"}
            </button>
          </div>
          <div
            className="grid grid-cols-2 gap-2 rounded-2xl bg-muted/60 p-1"
            role="group"
            aria-label={copy.period}
          >
            {(
              [
                [0, copy.current],
                [-1, copy.previous],
              ] as const
            ).map(([offset, label]) => (
              <button
                key={offset}
                type="button"
                disabled={saving}
                aria-pressed={weekOffset === offset}
                onClick={() => setWeekOffset(offset)}
                className={`min-h-11 rounded-xl px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                  weekOffset === offset
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <section
            className="rounded-[1.5rem] border border-border/70 bg-card p-4"
            aria-labelledby="review-period-title"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CalendarDays size={21} strokeWidth={1.8} />
              </span>
              <div>
                <p
                  id="review-period-title"
                  className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground"
                >
                  {copy.period}
                </p>
                <p className="mt-0.5 text-sm font-semibold text-foreground">
                  {formatPeriod(range.start, range.endExclusive, locale)}
                </p>
              </div>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {summary.entries.length} {copy.registrations}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {summary.entries.length - quickCount} {copy.detailed} ·{" "}
              {quickCount} {copy.quick}
            </p>
          </section>

          {summary.entries.length === 0 && (
            <section className="rounded-[1.5rem] border border-border/70 bg-card p-5 text-center">
              <ClipboardList
                className="mx-auto text-muted-foreground"
                size={28}
                strokeWidth={1.6}
              />
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {copy.noData}
              </p>
              <p className="mt-2 text-sm leading-6">{growthCopy.emptyWeek}</p>
            </section>
          )}
          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <fieldset
              disabled={blocked}
              className="flex min-w-0 flex-col gap-4"
            >
              <section
                className="rounded-3xl border border-primary/25 bg-primary/5 p-4"
                aria-labelledby="weekly-growth-title"
              >
                <h2 id="weekly-growth-title" className="text-lg font-semibold">
                  {growthCopy.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {growthCopy.optional}
                </p>
                {WEEKLY_GROWTH_FIELDS.map((field) => (
                  <div key={field} className="mt-5">
                    <label
                      htmlFor={`weekly-${field}`}
                      className="block text-sm font-medium leading-relaxed"
                    >
                      {growthCopy[field]}
                    </label>
                    {field === "pleasantActivity" && (
                      <p
                        id="weekly-activity-hint"
                        className="mt-2 text-sm leading-relaxed text-muted-foreground"
                      >
                        {growthCopy.activityHint}
                      </p>
                    )}
                    <textarea
                      id={`weekly-${field}`}
                      rows={field === "pleasantActivity" ? 2 : 3}
                      maxLength={2000}
                      aria-describedby={
                        field === "pleasantActivity"
                          ? "weekly-activity-hint"
                          : undefined
                      }
                      value={draft.value[field] ?? ""}
                      onChange={(event) =>
                        changeDraft({ [field]: event.target.value })
                      }
                      className="mt-2 w-full resize-y rounded-xl border border-input bg-background p-3 text-base leading-relaxed"
                    />
                  </div>
                ))}
              </section>
              <details className="rounded-3xl border border-border bg-card p-4">
                <summary className="min-h-12 cursor-pointer py-2 text-sm font-semibold">
                  {growthCopy.planning}
                </summary>
                <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                  {growthCopy.planningHint}
                </p>
                <div className="flex flex-col gap-4">
                  <section
                    className="rounded-[1.5rem] border border-border/70 bg-card p-4"
                    aria-labelledby="observed-patterns-title"
                  >
                    <h2
                      id="observed-patterns-title"
                      className="text-base font-semibold text-foreground"
                    >
                      {copy.patterns}
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {copy.patternsIntro}
                    </p>
                    <fieldset className="mt-4 grid gap-3">
                      <legend className="sr-only">{copy.choose}</legend>
                      <label className="flex min-h-12 items-center gap-3 text-sm">
                        <input
                          type="radio"
                          name="weekly-pattern"
                          checked={
                            !selectedPatternId &&
                            !nextWeekPlan.trim() &&
                            !ownObservation.trim() &&
                            !linkedGoalId
                          }
                          onChange={() =>
                            changeDraft({
                              selectedPatternId: "",
                              ownObservation: "",
                              nextWeekPlan: "",
                              linkedGoalId: "",
                            })
                          }
                          className="h-4 w-4 shrink-0 accent-primary"
                        />
                        {growthCopy.noPattern}
                      </label>
                      {initialRecord?.patternKind &&
                        selectedPatternId === initial.selectedPatternId &&
                        !summary.patterns.some(
                          (pattern) => pattern.id === selectedPatternId,
                        ) && (
                          <label className="flex items-start gap-3 rounded-xl border border-primary/30 p-3 text-sm">
                            <input
                              type="radio"
                              name="weekly-pattern"
                              checked
                              readOnly
                              className="mt-1 h-4 w-4 accent-primary"
                            />
                            <span>
                              {growthCopy.retainedPattern}:{" "}
                              {savedPatternText(initialRecord)}
                            </span>
                          </label>
                        )}
                      {summary.patterns.map((pattern) => {
                        const selected = selectedPatternId === pattern.id;
                        const sources = matchingEntries(pattern);
                        return (
                          <div
                            key={pattern.id}
                            className={`rounded-2xl border p-3 ${selected ? "border-primary bg-primary/5" : "border-border/70 bg-background"}`}
                          >
                            <label className="flex cursor-pointer items-start gap-3">
                              <input
                                type="radio"
                                name="weekly-pattern"
                                value={pattern.id}
                                checked={selected}
                                onChange={() => {
                                  setSelectedPatternId(pattern.id);
                                  setError("");
                                }}
                                className="mt-1 h-4 w-4 accent-primary"
                              />
                              <span className="min-w-0">
                                <span className="block text-sm font-semibold leading-5 text-foreground">
                                  {patternText(pattern)}
                                </span>
                                <span className="mt-1 block text-xs text-muted-foreground">
                                  {denominatorText(pattern)}
                                </span>
                              </span>
                            </label>
                            <details className="mt-3 border-t border-border/50 pt-2">
                              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-xs font-medium text-primary">
                                {copy.inspect}
                                <ChevronDown size={16} aria-hidden="true" />
                              </summary>
                              {sources.length === 0 ? (
                                <p className="mt-2 text-xs text-muted-foreground">
                                  {copy.noneMatching}
                                </p>
                              ) : (
                                <ol className="mt-2 grid gap-2">
                                  {sources.map(renderEntry)}
                                </ol>
                              )}
                            </details>
                          </div>
                        );
                      })}
                      <div className="rounded-2xl border border-border/70 p-3">
                        <label className="flex min-h-11 items-center gap-3 text-sm">
                          <input
                            type="radio"
                            name="weekly-pattern"
                            checked={selectedPatternId === "own"}
                            onChange={() => setSelectedPatternId("own")}
                            className="h-4 w-4 accent-primary"
                          />
                          {language === "nl"
                            ? "Mijn eigen waarneming, ook zonder registraties"
                            : "My own observation, including weeks without records"}
                        </label>
                        {selectedPatternId === "own" && (
                          <label className="mt-2 block text-sm">
                            {language === "nl"
                              ? "Wat merkte je deze week?"
                              : "What did you notice this week?"}
                            <textarea
                              aria-label={
                                language === "nl"
                                  ? "Wat merkte je deze week?"
                                  : "What did you notice this week?"
                              }
                              value={ownObservation}
                              onChange={(event) =>
                                changeDraft({
                                  ownObservation: event.target.value,
                                })
                              }
                              maxLength={1000}
                              rows={3}
                              className="mt-2 w-full rounded-xl border border-input bg-background p-3 text-base"
                            />
                          </label>
                        )}
                      </div>
                    </fieldset>
                  </section>

                  <details className="rounded-[1.5rem] border border-border/70 bg-card p-4">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-foreground">
                      {copy.allRegistrations}
                      <ChevronDown size={18} aria-hidden="true" />
                    </summary>
                    <ol className="mt-3 grid gap-2">
                      {summary.entries.map(renderEntry)}
                    </ol>
                  </details>

                  <section
                    className="rounded-[1.5rem] border border-border/70 bg-card p-4"
                    aria-labelledby="next-week-plan-title"
                  >
                    <h2
                      id="next-week-plan-title"
                      className="text-base font-semibold text-foreground"
                    >
                      {copy.plan}
                    </h2>
                    <p
                      id="next-week-plan-help"
                      className="mt-1 text-sm text-muted-foreground"
                    >
                      {language === "nl"
                        ? "Welke haalbare stap past bij de waarneming die je hierboven hebt gekozen?"
                        : "What achievable step fits the observation you chose above?"}
                    </p>
                    <label className="mt-3 block text-sm font-medium">
                      {language === "nl"
                        ? "Koppelen aan mijn doel (optioneel)"
                        : "Link to my goal (optional)"}
                      <select
                        aria-label={
                          language === "nl"
                            ? "Koppelen aan mijn doel (optioneel)"
                            : "Link to my goal (optional)"
                        }
                        value={linkedGoalId}
                        onChange={(event) =>
                          changeDraft({ linkedGoalId: event.target.value })
                        }
                        className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background p-3"
                      >
                        <option value="">
                          {language === "nl"
                            ? "Geen doel gekoppeld"
                            : "No linked goal"}
                        </option>
                        {prevention.goals
                          .filter((goal) => goal.active)
                          .map((goal) => (
                            <option key={goal.id} value={goal.id}>
                              {recoveryTargetLabel(goal.target, language)} ·{" "}
                              {goal.description}
                            </option>
                          ))}
                      </select>
                    </label>
                    <Link
                      href="/recovery-plan"
                      className="mt-2 inline-flex min-h-11 items-center text-sm text-primary underline"
                    >
                      {language === "nl"
                        ? "Mijn preventieplan bekijken of aanpassen"
                        : "View or update my prevention plan"}
                    </Link>
                    <textarea
                      aria-labelledby="next-week-plan-title"
                      aria-describedby="next-week-plan-help"
                      value={nextWeekPlan}
                      onChange={(event) => {
                        setNextWeekPlan(event.target.value);
                        setError("");
                      }}
                      rows={4}
                      maxLength={4000}
                      placeholder={copy.planPlaceholder}
                      className="mt-3 w-full resize-y rounded-xl border border-input bg-background px-3 py-3 text-base text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/50"
                    />
                  </section>
                </div>
              </details>
              {error && (
                <p role="alert" className="mt-2 text-sm text-destructive">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={
                  saving || !!store.loadError || !!featureError || !!draft.error
                }
                className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                <Save size={18} strokeWidth={1.8} />
                {saving ? copy.saving : growthCopy.save}
              </button>
              <div
                aria-live="polite"
                className="mt-2 min-h-5 text-sm text-primary"
              >
                {message}
              </div>
            </fieldset>
          </form>
          {conflict && (
            <button
              type="button"
              disabled={saving}
              onClick={() => setConfirmation("latest")}
              className="min-h-12 rounded-xl border border-border p-3 text-sm underline"
            >
              {growthCopy.loadLatest}
            </button>
          )}
          {draft.hasDraft && (
            <button
              type="button"
              disabled={saving}
              onClick={() => setConfirmation("discard")}
              className="min-h-12 text-sm underline"
            >
              {growthCopy.discard}
            </button>
          )}
          {confirmation && (
            <div
              role="group"
              aria-label={confirmationTitle}
              className="rounded-2xl border border-border bg-card p-4"
            >
              <p className="text-sm leading-relaxed">{confirmationTitle}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void confirmAction()}
                  className="min-h-12 rounded-xl border border-border p-3 text-sm"
                >
                  {confirmationAction}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setConfirmation(null)}
                  className="min-h-12 p-3 text-sm"
                >
                  {growthCopy.cancel}
                </button>
              </div>
            </div>
          )}

          {savedReview && (
            <section
              className="rounded-[1.5rem] border border-primary/20 bg-primary/5 p-4"
              aria-labelledby="saved-review-title"
            >
              <h2
                id="saved-review-title"
                className="text-sm font-semibold text-foreground"
              >
                {growthCopy.savedTitle}
              </h2>
              {savedReview.chosenPattern && (
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {savedPatternText(savedReview)}
                </p>
              )}
              {savedReview.nextWeekPlan && (
                <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-6 text-foreground">
                  {savedReview.nextWeekPlan}
                </p>
              )}
              <dl className="mt-3 space-y-3">
                {WEEKLY_GROWTH_FIELDS.map((field) =>
                  savedReview[field] ? (
                    <div key={field}>
                      <dt className="text-xs text-muted-foreground">
                        {growthCopy[field]}
                      </dt>
                      <dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">
                        {savedReview[field]}
                      </dd>
                    </div>
                  ) : null,
                )}
              </dl>
              {savedReview.linkedGoalId && (
                <p className="mt-2 text-xs">
                  {language === "nl" ? "Gekoppeld doel" : "Linked goal"}:{" "}
                  {prevention.goals.find(
                    (goal) => goal.id === savedReview.linkedGoalId,
                  )?.description ??
                    (language === "nl"
                      ? "Doel niet meer in het huidige plan"
                      : "Goal no longer in the current plan")}
                </p>
              )}
              {savedReview.planRevisionAt && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {language === "nl"
                    ? "Planversie opgeslagen op"
                    : "Plan version saved at"}
                  :{" "}
                  {new Intl.DateTimeFormat(locale, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(savedReview.planRevisionAt)}
                </p>
              )}
              {!!savedReview.reviewedEntryIds?.length && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {language === "nl"
                    ? `Deze terugblik legde ${savedReview.reviewedEntryIds.length} bijbehorende gebeurtenissen vast. Latere correcties of verwijderingen wijzigen die eerdere waarneming niet automatisch.`
                    : `This review referenced ${savedReview.reviewedEntryIds.length} matching episodes. Later corrections or deletions do not automatically rewrite that earlier observation.`}
                </p>
              )}
              <p className="mt-2 text-[11px] text-muted-foreground">
                {copy.recorded}:{" "}
                {new Intl.DateTimeFormat(locale, {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(savedReview.timestamp)}
              </p>
              <button
                type="button"
                disabled={saving || !!featureError || !!store.loadError}
                onClick={() => setConfirmation("remove")}
                className="mt-3 min-h-12 text-left text-sm underline"
              >
                {growthCopy.remove}
              </button>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
