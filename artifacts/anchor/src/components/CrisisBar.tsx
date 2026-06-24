import { Phone } from "lucide-react";

export function CrisisBar() {
  return (
    <div className="w-full bg-destructive/10 border-b border-destructive/20 px-4 py-2 flex items-center justify-between gap-2">
      <span className="text-xs text-foreground/70">
        In immediate danger?
      </span>
      <a
        href="tel:0883581500"
        className="flex items-center gap-1.5 text-xs font-semibold text-destructive hover:text-destructive/80 transition-colors touch-target"
        aria-label="Call Crisisdienst Antes 088 358 1500"
      >
        <Phone size={13} strokeWidth={2} />
        Crisisdienst Antes — 088 358 1500
      </a>
    </div>
  );
}
