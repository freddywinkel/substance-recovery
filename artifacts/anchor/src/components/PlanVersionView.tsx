import { parseRecoveryPlan, type RecoveryPlan } from "@/lib/recoveryFeatures";
import { normalizePreventionPlan } from "@/lib/preventionPlan";
import { useLanguage } from "@/contexts/LanguageContext";

export function PlanVersionView({
  content,
  onRestore,
}: {
  content: string;
  onRestore: (plan: RecoveryPlan) => void;
}) {
  const { language } = useLanguage();
  const nl = language === "nl";
  let previous: RecoveryPlan;
  try {
    previous = parseRecoveryPlan(JSON.parse(content));
  } catch {
    return (
      <p role="alert">
        {nl
          ? "Deze versie kan niet worden weergegeven. De originele inhoud blijft in je back-up."
          : "This version cannot be displayed. Its original content remains in your backup."}
      </p>
    );
  }
  const plan = normalizePreventionPlan(previous.prevention);
  const fields = [
    [nl ? "Signalen" : "Signals", previous.warningSigns.join("\n")],
    [nl ? "Redenen" : "Reasons", previous.reasonsForRecovery.join("\n")],
    [nl ? "Situaties" : "Situations", previous.situationsToAvoid.join("\n")],
    [nl ? "Bericht" : "Message", previous.callMessage],
    [nl ? "Volgende 24 uur" : "Next 24 hours", previous.next24Hours.join("\n")],
    [
      nl ? "Doelen" : "Goals",
      plan.goals
        .map((goal) => `${goal.target}: ${goal.description}`)
        .join("\n"),
    ],
    [
      nl ? "Signaal en actie" : "Signal and action",
      plan.signalActions
        .map(
          (item) => `${item.signal}\n${item.firstAction}\n${item.alternative}`,
        )
        .join("\n\n"),
    ],
    [nl ? "Sterke kanten" : "Strengths", plan.strengths],
    [nl ? "Routines" : "Routines", plan.routines],
    [nl ? "Zorgafspraken" : "Care agreements", plan.careAgreements],
    [nl ? "Medische afspraken" : "Medical agreements", plan.medicalPrecautions],
    [nl ? "Na gebruik" : "After use", plan.afterUse],
    [nl ? "Nazorg" : "Aftercare", plan.aftercare],
    [nl ? "Bespreekdatum" : "Review date", plan.reviewDate],
    [nl ? "Besproken met" : "Discussed with", plan.reviewedWith],
    [nl ? "Deelvoorkeuren" : "Sharing preferences", plan.sharingPreferences],
  ];
  return (
    <div className="space-y-3 py-3">
      {fields
        .filter(([, value]) => value)
        .map(([label, value]) => (
          <div key={label}>
            <h3 className="text-sm font-semibold">{label}</h3>
            <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
              {value}
            </p>
          </div>
        ))}
      <button
        className="min-h-11 rounded-xl border border-border px-3 text-sm"
        type="button"
        onClick={() => onRestore(previous)}
      >
        {nl
          ? "Gebruik als concept; nog niet opslaan"
          : "Use as draft; do not save yet"}
      </button>
    </div>
  );
}
