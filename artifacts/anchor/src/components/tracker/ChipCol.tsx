export function ChipCol({
  options,
  value,
  onChange,
  translate,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  translate?: (s: string) => string;
}) {
  return (
    <div className="flex flex-col gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt === value ? "" : opt)}
          aria-pressed={value === opt}
          className={`w-full text-left px-4 py-3.5 rounded-2xl border text-sm font-medium transition-all touch-target ${
            value === opt
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
