import { describe, expect, it } from "vitest";

import type { Category, Item, Package } from "../api";
import { filterItems, groupItems, isExpiring, isLow, type ItemQuery } from "./items";

const cats: Category[] = [
  { id: "dairy", name: "Dairy", sortOrder: 0 },
  { id: "grains", name: "Grains", sortOrder: 1 },
];

/** Shorthand: `level` / `count` / `expiresOn` describe a single package. */
type ItemSpec = Partial<Item> & Partial<Pick<Package, "level" | "count" | "expiresOn">>;

function item({ level = 100, count = 1, expiresOn = null, ...overrides }: ItemSpec): Item {
  return {
    id: overrides.name ?? "x",
    name: "x",
    categoryId: null,
    mode: "level",
    buyWhenLevel: null,
    buyWhenCount: null,
    packages: [{ id: "p", level, count, expiresOn }],
    photoKey: null,
    createdAt: "2026-01-01T00:00:00+00:00",
    updatedAt: "2026-01-01T00:00:00+00:00",
    ...overrides,
  };
}

const today = new Date(2026, 9, 18);
const soon = "2026-10-20";

const items = [
  item({ name: "Milk", categoryId: "dairy", level: 25, expiresOn: soon, updatedAt: "2026-10-03" }),
  item({ name: "Brown rice", categoryId: "grains", level: 75, updatedAt: "2026-10-01" }),
  item({ name: "Eggs", categoryId: "dairy", mode: "count", count: 6, expiresOn: "2026-12-01" }),
  item({ name: "Salt", level: 50, updatedAt: "2026-10-02" }),
  item({ name: "Beans", mode: "count", count: 0 }),
];

const query = (q: Partial<ItemQuery>): ItemQuery => ({
  search: "",
  status: "all",
  categoryId: null,
  sort: "category",
  ...q,
});
const names = (list: Item[]) => list.map((i) => i.name);

describe("status helpers", () => {
  it("isLow respects defaults and overrides", () => {
    expect(isLow(item({ level: 25 }))).toBe(true);
    expect(isLow(item({ level: 50 }))).toBe(false);
    expect(isLow(item({ level: 50, buyWhenLevel: 50 }))).toBe(true);
    expect(isLow(item({ mode: "count", count: 1 }))).toBe(true);
    expect(isLow(item({ mode: "count", count: 3, buyWhenCount: 2 }))).toBe(false);
  });

  it("isLow uses pantry settings when the item has no override", () => {
    const settings = { buyWhenLevel: 50, buyWhenCount: 3 } as const;
    expect(isLow(item({ level: 50 }), settings)).toBe(true);
    expect(isLow(item({ level: 50, buyWhenLevel: 25 }), settings)).toBe(false);
    expect(isLow(item({ mode: "count", count: 3 }), settings)).toBe(true);
  });

  it("isLow uses the total across packages", () => {
    const packages = (...levels: Package["level"][]) =>
      levels.map((level, i) => ({ id: String(i), level, count: 1, expiresOn: null }));
    expect(isLow(item({ packages: packages(25, 100) }))).toBe(false);
    expect(isLow(item({ packages: packages(0, 25) }))).toBe(true);
  });

  it("isExpiring uses the earliest package", () => {
    const packages = [
      { id: "a", level: 100 as const, count: 1, expiresOn: "2027-06-01" },
      { id: "b", level: 100 as const, count: 1, expiresOn: soon },
    ];
    expect(isExpiring(item({ packages }), today)).toBe(true);
  });

  it("isExpiring includes expired items", () => {
    expect(isExpiring(item({ expiresOn: "2026-10-01" }), today)).toBe(true);
    expect(isExpiring(item({ expiresOn: soon }), today)).toBe(true);
    expect(isExpiring(item({ expiresOn: "2026-12-01" }), today)).toBe(false);
    expect(isExpiring(item({}), today)).toBe(false);
  });
});

