import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useLocation } from "wouter";
import { useT } from "@/hooks/useTranslation";
import { Droplets, CheckCircle2, ArrowRight } from "lucide-react";

export function ColdWaterReset() {
  const { t } = useT();
  const [step, setStep] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const [, navigate] = useLocation();

  const STEPS = [
    { title: t("cold.s0.title"), body: t("cold.s0.body"), tip: t("cold.s0.tip") },
    { title: t("cold.s1.title"), body: t("cold.s1.body"), tip: t("cold.s1.tip") },
    { title: t("cold.s2.title"), body: t("cold.s2.body"), tip: t("cold.s2.tip") },
    { title: t("cold.s3.title"), body: t("cold.s3.body"), tip: t("cold.s3.tip") },
  ];

  if (done) {
    return (
      <div className="flex flex-col min-h-dvh bg-background">
        <PageHeader title={t("cold.title")} back />
        <div className="flex-1 min-h-0 overflow-y-auto scroll-smooth-ios flex flex-col items-center justify-center px-6 py-6 pb-safe gap-6 text-center animate-fade-up">
          <CheckCircle2 size={56} strokeWidth={1.5} className="text-primary" />
          <h2 className="text-2xl font-semibold">{t("cold.done_title")}</h2>
          <p className="text-muted-foreground leading-relaxed max-w-xs">{t("cold.done_body")}</p>
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

  if (step === null) {
    return (
      <div className="flex flex-col min-h-dvh bg-background">
        <PageHeader title={t("cold.title")} back subtitle={t("cold.subtitle")} />
        <div className="flex-1 min-h-0 overflow-y-auto scroll-smooth-ios flex flex-col px-6 pb-safe pt-6 gap-6 animate-fade-up">
          <div className="flex justify-center">
            <div className="rounded-full p-6 bg-accent/20 text-accent-foreground">
              <Droplets size={48} strokeWidth={1.5} />
            </div>
          </div>
          <div className="bg-card border border-border rounded-3xl p-6">
            <p className="text-foreground/90 leading-relaxed">{t("cold.intro_body")}</p>
            <p className="text-muted-foreground text-sm mt-3 leading-relaxed">{t("cold.intro_sub")}</p>
          </div>
          <div className="bg-muted/40 border border-border/50 rounded-2xl p-4">
            <p className="text-xs text-muted-foreground leading-relaxed">{t("cold.note")}</p>
          </div>
          <div className="mt-auto">
            <button
              onClick={() => setStep(0)}
              className="w-full bg-primary text-primary-foreground rounded-2xl py-4 font-semibold text-base hover:opacity-90 active:scale-95 transition-all touch-target flex items-center justify-center gap-2"
            >
              {t("cold.start_btn")} <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const current = STEPS[step];

  return (
    <div className="flex flex-col min-h-dvh bg-background">
      <PageHeader
        title={t("cold.title")}
        back
        subtitle={`${t("common.step")} ${step + 1} ${t("common.of")} ${STEPS.length}`}
      />

      <div className="w-full h-1 bg-muted">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scroll-smooth-ios flex flex-col px-6 pb-safe pt-6 gap-6 animate-fade-up">
        <div className="bg-card border border-border rounded-3xl p-6">
          <h2 className="text-xl font-semibold mb-4">{current.title}</h2>
          <p className="text-foreground/90 leading-relaxed">{current.body}</p>
        </div>

        <div className="bg-accent/10 border border-accent/20 rounded-2xl p-4">
          <p className="text-sm text-accent-foreground leading-relaxed italic">{current.tip}</p>
        </div>

        <div className="mt-auto flex gap-3">
          {step > 0 && (
            <button
              onClick={() => setStep((s) => (s !== null ? s - 1 : 0))}
              className="flex-1 border border-border rounded-2xl py-3 font-medium text-muted-foreground touch-target"
            >
              {t("common.back")}
            </button>
          )}
          <button
            onClick={() => {
              if (step < STEPS.length - 1) {
                setStep((s) => (s !== null ? s + 1 : 0));
              } else {
                setDone(true);
              }
            }}
            className="flex-1 bg-primary text-primary-foreground rounded-2xl py-3 font-semibold touch-target hover:opacity-90 active:scale-95 transition-all"
          >
            {step < STEPS.length - 1 ? t("cold.step_done") : t("common.finish")}
          </button>
        </div>
      </div>
    </div>
  );
}
