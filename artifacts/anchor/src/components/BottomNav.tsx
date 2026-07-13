import { Link, useLocation } from "wouter";
import {
  BarChart2,
  BookOpen,
  ClipboardList,
  Home,
  Plus,
  Settings,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useT } from "@/hooks/useTranslation";
import { useRegistrationLauncher } from "@/contexts/RegistrationLauncherContext";

type NavItem = {
  to: string;
  icon: LucideIcon;
  label: string;
  displayLabel?: string;
  match: (path: string) => boolean;
};

export function BottomNav() {
  const [location] = useLocation();
  const { t } = useT();
  const { openRegistrationLauncher } = useRegistrationLauncher();

  const items: NavItem[] = [
    {
      to: "/",
      icon: Home,
      label: t("nav.home"),
      match: (path) => path === "/",
    },
    {
      to: "/tools",
      icon: Zap,
      label: t("nav.tools"),
      match: (path) => path.startsWith("/tools") || path.startsWith("/delay"),
    },
    {
      to: "/journal",
      icon: BookOpen,
      label: t("nav.journal"),
      match: (path) => path.startsWith("/journal"),
    },
    {
      to: "/registraties",
      icon: ClipboardList,
      label: t("nav.log"),
      match: (path) => path.startsWith("/registraties"),
    },
    {
      to: "/insights",
      icon: BarChart2,
      label: t("nav.insights"),
      match: (path) => path.startsWith("/insights"),
    },
    {
      to: "/settings",
      icon: Settings,
      label: t("nav.settings"),
      displayLabel: t("nav.settings_short"),
      match: (path) => path.startsWith("/settings"),
    },
  ];

  const renderItem = ({ to, icon: Icon, label, displayLabel, match }: NavItem) => {
    const isActive = match(location);
    return (
      <Link key={to} href={to} asChild>
        <a
          className="relative flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          aria-label={label}
          aria-current={isActive ? "page" : undefined}
        >
          <Icon
            size={20}
            strokeWidth={isActive ? 2 : 1.5}
            className={`relative transition-colors duration-200 ${
              isActive
                ? "text-primary"
                : "text-muted-foreground"
            }`}
          />
          <span
            className={`relative max-w-full truncate text-[9px] font-medium leading-tight transition-colors duration-200 min-[360px]:text-[10px] ${
              isActive
                ? "text-primary"
                : "text-muted-foreground"
            }`}
          >
            {displayLabel ?? label}
          </span>
        </a>
      </Link>
    );
  };

  return (
    <footer className="bottom-nav-shell fixed inset-x-0 bottom-0 z-50 border-0 bg-background/90 backdrop-blur-lg">
      <div className="relative mx-auto flex w-full items-center px-1 pb-[calc(0.55rem+env(safe-area-inset-bottom,0px))] pt-2">
        <nav className="flex min-w-0 flex-1 items-center justify-around" aria-label={`${t("nav.aria")} — ${t("nav.home")}, ${t("nav.tools")}, ${t("nav.journal")}`}>
          {items.slice(0, 3).map(renderItem)}
        </nav>
        <button
          type="button"
          onClick={openRegistrationLauncher}
          className="relative z-10 flex h-11 w-11 shrink-0 -translate-y-1 items-center justify-center rounded-full border border-primary/40 bg-primary text-primary-foreground shadow-md shadow-black/20 transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          aria-label={t("nav.new_registration")}
        >
          <Plus size={22} strokeWidth={2.4} />
        </button>
        <nav className="flex min-w-0 flex-1 items-center justify-around" aria-label={`${t("nav.aria")} — ${t("nav.log")}, ${t("nav.insights")}, ${t("nav.settings")}`}>
          {items.slice(3).map(renderItem)}
        </nav>
      </div>
    </footer>
  );
}
