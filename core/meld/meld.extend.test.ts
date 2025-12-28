import { describe, it, expect } from "bun:test";
import { canExtendRun, canExtendSet } from "./meld.extend";
import type { Card } from "../card/card.types";
import type { Meld } from "./meld.types";

let cardId = 0;
function card(rank: Card["rank"], suit: Card["suit"] = "spades"): Card {
  return { id: `card-${cardId++}`, suit, rank };
}

function joker(): Card {
  return { id: `joker-${cardId++}`, suit: null, rank: "Joker" };
}

function makeRun(cards: Card[], ownerId = "player1"): Meld {
  return { id: `meld-${cardId++}`, type: "run", cards, ownerId };
}

function makeSet(cards: Card[], ownerId = "player1"): Meld {
  return { id: `meld-${cardId++}`, type: "set", cards, ownerId };
}

describe("canExtendRun", () => {
  it("returns true for card that extends run at low end (4♠ extends 5♠ 6♠ 7♠ 8♠)", () => {
    const meld = makeRun([card("5"), card("6"), card("7"), card("8")]);
    expect(canExtendRun(meld, card("4"))).toBe(true);
  });

  it("returns true for card that extends run at high end (9♠ extends 5♠ 6♠ 7♠ 8♠)", () => {
    const meld = makeRun([card("5"), card("6"), card("7"), card("8")]);
    expect(canExtendRun(meld, card("9"))).toBe(true);
  });

  it("returns true for wild card at low end", () => {
    const meld = makeRun([card("5"), card("6"), card("7"), card("8")]);
    expect(canExtendRun(meld, joker())).toBe(true);
  });

  it("returns true for wild card at high end", () => {
    const meld = makeRun([card("5"), card("6"), card("7"), card("8")]);
    expect(canExtendRun(meld, card("2", "clubs"))).toBe(true);
  });

  it("returns false for card of wrong suit", () => {
    const meld = makeRun([card("5"), card("6"), card("7"), card("8")]);
    expect(canExtendRun(meld, card("4", "hearts"))).toBe(false);
  });

  it("returns false for card that doesn't connect (10♠ can't extend 5♠ 6♠ 7♠ 8♠)", () => {
    const meld = makeRun([card("5"), card("6"), card("7"), card("8")]);
    expect(canExtendRun(meld, card("10"))).toBe(false);
  });

  it("returns false for card already in run (6♠ can't extend 5♠ 6♠ 7♠ 8♠)", () => {
    const meld = makeRun([card("5"), card("6"), card("7"), card("8")]);
    expect(canExtendRun(meld, card("6"))).toBe(false);
  });

  it("returns false for extending below 3 with natural card", () => {
    const meld = makeRun([card("3"), card("4"), card("5"), card("6")]);
    // No natural card can go below 3
    expect(canExtendRun(meld, card("A"))).toBe(false); // A is high, not low
  });

  it("returns false for extending above Ace", () => {
    const meld = makeRun([card("J"), card("Q"), card("K"), card("A")]);
    expect(canExtendRun(meld, card("3"))).toBe(false);
  });

  it("wild can extend run starting at 3 at the high end", () => {
    // Run 3,4,5,6 - wild can extend at high end (to 7), but not low end (below 3)
    const meld = makeRun([card("3"), card("4"), card("5"), card("6")]);
    expect(canExtendRun(meld, joker())).toBe(true); // Can extend to 7
  });

  it("wild can extend run ending at Ace at the low end", () => {
    // Run J,Q,K,A - wild can extend at low end (to 10), but not high end (above A)
    const meld = makeRun([card("J"), card("Q"), card("K"), card("A")]);
    expect(canExtendRun(meld, joker())).toBe(true); // Can extend to 10
  });

  it("returns false for wild when run spans 3 to A (no room)", () => {
    // Full run - no room to extend either direction
    const meld = makeRun([
      card("3"), card("4"), card("5"), card("6"), card("7"), card("8"),
      card("9"), card("10"), card("J"), card("Q"), card("K"), card("A")
    ]);
    expect(canExtendRun(meld, joker())).toBe(false);
  });

  it("handles wilds in the existing run correctly", () => {
    // Run: 5♠ Joker 7♠ 8♠ (Joker is 6♠)
    const meld = makeRun([card("5"), joker(), card("7"), card("8")]);
    expect(canExtendRun(meld, card("4"))).toBe(true); // Low end
    expect(canExtendRun(meld, card("9"))).toBe(true); // High end
    expect(canExtendRun(meld, card("6"))).toBe(false); // Already covered by Joker
  });

  it("returns false for sets (only runs can be extended with runs)", () => {
    const meld = makeSet([card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")]);
    expect(canExtendRun(meld, card("9"))).toBe(false);
  });
});

describe("canExtendSet", () => {
  it("returns true for card of matching rank (9♣ extends 9♦ 9♥ 9♠)", () => {
    const meld = makeSet([card("9", "diamonds"), card("9", "hearts"), card("9", "spades")]);
    expect(canExtendSet(meld, card("9", "clubs"))).toBe(true);
  });

  it("returns true for wild card", () => {
    const meld = makeSet([card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")]);
    expect(canExtendSet(meld, joker())).toBe(true);
  });

  it("returns true for 2 as wild", () => {
    const meld = makeSet([card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")]);
    expect(canExtendSet(meld, card("2", "spades"))).toBe(true);
  });

  it("returns false for card of different rank", () => {
    const meld = makeSet([card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")]);
    expect(canExtendSet(meld, card("10", "spades"))).toBe(false);
  });

  it("returns false if adding wild would make wilds outnumber naturals", () => {
    // 2 naturals + 1 wild = equal, OK to add more
    const meld1 = makeSet([card("9", "clubs"), card("9", "diamonds"), joker()]);
    expect(canExtendSet(meld1, joker())).toBe(true); // 2 naturals + 2 wilds = equal, OK

    // 2 naturals + 2 wilds = equal, adding another wild would make wilds > naturals
    const meld2 = makeSet([card("9", "clubs"), card("9", "diamonds"), joker(), card("2", "hearts")]);
    expect(canExtendSet(meld2, joker())).toBe(false); // Would be 2 naturals + 3 wilds
  });

  it("handles duplicate cards from multiple decks (9♣ extends 9♣ 9♦ 9♥)", () => {
    const meld = makeSet([card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")]);
    expect(canExtendSet(meld, card("9", "clubs"))).toBe(true); // Duplicate suit OK
  });

  it("returns false for runs (only sets can be extended with sets)", () => {
    const meld = makeRun([card("5"), card("6"), card("7"), card("8")]);
    expect(canExtendSet(meld, card("5"))).toBe(false);
  });
});
