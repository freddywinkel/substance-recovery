import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useActiveRegistration } from "@/contexts/ActiveRegistrationContext";
import { useT } from "@/hooks/useTranslation";

/**
 * Persistent, app-wide warning for a draft that IndexedDB could not store.
 * Unlike a transient toast, this remains visible until a retry succeeds.
 */
export function RegistrationStorageBanner() {
  const { storageError, retryPersistence } = useActiveRegistration();
  const { t } = useT();
  const [retrying, setRetrying] = useState(false);
  const visible = storageError !== null;

  useEffect(() => {
    const root = document.documentElement;
    if (!visible) {
      root.style.removeProperty("--storage-banner-h");
      return;
    }

    root.style.setProperty("--storage-banner-h", "5rem");
    return () => {
      root.style.removeProperty("--storage-banner-h");
    };
  }, [visible]);

  if (!visible) return null;

  const retry = async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      await retryPersistence();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed inset-x-0 z-[56] px-3 py-2"
      style={{ bottom: "calc(var(--bottom-nav-h) + var(--return-banner-h, 0px))" }}
    >
      <div className="mx-auto flex min-h-16 w-full max-w-lg items-center gap-3 rounded-2xl border border-destructive/40 bg-card px-3 py-2.5 shadow-xl">
        <AlertTriangle className="shrink-0 text-destructive" size={19} aria-hidden="true" />
        <p className="min-w-0 flex-1 text-xs font-medium leading-5 text-foreground">
          {t("registration.storage_error")}
        </p>
        <button
          type="button"
          onClick={() => { void retry(); }}
          disabled={retrying}
          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-semibold text-foreground disabled:opacity-60"
        >
          <RefreshCw size={14} className={retrying ? "animate-spin" : ""} aria-hidden="true" />
          {retrying ? t("common.saving") : t("registration.storage_retry")}
        </button>
      </div>
    </div>
  );
}
