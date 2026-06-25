import { Link } from "wouter";
import { useT } from "@/hooks/useT";
import { Siren } from "lucide-react";

export function SOSButton() {
  const { t } = useT();
  return (
    <Link href="/tools#crisis" asChild>
      <a
        className="fixed top-[calc(0.5rem+env(safe-area-inset-top,0px))] right-3 z-[55] flex h-9 w-9 items-center justify-center rounded-full bg-red-600 text-white shadow-lg shadow-red-900/30 transition-all duration-150 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50"
        aria-label={t("sos.label")}
        title={t("sos.label")}
      >
        <Siren size={16} strokeWidth={2} />
      </a>
    </Link>
  );
}
