import { Link } from "wouter";
import {
  BarChart2,
  BookOpen,
  CalendarRange,
  ChevronRight,
  FileText,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useT } from "@/hooks/useTranslation";

export function More() {
  const { t, language } = useT();
  const items = [
    {
      to: "/recovery-plan",
      icon: ShieldCheck,
      title: language === "nl" ? "Mijn herstelplan" : "My recovery plan",
      description: language === "nl"
        ? "Waarschuwingssignalen, redenen, contacten en je plan voor de komende 24 uur."
        : "Warning signs, reasons, contacts and your plan for the next 24 hours.",
    },
    {
      to: "/actions",
      icon: Sparkles,
      title: language === "nl" ? "Ondersteunende vooruitgang" : "Supportive progress",
      description: language === "nl"
        ? "Leg contact, zorg, hulpmiddelen en persoonlijke doelen vast."
        : "Record contact, care, tools and personal goals.",
    },
    {
      to: "/weekly-review",
      icon: CalendarRange,
      title: language === "nl" ? "Weekoverzicht" : "Weekly review",
      description: language === "nl"
        ? "Bekijk patronen met aantallen en maak één plan voor volgende week."
        : "Review patterns with denominators and make one plan for next week.",
    },
    {
      to: "/report",
      icon: FileText,
      title: language === "nl" ? "Afdrukbaar verslag" : "Printable report",
      description: language === "nl"
        ? "Kies periode en velden en druk lokaal af of bewaar als pdf."
        : "Choose dates and fields, then print locally or save as PDF.",
    },
    {
      to: "/home-customization",
      icon: SlidersHorizontal,
      title: language === "nl" ? "Thuis aanpassen" : "Edit Home",
      description: language === "nl"
        ? "Toon, verberg en verplaats kaarten en kies snelle toegang."
        : "Show, hide and reorder cards and choose quick access.",
    },
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
      <div className="mx-auto w-full max-w-2xl px-4 py-4">
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
      </div>
    </div>
  );
}
