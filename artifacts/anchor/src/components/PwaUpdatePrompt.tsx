import { RefreshCw } from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { useT } from "@/hooks/useTranslation";

export function PwaUpdatePrompt() {
  const { t } = useT();
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!offlineReady && !needRefresh) return null;

  const dismiss = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  const update = () => {
    void updateServiceWorker(true);
  };

  return (
    <aside
      className="fixed left-4 right-4 z-[80] mx-auto flex max-w-lg flex-col gap-4 rounded-3xl border border-border bg-card p-4 shadow-xl shadow-black/25 sm:flex-row sm:items-center sm:justify-between"
      style={{
        bottom:
          "calc(var(--bottom-nav-h) + var(--return-banner-h, 0px) + 0.75rem)",
      }}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-labelledby="pwa-update-title"
      aria-describedby="pwa-update-description"
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className="shrink-0 rounded-xl bg-primary/10 p-2.5 text-primary">
          <RefreshCw size={20} strokeWidth={1.9} />
        </div>
        <div className="min-w-0">
          <h2 id="pwa-update-title" className="text-sm font-semibold text-foreground">
            {needRefresh ? t("pwa.update.title") : t("pwa.offline.title")}
          </h2>
          <p
            id="pwa-update-description"
            className="mt-1 text-xs leading-relaxed text-muted-foreground"
          >
            {needRefresh ? t("pwa.update.body") : t("pwa.offline.body")}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 gap-2">
        {needRefresh && (
          <button
            type="button"
            onClick={update}
            className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 sm:flex-none"
          >
            {t("pwa.update.action")}
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 sm:flex-none"
        >
          {needRefresh ? t("pwa.update.later") : t("pwa.offline.dismiss")}
        </button>
      </div>
    </aside>
  );
}
