import { describe, expect, it } from "vitest";

import type { Category, Item, Package, Suggestion } from "../api";
import { addTo, draftItem, findCategory, findExisting, findMatch, packageFrom } from "./stockup";

const suggestion = (s: Partial<Suggestion> = {}): Suggestion => ({
  isProduct: true,
  name: "Barilla spaghetti",
  categoryId: null,
  newCategoryName: null,
  existingItemId: null,
  mode: "count",
  count: 3,
  expiresOn: "2028-09-30",
  ...s,
});

const categories: Category[] = [{ id: "c1", name: "Condiments", sortOrder: 0 }];

const item = (name: string): Item => ({
  id: name,
  name,
  categoryId: null,
  mode: "level",
  buyWhenLevel: null,
  buyWhenCount: null,
  packages: [],
  photoKey: null,
  createdAt: "",
  updatedAt: "",
});

describe("packageFrom", () => {
  it("counts units for count items and fills level items", () => {
    expect(packageFrom(suggestion())).toMatchObject({ count: 3, expiresOn: "2028-09-30" });
    expect(packageFrom(suggestion({ count: null }))).toMatchObject({ count: 1 });
    expect(packageFrom(suggestion({ mode: "level", count: null }))).toMatchObject({ level: 100, count: 1 });
  });
});

describe("findExisting / findCategory", () => {
  it("match names ignoring case, accents and spaces", () => {
    expect(findExisting([item("Café molido")], "  cafe MOLIDO ")?.id).toBe("Café molido");
    expect(findExisting([item("Rice")], "Brown rice")).toBeUndefined();
    expect(findExisting([item("Rice")], "")).toBeUndefined();
    expect(findCategory(categories, "condiments")?.id).toBe("c1");
  });
});

describe("findMatch", () => {
  const pantry = [item("Black beans"), item("Milk"), item("Brown rice")];

  it("is sure when the model names an item or the names are equal", () => {
    expect(findMatch(pantry, "Frijoles", "Milk")).toEqual({ item: pantry[1], sure: true });
    expect(findMatch(pantry, "black BEANS")).toEqual({ item: pantry[0], sure: true });
  });

  it("asks about similar names", () => {
    expect(findMatch(pantry, "Kirkland black beans")).toEqual({ item: pantry[0], sure: false });
    expect(findMatch(pantry, "Almond milk")).toEqual({ item: pantry[1], sure: false });
  });

  it("finds nothing for new products", () => {
    expect(findMatch(pantry, "Brown sugar")).toBeNull();
    expect(findMatch(pantry, "")).toBeNull();
  });

  it("prefers the closest name", () => {
    const both = [item("Rice vinegar brown"), item("Rice")];
    expect(findMatch(both, "Basmati rice")?.item.name).toBe("Rice");
  });
});

describe("addTo", () => {
  it("adds packages and fills a missing photo", () => {
    const beans: Item = { ...item("Black beans"), packages: [{ id: "a", level: 100, count: 2, expiresOn: null }] };
    const extra: Package[] = [{ id: "b", level: 100, count: 6, expiresOn: "2027-01-01" }];
    expect(addTo(beans, extra, "main/p1")).toEqual({ packages: [...beans.packages, ...extra], photoKey: "main/p1" });
    expect(addTo({ ...beans, photoKey: "main/old" }, extra, "main/p1")).toEqual({ packages: [...beans.packages, ...extra] });
  });
});

describe("draftItem", () => {
  it("prefills the form from a suggestion", () => {
    const draft = draftItem(suggestion({ categoryId: "c9" }), "main/abc", categories);
    expect(draft).toMatchObject({ name: "Barilla spaghetti", categoryId: "c9", mode: "count", photoKey: "main/abc" });
    expect(draft.packages[0]).toMatchObject({ count: 3, expiresOn: "2028-09-30" });
  });

  it("uses an existing category for a suggested new name", () => {
    expect(draftItem(suggestion({ newCategoryName: "condiments" }), null, categories).categoryId).toBe("c1");
    expect(draftItem(suggestion({ newCategoryName: "Snacks" }), null, categories).categoryId).toBeNull();
  });

  it("starts blank without a suggestion", () => {
    expect(draftItem(null, "main/abc", categories)).toMatchObject({ name: "", mode: "level", photoKey: "main/abc" });
  });
});
