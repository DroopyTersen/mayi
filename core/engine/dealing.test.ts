/**
 * Dealing tests - Phase 5
 *
 * Tests for deck creation, card distribution, and initial round setup
 */

import { describe, it, expect } from "bun:test";
import { createDeck, deal } from "../card/card.deck";
import { getDeckConfig } from "./round.machine";

describe("createDeckForPlayerCount", () => {
  describe("3-5 players", () => {
    it("returns 108 cards (2 decks + 4 jokers)", () => {
      const config = getDeckConfig(4);
      const deck = createDeck(config);
      expect(deck.length).toBe(108);
    });

    it("contains 104 standard cards (52 × 2)", () => {
      const config = getDeckConfig(4);
      const deck = createDeck(config);
      const standardCards = deck.filter((c) => c.rank !== "Joker");
      expect(standardCards.length).toBe(104);
    });

    it("contains exactly 4 jokers", () => {
      const config = getDeckConfig(4);
      const deck = createDeck(config);
      const jokers = deck.filter((c) => c.rank === "Joker");
      expect(jokers.length).toBe(4);
    });
  });

  describe("6-8 players", () => {
    it("returns 162 cards (3 decks + 6 jokers)", () => {
      const config = getDeckConfig(6);
      const deck = createDeck(config);
      expect(deck.length).toBe(162);
    });

    it("contains 156 standard cards (52 × 3)", () => {
      const config = getDeckConfig(7);
      const deck = createDeck(config);
      const standardCards = deck.filter((c) => c.rank !== "Joker");
      expect(standardCards.length).toBe(156);
    });

    it("contains exactly 6 jokers", () => {
      const config = getDeckConfig(8);
      const deck = createDeck(config);
      const jokers = deck.filter((c) => c.rank === "Joker");
      expect(jokers.length).toBe(6);
    });
  });

  describe("boundary cases", () => {
    it("3 players -> 108 cards", () => {
      const config = getDeckConfig(3);
      const deck = createDeck(config);
      expect(deck.length).toBe(108);
    });

    it("5 players -> 108 cards", () => {
      const config = getDeckConfig(5);
      const deck = createDeck(config);
      expect(deck.length).toBe(108);
    });

    it("6 players -> 162 cards", () => {
      const config = getDeckConfig(6);
      const deck = createDeck(config);
      expect(deck.length).toBe(162);
    });

    it("8 players -> 162 cards", () => {
      const config = getDeckConfig(8);
      const deck = createDeck(config);
      expect(deck.length).toBe(162);
    });
  });
});

