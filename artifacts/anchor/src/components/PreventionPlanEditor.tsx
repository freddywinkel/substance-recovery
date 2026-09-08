import { TargetSafetyAdvice } from "@/components/TargetSafetyAdvice";
import { Link } from "wouter";
import { Plus, Trash2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { EmergencyContact } from "@/db";
import {
  RECOVERY_TARGET_VALUES,
  recoveryTargetLabel,
} from "@/lib/recoveryTargets";
import { RECOVERY_TOOL_LABELS, TOOL_IDS } from "@/lib/recoveryFeatures";
import {
  newRecoveryGoal,
  newSignalAction,
  type PreventionPlan,
  type RecoveryGoal,
  type SignalAction,
} from "@/lib/preventionPlan";

const fieldClass =
  "mt-1 min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
const buttonClass =
  "min-h-11 rounded-xl border border-border px-3 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-primary";

export function PreventionPlanEditor({
  value,
  onChange,
  contacts,
}: {
  value: PreventionPlan;
  onChange: (value: PreventionPlan) => void;
  contacts: EmergencyContact[];
}) {
  const { language } = useLanguage();
  const nl = language === "nl";
  const tr = (a: string, b: string) => (nl ? a : b);
  const patch = (values: Partial<PreventionPlan>) =>
    onChange({ ...value, ...values });
  const updateGoal = (id: string, values: Partial<RecoveryGoal>) =>
    patch({
      goals: value.goals.map((goal) =>
        goal.id === id ? { ...goal, ...values } : goal,
      ),
    });
  const updateSignal = (id: string, values: Partial<SignalAction>) =>
    patch({
      signalActions: value.signalActions.map((item) =>
        item.id === id ? { ...item, ...values } : item,
      ),
    });
  const group = (
    title: string,
    body: string,
    children: React.ReactNode,
    open = false,
  ) => (
    <details
      open={open || undefined}
      className="rounded-3xl border border-border bg-card/75 p-4"
    >
      <summary className="cursor-pointer min-h-11 font-semibold marker:text-primary">
        {title}
      </summary>
      <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
        {body}
      </p>
      <div className="mt-4 space-y-4">{children}</div>
    </details>
  );
  const area = (
    key: keyof Pick<
      PreventionPlan,
      | "strengths"
      | "routines"
      | "careAgreements"
      | "medicalPrecautions"
      | "afterUse"
      | "aftercare"
      | "reviewedWith"
      | "sharingPreferences"
      | "changeReason"
    >,
    title: string,
    hint?: string,
  ) => (
    <label className="block text-sm font-medium">
      {title}
      <textarea
        aria-label={title}
        className={`${fieldClass} min-h-24 resize-y`}
        maxLength={12000}
        value={value[key]}
        onChange={(event) => patch({ [key]: event.target.value })}
      />
      {hint && (
        <span className="mt-1 block text-xs font-normal text-muted-foreground">
          {hint}
        </span>
      )}
    </label>
  );

  return (
    <>
      {group(
        tr("Mijn doelen", "My goals"),
        tr(
          "Kies zelf je richting. Alles mag later worden aangepast; een teller is optioneel.",
          "Choose your direction. You can revise it later; counters are optional.",
        ),
        <>
          {value.goals.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {tr("Nog geen doel ingevuld.", "No goal entered yet.")}
            </p>
          )}
          {value.goals.map((goal, index) => (
            <fieldset
              key={goal.id}
              className="space-y-3 rounded-2xl border border-border p-3"
            >
              <legend className="px-2 font-medium">
                {tr("Doel", "Goal")} {index + 1}
              </legend>
              <label className="block text-sm">
                {tr("Middel of gedrag", "Substance or behavior")}
                <select
                  aria-label={tr("Middel of gedrag", "Substance or behavior")}
                  className={fieldClass}
                  value={goal.target}
                  onChange={(event) =>
                    updateGoal(goal.id, { target: event.target.value })
                  }
                >
                  <option value="">
                    {tr("Nog niet gekozen", "Not chosen")}
                  </option>
                  {RECOVERY_TARGET_VALUES.map((target) => (
                    <option key={target} value={target}>
                      {recoveryTargetLabel(target, language)}
                    </option>
                  ))}
                  {goal.target &&
                    !RECOVERY_TARGET_VALUES.includes(
                      goal.target as (typeof RECOVERY_TARGET_VALUES)[number],
                    ) && <option value={goal.target}>{goal.target}</option>}
                </select>
              </label>
              <label className="block text-sm">
                {tr("Mijn richting", "My direction")}
                <select
                  aria-label={tr("Mijn richting", "My direction")}
                  className={fieldClass}
                  value={goal.type}
                  onChange={(event) =>
                    updateGoal(goal.id, {
                      type: event.target.value as RecoveryGoal["type"],
                    })
                  }
                >
                  <option value="personal">
                    {tr("Persoonlijk doel", "Personal goal")}
                  </option>
                  <option value="abstinence">
                    {tr("Niet gebruiken / niet doen", "Not using / not doing")}
                  </option>
                  <option value="reduction">
                    {tr("Minderen", "Reducing")}
                  </option>
                  <option value="harm-reduction">
                    {tr("Schade beperken", "Reducing harm")}
                  </option>
                </select>
              </label>
              <label className="block text-sm">
                {tr("Wat wil ik bereiken?", "What do I want to achieve?")}
                <textarea
                  aria-label={tr("Wat wil ik bereiken?", "What do I want to achieve?")}
                  maxLength={12000}
                  className={`${fieldClass} min-h-20`}
                  value={goal.description}
                  onChange={(event) =>
                    updateGoal(goal.id, { description: event.target.value })
                  }
                />
              </label>
              <label className="block text-sm">
                {tr("Startdatum (optioneel)", "Start date (optional)")}
                <input
                  type="date"
                  className={fieldClass}
                  value={goal.startDate}
                  onChange={(event) =>
                    updateGoal(goal.id, { startDate: event.target.value })
                  }
                />
              </label>
              <label className="flex items-center gap-3 min-h-11 text-sm">
                <input
                  type="checkbox"
                  checked={goal.active}
                  onChange={(event) =>
                    updateGoal(goal.id, { active: event.target.checked })
                  }
                />
                {tr("Hier werk ik nu aan", "I am working on this now")}
              </label>
              <label className="flex items-center gap-3 min-h-11 text-sm">
                <input
                  type="checkbox"
                  checked={goal.showProgress}
                  onChange={(event) =>
                    updateGoal(goal.id, { showProgress: event.target.checked })
                  }
                />
                {tr(
                  "Toon mijn vastgelegde voortgang",
                  "Show my recorded progress",
                )}
              </label>
              <p className="text-xs text-muted-foreground">
                {tr(
                  "Dagen zonder registratie bewijzen geen abstinentie. Beschrijf bij gedrag de persoonlijke grens; gewone voedselinname of seksualiteit is geen terugval.",
                  "Days without entries do not prove abstinence. For behaviors, describe your personal boundary; ordinary eating or sexuality is not a relapse.",
                )}
              </p>
              {goal.target && (
                <TargetSafetyAdvice
                  targets={[goal.target]}
                  language={language}
                />
              )}
              <button
                type="button"
                className={buttonClass}
                onClick={() =>
                  updateGoal(goal.id, { active: false, showProgress: false })
                }
              >
                {tr("Doel pauzeren", "Pause goal")}
              </button>
              <button
                type="button"
                className={`${buttonClass} ml-2`}
                onClick={() =>
                  patch({
                    goals: value.goals.filter((item) => item.id !== goal.id),
                  })
                }
                aria-label={`${tr("Doel verwijderen", "Remove goal")} ${index + 1}`}
              >
                <Trash2 size={16} />
              </button>
            </fieldset>
          ))}
          <button
            type="button"
            disabled={value.goals.length >= 50}
            className={`${buttonClass} inline-flex items-center gap-2`}
            onClick={() =>
              patch({ goals: [...value.goals, newRecoveryGoal()] })
            }
          >
            <Plus size={17} />
            {tr("Doel toevoegen", "Add goal")}
          </button>
        </>,
        true,
      )}

      {group(
        tr("Van signaal naar actie", "From signal to action"),
        tr(
          "Koppel een eigen signaal aan een haalbare eerste stap en een alternatief. Jij kiest wat nu past; de app berekent geen risicostadium.",
          "Link your own signal to a doable first step and an alternative. You choose what fits now; the app does not calculate a risk stage.",
        ),
        <>
          {value.signalActions.map((item, index) => (
            <fieldset
              key={item.id}
              className="rounded-2xl border border-border p-3 space-y-3"
            >
              <legend className="px-2 font-medium">
                {tr("Signaal en actie", "Signal and action")} {index + 1}
              </legend>
              {(
                [
                  [
                    "signal",
                    tr("Ik herken dit signaal", "I recognize this signal"),
                  ],
                  ["firstAction", tr("Mijn eerste stap", "My first step")],
                  [
                    "alternative",
                    tr("Als dat niet lukt", "If that does not help"),
                  ],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block text-sm">
                  {label}
                  <textarea
                    aria-label={label}
                    maxLength={12000}
                    className={`${fieldClass} min-h-20`}
                    value={item[key]}
                    onChange={(event) =>
                      updateSignal(item.id, { [key]: event.target.value })
                    }
                  />
                </label>
              ))}
              <label className="block text-sm">
                {tr("Contact (optioneel)", "Contact (optional)")}
                <select
                  aria-label={tr("Contact (optioneel)", "Contact (optional)")}
                  className={fieldClass}
                  value={item.contactId ?? ""}
                  onChange={(event) =>
                    updateSignal(item.id, {
                      contactId: event.target.value || null,
                    })
                  }
                >
                  <option value="">
                    {tr("Geen contact gekozen", "No contact chosen")}
                  </option>
                  {contacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.name}
                    </option>
                  ))}
                  {item.contactId &&
                    !contacts.some(
                      (contact) => contact.id === item.contactId,
                    ) && (
                      <option value={item.contactId}>
                        {tr(
                          "Eerder gekozen contact ontbreekt",
                          "Previously selected contact is missing",
                        )}
                      </option>
                    )}
                </select>
              </label>
              <label className="block text-sm">
                {tr("Hulpmiddel (optioneel)", "Tool (optional)")}
                <select
                  aria-label={tr("Hulpmiddel (optioneel)", "Tool (optional)")}
                  className={fieldClass}
                  value={item.toolId ?? ""}
                  onChange={(event) =>
                    updateSignal(item.id, {
                      toolId: event.target.value || null,
                    })
                  }
                >
                  <option value="">
                    {tr("Geen hulpmiddel gekozen", "No tool chosen")}
                  </option>
                  {TOOL_IDS.map((tool) => (
                    <option key={tool} value={tool}>
                      {RECOVERY_TOOL_LABELS[language][tool]}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className={buttonClass}
                onClick={() =>
                  patch({
                    signalActions: value.signalActions.filter(
                      (signal) => signal.id !== item.id,
                    ),
                  })
                }
              >
                {tr("Deze koppeling verwijderen", "Remove this link")}
              </button>
            </fieldset>
          ))}
          <button
            type="button"
            disabled={value.signalActions.length >= 100}
            className={`${buttonClass} inline-flex items-center gap-2`}
            onClick={() =>
              patch({
                signalActions: [...value.signalActions, newSignalAction()],
              })
            }
          >
            <Plus size={17} />
            {tr("Signaal en actie toevoegen", "Add signal and action")}
          </button>
          <Link
            href="/settings"
            className="block min-h-11 pt-3 text-sm underline text-primary"
          >
            {tr(
              "Contacten beheren; mijn concept blijft bewaard",
              "Manage contacts; my draft is preserved",
            )}
          </Link>
        </>,
      )}

      {group(
        tr("Wat mij helpt", "What supports me"),
        tr(
          "Steun, sterke kanten en haalbare routines.",
          "Support, strengths and doable routines.",
        ),
        <>
          {area(
            "strengths",
            tr("Mijn sterke kanten en steun", "My strengths and support"),
          )}
          {area(
            "routines",
            tr("Mijn helpende routines", "My helpful routines"),
          )}
        </>,
      )}
      {group(
        tr("Zorg en medische afspraken", "Care and medical agreements"),
        tr(
          "Leg afspraken vast die je zelf met je zorgverlener hebt gemaakt. Een notitie is geen beoordeling door de app.",
          "Record agreements you made with your care provider. A note is not an assessment by the app.",
        ),
        <>
          {area(
            "careAgreements",
            tr(
              "Behandelteam, coördinatie en bereikbaarheid",
              "Care team, coordination and availability",
            ),
            tr(
              "Wie doet wat? Wie bel ik buiten openingstijden of als mijn contact niet bereikbaar is?",
              "Who does what? Who do I contact outside opening hours or if my contact is unavailable?",
            ),
          )}
          {area(
            "medicalPrecautions",
            tr("Afgesproken medische voorzorgen", "Agreed medical precautions"),
            tr(
              "Vermeld met wie dit is afgesproken, bron en datum. Verander medicatie niet op basis van deze app.",
              "Record who agreed this, source and date. Do not change medication based on this app.",
            ),
          )}
          <Link
            href="/help"
            className="block min-h-11 pt-2 text-primary underline"
          >
            {tr(
              "Mijn zorg- en hulproutes bekijken",
              "View my care and support routes",
            )}
          </Link>
        </>,
      )}
      {group(
        tr(
          "Na een moeilijk moment en nazorg",
          "After a difficult moment and aftercare",
        ),
        tr(
          "Maak de volgende stap klein en concreet. Je eerdere inzet blijft waardevol.",
          "Make the next step small and specific. Your earlier effort still matters.",
        ),
        <>
          {area(
            "afterUse",
            tr(
              "Wat ik doe na een gebruiksmoment",
              "What I do after a use event",
            ),
          )}
          {area(
            "aftercare",
            tr(
              "Nazorg en praktische ondersteuning",
              "Aftercare and practical support",
            ),
            tr(
              "Vervolgcontact, afspraken, steun thuis, werk of financiën en een alternatief wanneer steun wegvalt.",
              "Follow-up, appointments, support at home, work or finances, and an alternative if support falls away.",
            ),
          )}
        </>,
      )}
      {group(
        tr("Bespreken en delen", "Reviewing and sharing"),
        tr(
          "Een bespreekdatum is een herinnering aan je afspraak, geen noodsignaal.",
          "A review date reminds you of your agreement; it is not an emergency signal.",
        ),
        <>
          <label className="block text-sm">
            {tr("Volgende bespreekdatum", "Next review date")}
            <input
              type="date"
              className={fieldClass}
              value={value.reviewDate}
              onChange={(event) => patch({ reviewDate: event.target.value })}
            />
          </label>
          {area(
            "reviewedWith",
            tr(
              "Besproken met en op welke datum",
              "Discussed with and on what date",
            ),
          )}
          {area(
            "sharingPreferences",
            tr(
              "Wat ik met wie wil delen",
              "What I want to share and with whom",
            ),
            tr(
              "De app deelt niets automatisch. Je kiest de onderdelen opnieuw bij het maken van een verslag.",
              "The app shares nothing automatically. Choose the sections again when making a report.",
            ),
          )}
          {area(
            "changeReason",
            tr(
              "Waarom ik het plan nu aanpas",
              "Why I am revising the plan now",
            ),
          )}
        </>,
      )}
    </>
  );
}
