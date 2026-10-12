import { RefreshCw } from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { useT } from "@/hooks/useTranslation";
import { useEffect, useRef, useState } from "react";
import { flushLocalDrafts } from "@/lib/localDrafts";
import { useActiveRegistration } from "@/contexts/ActiveRegistrationContext";

export function PwaUpdatePrompt() {
  const { t, language } = useT();
  const { flushPersistence } = useActiveRegistration();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const busyRef = useRef(false);
  const reloadBusyRef = useRef(false);
  const activatedRef = useRef(false);
  const reloadRef = useRef<() => Promise<void>>(async () => undefined);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    // Another window can activate the waiting worker. Its Update button cannot
    // check this window's unsaved inputs, so every window guards its own reload.
    onNeedReload: () => {
      activatedRef.current = true;
      void reloadRef.current();
    },
  });

  reloadRef.current = async () => {
    if (reloadBusyRef.current) return;
    reloadBusyRef.current = true;
    setNeedRefresh(true); setBusy(true); setError(false);
    try {
      await flushLocalDrafts();
      await flushPersistence();
      window.location.reload();
    } catch { setError(true); }
    finally { reloadBusyRef.current = false; setBusy(false); }
  };

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const serviceWorker = navigator.serviceWorker;
    let previousController = serviceWorker.controller;
    const guardControllerChange = () => {
      const controller = serviceWorker.controller;
      const replacingController = previousController !== null && controller !== previousController;
      previousController = controller;
      // Workbox's reload callback may not be installed in a window that never
      // observed the waiting worker. Every already-controlled window still has
      // to check its input before switching to the newly activated app build.
      if (replacingController) {
        activatedRef.current = true;
        void reloadRef.current();
      }
    };
    serviceWorker.addEventListener("controllerchange", guardControllerChange);
    return () => serviceWorker.removeEventListener("controllerchange", guardControllerChange);
  }, []);

  if (!needRefresh) return null;

  const dismiss = () => {
    setNeedRefresh(false);
  };

  const update = async () => {
    if (busyRef.current || reloadBusyRef.current) return;
    busyRef.current = true; setBusy(true); setError(false);
    try {
      await flushLocalDrafts();
      await flushPersistence();
      if (activatedRef.current) await reloadRef.current();
      else await updateServiceWorker(true);
    } catch { setError(true); }
    finally { busyRef.current = false; setBusy(false); }
  };

  return (
    <aside
      className="fixed left-3 right-3 z-[60] mx-auto max-w-lg overflow-y-auto overscroll-contain rounded-2xl border border-border bg-card p-3 shadow-xl shadow-black/25 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
      style={{
        bottom:
          "calc(var(--bottom-nav-h) + var(--return-banner-h, 0px) + var(--storage-banner-h, 0px) + var(--data-warning-h, 0px) + 0.75rem)",
        maxHeight:
          "max(3rem, calc(100dvh - var(--bottom-nav-h) - var(--return-banner-h, 0px) - var(--storage-banner-h, 0px) - var(--data-warning-h, 0px) - 6.75rem))",
      }}
      tabIndex={0}
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
          className="min-h-11 max-w-full rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground [overflow-wrap:anywhere] transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          {t("pwa.update.later")}
        </button>
        <button
          type="button"
          onClick={() => void update()}
          disabled={busy}
          className="min-h-11 max-w-full rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground [overflow-wrap:anywhere] transition-all hover:opacity-90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          {t("pwa.update.action")}
        </button>
      </div>
    </aside>
  );
}
