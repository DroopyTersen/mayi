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
    it("transitions from 'awaitingDraw' to 'awaitingDiscard'", () => {
      const actor = createTurnActor();
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      expect(actor.getSnapshot().value).toBe("awaitingDiscard");
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
    it.todo(
      "reshuffles discard pile into stock (deferred to later phase)",
      () => {}
    );
  });
});

describe("TurnMachine - drawing from discard", () => {
  describe("DRAW_FROM_DISCARD command", () => {
    it("transitions from 'awaitingDraw' to 'awaitingDiscard'", () => {
      const actor = createTurnActor();
      actor.start();
      actor.send({ type: "DRAW_FROM_DISCARD" });
      expect(actor.getSnapshot().value).toBe("awaitingDiscard");
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
});

describe("TurnMachine - discarding", () => {
  describe("DISCARD command after drawing", () => {
    it("transitions from 'awaitingDiscard' to 'turnComplete'", () => {
      const cardToDiscard = card("3");
      const actor = createTurnActor({ hand: [cardToDiscard, card("5")] });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
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
      actor1.send({ type: "DISCARD", cardId: first.id });
      expect(actor1.getSnapshot().value).toBe("turnComplete");
      actor1.stop();

      // Discard middle
      const actor2 = createTurnActor({ hand: [card("3"), middle, card("7")] });
      actor2.start();
      actor2.send({ type: "DRAW_FROM_STOCK" });
      actor2.send({ type: "DISCARD", cardId: middle.id });
      expect(actor2.getSnapshot().value).toBe("turnComplete");
      actor2.stop();

      // Discard last
      const actor3 = createTurnActor({ hand: [card("3"), card("5"), last] });
      actor3.start();
      actor3.send({ type: "DRAW_FROM_STOCK" });
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
      actor1.send({ type: "DISCARD", cardId: two.id });
      expect(actor1.getSnapshot().value).toBe("turnComplete");
      actor1.stop();

      // Discard a Joker
      const actor2 = createTurnActor({ hand: [joker, card("5")] });
      actor2.start();
      actor2.send({ type: "DRAW_FROM_STOCK" });
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
    it.todo("DISCARD command is rejected", () => {});

    it.todo("remains in awaitingDraw state", () => {});
  });

  describe("in awaitingDiscard state", () => {
    it.todo("DRAW_FROM_STOCK command is rejected", () => {});

    it.todo("DRAW_FROM_DISCARD command is rejected", () => {});

    it.todo("remains in awaitingDiscard state", () => {});
  });

  describe("in turnComplete state", () => {
    it.todo("all commands are rejected (final state)", () => {});
  });
});

describe("TurnMachine - turn output", () => {
  it.todo("turnComplete state outputs final hand", () => {});

  it.todo("turnComplete state outputs final stock", () => {});

  it.todo("turnComplete state outputs final discard", () => {});

  it.todo("turnComplete state outputs playerId", () => {});

  it.todo("output can be used to update game state", () => {});
});
