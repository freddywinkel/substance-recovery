import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useLocation } from "wouter";
import { useT } from "@/hooks/useTranslation";
import { Heart, CheckCircle2 } from "lucide-react";

export function SelfCompassion() {
  const { t } = useT();
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [, navigate] = useLocation();

  const STEPS = [
    { title: t("compassion.s0.title"), prompt: t("compassion.s0.prompt"), body: t("compassion.s0.body"), reflection: t("compassion.s0.ref") },
    { title: t("compassion.s1.title"), prompt: t("compassion.s1.prompt"), body: t("compassion.s1.body"), reflection: t("compassion.s1.ref") },
    { title: t("compassion.s2.title"), prompt: t("compassion.s2.prompt"), body: t("compassion.s2.body"), reflection: t("compassion.s2.ref") },
    { title: t("compassion.s3.title"), prompt: t("compassion.s3.prompt"), body: t("compassion.s3.body"), reflection: t("compassion.s3.ref") },
  ];

  if (done) {
    return (
      <div className="flex flex-col min-h-dvh bg-background">
        <PageHeader title={t("compassion.title")} back />
        <div className="flex-1 min-h-0 overflow-y-auto scroll-smooth-ios flex flex-col items-center justify-center px-6 py-6 pb-safe gap-6 text-center animate-fade-up">
          <Heart size={56} strokeWidth={1.5} className="text-primary fill-primary/20" />
          <h2 className="text-2xl font-semibold">{t("compassion.done_title")}</h2>
          <p className="text-muted-foreground leading-relaxed max-w-xs">{t("compassion.done_body")}</p>
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

  const current = STEPS[step];

  return (
    <div className="flex flex-col min-h-dvh bg-background">
      <PageHeader title={t("compassion.title_full")} back subtitle={t("compassion.subtitle")} />

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

      <div className="flex-1 min-h-0 overflow-y-auto scroll-smooth-ios flex flex-col px-6 pb-safe pt-4 gap-5 animate-fade-up">

        <div className="bg-card border border-border rounded-3xl p-6 flex flex-col gap-3">
          <h2 className="text-xl font-semibold text-foreground">{current.title}</h2>
          <p className="text-primary font-medium text-lg leading-snug italic">"{current.prompt}"</p>
          <p className="text-foreground/90 leading-relaxed">{current.body}</p>
        </div>

        <div className="bg-primary/8 border border-primary/20 rounded-2xl p-4">
          <p className="text-sm text-foreground/80 leading-relaxed italic">{current.reflection}</p>
        </div>

        <p className="text-center text-xs text-muted-foreground">{t("compassion.take_time")}</p>

        <div className="mt-auto flex gap-3">
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="flex-1 border border-border rounded-2xl py-3 font-medium text-muted-foreground touch-target"
            >
              {t("common.back")}
            </button>
          )}
          <button
            onClick={() => {
              if (step < STEPS.length - 1) {
                setStep((s) => s + 1);
              } else {
                setDone(true);
              }
            }}
            className="flex-1 bg-primary text-primary-foreground rounded-2xl py-3 font-semibold touch-target hover:opacity-90 active:scale-95 transition-all"
          >
            {step < STEPS.length - 1 ? t("compassion.done_step") : t("common.finish")}
          </button>
        </div>
      </div>
    </div>
  );
}
