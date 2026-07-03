import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useLocation } from "wouter";
import { useT } from "@/hooks/useTranslation";
import { Eye, Hand, Ear, Wind, Coffee, CheckCircle2 } from "lucide-react";

export function Grounding54321() {
  const { t } = useT();
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [, navigate] = useLocation();

  const STEPS = [
    {
      count: 5,
      sense: t("ground.see"),
      icon: Eye,
      prompt: t("ground.see_prompt"),
      examples: t("ground.see_ex"),
      color: "text-primary",
    },
    {
      count: 4,
      sense: t("ground.touch"),
      icon: Hand,
      prompt: t("ground.touch_prompt"),
      examples: t("ground.touch_ex"),
      color: "text-accent-foreground",
    },
    {
      count: 3,
      sense: t("ground.hear"),
      icon: Ear,
      prompt: t("ground.hear_prompt"),
      examples: t("ground.hear_ex"),
      color: "text-primary",
    },
    {
      count: 2,
      sense: t("ground.smell"),
      icon: Wind,
      prompt: t("ground.smell_prompt"),
      examples: t("ground.smell_ex"),
      color: "text-accent-foreground",
    },
    {
      count: 1,
      sense: t("ground.taste"),
      icon: Coffee,
      prompt: t("ground.taste_prompt"),
      examples: t("ground.taste_ex"),
      color: "text-primary",
    },
  ];

  const current = STEPS[step];

  if (done) {
    return (
      <div className="flex flex-col min-h-dvh bg-background">
        <PageHeader title={t("ground.title")} back />
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-safe gap-6 text-center animate-fade-up">
          <CheckCircle2 size={56} strokeWidth={1.5} className="text-primary" />
          <h2 className="text-2xl font-semibold">{t("ground.done_title")}</h2>
          <p className="text-muted-foreground leading-relaxed max-w-xs">
            {t("ground.done_body")}
          </p>
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

  return (
    <div className="flex flex-col min-h-dvh bg-background">
      <PageHeader title={t("ground.title")} back subtitle={t("ground.subtitle")} />

      <div className="flex justify-center gap-2 pt-4 pb-2">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === step ? "w-6 bg-primary" : i < step ? "w-2 bg-primary/50" : "w-2 bg-muted"
            }`}
          />
        ))}
      </div>

      <div className="flex-1 flex flex-col px-6 pb-safe pt-4 gap-6 animate-fade-up">

        <div className="bg-card border border-border rounded-3xl p-6 flex flex-col items-center gap-4 text-center">
          <div className={`rounded-2xl p-4 bg-muted/70 ${current.color}`}>
            <current.icon size={36} strokeWidth={1.5} />
          </div>
          <div>
            <span className="text-5xl font-light text-primary">{current.count}</span>
            <span className="text-2xl font-light text-muted-foreground ml-2">{t("ground.things_to")}</span>
          </div>
          <h2 className="text-xl font-semibold">{current.sense}</h2>
          <p className="text-muted-foreground leading-relaxed">{current.prompt}</p>
          <p className="text-xs text-muted-foreground/70 italic">{current.examples}</p>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          {t("ground.take_time")}
        </p>

        <div className="mt-auto flex gap-3">
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="flex-1 border border-border rounded-2xl py-3 font-medium text-muted-foreground hover:text-foreground transition-colors touch-target"
            >
              {t("common.back")}
            </button>
          )}
          <button
            onClick={() => {
              if (step === STEPS.length - 1) {
                setDone(true);
              } else {
                setStep((s) => s + 1);
              }
            }}
            className="flex-1 bg-primary text-primary-foreground rounded-2xl py-3 font-semibold hover:opacity-90 active:scale-95 transition-all touch-target"
          >
            {step === STEPS.length - 1 ? t("common.finish") : t("common.continue")}
          </button>
        </div>
      </div>
    </div>
  );
}
