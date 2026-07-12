import { useEffect } from "react";
import { useLocation } from "wouter";
import { RotateCcw } from "lucide-react";
import { useActiveRegistration } from "@/contexts/ActiveRegistrationContext";
import { useT } from "@/hooks/useTranslation";

// Shown while the user is off using a help tool launched mid-registration
// (session.pendingReturn is set). Fixed just above the BottomNav so it never
// collides with page headers. Tapping returns to the registration.
//
// While visible it publishes its footprint as the `--return-banner-h` CSS
// variable, which the app shell adds to the reserved bottom space so in-flow
// page buttons are pushed clear of the banner instead of sitting underneath it.
export function RegistrationReturnBanner() {
  const { session } = useActiveRegistration();
  const [location, navigate] = useLocation();
  const { t } = useT();
  const pending = session?.pendingReturn;
  const visible = !!pending && location !== pending.returnRoute;

  useEffect(() => {
    const root = document.documentElement;
    if (!visible) {
      root.style.removeProperty("--return-banner-h");
      return;
    }

    // Fixed 48px banner plus a 12px breathing gap for page actions.
    root.style.setProperty("--return-banner-h", "3.75rem");

    return () => {
      root.style.removeProperty("--return-banner-h");
    };
  }, [visible]);

  if (!visible || !pending) return null;

  return (
    <button
      onClick={() => navigate(pending.returnRoute)}
      className="fixed left-0 right-0 z-[55] h-12 bg-primary text-primary-foreground px-4 flex items-center justify-center gap-2 text-sm font-semibold shadow-lg active:opacity-90 transition-opacity"
      style={{ bottom: "var(--bottom-nav-h)" }}
      aria-label={t("resume.banner")}
    >
      <RotateCcw size={16} />
      {t("resume.banner")}
    </button>
  );
}
