import { useLocation } from "wouter";
import { RotateCcw } from "lucide-react";
import { useActiveRegistration } from "@/contexts/ActiveRegistrationContext";
import { useT } from "@/hooks/useT";

// Shown while the user is off using a help tool launched mid-registration
// (session.pendingReturn is set). It sits above the BottomNav in the app
// frame so page content never scrolls underneath it.
export function RegistrationReturnBanner() {
  const { session } = useActiveRegistration();
  const [location, navigate] = useLocation();
  const { t } = useT();

  const pending = session?.pendingReturn;
  const visible = !!pending && location !== pending.returnRoute;

  if (!visible || !pending) return null;

  return (
    <button
      onClick={() => navigate(pending.returnRoute)}
      className="shrink-0 bg-primary px-4 py-3 text-primary-foreground shadow-lg transition-opacity active:opacity-90"
    >
      <span className="mx-auto flex max-w-lg items-center justify-center gap-2 text-sm font-semibold">
        <RotateCcw size={16} />
        {t("resume.banner")}
      </span>
    </button>
  );
}
