export function ContactDraftStatus({ error, conflict, retry, keepMine, language }: { error: Error | null; conflict: boolean; retry: () => void; keepMine: () => void; language: "en" | "nl" }) {
  if (!error) return null;
  const nl = language === "nl";
  return <div role="alert" className="rounded-xl border border-destructive p-3 text-sm space-y-2">
    <p>{conflict ? (nl ? "Dit concept is ook in een ander tabblad gewijzigd. Je invoer blijft hier staan." : "This draft was also changed in another tab. Your input is still here.") : (nl ? "Dit concept kon niet worden bewaard. Houd deze pagina open en probeer het opnieuw." : "This draft could not be saved. Keep this page open and retry.")}</p>
    <button type="button" className="touch-target underline" onClick={conflict ? keepMine : retry}>{conflict ? (nl ? "Mijn invoer bewaren" : "Keep my input") : (nl ? "Opnieuw proberen" : "Retry")}</button>
  </div>;
}
