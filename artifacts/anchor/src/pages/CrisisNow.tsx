import { Link } from "wouter";
import { useT } from "@/hooks/useTranslation";
import { useStore } from "@/hooks/useStore";
import { Wind, Eye, Waves, Rewind, Droplets, Heart, Shuffle, Phone } from "lucide-react";

export function CrisisNow() {
  const { t } = useT();
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

        {/* ── Crisis Service (prominent) ─────────────────── */}
        {crisisService && crisisService.name && crisisService.number && (
          <div className="bg-red-950/20 border border-red-800/30 rounded-2xl p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="rounded-xl p-2.5 bg-red-600/20 text-red-400 shrink-0">
                <Phone size={22} strokeWidth={1.8} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{t("help.crisisService.title")}</p>
                <p className="text-xs text-muted-foreground truncate">{crisisService.name}</p>
              </div>
            </div>
            <a
              href={`tel:${crisisService.number.replace(/\s/g, "")}`}
              className="flex items-center justify-center gap-2 w-full bg-red-600 hover:bg-red-700 text-white rounded-xl py-4 font-semibold text-base active:scale-[0.98] transition-all touch-target"
            >
              <Phone size={20} strokeWidth={2} />
              {t("help.crisisService.call")} — {crisisService.number}
            </a>
          </div>
        )}

        {/* ── Emergency Contacts ───────────────────────── */}
        {emergencyContacts.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Phone size={16} strokeWidth={1.8} className="text-primary shrink-0" />
              <p className="text-sm font-semibold text-foreground">{t("help.emergencyContacts.title")}</p>
            </div>
            <div className="flex flex-col gap-2">
              {emergencyContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center justify-between gap-3 bg-background border border-border rounded-xl px-4 py-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{contact.name}</p>
                    <p className="text-xs text-muted-foreground">{contact.relationship} · {contact.phone}</p>
                  </div>
                  <a
                    href={`tel:${contact.phone.replace(/\s/g, "")}`}
                    className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 text-primary rounded-lg px-3 py-2 text-xs font-semibold hover:bg-primary/15 active:scale-[0.97] transition-all touch-target shrink-0"
                  >
                    <Phone size={13} strokeWidth={2} />
                    {t("help.emergencyContacts.call")}
                  </a>
                </div>
              ))}
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
