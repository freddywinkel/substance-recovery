import { Link } from "wouter";
import { getSubstanceSafetyWarnings } from "@/lib/registrationSafety";
import { getTargetScopeCopy } from "@/lib/recoveryTargets";
/** Available before use and in goal preparation; never infers dependence or urgency. */
export function TargetSafetyAdvice({ targets, language, showScope = true }: { targets: string[]; language: "en" | "nl"; showScope?: boolean }) {
  const warnings = getSubstanceSafetyWarnings(targets, language);
  return <div className="space-y-3">
    {showScope && <p className="text-xs text-muted-foreground leading-relaxed">{getTargetScopeCopy(targets, language)}</p>}
    {warnings.map(warning => <div key={warning.key} className="rounded-xl border border-amber-500/35 bg-amber-500/5 p-3 space-y-2">
      <p className="text-sm font-medium">{warning.title}</p><p className="text-xs leading-relaxed text-muted-foreground">{warning.body}</p>
    </div>)}
    <Link href="/help" className="text-sm text-primary underline touch-target inline-flex items-center">{language === "nl" ? "Hulp en medische veiligheidsinformatie" : "Help and medical safety information"}</Link>
  </div>;
}
