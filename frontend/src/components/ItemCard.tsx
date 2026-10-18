import type { Item } from "../api";
import { useUpdateItem } from "../hooks";
import { expiryStatus, formatExpiry } from "../lib/dates";
import { isLow } from "../lib/items";
import { CountStepper } from "./CountStepper";
import { LevelPicker } from "./LevelPicker";

const EXPIRY_STYLES = {
  expired: "bg-red-100 text-red-700",
  soon: "bg-amber-100 text-amber-800",
  ok: "bg-stone-100 text-stone-600",
};

export function ItemCard({ item, onEdit }: { item: Item; onEdit: () => void }) {
  const update = useUpdateItem();
  const low = isLow(item);

  return (
    <li className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
      <button type="button" onClick={onEdit} className="flex w-full items-start gap-2 text-left">
        <span className="flex-1 text-base font-semibold text-stone-900">{item.name}</span>
        {low && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            Low
          </span>
        )}
        <span className="text-stone-400" aria-hidden>
          ›
        </span>
      </button>
      {item.expiresOn && (
        <p
          className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${EXPIRY_STYLES[expiryStatus(item.expiresOn)]}`}
        >
          {formatExpiry(item.expiresOn)}
        </p>
      )}
      <div className="mt-2">
        {item.mode === "level" ? (
          <LevelPicker
            compact
            label={`${item.name} fill level`}
            value={item.level}
            onChange={(level) => update.mutate({ id: item.id, patch: { level } })}
          />
        ) : (
          <CountStepper
            compact
            value={item.count}
            onChange={(count) => update.mutate({ id: item.id, patch: { count } })}
          />
        )}
      </div>
    </li>
  );
}
