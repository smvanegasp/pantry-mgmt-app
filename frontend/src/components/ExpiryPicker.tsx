import { CalendarBlank } from "@phosphor-icons/react";
import { useState } from "react";

import { EXPIRY_CHIPS, formatExpiry, toISODate } from "../lib/dates";

interface Props {
  value: string | null;
  onChange: (value: string | null) => void;
  /** Hide the date field behind a "Pick date" chip (used where speed matters). */
  compact?: boolean;
}

const chip = (active: boolean) =>
  `inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-medium ${
    active
      ? "border-emerald-600 bg-emerald-600 text-white"
      : "border-stone-200 bg-white text-stone-700 active:bg-stone-100"
  }`;

export function ExpiryPicker({ value, onChange, compact = false }: Props) {
  const today = new Date();
  const chipDates = EXPIRY_CHIPS.map((c) => ({ label: c.label, date: toISODate(c.from(today)) }));
  const fromChip = chipDates.some((c) => c.date === value);
  const [showDate, setShowDate] = useState(!compact || (value !== null && !fromChip));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {chipDates.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => onChange(value === c.date && compact ? null : c.date)}
            className={chip(value === c.date)}
          >
            {c.label}
          </button>
        ))}
        {!showDate && (
          <button type="button" onClick={() => setShowDate(true)} className={chip(false)}>
            <CalendarBlank size={14} weight="fill" aria-hidden /> Pick date
          </button>
        )}
      </div>
      {showDate && (
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
      )}
      {value && <p className="text-sm text-stone-500">{formatExpiry(value, today)}</p>}
    </div>
  );
}
