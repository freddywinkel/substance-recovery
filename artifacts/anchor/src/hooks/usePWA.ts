import { createContext, createElement, useContext, useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type PWAContextValue = {
  installPrompt: BeforeInstallPromptEvent | null;
  isInstalled: boolean;
  install: () => Promise<void>;
};

const PWAContext = createContext<PWAContextValue | null>(null);

function usePWAState(): PWAContextValue {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    const mq = window.matchMedia("(display-mode: standalone)");
    setIsInstalled(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsInstalled(e.matches);
    mq.addEventListener("change", onChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      mq.removeEventListener("change", onChange);
    };
  }, []);

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setInstallPrompt(null);
      setIsInstalled(true);
    }
  };

  return { installPrompt, isInstalled, install };
}

export function PWAProvider({ children }: { children: React.ReactNode }) {
  const value = usePWAState();
  return createElement(PWAContext.Provider, { value }, children);
}

export function usePWA(): PWAContextValue {
  const value = useContext(PWAContext);
  if (!value) throw new Error("usePWA must be used within PWAProvider");
  return value;
}
