import { Link, useLocation } from "wouter";
import {
  Home,
  ClipboardList,
  Zap,
  BarChart2,
  MoreHorizontal,
} from "lucide-react";
import { useT } from "@/hooks/useT";
import { MoreMenu } from "./MoreMenu";

export function BottomNav() {
  const [location] = useLocation();
  const { t } = useT();

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
                {/* Active glow background */}
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
  );
}
