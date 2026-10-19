import { describe, expect, it } from "vitest";

import type { Item, Package } from "../api";
import {
  activePackage,
  changeActiveCount,
  earliestExpiry,
  formatLevelTotal,
  packageSummary,
  setActiveLevel,
  stockNote,
  totalStock,
} from "./packages";

const pkg = (id: string, p: Partial<Package> = {}): Package => ({
  id,
  level: 100,
  count: 1,
  expiresOn: null,
  ...p,
});

function item(mode: Item["mode"], packages: Package[]): Item {
  return {
    id: "i",
    name: "Thing",
    categoryId: null,
    mode,
    buyWhenLevel: null,
    buyWhenCount: null,
    packages,
    photoKey: null,
    createdAt: "",
    updatedAt: "",
  };
}

const ids = (packages: Package[]) => packages.map((p) => p.id);

describe("totals and labels", () => {
  it("sums levels and counts", () => {
    expect(totalStock(item("level", [pkg("a", { level: 50 }), pkg("b", { level: 100 })]))).toBe(150);
    expect(totalStock(item("count", [pkg("a", { count: 2 }), pkg("b", { count: 4 })]))).toBe(6);
  });

  it("formats level totals as fractions", () => {
    expect(formatLevelTotal(0)).toBe("Empty");
    expect(formatLevelTotal(25)).toBe("¼");
    expect(formatLevelTotal(100)).toBe("1");
    expect(formatLevelTotal(150)).toBe("1½");
    expect(formatLevelTotal(275)).toBe("2¾");
  });

  it("describes stock", () => {
    const rice = item("level", [pkg("a", { level: 50 }), pkg("b")]);
    expect(stockNote(rice)).toBe("1½ left");
    expect(packageSummary(rice)).toBe("2 packages · 1½ total");
    expect(packageSummary(item("level", [pkg("a")]))).toBeNull();
    expect(stockNote(item("level", [pkg("a", { level: 0 })]))).toBe("Empty");
    expect(stockNote(item("count", [pkg("a", { count: 3 })]))).toBe("3 left");
  });

  it("finds the earliest expiry", () => {
    const beans = item("count", [
      pkg("a", { expiresOn: "2027-03-01" }),
      pkg("b"),
      pkg("c", { expiresOn: "2026-11-01" }),
    ]);
    expect(earliestExpiry(beans)).toBe("2026-11-01");
    expect(earliestExpiry(item("count", [pkg("a")]))).toBeNull();
  });
});

describe("active package", () => {
  it("is the least full package for level items", () => {
    expect(activePackage(item("level", [pkg("full"), pkg("open", { level: 50 })])).id).toBe("open");
  });

  it("breaks ties by earliest expiry", () => {
    const rice = item("level", [pkg("late", { expiresOn: "2027-06-01" }), pkg("soon", { expiresOn: "2027-01-01" })]);
    expect(activePackage(rice).id).toBe("soon");
  });

  it("is the first to expire for count items", () => {
    const beans = item("count", [pkg("late", { expiresOn: "2027-03-01" }), pkg("soon", { expiresOn: "2026-11-01" })]);
    expect(activePackage(beans).id).toBe("soon");
  });
});

describe("quick changes", () => {
  it("sets the level of the open package", () => {
    const rice = item("level", [pkg("full"), pkg("open", { level: 50 })]);
    const next = setActiveLevel(rice, 25);
    expect(next.map((p) => [p.id, p.level])).toEqual([
      ["full", 100],
      ["open", 25],
    ]);
  });

  it("drops a finished package when another remains", () => {
    const rice = item("level", [pkg("full"), pkg("open", { level: 25 })]);
    expect(ids(setActiveLevel(rice, 0))).toEqual(["full"]);
  });

  it("keeps the last package even when empty", () => {
    const salt = item("level", [pkg("only", { level: 25 })]);
    expect(setActiveLevel(salt, 0).map((p) => p.level)).toEqual([0]);
  });

  it("counts down the first-expiring batch, then moves to the next", () => {
    const beans = item("count", [
      pkg("late", { count: 4, expiresOn: "2027-03-01" }),
      pkg("soon", { count: 1, expiresOn: "2026-11-01" }),
    ]);
    const next = changeActiveCount(beans, -1);
    expect(next.map((p) => [p.id, p.count])).toEqual([["late", 4]]);
  });

  it("clamps counts", () => {
    const eggs = item("count", [pkg("a", { count: 0 })]);
    expect(changeActiveCount(eggs, -1)[0].count).toBe(0);
    expect(changeActiveCount(eggs, 1)[0].count).toBe(1);
  });
});
