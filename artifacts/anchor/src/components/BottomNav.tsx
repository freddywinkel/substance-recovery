import { Link, useLocation } from "wouter";
import {
  ClipboardList,
  Home,
  MoreHorizontal,
  Plus,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { useT } from "@/hooks/useT";
import { MoreMenu } from "./MoreMenu";
import { QuickLog } from "./QuickLog";

type NavItem = {
  to: string;
  icon: LucideIcon;
  label: string;
};

export function BottomNav() {
  const [location] = useLocation();
  const { t } = useT();
  const [quickLogOpen, setQuickLogOpen] = useState(false);

  if (location.startsWith("/sign-in") || location.startsWith("/sign-up")) {
    return null;
  }

  const leadingItems: NavItem[] = [
    { to: "/", icon: Home, label: t("nav.home") },
    { to: "/registraties", icon: ClipboardList, label: t("nav.log") },
  ];

  const trailingItems: NavItem[] = [
    { to: "/tools", icon: Zap, label: t("nav.tools") },
  ];

  const isMoreActive =
    location.startsWith("/settings") ||
    location.startsWith("/journal") ||
    location.startsWith("/help") ||
    location.startsWith("/insights");

  const renderNavLink = ({ to, icon: Icon, label }: NavItem) => {
    const isActive = to === "/" ? location === "/" : location.startsWith(to);

    return (
      <Link key={to} href={to} asChild>
        <a
          className="group relative flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-full px-1 py-1.5 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          aria-label={label}
          aria-current={isActive ? "page" : undefined}
        >
          <span
            className={`absolute inset-x-1 inset-y-1 rounded-full transition-all duration-300 ${
              isActive
                ? "bg-white/10 shadow-[0_0_24px_rgba(255,255,255,0.08)]"
                : "bg-white/0"
            }`}
          />
          <Icon
            size={16}
            strokeWidth={isActive ? 2.2 : 1.6}
            className={`relative transition-all duration-300 ${
              isActive
                ? "scale-110 text-white"
                : "text-white/40 group-hover:text-white/60"
            }`}
          />
          <span
            className={`relative max-w-full truncate text-[8px] font-medium tracking-normal transition-colors duration-300 ${
              isActive
                ? "text-white"
                : "text-white/35 group-hover:text-white/50"
            }`}
          >
            {label}
          </span>
        </a>
      </Link>
    );
  };

  return (
    <>
      <nav
        className="fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] left-1/2 z-50 w-[calc(100%-1.5rem)] max-w-lg -translate-x-1/2 rounded-full border border-white/10 bg-[#151313]/85 px-2 py-2 shadow-2xl shadow-black/50 backdrop-blur-2xl"
        aria-label={t("nav.aria")}
      >
        <div className="grid grid-cols-5 items-center gap-1">
          {leadingItems.map(renderNavLink)}

          <button
            type="button"
            onClick={() => setQuickLogOpen(true)}
            className="group relative flex min-h-[3.25rem] items-center justify-center rounded-full px-1 py-1.5 transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            aria-label={t("quicklog.title")}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform duration-150 group-hover:scale-105">
              <Plus size={22} strokeWidth={2.5} />
            </span>
          </button>

          {trailingItems.map(renderNavLink)}

          <MoreMenu isActive={isMoreActive}>
            <MoreHorizontal
              size={16}
              strokeWidth={isMoreActive ? 2.2 : 1.6}
              className={`relative transition-all duration-300 ${
                isMoreActive
                  ? "scale-110 text-white"
                  : "text-white/40 group-hover:text-white/60"
              }`}
            />
            <span
              className={`relative max-w-full truncate text-[8px] font-medium tracking-normal transition-colors duration-300 ${
                isMoreActive
                  ? "text-white"
                  : "text-white/35 group-hover:text-white/50"
              }`}
            >
              {t("nav.more")}
            </span>
          </MoreMenu>
        </div>
      </nav>

      <QuickLog open={quickLogOpen} onOpenChange={setQuickLogOpen} />
    </>
  );
}
