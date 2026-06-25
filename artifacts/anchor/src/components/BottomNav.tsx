import { Link, useLocation } from "wouter";
import { Home, Zap, BookOpen, BarChart2, Settings, ClipboardList } from "lucide-react";
import { useT } from "@/hooks/useT";

export function BottomNav() {
  const [location] = useLocation();
  const { t } = useT();

  if (location.startsWith("/sign-in") || location.startsWith("/sign-up")) {
    return null;
  }

  const navItems = [
    { to: "/", icon: Home, label: t("nav.home") },
    { to: "/help", icon: Zap, label: t("nav.help") },
    { to: "/journal", icon: BookOpen, label: t("nav.journal") },
    { to: "/logs", icon: ClipboardList, label: t("nav.logs") },
    { to: "/progress", icon: BarChart2, label: t("nav.progress") },
    { to: "/settings", icon: Settings, label: t("nav.settings") },
  ];

  return (
    <nav
      className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-full border border-white/10 bg-[#151313]/80 px-3 py-2 shadow-2xl shadow-black/50 backdrop-blur-2xl"
      style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}
      aria-label={t("nav.aria")}
    >
      <div className="grid grid-cols-6 items-center">
        {navItems.map(({ to, icon: Icon, label }) => {
          const isActive =
            to === "/" ? location === "/" : location.startsWith(to);
          return (
            <Link key={to} href={to} asChild>
              <a
                className="group relative flex flex-col items-center justify-center gap-1 rounded-full py-1.5 transition-all duration-300"
                aria-label={label}
                aria-current={isActive ? "page" : undefined}
              >
                {/* Active glow background */}
                <span
                  className={`absolute inset-x-1.5 inset-y-0.5 rounded-full transition-all duration-300 ${
                    isActive
                      ? "bg-white/10 shadow-[0_0_24px_rgba(255,255,255,0.08)]"
                      : "bg-white/0"
                  }`}
                />
                <Icon
                  size={18}
                  strokeWidth={isActive ? 2.2 : 1.6}
                  className={`relative transition-all duration-300 ${
                    isActive ? "text-white scale-110" : "text-white/40 group-hover:text-white/60"
                  }`}
                />
                <span
                  className={`relative text-[9px] font-medium tracking-tight transition-colors duration-300 ${
                    isActive ? "text-white" : "text-white/35 group-hover:text-white/50"
                  }`}
                >
                  {label}
                </span>
              </a>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
