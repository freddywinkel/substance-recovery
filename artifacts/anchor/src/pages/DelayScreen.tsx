/**
 * DelayScreen — 10-minute grounding timer.
 */
import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useT } from "@/hooks/useT";
import { X } from "lucide-react";

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function DelayScreen() {
  const [, navigate] = useLocation();
  const { t } = useT();
  const [seconds, setSeconds] = useState(600);
  const [done, setDone] = useState(false);

  const INSTRUCTIONS = [
    t("delay.i0"), t("delay.i1"), t("delay.i2"), t("delay.i3"),
    t("delay.i4"), t("delay.i5"), t("delay.i6"), t("delay.i7"),
    t("delay.i8"), t("delay.i9"), t("delay.i10"), t("delay.i11"),
  ];

  useEffect(() => {
    if (seconds <= 0) {
      setDone(true);
      return;
    }
    const id = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [seconds]);

  const instructionIndex = Math.floor((600 - seconds) / 30) % INSTRUCTIONS.length;
  const instruction = INSTRUCTIONS[instructionIndex];
  const progress = (600 - seconds) / 600;

  const handleStop = useCallback(() => {
    navigate(-1 as unknown as string);
  }, [navigate]);

  return (
    <div
      className="flex flex-col min-h-dvh bg-background"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex justify-end px-5 pt-5 pb-2">
        <button
          onClick={handleStop}
          className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors touch-target"
          aria-label={t("common.stop")}
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 gap-10">

        <div className="relative w-52 h-52 flex items-center justify-center">
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="44" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
            <circle
              cx="50" cy="50" r="44" fill="none"
              stroke="hsl(var(--primary))" strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 44}`}
              strokeDashoffset={`${2 * Math.PI * 44 * (1 - progress)}`}
              className="transition-all duration-1000"
            />
          </svg>
          <div className="text-center">
            <p className="text-5xl font-light text-foreground tabular-nums tracking-tight">
              {formatTime(seconds)}
            </p>
            {!done && (
              <p className="text-xs text-muted-foreground mt-1 uppercase tracking-widest">{t("delay.remaining")}</p>
            )}
          </div>
        </div>

        <div className="text-center min-h-[3rem] flex items-center justify-center">
          {done ? (
            <p className="text-xl font-medium text-foreground">{t("delay.done")}</p>
          ) : (
            <p
              key={instructionIndex}
              className="text-xl font-medium text-foreground leading-snug animate-fade-up"
            >
              {instruction}
            </p>
          )}
        </div>

        {!done && (
          <p className="text-xs text-muted-foreground/60 text-center max-w-[220px] leading-relaxed">
            {t("delay.hint")}
          </p>
        )}
      </div>

      {done && (
        <div className="px-6 pb-6">
          <button
            onClick={() => navigate("/")}
            className="w-full bg-primary text-primary-foreground rounded-2xl py-4 font-semibold text-base touch-target hover:opacity-90 active:scale-95 transition-all"
          >
            {t("common.done")}
          </button>
        </div>
      )}

      {!done && (
        <div className="px-6 pb-6">
          <button
            onClick={handleStop}
            className="w-full border border-border text-muted-foreground rounded-2xl py-4 font-medium text-sm touch-target hover:text-foreground hover:border-border/80 transition-colors"
          >
            {t("delay.stop_early")}
          </button>
        </div>
      )}
    </div>
  );
}
