import { PersonalContactCard } from "@/components/PersonalContactCard";
import { CareContactCard } from "@/components/CareContactCard";
import { TargetSafetyAdvice } from "@/components/TargetSafetyAdvice";
import { careFallback } from "@/lib/careDirectory";
import { Link } from "wouter";
import { useT } from "@/hooks/useTranslation";
import { useStore } from "@/hooks/useStore";
import { Wind, Eye, Waves, Rewind, Droplets, Heart, Shuffle, Phone } from "lucide-react";

export function CrisisNow() {
  const { t, language } = useT();
  const { crisisService, emergencyContacts } = useStore();

  const TOOLS = [
    {
      to: "/tools/breathing",
      icon: Wind,
      title: t("crisis.tool.breathing.title"),
      description: t("crisis.tool.breathing.desc"),
      duration: t("crisis.tool.breathing.dur"),
      urgency: "immediate",
    },
    {
      to: "/tools/grounding",
      icon: Eye,
      title: t("crisis.tool.grounding.title"),
      description: t("crisis.tool.grounding.desc"),
      duration: t("crisis.tool.grounding.dur"),
      urgency: "immediate",
    },
    {
      to: "/tools/cold-water",
      icon: Droplets,
      title: t("crisis.tool.coldwater.title"),
      description: t("crisis.tool.coldwater.desc"),
      duration: t("crisis.tool.coldwater.dur"),
      urgency: "immediate",
    },
    {
      to: "/tools/urge-surfing",
      icon: Waves,
      title: t("crisis.tool.urge.title"),
      description: t("crisis.tool.urge.desc"),
      duration: t("crisis.tool.urge.dur"),
      urgency: "sustained",
    },
    {
      to: "/tools/tape",
      icon: Rewind,
      title: t("crisis.tool.tape.title"),
      description: t("crisis.tool.tape.desc"),
      duration: t("crisis.tool.tape.dur"),
      urgency: "sustained",
    },
    {
      to: "/tools/self-compassion",
      icon: Heart,
      title: t("crisis.tool.compassion.title"),
      description: t("crisis.tool.compassion.desc"),
      duration: t("crisis.tool.compassion.dur"),
      urgency: "sustained",
    },
    {
      to: "/tools/distraction",
      icon: Shuffle,
      title: t("crisis.tool.distraction.title"),
      description: t("crisis.tool.distraction.desc"),
      duration: t("crisis.tool.distraction.dur"),
      urgency: "sustained",
    },
  ];

  return (
    <div className="flex flex-col min-h-dvh bg-background">
      <header className="px-5 pt-6 pb-4 border-b border-border/50" style={{ paddingTop: "calc(1.5rem + env(safe-area-inset-top, 0px))" }}>
        <h1 className="text-2xl font-semibold text-foreground">{t("crisis.title")}</h1>
        <p className="text-muted-foreground text-sm mt-1 leading-relaxed">
          {t("crisis.subtitle")}
        </p>
      </header>

      <div className="flex-1 overflow-y-auto scroll-smooth-ios px-4 py-4 pb-safe flex flex-col gap-3">

        {/* Universal emergency routes stay visible even when no personal crisis service is configured. */}
        <section
          aria-labelledby="emergency-routes-title"
          className="bg-red-950/20 border border-red-800/40 rounded-2xl p-5 flex flex-col gap-3"
        >
          <div className="flex items-start gap-3">
            <div className="rounded-xl p-2.5 bg-red-600/20 text-red-400 shrink-0">
              <Phone size={22} strokeWidth={1.8} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 id="emergency-routes-title" className="text-sm font-semibold text-foreground">
                {t("help.emergency")}
              </h2>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                {t("crisis.emergency_text")}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <a
              href="tel:112"
              className="flex items-center justify-center gap-2 w-full bg-red-600 hover:bg-red-700 text-white rounded-xl py-3.5 px-3 font-semibold text-sm active:scale-[0.98] transition-all touch-target"
            >
              <Phone size={18} strokeWidth={2} aria-hidden="true" />
              {t("crisis.112")}
            </a>
            <a
              href="tel:113"
              className="flex items-center justify-center gap-2 w-full bg-card border border-red-800/40 text-foreground rounded-xl py-3.5 px-3 font-semibold text-sm hover:bg-muted active:scale-[0.98] transition-all touch-target"
            >
              <Phone size={18} strokeWidth={2} aria-hidden="true" />
              {t("crisis.113")}
            </a>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <h2 className="text-sm font-semibold">{language === "nl" ? "Dringende zorg en medische veiligheid" : "Urgent care and medical safety"}</h2>
          <p className="text-sm text-muted-foreground">{careFallback(language)}</p>
          <a href="https://www.113.nl" target="_blank" rel="noopener noreferrer" className="touch-target inline-flex items-center text-primary underline">{language === "nl" ? "Chat via 113.nl" : "Chat at 113.nl"}</a>
          <details><summary className="touch-target cursor-pointer text-sm">{language === "nl" ? "Stoppen of minderen met middelen" : "Stopping or reducing substance use"}</summary><TargetSafetyAdvice targets={["Alcohol", "Benzodiazepines", "GHB", "GBL", "Opioids", "Unknown substance"]} language={language} showScope={false} /></details>
        </section>
        {crisisService?.number && <CareContactCard service={crisisService} language={language} />}

        {/* ── Emergency Contacts ───────────────────────── */}
        {emergencyContacts.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Phone size={16} strokeWidth={1.8} className="text-primary shrink-0" />
              <p className="text-sm font-semibold text-foreground">{t("help.emergencyContacts.title")}</p>
            </div>
            <div className="flex flex-col gap-2">
              {emergencyContacts.map((contact) => <PersonalContactCard key={contact.id} contact={contact} language={language} />)}
            </div>
          </div>
        )}

        {/* ── Self-help tools ──────────────────────────── */}
        <p className="text-xs text-muted-foreground uppercase tracking-widest px-1 mt-1">{t("crisis.selfhelp")}</p>

        <p className="text-xs text-muted-foreground uppercase tracking-widest px-1">{t("crisis.fast")}</p>
        {TOOLS.filter((tool) => tool.urgency === "immediate").map((tool) => (
          <Link key={tool.to} href={tool.to} asChild>
            <a className="block animate-fade-up">
              <div className="bg-card border border-border rounded-2xl p-4 flex items-start gap-4 hover:border-primary/40 active:scale-[0.98] transition-all duration-200">
                <div className="rounded-xl p-2.5 bg-primary/10 text-primary shrink-0">
                  <tool.icon size={22} strokeWidth={1.8} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground">{tool.title}</span>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">{tool.duration}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 leading-snug">{tool.description}</p>
                </div>
              </div>
            </a>
          </Link>
        ))}

        <p className="text-xs text-muted-foreground uppercase tracking-widest px-1 mt-2">{t("crisis.sustained")}</p>
        {TOOLS.filter((tool) => tool.urgency === "sustained").map((tool) => (
          <Link key={tool.to} href={tool.to} asChild>
            <a className="block animate-fade-up">
              <div className="bg-card border border-border rounded-2xl p-4 flex items-start gap-4 hover:border-primary/40 active:scale-[0.98] transition-all duration-200">
                <div className="rounded-xl p-2.5 bg-primary/10 text-primary shrink-0">
                  <tool.icon size={22} strokeWidth={1.8} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground">{tool.title}</span>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">{tool.duration}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 leading-snug">{tool.description}</p>
                </div>
              </div>
            </a>
          </Link>
        ))}

        <div className="h-4" />
      </div>
    </div>
  );
}
