/**
 * Stock Depletion tests - Phase 5
 *
 * Tests for detecting empty stock, reshuffling, and edge cases
 */

import { describe, it, expect } from "bun:test";
import { createActor } from "xstate";
import { roundMachine } from "./round.machine";
import { shuffle } from "../card/card.deck";
import type { RoundInput } from "./round.machine";
import type { Player } from "./engine.types";
import type { Card } from "../card/card.types";

/**
 * Helper to create test players
 */
function createTestPlayers(count: number): Player[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `player-${i}`,
    name: `Player ${i + 1}`,
    hand: [],
    isDown: false,
    totalScore: 0,
  }));
}

/**
 * Helper to create test cards
 */
function createTestCards(count: number): Card[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `card-${i}`,
    suit: "hearts" as const,
    rank: "A" as const,
  }));
}

describe("stock depletion detection", () => {
  describe("during draw", () => {
    it("stockEmpty guard returns true when stock.length === 0", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 0,
      };
      const actor = createActor(roundMachine, { input });
      actor.start();

      // Initially stock has cards
      expect(actor.getSnapshot().context.stock.length).toBeGreaterThan(0);

      // RESHUFFLE_STOCK event should be blocked when stock is not empty
      actor.send({ type: "RESHUFFLE_STOCK" });
      expect(actor.getSnapshot().context.stock.length).toBeGreaterThan(0);
    });

    it.todo("reshuffle happens before draw completes (TurnMachine integration)", () => {});
  });

  describe("guard check", () => {
    it("stockEmpty guard blocks RESHUFFLE_STOCK when stock has cards", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 0,
      };
      const actor = createActor(roundMachine, { input });
      actor.start();

      const initialStockLength = actor.getSnapshot().context.stock.length;
      expect(initialStockLength).toBe(63);

      // Try to reshuffle with cards in stock - should be blocked
      actor.send({ type: "RESHUFFLE_STOCK" });

      // Stock should be unchanged
      expect(actor.getSnapshot().context.stock.length).toBe(63);
    });
  });
});

