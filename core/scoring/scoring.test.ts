import { describe, it, expect } from "bun:test";
import { calculateHandScore } from "./scoring";
import type { Card } from "../card/card.types";

let cardId = 0;
function card(rank: Card["rank"], suit: Card["suit"] = "hearts"): Card {
  return { id: `card-${cardId++}`, suit, rank };
}

function joker(): Card {
  return { id: `joker-${cardId++}`, suit: null, rank: "Joker" };
}

describe("calculateHandScore", () => {
  it("empty hand scores 0", () => {
    expect(calculateHandScore([])).toBe(0);
  });

  it("hand with single 5 scores 5", () => {
    expect(calculateHandScore([card("5")])).toBe(5);
  });

  it("hand with 3, 4, 5 scores 12", () => {
    expect(calculateHandScore([card("3"), card("4"), card("5")])).toBe(12);
  });

  it("hand with J, Q, K scores 30", () => {
    expect(calculateHandScore([card("J"), card("Q"), card("K")])).toBe(30);
  });

  it("hand with single Ace scores 15", () => {
    expect(calculateHandScore([card("A")])).toBe(15);
  });

  it("hand with single 2 scores 20", () => {
    expect(calculateHandScore([card("2")])).toBe(20);
  });

  it("hand with single Joker scores 50", () => {
    expect(calculateHandScore([joker()])).toBe(50);
  });

  it("mixed hand: (3♥ J♦ A♠ Joker) scores 3 + 10 + 15 + 50 = 78", () => {
    const hand = [card("3", "hearts"), card("J", "diamonds"), card("A", "spades"), joker()];
    expect(calculateHandScore(hand)).toBe(78);
  });

  it("worst case hand: multiple Jokers (Joker Joker Joker) scores 150", () => {
    expect(calculateHandScore([joker(), joker(), joker()])).toBe(150);
  });

  it("all number cards 3-10 score face value", () => {
    expect(calculateHandScore([card("3")])).toBe(3);
    expect(calculateHandScore([card("4")])).toBe(4);
    expect(calculateHandScore([card("6")])).toBe(6);
    expect(calculateHandScore([card("7")])).toBe(7);
    expect(calculateHandScore([card("8")])).toBe(8);
    expect(calculateHandScore([card("9")])).toBe(9);
    expect(calculateHandScore([card("10")])).toBe(10);
  });
});
