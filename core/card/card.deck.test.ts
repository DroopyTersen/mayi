import { describe, it, expect } from "bun:test";
import { createDeck, shuffle, deal } from "./card.deck";
import type { Card } from "./card.types";

function countRankSuit(cards: Card[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const card of cards) {
    const key = `${card.rank}-${card.suit}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function dealAllCardsRoundRobin(deck: Card[], playerCount: number): Card[][] {
  const hands: Card[][] = Array.from({ length: playerCount }, () => []);
  for (let i = 0; i < deck.length; i++) {
    const hand = hands[i % playerCount];
    if (hand) {
      hand.push(deck[i]!);
    }
  }
  return hands;
}

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

    it("creates exactly one of each rank+suit for a single deck", () => {
      const deck = createDeck({ deckCount: 1, jokerCount: 2 });
      const nonJokers = deck.filter((c) => c.rank !== "Joker");
      const jokers = deck.filter((c) => c.rank === "Joker");

      const counts = countRankSuit(nonJokers);
      expect(counts.size).toBe(52);
      for (const count of counts.values()) {
        expect(count).toBe(1);
      }
      expect(jokers.length).toBe(2);
    });
  });

  describe("multiple decks", () => {
    it("contains duplicates of each card for multiple decks", () => {
      const deck = createDeck({ deckCount: 2, jokerCount: 0 });

      // Should have 2 of each card (e.g., 2 Ace of Spades)
      const aceOfSpades = deck.filter((c) => c.rank === "A" && c.suit === "spades");
      expect(aceOfSpades.length).toBe(2);
    });

    it("creates exactly two of each rank+suit for two decks", () => {
      const deck = createDeck({ deckCount: 2, jokerCount: 4 });
      const nonJokers = deck.filter((c) => c.rank !== "Joker");

      const counts = countRankSuit(nonJokers);
      expect(counts.size).toBe(52);
      for (const count of counts.values()) {
        expect(count).toBe(2);
      }
    });

    it("creates exactly three of each rank+suit for three decks", () => {
      const deck = createDeck({ deckCount: 3, jokerCount: 6 });
      const nonJokers = deck.filter((c) => c.rank !== "Joker");

      const counts = countRankSuit(nonJokers);
      expect(counts.size).toBe(52);
      for (const count of counts.values()) {
        expect(count).toBe(3);
      }
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

describe("deal all cards", () => {
  it("deals every card into hands for a single deck", () => {
    const deck = shuffle(createDeck({ deckCount: 1, jokerCount: 2 }));
    const hands = dealAllCardsRoundRobin(deck, 4);
    const allCards = hands.flat();

    expect(allCards.length).toBe(deck.length);

    const ids = new Set(allCards.map((c) => c.id));
    expect(ids.size).toBe(allCards.length);

    const nonJokers = allCards.filter((c) => c.rank !== "Joker");
    const counts = countRankSuit(nonJokers);
    expect(counts.size).toBe(52);
    for (const count of counts.values()) {
      expect(count).toBe(1);
    }
  });

  it("deals every card into hands for N decks", () => {
    const deckCounts = [2, 3];
    for (const deckCount of deckCounts) {
      const deck = shuffle(createDeck({ deckCount, jokerCount: deckCount * 2 }));
      const hands = dealAllCardsRoundRobin(deck, 5);
      const allCards = hands.flat();

      expect(allCards.length).toBe(deck.length);

      const ids = new Set(allCards.map((c) => c.id));
      expect(ids.size).toBe(allCards.length);

      const nonJokers = allCards.filter((c) => c.rank !== "Joker");
      const counts = countRankSuit(nonJokers);
      expect(counts.size).toBe(52);
      for (const count of counts.values()) {
        expect(count).toBe(deckCount);
      }

      const jokers = allCards.filter((c) => c.rank === "Joker");
      expect(jokers.length).toBe(deckCount * 2);
    }
  });
});

describe("deal", () => {
  describe("hand distribution", () => {
    it("deals 11 cards to each player", () => {
      const deck = createDeck({ deckCount: 2, jokerCount: 4 });
      const result = deal(deck, 4);

      expect(result.hands.length).toBe(4);
      for (const hand of result.hands) {
        expect(hand.length).toBe(11);
      }
    });

    it("works with 3 players", () => {
      const deck = createDeck({ deckCount: 2, jokerCount: 4 });
      const result = deal(deck, 3);

      expect(result.hands.length).toBe(3);
      for (const hand of result.hands) {
        expect(hand.length).toBe(11);
      }
    });

    it("works with 8 players (uses 3 decks)", () => {
      const deck = createDeck({ deckCount: 3, jokerCount: 6 });
      const result = deal(deck, 8);

      expect(result.hands.length).toBe(8);
      for (const hand of result.hands) {
        expect(hand.length).toBe(11);
      }
    });
  });

  describe("stock pile", () => {
    it("remaining cards form the stock pile", () => {
      const deck = createDeck({ deckCount: 2, jokerCount: 4 }); // 108 cards
      const result = deal(deck, 4);

      // 4 players * 11 cards = 44 dealt
      // 1 card to discard
      // 108 - 44 - 1 = 63 in stock
      expect(result.stock.length).toBe(63);
    });
  });

  describe("discard pile", () => {
    it("starts discard pile with one card from top of stock", () => {
      const deck = createDeck({ deckCount: 2, jokerCount: 4 });
      const result = deal(deck, 4);

      expect(result.discard.length).toBe(1);
    });
  });

  describe("card distribution properties", () => {
    it("does not mutate the original deck", () => {
      const deck = createDeck({ deckCount: 2, jokerCount: 4 });
      const original = [...deck];
      deal(deck, 4);

      expect(deck).toEqual(original);
    });

    it("all cards are accounted for (hands + stock + discard)", () => {
      const deck = createDeck({ deckCount: 2, jokerCount: 4 });
      const result = deal(deck, 4);

      const allDealtCards = [
        ...result.hands.flat(),
        ...result.stock,
        ...result.discard,
      ];

      expect(allDealtCards.length).toBe(deck.length);

      // Verify all card IDs are present
      const originalIds = new Set(deck.map((c) => c.id));
      const dealtIds = new Set(allDealtCards.map((c) => c.id));
      expect(dealtIds).toEqual(originalIds);
    });

    it("each card appears in exactly one location", () => {
      const deck = createDeck({ deckCount: 2, jokerCount: 4 });
      const result = deal(deck, 4);

      const allDealtCards = [
        ...result.hands.flat(),
        ...result.stock,
        ...result.discard,
      ];

      const ids = allDealtCards.map((c) => c.id);
      const uniqueIds = new Set(ids);

      // No duplicates
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe("edge cases", () => {
    it("throws error if not enough cards for all players", () => {
      const deck = createDeck({ deckCount: 1, jokerCount: 0 }); // 52 cards
      // 5 players * 11 cards = 55 cards needed (plus 1 for discard)

      expect(() => deal(deck, 5)).toThrow();
    });
  });
});
