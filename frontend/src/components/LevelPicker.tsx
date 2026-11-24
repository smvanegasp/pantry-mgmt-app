import type { Level } from "../api";
import { LEVELS } from "../lib/levels";

interface Props {
  value: Level;
  onChange: (level: Level) => void;
  compact?: boolean;
  label?: string;
  /** Leave out "Empty", e.g. for something just bought. */
  hideEmpty?: boolean;
}

/** A little face per level: worried when empty, beaming when full. */
const FACES: Record<Level, string> = { 0: "(╥﹏╥)", 25: "(・_・;)", 50: "(・‿・)", 75: "(◕‿◕)", 100: "(≧◡≦)" };

export function LevelPicker({ value, onChange, compact = false, label = "Fill level", hideEmpty = false }: Props) {
  const levels = hideEmpty ? LEVELS.filter((l) => l.value > 0) : LEVELS;
  return (
    <div role="radiogroup" aria-label={label} className={`grid gap-1.5 ${hideEmpty ? "grid-cols-4" : "grid-cols-5"}`}>
      {levels.map((l) => {
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
              "relative overflow-hidden rounded-full border-2 font-bold",
              compact ? "py-1.5 text-sm" : "py-2.5 text-base",
              selected
                ? low
                  ? "border-amber-500 bg-amber-100 text-amber-800"
                  : "border-matcha-500 bg-matcha-100 text-matcha-800"
                : "border-stone-200 bg-white text-stone-600 hover:border-emerald-300",
            ].join(" ")}
          >
            {/* The "jar" fills up to the level when chosen. */}
            {selected && (
              <span
                aria-hidden
                className={`absolute inset-x-0 bottom-0 ${low ? "bg-amber-500/25" : "bg-matcha-500/30"}`}
                style={{ height: `${Math.max(l.value, 12)}%` }}
              />
            )}
            <span className="relative">{l.label}</span>
            {selected && !compact && (
              <span aria-hidden className="relative block text-[10px] leading-none font-medium">
                {FACES[l.value]}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
