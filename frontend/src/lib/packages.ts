import type { Item, Level, Mode, Package } from "../api";
import { LEVELS } from "./levels";

/** Same rules as the backend (app/stock.py), so optimistic updates match what gets saved. */
const isEmpty = (p: Package, mode: Mode) => (mode === "level" ? p.level : p.count) === 0;

export function normalizePackages(packages: Package[], mode: Mode): Package[] {
  const remaining = packages.filter((p) => !isEmpty(p, mode));
  return remaining.length ? remaining : packages.slice(0, 1);
}

/** Summed fill percentages (two half bags = 100) or summed counts. */
export function totalStock(item: Pick<Item, "mode" | "packages">): number {
  return item.packages.reduce((sum, p) => sum + (item.mode === "level" ? p.level : p.count), 0);
}

const byExpiry = (a: Package, b: Package) =>
  (a.expiresOn ?? "9999-12-31").localeCompare(b.expiresOn ?? "9999-12-31");

/**
 * The package quick taps act on: for "how full", the open one (least full);
 * for "how many", the one that expires first. Ties go to the earliest expiry.
 */
export function activePackage(item: Pick<Item, "mode" | "packages">): Package {
  const sorted = [...item.packages].sort((a, b) =>
    item.mode === "level" ? a.level - b.level || byExpiry(a, b) : byExpiry(a, b),
  );
  return sorted[0];
}

function updateActive(item: Item, change: (p: Package) => Package): Package[] {
  const active = activePackage(item);
  const packages = item.packages.map((p) => (p.id === active.id ? change(p) : p));
  return normalizePackages(packages, item.mode);
}

export const setActiveLevel = (item: Item, level: Level) =>
  updateActive(item, (p) => ({ ...p, level }));

export const changeActiveCount = (item: Item, delta: number) =>
  updateActive(item, (p) => ({ ...p, count: Math.min(999, Math.max(0, p.count + delta)) }));

export function earliestExpiry(item: Pick<Item, "packages">): string | null {
  const dates = item.packages.map((p) => p.expiresOn).filter((d): d is string => d !== null);
  return dates.length ? dates.sort()[0] : null;
}

/** 150 → "1½", 25 → "¼", 200 → "2", 0 → "Empty". */
export function formatLevelTotal(total: number): string {
  if (total === 0) return "Empty";
  const whole = Math.floor(total / 100);
  const fraction = LEVELS.find((l) => l.value === total % 100 && l.value !== 0)?.label ?? "";
  return whole === 0 ? fraction : `${whole}${fraction}`;
}

/** Short "how much is left" note, e.g. "½ left", "Empty", "3 left". */
export function stockNote(item: Item): string {
  const total = totalStock(item);
  if (item.mode === "count") return `${total} left`;
  return total === 0 ? "Empty" : `${formatLevelTotal(total)} left`;
}

/** Summary for items with several packages, e.g. "2 packages · 1½ total"; null for one. */
export function packageSummary(item: Item): string | null {
  const n = item.packages.length;
  if (n < 2) return null;
  const total = totalStock(item);
  return `${n} packages · ${item.mode === "level" ? formatLevelTotal(total) : total} total`;
}

export function newPackage(): Package {
  // crypto.randomUUID only exists on HTTPS/localhost; ids just need to be unique within an item.
  const id = crypto.randomUUID?.() ?? `${Date.now()}${Math.random()}`;
  return { id: id.replace(/\W/g, ""), level: 100, count: 1, expiresOn: null };
}
