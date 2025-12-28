import { describe, it, expect } from "bun:test";
import { createDeck, shuffle } from "./card.deck";
import type { Card } from "./card.types";

describe("createDeck", () => {
  describe("deck size", () => {
    it("creates 108 cards for 2 decks + 4 jokers (3-5 player setup)", () => {
      const deck = createDeck({ deckCount: 2, jokerCount: 4 });
      expect(deck.length).toBe(108); // 52*2 + 4
    });

    it("creates 162 cards for 3 decks + 6 jokers (6-8 player setup)", () => {
      const deck = createDeck({ deckCount: 3, jokerCount: 6 });
      expect(deck.length).toBe(162); // 52*3 + 6
    });
  });

  describe("deck contents", () => {
    it("contains all ranks for each deck", () => {
      const deck = createDeck({ deckCount: 1, jokerCount: 0 });

      const ranks = ["A", "K", "Q", "J", "10", "9", "8", "7", "6", "5", "4", "3", "2"];
      const suits = ["hearts", "diamonds", "clubs", "spades"];

      for (const rank of ranks) {
        for (const suit of suits) {
          const matches = deck.filter((c) => c.rank === rank && c.suit === suit);
          expect(matches.length).toBe(1);
        }
      }
    });

    it("contains correct number of jokers", () => {
      const deck = createDeck({ deckCount: 2, jokerCount: 4 });
      const jokers = deck.filter((c) => c.rank === "Joker");
      expect(jokers.length).toBe(4);
    });

    it("jokers have null suit", () => {
      const deck = createDeck({ deckCount: 1, jokerCount: 2 });
      const jokers = deck.filter((c) => c.rank === "Joker");
      for (const joker of jokers) {
        expect(joker.suit).toBeNull();
      }
    });

    it("all cards have unique ids", () => {
      const deck = createDeck({ deckCount: 2, jokerCount: 4 });
      const ids = deck.map((c) => c.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(deck.length);
    });
  });

  describe("multiple decks", () => {
    it("contains duplicates of each card for multiple decks", () => {
      const deck = createDeck({ deckCount: 2, jokerCount: 0 });

      // Should have 2 of each card (e.g., 2 Ace of Spades)
      const aceOfSpades = deck.filter((c) => c.rank === "A" && c.suit === "spades");
      expect(aceOfSpades.length).toBe(2);
    });
  });
});

describe("shuffle", () => {
  it("returns a new array (does not mutate original)", () => {
    const deck = createDeck({ deckCount: 1, jokerCount: 2 });
    const original = [...deck];
    const shuffled = shuffle(deck);

    // Original should be unchanged
    expect(deck).toEqual(original);
    // Shuffled should be a different array reference
    expect(shuffled).not.toBe(deck);
  });

  it("preserves all cards (same length and contents)", () => {
    const deck = createDeck({ deckCount: 2, jokerCount: 4 });
    const shuffled = shuffle(deck);

    expect(shuffled.length).toBe(deck.length);

    // Check all cards are present (by id)
    const originalIds = new Set(deck.map((c) => c.id));
    const shuffledIds = new Set(shuffled.map((c) => c.id));
    expect(shuffledIds).toEqual(originalIds);
  });

  it("produces different order (statistical test)", () => {
    const deck = createDeck({ deckCount: 2, jokerCount: 4 });

    // Shuffle multiple times and check that we get different results
    // This is probabilistic but with 108 cards, same order is virtually impossible
    const shuffled1 = shuffle(deck);
    const shuffled2 = shuffle(deck);

    // At least one should differ from original
    const ids1 = shuffled1.map((c) => c.id).join(",");
    const ids2 = shuffled2.map((c) => c.id).join(",");
    const idsOriginal = deck.map((c) => c.id).join(",");

    // Check that at least one shuffle differs from original
    expect(ids1 !== idsOriginal || ids2 !== idsOriginal).toBe(true);
  });
});
