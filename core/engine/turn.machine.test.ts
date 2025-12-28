import { describe, it, expect } from "bun:test";
import { createActor } from "xstate";
import { turnMachine, type TurnInput } from "./turn.machine";
import type { Card } from "../card/card.types";

// Helper to create test cards
let cardId = 0;
function card(rank: Card["rank"], suit: Card["suit"] = "hearts"): Card {
  return { id: `card-${cardId++}`, suit, rank };
}

// Helper to create a turn actor with test data
function createTurnActor(overrides: Partial<TurnInput> = {}) {
  const input: TurnInput = {
    playerId: "player-1",
    hand: overrides.hand ?? [card("9"), card("10"), card("J")],
    stock: overrides.stock ?? [card("Q"), card("K"), card("A")],
    discard: overrides.discard ?? [card("8")],
    roundNumber: overrides.roundNumber ?? 1,
    isDown: overrides.isDown ?? false,
    table: overrides.table ?? [],
  };
  return createActor(turnMachine, { input });
}

describe("TurnMachine - initial state", () => {
  it("starts in 'awaitingDraw' state", () => {
    const actor = createTurnActor();
    actor.start();
    expect(actor.getSnapshot().value).toBe("awaitingDraw");
    actor.stop();
  });

  it("hasDrawn is false", () => {
    const actor = createTurnActor();
    actor.start();
    expect(actor.getSnapshot().context.hasDrawn).toBe(false);
    actor.stop();
  });

  it("player hand matches input", () => {
    const hand = [card("3"), card("5"), card("7")];
    const actor = createTurnActor({ hand });
    actor.start();
    expect(actor.getSnapshot().context.hand).toEqual(hand);
    actor.stop();
  });

  it("stock matches input", () => {
    const stock = [card("A"), card("K")];
    const actor = createTurnActor({ stock });
    actor.start();
    expect(actor.getSnapshot().context.stock).toEqual(stock);
    actor.stop();
  });

  it("discard matches input", () => {
    const discard = [card("4"), card("6")];
    const actor = createTurnActor({ discard });
    actor.start();
    expect(actor.getSnapshot().context.discard).toEqual(discard);
    actor.stop();
  });
});

