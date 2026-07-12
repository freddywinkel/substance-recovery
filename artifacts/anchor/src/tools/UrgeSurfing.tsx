import { useState, useEffect, useRef } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useLocation } from "wouter";
import { useT } from "@/hooks/useTranslation";
import { Play, Pause, CheckCircle2 } from "lucide-react";

const TOTAL_SECONDS = 900;

export function UrgeSurfing() {
  const { t } = useT();
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [, navigate] = useLocation();

  const MESSAGES = [
    t("urge.msg0"), t("urge.msg1"), t("urge.msg2"), t("urge.msg3"),
    t("urge.msg4"), t("urge.msg5"), t("urge.msg6"), t("urge.msg7"),
    t("urge.msg8"), t("urge.msg9"), t("urge.msg10"), t("urge.msg11"),
  ];

  useEffect(() => {
    if (running && elapsed < TOTAL_SECONDS) {
      intervalRef.current = setInterval(() => {
        setElapsed((e) => {
          if (e + 1 >= TOTAL_SECONDS) {
            setDone(true);
            setRunning(false);
            return TOTAL_SECONDS;
          }
          return e + 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, elapsed]);

  const messageIndex = Math.min(
    Math.floor((elapsed / TOTAL_SECONDS) * MESSAGES.length),
    MESSAGES.length - 1
  );

  const waveProgress = elapsed / TOTAL_SECONDS;
  const waveHeight = Math.sin(waveProgress * Math.PI) * 100;
  const minutesLeft = Math.floor((TOTAL_SECONDS - elapsed) / 60);
  const secondsLeft = (TOTAL_SECONDS - elapsed) % 60;

  if (done) {
    return (
      <div className="flex flex-col min-h-dvh bg-background">
        <PageHeader title={t("urge.title")} back />
        <div className="flex-1 min-h-0 overflow-y-auto scroll-smooth-ios flex flex-col items-center justify-center px-6 py-6 pb-safe gap-6 text-center animate-fade-up">
          <CheckCircle2 size={56} strokeWidth={1.5} className="text-primary" />
          <h2 className="text-2xl font-semibold">{t("urge.done_title")}</h2>
          <p className="text-muted-foreground leading-relaxed max-w-xs">{t("urge.done_body")}</p>
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
      <PageHeader title={t("urge.title")} back subtitle={t("urge.subtitle")} />

      <div className="flex-1 min-h-0 overflow-y-auto scroll-smooth-ios flex flex-col items-center px-6 pb-safe pt-6 gap-6">

        <p className="text-center text-sm text-muted-foreground max-w-xs">
          {t("urge.intro")}
        </p>

        <div className="w-full max-w-xs h-44 relative rounded-2xl bg-muted/40 border border-border overflow-hidden flex items-end">
          <div
            className="w-full bg-primary/30 border-t-2 border-primary/60 transition-all duration-1000"
            style={{ height: `${waveHeight}%`, minHeight: 4 }}
            role="presentation"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-2xl font-light text-foreground/80">
                {minutesLeft}:{String(secondsLeft).padStart(2, "0")}
              </p>
              <p className="text-xs text-muted-foreground">{t("delay.remaining")}</p>
            </div>
          </div>
        </div>

        <div
          key={messageIndex}
          aria-live="polite"
          aria-atomic="true"
          className="bg-card border border-border rounded-2xl p-5 text-center animate-fade-up"
        >
          <p className="text-base leading-relaxed text-foreground/90 italic">
            "{MESSAGES[messageIndex]}"
          </p>
        </div>

        <div className="flex gap-4 items-center mt-2">
          <button
            onClick={() => { setElapsed(0); setRunning(false); }}
            className="touch-target text-sm text-muted-foreground hover:text-foreground px-4 py-2 rounded-xl border border-border transition-colors"
          >
            {t("common.reset")}
          </button>
          <button
            onClick={() => setRunning((r) => !r)}
            className="touch-target flex items-center gap-2 bg-primary text-primary-foreground rounded-2xl px-6 py-3 font-semibold hover:opacity-90 active:scale-95 transition-all"
          >
            {running
              ? <><Pause size={18} /> {t("common.pause")}</>
              : <><Play size={18} className="ml-0.5" /> {elapsed === 0 ? t("common.start") : t("common.resume")}</>
            }
          </button>
        </div>

        <p className="text-xs text-muted-foreground text-center max-w-xs">
          {t("urge.footer")}
        </p>
      </div>
    </div>
  );
}
