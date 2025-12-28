/**
 * Dealing tests - Phase 5
 *
 * Tests for deck creation, card distribution, and initial round setup
 */

import { describe, it, expect } from "bun:test";

describe("createDeckForPlayerCount", () => {
  describe("3-5 players", () => {
    it.todo("returns 108 cards (2 decks + 4 jokers)", () => {});
    it.todo("contains 104 standard cards (52 × 2)", () => {});
    it.todo("contains exactly 4 jokers", () => {});
  });

  describe("6-8 players", () => {
    it.todo("returns 162 cards (3 decks + 6 jokers)", () => {});
    it.todo("contains 156 standard cards (52 × 3)", () => {});
    it.todo("contains exactly 6 jokers", () => {});
  });

  describe("boundary cases", () => {
    it.todo("3 players -> 108 cards", () => {});
    it.todo("5 players -> 108 cards", () => {});
    it.todo("6 players -> 162 cards", () => {});
    it.todo("8 players -> 162 cards", () => {});
  });
});

describe("deal", () => {
  describe("card distribution", () => {
    it.todo("deals 11 cards to each player", () => {});
    it.todo("deals in round-robin order", () => {});
    it.todo("card 1 to player 1, card 2 to player 2, etc.", () => {});
    it.todo("continues until all players have 11 cards", () => {});
  });

  describe("dealing order", () => {
    it.todo("starts with player left of dealer (currentPlayerIndex)", () => {});
    it.todo("continues clockwise", () => {});
    it.todo("dealer receives cards last in each round of dealing", () => {});
  });

  describe("remaining cards", () => {
    it.todo("given: 108 card deck, 4 players", () => {});
    it.todo("when: deal completes, then: 44 cards dealt (11 × 4) and 64 cards remain in stock", () => {});
  });

  describe("card integrity", () => {
    it.todo("no card appears in multiple hands", () => {});
    it.todo("no card appears in both hand and stock", () => {});
    it.todo("all dealt cards came from deck", () => {});
    it.todo("total cards = hands + stock", () => {});
  });
});

describe("flipFirstDiscard", () => {
  describe("operation", () => {
    it.todo("removes top card from stock", () => {});
    it.todo("places card in discard pile", () => {});
    it.todo("discard pile now has exactly 1 card", () => {});
  });

  describe("stock adjustment", () => {
    it.todo("given: stock has 64 cards, when: flipFirstDiscard, then: stock has 63 cards and discard has 1 card", () => {});
  });

  describe("card is face-up", () => {
    it.todo("first player can choose to draw it", () => {});
  });
});

describe("initial round state after dealing", () => {
  describe("3 player game", () => {
    it.todo("deck: 108 cards, dealt: 33 (11 × 3), stock: 74, discard: 1, total: 108", () => {});
  });

  describe("4 player game", () => {
    it.todo("deck: 108 cards, dealt: 44 (11 × 4), stock: 63, discard: 1, total: 108", () => {});
  });

  describe("5 player game", () => {
    it.todo("deck: 108 cards, dealt: 55 (11 × 5), stock: 52, discard: 1, total: 108", () => {});
  });

  describe("6 player game", () => {
    it.todo("deck: 162 cards, dealt: 66 (11 × 6), stock: 95, discard: 1, total: 162", () => {});
  });

  describe("8 player game", () => {
    it.todo("deck: 162 cards, dealt: 88 (11 × 8), stock: 73, discard: 1, total: 162", () => {});
  });
});
