import { EXPIRY_CHIPS, formatExpiry, toISODate } from "../lib/dates";

interface Props {
  value: string | null;
  onChange: (value: string | null) => void;
}

export function ExpiryPicker({ value, onChange }: Props) {
  const today = new Date();
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {EXPIRY_CHIPS.map((chip) => {
          const date = toISODate(chip.from(today));
          return (
            <button
              key={chip.label}
              type="button"
              onClick={() => onChange(date)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                value === date
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-stone-200 bg-white text-stone-700 active:bg-stone-100"
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="date"
          aria-label="Expiration date"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          className="flex-1 rounded-lg border border-stone-200 bg-white px-3 py-2 text-base"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="rounded-lg px-3 py-2 text-sm text-stone-500 hover:bg-stone-100"
          >
            Clear
          </button>
        )}
      </div>
      {value && <p className="text-sm text-stone-500">{formatExpiry(value, today)}</p>}
    </div>
  );
}