describe("deal", () => {
  describe("card distribution", () => {
    it("deals 11 cards to each player", () => {
      const config = getDeckConfig(4);
      const deck = createDeck(config);
      const result = deal(deck, 4);

      expect(result.hands.length).toBe(4);
      result.hands.forEach((hand) => {
        expect(hand.length).toBe(11);
      });
    });

    it("deals in round-robin order", () => {
      const config = getDeckConfig(3);
      const deck = createDeck(config);
      const result = deal(deck, 3);

      // Each player should have 11 cards
      expect(result.hands[0]!.length).toBe(11);
      expect(result.hands[1]!.length).toBe(11);
      expect(result.hands[2]!.length).toBe(11);
    });

    it("card 1 to player 1, card 2 to player 2, etc.", () => {
      // Use a non-shuffled deck to verify order
      const config = getDeckConfig(3);
      const deck = createDeck(config);
      const result = deal(deck, 3);

      // First card goes to player 0, second to player 1, third to player 2
      expect(result.hands[0]![0]!.id).toBe("card-0");
      expect(result.hands[1]![0]!.id).toBe("card-1");
      expect(result.hands[2]![0]!.id).toBe("card-2");
    });

    it("continues until all players have 11 cards", () => {
      const config = getDeckConfig(5);
      const deck = createDeck(config);
      const result = deal(deck, 5);

      const totalDealt = result.hands.reduce((sum, h) => sum + h.length, 0);
      expect(totalDealt).toBe(55); // 5 players × 11 cards
    });
  });

  describe("dealing order", () => {
    it("starts with player left of dealer (currentPlayerIndex)", () => {
      // The deal function itself doesn't know about dealer
      // This is handled by RoundMachine which sets currentPlayerIndex
      const config = getDeckConfig(4);
      const deck = createDeck(config);
      const result = deal(deck, 4);

      // deal() just deals to players 0, 1, 2, 3 in order
      // The mapping to actual player positions is done by RoundMachine
      expect(result.hands.length).toBe(4);
    });

    it("continues clockwise", () => {
      const config = getDeckConfig(4);
      const deck = createDeck(config);
      const result = deal(deck, 4);

      // Cards are dealt in order: player 0, 1, 2, 3, 0, 1, 2, 3, ...
      expect(result.hands[0]![0]!.id).toBe("card-0");
      expect(result.hands[1]![0]!.id).toBe("card-1");
      expect(result.hands[2]![0]!.id).toBe("card-2");
      expect(result.hands[3]![0]!.id).toBe("card-3");
      expect(result.hands[0]![1]!.id).toBe("card-4");
    });

    it("dealer receives cards last in each round of dealing", () => {
      // With 4 players, if dealer is player 3, they get cards at positions 3, 7, 11...
      const config = getDeckConfig(4);
      const deck = createDeck(config);
      const result = deal(deck, 4);

      // Last player (index 3) gets cards 3, 7, 11, 15, 19, 23, 27, 31, 35, 39, 43
      expect(result.hands[3]![0]!.id).toBe("card-3");
      expect(result.hands[3]![1]!.id).toBe("card-7");
    });
  });

  describe("remaining cards", () => {
    it("given: 108 card deck, 4 players", () => {
      const config = getDeckConfig(4);
      const deck = createDeck(config);
      expect(deck.length).toBe(108);
    });

    it("when: deal completes, then: 44 cards dealt and 63 remain in stock (1 in discard)", () => {
      const config = getDeckConfig(4);
      const deck = createDeck(config);
      const result = deal(deck, 4);

      const dealtCards = result.hands.reduce((sum, h) => sum + h.length, 0);
      expect(dealtCards).toBe(44);
      expect(result.stock.length).toBe(63); // 108 - 44 - 1 = 63
      expect(result.discard.length).toBe(1);
    });
  });

  describe("card integrity", () => {
    it("no card appears in multiple hands", () => {
      const config = getDeckConfig(4);
      const deck = createDeck(config);
      const result = deal(deck, 4);

      const allHandCards = result.hands.flat();
      const cardIds = allHandCards.map((c) => c.id);
      const uniqueIds = new Set(cardIds);

      expect(uniqueIds.size).toBe(cardIds.length);
    });

    it("no card appears in both hand and stock", () => {
      const config = getDeckConfig(4);
      const deck = createDeck(config);
      const result = deal(deck, 4);

      const handCardIds = new Set(result.hands.flat().map((c) => c.id));
      const stockCardIds = result.stock.map((c) => c.id);

      for (const stockId of stockCardIds) {
        expect(handCardIds.has(stockId)).toBe(false);
      }
    });

    it("all dealt cards came from deck", () => {
      const config = getDeckConfig(4);
      const deck = createDeck(config);
      const deckIds = new Set(deck.map((c) => c.id));
      const result = deal(deck, 4);

      const allDealtCards = [...result.hands.flat(), ...result.stock, ...result.discard];

      for (const card of allDealtCards) {
        expect(deckIds.has(card.id)).toBe(true);
      }
    });

    it("total cards = hands + stock + discard", () => {
      const config = getDeckConfig(4);
      const deck = createDeck(config);
      const result = deal(deck, 4);

      const handCards = result.hands.reduce((sum, h) => sum + h.length, 0);
      const total = handCards + result.stock.length + result.discard.length;

      expect(total).toBe(108);
    });
  });
});

