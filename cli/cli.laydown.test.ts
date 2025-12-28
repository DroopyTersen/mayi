import { describe, it, expect } from "bun:test";

describe("parseLayDownInput", () => {
  describe("card selection syntax", () => {
    it.todo("parses 'l 1,2,3 4,5,6,7' as LAY_DOWN with two melds", () => {});
    it.todo("first group '1,2,3' is first meld (card positions)", () => {});
    it.todo("second group '4,5,6,7' is second meld", () => {});
    it.todo("positions are 1-indexed", () => {});
    it.todo("spaces separate melds", () => {});
    it.todo("commas separate cards within meld", () => {});
  });

  describe("meld type inference", () => {
    it.todo("determines if each group is set or run based on cards", () => {});
    it.todo("3 cards same rank -> set", () => {});
    it.todo("4+ cards same suit consecutive -> run", () => {});
  });

  describe("validation", () => {
    it.todo("rejects positions outside hand range", () => {});
    it.todo("rejects duplicate positions across melds", () => {});
    it.todo("rejects empty meld groups", () => {});
    it.todo("provides helpful error messages", () => {});
  });

  describe("alternative syntaxes", () => {
    it.todo("'l 1 2 3 / 4 5 6 7' with slash separator", () => {});
  });
});

describe("lay down confirmation flow", () => {
  it.todo("shows proposed melds before confirming", () => {});
  it.todo("allows player to cancel and re-enter", () => {});
  it.todo("validates melds before sending command", () => {});
  it.todo("provides preview: 'Set: 9C 9D 9H'", () => {});
  it.todo("shows rejection reason if invalid", () => {});
});
