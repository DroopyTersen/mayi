import { describe, it, expect } from "bun:test";
import { getHandSizeTier } from "./HandDisplay";

describe("getHandSizeTier", () => {
  it("returns 'normal' for 1-14 cards", () => {
    expect(getHandSizeTier(1)).toBe("normal");
    expect(getHandSizeTier(7)).toBe("normal");
    expect(getHandSizeTier(14)).toBe("normal");
  });

  it("returns 'large' for 15-20 cards", () => {
    expect(getHandSizeTier(15)).toBe("large");
    expect(getHandSizeTier(17)).toBe("large");
    expect(getHandSizeTier(20)).toBe("large");
  });

  it("returns 'huge' for 21+ cards", () => {
    expect(getHandSizeTier(21)).toBe("huge");
    expect(getHandSizeTier(25)).toBe("huge");
    expect(getHandSizeTier(50)).toBe("huge");
  });

  it("handles boundary conditions correctly", () => {
    // 14 is the last "normal"
    expect(getHandSizeTier(14)).toBe("normal");
    // 15 is the first "large"
    expect(getHandSizeTier(15)).toBe("large");
    // 20 is the last "large"
    expect(getHandSizeTier(20)).toBe("large");
    // 21 is the first "huge"
    expect(getHandSizeTier(21)).toBe("huge");
  });

  it("handles edge cases", () => {
    // Zero cards (empty hand)
    expect(getHandSizeTier(0)).toBe("normal");
    // Single card
    expect(getHandSizeTier(1)).toBe("normal");
  });
});