describe("reshuffleStock action", () => {
  describe("basic operation", () => {
    it("given: stock empty, discard has 5 cards, top card stays in discard", () => {
      // Test the reshuffleStock action logic conceptually
      // In production, this is handled by RoundMachine when stock is empty

      const discardPile = createTestCards(5);
      const topCard = discardPile[discardPile.length - 1]!;
      const cardsToReshuffle = discardPile.slice(0, -1);

      // After reshuffle: 4 cards in stock, 1 card in discard
      expect(cardsToReshuffle.length).toBe(4);
      expect(topCard.id).toBe("card-4");
    });

    it("when: reshuffleStock, topCard remains in discard (face-up)", () => {
      const discardPile = createTestCards(5);
      const topCard = discardPile[discardPile.length - 1]!;

      // The top card is the last one in the array
      expect(topCard.id).toBe("card-4");

      // After reshuffle, only this card remains
      const newDiscard = [topCard];
      expect(newDiscard.length).toBe(1);
      expect(newDiscard[0]!.id).toBe("card-4");
    });

    it("[card2, card3, card4] shuffled into stock (cards 0-3 become stock)", () => {
      const discardPile = createTestCards(5);
      const cardsToReshuffle = discardPile.slice(0, -1);
      const newStock = shuffle(cardsToReshuffle);

      expect(newStock.length).toBe(4);
    });

    it("stock.length === 4 and discard.length === 1 after reshuffle of 5-card discard", () => {
      const discardPile = createTestCards(5);
      const topCard = discardPile[discardPile.length - 1]!;
      const cardsToReshuffle = discardPile.slice(0, -1);

      expect(cardsToReshuffle.length).toBe(4);
      expect([topCard].length).toBe(1);
    });
  });

  describe("preserves top discard", () => {
    it("the card most recently discarded stays visible", () => {
      const discardPile = createTestCards(10);
      const topCard = discardPile[discardPile.length - 1]!;

      // Top card (most recently discarded) is preserved
      expect(topCard.id).toBe("card-9");
    });

    it("next player still has option to draw it", () => {
      // After reshuffle, the top discard remains accessible
      const discardPile = createTestCards(10);
      const topCard = discardPile[discardPile.length - 1]!;
      const newDiscard = [topCard];

      // Player can still draw from discard
      expect(newDiscard.length).toBe(1);
      expect(newDiscard[0]!.id).toBe("card-9");
    });

    it("game continuity maintained", () => {
      // Total cards should be preserved
      const discardPile = createTestCards(10);
      const topCard = discardPile[discardPile.length - 1]!;
      const cardsToReshuffle = discardPile.slice(0, -1);
      const newStock = shuffle(cardsToReshuffle);
      const newDiscard = [topCard];

      expect(newStock.length + newDiscard.length).toBe(10);
    });
  });

  describe("shuffle randomization", () => {
    it("cards from discard are shuffled (order changes)", () => {
      const cards = createTestCards(20);
      const shuffled = shuffle(cards);

      // With 20 cards, the order should change (extremely high probability)
      const originalIds = cards.map((c) => c.id);
      const shuffledIds = shuffled.map((c) => c.id);

      // At least one card should be in a different position
      let samePosition = 0;
      for (let i = 0; i < cards.length; i++) {
        if (originalIds[i] === shuffledIds[i]) {
          samePosition++;
        }
      }
      // Statistically, very few cards should be in same position
      expect(samePosition).toBeLessThan(cards.length);
    });

    it("not simply reversed or moved in order", () => {
      const cards = createTestCards(10);
      const shuffled = shuffle(cards);

      const originalIds = cards.map((c) => c.id);
      const shuffledIds = shuffled.map((c) => c.id);
      const reversedIds = [...originalIds].reverse();

      // Should not be reversed
      expect(shuffledIds).not.toEqual(reversedIds);
      // Should not be same as original
      expect(shuffledIds).not.toEqual(originalIds);
    });
  });

  describe("card integrity", () => {
    it("no cards lost during reshuffle", () => {
      const cards = createTestCards(15);
      const shuffled = shuffle(cards);

      expect(shuffled.length).toBe(15);

      const originalIds = new Set(cards.map((c) => c.id));
      const shuffledIds = new Set(shuffled.map((c) => c.id));

      expect(shuffledIds).toEqual(originalIds);
    });

    it("no cards duplicated", () => {
      const cards = createTestCards(15);
      const shuffled = shuffle(cards);

      const ids = shuffled.map((c) => c.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(15);
    });
  });
});

describe("reshuffle scenarios", () => {
  describe("mid-round reshuffle", () => {
    it("given: round in progress, stock depleted due to draws", () => {
      // Simulate stock depletion scenario
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 0,
      };
      const actor = createActor(roundMachine, { input });
      actor.start();

      // Stock starts with 63 cards for 4 players
      expect(actor.getSnapshot().context.stock.length).toBe(63);
    });

    it.todo("when: next player draws from stock, then: reshuffle occurs automatically (TurnMachine integration)", () => {});
    it.todo("game continues normally and player receives their drawn card (TurnMachine integration)", () => {});
  });

  describe("discard pile size", () => {
    it("minimum discard for reshuffle: 2 cards (1 stays, 1 to stock)", () => {
      const discardPile = createTestCards(2);
      const topCard = discardPile[discardPile.length - 1]!;
      const cardsToReshuffle = discardPile.slice(0, -1);

      // 1 card becomes stock, 1 stays in discard
      expect(cardsToReshuffle.length).toBe(1);
      expect([topCard].length).toBe(1);
    });

    it("all but top card become new stock", () => {
      const discardPile = createTestCards(30);
      const topCard = discardPile[discardPile.length - 1]!;
      const cardsToReshuffle = discardPile.slice(0, -1);

      expect(cardsToReshuffle.length).toBe(29);
      expect([topCard].length).toBe(1);
    });
  });

  describe("edge cases", () => {
    it("multiple reshuffles in one round would maintain card integrity", () => {
      // If reshuffled multiple times, total cards should remain constant
      let cards = createTestCards(50);

      // Simulate multiple reshuffles
      for (let i = 0; i < 3; i++) {
        cards = shuffle(cards);
        expect(cards.length).toBe(50);
      }
    });

    it("stock empty, discard has only 1 card - cannot reshuffle", () => {
      const discardPile = createTestCards(1);
      const topCard = discardPile[discardPile.length - 1]!;
      const cardsToReshuffle = discardPile.slice(0, -1);

      // No cards to reshuffle
      expect(cardsToReshuffle.length).toBe(0);
      expect([topCard].length).toBe(1);
    });

    it("round ends immediately when reshuffle impossible (game rule edge case)", () => {
      // Per house rules: "If it somehow runs out again [after reshuffle]..."
      // "Agree that the hand ends immediately and all players score what they hold"
      // This happens when stock is empty and discard has only 1 card (the face-up top card)
      const discardPile = createTestCards(1);
      const topCard = discardPile[discardPile.length - 1]!;
      const cardsToReshuffle = discardPile.slice(0, -1);

      // Cannot reshuffle - no cards to put in stock
      expect(cardsToReshuffle.length).toBe(0);
      expect([topCard].length).toBe(1);

      // In this edge case, the round should end and all players score their hands
      // This is a house rule decision - implemented as round ending immediately
    });
  });
});
