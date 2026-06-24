import { PageHeader } from "@/components/PageHeader";
import { ToolCard } from "@/components/ToolCard";
import { useT } from "@/hooks/useT";
import { Wind, Eye, Waves, Rewind, Droplets, Heart, Shuffle } from "lucide-react";

export function Tools() {
  const { t } = useT();

  const TOOLS = [
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

  return (
    <div className="flex flex-col min-h-dvh bg-background">
      <PageHeader title={t("tools.title")} subtitle={t("tools.subtitle")} />

      <div className="flex-1 overflow-y-auto scroll-smooth-ios px-4 py-4 pb-safe flex flex-col gap-3">
        <p className="text-sm text-muted-foreground px-1 leading-relaxed">
          {t("tools.intro")}
        </p>

        {TOOLS.map((tool) => (
          <ToolCard key={tool.to} {...tool} />
        ))}

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
