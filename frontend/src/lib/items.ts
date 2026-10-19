import type { Category, Item, Settings } from "../api";
import { daysUntil, SOON_DAYS, toISODate } from "./dates";
import { earliestExpiry, totalStock } from "./packages";
import { fuzzyMatch } from "./search";

/** Matches the backend defaults; used until the real settings load. */
export const DEFAULT_SETTINGS: Settings = { buyWhenLevel: 25, buyWhenCount: 1 };

/** True when total stock has reached the "buy when" threshold (its own, or the pantry default). */
export function isLow(item: Item, settings: Settings = DEFAULT_SETTINGS): boolean {
  const threshold =
    item.mode === "level"
      ? (item.buyWhenLevel ?? settings.buyWhenLevel)
      : (item.buyWhenCount ?? settings.buyWhenCount);
  return totalStock(item) <= threshold;
}

/** Any package expired or expiring within SOON_DAYS. */
export function isExpiring(item: Item, today: Date = new Date()): boolean {
  const expiry = earliestExpiry(item);
  return expiry !== null && daysUntil(expiry, today) <= SOON_DAYS;
}

export type StatusFilter = "all" | "low" | "expiring";
export type SortKey = "category" | "name" | "expiry" | "stock" | "updated";

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "category", label: "By category" },
  { value: "expiry", label: "Expires soonest" },
  { value: "stock", label: "Lowest stock" },
  { value: "updated", label: "Recently updated" },
  { value: "name", label: "Name (A–Z)" },
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
  const total = totalStock(item);
  return item.mode === "level" ? Math.min(total, 100) / 100 : Math.min(total, 4) / 4;
}

function comparator(sort: Exclude<SortKey, "category">, settings: Settings) {
  switch (sort) {
    case "name":
      return byName;
    case "expiry":
      // Items without a date go last.
      return (a: Item, b: Item) =>
        (earliestExpiry(a) ?? "9999-12-31").localeCompare(earliestExpiry(b) ?? "9999-12-31") ||
        byName(a, b);
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

/** Which section an item falls in for the sorts that group into time or stock ranges. */
type Bucketer = (item: Item, settings: Settings, today: Date) => string;

const BUCKETS: Partial<Record<SortKey, { order: string[]; of: Bucketer }>> = {
  expiry: {
    order: ["Expired", "Next week", "Next month", "Next 3 months", "Later", "No expiration date"],
    of: (item, _settings, today) => {
      const expiry = earliestExpiry(item);
      if (expiry === null) return "No expiration date";
      const days = daysUntil(expiry, today);
      if (days < 0) return "Expired";
      if (days <= 7) return "Next week";
      if (days <= 31) return "Next month";
      if (days <= 92) return "Next 3 months";
      return "Later";
    },
  },
  stock: {
    order: ["Low", "Normal", "Plenty"],
    of: (item, settings) => {
      // Low follows the item's own "add to list" point (¼ or 1 by default), empty included.
      if (isLow(item, settings)) return "Low";
      // "How full" items count in percent (two half bags = 100); "how many" in units.
      const total = totalStock(item);
      const middling = item.mode === "level" ? total < 100 : total <= 3;
      return middling ? "Normal" : "Plenty";
    },
  },
  updated: {
    order: ["Today", "Last week", "Last month", "Older"],
    of: (item, _settings, today) => {
      const days = -daysUntil(toISODate(new Date(item.updatedAt)), today);
      if (days <= 0) return "Today";
      if (days <= 7) return "Last week";
      if (days <= 31) return "Last month";
      return "Older";
    },
  },
};

export function groupItems(
  items: Item[],
  categories: Category[],
  sort: SortKey,
  settings: Settings = DEFAULT_SETTINGS,
  today: Date = new Date(),
): ItemGroup[] {
  if (sort === "category") {
    return groupByCategory([...items].sort(byName), categories, (i) => i.categoryId);
  }
  const sorted = [...items].sort(comparator(sort, settings));
  const buckets = BUCKETS[sort];
  if (!buckets) return sorted.length ? [{ key: "all", name: null, items: sorted }] : [];
  // Sections in a fixed order (sorted within), empty ones left out.
  return buckets.order
    .map((name) => ({
      key: `${sort}:${name}`,
      name,
      items: sorted.filter((i) => buckets.of(i, settings, today) === name),
    }))
    .filter((g) => g.items.length > 0);
}
