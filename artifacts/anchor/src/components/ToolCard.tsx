import { Link } from "wouter";
import { LucideIcon } from "lucide-react";

interface ToolCardProps {
  to: string;
  icon: LucideIcon;
  title: string;
  description: string;
  duration: string;
  accent?: string;
  pinButton?: React.ReactNode;
}

export function ToolCard({
  to,
  icon: Icon,
  title,
  description,
  duration,
  accent = "text-primary",
  pinButton,
}: ToolCardProps) {
  return (
    <div className="flex items-stretch gap-1 rounded-2xl border border-border bg-card p-1 animate-fade-up transition-all duration-200 hover:border-primary/40">
      <Link href={to} asChild>
        <a className="min-w-0 flex-1 rounded-xl p-3 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
          <div className="flex items-start gap-3">
            <div
              className={`rounded-xl p-2.5 bg-muted/60 ${accent} shrink-0`}
            >
              <Icon size={22} strokeWidth={1.8} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-foreground text-base leading-tight">
                  {title}
                </h3>
                <span className="text-xs text-muted-foreground shrink-0 bg-muted px-2 py-0.5 rounded-full">
                  {duration}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1 leading-snug line-clamp-2">
                {description}
              </p>
            </div>
          </div>
        </a>
      </Link>
      {pinButton && <div className="flex shrink-0 items-center pr-2">{pinButton}</div>}
    </div>
  );
}
