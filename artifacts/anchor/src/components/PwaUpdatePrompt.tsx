import { RefreshCw } from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { useT } from "@/hooks/useTranslation";
import { useRef, useState } from "react";
import { flushLocalDrafts } from "@/lib/localDrafts";
import { useActiveRegistration } from "@/contexts/ActiveRegistrationContext";

export function PwaUpdatePrompt() {
  const { t, language } = useT();
  const { storageError, retryPersistence } = useActiveRegistration();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const busyRef = useRef(false);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  const dismiss = () => {
    setNeedRefresh(false);
  };

  const update = async () => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(false);
    try {
      if (storageError) throw storageError;
      await flushLocalDrafts();
      if (!await retryPersistence()) throw new Error("Registration draft could not be saved.");
      await updateServiceWorker(true);
    } catch { setError(true); }
    finally { busyRef.current = false; setBusy(false); }
  };

  return (
    <aside
      className="fixed left-3 right-3 z-[60] mx-auto max-w-lg rounded-2xl border border-border bg-card p-3 shadow-xl shadow-black/25"
      style={{
        bottom:
          "calc(var(--bottom-nav-h) + var(--return-banner-h, 0px) + var(--storage-banner-h, 0px) + var(--data-warning-h, 0px) + 0.75rem)",
      }}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-labelledby="pwa-update-title"
      aria-describedby="pwa-update-description"
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <div className="shrink-0 rounded-xl bg-primary/10 p-2 text-primary">
          <RefreshCw size={19} strokeWidth={1.9} />
        </div>
        <div className="min-w-0">
          <h2 id="pwa-update-title" className="text-sm font-semibold text-foreground">
            {t("pwa.update.title")}
          </h2>
          <p
            id="pwa-update-description"
            className="mt-1 text-xs leading-relaxed text-muted-foreground"
          >
            {t("pwa.update.body")}
          </p>
        </div>
      </div>

      {error && <p role="alert" className="mt-3 text-sm text-destructive">{language === "nl" ? "Bijwerken is uitgesteld omdat invoer nog niet veilig is bewaard. Ga terug naar het formulier en probeer opslaan opnieuw." : "Update postponed because input has not been safely saved. Return to the form and retry saving."}</p>}
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={dismiss}
          className="min-h-11 rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          {t("pwa.update.later")}
        </button>
        <button
          type="button"
          onClick={() => void update()}
          disabled={busy}
          className="min-h-11 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          {t("pwa.update.action")}
        </button>
      </div>
    </aside>
  );
}
