import { blankUseDetail, selectedUseDetails, type UseDetail } from "@/lib/useDetails";
import { isBehavioralTarget, recoveryTargetLabel } from "@/lib/recoveryTargets";

export function UseDetailsEditor({ targets, value = [], onChange, language }: {
  targets: string[]; value?: UseDetail[]; onChange: (value: UseDetail[]) => void; language: "en" | "nl";
}) {
  const nl = language === "nl";
  const input = "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground";
  const update = (target: string, patch: Partial<UseDetail>) => {
    const current = value.find(item => item.target === target) ?? blankUseDetail(target);
    const next = { ...current, ...patch };
    if (next.amountStatus !== "approximate") { next.amount = ""; next.unit = ""; }
    onChange([...selectedUseDetails(value, targets).filter(item => item.target !== target), next]);
  };
  if (!targets.length) return null;
  return <details className="rounded-2xl border border-border bg-card p-4">
    <summary className="cursor-pointer text-sm font-medium touch-target">{nl ? "Gebruik of gedrag nader beschrijven (optioneel)" : "Describe use or behavior (optional)"}</summary>
    <p className="my-3 text-xs text-muted-foreground">{nl ? "Vul alleen in wat je wilt bespreken. Dit zijn schattingen, geen veilige doseringen. Leeg betekent niet ingevuld. Bij meerdere middelen kun je elk apart beschrijven." : "Record only what you want to discuss. These are estimates, not safe doses. Blank means unanswered. You can describe each substance separately."}</p>
    {targets.map(target => {
      const item = value.find(row => row.target === target) ?? blankUseDetail(target);
      const behavior = isBehavioralTarget(target);
      return <fieldset key={target} className="mb-4 space-y-3 rounded-xl border border-border p-3">
        <legend className="px-1 text-sm font-medium">{recoveryTargetLabel(target, language)}</legend>
        <label className="block text-xs">{nl ? (behavior ? "Welk gedrag / welke persoonlijke grens?" : "Naam / vorm van het middel, indien bekend") : (behavior ? "What behavior / personal boundary?" : "Substance name / form, if known")}
          <input className={input} maxLength={500} value={item.substanceName} onChange={e => update(target, { substanceName: e.target.value })} /></label>
        <label className="block text-xs">{nl ? "Hoeveelheid of omvang" : "Amount or extent"}
          <select className={input} value={item.amountStatus} onChange={e => update(target, { amountStatus: e.target.value as UseDetail["amountStatus"] })}>
            <option value="unanswered">{nl ? "Niet ingevuld" : "Unanswered"}</option><option value="approximate">{nl ? "Ongeveer" : "Approximate"}</option><option value="unknown">{nl ? "Onbekend" : "Unknown"}</option><option value="prefer-not">{nl ? "Liever niet delen" : "Prefer not to share"}</option>
          </select></label>
        {item.amountStatus === "approximate" && <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label className="block text-xs">{nl ? "Schatting" : "Estimate"}<input className={input} maxLength={500} value={item.amount} onChange={e => update(target, { amount: e.target.value })} /></label>
          <label className="block text-xs">{nl ? "Eenheid (bijvoorbeeld glazen, mg, uren, euro)" : "Unit (for example glasses, mg, hours, euros)"}<input className={input} maxLength={500} value={item.unit} onChange={e => update(target, { unit: e.target.value })} /></label>
        </div>}
        {!behavior && <label className="block text-xs">{nl ? "Manier van gebruik (optioneel)" : "Route of use (optional)"}<input className={input} maxLength={500} value={item.route} onChange={e => update(target, { route: e.target.value })} /></label>}
        <label className="block text-xs">{nl ? "Tijdstip van dit gebruik / gedrag, indien bekend" : "Time of this use / behavior, if known"}<input type="datetime-local" className={input} value={item.occurredAt} onChange={e => update(target, { occurredAt: e.target.value })} /></label>
        {!behavior && <label className="block text-xs">{nl ? "Voorgeschreven medicatie?" : "Prescribed medication?"}<select className={input} value={item.prescribedUse} onChange={e => update(target, { prescribedUse: e.target.value as UseDetail["prescribedUse"] })}>
          <option value="unanswered">{nl ? "Niet ingevuld" : "Unanswered"}</option><option value="as-prescribed">{nl ? "Volgens voorschrift" : "As prescribed"}</option><option value="outside-prescription">{nl ? "Buiten voorschrift" : "Outside prescription"}</option><option value="not-applicable">{nl ? "Niet van toepassing" : "Not applicable"}</option><option value="unknown">{nl ? "Onbekend" : "Unknown"}</option>
        </select></label>}
        {value.some(row => row.target === target) && <button type="button" className="touch-target text-xs underline" onClick={() => onChange(value.filter(row => row.target !== target))}>{nl ? "Deze details wissen" : "Clear these details"}</button>}
      </fieldset>;
    })}
  </details>;
}
