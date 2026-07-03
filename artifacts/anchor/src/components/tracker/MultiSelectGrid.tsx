export function MultiSelectGrid({
  options,
  value,
  onToggle,
  cols = 2,
  translate,
}: {
  options: string[];
  value: string[];
  onToggle: (v: string) => void;
  cols?: number;
  translate?: (s: string) => string;
}) {
  const gridClass =
    cols === 3 ? "grid-cols-3" : cols === 1 ? "grid-cols-1" : "grid-cols-2";
  return (
    <div className={`grid gap-2 ${gridClass}`}>
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onToggle(opt)}
          aria-pressed={value.includes(opt)}
          className={`py-3 px-3 rounded-2xl border text-sm font-medium text-left leading-tight transition-all touch-target ${
            value.includes(opt)
              ? "bg-primary/10 border-primary text-foreground"
              : "bg-card border-border text-muted-foreground hover:border-primary/30"
          }`}
        >
          {translate ? translate(opt) : opt}
        </button>
      ))}
    </div>
  );
}
