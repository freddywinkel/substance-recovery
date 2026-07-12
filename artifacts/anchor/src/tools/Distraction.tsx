import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useLocation } from "wouter";
import { useT } from "@/hooks/useTranslation";
import { Shuffle, CheckCircle2 } from "lucide-react";

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

export function Distraction() {
  const { t } = useT();

  const ACTIVITIES = [
    { label: t("dist.act.0.label"), sub: t("dist.act.0.sub"), time: "15–20 min" },
    { label: t("dist.act.1.label"), sub: t("dist.act.1.sub"), time: "5–10 min" },
    { label: t("dist.act.2.label"), sub: t("dist.act.2.sub"), time: "5 min" },
    { label: t("dist.act.3.label"), sub: t("dist.act.3.sub"), time: "2 min" },
    { label: t("dist.act.4.label"), sub: t("dist.act.4.sub"), time: "10–20 min" },
    { label: t("dist.act.5.label"), sub: t("dist.act.5.sub"), time: "10 min" },
    { label: t("dist.act.6.label"), sub: t("dist.act.6.sub"), time: "10–15 min" },
    { label: t("dist.act.7.label"), sub: t("dist.act.7.sub"), time: "1 min" },
    { label: t("dist.act.8.label"), sub: t("dist.act.8.sub"), time: "10 min" },
    { label: t("dist.act.9.label"), sub: t("dist.act.9.sub"), time: "5 min" },
    { label: t("dist.act.10.label"), sub: t("dist.act.10.sub"), time: "5 min" },
    { label: t("dist.act.11.label"), sub: t("dist.act.11.sub"), time: "2 min" },
  ];

  const [activities] = useState(() => shuffle(ACTIVITIES));
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState(false);
  const [done, setDone] = useState(false);
  const [, navigate] = useLocation();

  if (done) {
    return (
      <div className="flex flex-col min-h-dvh bg-background">
        <PageHeader title={t("dist.title")} back />
        <div className="flex-1 min-h-0 overflow-y-auto scroll-smooth-ios flex flex-col items-center justify-center px-6 py-6 pb-safe gap-6 text-center animate-fade-up">
          <CheckCircle2 size={56} strokeWidth={1.5} className="text-primary" />
          <h2 className="text-2xl font-semibold">{t("dist.done_title")}</h2>
          <p className="text-muted-foreground leading-relaxed max-w-xs">{t("dist.done_body")}</p>
          <button
            onClick={() => navigate("/")}
            className="mt-4 bg-primary text-primary-foreground rounded-2xl px-8 py-3 font-semibold touch-target hover:opacity-90 active:scale-95 transition-all"
          >
            {t("common.return_home")}
          </button>
        </div>
      </div>
    );
  }

  const current = activities[index % activities.length];

  if (chosen) {
    return (
      <div className="flex flex-col min-h-dvh bg-background">
        <PageHeader title={t("dist.go_title")} back subtitle={current.time} />
        <div className="flex-1 min-h-0 overflow-y-auto scroll-smooth-ios flex flex-col items-center justify-center px-6 py-6 pb-safe gap-8 text-center animate-fade-up">
          <div className="bg-card border border-border rounded-3xl p-8">
            <h2 className="text-2xl font-semibold mb-3">{current.label}</h2>
            <p className="text-muted-foreground leading-relaxed">{current.sub}</p>
            <div className="mt-4 text-sm text-primary font-medium">{current.time}</div>
          </div>
          <p className="text-muted-foreground text-sm max-w-xs">{t("dist.come_back")}</p>
          <button
            onClick={() => setDone(true)}
            className="bg-primary text-primary-foreground rounded-2xl px-8 py-4 font-semibold touch-target hover:opacity-90 active:scale-95 transition-all"
          >
            {t("dist.did_it")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-dvh bg-background">
      <PageHeader title={t("dist.title")} back subtitle={t("dist.subtitle")} />

      <div className="flex-1 min-h-0 overflow-y-auto scroll-smooth-ios flex flex-col px-6 pb-safe pt-6 gap-6 animate-fade-up">

        <p className="text-center text-sm text-muted-foreground">{t("dist.intro")}</p>

        <div className="bg-card border border-border rounded-3xl p-6 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">{current.time}</span>
            <button
              onClick={() => setIndex((i) => i + 1)}
              className="touch-target flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              aria-label={t("dist.different")}
            >
              <Shuffle size={14} />
              {t("dist.different")}
            </button>
          </div>
          <h2 className="text-xl font-semibold">{current.label}</h2>
          <p className="text-muted-foreground leading-relaxed">{current.sub}</p>
        </div>

        <div className="mt-auto flex flex-col gap-3">
          <button
            onClick={() => setChosen(true)}
            className="w-full bg-primary text-primary-foreground rounded-2xl py-4 font-semibold text-base hover:opacity-90 active:scale-95 transition-all touch-target"
          >
            {t("dist.choose")}
          </button>
          <button
            onClick={() => setIndex((i) => i + 1)}
            className="w-full border border-border rounded-2xl py-3 font-medium text-muted-foreground hover:text-foreground transition-colors touch-target"
          >
            {t("dist.show_other")}
          </button>
        </div>
      </div>
    </div>
  );
}
