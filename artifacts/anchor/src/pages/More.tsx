import { Link } from "wouter";
import { BarChart2, BookOpen, ChevronRight, Settings } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useT } from "@/hooks/useTranslation";

export function More() {
  const { t } = useT();
  const items = [
    {
      to: "/journal",
      icon: BookOpen,
      title: t("nav.journal"),
      description: t("journal.subtitle"),
    },
    {
      to: "/insights",
      icon: BarChart2,
      title: t("nav.insights"),
      description: t("progress.subtitle"),
    },
    {
      to: "/settings",
      icon: Settings,
      title: t("nav.settings"),
      description: t("more.settings_description"),
    },
  ];

  return (
    <div className="h-full overflow-y-auto scroll-smooth-ios">
      <PageHeader title={t("nav.more")} subtitle={t("more.subtitle")} />
      <main className="mx-auto w-full max-w-2xl px-4 py-4">
        <nav className="grid gap-3" aria-label={t("nav.more")}>
          {items.map(({ to, icon: Icon, title, description }) => (
            <Link key={to} href={to} asChild>
              <a className="flex min-h-20 items-center gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 active:bg-muted/60">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon size={22} strokeWidth={1.8} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">
                    {title}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                    {description}
                  </span>
                </span>
                <ChevronRight
                  size={19}
                  strokeWidth={1.8}
                  className="shrink-0 text-muted-foreground"
                />
              </a>
            </Link>
          ))}
        </nav>
      </main>
    </div>
  );
}
