import { Activity } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export function BalanceMomentLink({
  onOpen,
  saving = false,
  saved = false,
}: {
  onOpen: () => void;
  saving?: boolean;
  saved?: boolean;
}) {
  const { language } = useLanguage();
  return (
    <section className="w-full rounded-2xl border border-primary/25 bg-primary/5 p-4 text-left">
      <button
        type="button"
        disabled={saving}
        onClick={onOpen}
        className="flex min-h-11 w-full items-center gap-2 text-sm font-semibold text-primary disabled:opacity-60"
      >
        <Activity size={18} className="shrink-0" aria-hidden="true" />
        {saving
          ? language === "nl"
            ? "Opslaan…"
            : "Saving…"
          : language === "nl"
            ? "Stemming en activiteit bijhouden"
            : "Track mood and an activity"}
      </button>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {language === "nl"
          ? `Voeg stemming en EIS toe, kies een hulpmiddel of eigen activiteit en kijk daarna opnieuw. Dit komt in je dagoverzicht.${saved ? "" : " Je registratieconcept blijft bewaard."}`
          : `Add mood and EIS, choose a tool or your own activity, then check again. This appears in your daily overview.${saved ? "" : " Your registration draft stays saved."}`}
      </p>
    </section>
  );
}
