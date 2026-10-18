import type { Category, Item } from "../api";
import { daysUntil, SOON_DAYS } from "./dates";
import { DEFAULT_BUY_WHEN_COUNT, DEFAULT_BUY_WHEN_LEVEL } from "./levels";
import { fuzzyMatch } from "./search";

/** True when the item has reached its "buy when" threshold. */
export function isLow(item: Item): boolean {
  return item.mode === "level"
    ? item.level <= (item.buyWhenLevel ?? DEFAULT_BUY_WHEN_LEVEL)
    : item.count <= (item.buyWhenCount ?? DEFAULT_BUY_WHEN_COUNT);
}

/** Expired or expiring within SOON_DAYS. */
export function isExpiring(item: Item, today: Date = new Date()): boolean {
  return item.expiresOn !== null && daysUntil(item.expiresOn, today) <= SOON_DAYS;
}

export type StatusFilter = "all" | "low" | "expiring";
export type SortKey = "category" | "name" | "expiry" | "stock" | "updated";

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "category", label: "By category" },
  { value: "name", label: "Name (A–Z)" },
  { value: "expiry", label: "Expires soonest" },
  { value: "stock", label: "Lowest stock" },
  { value: "updated", label: "Recently updated" },
];

export interface ItemQuery {
  search: string;
  status: StatusFilter;
  categoryId: string | null; // null = all categories; "none" = uncategorized
  sort: SortKey;
}

export interface ItemGroup {
  key: string;
  name: string | null; // null = render without a heading
  items: Item[];
}

const byName = (a: Item, b: Item) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" });

/** Rough "how much is left" from 0 to 1, comparable across level and count items. */
function stockScore(item: Item): number {
  return item.mode === "level" ? item.level / 100 : Math.min(item.count, 4) / 4;
}

const COMPARATORS: Record<Exclude<SortKey, "category">, (a: Item, b: Item) => number> = {
  name: byName,
  // Items without a date go last.
  expiry: (a, b) =>
    (a.expiresOn ?? "9999-12-31").localeCompare(b.expiresOn ?? "9999-12-31") || byName(a, b),
  // Items that are low come first, then the emptiest.
  stock: (a, b) =>
    Number(isLow(b)) - Number(isLow(a)) || stockScore(a) - stockScore(b) || byName(a, b),
  updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt) || byName(a, b),
};

export function filterItems(items: Item[], categories: Category[], q: ItemQuery): Item[] {
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const known = new Set(categoryName.keys());
  return items.filter((item) => {
    if (q.status === "low" && !isLow(item)) return false;
    if (q.status === "expiring" && !isExpiring(item)) return false;
    if (q.categoryId === "none" && item.categoryId && known.has(item.categoryId)) return false;
    if (q.categoryId && q.categoryId !== "none" && item.categoryId !== q.categoryId) return false;
    const category = item.categoryId ? (categoryName.get(item.categoryId) ?? "") : "";
    return fuzzyMatch(q.search, item.name, category);
  });
}

export function groupItems(items: Item[], categories: Category[], sort: SortKey): ItemGroup[] {
  if (sort !== "category") {
    return items.length ? [{ key: "all", name: null, items: [...items].sort(COMPARATORS[sort]) }] : [];
  }
  const groups: ItemGroup[] = categories
    .map((c) => ({
      key: c.id,
      name: c.name,
      items: items.filter((i) => i.categoryId === c.id).sort(byName),
    }))
    .filter((g) => g.items.length > 0);
  const known = new Set(categories.map((c) => c.id));
  const other = items.filter((i) => !i.categoryId || !known.has(i.categoryId)).sort(byName);
  if (other.length) groups.push({ key: "none", name: "No category", items: other });
  return groups;
}
