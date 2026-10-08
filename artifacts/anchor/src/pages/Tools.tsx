import { PersonalContactCard } from "@/components/PersonalContactCard";
import { CareContactCard } from "@/components/CareContactCard";
import { PageHeader } from "@/components/PageHeader";
import { ToolCard } from "@/components/ToolCard";
import { useT } from "@/hooks/useTranslation";
import { useStore } from "@/hooks/useStore";
import { usePinnedTools } from "@/hooks/usePinnedTools";
import { SELF_CRITICISM_COPY } from "@/lib/selfCriticismCopy";
import { Link } from "wouter";
import {
  Droplets,
  Eye,
  Heart,
  Phone,
  Pin,
  PinOff,
  Rewind,
  Settings,
  Shuffle,
  Waves,
  Wind,
} from "lucide-react";

function PinButton({ toolId, title }: { toolId: string; title: string }) {
  const { t, language } = useT();
  const { isPinned, togglePin, limitReached } = usePinnedTools();
  const pinned = isPinned(toolId);
  const disabled = !pinned && limitReached;
  const pinLabel = disabled
    ? (language === "nl" ? "Maximaal twee hulpmiddelen" : "Maximum of two tools")
    : `${pinned ? t("tools.unpin") : t("tools.pin")}: ${title}`;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        togglePin(toolId);
      }}
      className={`rounded-xl p-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-35 ${
        pinned
          ? "bg-amber-400/10 text-amber-300"
          : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
      }`}
      aria-label={pinLabel}
      title={pinLabel}
    >
      {pinned ? <Pin size={16} strokeWidth={2} /> : <PinOff size={16} strokeWidth={2} />}
    </button>
  );
}

export function Tools() {
  const { t, language } = useT();
  const { crisisService, emergencyContacts } = useStore();

  const tools = [
    {
      to: "/tools/breathing",
      icon: Wind,
      title: t("tools.breathing.title"),
      description: t("tools.breathing.desc"),
      duration: t("tools.breathing.dur"),
      accent: "text-primary",
    },
    {
      to: "/tools/grounding",
      icon: Eye,
      title: t("tools.grounding.title"),
      description: t("tools.grounding.desc"),
      duration: t("tools.grounding.dur"),
      accent: "text-primary",
    },
    {
      to: "/tools/cold-water",
      icon: Droplets,
      title: t("tools.cold.title"),
      description: t("tools.cold.desc"),
      duration: t("tools.cold.dur"),
      accent: "text-primary",
    },
    {
      to: "/tools/urge-surfing",
      icon: Waves,
      title: t("tools.urge.title"),
      description: t("tools.urge.desc"),
      duration: t("tools.urge.dur"),
      accent: "text-primary",
    },
    {
      to: "/tools/tape",
      icon: Rewind,
      title: t("tools.tape.title"),
      description: t("tools.tape.desc"),
      duration: t("tools.tape.dur"),
      accent: "text-primary",
    },
    {
      to: "/tools/self-compassion",
      icon: Heart,
      title: t("tools.compassion.title"),
      description: t("tools.compassion.desc"),
      duration: t("tools.compassion.dur"),
      accent: "text-primary",
    },
    {
      to: "/tools/distraction",
      icon: Shuffle,
      title: t("tools.distraction.title"),
      description: t("tools.distraction.desc"),
      duration: t("tools.distraction.dur"),
      accent: "text-primary",
    },
  ];

  const showSupport =
    (crisisService && crisisService.name && crisisService.number) ||
    emergencyContacts.length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <PageHeader title={t("tools.title")} subtitle={t("tools.subtitle")} />

      <div className="flex-1 overflow-y-auto scroll-smooth-ios px-4 py-4 pb-safe flex flex-col gap-4">
        <section aria-label={t("tools.title")}>
          <p className="text-sm text-muted-foreground px-1 leading-relaxed mb-3">
            {t("tools.intro")}
          </p>

          <div className="flex flex-col gap-2">
            <Link
              href="/tools/self-criticism"
              className="flex min-h-12 items-start gap-3 rounded-2xl border border-primary/25 bg-primary/5 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Heart size={22} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{SELF_CRITICISM_COPY[language].entry}</span>
                <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{SELF_CRITICISM_COPY[language].toolDescription}</span>
              </span>
            </Link>
            {tools.map((tool) => (
              <ToolCard
                key={tool.to}
                {...tool}
                pinButton={<PinButton toolId={tool.to} title={tool.title} />}
              />
            ))}
          </div>
        </section>

        <div className="bg-muted/30 border border-border/40 rounded-2xl p-4 text-center">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t("tools.disclaimer")}
          </p>
        </div>

        <section aria-labelledby="support-heading" className="flex flex-col gap-3">
          <div className="px-1">
            <h2 id="support-heading" className="text-sm font-semibold text-foreground">
              {t("tools.support.title")}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              {t("tools.support.subtitle")}
            </p>
          </div>

          <Link href="/help" asChild>
            <a className="flex items-center justify-between gap-3 rounded-2xl border border-red-800/40 bg-red-950/20 p-4 transition-colors hover:bg-red-950/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50">
              <div className="flex items-center gap-3 min-w-0">
                <div className="rounded-xl bg-red-600/20 p-2.5 text-red-400 shrink-0">
                  <Phone size={20} strokeWidth={2} aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{t("crisis.title")}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                    {t("tools.support.urgent")}
                  </p>
                </div>
              </div>
              <span aria-hidden="true" className="text-red-400 font-semibold">→</span>
            </a>
          </Link>

          {!showSupport && (
            <div className="rounded-2xl border border-border bg-card/60 p-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t("tools.support.empty")}
              </p>
              <Link href="/settings" asChild>
                <a className="mt-3 inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
                  <Settings size={14} strokeWidth={2} />
                  {t("tools.support.settings")}
                </a>
              </Link>
            </div>
          )}

          {crisisService?.number && <CareContactCard service={crisisService} language={language} />}

          {emergencyContacts.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Phone size={16} strokeWidth={1.8} className="text-primary shrink-0" />
                <p className="text-sm font-semibold text-foreground">
                  {t("help.emergencyContacts.title")}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                {emergencyContacts.map((contact) => <PersonalContactCard key={contact.id} contact={contact} language={language} />)}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
