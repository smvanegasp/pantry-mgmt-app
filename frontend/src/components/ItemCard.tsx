import { CaretRight, Clock, ShoppingCart, WarningCircle } from "@phosphor-icons/react";

import type { Item, Settings } from "../api";
import { useUpdateItem } from "../hooks";
import { expiryStatus, formatExpiry } from "../lib/dates";
import { isLow } from "../lib/items";
import {
  activePackage,
  changeActiveCount,
  earliestExpiry,
  packageSummary,
  setActiveLevel,
} from "../lib/packages";
import { CountStepper } from "./CountStepper";
import { LevelPicker } from "./LevelPicker";
import { ItemThumb } from "./Photo";

const EXPIRY_STYLES = {
  expired: "bg-red-100 text-red-700",
  soon: "bg-amber-100 text-amber-800",
  ok: "bg-stone-100 text-stone-600",
};

interface Props {
  item: Item;
  settings: Settings;
  onList: boolean;
  onEdit: () => void;
}

export function ItemCard({ item, settings, onList, onEdit }: Props) {
  const update = useUpdateItem();
  const low = isLow(item, settings);
  const expiry = earliestExpiry(item);
  const summary = packageSummary(item);
  const active = activePackage(item);

  return (
    <li className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
      <div className="flex items-start gap-3">
        {item.photoKey && <ItemThumb photoKey={item.photoKey} alt={item.name} />}
        <div className="min-w-0 flex-1">
          <button type="button" onClick={onEdit} className="flex w-full items-start gap-2 text-left">
            <span className="flex-1 text-base font-semibold text-stone-900">{item.name}</span>
            {onList && (
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800">
                <ShoppingCart size={12} weight="fill" aria-hidden /> On list
              </span>
            )}
            {low && !onList && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                <WarningCircle size={12} weight="fill" aria-hidden /> Low
              </span>
            )}
            <CaretRight size={16} weight="bold" className="mt-1 text-stone-400" aria-hidden />
          </button>
          {(expiry || summary) && (
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              {expiry && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${EXPIRY_STYLES[expiryStatus(expiry)]}`}
                >
                  <Clock size={12} weight="fill" aria-hidden />
                  {summary
                    ? formatExpiry(expiry).replace(/^Expires/, "Next expires").replace(/^Expired/, "One expired")
                    : formatExpiry(expiry)}
                </span>
              )}
              {summary && <span className="text-xs text-stone-500">{summary}</span>}
            </div>
          )}
        </div>
      </div>
      <div className="mt-2">
        {summary && (
          <p className="mb-1 text-xs text-stone-500">
            {item.mode === "level" ? "Open package" : "First to expire"}
          </p>
        )}
        {item.mode === "level" ? (
          <LevelPicker
            compact
            label={`${item.name} fill level`}
            value={active.level}
            onChange={(level) =>
              update.mutate({ id: item.id, patch: { packages: setActiveLevel(item, level) } })
            }
          />
        ) : (
          <CountStepper
            compact
            value={active.count}
            onChange={(count) =>
              update.mutate({
                id: item.id,
                patch: { packages: changeActiveCount(item, count - active.count) },
              })
            }
          />
        )}
      </div>
    </li>
  );
}
