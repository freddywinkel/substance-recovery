import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useLocation } from "wouter";
import { useT } from "@/hooks/useT";
import { CheckCircle2, ArrowRight } from "lucide-react";

export function PlayTheTape() {
  const { t } = useT();
  const [phase, setPhase] = useState<"intro" | "use" | "choose" | "done">("intro");
  const [stepIdx, setStepIdx] = useState(0);
  const [, navigate] = useLocation();

  const USE_TAPE = [
    { direction: "use" as const, timeframe: t("tape.use.tf0"), title: t("tape.use.t0"), question: t("tape.use.q0") },
    { direction: "use" as const, timeframe: t("tape.use.tf1"), title: t("tape.use.t1"), question: t("tape.use.q1") },
    { direction: "use" as const, timeframe: t("tape.use.tf2"), title: t("tape.use.t2"), question: t("tape.use.q2") },
  ];

  const CHOOSE_TAPE = [
    { direction: "choose" as const, timeframe: t("tape.choose.tf0"), title: t("tape.choose.t0"), question: t("tape.choose.q0") },
    { direction: "choose" as const, timeframe: t("tape.choose.tf1"), title: t("tape.choose.t1"), question: t("tape.choose.q1") },
    { direction: "choose" as const, timeframe: t("tape.choose.tf2"), title: t("tape.choose.t2"), question: t("tape.choose.q2") },
  ];

  const allSteps = phase === "use" ? USE_TAPE : CHOOSE_TAPE;
  const current = allSteps[stepIdx];

  function handleDone() {
    setPhase("done");
  }

  if (phase === "intro") {
    return (
      <div className="flex flex-col min-h-dvh bg-background">
        <PageHeader title={t("tape.title")} back subtitle={t("tape.subtitle")} />
        <div className="flex-1 flex flex-col px-6 pb-safe pt-6 gap-6 animate-fade-up">
          <div className="bg-card border border-border rounded-3xl p-6">
            <p className="text-foreground/90 leading-relaxed">{t("tape.intro_body")}</p>
            <p className="text-muted-foreground text-sm mt-3 leading-relaxed">{t("tape.intro_sub")}</p>
          </div>
          <p className="text-center text-sm text-muted-foreground">{t("tape.intro_note")}</p>
          <div className="mt-auto">
            <button
              onClick={() => { setPhase("use"); setStepIdx(0); }}
              className="w-full bg-primary text-primary-foreground rounded-2xl py-4 font-semibold text-base hover:opacity-90 active:scale-95 transition-all touch-target flex items-center justify-center gap-2"
            >
              {t("common.begin")} <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="flex flex-col min-h-dvh bg-background">
        <PageHeader title={t("tape.title")} back />
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-safe gap-6 text-center animate-fade-up">
          <CheckCircle2 size={56} strokeWidth={1.5} className="text-primary" />
          <h2 className="text-2xl font-semibold">{t("tape.done_title")}</h2>
          <p className="text-muted-foreground leading-relaxed max-w-xs">{t("tape.done_body")}</p>
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

  const isUse = phase === "use";
  const steps = isUse ? USE_TAPE : CHOOSE_TAPE;

  return (
    <div className="flex flex-col min-h-dvh bg-background">
      <PageHeader
        title={isUse ? t("tape.path_a") : t("tape.path_b")}
        back
        subtitle={`${t("common.step")} ${stepIdx + 1} ${t("common.of")} ${steps.length}`}
      />

      <div className={`w-full h-1 ${isUse ? "bg-destructive/30" : "bg-primary/30"}`}>
        <div
          className={`h-full transition-all duration-500 ${isUse ? "bg-destructive" : "bg-primary"}`}
          style={{ width: `${((stepIdx + 1) / steps.length) * 100}%` }}
        />
      </div>

      <div className="flex-1 flex flex-col px-6 pb-safe pt-6 gap-6 animate-fade-up">
        <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {current.timeframe}
        </div>

        <div className={`rounded-3xl p-6 border ${isUse ? "bg-destructive/5 border-destructive/20" : "bg-primary/5 border-primary/20"}`}>
          <h2 className="text-xl font-semibold mb-4">{current.title}</h2>
          <p className="text-foreground/90 leading-relaxed text-base">{current.question}</p>
        </div>

        <div className="bg-muted/40 rounded-2xl p-4">
          <p className="text-sm text-muted-foreground italic leading-relaxed">{t("tape.sit_with")}</p>
        </div>

        <div className="mt-auto flex gap-3">
          {stepIdx > 0 && (
            <button
              onClick={() => setStepIdx((s) => s - 1)}
              className="flex-1 border border-border rounded-2xl py-3 font-medium text-muted-foreground touch-target"
            >
              {t("common.back")}
            </button>
          )}
          <button
            onClick={() => {
              if (stepIdx < steps.length - 1) {
                setStepIdx((s) => s + 1);
              } else if (isUse) {
                setPhase("choose");
                setStepIdx(0);
              } else {
                handleDone();
              }
            }}
            className={`flex-1 rounded-2xl py-3 font-semibold touch-target hover:opacity-90 active:scale-95 transition-all ${
              isUse ? "bg-destructive/20 text-destructive border border-destructive/30" : "bg-primary text-primary-foreground"
            }`}
          >
            {stepIdx < steps.length - 1
              ? t("common.continue")
              : isUse
              ? t("tape.see_other")
              : t("common.finish")}
          </button>
        </div>
      </div>
    </div>
  );
}
