import { WifiOff, Wifi } from "lucide-react";
import { useT } from "@/hooks/useTranslation";

interface OfflineBannerProps {
  isOffline: boolean;
}

export function OfflineBanner({ isOffline }: OfflineBannerProps) {
  const { t } = useT();
  if (!isOffline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 left-0 right-0 z-[60] bg-muted border-b border-border flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground"
      style={{ top: "env(safe-area-inset-top, 0px)" }}
    >
      <WifiOff size={13} />
      <span>{t("offline.banner")}</span>
    </div>
  );
}
