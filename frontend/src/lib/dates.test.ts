import { describe, expect, it } from "vitest";

import { addMonths, daysUntil, EXPIRY_CHIPS, expiryStatus, formatExpiry, toISODate } from "./dates";

const today = new Date(2026, 9, 18); // Oct 18, 2026, local time

describe("addMonths", () => {
  it("clamps to the end of shorter months", () => {
    expect(toISODate(addMonths(new Date(2027, 0, 31), 1))).toBe("2027-02-28");
    expect(toISODate(addMonths(new Date(2028, 0, 31), 1))).toBe("2028-02-29");
  });

  it("rolls over the year", () => {
    expect(toISODate(addMonths(new Date(2026, 10, 15), 3))).toBe("2027-02-15");
  });
});

describe("expiry", () => {
  it("counts days from local today", () => {
    expect(daysUntil("2026-10-18", today)).toBe(0);
    expect(daysUntil("2026-10-25", today)).toBe(7);
    expect(daysUntil("2026-10-17", today)).toBe(-1);
  });

  it("classifies status", () => {
    expect(expiryStatus("2026-10-17", today)).toBe("expired");
    expect(expiryStatus("2026-10-18", today)).toBe("soon");
    expect(expiryStatus("2026-10-25", today)).toBe("soon");
    expect(expiryStatus("2026-10-26", today)).toBe("ok");
  });

  it("formats friendly labels", () => {
    expect(formatExpiry("2026-10-18", today)).toBe("Expires today");
    expect(formatExpiry("2026-10-19", today)).toBe("Expires tomorrow");
    expect(formatExpiry("2026-10-15", today)).toBe("Expired 3 days ago");
    expect(formatExpiry("2026-12-01", today)).toBe("Expires Dec 1");
    expect(formatExpiry("2027-03-31", today)).toBe("Expires Mar 31, 2027");
  });
});

describe("chips", () => {
  it("compute dates relative to today", () => {
    const dates = EXPIRY_CHIPS.map((c) => toISODate(c.from(today)));
    expect(dates).toEqual([
      "2026-10-21",
      "2026-10-25",
      "2026-11-01",
      "2026-11-18",
      "2027-01-18",
      "2027-04-18",
      "2027-10-18",
    ]);
  });
});
