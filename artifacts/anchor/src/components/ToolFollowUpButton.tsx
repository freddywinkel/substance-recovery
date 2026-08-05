import { useRef, useState } from "react";
import { CheckCircle2, Clock3 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRecoveryFeatures } from "@/contexts/RecoveryFeaturesContext";
import type { RecoveryToolId, ToolFollowUpRecord } from "@/lib/recoveryFeatures";

const COPY = {
  en: {
    button: "I used this tool",
    saving: "Saving…",
    saved: "Saved as a supportive action.",
    followUp: "A check-in will appear on Home in 10 minutes.",
    before: "Before using it, how strong was the feeling?",
    scale: "0 is none; 10 is the strongest",
    unsure: "Not sure",
    confirm: "Save and check again in 10 minutes",
    error: "This could not be saved. Please try again.",
  },
  nl: {
    button: "Ik heb dit hulpmiddel gebruikt",
    saving: "Opslaan…",
    saved: "Opgeslagen als ondersteunende actie.",
    followUp: "Over 10 minuten verschijnt er een check-in op Thuis.",
    before: "Hoe sterk was het gevoel voordat je dit hulpmiddel gebruikte?",
    scale: "0 is helemaal niet; 10 is het sterkst",
    unsure: "Weet ik niet",
    confirm: "Opslaan en over 10 minuten opnieuw vragen",
    error: "Opslaan is niet gelukt. Probeer het opnieuw.",
  },
} as const;

export interface ToolFollowUpButtonProps {
  toolId: RecoveryToolId;
  toolLabel: string;
  className?: string;
}

export function ToolFollowUpButton({ toolId, toolLabel, className = "" }: ToolFollowUpButtonProps) {
  const { language } = useLanguage();
  const copy = COPY[language];
  const { addRecoveryAction, recoveryActions, scheduleToolFollowUp } = useRecoveryFeatures();
  const scheduledRef = useRef<ToolFollowUpRecord | null>(null);
  const savingRef = useRef(false);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [expanded, setExpanded] = useState(false);
  const [feelingBefore, setFeelingBefore] = useState<number | "unknown" | null>(null);

  const recordUse = async () => {
    if (savingRef.current || state === "saved") return;
    savingRef.current = true;
    setState("saving");
    try {
      const followUp = scheduledRef.current ?? await scheduleToolFollowUp({
        toolId,
        toolLabel,
        feelingBefore: feelingBefore === "unknown" ? null : feelingBefore,
      });
      scheduledRef.current = followUp;
      if (!recoveryActions.some((action) => action.sourceId === followUp.id)) {
        await addRecoveryAction({
          actionType: "tool",
          label: toolLabel,
          sourceId: followUp.id,
        });
      }
      setState("saved");
    } catch {
      savingRef.current = false;
      setState("error");
    }
  };

  return (
    <div className={`w-full max-w-sm ${className}`}>
      {!expanded || state === "saved" ? (
        <button
          type="button"
          disabled={state === "saving" || state === "saved"}
          onClick={() => setExpanded(true)}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/15 active:scale-[0.98] disabled:opacity-80"
        >
          {state === "saved" ? <CheckCircle2 size={18} aria-hidden="true" /> : <Clock3 size={18} aria-hidden="true" />}
          {state === "saving" ? copy.saving : state === "saved" ? copy.saved : copy.button}
        </button>
      ) : (
        <fieldset className="rounded-2xl border border-primary/30 bg-card p-4">
          <legend className="px-1 text-sm font-semibold text-foreground">{copy.before}</legend>
          <p className="mt-1 text-xs text-muted-foreground">{copy.scale}</p>
          <div className="mt-3 grid grid-cols-6 gap-1.5">
            {Array.from({ length: 11 }, (_, score) => (
              <button
                key={score}
                type="button"
                aria-pressed={feelingBefore === score}
                onClick={() => setFeelingBefore(score)}
                className={`min-h-11 rounded-lg border text-sm font-semibold ${feelingBefore === score ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}
              >
                {score}
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-pressed={feelingBefore === "unknown"}
            onClick={() => setFeelingBefore("unknown")}
            className={`mt-2 min-h-11 w-full rounded-xl border px-3 text-sm font-medium ${feelingBefore === "unknown" ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground"}`}
          >
            {copy.unsure}
          </button>
          <button
            type="button"
            disabled={feelingBefore === null || state === "saving"}
            onClick={() => { void recordUse(); }}
            className="mt-3 min-h-12 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {state === "saving" ? copy.saving : copy.confirm}
          </button>
        </fieldset>
      )}
      <div aria-live="polite">
        {state === "saved" && <p className="mt-2 text-center text-xs leading-relaxed text-muted-foreground">{copy.followUp}</p>}
        {state === "error" && <p role="alert" className="mt-2 text-center text-xs text-destructive">{copy.error}</p>}
      </div>
    </div>
  );
}
