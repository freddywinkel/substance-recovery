import { Link } from "wouter";
import { useT } from "@/hooks/useT";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Settings,
  BookOpen,
  Zap,
  HelpCircle,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";

const MORE_ITEMS = [
  { to: "/journal", icon: BookOpen, labelKey: "nav.journal" },
  { to: "/help", icon: Zap, labelKey: "nav.help" },
  { to: "/settings", icon: Settings, labelKey: "nav.settings" },
];

export function MoreMenu({
  children,
  isActive,
}: {
  children: React.ReactNode;
  isActive?: boolean;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className="group relative flex flex-col items-center justify-center gap-0.5 rounded-full py-1.5 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          aria-label={t("nav.more")}
          aria-expanded={open}
          type="button"
        >
          <span
            className={`absolute inset-x-1 inset-y-0.5 rounded-full transition-all duration-300 ${
              isActive
                ? "bg-white/10 shadow-[0_0_24px_rgba(255,255,255,0.08)]"
                : "bg-white/0"
            }`}
          />
          {children}
        </button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl border-border/50 bg-background pb-[calc(env(safe-area-inset-bottom)+1rem)]"
      >
        <SheetHeader className="text-left">
          <SheetTitle className="text-base font-semibold">
            {t("nav.more")}
          </SheetTitle>
        </SheetHeader>
        <nav aria-label={t("nav.more")} className="mt-4 flex flex-col gap-2">
          {MORE_ITEMS.map(({ to, icon: Icon, labelKey }) => (
            <Link key={to} href={to} asChild>
              <a
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-xl border border-border/50 bg-card px-4 py-3 transition-all duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 active:scale-[0.98]"
              >
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <Icon size={18} strokeWidth={1.8} />
                </div>
                <span className="flex-1 text-sm font-medium text-foreground">
                  {t(labelKey)}
                </span>
                <ChevronRight
                  size={16}
                  className="text-muted-foreground"
                />
              </a>
            </Link>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
