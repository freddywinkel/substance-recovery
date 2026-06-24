import { useCallback } from "react";
import { ArrowLeft } from "lucide-react";
import { useT } from "@/hooks/useT";

interface PageHeaderProps {
  title: string;
  back?: boolean;
  subtitle?: string;
  onBack?: () => void;
}

export function PageHeader({ title, back = false, subtitle, onBack }: PageHeaderProps) {
  const { t } = useT();
  const handleBack = useCallback(() => {
    if (onBack) {
      onBack();
    } else if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "/";
    }
  }, [onBack]);

  return (
    <header
      className="sticky top-0 z-40 bg-background/92 backdrop-blur-md border-b border-border/50 px-4 py-3 flex items-center gap-2"
      style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top, 0px))" }}
    >
      {back && (
        <button
          onClick={handleBack}
          className="touch-target flex items-center justify-center w-9 h-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors -ml-1.5 shrink-0"
          aria-label={t("common.back")}
        >
          <ArrowLeft size={20} strokeWidth={1.8} />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-base font-semibold text-foreground leading-tight truncate">{title}</h1>
        {subtitle && (
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-none">{subtitle}</p>
        )}
      </div>
    </header>
  );
}
