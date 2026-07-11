import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { PageHeader } from "@/components/PageHeader";
import { useT } from "@/hooks/useTranslation";
import { Play, Pause, RotateCcw } from "lucide-react";

type Phase = "inhale" | "hold1" | "exhale" | "hold2";

const PHASE_ORDER: Phase[] = ["inhale", "hold1", "exhale", "hold2"];

export function BoxBreathing() {
  const { t } = useT();
  const [, navigate] = useLocation();
  const [running, setRunning] = useState(false);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [tick, setTick] = useState(0);
  const [cycles, setCycles] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const DURATION = 4;

  const PHASES: Record<Phase, { label: string; instruction: string; color: string }> = {
    inhale: { label: t("breath.inhale"), instruction: t("breath.inhale_inst"), color: "hsl(var(--primary))" },
    hold1:  { label: t("breath.hold"), instruction: t("breath.hold_inst"), color: "hsl(var(--accent))" },
    exhale: { label: t("breath.exhale"), instruction: t("breath.exhale_inst"), color: "hsl(160 35% 50%)" },
    hold2:  { label: t("breath.hold"), instruction: t("breath.hold2_inst"), color: "hsl(var(--muted-foreground))" },
  };

  const currentPhase = PHASE_ORDER[phaseIdx];
  const config = PHASES[currentPhase];
  const progress = tick / DURATION;

  const advance = useCallback(() => {
    setTick((tickVal) => {
      if (tickVal >= DURATION - 1) {
        setPhaseIdx((p) => {
          const next = (p + 1) % 4;
          if (next === 0) setCycles((c) => c + 1);
          return next;
        });
        return 0;
      }
      return tickVal + 1;
    });
  }, []);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(advance, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, advance]);

  const reset = () => {
    setRunning(false);
    setPhaseIdx(0);
    setTick(0);
    setCycles(0);
  };

  const scale = currentPhase === "inhale"
    ? 1 + progress * 0.45
    : currentPhase === "exhale"
    ? 1.45 - progress * 0.45
    : currentPhase === "hold1"
    ? 1.45
    : 1;

  return (
    <div className="flex flex-col min-h-dvh bg-background">
      <PageHeader title={t("breath.title")} back subtitle={t("breath.subtitle")} />

      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-safe gap-10">

        <div className="text-center animate-fade-up">
          <p className="text-muted-foreground text-sm">
            {t("breath.intro")}
          </p>
        </div>

        <div className="relative flex items-center justify-center w-56 h-56">
          <div
            className="absolute rounded-full border-2 transition-all duration-1000"
            style={{ width: `${scale * 100}%`, height: `${scale * 100}%`, borderColor: config.color, opacity: 0.3 }}
          />
          <div
            className="absolute rounded-full border-2 transition-all duration-1000"
            style={{ width: `${scale * 70}%`, height: `${scale * 70}%`, borderColor: config.color, backgroundColor: `${config.color}18` }}
          />
          <div className="relative z-10 text-center">
            <div aria-hidden="true" className="text-4xl font-light tabular-nums transition-colors duration-500" style={{ color: config.color }}>
              {DURATION - tick}
            </div>
            <div aria-live="polite" aria-atomic="true">
              <div className="text-sm font-medium text-foreground mt-1">{config.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{config.instruction}</div>
            </div>
          </div>
        </div>

        {cycles > 0 && (
          <p className="text-sm text-muted-foreground">
            {cycles} {cycles === 1 ? t("breath.cycle") : t("breath.cycles")} {t("breath.completed")}
          </p>
        )}

        {cycles >= 4 && (
          <div className="rounded-2xl bg-primary/8 border border-primary/20 px-5 py-4 max-w-xs w-full text-center animate-fade-up">
            <p className="text-sm text-foreground/80 leading-relaxed mb-3">{t("breath.milestone")}</p>
            <button
              onClick={() => navigate("/")}
              className="text-sm font-semibold text-primary hover:opacity-75 transition-opacity touch-target"
            >
              {t("breath.done_btn")}
            </button>
          </div>
        )}

        <div className="flex gap-4 items-center">
          <button
            onClick={reset}
            className="touch-target flex items-center justify-center w-12 h-12 rounded-full border border-border text-muted-foreground hover:text-foreground transition-colors"
            aria-label={t("common.reset")}
          >
            <RotateCcw size={18} strokeWidth={1.8} />
          </button>
          <button
            onClick={() => setRunning((r) => !r)}
            className="touch-target flex items-center justify-center w-16 h-16 rounded-full bg-primary text-primary-foreground shadow-lg hover:opacity-90 active:scale-95 transition-all duration-200"
            aria-label={running ? t("common.pause") : t("common.start")}
          >
            {running ? <Pause size={24} strokeWidth={2} /> : <Play size={24} strokeWidth={2} className="ml-0.5" />}
          </button>
        </div>

        <div className="rounded-2xl bg-card border border-border p-4 max-w-xs text-center">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t("breath.tip")}
          </p>
        </div>
      </div>
    </div>
  );
}
