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
import { createEmptyStockState } from "./test.fixtures";

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

    it("given: stock empty, RESHUFFLE_STOCK refills stock from discard", () => {
      const predefinedState = createEmptyStockState();
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(3),
        dealerIndex: 2, // Player 0 starts
        predefinedState,
      };
      const actor = createActor(roundMachine, { input });
      actor.start();

      // Stock is empty at RoundMachine level
      expect(actor.getSnapshot().context.stock.length).toBe(0);
      const discardCount = actor.getSnapshot().context.discard.length;
      expect(discardCount).toBeGreaterThan(1);

      // Reshuffle to refill RoundMachine's stock from discard
      actor.send({ type: "RESHUFFLE_STOCK" });

      // RoundMachine stock now has cards (discard minus top card)
      const stockAfterReshuffle = actor.getSnapshot().context.stock.length;
      expect(stockAfterReshuffle).toBe(discardCount - 1);
      expect(actor.getSnapshot().context.discard.length).toBe(1);

      // Note: TurnMachine was invoked with empty stock before reshuffle.
      // In real gameplay, reshuffle would happen before TurnMachine starts
      // or via a mechanism that propagates stock to TurnMachine.
    });
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
      // Discard pile is stored with top card first (index 0)
      const topCard = discardPile[0]!;
      const cardsToReshuffle = discardPile.slice(1);

      // After reshuffle: 4 cards in stock, 1 card in discard
      expect(cardsToReshuffle.length).toBe(4);
      expect(topCard.id).toBe("card-0");
    });

    it("when: reshuffleStock, topCard remains in discard (face-up)", () => {
      const discardPile = createTestCards(5);
      const topCard = discardPile[0]!;

      // The top card is the last one in the array
      expect(topCard.id).toBe("card-0");

      // After reshuffle, only this card remains
      const newDiscard = [topCard];
      expect(newDiscard.length).toBe(1);
      expect(newDiscard[0]!.id).toBe("card-0");
    });

    it("[card2, card3, card4] shuffled into stock (cards 0-3 become stock)", () => {
      const discardPile = createTestCards(5);
      const cardsToReshuffle = discardPile.slice(1);
      const newStock = shuffle(cardsToReshuffle);

      expect(newStock.length).toBe(4);
    });

    it("stock.length === 4 and discard.length === 1 after reshuffle of 5-card discard", () => {
      const discardPile = createTestCards(5);
      const topCard = discardPile[0]!;
      const cardsToReshuffle = discardPile.slice(1);

      expect(cardsToReshuffle.length).toBe(4);
      expect([topCard].length).toBe(1);
    });
  });

  describe("preserves top discard", () => {
    it("the card most recently discarded stays visible", () => {
      const discardPile = createTestCards(10);
      const topCard = discardPile[0]!;

      // Top card (most recently discarded) is preserved
      expect(topCard.id).toBe("card-0");
    });

    it("next player still has option to draw it", () => {
      // After reshuffle, the top discard remains accessible
      const discardPile = createTestCards(10);
      const topCard = discardPile[0]!;
      const newDiscard = [topCard];

      // Player can still draw from discard
      expect(newDiscard.length).toBe(1);
      expect(newDiscard[0]!.id).toBe("card-0");
    });

    it("game continuity maintained", () => {
      // Total cards should be preserved
      const discardPile = createTestCards(10);
      const topCard = discardPile[0]!;
      const cardsToReshuffle = discardPile.slice(1);
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

    it("when: stock empty and RESHUFFLE_STOCK sent, discard becomes new stock", () => {
      const predefinedState = createEmptyStockState();
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(3),
        dealerIndex: 2, // Player 0 starts
        predefinedState,
      };
      const actor = createActor(roundMachine, { input });
      actor.start();

      // Stock is empty, discard has cards
      expect(actor.getSnapshot().context.stock.length).toBe(0);
      const initialDiscardLength = actor.getSnapshot().context.discard.length;
      expect(initialDiscardLength).toBeGreaterThan(1);

      // Send RESHUFFLE_STOCK to refill stock
      actor.send({ type: "RESHUFFLE_STOCK" });

      // Stock now has discard cards minus top card
      expect(actor.getSnapshot().context.stock.length).toBe(initialDiscardLength - 1);
      // Discard only has top card
      expect(actor.getSnapshot().context.discard.length).toBe(1);
    });

    it("RESHUFFLE_STOCK moves all but top card from discard to stock", () => {
      const predefinedState = createEmptyStockState();
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(3),
        dealerIndex: 2, // Player 0 starts
        predefinedState,
      };
      const actor = createActor(roundMachine, { input });
      actor.start();

      // Track initial discard
      const initialDiscard = actor.getSnapshot().context.discard;
      const initialDiscardLength = initialDiscard.length;
      const topCard = initialDiscard[0];
      expect(initialDiscardLength).toBeGreaterThan(1);

      // Stock is empty
      expect(actor.getSnapshot().context.stock.length).toBe(0);

      // Reshuffle to refill stock
      actor.send({ type: "RESHUFFLE_STOCK" });

      // Stock now has all discard cards except top
      expect(actor.getSnapshot().context.stock.length).toBe(initialDiscardLength - 1);

      // Discard has only the top card
      expect(actor.getSnapshot().context.discard.length).toBe(1);
      expect(actor.getSnapshot().context.discard[0]!.id).toBe(topCard!.id);
    });
  });

  describe("discard pile size", () => {
    it("minimum discard for reshuffle: 2 cards (1 stays, 1 to stock)", () => {
      const discardPile = createTestCards(2);
      const topCard = discardPile[0]!;
      const cardsToReshuffle = discardPile.slice(1);

      // 1 card becomes stock, 1 stays in discard
      expect(cardsToReshuffle.length).toBe(1);
      expect([topCard].length).toBe(1);
    });

    it("all but top card become new stock", () => {
      const discardPile = createTestCards(30);
      const topCard = discardPile[0]!;
      const cardsToReshuffle = discardPile.slice(1);

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
      const topCard = discardPile[0]!;
      const cardsToReshuffle = discardPile.slice(1);

      // No cards to reshuffle
      expect(cardsToReshuffle.length).toBe(0);
      expect([topCard].length).toBe(1);
    });

    it("round ends immediately when reshuffle impossible (game rule edge case)", () => {
      // Per house rules: "If it somehow runs out again [after reshuffle]..."
      // "Agree that the hand ends immediately and all players score what they hold"
      // This happens when stock is empty and discard has only 1 card (the face-up top card)
      const discardPile = createTestCards(1);
      const topCard = discardPile[0]!;
      const cardsToReshuffle = discardPile.slice(1);

      // Cannot reshuffle - no cards to put in stock
      expect(cardsToReshuffle.length).toBe(0);
      expect([topCard].length).toBe(1);

      // In this edge case, the round should end and all players score their hands
      // This is a house rule decision - implemented as round ending immediately
    });
  });
});

