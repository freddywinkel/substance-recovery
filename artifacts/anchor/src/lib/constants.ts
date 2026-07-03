import { Flame, Zap, Brain, Coffee, AlertTriangle } from "lucide-react";

export const CATEGORY_META: Record<string, {
  icon: typeof Flame;
  color: string;
  bg: string;
  ring: string;
  ringHover: string;
}> = {
  trek: { icon: Flame, color: "text-amber-300", bg: "bg-amber-400/10", ring: "ring-amber-300/20", ringHover: "hover:ring-amber-300/30" },
  craving: { icon: Zap, color: "text-teal-300", bg: "bg-teal-400/10", ring: "ring-teal-300/20", ringHover: "hover:ring-teal-300/30" },
  anxiety: { icon: Brain, color: "text-violet-300", bg: "bg-violet-400/10", ring: "ring-violet-300/20", ringHover: "hover:ring-violet-300/30" },
  boredom: { icon: Coffee, color: "text-emerald-300", bg: "bg-emerald-400/10", ring: "ring-emerald-300/20", ringHover: "hover:ring-emerald-300/30" },
  relapse: { icon: AlertTriangle, color: "text-rose-300", bg: "bg-rose-400/10", ring: "ring-rose-300/20", ringHover: "hover:ring-rose-300/30" },
};
