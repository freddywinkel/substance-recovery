import {
  Activity,
  CloudSun,
  Compass,
  Flame,
  RotateCcw,
  X,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { RegistrationType } from "@/lib/recoveryFeatures";

const COPY = {
  en: {
    title: "What is happening right now?",
    body: "Choose the closest match. This only helps you find the right questions; it does not diagnose or judge what happened.",
    close: "Close help me choose",
    options: {
      trek: {
        title: "I am planning, seeking or moving toward using",
        body: "Choose Trek when the urge has become active: you are making plans, travelling, contacting someone or getting ready.",
      },
      craving: {
        title: "An urge or craving is present",
        body: "Choose Craving when you notice desire or pressure, but you are not currently planning or moving toward using.",
      },
      boredom: {
        title: "I feel bored, empty or restless",
        body: "Choose Boredom when under-stimulation, emptiness or having nothing to do is central.",
      },
      anxiety: {
        title: "I feel anxious, tense or overwhelmed",
        body: "Choose Anxiety when worry, nervous energy, fear or physical tension is central.",
      },
      relapse: {
        title: "I have already used or crossed my boundary",
        body: "Choose Relapse to record what happened and focus on immediate safety and the next helpful step.",
      },
    },
  },
  nl: {
    title: "Wat gebeurt er op dit moment?",
    body: "Kies wat het meest in de buurt komt. Dit helpt alleen om de juiste vragen te vinden; het stelt geen diagnose en beoordeelt niet wat er is gebeurd.",
    close: "Hulp bij kiezen sluiten",
    options: {
      trek: {
        title: "Ik plan, zoek of beweeg richting gebruik",
        body: "Kies Trek wanneer de drang actief is geworden: je maakt plannen, bent onderweg, benadert iemand of treft voorbereidingen.",
      },
      craving: {
        title: "Er is een drang of craving aanwezig",
        body: "Kies Craving wanneer je verlangen of druk merkt, maar nu niet plant of richting gebruik beweegt.",
      },
      boredom: {
        title: "Ik voel me verveeld, leeg of rusteloos",
        body: "Kies Verveling wanneer onderprikkeling, leegte of niets te doen hebben centraal staat.",
      },
      anxiety: {
        title: "Ik voel angst, spanning of overweldiging",
        body: "Kies Angst wanneer zorgen, nerveuze energie, vrees of lichamelijke spanning centraal staat.",
      },
      relapse: {
        title: "Ik heb al gebruikt of mijn grens overschreden",
        body: "Kies Terugval om vast te leggen wat er gebeurde en te focussen op directe veiligheid en de volgende helpende stap.",
      },
    },
  },
} as const;

const OPTIONS: Array<{
  type: RegistrationType;
  icon: typeof Compass;
  accent: string;
}> = [
  { type: "trek", icon: Compass, accent: "text-orange-400 bg-orange-400/10 border-orange-400/25" },
  { type: "craving", icon: Flame, accent: "text-rose-400 bg-rose-400/10 border-rose-400/25" },
  { type: "boredom", icon: CloudSun, accent: "text-sky-400 bg-sky-400/10 border-sky-400/25" },
  { type: "anxiety", icon: Activity, accent: "text-violet-400 bg-violet-400/10 border-violet-400/25" },
  { type: "relapse", icon: RotateCcw, accent: "text-amber-400 bg-amber-400/10 border-amber-400/25" },
];

type HelpMeChooseProps = {
  onChoose: (type: RegistrationType) => void;
  onCancel?: () => void;
};

export function HelpMeChoose({ onChoose, onCancel }: HelpMeChooseProps) {
  const { language } = useLanguage();
  const c = COPY[language];
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section className="rounded-3xl border border-primary/30 bg-card p-3 shadow-xl" aria-labelledby="help-me-choose-title">
      <div className="flex items-start justify-between gap-3 px-1 pb-3">
        <div>
          <h3
            ref={headingRef}
            id="help-me-choose-title"
            tabIndex={-1}
            className="text-base font-semibold text-foreground focus:outline-none"
          >
            {c.title}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{c.body}</p>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            aria-label={c.close}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          >
            <X size={18} />
          </button>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {OPTIONS.map(({ type, icon: Icon, accent }) => {
          const copy = c.options[type];
          return (
            <button
              key={type}
              type="button"
              onClick={() => onChoose(type)}
              className="flex min-h-[86px] w-full items-start gap-3 rounded-2xl border border-border/70 bg-background/65 p-3 text-left transition-colors hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 active:scale-[0.99]"
            >
              <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${accent}`}>
                <Icon size={19} strokeWidth={2} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-snug text-foreground">{copy.title}</span>
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{copy.body}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
