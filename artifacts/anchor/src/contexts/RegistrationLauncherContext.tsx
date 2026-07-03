import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { RegistrationTypeList } from "@/components/RegistrationTypeList";
import { useT } from "@/hooks/useTranslation";

type RegistrationLauncherContextValue = {
  openRegistrationLauncher: () => void;
  closeRegistrationLauncher: () => void;
};

const RegistrationLauncherContext = createContext<RegistrationLauncherContextValue | null>(null);

export function RegistrationLauncherProvider({ children }: { children: React.ReactNode }) {
  const { t } = useT();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  const value = useMemo<RegistrationLauncherContextValue>(
    () => ({
      openRegistrationLauncher: () => setIsOpen(true),
      closeRegistrationLauncher: () => setIsOpen(false),
    }),
    [],
  );

  return (
    <RegistrationLauncherContext.Provider value={value}>
      {children}
      {isOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 px-3 pb-[calc(var(--bottom-nav-h)+0.75rem)] pt-safe"
          role="dialog"
          aria-modal="true"
          aria-labelledby="registration-launcher-title"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            onClick={() => setIsOpen(false)}
            aria-label={t("common.cancel")}
          />
          <div className="relative w-full max-w-lg rounded-t-[2rem] border border-border/60 bg-background p-4 shadow-2xl shadow-black/40">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 id="registration-launcher-title" className="text-base font-semibold text-foreground">
                  {t("registrations.new_title")}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {t("registrations.description")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="shrink-0 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                aria-label={t("common.cancel")}
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>
            <div className="max-h-[60dvh] overflow-y-auto scroll-smooth-ios pr-1">
              <RegistrationTypeList onSelect={() => setIsOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </RegistrationLauncherContext.Provider>
  );
}

export function useRegistrationLauncher() {
  const context = useContext(RegistrationLauncherContext);
  if (!context) {
    throw new Error("useRegistrationLauncher must be used within RegistrationLauncherProvider");
  }
  return context;
}
