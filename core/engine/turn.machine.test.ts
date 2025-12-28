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
    it.todo("transitions from 'awaitingDraw' to 'awaitingDiscard'", () => {});

    it.todo("sets hasDrawn to true", () => {});

    it.todo("adds top card of discard to player's hand", () => {});

    it.todo("removes top card from discard", () => {});

    it.todo("hand size increases by 1", () => {});

    it.todo("discard size decreases by 1", () => {});

    it.todo("stock is unchanged", () => {});
  });

  describe("when discard is empty", () => {
    it.todo("command is rejected / not available", () => {});

    it.todo("state remains 'awaitingDraw'", () => {});

    it.todo("no changes to hand, stock, or discard", () => {});
  });
});

describe("TurnMachine - discarding", () => {
  describe("DISCARD command after drawing", () => {
    it.todo("transitions from 'awaitingDiscard' to 'turnComplete'", () => {});

    it.todo("removes specified card from player's hand", () => {});

    it.todo("adds that card to top of discard pile", () => {});

    it.todo("hand size decreases by 1", () => {});

    it.todo("discard size increases by 1", () => {});

    it.todo("stock is unchanged", () => {});
  });

  describe("DISCARD command validation", () => {
    it.todo("rejects if cardId is not in player's hand", () => {});

    it.todo(
      "rejects if player hasn't drawn yet (state is 'awaitingDraw')",
      () => {}
    );

    it.todo("state remains unchanged on rejection", () => {});
  });

  describe("discarding specific cards", () => {
    it.todo("can discard any card in hand (first, middle, last)", () => {});

    it.todo("can discard the card just drawn", () => {});

    it.todo("can discard a wild card (2 or Joker)", () => {});

    it.todo("correct card is removed (verify by id, not just count)", () => {});
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
