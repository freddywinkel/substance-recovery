import { useT } from "@/hooks/useTranslation";
import { GROWTH_COPY } from "@/lib/growthCopy";

/** Uses the caller's existing safe navigation/draft handoff. Never records use. */
export function BriefCompassionButton({
  onOpen,
  disabled,
}: {
  onOpen: () => void;
  disabled?: boolean;
}) {
  const { language } = useT();
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onOpen}
      className="min-h-12 w-full rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm font-medium text-primary disabled:opacity-50"
    >
      {GROWTH_COPY[language].short}
    </button>
  );
}
