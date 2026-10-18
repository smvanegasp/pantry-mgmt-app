import { Minus, Plus } from "@phosphor-icons/react";

interface Props {
  value: number;
  onChange: (count: number) => void;
  compact?: boolean;
  min?: number;
}

const MAX = 999;

export function CountStepper({ value, onChange, compact = false, min = 0 }: Props) {
  const size = compact ? "h-9 w-9 text-lg" : "h-11 w-11 text-xl";
  const button = `${size} inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white font-semibold text-stone-700 active:bg-stone-100 disabled:opacity-40`;
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className={button}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label="Decrease"
      >
        <Minus size={compact ? 16 : 18} weight="bold" aria-hidden />
      </button>
      <span
        className={`min-w-10 text-center font-semibold tabular-nums ${compact ? "text-base" : "text-xl"}`}
        aria-live="polite"
      >
        {value}
      </span>
      <button
        type="button"
        className={button}
        onClick={() => onChange(Math.min(MAX, value + 1))}
        disabled={value >= MAX}
        aria-label="Increase"
      >
        <Plus size={compact ? 16 : 18} weight="bold" aria-hidden />
      </button>
    </div>
  );
}
