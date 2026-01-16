import { describe, it, expect } from "bun:test";
import { getRunBounds } from "./meld.bounds";
import type { Card } from "../card/card.types";

// Helper to create a card
function card(rank: Card["rank"], suit: Card["suit"]): Card {
  return { id: `${rank}-${suit}-${Math.random()}`, rank, suit };
}

describe("getRunBounds", () => {
  describe("natural cards only", () => {
    it("returns correct bounds for a simple 4-card run", () => {
      const cards = [card("5", "spades"), card("6", "spades"), card("7", "spades"), card("8", "spades")];
      const bounds = getRunBounds(cards);

      expect(bounds).not.toBeNull();
      expect(bounds!.lowValue).toBe(5);
      expect(bounds!.highValue).toBe(8);
      expect(bounds!.suit).toBe("spades");
    });

    it("returns correct bounds for a run starting at 3 (minimum)", () => {
      const cards = [card("3", "hearts"), card("4", "hearts"), card("5", "hearts"), card("6", "hearts")];
      const bounds = getRunBounds(cards);

      expect(bounds).not.toBeNull();
      expect(bounds!.lowValue).toBe(3);
      expect(bounds!.highValue).toBe(6);
      expect(bounds!.suit).toBe("hearts");
    });

    it("returns correct bounds for a run ending at Ace (maximum)", () => {
      const cards = [card("J", "diamonds"), card("Q", "diamonds"), card("K", "diamonds"), card("A", "diamonds")];
      const bounds = getRunBounds(cards);

      expect(bounds).not.toBeNull();
      expect(bounds!.lowValue).toBe(11);
      expect(bounds!.highValue).toBe(14);
      expect(bounds!.suit).toBe("diamonds");
    });

    it("returns correct bounds for face cards (J=11, Q=12, K=13)", () => {
      const cards = [card("10", "clubs"), card("J", "clubs"), card("Q", "clubs"), card("K", "clubs")];
      const bounds = getRunBounds(cards);

      expect(bounds).not.toBeNull();
      expect(bounds!.lowValue).toBe(10);
      expect(bounds!.highValue).toBe(13);
      expect(bounds!.suit).toBe("clubs");
    });
  });

  describe("runs with wilds at start", () => {
    it("handles wild at position 0 (infers position from natural at position 1)", () => {
      // Wild - 6♠ - 7♠ - 8♠ → wild represents 5♠
      const cards = [card("Joker", null), card("6", "spades"), card("7", "spades"), card("8", "spades")];
      const bounds = getRunBounds(cards);

      expect(bounds).not.toBeNull();
      expect(bounds!.lowValue).toBe(5); // Wild fills position for 5
      expect(bounds!.highValue).toBe(8);
      expect(bounds!.suit).toBe("spades");
    });

    it("handles two wilds at start", () => {
      // Wild - Wild - 7♠ - 8♠ → wilds represent 5♠, 6♠
      const cards = [card("2", "hearts"), card("Joker", null), card("7", "spades"), card("8", "spades")];
      const bounds = getRunBounds(cards);

      expect(bounds).not.toBeNull();
      expect(bounds!.lowValue).toBe(5);
      expect(bounds!.highValue).toBe(8);
      expect(bounds!.suit).toBe("spades");
    });
  });

  describe("runs with wilds in middle", () => {
    it("handles wild in middle position", () => {
      // 5♠ - Wild - 7♠ - 8♠ → wild represents 6♠
      const cards = [card("5", "spades"), card("2", "diamonds"), card("7", "spades"), card("8", "spades")];
      const bounds = getRunBounds(cards);

      expect(bounds).not.toBeNull();
      expect(bounds!.lowValue).toBe(5);
      expect(bounds!.highValue).toBe(8);
      expect(bounds!.suit).toBe("spades");
    });

    it("handles multiple wilds in middle", () => {
      // 5♠ - Wild - Wild - 8♠ → wilds represent 6♠, 7♠
      const cards = [card("5", "spades"), card("Joker", null), card("2", "clubs"), card("8", "spades")];
      const bounds = getRunBounds(cards);

      expect(bounds).not.toBeNull();
      expect(bounds!.lowValue).toBe(5);
      expect(bounds!.highValue).toBe(8);
      expect(bounds!.suit).toBe("spades");
    });
  });

  describe("runs with wilds at end", () => {
    it("handles wild at last position", () => {
      // 5♠ - 6♠ - 7♠ - Wild → wild represents 8♠
      const cards = [card("5", "spades"), card("6", "spades"), card("7", "spades"), card("Joker", null)];
      const bounds = getRunBounds(cards);

      expect(bounds).not.toBeNull();
      expect(bounds!.lowValue).toBe(5);
      expect(bounds!.highValue).toBe(8);
      expect(bounds!.suit).toBe("spades");
    });

    it("handles two wilds at end", () => {
      // 5♠ - 6♠ - Wild - Wild → wilds represent 7♠, 8♠
      const cards = [card("5", "spades"), card("6", "spades"), card("2", "hearts"), card("Joker", null)];
      const bounds = getRunBounds(cards);

      expect(bounds).not.toBeNull();
      expect(bounds!.lowValue).toBe(5);
      expect(bounds!.highValue).toBe(8);
      expect(bounds!.suit).toBe("spades");
    });
  });

  describe("edge cases", () => {
    it("returns null for all-wild runs (no natural cards)", () => {
      const cards = [card("2", "hearts"), card("Joker", null), card("2", "spades"), card("Joker", null)];
      const bounds = getRunBounds(cards);

      expect(bounds).toBeNull();
    });

    it("returns null for empty card array", () => {
      const bounds = getRunBounds([]);
      expect(bounds).toBeNull();
    });

    it("handles single natural card (edge case, not valid run but function should work)", () => {
      const cards = [card("7", "spades")];
      const bounds = getRunBounds(cards);

      expect(bounds).not.toBeNull();
      expect(bounds!.lowValue).toBe(7);
      expect(bounds!.highValue).toBe(7);
      expect(bounds!.suit).toBe("spades");
    });
  });
});
