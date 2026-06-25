import { Link, useLocation } from "wouter";
import {
  Home,
  ClipboardList,
  Zap,
  BarChart2,
  MoreHorizontal,
  Plus,
} from "lucide-react";
import { useState } from "react";
import { useT } from "@/hooks/useT";
import { MoreMenu } from "./MoreMenu";
import { QuickLog } from "./QuickLog";

export function BottomNav() {
  const [location] = useLocation();
  const { t } = useT();
  const [quickLogOpen, setQuickLogOpen] = useState(false);

  if (location.startsWith("/sign-in") || location.startsWith("/sign-up")) {
    return null;
  }

  const mainItems = [
    { to: "/", icon: Home, label: t("nav.home") },
    { to: "/registraties", icon: ClipboardList, label: t("nav.log") },
    { to: "/tools", icon: Zap, label: t("nav.tools") },
    { to: "/progress", icon: BarChart2, label: t("nav.insights") },
  ];

  const isMoreActive =
    location.startsWith("/settings") ||
    location.startsWith("/journal") ||
    location.startsWith("/help");

  return (
    <>
      <nav
        className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-1.5rem)] max-w-lg -translate-x-1/2 rounded-full border border-white/10 bg-[#151313]/80 px-2 py-2 shadow-2xl shadow-black/50 backdrop-blur-2xl pb-[calc(env(safe-area-inset-bottom)+0.5rem)]"
        aria-label={t("nav.aria")}
      >
        <div className="grid grid-cols-5 items-center">
          {mainItems.map(({ to, icon: Icon, label }) => {
            const isActive =
              to === "/" ? location === "/" : location.startsWith(to);
            return (
              <Link key={to} href={to} asChild>
                <a
                  className="group relative flex flex-col items-center justify-center gap-0.5 rounded-full py-1.5 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  aria-label={label}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span
                    className={`absolute inset-x-1 inset-y-0.5 rounded-full transition-all duration-300 ${
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
                        ? "text-white scale-110"
                        : "text-white/40 group-hover:text-white/60"
                    }`}
                  />
                  <span
                    className={`relative text-[8px] font-medium tracking-tight transition-colors duration-300 ${
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
          })}

          <MoreMenu isActive={isMoreActive}>
            <MoreHorizontal
              size={16}
              strokeWidth={isMoreActive ? 2.2 : 1.6}
              className={`relative transition-all duration-300 ${
                isMoreActive
                  ? "text-white scale-110"
                  : "text-white/40 group-hover:text-white/60"
              }`}
            />
            <span
              className={`relative text-[8px] font-medium tracking-tight transition-colors duration-300 ${
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

      {/* Floating Plus button — centered above the nav bar */}
      <button
        type="button"
        onClick={() => setQuickLogOpen(true)}
        className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom)+0.5rem)] left-1/2 z-[60] -translate-x-1/2 -translate-y-1/2 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-all duration-150 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        aria-label={t("quicklog.title")}
      >
        <Plus size={22} strokeWidth={2.5} />
      </button>

      <QuickLog open={quickLogOpen} onOpenChange={setQuickLogOpen} />
    </>
  );
}
