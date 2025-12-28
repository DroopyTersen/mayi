import { describe, it, expect } from "bun:test";
import { identifyJokerPositions, canSwapJokerWithCard } from "./meld.joker";
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

describe("identifyJokerPositions", () => {
  it("in run (5♠ Joker 7♠ 8♠), Joker is acting as 6♠", () => {
    const j = joker();
    const meld = makeRun([card("5"), j, card("7"), card("8")]);
    const positions = identifyJokerPositions(meld);

    expect(positions.length).toBe(1);
    expect(positions[0].wildCard).toBe(j);
    expect(positions[0].actingAsRank).toBe("6");
    expect(positions[0].actingAsSuit).toBe("spades");
  });

  it("in run (Joker 6♠ 7♠ 8♠), Joker is acting as 5♠", () => {
    const j = joker();
    const meld = makeRun([j, card("6"), card("7"), card("8")]);
    const positions = identifyJokerPositions(meld);

    expect(positions.length).toBe(1);
    expect(positions[0].wildCard).toBe(j);
    expect(positions[0].actingAsRank).toBe("5");
    expect(positions[0].actingAsSuit).toBe("spades");
  });

  it("in run (5♠ 6♠ 7♠ Joker), Joker is acting as 8♠", () => {
    const j = joker();
    const meld = makeRun([card("5"), card("6"), card("7"), j]);
    const positions = identifyJokerPositions(meld);

    expect(positions.length).toBe(1);
    expect(positions[0].wildCard).toBe(j);
    expect(positions[0].actingAsRank).toBe("8");
    expect(positions[0].actingAsSuit).toBe("spades");
  });

  it("in run (5♠ Joker Joker 8♠), first Joker is 6♠, second is 7♠", () => {
    const j1 = joker();
    const j2 = joker();
    const meld = makeRun([card("5"), j1, j2, card("8")]);
    const positions = identifyJokerPositions(meld);

    expect(positions.length).toBe(2);
    expect(positions[0].wildCard).toBe(j1);
    expect(positions[0].actingAsRank).toBe("6");
    expect(positions[1].wildCard).toBe(j2);
    expect(positions[1].actingAsRank).toBe("7");
  });

  it("in run (Joker 4♠ 5♠ Joker), first is 3♠, second is 6♠", () => {
    const j1 = joker();
    const j2 = joker();
    const meld = makeRun([j1, card("4"), card("5"), j2]);
    const positions = identifyJokerPositions(meld);

    expect(positions.length).toBe(2);
    expect(positions[0].wildCard).toBe(j1);
    expect(positions[0].actingAsRank).toBe("3");
    expect(positions[1].wildCard).toBe(j2);
    expect(positions[1].actingAsRank).toBe("6");
  });

  it("handles 2s acting as wilds same as Jokers", () => {
    const two = card("2", "clubs");
    const meld = makeRun([card("5"), two, card("7"), card("8")]);
    const positions = identifyJokerPositions(meld);

    expect(positions.length).toBe(1);
    expect(positions[0].wildCard).toBe(two);
    expect(positions[0].actingAsRank).toBe("6");
    expect(positions[0].actingAsSuit).toBe("spades");
    expect(positions[0].isJoker).toBe(false); // 2s can't be swapped
  });

  it("returns empty array for sets", () => {
    const j = joker();
    const meld = makeSet([card("9", "clubs"), card("9", "diamonds"), j]);
    const positions = identifyJokerPositions(meld);

    expect(positions.length).toBe(0);
  });
});

describe("canSwapJokerWithCard", () => {
  it("returns true when natural card matches Joker's position", () => {
    const j = joker();
    const meld = makeRun([card("5"), j, card("7"), card("8")]);
    const swapCard = card("6"); // matches Joker position

    expect(canSwapJokerWithCard(meld, j, swapCard)).toBe(true);
  });

  it("returns false when natural card doesn't match position", () => {
    const j = joker();
    const meld = makeRun([card("5"), j, card("7"), card("8")]);
    const swapCard = card("8"); // doesn't match

    expect(canSwapJokerWithCard(meld, j, swapCard)).toBe(false);
  });

  it("returns false when card is wrong suit", () => {
    const j = joker();
    const meld = makeRun([card("5"), j, card("7"), card("8")]);
    const swapCard = card("6", "hearts"); // wrong suit

    expect(canSwapJokerWithCard(meld, j, swapCard)).toBe(false);
  });

  it("returns false when card is itself wild", () => {
    const j = joker();
    const meld = makeRun([card("5"), j, card("7"), card("8")]);
    const swapCard = card("2", "clubs"); // wild card

    expect(canSwapJokerWithCard(meld, j, swapCard)).toBe(false);
  });

  it("returns false for swapping from set (never allowed)", () => {
    const j = joker();
    const meld = makeSet([card("9", "clubs"), card("9", "diamonds"), j]);
    const swapCard = card("9", "hearts");

    expect(canSwapJokerWithCard(meld, j, swapCard)).toBe(false);
  });

  it("returns false for 2s (only Jokers can be swapped out)", () => {
    const two = card("2", "clubs");
    const meld = makeRun([card("5"), two, card("7"), card("8")]);
    const swapCard = card("6"); // would match position

    expect(canSwapJokerWithCard(meld, two, swapCard)).toBe(false);
  });

  it("returns false if joker is not in the meld", () => {
    const j = joker();
    const otherJoker = joker();
    const meld = makeRun([card("5"), j, card("7"), card("8")]);
    const swapCard = card("6");

    expect(canSwapJokerWithCard(meld, otherJoker, swapCard)).toBe(false);
  });
});
