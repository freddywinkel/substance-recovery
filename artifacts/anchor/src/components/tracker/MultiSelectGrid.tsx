export function MultiSelectGrid({
  options,
  value,
  onToggle,
  cols = 2,
  translate,
  maxSelections,
  selectionLabel,
}: {
  options: string[];
  value: string[];
  onToggle: (v: string) => void;
  cols?: number;
  translate?: (s: string) => string;
  maxSelections?: number;
  selectionLabel?: string;
}) {
  const gridClass =
    cols === 3 ? "grid-cols-3" : cols === 1 ? "grid-cols-1" : "grid-cols-2";
  const atLimit = maxSelections != null && value.length >= maxSelections;
  return (
    <div className="flex flex-col gap-2">
      {maxSelections != null && (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {selectionLabel ? `${selectionLabel} · ` : ""}{value.length}/{maxSelections}
        </p>
      )}
      <div className={`grid gap-2 ${gridClass}`}>
        {options.map((opt) => {
          const selected = value.includes(opt);
          const disabled = !selected && atLimit;
          return (
            <button
              type="button"
              key={opt}
              onClick={() => onToggle(opt)}
              aria-pressed={selected}
              disabled={disabled}
              className={`py-3 px-3 rounded-2xl border text-sm font-medium text-left leading-tight transition-all touch-target ${
                selected
                  ? "bg-primary/10 border-primary text-foreground"
                  : disabled
                    ? "bg-card/50 border-border/60 text-muted-foreground/45 cursor-not-allowed"
                    : "bg-card border-border text-muted-foreground hover:border-primary/30"
              }`}
            >
              {translate ? translate(opt) : opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
