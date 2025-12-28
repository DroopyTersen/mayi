import { describe, it, expect } from "bun:test";

describe("TurnMachine - initial state", () => {
  it.todo("starts in 'awaitingDraw' state", () => {});

  it.todo("hasDrawn is false", () => {});

  it.todo("player hand matches input", () => {});

  it.todo("stock matches input", () => {});

  it.todo("discard matches input", () => {});
});

describe("TurnMachine - drawing from stock", () => {
  describe("DRAW_FROM_STOCK command", () => {
    it.todo("transitions from 'awaitingDraw' to 'awaitingDiscard'", () => {});

    it.todo("sets hasDrawn to true", () => {});

    it.todo("adds top card of stock to player's hand", () => {});

    it.todo("removes top card from stock", () => {});

    it.todo("hand size increases by 1", () => {});

    it.todo("stock size decreases by 1", () => {});

    it.todo("discard pile is unchanged", () => {});
  });

  describe("when stock is empty", () => {
    it.todo(
      "reshuffles discard pile into stock (or defers to later phase)",
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
