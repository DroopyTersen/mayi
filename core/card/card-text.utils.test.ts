/**
 * Tests for card text formatting utility
 */

import { describe, it, expect } from "bun:test";
import { formatCardText } from "./card-text.utils";
import type { Card } from "./card.types";

describe("formatCardText", () => {
  it("formats a standard card with suit symbol", () => {
    const card: Card = { id: "hearts-Q", suit: "hearts", rank: "Q" };
    expect(formatCardText(card)).toBe("Q♥");
  });

  it("formats a 10 correctly (multi-digit rank)", () => {
    const card: Card = { id: "spades-10", suit: "spades", rank: "10" };
    expect(formatCardText(card)).toBe("10♠");
  });

  it("formats an Ace", () => {
    const card: Card = { id: "diamonds-A", suit: "diamonds", rank: "A" };
    expect(formatCardText(card)).toBe("A♦");
  });

  it("formats a Joker (no suit)", () => {
    const card: Card = { id: "joker-1", suit: null, rank: "Joker" };
    expect(formatCardText(card)).toBe("Joker");
  });

  it("formats all four suits correctly", () => {
    const hearts: Card = { id: "hearts-5", suit: "hearts", rank: "5" };
    const diamonds: Card = { id: "diamonds-5", suit: "diamonds", rank: "5" };
    const clubs: Card = { id: "clubs-5", suit: "clubs", rank: "5" };
    const spades: Card = { id: "spades-5", suit: "spades", rank: "5" };

    expect(formatCardText(hearts)).toBe("5♥");
    expect(formatCardText(diamonds)).toBe("5♦");
    expect(formatCardText(clubs)).toBe("5♣");
    expect(formatCardText(spades)).toBe("5♠");
  });

  it("formats a 2 (wild card)", () => {
    const card: Card = { id: "clubs-2", suit: "clubs", rank: "2" };
    expect(formatCardText(card)).toBe("2♣");
  });

  it("formats face cards correctly", () => {
    const jack: Card = { id: "hearts-J", suit: "hearts", rank: "J" };
    const queen: Card = { id: "hearts-Q", suit: "hearts", rank: "Q" };
    const king: Card = { id: "hearts-K", suit: "hearts", rank: "K" };

    expect(formatCardText(jack)).toBe("J♥");
    expect(formatCardText(queen)).toBe("Q♥");
    expect(formatCardText(king)).toBe("K♥");
  });
});
