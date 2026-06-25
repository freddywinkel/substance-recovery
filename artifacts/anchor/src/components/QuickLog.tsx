import { useState, useEffect, useCallback } from "react";
import { useActiveRegistration } from "@/contexts/ActiveRegistrationContext";
import { useStore } from "@/hooks/useStore";
import { useT } from "@/hooks/useT";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Flame, Zap, Brain, Coffee, AlertTriangle, X } from "lucide-react";
import type { RegistrationType } from "@/contexts/ActiveRegistrationContext";
import { useToast } from "@/hooks/use-toast";

const LOG_TYPES: { type: RegistrationType; icon: typeof Flame; labelKey: string; color: string; bg: string }[] = [
  { type: "trek", icon: Flame, labelKey: "quicklog.types.trek", color: "text-amber-300", bg: "bg-amber-400/10" },
  { type: "craving", icon: Zap, labelKey: "quicklog.types.craving", color: "text-teal-300", bg: "bg-teal-400/10" },
  { type: "anxiety", icon: Brain, labelKey: "quicklog.types.anxiety", color: "text-violet-300", bg: "bg-violet-400/10" },
  { type: "boredom", icon: Coffee, labelKey: "quicklog.types.boredom", color: "text-emerald-300", bg: "bg-emerald-400/10" },
  { type: "relapse", icon: AlertTriangle, labelKey: "quicklog.types.relapse", color: "text-rose-300", bg: "bg-rose-400/10" },
];

interface QuickLogDraft {
  intensity: number;
  note: string;
}

