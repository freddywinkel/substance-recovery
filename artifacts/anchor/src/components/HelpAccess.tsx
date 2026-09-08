import { Link } from "wouter";
import { Phone, ListChecks } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export function HelpAccess() {
  const { language } = useLanguage();
  return <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 border-b border-border/50 bg-card/70 px-4" aria-label={language === "nl" ? "Snelle toegang" : "Quick access"}>
    <Link href="/action-card" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><ListChecks size={16} aria-hidden="true" />{language === "nl" ? "Mijn actiekaart" : "My action card"}</Link>
    <Link href="/help" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Phone size={16} aria-hidden="true" />{language === "nl" ? "Nu hulp" : "Help now"}</Link>
  </div>;
}
