import type { Category, Item, ItemInput, Package, Suggestion } from "../api";
import { newPackage } from "./packages";
import { normalize } from "./search";

/** The package a photographed product adds: a full container, or the counted units. */
export function packageFrom(s: Suggestion): Package {
  return { ...newPackage(), level: 100, count: s.mode === "count" ? (s.count ?? 1) : 1, expiresOn: s.expiresOn };
}

/** A pantry item already holding this product (same name, ignoring case and accents). */
export function findExisting(items: Item[], name: string): Item | undefined {
  const wanted = normalize(name).trim();
  return wanted ? items.find((i) => normalize(i.name).trim() === wanted) : undefined;
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