export function QuickLog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useT();
  const { toast } = useToast();
  const { session, startSession, patchSession, clearSession } = useActiveRegistration();
  const store = useStore();

  const [selectedType, setSelectedType] = useState<RegistrationType>("craving");
  const [intensity, setIntensity] = useState<number>(5);
  const [note, setNote] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Resume from existing quick-log session if one exists
  useEffect(() => {
    if (session && session.route === "/quick-log") {
      setSelectedType(session.type);
      const draft = session.draft as QuickLogDraft | undefined;
      if (draft) {
        setIntensity(draft.intensity ?? 5);
        setNote(draft.note ?? "");
      }
    } else if (open && !session) {
      // Start fresh quick-log session when opened
      startSession({
        type: selectedType,
        route: "/quick-log",
        step: "form",
        draft: { intensity: 5, note: "" } as QuickLogDraft,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Persist changes to session
  const persistDraft = useCallback(
    (type: RegistrationType, int: number, nt: string) => {
      if (session?.route === "/quick-log") {
        patchSession({ draft: { intensity: int, note: nt } as QuickLogDraft });
      }
    },
    [session, patchSession]
  );

  const handleTypeChange = (type: RegistrationType) => {
    setSelectedType(type);
    setIntensity(5);
    setNote("");
    // Restart session with new type
    startSession({
      type,
      route: "/quick-log",
      step: "form",
      draft: { intensity: 5, note: "" } as QuickLogDraft,
    });
  };

  const handleIntensityChange = (value: number[]) => {
    const int = value[0];
    setIntensity(int);
    persistDraft(selectedType, int, note);
  };

  const handleNoteChange = (value: string) => {
    setNote(value);
    persistDraft(selectedType, intensity, value);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const now = Date.now();
      switch (selectedType) {
        case "trek":
        case "craving": {
          await store.logCraving({
            timestamp: now,
            status: "completed",
            situationPresets: [],
            situationOther: "",
            intensity,
            distressLevel: -1,
            riskLevel: "",
            emotions: [],
            emotionOther: "",
            physicalSensations: [],
            thoughtPresets: [],
            thoughtFreeText: "",
            location: "",
            locationOther: "",
            socialContext: [],
            substances: [],
            primarySubstance: "",
            buildupDuration: "",
            chosenAction: "",
            chosenActionOther: "",
            toolUsed: null,
            confidenceBefore: 5,
            intensityAfter: null,
            confidenceAfter: null,
            cravingOutcome: null,
            interventionUsed: null,
            markAsPattern: false,
            highRiskFlag: false,
            note,
            cravingType: selectedType === "trek" ? "active" : "passive",
          });
          break;
        }
        case "anxiety": {
          await store.logAnxiety({
            timestamp: now,
            intensity,
            context: "",
            trigger: "",
            bodySensations: [],
            reaction: "",
            note,
          });
          break;
        }
        case "boredom": {
          await store.logBoredom({
            timestamp: now,
            intensity,
            feelingTypes: [],
            situation: "",
            urge: "",
            action: "",
            delayDuration: "0",
            note,
          });
          break;
        }
        case "relapse": {
          await store.logRelapse({
            timestamp: now,
            status: "completed",
            label: "no-label",
            when: new Date().toISOString().split("T")[0],
            episodeDuration: "single-moment",
            substances: [],
            primarySubstance: "",
            amountCategory: "prefer-not",
            firstTriggerType: "",
            firstTriggerText: "",
            preUseFactors: [],
            missedWarnings: [],
            preUseThoughtPreset: "",
            preUseThoughtFreeText: "",
            couldHaveHelpedEarly: [],
            couldHaveHelpedMiddle: [],
            couldHaveHelpedLast: [],
            supportContact: "",
            supportContactOther: "",
            nextStep: "",
            nextStepOther: "",
            acuteRisk: "none",
            note,
            context: "",
            emotionAfter: 5,
          });
          break;
        }
      }
      toast({ title: t("common.logged"), duration: 2000 });
      clearSession();
      onOpenChange(false);
      setIntensity(5);
      setNote("");
    } catch {
      toast({ title: t("common.save_error"), variant: "destructive", duration: 3000 });
    } finally {
      setSaving(false);
    }
  };

  const selectedConfig = LOG_TYPES.find((lt) => lt.type === selectedType)!;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl border-border/50 bg-background pb-[calc(env(safe-area-inset-bottom)+1rem)]"
      >
        <SheetHeader className="text-left">
          <SheetTitle className="text-base font-semibold">
            {t("quicklog.title")}
          </SheetTitle>
          <SheetDescription>{t("quicklog.type")}</SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex flex-col gap-4">
          {/* Type selector */}
          <div className="grid grid-cols-5 gap-2">
            {LOG_TYPES.map((lt) => {
              const isActive = lt.type === selectedType;
              return (
                <button
                  key={lt.type}
                  type="button"
                  onClick={() => handleTypeChange(lt.type)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                    isActive
                      ? "border-primary/40 bg-primary/10"
                      : "border-border/50 bg-card hover:bg-muted"
                  }`}
                  aria-pressed={isActive}
                  aria-label={t(lt.labelKey)}
                >
                  <lt.icon
                    size={18}
                    strokeWidth={1.8}
                    className={isActive ? lt.color : "text-muted-foreground"}
                  />
                  <span
                    className={`text-[10px] font-medium leading-tight ${
                      isActive ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {t(lt.labelKey)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Intensity slider */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">
                {t("quicklog.intensity")}
              </label>
              <span className="text-sm font-semibold tabular-nums text-primary">
                {intensity}/10
              </span>
            </div>
            <Slider
              value={[intensity]}
              onValueChange={handleIntensityChange}
              max={10}
              step={1}
              className="w-full"
              aria-label={t("quicklog.intensity")}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>0</span>
              <span>5</span>
              <span>10</span>
            </div>
          </div>

          {/* Note */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-foreground">
              {t("quicklog.note")}
            </label>
            <Textarea
              value={note}
              onChange={(e) => handleNoteChange(e.target.value)}
              placeholder={t("common.note_placeholder")}
              className="min-h-[80px] resize-none rounded-xl border-border/50 bg-card"
              aria-label={t("quicklog.note")}
            />
          </div>

          {/* Save button */}
          <Button
            onClick={handleSave}
            disabled={saving}
            className={`w-full rounded-xl font-semibold transition-all duration-150 active:scale-[0.98] ${selectedConfig.bg} ${selectedConfig.color} border border-primary/20 hover:bg-primary/15`}
          >
            {saving ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
