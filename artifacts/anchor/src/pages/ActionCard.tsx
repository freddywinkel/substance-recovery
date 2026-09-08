import { useState } from "react";
import { Link } from "wouter";
import { Phone, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRecoveryFeatures } from "@/contexts/RecoveryFeaturesContext";
import { useStore } from "@/hooks/useStore";
import { normalizePreventionPlan } from "@/lib/preventionPlan";
import {
  TOOL_IDS,
  recoveryToolLabel,
  type RecoveryToolId,
} from "@/lib/recoveryFeatures";

export function ActionCard() {
  const { language } = useLanguage();
  const nl = language === "nl";
  const { recoveryPlan, loading, loadError, refresh, homePreferences } =
    useRecoveryFeatures();
  const { emergencyContacts } = useStore();
  const plan = normalizePreventionPlan(recoveryPlan.prevention);
  const [chosen, setChosen] = useState("");
  const selected =
    plan.signalActions.find((item) => item.id === chosen) ??
    plan.signalActions[0];
  const contactId = selected?.contactId ?? homePreferences.pinnedContactId;
  const contact = emergencyContacts.find((item) => item.id === contactId);
  const tr = (a: string, b: string) => (nl ? a : b);
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <PageHeader
        title={tr("Mijn actiekaart", "My action card")}
        subtitle={tr("Eén stap tegelijk", "One step at a time")}
        back
      />
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-2xl space-y-4 pb-6">
          <Link
            href="/help"
            className="block min-h-12 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 font-semibold"
          >
            {tr("Ik heb nu hulp nodig", "I need help now")}{" "}
            <ArrowRight className="inline" size={18} />
          </Link>
          {loading ? (
            <p role="status">
              {tr("Je afspraken laden…", "Loading your agreements…")}
            </p>
          ) : loadError ? (
            <div role="alert">
              <p>
                {tr(
                  "Je plan kon niet worden geladen. Hulp blijft beschikbaar.",
                  "Your plan could not be loaded. Help remains available.",
                )}
              </p>
              <button
                className="min-h-11 underline"
                onClick={() => void refresh()}
              >
                {tr("Opnieuw proberen", "Retry")}
              </button>
            </div>
          ) : (
            <>
              {plan.signalActions.length > 0 && (
                <fieldset className="rounded-2xl border border-border bg-card p-4">
                  <legend className="px-2 font-semibold">
                    {tr("Wat herken ik nu?", "What do I recognize now?")}
                  </legend>
                  {plan.signalActions.map((item, index) => (
                    <label
                      key={item.id}
                      className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl p-2 text-sm"
                    >
                      <input
                        type="radio"
                        name="action-signal"
                        checked={selected?.id === item.id}
                        onChange={() => setChosen(item.id)}
                      />
                      <span className="whitespace-pre-wrap break-words">
                        {item.signal ||
                          `${tr("Mijn signaal", "My signal")} ${index + 1}`}
                      </span>
                    </label>
                  ))}
                </fieldset>
              )}
              <section className="rounded-3xl border border-primary/35 bg-primary/10 p-5">
                <h2 className="text-lg font-semibold">
                  {tr("Mijn eerste stap", "My first step")}
                </h2>
                <p className="mt-3 whitespace-pre-wrap break-words text-base leading-relaxed">
                  {selected?.firstAction ||
                    recoveryPlan.next24Hours[0] ||
                    tr(
                      "Je hebt nog geen eerste stap vastgelegd. Je kunt hulp openen of rustig je plan voorbereiden.",
                      "You have not recorded a first step yet. You can open help or prepare your plan when ready.",
                    )}
                </p>
              </section>
              {selected?.alternative && (
                <section className="rounded-2xl border border-border bg-card p-4">
                  <h2 className="font-semibold">
                    {tr("Als dat niet lukt", "If that does not help")}
                  </h2>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">
                    {selected.alternative}
                  </p>
                </section>
              )}
              {contact && (
                <a
                  href={`tel:${contact.phone}`}
                  className="flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-card p-4 font-medium"
                >
                  <Phone size={19} />
                  <span>
                    {tr("Contact opnemen met", "Contact")} {contact.name}
                    <span className="block text-xs text-muted-foreground">
                      {contact.relationship}
                    </span>
                  </span>
                </a>
              )}
              {contactId && !contact && (
                <p className="text-sm text-amber-500">
                  {tr(
                    "Het eerder gekozen contact is niet beschikbaar in je contactenlijst. Controleer je plan of open hulp.",
                    "The previously chosen contact is missing from your contact list. Check your plan or open help.",
                  )}
                </p>
              )}
              {selected?.toolId &&
                TOOL_IDS.includes(selected.toolId as RecoveryToolId) && (
                  <Link
                    href={selected.toolId}
                    className="block min-h-12 rounded-2xl border border-border p-4 text-primary"
                  >
                    {recoveryToolLabel(
                      selected.toolId as RecoveryToolId,
                      language,
                    )}
                  </Link>
                )}
              {plan.afterUse && (
                <details className="rounded-2xl border border-border bg-card p-4">
                  <summary className="min-h-11 cursor-pointer font-medium">
                    {tr("Na een gebruiksmoment", "After a use event")}
                  </summary>
                  <p className="whitespace-pre-wrap break-words text-sm">
                    {plan.afterUse}
                  </p>
                </details>
              )}
              {plan.careAgreements && (
                <details className="rounded-2xl border border-border bg-card p-4">
                  <summary className="min-h-11 cursor-pointer font-medium">
                    {tr("Mijn zorgafspraken", "My care agreements")}
                  </summary>
                  <p className="whitespace-pre-wrap break-words text-sm">
                    {plan.careAgreements}
                  </p>
                </details>
              )}
              {plan.reviewDate && (
                <p className="text-xs text-muted-foreground">
                  {tr("Afgesproken bespreekdatum", "Agreed review date")}:{" "}
                  {plan.reviewDate}.{" "}
                  {tr(
                    "Dit is een afspraak, geen beoordeling van je veiligheid.",
                    "This is an agreement, not a safety assessment.",
                  )}
                </p>
              )}
            </>
          )}
          <div className="flex flex-wrap gap-3">
            <Link
              href="/recovery-plan"
              className="min-h-11 rounded-xl border border-border px-4 py-3 text-sm"
            >
              {tr("Mijn plan aanpassen", "Edit my plan")}
            </Link>
            <Link
              href="/report"
              className="min-h-11 rounded-xl border border-border px-4 py-3 text-sm"
            >
              {tr("Selectief afdrukken", "Print selected sections")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
