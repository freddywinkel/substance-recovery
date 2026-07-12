import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const open = useCallback(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    window.requestAnimationFrame(() => previousFocusRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    closeButtonRef.current?.focus();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close, isOpen]);

  const value = useMemo<RegistrationLauncherContextValue>(
    () => ({
      openRegistrationLauncher: open,
      closeRegistrationLauncher: close,
    }),
    [close, open],
  );

  return (
    <RegistrationLauncherContext.Provider value={value}>
      {children}
      {isOpen && (
        <div
          className="modal-overlay fixed inset-0 z-[70] flex items-end justify-center px-3 pb-[calc(var(--bottom-nav-h)+0.75rem)] pt-safe"
          role="dialog"
          aria-modal="true"
          aria-labelledby="registration-launcher-title"
        >
          <div
            className="absolute inset-0 cursor-default"
            onClick={close}
            aria-hidden="true"
          />
          <div ref={dialogRef} className="relative w-full max-w-lg rounded-[2rem] border border-border/60 bg-background p-4 shadow-2xl shadow-black/20 dark:shadow-black/40">
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
                ref={closeButtonRef}
                type="button"
                onClick={close}
                className="shrink-0 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                aria-label={t("common.cancel")}
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>
            <div className="max-h-[60dvh] overflow-y-auto scroll-smooth-ios pr-1">
              <RegistrationTypeList onSelect={close} />
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
