import type { Category, Item, Settings } from "../api";
import { daysUntil, SOON_DAYS } from "./dates";
import { fuzzyMatch } from "./search";

/** Matches the backend defaults; used until the real settings load. */
export const DEFAULT_SETTINGS: Settings = { buyWhenLevel: 25, buyWhenCount: 1 };

/** True when the item has reached its "buy when" threshold (its own, or the pantry default). */
export function isLow(item: Item, settings: Settings = DEFAULT_SETTINGS): boolean {
  return item.mode === "level"
    ? item.level <= (item.buyWhenLevel ?? settings.buyWhenLevel)
    : item.count <= (item.buyWhenCount ?? settings.buyWhenCount);
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

function comparator(sort: Exclude<SortKey, "category">, settings: Settings) {
  switch (sort) {
    case "name":
      return byName;
    case "expiry":
      // Items without a date go last.
      return (a: Item, b: Item) =>
        (a.expiresOn ?? "9999-12-31").localeCompare(b.expiresOn ?? "9999-12-31") || byName(a, b);
    case "stock":
      // Items that are low come first, then the emptiest.
      return (a: Item, b: Item) =>
        Number(isLow(b, settings)) - Number(isLow(a, settings)) ||
        stockScore(a) - stockScore(b) ||
        byName(a, b);
    case "updated":
      return (a: Item, b: Item) => b.updatedAt.localeCompare(a.updatedAt) || byName(a, b);
  }
}

export function filterItems(
  items: Item[],
  categories: Category[],
  q: ItemQuery,
  settings: Settings = DEFAULT_SETTINGS,
): Item[] {
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  return items.filter((item) => {
    if (q.status === "low" && !isLow(item, settings)) return false;
    if (q.status === "expiring" && !isExpiring(item)) return false;
    if (q.categoryId === "none" && item.categoryId && categoryName.has(item.categoryId)) return false;
    if (q.categoryId && q.categoryId !== "none" && item.categoryId !== q.categoryId) return false;
    const category = item.categoryId ? (categoryName.get(item.categoryId) ?? "") : "";
    return fuzzyMatch(q.search, item.name, category);
  });
}

/** Splits items into category sections, in category order, uncategorized last. */
export function groupByCategory<T>(
  entries: T[],
  categories: Category[],
  categoryOf: (entry: T) => string | null,
  otherName = "No category",
): { key: string; name: string; items: T[] }[] {
  const groups = categories
    .map((c) => ({ key: c.id, name: c.name, items: entries.filter((e) => categoryOf(e) === c.id) }))
    .filter((g) => g.items.length > 0);
  const known = new Set(categories.map((c) => c.id));
  const other = entries.filter((e) => {
    const id = categoryOf(e);
    return !id || !known.has(id);
  });
  if (other.length) groups.push({ key: "none", name: otherName, items: other });
  return groups;
}

export function groupItems(
  items: Item[],
  categories: Category[],
  sort: SortKey,
  settings: Settings = DEFAULT_SETTINGS,
): ItemGroup[] {
  if (sort !== "category") {
    if (!items.length) return [];
    return [{ key: "all", name: null, items: [...items].sort(comparator(sort, settings)) }];
  }
  return groupByCategory([...items].sort(byName), categories, (i) => i.categoryId);
}
