import type { Level } from "../api";
import { LEVELS } from "../lib/levels";

interface Props {
  value: Level;
  onChange: (level: Level) => void;
  compact?: boolean;
  label?: string;
}

export function LevelPicker({ value, onChange, compact = false, label = "Fill level" }: Props) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-5 gap-1">
      {LEVELS.map((l) => {
        const selected = l.value === value;
        const low = l.value <= 25;
        return (
          <button
            key={l.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(l.value)}
            className={[
              "rounded-lg border font-medium transition-colors",
              compact ? "py-1.5 text-sm" : "py-2.5 text-base",
              selected
                ? low
                  ? "border-amber-500 bg-amber-500 text-white"
                  : "border-emerald-600 bg-emerald-600 text-white"
                : "border-stone-200 bg-white text-stone-700 active:bg-stone-100",
            ].join(" ")}
          >
            {l.label}
          </button>
        );
      })}
    </div>
  );
}
