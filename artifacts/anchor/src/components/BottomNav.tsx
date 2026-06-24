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
      className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label={t("nav.aria")}
    >
      <div className="flex items-stretch justify-around max-w-lg mx-auto">
        {navItems.map(({ to, icon: Icon, label }) => {
          const isActive =
            to === "/" ? location === "/" : location.startsWith(to);
          return (
            <Link key={to} href={to} asChild>
              <a
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-2 px-0.5 min-h-[52px] transition-colors duration-150 ${
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground/70"
                }`}
                aria-label={label}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon
                  size={20}
                  strokeWidth={isActive ? 2.2 : 1.6}
                  className={`transition-transform duration-200 ${isActive ? "scale-110" : ""}`}
                />
                <span className="text-[9px] font-medium leading-none tracking-tight">{label}</span>
              </a>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
