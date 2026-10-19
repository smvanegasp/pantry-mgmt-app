import type { Category, Item, ItemInput, Package, Suggestion } from "../api";
import { newPackage } from "./packages";
import { normalize, similarNames } from "./search";

/** The package a photographed product adds: a full container, or the counted units. */
export function packageFrom(s: Suggestion): Package {
  return { ...newPackage(), level: 100, count: s.mode === "count" ? (s.count ?? 1) : 1, expiresOn: s.expiresOn };
}

/** A pantry item already holding this product (same name, ignoring case and accents). */
export function findExisting(items: Item[], name: string): Item | undefined {
  const wanted = normalize(name).trim();
  return wanted ? items.find((i) => normalize(i.name).trim() === wanted) : undefined;
}

export interface Match {
  item: Item;
  /** True when it's surely the same product (the model said so, or the names are equal). */
  sure: boolean;
}

/**
 * The pantry item a new product probably belongs to, so it isn't logged twice. Sure matches
 * can be merged directly; similar names ("Milk" / "Almond milk") need the person to confirm.
 */
export function findMatch(items: Item[], name: string, existingItemId?: string | null): Match | null {
  const named = items.find((i) => i.id === existingItemId) ?? findExisting(items, name);
  if (named) return { item: named, sure: true };
  // Prefer the closest name: the one with the fewest extra words.
  const length = (text: string) => normalize(text).split(/\s+/).length;
  const similar = items
    .filter((i) => similarNames(i.name, name))
    .sort((a, b) => Math.abs(length(a.name) - length(name)) - Math.abs(length(b.name) - length(name)))[0];
  return similar ? { item: similar, sure: false } : null;
}

/** Adds new packages (or expiration dates) to an item, and its photo if it has none. */
export function addTo(existing: Item, packages: Package[], photoKey: string | null): Partial<ItemInput> {
  return {
    packages: [...existing.packages, ...packages],
    ...(existing.photoKey || !photoKey ? {} : { photoKey }),
  };
}

/** A category with this name, if one exists (case- and accent-insensitive). */
export function findCategory(categories: Category[], name: string): Category | undefined {
  const wanted = normalize(name).trim();
  return categories.find((c) => normalize(c.name).trim() === wanted);
}

/** Item form values for a reviewed photo (used when fixing a rejected card by hand). */
export function draftItem(s: Suggestion | null, photoKey: string | null, categories: Category[]): ItemInput {
  const categoryId =
    s?.categoryId ?? (s?.newCategoryName ? (findCategory(categories, s.newCategoryName)?.id ?? null) : null);
  return {
    name: s?.name ?? "",
    categoryId,
    mode: s?.mode ?? "level",
    buyWhenLevel: null,
    buyWhenCount: null,
    packages: [s ? packageFrom(s) : newPackage()],
    photoKey,
  };
}
