import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { RotateCcw } from "lucide-react";
import { useActiveRegistration } from "@/contexts/ActiveRegistrationContext";
import { useT } from "@/hooks/useTranslation";

// Shown while the user is off using a help tool launched mid-registration
// (session.pendingReturn is set). Fixed just above the BottomNav so it never
// collides with page headers. Tapping returns to the registration.
//
// While visible it publishes its footprint as the `--return-banner-h` CSS
// variable, which `.pb-safe` adds to its bottom padding so in-flow page
// buttons (tool "continue"/"finish" actions) are pushed clear of the banner
// instead of sitting underneath it.
export function RegistrationReturnBanner() {
  const { session } = useActiveRegistration();
  const [location, navigate] = useLocation();
  const { t } = useT();
  const ref = useRef<HTMLButtonElement>(null);

  const pending = session?.pendingReturn;
  const visible = !!pending && location !== pending.returnRoute;

  useEffect(() => {
    const root = document.documentElement;
    if (!visible) {
      root.style.removeProperty("--return-banner-h");
      return;
    }

    const apply = () => {
      const h = ref.current?.offsetHeight ?? 48;
      // Reserve the banner height plus a small gap so the page button clears it.
      root.style.setProperty("--return-banner-h", `${h + 12}px`);
    };
    apply();

    let ro: ResizeObserver | undefined;
    if (ref.current && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(apply);
      ro.observe(ref.current);
    }

    return () => {
      ro?.disconnect();
      root.style.removeProperty("--return-banner-h");
    };
  }, [visible]);

  if (!visible || !pending) return null;

  return (
    <button
      ref={ref}
      onClick={() => navigate(pending.returnRoute)}
      className="fixed left-0 right-0 z-[55] bg-primary text-primary-foreground px-4 py-3 flex items-center justify-center gap-2 text-sm font-semibold shadow-lg active:opacity-90 transition-opacity"
      style={{ bottom: "calc(52px + env(safe-area-inset-bottom, 0px))" }}
    >
      <RotateCcw size={16} />
      {t("resume.banner")}
    </button>
  );
}
