import { useEffect, useState } from "react";
import { Database, RefreshCw } from "lucide-react";
import {
  retryLogIntegrityChecks,
  useLogIntegrityStatus,
} from "@/hooks/useLogs";
import { useT } from "@/hooks/useTranslation";
import { useRecoveryFeatures } from "@/contexts/RecoveryFeaturesContext";

/**
 * Global, persistent warning for log reads that failed. A committed-write
 * readback failure is deliberately worded differently: the write succeeded,
 * but the currently visible lists may be stale.
 */
export function DataIntegrityBanner() {
  const { loadError, readbackIssue } = useLogIntegrityStatus();
  const { loadError: featureLoadError, refresh: refreshRecoveryFeatures } = useRecoveryFeatures();
  const { t } = useT();
  const [retrying, setRetrying] = useState(false);
  const visible = loadError !== null || featureLoadError !== null || readbackIssue !== null;

  useEffect(() => {
    const root = document.documentElement;
    if (!visible) {
      root.style.removeProperty("--data-warning-h");
      return;
    }

    root.style.setProperty("--data-warning-h", "5.5rem");
    return () => {
      root.style.removeProperty("--data-warning-h");
    };
  }, [visible]);

  if (!visible) return null;

  const retry = async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      await Promise.all([retryLogIntegrityChecks(), refreshRecoveryFeatures()]);
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed inset-x-0 z-[57] px-3 py-2"
      style={{
        bottom: "calc(var(--bottom-nav-h) + var(--return-banner-h, 0px) + var(--storage-banner-h, 0px))",
      }}
    >
      <div className="mx-auto flex min-h-16 w-full max-w-lg items-center gap-3 rounded-2xl border border-destructive/40 bg-card px-3 py-2.5 shadow-xl">
        <Database className="shrink-0 text-destructive" size={19} aria-hidden="true" />
        <p className="min-w-0 flex-1 text-xs font-medium leading-5 text-foreground">
          {loadError || featureLoadError
            ? t("data.warning.read_failed")
            : t("data.warning.readback_failed")}
        </p>
        <button
          type="button"
          onClick={() => { void retry(); }}
          disabled={retrying}
          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-semibold text-foreground disabled:opacity-60"
        >
          <RefreshCw size={14} className={retrying ? "animate-spin" : ""} aria-hidden="true" />
          {retrying ? t("common.saving") : t("data.warning.retry")}
        </button>
      </div>
    </div>
  );
}
