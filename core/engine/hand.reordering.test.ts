import { describe, it, expect } from "bun:test";
import { reorderHand, sortHandByRank, sortHandBySuit, moveCard } from "./hand.reordering";
import type { Card } from "../card/card.types";

// Helper to create test cards
let cardId = 0;
function card(rank: Card["rank"], suit: Card["suit"] = "hearts"): Card {
  return { id: `card-${cardId++}`, suit, rank };
}

function joker(): Card {
  return { id: `joker-${cardId++}`, suit: null, rank: "Joker" };
}

describe("REORDER_HAND command", () => {
  describe("basic reordering", () => {
    it("accepts new order of card ids", () => {
      const card1 = card("3");
      const card2 = card("5");
      const card3 = card("7");
      const hand = [card1, card2, card3];
      const result = reorderHand(hand, [card3.id, card1.id, card2.id]);
      expect(result.success).toBe(true);
    });

    it("hand contains same cards in new order", () => {
      const card1 = card("3");
      const card2 = card("5");
      const card3 = card("7");
      const hand = [card1, card2, card3];
      const result = reorderHand(hand, [card3.id, card1.id, card2.id]);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.hand[0]).toEqual(card3);
        expect(result.hand[1]).toEqual(card1);
        expect(result.hand[2]).toEqual(card2);
      }
    });

    it("hand size is unchanged", () => {
      const card1 = card("3");
      const card2 = card("5");
      const card3 = card("7");
      const hand = [card1, card2, card3];
      const result = reorderHand(hand, [card2.id, card3.id, card1.id]);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.hand.length).toBe(hand.length);
      }
    });

    it("all original cards still present", () => {
      const card1 = card("3");
      const card2 = card("5");
      const card3 = card("7");
      const hand = [card1, card2, card3];
      const result = reorderHand(hand, [card2.id, card3.id, card1.id]);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.hand).toContainEqual(card1);
        expect(result.hand).toContainEqual(card2);
        expect(result.hand).toContainEqual(card3);
      }
    });

    it("no duplicate cards introduced", () => {
      const card1 = card("3");
      const card2 = card("5");
      const card3 = card("7");
      const hand = [card1, card2, card3];
      const result = reorderHand(hand, [card2.id, card3.id, card1.id]);
      expect(result.success).toBe(true);
      if (result.success) {
        const ids = result.hand.map((c) => c.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length);
      }
    });
  });

  describe("valid in any turn state", () => {
    it("works in 'awaitingDraw' state (function is state-agnostic)", () => {
      // reorderHand is a pure function that works regardless of turn state
      // It can be called before drawing
      const card1 = card("3");
      const card2 = card("5");
      const hand = [card1, card2];
      const result = reorderHand(hand, [card2.id, card1.id]);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.hand[0]).toEqual(card2);
        expect(result.hand[1]).toEqual(card1);
      }
    });

    it("works in 'awaitingDiscard' state (function is state-agnostic)", () => {
      // reorderHand works the same after drawing
      const card1 = card("3");
      const card2 = card("5");
      const card3 = card("K"); // simulated drawn card
      const hand = [card1, card2, card3];
      const result = reorderHand(hand, [card3.id, card1.id, card2.id]);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.hand[0]).toEqual(card3);
      }
    });

    it("does not change the current state", () => {
      // reorderHand returns a new array, does not mutate original
      const card1 = card("3");
      const card2 = card("5");
      const originalHand = [card1, card2];
      const handCopy = [...originalHand];
      reorderHand(originalHand, [card2.id, card1.id]);
      // Original hand should be unchanged
      expect(originalHand).toEqual(handCopy);
    });

    it("does not affect hasDrawn flag", () => {
      // reorderHand is a pure function - it only reorders cards
      // It has no knowledge of or effect on turn state flags
      const card1 = card("3");
      const card2 = card("5");
      const hand = [card1, card2];
      const result = reorderHand(hand, [card2.id, card1.id]);
      expect(result.success).toBe(true);
      // The function only returns hand data, no turn state
      if (result.success) {
        expect(result.hand).toBeDefined();
        expect((result as any).hasDrawn).toBeUndefined();
      }
    });

    it("is a 'free action' - doesn't consume turn", () => {
      // reorderHand can be called multiple times
      const card1 = card("3");
      const card2 = card("5");
      const card3 = card("7");
      const hand = [card1, card2, card3];

      // First reorder
      const result1 = reorderHand(hand, [card3.id, card2.id, card1.id]);
      expect(result1.success).toBe(true);

      // Second reorder on the result
      if (result1.success) {
        const result2 = reorderHand(result1.hand, [card1.id, card3.id, card2.id]);
        expect(result2.success).toBe(true);

        // Third reorder
        if (result2.success) {
          const result3 = reorderHand(result2.hand, [card2.id, card1.id, card3.id]);
          expect(result3.success).toBe(true);
        }
      }
    });
  });

  describe("sort by rank", () => {
    it("orders cards A, K, Q, J, 10, 9, 8, 7, 6, 5, 4, 3", () => {
      const c3 = card("3", "hearts");
      const c5 = card("5", "hearts");
      const c9 = card("9", "hearts");
      const cJ = card("J", "hearts");
      const cK = card("K", "hearts");
      const cA = card("A", "hearts");
      const hand = [c3, cK, c9, cA, c5, cJ];
      const sorted = sortHandByRank(hand);
      expect(sorted[0].rank).toBe("A");
      expect(sorted[1].rank).toBe("K");
      expect(sorted[2].rank).toBe("J");
      expect(sorted[3].rank).toBe("9");
      expect(sorted[4].rank).toBe("5");
      expect(sorted[5].rank).toBe("3");
    });

    it("wilds (2s, Jokers) go at end", () => {
      const c5 = card("5", "hearts");
      const c9 = card("9", "hearts");
      const c2 = card("2", "spades");
      const cJoker = joker();
      const cK = card("K", "hearts");
      const hand = [c2, c5, cJoker, cK, c9];
      const sorted = sortHandByRank(hand);
      // Naturals first (K, 9, 5), then wilds (2, Joker)
      expect(sorted[0].rank).toBe("K");
      expect(sorted[1].rank).toBe("9");
      expect(sorted[2].rank).toBe("5");
      expect(sorted[3].rank).toBe("2");
      expect(sorted[4].rank).toBe("Joker");
    });

    it("within same rank, any order is fine (or by suit)", () => {
      const c9h = card("9", "hearts");
      const c9s = card("9", "spades");
      const c9d = card("9", "diamonds");
      const c9c = card("9", "clubs");
      const hand = [c9h, c9c, c9s, c9d];
      const sorted = sortHandByRank(hand);
      // All should be 9s, sorted by suit (spades, hearts, diamonds, clubs)
      expect(sorted.every((c) => c.rank === "9")).toBe(true);
      expect(sorted[0].suit).toBe("spades");
      expect(sorted[1].suit).toBe("hearts");
      expect(sorted[2].suit).toBe("diamonds");
      expect(sorted[3].suit).toBe("clubs");
    });
  });

  describe("sort by suit", () => {
    it("groups cards by suit", () => {
      const cH5 = card("5", "hearts");
      const cS9 = card("9", "spades");
      const cD3 = card("3", "diamonds");
      const cC7 = card("7", "clubs");
      const cHK = card("K", "hearts");
      const cSA = card("A", "spades");
      const hand = [cH5, cSA, cD3, cC7, cHK, cS9];
      const sorted = sortHandBySuit(hand);
      // Order: spades, hearts, diamonds, clubs
      expect(sorted[0].suit).toBe("spades");
      expect(sorted[1].suit).toBe("spades");
      expect(sorted[2].suit).toBe("hearts");
      expect(sorted[3].suit).toBe("hearts");
      expect(sorted[4].suit).toBe("diamonds");
      expect(sorted[5].suit).toBe("clubs");
    });

    it("within suit, ordered by rank", () => {
      const cH5 = card("5", "hearts");
      const cHK = card("K", "hearts");
      const cH9 = card("9", "hearts");
      const cHA = card("A", "hearts");
      const hand = [cH5, cHK, cH9, cHA];
      const sorted = sortHandBySuit(hand);
      // All hearts, ordered A, K, 9, 5
      expect(sorted[0].rank).toBe("A");
      expect(sorted[1].rank).toBe("K");
      expect(sorted[2].rank).toBe("9");
      expect(sorted[3].rank).toBe("5");
    });

    it("wilds go at end", () => {
      const cH5 = card("5", "hearts");
      const cS9 = card("9", "spades");
      const c2 = card("2", "diamonds");
      const cJoker = joker();
      const hand = [c2, cH5, cJoker, cS9];
      const sorted = sortHandBySuit(hand);
      // Naturals first (spades, then hearts), then wilds (2, Joker)
      expect(sorted[0].rank).toBe("9");
      expect(sorted[0].suit).toBe("spades");
      expect(sorted[1].rank).toBe("5");
      expect(sorted[1].suit).toBe("hearts");
      expect(sorted[2].rank).toBe("2");
      expect(sorted[3].rank).toBe("Joker");
    });
  });

  describe("move single card", () => {
    it("can move card from position A to position B", () => {
      const card1 = card("3", "hearts");
      const card2 = card("5", "diamonds");
      const card3 = card("9", "clubs");
      const hand = [card1, card2, card3];
      const result = moveCard(hand, 0, 2);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.hand[2]).toEqual(card1);
      }
    });

    it("other cards shift appropriately", () => {
      const card1 = card("3", "hearts");
      const card2 = card("5", "diamonds");
      const card3 = card("9", "clubs");
      const card4 = card("K", "spades");
      const hand = [card1, card2, card3, card4];
      // Move card from index 0 to index 2
      const result = moveCard(hand, 0, 2);
      expect(result.success).toBe(true);
      if (result.success) {
        // card2 and card3 shift left, card1 goes to index 2
        expect(result.hand[0]).toEqual(card2);
        expect(result.hand[1]).toEqual(card3);
        expect(result.hand[2]).toEqual(card1);
        expect(result.hand[3]).toEqual(card4);
      }
    });

    it("example: (3H 5D 9C) move pos 3 to pos 1 results in (9C 3H 5D)", () => {
      // Note: positions in test description are 1-indexed, but function uses 0-indexed
      const c3H = card("3", "hearts");
      const c5D = card("5", "diamonds");
      const c9C = card("9", "clubs");
      const hand = [c3H, c5D, c9C];
      // Move index 2 (pos 3) to index 0 (pos 1)
      const result = moveCard(hand, 2, 0);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.hand[0]).toEqual(c9C);
        expect(result.hand[1]).toEqual(c3H);
        expect(result.hand[2]).toEqual(c5D);
      }
    });
  });

  describe("validation", () => {
    it("rejects if cardIds don't match current hand exactly", () => {
      const card1 = card("3");
      const card2 = card("5");
      const card3 = card("7");
      const hand = [card1, card2, card3];
      // Using wrong IDs
      const result = reorderHand(hand, ["wrong-id-1", "wrong-id-2", "wrong-id-3"]);
      expect(result.success).toBe(false);
    });

    it("rejects if cardIds has wrong count", () => {
      const card1 = card("3");
      const card2 = card("5");
      const card3 = card("7");
      const hand = [card1, card2, card3];
      // Too few IDs
      const result1 = reorderHand(hand, [card1.id, card2.id]);
      expect(result1.success).toBe(false);
      // Too many IDs
      const result2 = reorderHand(hand, [card1.id, card2.id, card3.id, "extra-id"]);
      expect(result2.success).toBe(false);
    });

    it("rejects if cardIds contains id not in hand", () => {
      const card1 = card("3");
      const card2 = card("5");
      const card3 = card("7");
      const hand = [card1, card2, card3];
      const result = reorderHand(hand, [card1.id, card2.id, "not-in-hand"]);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("not in hand");
      }
    });

    it("rejects if cardIds is missing a card from hand", () => {
      const card1 = card("3");
      const card2 = card("5");
      const card3 = card("7");
      const hand = [card1, card2, card3];
      // Missing card3, added extra card1 instead
      const result = reorderHand(hand, [card1.id, card2.id, card1.id]);
      expect(result.success).toBe(false);
    });

    it("rejects if cardIds has duplicates", () => {
      const card1 = card("3");
      const card2 = card("5");
      const card3 = card("7");
      const hand = [card1, card2, card3];
      const result = reorderHand(hand, [card1.id, card1.id, card3.id]);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Duplicate");
      }
    });

    it("on rejection, hand remains unchanged", () => {
      const card1 = card("3");
      const card2 = card("5");
      const card3 = card("7");
      const originalHand = [card1, card2, card3];
      const handCopy = [...originalHand];
      // Invalid reorder attempt
      const result = reorderHand(originalHand, ["wrong-id", card2.id, card3.id]);
      expect(result.success).toBe(false);
      // Original hand should be unchanged
      expect(originalHand).toEqual(handCopy);
    });
  });

  describe("edge cases", () => {
    it.todo("reordering hand of 1 card (no-op, but valid)", () => {});

    it.todo("reordering to same order (no-op, but valid)", () => {});

    it.todo(
      "reordering empty hand (edge case - probably invalid game state)",
      () => {}
    );
  });
});