describe("TurnMachine - drawing from stock", () => {
  describe("DRAW_FROM_STOCK command", () => {
    it("transitions from 'awaitingDraw' to 'drawn'", () => {
      const actor = createTurnActor();
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      expect(actor.getSnapshot().value).toBe("drawn");
      actor.stop();
    });

    it("sets hasDrawn to true", () => {
      const actor = createTurnActor();
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      expect(actor.getSnapshot().context.hasDrawn).toBe(true);
      actor.stop();
    });

    it("adds top card of stock to player's hand", () => {
      const hand = [card("3")];
      const stockCard = card("K");
      const stock = [stockCard, card("Q")];
      const actor = createTurnActor({ hand, stock });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      const newHand = actor.getSnapshot().context.hand;
      expect(newHand).toContainEqual(stockCard);
      actor.stop();
    });

    it("removes top card from stock", () => {
      const stockCard1 = card("K");
      const stockCard2 = card("Q");
      const stock = [stockCard1, stockCard2];
      const actor = createTurnActor({ stock });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      const newStock = actor.getSnapshot().context.stock;
      expect(newStock).not.toContainEqual(stockCard1);
      expect(newStock).toContainEqual(stockCard2);
      actor.stop();
    });

    it("hand size increases by 1", () => {
      const hand = [card("3"), card("5")];
      const stock = [card("K"), card("Q")];
      const actor = createTurnActor({ hand, stock });
      actor.start();
      const initialHandSize = actor.getSnapshot().context.hand.length;
      actor.send({ type: "DRAW_FROM_STOCK" });
      expect(actor.getSnapshot().context.hand.length).toBe(initialHandSize + 1);
      actor.stop();
    });

    it("stock size decreases by 1", () => {
      const stock = [card("K"), card("Q"), card("J")];
      const actor = createTurnActor({ stock });
      actor.start();
      const initialStockSize = actor.getSnapshot().context.stock.length;
      actor.send({ type: "DRAW_FROM_STOCK" });
      expect(actor.getSnapshot().context.stock.length).toBe(initialStockSize - 1);
      actor.stop();
    });

    it("discard pile is unchanged", () => {
      const discard = [card("8"), card("7")];
      const actor = createTurnActor({ discard });
      actor.start();
      const initialDiscard = [...actor.getSnapshot().context.discard];
      actor.send({ type: "DRAW_FROM_STOCK" });
      expect(actor.getSnapshot().context.discard).toEqual(initialDiscard);
      actor.stop();
    });
  });

  describe("when stock is empty", () => {
    it("blocks draw and sets error when stock is empty", () => {
      // TurnMachine cannot draw from empty stock - RoundMachine handles reshuffle
      const input: TurnInput = {
        playerId: "player-1",
        hand: [{ id: "card-1", suit: "hearts", rank: "5" }],
        stock: [], // Empty stock
        discard: [{ id: "card-2", suit: "spades", rank: "K" }],
        roundNumber: 1,
        isDown: false,
        table: [],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();

      // Try to draw from empty stock
      actor.send({ type: "DRAW_FROM_STOCK" });

      // Should stay in awaitingDraw state
      expect(actor.getSnapshot().value).toBe("awaitingDraw");
      // Error should be set
      expect(actor.getSnapshot().context.lastError).toBe("stock is empty - reshuffle required");
      actor.stop();
    });

    it("allows draw from discard when stock is empty (if not down)", () => {
      const input: TurnInput = {
        playerId: "player-1",
        hand: [{ id: "card-1", suit: "hearts", rank: "5" }],
        stock: [], // Empty stock
        discard: [{ id: "card-2", suit: "spades", rank: "K" }],
        roundNumber: 1,
        isDown: false, // Not down, so can draw from discard
        table: [],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();

      // Can still draw from discard
      actor.send({ type: "DRAW_FROM_DISCARD" });

      expect(actor.getSnapshot().value).toBe("drawn");
      expect(actor.getSnapshot().context.hand.length).toBe(2);
      actor.stop();
    });
  });
});

describe("TurnMachine - drawing from discard", () => {
  describe("DRAW_FROM_DISCARD command", () => {
    it("transitions from 'awaitingDraw' to 'drawn'", () => {
      const actor = createTurnActor();
      actor.start();
      actor.send({ type: "DRAW_FROM_DISCARD" });
      expect(actor.getSnapshot().value).toBe("drawn");
      actor.stop();
    });

    it("sets hasDrawn to true", () => {
      const actor = createTurnActor();
      actor.start();
      actor.send({ type: "DRAW_FROM_DISCARD" });
      expect(actor.getSnapshot().context.hasDrawn).toBe(true);
      actor.stop();
    });

    it("adds top card of discard to player's hand", () => {
      const hand = [card("3")];
      const discardCard = card("8");
      const discard = [discardCard, card("7")];
      const actor = createTurnActor({ hand, discard });
      actor.start();
      actor.send({ type: "DRAW_FROM_DISCARD" });
      const newHand = actor.getSnapshot().context.hand;
      expect(newHand).toContainEqual(discardCard);
      actor.stop();
    });

    it("removes top card from discard", () => {
      const discardCard1 = card("8");
      const discardCard2 = card("7");
      const discard = [discardCard1, discardCard2];
      const actor = createTurnActor({ discard });
      actor.start();
      actor.send({ type: "DRAW_FROM_DISCARD" });
      const newDiscard = actor.getSnapshot().context.discard;
      expect(newDiscard).not.toContainEqual(discardCard1);
      expect(newDiscard).toContainEqual(discardCard2);
      actor.stop();
    });

    it("hand size increases by 1", () => {
      const hand = [card("3"), card("5")];
      const discard = [card("8"), card("7")];
      const actor = createTurnActor({ hand, discard });
      actor.start();
      const initialHandSize = actor.getSnapshot().context.hand.length;
      actor.send({ type: "DRAW_FROM_DISCARD" });
      expect(actor.getSnapshot().context.hand.length).toBe(initialHandSize + 1);
      actor.stop();
    });

    it("discard size decreases by 1", () => {
      const discard = [card("8"), card("7"), card("6")];
      const actor = createTurnActor({ discard });
      actor.start();
      const initialDiscardSize = actor.getSnapshot().context.discard.length;
      actor.send({ type: "DRAW_FROM_DISCARD" });
      expect(actor.getSnapshot().context.discard.length).toBe(initialDiscardSize - 1);
      actor.stop();
    });

    it("stock is unchanged", () => {
      const stock = [card("K"), card("Q")];
      const actor = createTurnActor({ stock });
      actor.start();
      const initialStock = [...actor.getSnapshot().context.stock];
      actor.send({ type: "DRAW_FROM_DISCARD" });
      expect(actor.getSnapshot().context.stock).toEqual(initialStock);
      actor.stop();
    });
  });

  describe("when discard is empty", () => {
    it("command is rejected / not available", () => {
      const actor = createTurnActor({ discard: [] });
      actor.start();
      actor.send({ type: "DRAW_FROM_DISCARD" });
      // Should remain in awaitingDraw since guard fails
      expect(actor.getSnapshot().value).toBe("awaitingDraw");
      actor.stop();
    });

    it("state remains 'awaitingDraw'", () => {
      const actor = createTurnActor({ discard: [] });
      actor.start();
      actor.send({ type: "DRAW_FROM_DISCARD" });
      expect(actor.getSnapshot().value).toBe("awaitingDraw");
      expect(actor.getSnapshot().context.hasDrawn).toBe(false);
      actor.stop();
    });

    it("no changes to hand, stock, or discard", () => {
      const hand = [card("3"), card("5")];
      const stock = [card("K"), card("Q")];
      const actor = createTurnActor({ hand, stock, discard: [] });
      actor.start();
      const initialHand = [...actor.getSnapshot().context.hand];
      const initialStock = [...actor.getSnapshot().context.stock];
      actor.send({ type: "DRAW_FROM_DISCARD" });
      expect(actor.getSnapshot().context.hand).toEqual(initialHand);
      expect(actor.getSnapshot().context.stock).toEqual(initialStock);
      expect(actor.getSnapshot().context.discard).toEqual([]);
      actor.stop();
    });
  });

  describe("when player is down", () => {
    it("DRAW_FROM_DISCARD is rejected - down players cannot draw from discard", () => {
      const topDiscard = card("K");
      const actor = createTurnActor({
        discard: [topDiscard],
        isDown: true, // Player has laid down
      });
      actor.start();
      actor.send({ type: "DRAW_FROM_DISCARD" });
      // Should remain in awaitingDraw since guard fails
      expect(actor.getSnapshot().value).toBe("awaitingDraw");
      expect(actor.getSnapshot().context.hasDrawn).toBe(false);
      actor.stop();
    });

    it("hand remains unchanged", () => {
      const hand = [card("3"), card("5")];
      const topDiscard = card("K");
      const actor = createTurnActor({
        hand,
        discard: [topDiscard],
        isDown: true,
      });
      actor.start();
      const initialHand = [...actor.getSnapshot().context.hand];
      actor.send({ type: "DRAW_FROM_DISCARD" });
      expect(actor.getSnapshot().context.hand).toEqual(initialHand);
      actor.stop();
    });

    it("discard pile remains unchanged", () => {
      const topDiscard = card("K");
      const actor = createTurnActor({
        discard: [topDiscard],
        isDown: true,
      });
      actor.start();
      actor.send({ type: "DRAW_FROM_DISCARD" });
      expect(actor.getSnapshot().context.discard).toContainEqual(topDiscard);
      actor.stop();
    });

    it("can still DRAW_FROM_STOCK", () => {
      const stockCard = card("Q");
      const actor = createTurnActor({
        stock: [stockCard],
        discard: [card("K")],
        isDown: true,
      });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      expect(actor.getSnapshot().value).toBe("drawn");
      expect(actor.getSnapshot().context.hasDrawn).toBe(true);
      expect(actor.getSnapshot().context.hand).toContainEqual(stockCard);
      actor.stop();
    });
  });
});

describe("TurnMachine - discarding", () => {
  describe("DISCARD command after drawing", () => {
    it("transitions from 'awaitingDiscard' to 'turnComplete'", () => {
      const cardToDiscard = card("3");
      const actor = createTurnActor({ hand: [cardToDiscard, card("5")] });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: cardToDiscard.id });
      expect(actor.getSnapshot().value).toBe("turnComplete");
      actor.stop();
    });

    it("removes specified card from player's hand", () => {
      const cardToDiscard = card("3");
      const cardToKeep = card("5");
      const actor = createTurnActor({ hand: [cardToDiscard, cardToKeep] });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: cardToDiscard.id });
      const finalHand = actor.getSnapshot().context.hand;
      expect(finalHand).not.toContainEqual(cardToDiscard);
      expect(finalHand).toContainEqual(cardToKeep);
      actor.stop();
    });

    it("adds that card to top of discard pile", () => {
      const cardToDiscard = card("3");
      const existingDiscard = card("8");
      const actor = createTurnActor({
        hand: [cardToDiscard, card("5")],
        discard: [existingDiscard],
      });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: cardToDiscard.id });
      const finalDiscard = actor.getSnapshot().context.discard;
      expect(finalDiscard[0]).toEqual(cardToDiscard);
      actor.stop();
    });

    it("hand size decreases by 1", () => {
      const cardToDiscard = card("3");
      const actor = createTurnActor({ hand: [cardToDiscard, card("5"), card("7")] });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      const handSizeAfterDraw = actor.getSnapshot().context.hand.length;
      actor.send({ type: "DISCARD", cardId: cardToDiscard.id });
      expect(actor.getSnapshot().context.hand.length).toBe(handSizeAfterDraw - 1);
      actor.stop();
    });

    it("discard size increases by 1", () => {
      const cardToDiscard = card("3");
      const actor = createTurnActor({
        hand: [cardToDiscard, card("5")],
        discard: [card("8")],
      });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      const discardSizeAfterDraw = actor.getSnapshot().context.discard.length;
      actor.send({ type: "DISCARD", cardId: cardToDiscard.id });
      expect(actor.getSnapshot().context.discard.length).toBe(discardSizeAfterDraw + 1);
      actor.stop();
    });

    it("stock is unchanged", () => {
      const cardToDiscard = card("3");
      const actor = createTurnActor({ hand: [cardToDiscard, card("5")] });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      const stockAfterDraw = [...actor.getSnapshot().context.stock];
      actor.send({ type: "DISCARD", cardId: cardToDiscard.id });
      expect(actor.getSnapshot().context.stock).toEqual(stockAfterDraw);
      actor.stop();
    });
  });

  describe("DISCARD command validation", () => {
    it("rejects if cardId is not in player's hand", () => {
      const actor = createTurnActor({ hand: [card("3"), card("5")] });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: "non-existent-card" });
      expect(actor.getSnapshot().value).toBe("awaitingDiscard");
      actor.stop();
    });

    it("rejects if player hasn't drawn yet (state is 'awaitingDraw')", () => {
      const cardToDiscard = card("3");
      const actor = createTurnActor({ hand: [cardToDiscard, card("5")] });
      actor.start();
      // Don't draw, try to discard immediately
      actor.send({ type: "DISCARD", cardId: cardToDiscard.id });
      expect(actor.getSnapshot().value).toBe("awaitingDraw");
      actor.stop();
    });

    it("state remains unchanged on rejection", () => {
      const cardInHand = card("3");
      const actor = createTurnActor({ hand: [cardInHand, card("5")] });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      const handBefore = [...actor.getSnapshot().context.hand];
      const discardBefore = [...actor.getSnapshot().context.discard];
      actor.send({ type: "DISCARD", cardId: "non-existent-card" });
      expect(actor.getSnapshot().context.hand).toEqual(handBefore);
      expect(actor.getSnapshot().context.discard).toEqual(discardBefore);
      actor.stop();
    });
  });

  describe("discarding specific cards", () => {
    it("can discard any card in hand (first, middle, last)", () => {
      const first = card("3");
      const middle = card("5");
      const last = card("7");

      // Discard first
      const actor1 = createTurnActor({ hand: [first, middle, last] });
      actor1.start();
      actor1.send({ type: "DRAW_FROM_STOCK" });
      actor1.send({ type: "SKIP_LAY_DOWN" });
      actor1.send({ type: "DISCARD", cardId: first.id });
      expect(actor1.getSnapshot().value).toBe("turnComplete");
      actor1.stop();

      // Discard middle
      const actor2 = createTurnActor({ hand: [card("3"), middle, card("7")] });
      actor2.start();
      actor2.send({ type: "DRAW_FROM_STOCK" });
      actor2.send({ type: "SKIP_LAY_DOWN" });
      actor2.send({ type: "DISCARD", cardId: middle.id });
      expect(actor2.getSnapshot().value).toBe("turnComplete");
      actor2.stop();

      // Discard last
      const actor3 = createTurnActor({ hand: [card("3"), card("5"), last] });
      actor3.start();
      actor3.send({ type: "DRAW_FROM_STOCK" });
      actor3.send({ type: "SKIP_LAY_DOWN" });
      actor3.send({ type: "DISCARD", cardId: last.id });
      expect(actor3.getSnapshot().value).toBe("turnComplete");
      actor3.stop();
    });

    it("can discard the card just drawn", () => {
      const drawnCard = card("K");
      const actor = createTurnActor({
        hand: [card("3"), card("5")],
        stock: [drawnCard, card("Q")],
      });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: drawnCard.id });
      expect(actor.getSnapshot().value).toBe("turnComplete");
      expect(actor.getSnapshot().context.discard[0]).toEqual(drawnCard);
      actor.stop();
    });

    it("can discard a wild card (2 or Joker)", () => {
      const two = card("2", "spades");
      const joker: Card = { id: `joker-${cardId++}`, suit: null, rank: "Joker" };

      // Discard a 2
      const actor1 = createTurnActor({ hand: [two, card("5")] });
      actor1.start();
      actor1.send({ type: "DRAW_FROM_STOCK" });
      actor1.send({ type: "SKIP_LAY_DOWN" });
      actor1.send({ type: "DISCARD", cardId: two.id });
      expect(actor1.getSnapshot().value).toBe("turnComplete");
      actor1.stop();

      // Discard a Joker
      const actor2 = createTurnActor({ hand: [joker, card("5")] });
      actor2.start();
      actor2.send({ type: "DRAW_FROM_STOCK" });
      actor2.send({ type: "SKIP_LAY_DOWN" });
      actor2.send({ type: "DISCARD", cardId: joker.id });
      expect(actor2.getSnapshot().value).toBe("turnComplete");
      actor2.stop();
    });

    it("correct card is removed (verify by id, not just count)", () => {
      const cardA = card("3");
      const cardB = card("5");
      const cardC = card("7");
      const actor = createTurnActor({ hand: [cardA, cardB, cardC] });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: cardB.id });
      const finalHand = actor.getSnapshot().context.hand;
      expect(finalHand.find((c) => c.id === cardA.id)).toBeDefined();
      expect(finalHand.find((c) => c.id === cardB.id)).toBeUndefined();
      expect(finalHand.find((c) => c.id === cardC.id)).toBeDefined();
      actor.stop();
    });
  });
});