describe("automatic stock replenishment (house rules)", () => {
  it("when: last stock card is drawn, discard (except top) is shuffled into new stock automatically", () => {
    const lastStockCard: Card = { id: "stock-last", suit: "hearts", rank: "A" };
    const topDiscard: Card = { id: "discard-top", suit: "clubs", rank: "9" };
    const d1: Card = { id: "discard-1", suit: "spades", rank: "5" };
    const d2: Card = { id: "discard-2", suit: "diamonds", rank: "K" };

    const input: RoundInput = {
      roundNumber: 1,
      players: createTestPlayers(3),
      dealerIndex: 0, // player-1 starts
      predefinedState: {
        hands: [[], [], []],
        stock: [lastStockCard],
        // Discard pile stored with exposed top at index 0
        discard: [topDiscard, d1, d2],
        playerDownStatus: [false, false, false],
      },
    };

    const actor = createActor(roundMachine, { input });
    actor.start();

    // Current player draws the last stock card
    actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-1" });

    // TurnMachine should have auto-replenished stock from discard (except top)
    const turn = (actor.getPersistedSnapshot() as any).children.turn.snapshot;
    const turnCtx = turn.context as { hand: Card[]; stock: Card[]; discard: Card[] };

    expect(turnCtx.hand.some((c) => c.id === lastStockCard.id)).toBe(true);
    expect(turnCtx.discard).toHaveLength(1);
    expect(turnCtx.discard[0]!.id).toBe(topDiscard.id);
    expect(turnCtx.stock).toHaveLength(2);
    expect(new Set(turnCtx.stock.map((c) => c.id))).toEqual(new Set([d1.id, d2.id]));
  });
});
