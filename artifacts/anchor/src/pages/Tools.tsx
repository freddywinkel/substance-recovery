import { Link } from "wouter";
import { PageHeader } from "@/components/PageHeader";
import { useT } from "@/hooks/useT";
import { useStore } from "@/hooks/useStore";
import { usePinnedTools } from "@/hooks/usePinnedTools";
import {
  Wind,
  Eye,
  Waves,
  Rewind,
  Droplets,
  Heart,
  Shuffle,
  Phone,
  Pin,
  PinOff,
} from "lucide-react";

function PinButton({ toolId }: { toolId: string }) {
  const { t } = useT();
  const { isPinned, togglePin } = usePinnedTools();
  const pinned = isPinned(toolId);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        togglePin(toolId);
      }}
      className={`p-2 rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
        pinned
          ? "text-amber-300 bg-amber-400/10"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
      }`}
      aria-label={pinned ? t("tools.unpin") : t("tools.pin")}
      title={pinned ? t("tools.unpin") : t("tools.pin")}
    >
      {pinned ? <Pin size={16} strokeWidth={2} /> : <PinOff size={16} strokeWidth={2} />}
    </button>
  );
}

export function Tools() {
  const { t } = useT();
  const { crisisService, emergencyContacts } = useStore();

  const CRISIS_TOOLS = [
    {
      to: "/tools/breathing",
      icon: Wind,
      title: t("crisis.tool.breathing.title"),
      description: t("crisis.tool.breathing.desc"),
      duration: t("crisis.tool.breathing.dur"),
      urgency: "immediate" as const,
    },
    {
      to: "/tools/grounding",
      icon: Eye,
      title: t("crisis.tool.grounding.title"),
      description: t("crisis.tool.grounding.desc"),
      duration: t("crisis.tool.grounding.dur"),
      urgency: "immediate" as const,
    },
    {
      to: "/tools/cold-water",
      icon: Droplets,
      title: t("crisis.tool.coldwater.title"),
      description: t("crisis.tool.coldwater.desc"),
      duration: t("crisis.tool.coldwater.dur"),
      urgency: "immediate" as const,
    },
    {
      to: "/tools/urge-surfing",
      icon: Waves,
      title: t("crisis.tool.urge.title"),
      description: t("crisis.tool.urge.desc"),
      duration: t("crisis.tool.urge.dur"),
      urgency: "sustained" as const,
    },
    {
      to: "/tools/tape",
      icon: Rewind,
      title: t("crisis.tool.tape.title"),
      description: t("crisis.tool.tape.desc"),
      duration: t("crisis.tool.tape.dur"),
      urgency: "sustained" as const,
    },
    {
      to: "/tools/self-compassion",
      icon: Heart,
      title: t("crisis.tool.compassion.title"),
      description: t("crisis.tool.compassion.desc"),
      duration: t("crisis.tool.compassion.dur"),
      urgency: "sustained" as const,
    },
    {
      to: "/tools/distraction",
      icon: Shuffle,
      title: t("crisis.tool.distraction.title"),
      description: t("crisis.tool.distraction.desc"),
      duration: t("crisis.tool.distraction.dur"),
      urgency: "sustained" as const,
    },
  ];

  return (
    <div className="flex flex-col min-h-dvh bg-background">
      <PageHeader title={t("tools.title")} subtitle={t("tools.subtitle")} />

      <div className="flex-1 overflow-y-auto scroll-smooth-ios px-4 py-4 pb-safe flex flex-col gap-4">
        {/* ── Crisis Section ─────────────────────────── */}
        <section aria-labelledby="crisis-heading">
          <h2
            id="crisis-heading"
            className="text-sm font-semibold text-foreground px-1 mb-2"
          >
            {t("crisis.title")}
          </h2>
          <p className="text-sm text-muted-foreground px-1 leading-relaxed mb-3">
            {t("crisis.subtitle")}
          </p>

          <div className="flex flex-col gap-2 mt-1">
            {CRISIS_TOOLS.filter((t) => t.urgency === "immediate").map(
              (tool) => (
                <Link key={tool.to} href={tool.to} asChild>
                  <a className="block animate-fade-up focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-2xl">
                    <div className="bg-card border border-border rounded-2xl p-4 flex items-start gap-4 hover:border-primary/40 active:scale-[0.98] transition-all duration-200">
                      <div className="rounded-xl p-2.5 bg-red-500/10 text-red-400 shrink-0">
                        <tool.icon size={22} strokeWidth={1.8} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-foreground">
                            {tool.title}
                          </span>
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">
                            {tool.duration}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 leading-snug">
                          {tool.description}
                        </p>
                      </div>
                      <div className="shrink-0 self-center">
                        <PinButton toolId={tool.to} />
                      </div>
                    </div>
                  </a>
                </Link>
              )
            )}
          </div>

          <p className="text-xs text-muted-foreground uppercase tracking-widest px-1 mt-3">
            {t("crisis.sustained")}
          </p>
          <div className="flex flex-col gap-2 mt-1">
            {CRISIS_TOOLS.filter((t) => t.urgency === "sustained").map(
              (tool) => (
                <Link key={tool.to} href={tool.to} asChild>
                  <a className="block animate-fade-up focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-2xl">
                    <div className="bg-card border border-border rounded-2xl p-4 flex items-start gap-4 hover:border-primary/40 active:scale-[0.98] transition-all duration-200">
                      <div className="rounded-xl p-2.5 bg-primary/10 text-primary shrink-0">
                        <tool.icon size={22} strokeWidth={1.8} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-foreground">
                            {tool.title}
                          </span>
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">
                            {tool.duration}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 leading-snug">
                          {tool.description}
                        </p>
                      </div>
                      <div className="shrink-0 self-center">
                        <PinButton toolId={tool.to} />
                      </div>
                    </div>
                  </a>
                </Link>
              )
            )}
          </div>

          {/* ── Crisis Service card ────────────────────── */}
          {crisisService && crisisService.name && crisisService.number && (
            <div className="mt-3 bg-red-950/20 border border-red-800/30 rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Phone size={16} strokeWidth={2} className="text-red-400 shrink-0" />
                <p className="text-sm font-semibold text-foreground">
                  {t("help.crisisService.title")}
                </p>
              </div>
              <p className="text-xs text-muted-foreground -mt-1">
                {crisisService.name}
              </p>
              <a
                href={`tel:${crisisService.number.replace(/\s/g, "")}`}
                className="flex items-center justify-center gap-2 w-full bg-red-600 hover:bg-red-700 text-white rounded-xl py-3.5 font-semibold text-sm active:scale-[0.98] transition-all touch-target focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50"
              >
                <Phone size={18} strokeWidth={2} />
                {t("help.crisisService.call")} — {crisisService.number}
              </a>
            </div>
          )}

          {/* ── Emergency Contacts ─────────────────────── */}
          {emergencyContacts.length > 0 && (
            <div className="mt-3 bg-card border border-border rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Phone size={16} strokeWidth={1.8} className="text-primary shrink-0" />
                <p className="text-sm font-semibold text-foreground">
                  {t("help.emergencyContacts.title")}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                {emergencyContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center justify-between gap-3 bg-background border border-border rounded-xl px-4 py-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {contact.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {contact.relationship} · {contact.phone}
                      </p>
                    </div>
                    <a
                      href={`tel:${contact.phone.replace(/\s/g, "")}`}
                      className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 text-primary rounded-lg px-3 py-2 text-xs font-semibold hover:bg-primary/15 active:scale-[0.97] transition-all touch-target shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    >
                      <Phone size={13} strokeWidth={2} />
                      {t("help.emergencyContacts.call")}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <div className="mt-2 bg-muted/30 border border-border/40 rounded-2xl p-4 text-center">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t("tools.disclaimer")}
          </p>
        </div>

        <div className="h-4" />
      </div>
    </div>
  );
}