describe("TurnMachine - invalid commands", () => {
  describe("in awaitingDraw state", () => {
    it("DISCARD command is rejected", () => {
      const cardInHand = card("3");
      const actor = createTurnActor({ hand: [cardInHand, card("5")] });
      actor.start();
      // Try to discard without drawing first
      actor.send({ type: "DISCARD", cardId: cardInHand.id });
      expect(actor.getSnapshot().value).toBe("awaitingDraw");
      actor.stop();
    });

    it("remains in awaitingDraw state", () => {
      const cardInHand = card("3");
      const actor = createTurnActor({ hand: [cardInHand, card("5")] });
      actor.start();
      const handBefore = [...actor.getSnapshot().context.hand];
      actor.send({ type: "DISCARD", cardId: cardInHand.id });
      expect(actor.getSnapshot().value).toBe("awaitingDraw");
      expect(actor.getSnapshot().context.hand).toEqual(handBefore);
      actor.stop();
    });

    it("LAY_DOWN command is rejected - must draw first", () => {
      // Create hand with valid contract cards (2 sets for round 1)
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const eightC = card("8", "clubs");
      const eightD = card("8", "diamonds");
      const eightH = card("8", "hearts");
      const extras = [card("3"), card("4"), card("5"), card("6"), card("7")];
      const hand = [nineC, nineD, nineH, eightC, eightD, eightH, ...extras];

      const actor = createTurnActor({ hand, roundNumber: 1 });
      actor.start();

      // Try to lay down without drawing first - should be rejected
      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set", cardIds: [nineC.id, nineD.id, nineH.id] },
          { type: "set", cardIds: [eightC.id, eightD.id, eightH.id] },
        ],
      });

      // Must remain in awaitingDraw state
      expect(actor.getSnapshot().value).toBe("awaitingDraw");
      // Hand should be unchanged
      expect(actor.getSnapshot().context.hand).toEqual(hand);
      actor.stop();
    });
  });

  describe("in awaitingDiscard state", () => {
    it("DRAW_FROM_STOCK command is rejected", () => {
      const actor = createTurnActor();
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      const handAfterFirstDraw = [...actor.getSnapshot().context.hand];
      // Try to draw again
      actor.send({ type: "DRAW_FROM_STOCK" });
      expect(actor.getSnapshot().value).toBe("awaitingDiscard");
      expect(actor.getSnapshot().context.hand).toEqual(handAfterFirstDraw);
      actor.stop();
    });

    it("DRAW_FROM_DISCARD command is rejected", () => {
      const actor = createTurnActor();
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      const handAfterFirstDraw = [...actor.getSnapshot().context.hand];
      // Try to draw from discard after already drawing
      actor.send({ type: "DRAW_FROM_DISCARD" });
      expect(actor.getSnapshot().value).toBe("awaitingDiscard");
      expect(actor.getSnapshot().context.hand).toEqual(handAfterFirstDraw);
      actor.stop();
    });

    it("remains in awaitingDiscard state", () => {
      const actor = createTurnActor();
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      // Send invalid commands
      actor.send({ type: "DRAW_FROM_STOCK" });
      expect(actor.getSnapshot().value).toBe("awaitingDiscard");
      actor.send({ type: "DRAW_FROM_DISCARD" });
      expect(actor.getSnapshot().value).toBe("awaitingDiscard");
      actor.stop();
    });
  });

  describe("in turnComplete state", () => {
    it("all commands are rejected (final state)", () => {
      const cardToDiscard = card("3");
      const actor = createTurnActor({ hand: [cardToDiscard, card("5")] });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: cardToDiscard.id });
      expect(actor.getSnapshot().value).toBe("turnComplete");

      const snapshotBefore = actor.getSnapshot();

      // Try all commands - none should change state
      actor.send({ type: "DRAW_FROM_STOCK" });
      expect(actor.getSnapshot().value).toBe("turnComplete");

      actor.send({ type: "DRAW_FROM_DISCARD" });
      expect(actor.getSnapshot().value).toBe("turnComplete");

      actor.send({ type: "DISCARD", cardId: "any-card" });
      expect(actor.getSnapshot().value).toBe("turnComplete");

      // Context should be unchanged
      expect(actor.getSnapshot().context).toEqual(snapshotBefore.context);
      actor.stop();
    });
  });
});

