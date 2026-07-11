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
  match: (path: string) => boolean;
};

export function BottomNav() {
  const [location] = useLocation();
  const { t } = useT();
  const { openRegistrationLauncher } = useRegistrationLauncher();

  const isRegistrationTracker =
    location.startsWith("/trek") ||
    location.startsWith("/craving") ||
    location.startsWith("/anxiety") ||
    location.startsWith("/boredom") ||
    location.startsWith("/relapse");

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
      match: (path) => path.startsWith("/settings"),
    },
  ];

  const renderItem = ({ to, icon: Icon, label, match }: NavItem) => {
    const isActive = match(location);
    return (
      <Link key={to} href={to} asChild>
        <a
          className="group relative flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-1.5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          aria-label={label}
          aria-current={isActive ? "page" : undefined}
        >
          <span
            className={`absolute inset-x-0.5 inset-y-0.5 rounded-xl transition-colors duration-200 ${
              isActive ? "bg-primary/10" : "bg-transparent"
            }`}
          />
          <Icon
            size={17}
            strokeWidth={isActive ? 2.25 : 1.75}
            className={`relative transition-colors duration-200 ${
              isActive
                ? "text-primary"
                : "text-muted-foreground group-hover:text-foreground"
            }`}
          />
          <span
            className={`relative max-w-full truncate text-[9px] font-semibold leading-tight tracking-normal transition-colors duration-200 ${
              isActive
                ? "text-primary"
                : "text-muted-foreground group-hover:text-foreground"
            }`}
          >
            {label}
          </span>
        </a>
      </Link>
    );
  };

  return (
    <footer className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background shadow-[0_-12px_28px_rgba(0,0,0,0.38)]">
      <nav
        className="mx-auto grid w-full max-w-xl grid-cols-[repeat(3,minmax(0,1fr))_4rem_repeat(3,minmax(0,1fr))] items-center gap-0.5 px-2 pb-[calc(0.55rem+env(safe-area-inset-bottom,0px))] pt-2"
        aria-label={t("nav.aria")}
      >
        {items.slice(0, 3).map(renderItem)}
        <button
          type="button"
          onClick={openRegistrationLauncher}
          className={`mx-auto flex h-14 w-14 -translate-y-2 items-center justify-center rounded-full border shadow-xl shadow-black/30 transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
            isRegistrationTracker
              ? "border-primary/70 bg-primary text-primary-foreground"
              : "border-primary/40 bg-primary text-primary-foreground hover:opacity-90"
          }`}
          aria-label={t("nav.new_registration")}
          aria-current={isRegistrationTracker ? "page" : undefined}
        >
          <Plus size={26} strokeWidth={2.4} />
        </button>
        {items.slice(3).map(renderItem)}
      </nav>
    </footer>
  );
}
