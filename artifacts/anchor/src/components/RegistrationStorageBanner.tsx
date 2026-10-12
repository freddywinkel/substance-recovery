import { useEffect, useRef, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useActiveRegistration } from "@/contexts/ActiveRegistrationContext";
import { useT } from "@/hooks/useTranslation";
import { RegistrationSessionConflictError } from "@/db/registrationSessionSettings";

/**
 * Persistent, app-wide warning for a draft that IndexedDB could not store.
 * Unlike a transient toast, this remains visible until a retry succeeds.
 */
export function RegistrationStorageBanner() {
  const { storageError, retryPersistence, reloadSavedRegistration } = useActiveRegistration();
  const { t, language } = useT();
  const [retrying, setRetrying] = useState(false);
  const [reloadBlocked, setReloadBlocked] = useState(false);
  const visible = storageError !== null;
  const conflict = storageError instanceof RegistrationSessionConflictError;
  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (!visible) {
      root.style.removeProperty("--storage-banner-h");
      return;
    }

    const measure = () => root.style.setProperty("--storage-banner-h", `${bannerRef.current?.getBoundingClientRect().height ?? 80}px`);
    measure();
    const observer = new ResizeObserver(measure);
    if (bannerRef.current) observer.observe(bannerRef.current);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--storage-banner-h");
    };
  }, [visible]);

  if (!visible) return null;

  const retry = async () => {
    if (retrying) return;
    setRetrying(true);
    setReloadBlocked(false);
    try {
      if (conflict) setReloadBlocked(!await reloadSavedRegistration());
      else await retryPersistence();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div
      ref={bannerRef}
      role="alert"
      aria-live="assertive"
      className="fixed inset-x-0 z-[56] px-3 py-2"
      style={{ bottom: "calc(var(--bottom-nav-h) + var(--return-banner-h, 0px))" }}
    >
      <div className="mx-auto flex max-h-[40dvh] min-h-16 w-full max-w-lg flex-col gap-2 rounded-2xl border border-destructive/40 bg-card px-3 py-2.5 shadow-xl sm:flex-row sm:items-center sm:gap-3">
        <div
          role="region"
          aria-label={language === "nl" ? "Waarschuwing over niet-opgeslagen invoer" : "Unsaved input warning"}
          tabIndex={0}
          className="min-h-0 min-w-0 flex-1 overflow-y-auto rounded-lg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 shrink-0 text-destructive" size={19} aria-hidden="true" />
            <p id="registration-storage-warning" className="min-w-0 flex-1 text-xs font-medium leading-5 text-foreground [overflow-wrap:anywhere]">
              {conflict
                ? (language === "nl" ? "Dit concept is in een ander venster gewijzigd. Je invoer blijft hier staan. Opnieuw laden vervangt de niet opgeslagen registratie-invoer in dit venster door de opgeslagen versie." : "This draft changed in another window. Your input is still here. Reloading replaces this window's unsaved registration input with the saved version.")
                : t("registration.storage_error")}
              {reloadBlocked && <span className="mt-2 block">{language === "nl" ? "Opnieuw laden is niet gelukt. Bewaar andere open concepten en probeer opnieuw." : "The saved version could not be reloaded. Save other unfinished forms and retry."}</span>}
            </p>
          </div>
        </div>
        <button
          type="button"
          aria-describedby="registration-storage-warning"
          onClick={() => { void retry(); }}
          disabled={retrying}
          className="inline-flex min-h-10 w-full max-w-full shrink-0 items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-foreground [overflow-wrap:anywhere] disabled:opacity-60 sm:w-auto sm:max-w-36"
        >
          <RefreshCw size={14} className={retrying ? "animate-spin" : ""} aria-hidden="true" />
          {retrying ? t("common.saving") : conflict ? (language === "nl" ? "Opgeslagen versie laden" : "Reload saved version") : t("registration.storage_retry")}
        </button>
      </div>
    </div>
  );
}
