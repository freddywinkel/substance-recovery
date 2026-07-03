import { Link, useLocation } from "wouter";
import {
  BarChart2,
  BookOpen,
  ClipboardList,
  Home,
  Settings,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useT } from "@/hooks/useTranslation";

type NavItem = {
  to: string;
  icon: LucideIcon;
  label: string;
  match: (path: string) => boolean;
};

export function BottomNav() {
  const [location] = useLocation();
  const { t } = useT();

  if (location.startsWith("/sign-in") || location.startsWith("/sign-up")) {
    return null;
  }

  const items: NavItem[] = [
    {
      to: "/",
      icon: Home,
      label: t("nav.home"),
      match: (path) => path === "/",
    },
    {
      to: "/registraties",
      icon: ClipboardList,
      label: t("nav.log"),
      match: (path) =>
        path.startsWith("/registraties") ||
        path.startsWith("/trek") ||
        path.startsWith("/craving") ||
        path.startsWith("/anxiety") ||
        path.startsWith("/boredom") ||
        path.startsWith("/relapse"),
    },
    {
      to: "/tools",
      icon: Zap,
      label: t("nav.tools"),
      match: (path) => path.startsWith("/tools") || path.startsWith("/delay"),
    },
    {
      to: "/insights",
      icon: BarChart2,
      label: t("nav.insights"),
      match: (path) => path.startsWith("/insights"),
    },
    {
      to: "/journal",
      icon: BookOpen,
      label: t("nav.journal"),
      match: (path) => path.startsWith("/journal"),
    },
    {
      to: "/settings",
      icon: Settings,
      label: t("nav.settings"),
      match: (path) => path.startsWith("/settings"),
    },
  ];

  return (
    <footer className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background shadow-[0_-12px_28px_rgba(0,0,0,0.38)]">
      <nav
        className="mx-auto grid w-full max-w-lg grid-cols-6 gap-0.5 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] pt-2"
        aria-label={t("nav.aria")}
      >
        {items.map(({ to, icon: Icon, label, match }) => {
          const isActive = match(location);
          return (
            <Link key={to} href={to} asChild>
              <a
                className="group relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
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
        })}
      </nav>
    </footer>
  );
}
