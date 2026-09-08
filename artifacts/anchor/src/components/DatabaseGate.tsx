import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { getDB } from "@/db/schema";
import { getDatabaseLifecycleStatus, subscribeDatabaseLifecycle } from "@/db/lifecycle";
import { useT } from "@/hooks/useTranslation";

/** Keep existing inputs mounted during a database interruption, but stop edits
 * until every data provider can start again against the compatible database. */
export function DatabaseGate({ children }: { children: ReactNode }) {
  const status = useSyncExternalStore(subscribeDatabaseLifecycle, getDatabaseLifecycleStatus);
  const [location] = useLocation();
  const { language } = useT();
  const nl = language === "nl";
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState(false);
  const locked = status !== null && location !== "/help";

  useEffect(() => { void getDB().catch(() => { /* lifecycle status carries the error */ }); }, []);

  async function retry() {
    if (retrying) return;
    if (status?.kind === "outdated") { window.location.reload(); return; }
    setRetrying(true);
    setRetryError(false);
    try { await getDB(); window.location.reload(); }
    catch { setRetryError(true); }
    finally { setRetrying(false); }
  }

  const title = status?.kind === "opening"
    ? (nl ? "Je gegevens openen…" : "Opening your data…")
    : status?.kind === "blocked"
      ? (nl ? "Sluit andere Anchor-vensters" : "Close other Anchor windows")
      : status?.kind === "outdated"
        ? (nl ? "Open de bijgewerkte app" : "Open the updated app")
        : status?.kind === "reload-required"
          ? (nl ? "Je gegevens zijn klaar om opnieuw te openen" : "Your data is ready to reopen")
          : (nl ? "Je gegevens zijn nu niet beschikbaar" : "Your data is currently unavailable");
  const detail = status?.kind === "blocked"
    ? (nl ? "Een andere tab of geïnstalleerd Anchor-venster houdt de vorige database open. Sluit die vensters en probeer opnieuw. De update wist geen gegevens." : "Another tab or installed Anchor window is keeping the previous database open. Close those windows and retry. This update does not erase data.")
    : status?.kind === "outdated"
      ? (nl ? "Een nieuwere app gebruikt deze database. Dit venster kan daarom niets meer opslaan. Werk de app bij en herlaad dit venster. Wis geen sitegegevens." : "A newer app uses this database. This window can no longer save. Update the app and reload this window. Do not clear site data.")
      : status?.kind === "reload-required"
        ? (nl ? "Herlaad Anchor om alle schermen met je bewaarde gegevens te openen." : "Reload Anchor to open every screen with your saved data.")
        : status?.kind === "unavailable"
          ? (nl ? "Anchor kan de lokale database niet openen. Probeer opnieuw. Je kunt hulp blijven openen; wis geen sitegegevens." : "Anchor cannot open the local database. Retry. Help remains available; do not clear site data.")
          : (nl ? "Even wachten terwijl Anchor je lokale database controleert." : "Please wait while Anchor checks your local database.");

  return <>
    {locked && <section role={status?.kind === "opening" ? "status" : "alert"} className="mx-auto flex h-full max-w-lg flex-col justify-center gap-4 overflow-y-auto p-6">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-sm leading-6 text-muted-foreground">{detail}</p>
      {status?.kind !== "opening" && <>
        <p className="text-sm leading-6 text-muted-foreground">{nl ? "Nog niet opgeslagen invoer blijft in dit venster zolang je het open houdt. Een herlaadactie kan niet opgeslagen invoer verliezen." : "Unsaved input stays in this window while it remains open. Reloading may lose unsaved input."}</p>
        <button type="button" disabled={retrying} onClick={() => { void retry(); }} className="min-h-11 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60">
          {retrying ? (nl ? "Opnieuw proberen…" : "Retrying…") : (nl ? "Opnieuw openen / herladen" : "Reopen / reload")}
        </button>
        {retryError && <p className="text-sm text-destructive">{nl ? "De database is nog niet beschikbaar. Sluit de andere Anchor-vensters en probeer opnieuw." : "The database is still unavailable. Close other Anchor windows and retry."}</p>}
      </>}
      <Link href="/help" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-4 text-sm font-semibold">{nl ? "Hulp nu openen" : "Open help now"}</Link>
    </section>}
    <div hidden={locked} inert={locked ? true : undefined} className="app-route-host h-full min-h-0">{children}</div>
  </>;
}
