import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";

interface StepLayoutProps {
  title: string;
  subtitle?: string;
  back?: boolean;
  step?: { current: number; total: number };
  actionBar?: React.ReactNode;
  children: React.ReactNode;
}

export function StepLayout({ title, subtitle, back, step, actionBar, children }: StepLayoutProps) {
  const [, navigate] = useLocation();

  return (
    <div className="flex flex-col min-h-dvh bg-background">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-3">
          {back && (
            <button
              onClick={() => navigate(-1)}
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
      <div className="flex-1 overflow-y-auto scroll-smooth-ios px-4 py-4 flex flex-col gap-5">
        {children}
      </div>

      {/* Action bar */}
      {actionBar && (
        <div className="px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-2 bg-background/80 backdrop-blur-sm border-t border-border">
          {actionBar}
        </div>
      )}
    </div>
  );
}
