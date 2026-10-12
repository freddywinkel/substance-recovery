import { ArrowLeft } from "lucide-react";
import { useLocation, useSearch } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRecoveryFeatures } from "@/contexts/RecoveryFeaturesContext";
import {
  balanceMomentPath,
  balanceToolContext,
} from "@/lib/balanceConnections";
import type { ReactNode } from "react";

export function useToolBalanceContext() {
  const [path] = useLocation();
  const search = useSearch();
  return balanceToolContext(path, search);
}

/** Keep the tool's main completion action connected to its after-check-in. */
export function ToolCompletionButton({
  children,
  className,
  onDefaultReturn,
}: {
  children: ReactNode;
  className: string;
  onDefaultReturn: () => void;
}) {
  const context = useToolBalanceContext();
  const { language } = useLanguage();
  const { balanceMoments } = useRecoveryFeatures();
  const [, navigate] = useLocation();
  const moment = context.id
    ? balanceMoments.find((record) => record.id === context.id)
    : null;
  return (
    <button
      type="button"
      className={className}
      onClick={() =>
        context.present
          ? navigate(moment ? balanceMomentPath(moment.id) : "/daily")
          : onDefaultReturn()
      }
    >
      {context.present
        ? language === "nl"
          ? "Terug naar activiteit-check-in"
          : "Return to activity check-in"
        : children}
    </button>
  );
}

/** Navigation alone neither records an attempt nor creates a second follow-up. */
export function ToolBalanceReturn({ className = "" }: { className?: string }) {
  const context = useToolBalanceContext();
  const { balanceMoments, loading, loadError } = useRecoveryFeatures();
  const { language } = useLanguage();
  const [, navigate] = useLocation();
  if (!context.present) return null;
  const moment = context.id
    ? balanceMoments.find((record) => record.id === context.id)
    : null;
  const missing = !loading && (!moment || !!loadError);
  const label =
    language === "nl"
      ? missing
        ? "Naar mijn dagoverzicht"
        : "Terug naar activiteit-check-in"
      : missing
        ? "Open my daily overview"
        : "Return to activity check-in";
  return (
    <div
      className={`border-b border-primary/20 bg-primary/5 px-4 py-2 ${className}`}
    >
      <button
        type="button"
        disabled={loading}
        onClick={() =>
          navigate(
            moment && !loadError ? balanceMomentPath(moment.id) : "/daily",
          )
        }
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-primary disabled:opacity-60"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        {loading
          ? language === "nl"
            ? "Check-in laden…"
            : "Loading check-in…"
          : label}
      </button>
      {missing ? (
        <p
          role="status"
          className="pb-1 text-center text-xs leading-relaxed text-muted-foreground"
        >
          {language === "nl"
            ? "De gekoppelde check-in is niet beschikbaar. Open je dagoverzicht om verder te gaan."
            : "The linked check-in is unavailable. Open your daily overview to continue."}
        </p>
      ) : (
        <p className="pb-1 text-center text-xs leading-relaxed text-muted-foreground">
          {language === "nl"
            ? "Vul daarna stemming, EIS en trek in en geef aan of je dit hebt geprobeerd."
            : "Afterwards, record mood, EIS and craving, and whether you tried this."}
        </p>
      )}
    </div>
  );
}