describe("TurnMachine - turn output", () => {
  it("turnComplete state outputs final hand", () => {
    const cardToKeep = card("5");
    const cardToDiscard = card("3");
    const actor = createTurnActor({ hand: [cardToDiscard, cardToKeep] });
    actor.start();
    actor.send({ type: "DRAW_FROM_STOCK" });
    actor.send({ type: "SKIP_LAY_DOWN" });
    actor.send({ type: "DISCARD", cardId: cardToDiscard.id });

    const output = actor.getSnapshot().output;
    expect(output).toBeDefined();
    expect(output!.hand).toContainEqual(cardToKeep);
    expect(output!.hand).not.toContainEqual(cardToDiscard);
    actor.stop();
  });

  it("turnComplete state outputs final stock", () => {
    const stockCard1 = card("K");
    const stockCard2 = card("Q");
    const cardToDiscard = card("3");
    const actor = createTurnActor({
      hand: [cardToDiscard, card("5")],
      stock: [stockCard1, stockCard2],
    });
    actor.start();
    actor.send({ type: "DRAW_FROM_STOCK" });
    actor.send({ type: "SKIP_LAY_DOWN" });
    actor.send({ type: "DISCARD", cardId: cardToDiscard.id });

    const output = actor.getSnapshot().output;
    expect(output).toBeDefined();
    expect(output!.stock).toEqual([stockCard2]);
    actor.stop();
  });

  it("turnComplete state outputs final discard", () => {
    const cardToDiscard = card("3");
    const existingDiscard = card("8");
    const actor = createTurnActor({
      hand: [cardToDiscard, card("5")],
      discard: [existingDiscard],
    });
    actor.start();
    actor.send({ type: "DRAW_FROM_STOCK" });
    actor.send({ type: "SKIP_LAY_DOWN" });
    actor.send({ type: "DISCARD", cardId: cardToDiscard.id });

    const output = actor.getSnapshot().output;
    expect(output).toBeDefined();
    expect(output!.discard[0]).toEqual(cardToDiscard);
    expect(output!.discard[1]).toEqual(existingDiscard);
    actor.stop();
  });

  it("turnComplete state outputs playerId", () => {
    const cardToDiscard = card("3");
    const actor = createTurnActor({ hand: [cardToDiscard, card("5")] });
    actor.start();
    actor.send({ type: "DRAW_FROM_STOCK" });
    actor.send({ type: "SKIP_LAY_DOWN" });
    actor.send({ type: "DISCARD", cardId: cardToDiscard.id });

    const output = actor.getSnapshot().output;
    expect(output).toBeDefined();
    expect(output!.playerId).toBe("player-1");
    actor.stop();
  });

  it("output can be used to update game state", () => {
    const cardToDiscard = card("3");
    const cardToKeep = card("5");
    const stockCard = card("K");
    const actor = createTurnActor({
      hand: [cardToDiscard, cardToKeep],
      stock: [stockCard, card("Q")],
      discard: [card("8")],
    });
    actor.start();
    actor.send({ type: "DRAW_FROM_STOCK" });
    actor.send({ type: "SKIP_LAY_DOWN" });
    actor.send({ type: "DISCARD", cardId: cardToDiscard.id });

    const output = actor.getSnapshot().output;
    expect(output).toBeDefined();

    // Verify output has all the fields needed to update game state
    expect(output!.playerId).toBeDefined();
    expect(Array.isArray(output!.hand)).toBe(true);
    expect(Array.isArray(output!.stock)).toBe(true);
    expect(Array.isArray(output!.discard)).toBe(true);

    // Verify the data is correct for updating
    expect(output!.hand.length).toBe(2); // kept card + drawn card
    expect(output!.stock.length).toBe(1); // one card drawn
    expect(output!.discard.length).toBe(2); // discarded + existing
    actor.stop();
  });
});
