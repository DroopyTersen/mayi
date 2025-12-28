import { describe, it, expect } from "bun:test";
import { isWild, isNatural, getPointValue } from "./card.utils";
import type { Card } from "./card.types";

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

  it("returns 2 for wild 2s", () => {
    const two: Card = { id: "1", suit: "hearts", rank: "2" };
    expect(getPointValue(two)).toBe(2);
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
