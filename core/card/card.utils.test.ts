import { describe, it, expect } from "bun:test";
import { isWild, isNatural, getPointValue, getRankValue } from "./card.utils";
import type { Card, Rank } from "./card.types";

describe("isWild", () => {
  it("returns true for Joker", () => {
    const joker: Card = { id: "1", suit: null, rank: "Joker" };
    expect(isWild(joker)).toBe(true);
  });

  it("returns true for 2s (all suits)", () => {
    const two: Card = { id: "1", suit: "hearts", rank: "2" };
    expect(isWild(two)).toBe(true);

    const twoClubs: Card = { id: "2", suit: "clubs", rank: "2" };
    expect(isWild(twoClubs)).toBe(true);
  });

  it("returns false for regular cards", () => {
    const ace: Card = { id: "1", suit: "spades", rank: "A" };
    expect(isWild(ace)).toBe(false);

    const nine: Card = { id: "2", suit: "hearts", rank: "9" };
    expect(isWild(nine)).toBe(false);

    const king: Card = { id: "3", suit: "diamonds", rank: "K" };
    expect(isWild(king)).toBe(false);
  });
});

describe("isNatural", () => {
  it("returns false for Joker", () => {
    const joker: Card = { id: "1", suit: null, rank: "Joker" };
    expect(isNatural(joker)).toBe(false);
  });

  it("returns false for 2s", () => {
    const two: Card = { id: "1", suit: "hearts", rank: "2" };
    expect(isNatural(two)).toBe(false);
  });

  it("returns true for regular cards", () => {
    const ace: Card = { id: "1", suit: "spades", rank: "A" };
    expect(isNatural(ace)).toBe(true);

    const five: Card = { id: "2", suit: "clubs", rank: "5" };
    expect(isNatural(five)).toBe(true);
  });
});

describe("getPointValue", () => {
  it("returns 50 for Joker", () => {
    const joker: Card = { id: "1", suit: null, rank: "Joker" };
    expect(getPointValue(joker)).toBe(50);
  });

  it("returns 15 for Ace", () => {
    const ace: Card = { id: "1", suit: "spades", rank: "A" };
    expect(getPointValue(ace)).toBe(15);
  });

  it("returns 10 for face cards (J, Q, K)", () => {
    const jack: Card = { id: "1", suit: "hearts", rank: "J" };
    expect(getPointValue(jack)).toBe(10);

    const queen: Card = { id: "2", suit: "diamonds", rank: "Q" };
    expect(getPointValue(queen)).toBe(10);

    const king: Card = { id: "3", suit: "clubs", rank: "K" };
    expect(getPointValue(king)).toBe(10);
  });

  it("returns 20 for wild 2s", () => {
    const two: Card = { id: "1", suit: "hearts", rank: "2" };
    expect(getPointValue(two)).toBe(20);
  });

  it("returns face value for number cards 3-10", () => {
    const three: Card = { id: "1", suit: "spades", rank: "3" };
    expect(getPointValue(three)).toBe(3);

    const seven: Card = { id: "2", suit: "hearts", rank: "7" };
    expect(getPointValue(seven)).toBe(7);

    const ten: Card = { id: "3", suit: "diamonds", rank: "10" };
    expect(getPointValue(ten)).toBe(10);
  });
});

describe("getRankValue", () => {
  it("returns correct values for number cards in run order", () => {
    expect(getRankValue("3")).toBe(3);
    expect(getRankValue("4")).toBe(4);
    expect(getRankValue("5")).toBe(5);
    expect(getRankValue("6")).toBe(6);
    expect(getRankValue("7")).toBe(7);
    expect(getRankValue("8")).toBe(8);
    expect(getRankValue("9")).toBe(9);
    expect(getRankValue("10")).toBe(10);
  });

  it("returns correct values for face cards", () => {
    expect(getRankValue("J")).toBe(11);
    expect(getRankValue("Q")).toBe(12);
    expect(getRankValue("K")).toBe(13);
  });

  it("returns 14 for Ace (highest in runs)", () => {
    expect(getRankValue("A")).toBe(14);
  });

  it("returns null for wild cards (2 and Joker)", () => {
    expect(getRankValue("2")).toBeNull();
    expect(getRankValue("Joker")).toBeNull();
  });

  it("returns null for invalid ranks", () => {
    expect(getRankValue("NotARank" as Rank)).toBeNull();
  });

  it("maintains correct ordering: 3 < 4 < ... < 10 < J < Q < K < A", () => {
    const ranks: Rank[] = ["3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
    for (let i = 0; i < ranks.length - 1; i++) {
      const current = getRankValue(ranks[i]!);
      const next = getRankValue(ranks[i + 1]!);
      expect(current).not.toBeNull();
      expect(next).not.toBeNull();
      expect(current!).toBeLessThan(next!);
    }
  });
});
