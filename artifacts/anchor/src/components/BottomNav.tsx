import { Link, useLocation } from "wouter";
import {
  ClipboardList,
  Home,
  MoreHorizontal,
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
      to: "/registraties",
      icon: ClipboardList,
      label: t("nav.log"),
      match: (path) => path.startsWith("/registraties"),
    },
    {
      to: "/more",
      icon: MoreHorizontal,
      label: t("nav.more"),
      match: (path) =>
        path.startsWith("/more") ||
        path.startsWith("/journal") ||
        path.startsWith("/insights") ||
        path.startsWith("/settings") ||
        path.startsWith("/privacy"),
    },
  ];

  const renderItem = ({ to, icon: Icon, label, match }: NavItem) => {
    const isActive = match(location);
    return (
      <Link key={to} href={to} asChild>
        <a
          className="flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1 text-center transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          aria-label={label}
          aria-current={isActive ? "page" : undefined}
        >
          <Icon
            size={24}
            strokeWidth={isActive ? 2.15 : 1.65}
            className={isActive ? "text-primary" : "text-muted-foreground"}
          />
          <span
            className={`max-w-full truncate text-[11px] leading-none ${
              isActive
                ? "font-semibold text-primary"
                : "font-medium text-muted-foreground"
            }`}
          >
            {label}
          </span>
        </a>
      </Link>
    );
  };

  return (
    <footer className="bottom-nav-shell fixed inset-x-0 bottom-0 z-50 bg-card/95 backdrop-blur-xl">
      <nav
        className="mx-auto grid min-h-[var(--bottom-nav-h)] w-full max-w-lg grid-cols-5 items-center px-2 pb-[calc(0.25rem+env(safe-area-inset-bottom,0px))] pt-1"
        aria-label={t("nav.aria")}
      >
        {items.slice(0, 2).map(renderItem)}

        <button
          type="button"
          onClick={openRegistrationLauncher}
          className="flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          aria-label={t("nav.new_registration")}
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-black/25 transition-transform active:scale-95">
            <Plus size={27} strokeWidth={2.4} />
          </span>
          <span className="max-w-full truncate text-[11px] font-semibold leading-none text-primary">
            {t("nav.new_short")}
          </span>
        </button>

        {items.slice(2).map(renderItem)}
      </nav>
    </footer>
  );
}
