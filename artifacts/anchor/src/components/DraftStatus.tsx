import { useLanguage } from "@/contexts/LanguageContext";

export function DraftStatus({
  status,
  error,
  retry,
  conflict,
  keepMine,
}: {
  status: "idle" | "saving" | "saved" | "error";
  error: Error | null;
  retry: () => void;
  conflict?: boolean;
  keepMine?: () => void;
}) {
  const { language } = useLanguage();
  const nl = language === "nl";
  if (status === "idle") return null;
  return (
    <div
      role={error ? "alert" : "status"}
      className={`rounded-xl p-3 text-sm ${error ? "border border-destructive/50 bg-destructive/10" : "bg-muted/30 text-muted-foreground"}`}
    >
      {error
        ? conflict
          ? nl
            ? "Dit concept is ook in een ander tabblad gewijzigd. Jouw invoer staat hier nog. Kies bewust welke versie je bewaart."
            : "This draft changed in another tab. Your input is still here. Choose deliberately which version to keep."
          : nl
            ? "Het concept kon niet worden bewaard. Je invoer staat hier nog. Probeer opnieuw voordat je sluit of bijwerkt."
            : "The draft could not be saved. Your input is still here. Retry before closing or updating."
        : status === "saving"
          ? nl
            ? "Concept wordt lokaal bewaard…"
            : "Saving local draft…"
          : nl
            ? "Concept lokaal bewaard. Nog niet afgerond."
            : "Draft saved locally. Not submitted yet."}
      {error && (
        <button
          type="button"
          className="ml-2 underline font-medium min-h-11"
          onClick={conflict ? keepMine : retry}
        >
          {conflict
            ? nl
              ? "Bewaar mijn versie"
              : "Keep my version"
            : nl
              ? "Opnieuw proberen"
              : "Retry"}
        </button>
      )}
    </div>
  );
}
