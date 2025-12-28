import { describe, it, expect } from "bun:test";

describe("REORDER_HAND command", () => {
  describe("basic reordering", () => {
    it.todo("accepts new order of card ids", () => {});

    it.todo("hand contains same cards in new order", () => {});

    it.todo("hand size is unchanged", () => {});

    it.todo("all original cards still present", () => {});

    it.todo("no duplicate cards introduced", () => {});
  });

  describe("valid in any turn state", () => {
    it.todo("works in 'awaitingDraw' state", () => {});

    it.todo("works in 'awaitingDiscard' state", () => {});

    it.todo("does not change the current state", () => {});

    it.todo("does not affect hasDrawn flag", () => {});

    it.todo("is a 'free action' - doesn't consume turn", () => {});
  });

  describe("sort by rank", () => {
    it.todo("orders cards A, K, Q, J, 10, 9, 8, 7, 6, 5, 4, 3", () => {});

    it.todo("wilds (2s, Jokers) go at end", () => {});

    it.todo("within same rank, any order is fine (or by suit)", () => {});
  });

  describe("sort by suit", () => {
    it.todo("groups cards by suit", () => {});

    it.todo("within suit, ordered by rank", () => {});

    it.todo("wilds go at end", () => {});
  });

  describe("move single card", () => {
    it.todo("can move card from position A to position B", () => {});

    it.todo("other cards shift appropriately", () => {});

    it.todo(
      "example: (3H 5D 9C) move pos 3 to pos 1 results in (9C 3H 5D)",
      () => {}
    );
  });

  describe("validation", () => {
    it.todo("rejects if cardIds don't match current hand exactly", () => {});

    it.todo("rejects if cardIds has wrong count", () => {});

    it.todo("rejects if cardIds contains id not in hand", () => {});

    it.todo("rejects if cardIds is missing a card from hand", () => {});

    it.todo("rejects if cardIds has duplicates", () => {});

    it.todo("on rejection, hand remains unchanged", () => {});
  });

  describe("edge cases", () => {
    it.todo("reordering hand of 1 card (no-op, but valid)", () => {});

    it.todo("reordering to same order (no-op, but valid)", () => {});

    it.todo(
      "reordering empty hand (edge case - probably invalid game state)",
      () => {}
    );
  });
});
