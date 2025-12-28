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
    it.todo("works in 'awaitingDraw' state", () => {});

    it.todo("works in 'awaitingDiscard' state", () => {});

    it.todo("does not change the current state", () => {});

    it.todo("does not affect hasDrawn flag", () => {});

    it.todo("is a 'free action' - doesn't consume turn", () => {});
  });

  describe("sort by rank", () => {
    it.todo("orders cards A, K, Q, J, 10, 9, 8, 7, 6, 5, 4, 3", () => {});

    it.todo("wilds (2s, Jokers) go at end", () => {});

    it.todo("within same rank, any order is fine (or by suit)", () => {});
  });

  describe("sort by suit", () => {
    it.todo("groups cards by suit", () => {});

    it.todo("within suit, ordered by rank", () => {});

    it.todo("wilds go at end", () => {});
  });

  describe("move single card", () => {
    it.todo("can move card from position A to position B", () => {});

    it.todo("other cards shift appropriately", () => {});

    it.todo(
      "example: (3H 5D 9C) move pos 3 to pos 1 results in (9C 3H 5D)",
      () => {}
    );
  });

  describe("validation", () => {
    it.todo("rejects if cardIds don't match current hand exactly", () => {});

    it.todo("rejects if cardIds has wrong count", () => {});

    it.todo("rejects if cardIds contains id not in hand", () => {});

    it.todo("rejects if cardIds is missing a card from hand", () => {});

    it.todo("rejects if cardIds has duplicates", () => {});

    it.todo("on rejection, hand remains unchanged", () => {});
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
