import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepLayoutProps {
  title: string;
  subtitle?: string;
  back?: boolean;
  step?: { current: number; total: number };
  showStepCounter?: boolean;
  contentClassName?: string;
  actionBar?: React.ReactNode;
  children: React.ReactNode;
}

export function StepLayout({
  title,
  subtitle,
  back,
  step,
  showStepCounter,
  contentClassName,
  actionBar,
  children,
}: StepLayoutProps) {
  const [, navigate] = useLocation();
  const goBack = () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    navigate("/");
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-3">
          {back && (
            <button
              onClick={goBack}
              className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors touch-target"
              aria-label="Back"
            >
              <ArrowLeft size={20} className="text-foreground" />
            </button>
          )}
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-foreground">{title}</h1>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {step && (
          <div className="mt-3">
            {showStepCounter && (
              <div className="mb-1 text-right text-xs font-medium text-muted-foreground">
                {step.current}/{step.total}
              </div>
            )}
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${(step.current / step.total) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className={cn("flex-1 overflow-y-auto scroll-smooth-ios px-4 py-4 flex flex-col gap-5", contentClassName)}>
        {children}
      </div>

      {/* Action bar */}
      {actionBar && (
        <div className="px-4 pb-4 pt-2 bg-background border-t border-border">
          {actionBar}
        </div>
      )}
    </div>
  );
}
