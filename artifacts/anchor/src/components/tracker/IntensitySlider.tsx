import { CSSProperties } from "react";

export function IntensitySlider({
  value,
  onChange,
  min = 0,
  max = 10,
  label,
  lowLabel,
  highLabel,
  ariaLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  label?: string;
  lowLabel?: string;
  highLabel?: string;
  ariaLabel?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="flex flex-col gap-4">
      <div className="text-center">
        <span className="text-7xl font-light text-primary tabular-nums">{value}</span>
        {label && <p className="text-sm text-muted-foreground mt-1">{label}</p>}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        aria-label={ariaLabel ?? label ?? [lowLabel, highLabel].filter(Boolean).join(" – ")}
        onChange={(e) => onChange(Number(e.target.value))}
        className="intensity-slider w-full"
        style={{ "--thumb-pct": `${pct}%` } as CSSProperties}
      />
      {(lowLabel || highLabel) && (
        <div className="flex justify-between px-1">
          <span className="text-xs text-muted-foreground">{lowLabel}</span>
          <span className="text-xs text-muted-foreground">{highLabel}</span>
        </div>
      )}
    </div>
  );
}
