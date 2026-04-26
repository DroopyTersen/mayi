import { describe, it, expect } from "bun:test";
import { diffCardIds } from "./useNewCardIds";

describe("diffCardIds", () => {
  it("returns empty set when nothing changed", () => {
    const previous = new Set(["a", "b", "c"]);
    const current = new Set(["a", "b", "c"]);
    expect([...diffCardIds(previous, current)]).toEqual([]);
  });

  it("returns ids present in current but not in previous", () => {
    const previous = new Set(["a", "b"]);
    const current = new Set(["a", "b", "c"]);
    expect([...diffCardIds(previous, current)]).toEqual(["c"]);
  });

  it("returns multiple new ids", () => {
    const previous = new Set(["a"]);
    const current = new Set(["a", "b", "c"]);
    expect([...diffCardIds(previous, current)].sort()).toEqual(["b", "c"]);
  });

  it("ignores ids that were removed", () => {
    const previous = new Set(["a", "b", "c"]);
    const current = new Set(["a"]);
    expect([...diffCardIds(previous, current)]).toEqual([]);
  });

  it("returns only the new id when one is added and one is removed", () => {
    const previous = new Set(["a", "b"]);
    const current = new Set(["a", "c"]);
    expect([...diffCardIds(previous, current)]).toEqual(["c"]);
  });
});
