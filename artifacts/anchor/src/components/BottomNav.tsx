import { Link, useLocation } from "wouter";
import {
  BarChart2,
  BookOpen,
  ClipboardList,
  Home,
  Plus,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useT } from "@/hooks/useTranslation";
import { useRegistrationLauncher } from "@/contexts/RegistrationLauncherContext";

type NavItem = {
  to: string;
  icon: LucideIcon;
  label: string;
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
  ];

  const renderItem = ({ to, icon: Icon, label, match }: NavItem) => {
    const isActive = match(location);
    return (
      <Link key={to} href={to} asChild>
        <a
          className="relative flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          aria-current={isActive ? "page" : undefined}
        >
          {isActive && <span className="absolute top-0.5 h-1 w-4 rounded-full bg-primary" />}
          <Icon
            size={22}
            strokeWidth={isActive ? 2 : 1.5}
            className={`relative transition-colors duration-200 ${
              isActive
                ? "text-primary"
                : "text-muted-foreground"
            }`}
          />
          <span
            className={`relative max-w-full truncate text-[10px] font-medium leading-tight transition-colors duration-200 min-[360px]:text-[11px] ${
              isActive
                ? "text-primary"
                : "text-muted-foreground"
            }`}
          >
            {label}
          </span>
        </a>
      </Link>
    );
  };

  return (
    <footer className="bottom-nav-shell fixed inset-x-0 bottom-0 z-50 h-[var(--bottom-nav-h)] border-0 bg-background/90 backdrop-blur-lg">
      <div className="relative mx-auto flex h-full w-full items-center px-1 pb-[env(safe-area-inset-bottom,0px)] pt-1">
        <nav className="flex min-w-0 flex-1 items-center justify-around" aria-label={`${t("nav.aria")} — ${t("nav.home")}, ${t("nav.tools")}`}>
          {items.slice(0, 2).map(renderItem)}
        </nav>
        <button
          type="button"
          onClick={openRegistrationLauncher}
          className="relative z-10 flex h-11 w-11 shrink-0 -translate-y-1 items-center justify-center rounded-full border border-primary/40 bg-primary text-primary-foreground shadow-md shadow-black/20 transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          aria-label={t("nav.new_registration")}
        >
          <Plus size={22} strokeWidth={2.4} />
        </button>
        <nav className="flex min-w-0 flex-1 items-center justify-around" aria-label={`${t("nav.aria")} — ${t("nav.journal")}, ${t("nav.log")}, ${t("nav.insights")}`}>
          {items.slice(2).map(renderItem)}
        </nav>
      </div>
    </footer>
  );
}