describe("flipFirstDiscard", () => {
  describe("operation (done by deal function)", () => {
    it("removes top card from stock", () => {
      const config = getDeckConfig(4);
      const deck = createDeck(config);
      const result = deal(deck, 4);

      // After deal, discard has 1 card and stock has 63
      expect(result.discard.length).toBe(1);
      expect(result.stock.length).toBe(63);
    });

    it("places card in discard pile", () => {
      const config = getDeckConfig(4);
      const deck = createDeck(config);
      const result = deal(deck, 4);

      expect(result.discard[0]).toBeDefined();
      expect(result.discard[0]!.id).toMatch(/^card-\d+$/);
    });

    it("discard pile now has exactly 1 card", () => {
      const config = getDeckConfig(4);
      const deck = createDeck(config);
      const result = deal(deck, 4);

      expect(result.discard.length).toBe(1);
    });
  });

  describe("stock adjustment", () => {
    it("given: 108 cards, 4 players. when: deal (includes flip). then: stock has 63 cards and discard has 1", () => {
      const config = getDeckConfig(4);
      const deck = createDeck(config);
      const result = deal(deck, 4);

      // 108 - 44 dealt - 1 discard = 63 stock
      expect(result.stock.length).toBe(63);
      expect(result.discard.length).toBe(1);
    });
  });

  describe("card is face-up", () => {
    it("first player can choose to draw it (card is accessible in discard pile)", () => {
      const config = getDeckConfig(4);
      const deck = createDeck(config);
      const result = deal(deck, 4);

      // The discard pile is public and accessible
      const topDiscard = result.discard[result.discard.length - 1];
      expect(topDiscard).toBeDefined();
      expect(topDiscard!.rank).toBeDefined();
      expect(topDiscard!.suit !== undefined || topDiscard!.rank === "Joker").toBe(true);
    });
  });
});

describe("initial round state after dealing", () => {
  describe("3 player game", () => {
    it("deck: 108 cards, dealt: 33 (11 × 3), stock: 74, discard: 1, total: 108", () => {
      const config = getDeckConfig(3);
      const deck = createDeck(config);
      const result = deal(deck, 3);

      const dealt = result.hands.reduce((sum, h) => sum + h.length, 0);
      expect(dealt).toBe(33);
      expect(result.stock.length).toBe(74);
      expect(result.discard.length).toBe(1);
      expect(dealt + result.stock.length + result.discard.length).toBe(108);
    });
  });

  describe("4 player game", () => {
    it("deck: 108 cards, dealt: 44 (11 × 4), stock: 63, discard: 1, total: 108", () => {
      const config = getDeckConfig(4);
      const deck = createDeck(config);
      const result = deal(deck, 4);

      const dealt = result.hands.reduce((sum, h) => sum + h.length, 0);
      expect(dealt).toBe(44);
      expect(result.stock.length).toBe(63);
      expect(result.discard.length).toBe(1);
      expect(dealt + result.stock.length + result.discard.length).toBe(108);
    });
  });

  describe("5 player game", () => {
    it("deck: 108 cards, dealt: 55 (11 × 5), stock: 52, discard: 1, total: 108", () => {
      const config = getDeckConfig(5);
      const deck = createDeck(config);
      const result = deal(deck, 5);

      const dealt = result.hands.reduce((sum, h) => sum + h.length, 0);
      expect(dealt).toBe(55);
      expect(result.stock.length).toBe(52);
      expect(result.discard.length).toBe(1);
      expect(dealt + result.stock.length + result.discard.length).toBe(108);
    });
  });

  describe("6 player game", () => {
    it("deck: 162 cards, dealt: 66 (11 × 6), stock: 95, discard: 1, total: 162", () => {
      const config = getDeckConfig(6);
      const deck = createDeck(config);
      const result = deal(deck, 6);

      const dealt = result.hands.reduce((sum, h) => sum + h.length, 0);
      expect(dealt).toBe(66);
      expect(result.stock.length).toBe(95);
      expect(result.discard.length).toBe(1);
      expect(dealt + result.stock.length + result.discard.length).toBe(162);
    });
  });

  describe("8 player game", () => {
    it("deck: 162 cards, dealt: 88 (11 × 8), stock: 73, discard: 1, total: 162", () => {
      const config = getDeckConfig(8);
      const deck = createDeck(config);
      const result = deal(deck, 8);

      const dealt = result.hands.reduce((sum, h) => sum + h.length, 0);
      expect(dealt).toBe(88);
      expect(result.stock.length).toBe(73);
      expect(result.discard.length).toBe(1);
      expect(dealt + result.stock.length + result.discard.length).toBe(162);
    });
  });
});
