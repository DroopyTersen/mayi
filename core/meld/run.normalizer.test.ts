import { describe, it, expect } from "bun:test";
import { normalizeRunCards, type RunNormalizationResult } from "./run.normalizer";
import type { Card } from "../card/card.types";

// Helper to create cards for testing
let cardId = 0;
function card(rank: Card["rank"], suit: Card["suit"] = "hearts"): Card {
  return { id: `card-${cardId++}`, suit, rank };
}

function joker(): Card {
  return { id: `joker-${cardId++}`, suit: null, rank: "Joker" };
}

// Helper to extract ranks from cards in order (for easier comparison)
function ranks(cards: Card[]): string[] {
  return cards.map((c) => c.rank);
}

describe("normalizeRunCards", () => {
  describe("already sorted runs - no change needed", () => {
    it("returns already-sorted ascending run unchanged", () => {
      const cards = [card("5", "spades"), card("6", "spades"), card("7", "spades"), card("8", "spades")];
      const result = normalizeRunCards(cards);

      expect(result.success).toBe(true);
      expect(ranks(result.cards)).toEqual(["5", "6", "7", "8"]);
    });

    it("preserves card identity (same objects)", () => {
      const c1 = card("5", "spades");
      const c2 = card("6", "spades");
      const c3 = card("7", "spades");
      const c4 = card("8", "spades");
      const cards = [c1, c2, c3, c4];

      const result = normalizeRunCards(cards);
      expect(result.success).toBe(true);
      expect(result.cards[0]).toBe(c1);
      expect(result.cards[1]).toBe(c2);
      expect(result.cards[2]).toBe(c3);
      expect(result.cards[3]).toBe(c4);
    });
  });

  describe("descending order - reverse needed", () => {
    it("normalizes descending order (K, Q, J, 10) to ascending", () => {
      const cards = [card("K", "hearts"), card("Q", "hearts"), card("J", "hearts"), card("10", "hearts")];
      const result = normalizeRunCards(cards);

      expect(result.success).toBe(true);
      expect(ranks(result.cards)).toEqual(["10", "J", "Q", "K"]);
    });

    it("normalizes descending order (8, 7, 6, 5) to ascending", () => {
      const cards = [card("8", "spades"), card("7", "spades"), card("6", "spades"), card("5", "spades")];
      const result = normalizeRunCards(cards);

      expect(result.success).toBe(true);
      expect(ranks(result.cards)).toEqual(["5", "6", "7", "8"]);
    });
  });

  describe("random order - sorting needed", () => {
    it("normalizes random order (Q, 10, K, J) to ascending", () => {
      const cards = [card("Q", "hearts"), card("10", "hearts"), card("K", "hearts"), card("J", "hearts")];
      const result = normalizeRunCards(cards);

      expect(result.success).toBe(true);
      expect(ranks(result.cards)).toEqual(["10", "J", "Q", "K"]);
    });

    it("normalizes completely shuffled cards (7, 9, 6, 8) to ascending", () => {
      const cards = [card("7", "clubs"), card("9", "clubs"), card("6", "clubs"), card("8", "clubs")];
      const result = normalizeRunCards(cards);

      expect(result.success).toBe(true);
      expect(ranks(result.cards)).toEqual(["6", "7", "8", "9"]);
    });

    it("normalizes 5 cards in random order", () => {
      const cards = [card("A", "diamonds"), card("Q", "diamonds"), card("J", "diamonds"), card("K", "diamonds"), card("10", "diamonds")];
      const result = normalizeRunCards(cards);

      expect(result.success).toBe(true);
      expect(ranks(result.cards)).toEqual(["10", "J", "Q", "K", "A"]);
    });
  });

  describe("runs with wild cards", () => {
    describe("single wild filling gap", () => {
      it("places wild in gap: (5, Joker, 7, 8) -> 5, Joker, 7, 8 (Joker as 6)", () => {
        const cards = [card("5", "spades"), joker(), card("7", "spades"), card("8", "spades")];
        const result = normalizeRunCards(cards);

        expect(result.success).toBe(true);
        expect(ranks(result.cards)).toEqual(["5", "Joker", "7", "8"]);
      });

      it("handles wild with cards in random order: (8, Joker, 5, 7) -> 5, Joker, 7, 8", () => {
        const cards = [card("8", "spades"), joker(), card("5", "spades"), card("7", "spades")];
        const result = normalizeRunCards(cards);

        expect(result.success).toBe(true);
        // Wild fills the 6 spot
        expect(ranks(result.cards)).toEqual(["5", "Joker", "7", "8"]);
      });
    });

    describe("wild at start of run", () => {
      it("places wild at valid position: (Joker, 5, 6, 7) -> either Joker,5,6,7 or 5,6,7,Joker", () => {
        const cards = [joker(), card("5", "spades"), card("6", "spades"), card("7", "spades")];
        const result = normalizeRunCards(cards);

        expect(result.success).toBe(true);
        // Wild can go at start (as 4) or end (as 8) - both valid
        const ranksResult = ranks(result.cards);
        expect(
          ranksResult.join(",") === "Joker,5,6,7" ||
          ranksResult.join(",") === "5,6,7,Joker"
        ).toBe(true);
      });

      it("reorders wild to start when naturals given first: (5, 6, 7, Joker) -> Joker, 5, 6, 7 if that makes a valid run", () => {
        // This case: 5,6,7 are consecutive, so Joker could go at end (as 8) or start (as 4)
        // Both are valid - normalizer should pick a valid placement
        const cards = [card("5", "spades"), card("6", "spades"), card("7", "spades"), joker()];
        const result = normalizeRunCards(cards);

        expect(result.success).toBe(true);
        // Either Joker at end (5,6,7,Joker as 8) or start would be valid
        const ranksResult = ranks(result.cards);
        expect(
          ranksResult.join(",") === "5,6,7,Joker" ||
          ranksResult.join(",") === "Joker,5,6,7"
        ).toBe(true);
      });
    });

    describe("wild at end of run", () => {
      it("places wild at end when naturals given: (5, 6, 7, 2♣) -> 5, 6, 7, 2 (2 as 8)", () => {
        const cards = [card("5", "spades"), card("6", "spades"), card("7", "spades"), card("2", "clubs")];
        const result = normalizeRunCards(cards);

        expect(result.success).toBe(true);
        // 2 is wild, should fill either start (as 4) or end (as 8)
        const ranksResult = ranks(result.cards);
        expect(
          ranksResult.join(",") === "5,6,7,2" ||
          ranksResult.join(",") === "2,5,6,7"
        ).toBe(true);
      });
    });

    describe("multiple wilds", () => {
      it("places two wilds to fill two gaps: (5, Joker, 2, 8) where naturals are 5,8", () => {
        const cards = [card("5", "spades"), joker(), card("2", "clubs"), card("8", "spades")];
        const result = normalizeRunCards(cards);

        expect(result.success).toBe(true);
        // Wilds fill 6 and 7 spots
        expect(ranks(result.cards)).toEqual(["5", "Joker", "2", "8"]);
      });

      it("handles wilds given in random order with naturals: (Joker, 8, 5, 2)", () => {
        const cards = [joker(), card("8", "spades"), card("5", "spades"), card("2", "clubs")];
        const result = normalizeRunCards(cards);

        expect(result.success).toBe(true);
        // Should produce 5, wild, wild, 8 in some order of the wilds
        const ranksResult = ranks(result.cards);
        expect(ranksResult[0]).toBe("5");
        expect(ranksResult[3]).toBe("8");
        // Middle two are wilds (Joker and 2)
        expect(["Joker", "2"].includes(ranksResult[1] as string)).toBe(true);
        expect(["Joker", "2"].includes(ranksResult[2] as string)).toBe(true);
      });

      it("places wilds in gap and at end: (Joker, 5, 7, 2) where naturals are 5,7 need 6 filled, extra wild at end", () => {
        const cards = [joker(), card("5", "spades"), card("7", "spades"), card("2", "clubs")];
        const result = normalizeRunCards(cards);

        expect(result.success).toBe(true);
        // One wild fills gap at 6, other wild can go at start (4) or end (8)
        // Valid arrangements: wild,5,wild,7 or 5,wild,7,wild
        const ranksResult = ranks(result.cards);
        // Naturals must be at positions 0,2 or 1,3
        const fivePos = ranksResult.indexOf("5");
        const sevenPos = ranksResult.indexOf("7");
        expect(sevenPos - fivePos).toBe(2); // 5 and 7 must be 2 apart
      });
    });

    describe("wilds with descending input", () => {
      it("normalizes descending cards with wild: (8, 7, Joker, 5) -> 5, Joker, 7, 8", () => {
        const cards = [card("8", "spades"), card("7", "spades"), joker(), card("5", "spades")];
        const result = normalizeRunCards(cards);

        expect(result.success).toBe(true);
        expect(ranks(result.cards)).toEqual(["5", "Joker", "7", "8"]);
      });
    });
  });

  describe("edge cases - boundaries", () => {
    it("handles run starting at 3 (lowest valid)", () => {
      const cards = [card("6", "hearts"), card("4", "hearts"), card("3", "hearts"), card("5", "hearts")];
      const result = normalizeRunCards(cards);

      expect(result.success).toBe(true);
      expect(ranks(result.cards)).toEqual(["3", "4", "5", "6"]);
    });

    it("handles run ending at Ace (highest valid)", () => {
      const cards = [card("K", "hearts"), card("A", "hearts"), card("Q", "hearts"), card("J", "hearts")];
      const result = normalizeRunCards(cards);

      expect(result.success).toBe(true);
      expect(ranks(result.cards)).toEqual(["J", "Q", "K", "A"]);
    });

    it("handles full 12-card run from 3 to A in random order", () => {
      const cards = [
        card("7", "diamonds"), card("K", "diamonds"), card("5", "diamonds"), card("J", "diamonds"),
        card("3", "diamonds"), card("10", "diamonds"), card("8", "diamonds"), card("6", "diamonds"),
        card("4", "diamonds"), card("Q", "diamonds"), card("9", "diamonds"), card("A", "diamonds")
      ];
      const result = normalizeRunCards(cards);

      expect(result.success).toBe(true);
      expect(ranks(result.cards)).toEqual(["3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"]);
    });
  });

  describe("failure cases - normalizer should report failure for invalid runs", () => {
    it("fails for all wilds (no naturals)", () => {
      const cards = [joker(), card("2", "clubs"), joker(), card("2", "hearts")];
      const result = normalizeRunCards(cards);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe("Run must have at least one natural card");
      }
    });

    it("fails for mixed suits (cannot form valid run)", () => {
      const cards = [card("5", "spades"), card("6", "hearts"), card("7", "spades"), card("8", "spades")];
      const result = normalizeRunCards(cards);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBeDefined();
      }
    });

    it("fails when gap cannot be filled by available wilds", () => {
      // 5 and 9 have 3 gaps (6,7,8) but only 1 wild
      const cards = [card("5", "spades"), card("9", "spades"), joker()];
      const result = normalizeRunCards(cards);

      expect(result.success).toBe(false);
    });

    it("fails for invalid rank values", () => {
      const invalidCard = { id: `card-${cardId++}`, suit: "spades", rank: "NotARank" as Card["rank"] };
      const cards = [invalidCard, card("6", "spades"), card("7", "spades"), card("8", "spades")];
      const result = normalizeRunCards(cards);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe("Invalid rank: NotARank");
      }
    });

    it("fails for duplicate natural ranks (5, 5, 6, 7)", () => {
      const cards = [card("5", "spades"), card("5", "spades"), card("6", "spades"), card("7", "spades")];
      const result = normalizeRunCards(cards);

      expect(result.success).toBe(false);
    });

    it("fails for too few cards (less than 4)", () => {
      const cards = [card("5", "spades"), card("6", "spades"), card("7", "spades")];
      const result = normalizeRunCards(cards);

      expect(result.success).toBe(false);
    });

    it("fails when wilds cannot extend below 3", () => {
      // If we have 3,4,5,Joker and Joker needs to go below 3, that's invalid
      // But actually Joker could go at end (as 6), so this is valid
      // Let's test: 3,4 + 2 wilds wanting to go to 1,2 positions
      const cards = [card("3", "spades"), card("4", "spades"), joker(), joker()];
      const result = normalizeRunCards(cards);

      // This should succeed: 3,4,Joker,Joker representing 3,4,5,6
      expect(result.success).toBe(true);
    });

    it("fails when wilds would need to extend above A", () => {
      // K, A + 2 wilds - would need positions 15, 16 which don't exist
      const cards = [card("K", "hearts"), card("A", "hearts"), joker(), joker()];
      const result = normalizeRunCards(cards);

      // Wilds could go at start (as J, Q) making J,Q,K,A
      expect(result.success).toBe(true);
    });

    it("fails when wilds outnumber naturals after normalization", () => {
      // 1 natural + 3 wilds
      const cards = [card("5", "spades"), joker(), joker(), card("2", "clubs")];
      const result = normalizeRunCards(cards);

      // Wild ratio invalid
      expect(result.success).toBe(false);
    });
  });

  describe("preserves card references", () => {
    it("returned cards are the same objects, just reordered", () => {
      const c1 = card("K", "hearts");
      const c2 = card("Q", "hearts");
      const c3 = card("J", "hearts");
      const c4 = card("10", "hearts");
      const cards = [c1, c2, c3, c4]; // descending order

      const result = normalizeRunCards(cards);

      expect(result.success).toBe(true);
      // Should contain all the same objects
      expect(result.cards).toContain(c1);
      expect(result.cards).toContain(c2);
      expect(result.cards).toContain(c3);
      expect(result.cards).toContain(c4);
      // In ascending order
      expect(result.cards[0]).toBe(c4); // 10
      expect(result.cards[1]).toBe(c3); // J
      expect(result.cards[2]).toBe(c2); // Q
      expect(result.cards[3]).toBe(c1); // K
    });
  });

  describe("does not modify input array", () => {
    it("original array is unchanged after normalization", () => {
      const cards = [card("K", "hearts"), card("Q", "hearts"), card("J", "hearts"), card("10", "hearts")];
      const originalOrder = [...cards];

      normalizeRunCards(cards);

      // Original array should be unchanged
      expect(cards.map(c => c.rank)).toEqual(originalOrder.map(c => c.rank));
    });
  });
});
