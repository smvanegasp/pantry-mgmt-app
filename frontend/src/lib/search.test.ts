import { describe, expect, it } from "vitest";

import { editDistance, fuzzyMatch } from "./search";

describe("editDistance", () => {
  it("counts swaps as one edit", () => {
    expect(editDistance("rcie", "rice")).toBe(1);
    expect(editDistance("rice", "rice")).toBe(0);
    expect(editDistance("rise", "rice")).toBe(1);
  });
});

describe("fuzzyMatch", () => {
  it("matches substrings and prefixes", () => {
    expect(fuzzyMatch("ric", "Brown rice")).toBe(true);
    expect(fuzzyMatch("own ri", "Brown rice")).toBe(true);
    expect(fuzzyMatch("", "Anything")).toBe(true);
  });

  it("tolerates typos", () => {
    expect(fuzzyMatch("rcie", "Rice")).toBe(true);
    expect(fuzzyMatch("rize", "Rice")).toBe(true);
    expect(fuzzyMatch("tomatos", "Tomatoes")).toBe(true);
    expect(fuzzyMatch("brwn rice", "Brown rice")).toBe(true);
    expect(fuzzyMatch("oliv oyl", "Olive oil")).toBe(true);
  });

  it("tolerates typos in half-typed words", () => {
    expect(fuzzyMatch("tomta", "Tomatoes")).toBe(true);
    expect(fuzzyMatch("chiken", "Chicken broth")).toBe(true);
  });

  it("matches words in any order", () => {
    expect(fuzzyMatch("rice brown", "Brown rice")).toBe(true);
  });

  it("ignores case and accents", () => {
    expect(fuzzyMatch("CAFE", "Café molido")).toBe(true);
    expect(fuzzyMatch("jalapeno", "Jalapeño peppers")).toBe(true);
  });

  it("searches extra fields like the category", () => {
    expect(fuzzyMatch("dairy", "Milk", "Dairy")).toBe(true);
  });

  it("does not over-match", () => {
    expect(fuzzyMatch("rice", "Milk")).toBe(false);
    expect(fuzzyMatch("oil", "Milk")).toBe(false);
    expect(fuzzyMatch("ab", "Eggs")).toBe(false);
    expect(fuzzyMatch("brown rice", "Brown sugar")).toBe(false);
  });
});
