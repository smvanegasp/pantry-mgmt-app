import type { Category } from "../api";
import { SOON_DAYS } from "../lib/dates";
import { SORT_OPTIONS, type ItemQuery, type SortKey, type StatusFilter } from "../lib/items";
import { InfoTip } from "./InfoTip";

interface Props {
  query: ItemQuery;
  onChange: (query: ItemQuery) => void;
  categories: Category[];
  total: number;
  counts: Record<StatusFilter, number>;
}

const STATUS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "low", label: "Low" },
  { value: "expiring", label: "Expiring" },
];

const select =
  "w-full min-w-0 rounded-lg border border-stone-200 bg-white px-2.5 py-2 text-sm text-stone-700";

export function PantryControls({ query, onChange, categories, total, counts }: Props) {
  const set = (patch: Partial<ItemQuery>) => onChange({ ...query, ...patch });

  return (
    <div className="mb-4 space-y-2">
      <input
        type="search"
        value={query.search}
        onChange={(e) => set({ search: e.target.value })}
        placeholder={`Search ${total} item${total === 1 ? "" : "s"}`}
        aria-label="Search items"
        className="w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-base"
      />

      <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Show">
        {STATUS.map((s) => {
          const active = query.status === s.value;
          return (
            <button
              key={s.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => set({ status: s.value })}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                active
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-stone-200 bg-white text-stone-700"
              }`}
            >
              {s.label} <span className={active ? "text-emerald-100" : "text-stone-400"}>{counts[s.value]}</span>
            </button>
          );
        })}
        <span className="ml-auto">
          <InfoTip title="Filters">
            <b>Low</b>: items at or below their "add to list" point. <b>Expiring</b>: items with a
            package that has expired or expires within {SOON_DAYS} days.
          </InfoTip>
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <select
          aria-label="Filter by category"
          value={query.categoryId ?? ""}
          onChange={(e) => set({ categoryId: e.target.value || null })}
          className={select}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value="none">No category</option>
        </select>
        <select
          aria-label="Sort"
          value={query.sort}
          onChange={(e) => set({ sort: e.target.value as SortKey })}
          className={select}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
