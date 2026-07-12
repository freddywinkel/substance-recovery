interface ActionBarProps {
  showBack: boolean;
  onBack: () => void;
  onNext: () => void;
  nextIsSubmit?: boolean;
  saving?: boolean;
  canProceed: boolean;
  backLabel: string;
  nextLabel: string;
  saveLabel: string;
  savingLabel: string;
}

export function ActionBar({
  showBack,
  onBack,
  onNext,
  nextIsSubmit = false,
  saving = false,
  canProceed,
  backLabel,
  nextLabel,
  saveLabel,
  savingLabel,
}: ActionBarProps) {
  return (
    <div className="flex items-center gap-3 py-2">
      {showBack ? (
        <button
          type="button"
          onClick={onBack}
          disabled={saving}
          className="flex-1 py-3.5 px-4 rounded-2xl border border-border bg-card text-foreground font-medium text-sm hover:bg-muted transition-colors touch-target disabled:opacity-50"
        >
          {backLabel}
        </button>
      ) : null}

      <button
        type="button"
        onClick={onNext}
        disabled={!canProceed || saving}
        className={`${showBack ? "flex-[2]" : "flex-1"} touch-target rounded-2xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50`}
      >
        {saving ? savingLabel : nextIsSubmit ? saveLabel : nextLabel}
      </button>
    </div>
  );
}
