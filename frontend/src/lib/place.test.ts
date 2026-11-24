import { describe, expect, it } from "vitest";

import { lastPlace, rememberPlace } from "./place";

describe("feedback place", () => {
  it("starts on Pantry, follows other screens and ignores Settings and unknown names", () => {
    expect(lastPlace()).toBe("Pantry");
    rememberPlace("List");
    expect(lastPlace()).toBe("List");
    rememberPlace("Settings");
    rememberPlace("Nowhere");
    expect(lastPlace()).toBe("List");
    rememberPlace("i'm home");
    expect(lastPlace()).toBe("I'm home");
  });
});