describe("filterItems", () => {
  it("filters by status", () => {
    expect(names(filterItems(items, cats, query({ status: "low" })))).toEqual(["Milk", "Beans"]);
  });

  it("filters by category, including uncategorized", () => {
    expect(names(filterItems(items, cats, query({ categoryId: "dairy" })))).toEqual(["Milk", "Eggs"]);
    expect(names(filterItems(items, cats, query({ categoryId: "none" })))).toEqual(["Salt", "Beans"]);
  });

  it("searches names and categories with typos", () => {
    expect(names(filterItems(items, cats, query({ search: "rcie" })))).toEqual(["Brown rice"]);
    expect(names(filterItems(items, cats, query({ search: "dairy" })))).toEqual(["Milk", "Eggs"]);
  });

  it("combines filters", () => {
    expect(
      names(filterItems(items, cats, query({ status: "low", categoryId: "dairy" }))),
    ).toEqual(["Milk"]);
  });
});

describe("groupItems", () => {
  it("groups by category in category order, uncategorized last", () => {
    const groups = groupItems(items, cats, "category");
    expect(groups.map((g) => [g.name, names(g.items)])).toEqual([
      ["Dairy", ["Eggs", "Milk"]],
      ["Grains", ["Brown rice"]],
      ["No category", ["Beans", "Salt"]],
    ]);
  });

  it("sorts flat lists", () => {
    const flat = (sort: Parameters<typeof groupItems>[2]) =>
      names(groupItems(items, cats, sort, undefined, today).flatMap((g) => g.items));
    expect(flat("name")).toEqual(["Beans", "Brown rice", "Eggs", "Milk", "Salt"]);
    expect(flat("expiry")).toEqual(["Milk", "Eggs", "Beans", "Brown rice", "Salt"]);
    expect(flat("stock")).toEqual(["Beans", "Milk", "Salt", "Brown rice", "Eggs"]);
    expect(flat("updated")[0]).toBe("Milk");
  });

  it("returns no groups for no items", () => {
    expect(groupItems([], cats, "name")).toEqual([]);
  });
});

describe("sections for time and stock sorts", () => {
  const sections = (sort: Parameters<typeof groupItems>[2], list: Item[]) =>
    groupItems(list, cats, sort, undefined, today).map((g) => [g.name, names(g.items)]);

  it("groups by when things expire", () => {
    const list = [
      item({ name: "Old", expiresOn: "2026-10-10" }),
      item({ name: "Week", expiresOn: "2026-10-24" }),
      item({ name: "Month", expiresOn: "2026-11-10" }),
      item({ name: "Quarter", expiresOn: "2027-01-10" }),
      item({ name: "Later", expiresOn: "2027-06-01" }),
      item({ name: "Undated" }),
    ];
    expect(sections("expiry", list)).toEqual([
      ["Expired", ["Old"]],
      ["Next week", ["Week"]],
      ["Next month", ["Month"]],
      ["Next 3 months", ["Quarter"]],
      ["Later", ["Later"]],
      ["No expiration date", ["Undated"]],
    ]);
  });

  it("groups by how much is left, across level and count items", () => {
    const list = [
      item({ name: "Gone", level: 0 }),
      item({ name: "Quarter", level: 25 }),
      item({ name: "Half", level: 50 }),
      item({ name: "Full", level: 100 }),
      item({ name: "One can", mode: "count", count: 1 }),
      item({ name: "Three cans", mode: "count", count: 3 }),
      item({ name: "Six cans", mode: "count", count: 6 }),
    ];
    expect(sections("stock", list)).toEqual([
      ["Empty", ["Gone"]],
      ["Running low", ["One can", "Quarter"]],
      ["About half or 2–3 left", ["Half", "Three cans"]],
      ["Plenty", ["Full", "Six cans"]],
    ]);
  });

  it("groups by when they were last updated", () => {
    const at = (d: string) => new Date(`${d}T12:00:00`).toISOString();
    const list = [
      item({ name: "Now", updatedAt: at("2026-10-18") }),
      item({ name: "Days", updatedAt: at("2026-10-14") }),
      item({ name: "Weeks", updatedAt: at("2026-09-30") }),
      item({ name: "Ages", updatedAt: at("2026-05-01") }),
    ];
    expect(sections("updated", list)).toEqual([
      ["Today", ["Now"]],
      ["Last week", ["Days"]],
      ["Last month", ["Weeks"]],
      ["Older", ["Ages"]],
    ]);
  });

  it("keeps name sorting as one flat list", () => {
    expect(groupItems(items, cats, "name")).toHaveLength(1);
    expect(groupItems(items, cats, "name")[0].name).toBeNull();
  });
});
