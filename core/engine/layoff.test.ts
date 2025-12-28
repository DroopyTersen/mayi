import { describe, it, expect } from "bun:test";
import { canLayOffCard, canLayOffToSet, canLayOffToRun } from "./layoff";
import type { Card } from "../card/card.types";
import type { Meld } from "../meld/meld.types";

function card(rank: Card["rank"], suit: Card["suit"]): Card {
  return { id: `${rank}-${suit}-${Math.random()}`, rank, suit };
}

function joker(): Card {
  return { id: `Joker-${Math.random()}`, rank: "Joker", suit: null };
}

function createMeld(type: "set" | "run", cards: Card[], ownerId: string = "player-1"): Meld {
  return {
    id: `meld-${Math.random()}`,
    type,
    cards,
    ownerId,
  };
}

/**
 * Phase 4: Laying Off Tests
 *
 * Tests for the LAY_OFF command - adding cards to existing melds on the table.
 */

describe("canLayOffCard guard", () => {
  describe("preconditions for laying off", () => {
    it("returns false if player is not down (isDown: false)", () => {
      const context = {
        isDown: false,
        laidDownThisTurn: false,
        hasDrawn: true,
      };
      expect(canLayOffCard(context)).toBe(false);
    });

    it("returns false if player laid down this turn (laidDownThisTurn: true)", () => {
      const context = {
        isDown: true,
        laidDownThisTurn: true,
        hasDrawn: true,
      };
      expect(canLayOffCard(context)).toBe(false);
    });

    it("returns false if player hasn't drawn yet (not in drawn state)", () => {
      const context = {
        isDown: true,
        laidDownThisTurn: false,
        hasDrawn: false,
      };
      expect(canLayOffCard(context)).toBe(false);
    });

    it("returns true if isDown: true AND laidDownThisTurn: false AND hasDrawn", () => {
      const context = {
        isDown: true,
        laidDownThisTurn: false,
        hasDrawn: true,
      };
      expect(canLayOffCard(context)).toBe(true);
    });
  });

  describe("laying off to sets", () => {
    it("valid: adding matching rank to set (9♣ to 9♦ 9♥ 9♠)", () => {
      const set = createMeld("set", [
        card("9", "diamonds"),
        card("9", "hearts"),
        card("9", "spades"),
      ]);
      const cardToAdd = card("9", "clubs");
      expect(canLayOffToSet(cardToAdd, set)).toBe(true);
    });

    it("valid: adding wild to set (Joker to 9♦ 9♥ 9♠)", () => {
      const set = createMeld("set", [
        card("9", "diamonds"),
        card("9", "hearts"),
        card("9", "spades"),
      ]);
      const cardToAdd = joker();
      expect(canLayOffToSet(cardToAdd, set)).toBe(true);
    });

    it("valid: adding 2 (wild) to set (2♣ to 9♦ 9♥ 9♠)", () => {
      const set = createMeld("set", [
        card("9", "diamonds"),
        card("9", "hearts"),
        card("9", "spades"),
      ]);
      const cardToAdd = card("2", "clubs");
      expect(canLayOffToSet(cardToAdd, set)).toBe(true);
    });

    it("valid: adding duplicate card from multi-deck (9♣ to 9♣ 9♦ 9♥)", () => {
      const set = createMeld("set", [
        card("9", "clubs"),
        card("9", "diamonds"),
        card("9", "hearts"),
      ]);
      const cardToAdd = card("9", "clubs"); // Same suit, different deck
      expect(canLayOffToSet(cardToAdd, set)).toBe(true);
    });

    it("invalid: adding wrong rank (10♣ to 9♦ 9♥ 9♠)", () => {
      const set = createMeld("set", [
        card("9", "diamonds"),
        card("9", "hearts"),
        card("9", "spades"),
      ]);
      const cardToAdd = card("10", "clubs");
      expect(canLayOffToSet(cardToAdd, set)).toBe(false);
    });

    it("invalid: adding wild if it would make wilds outnumber naturals", () => {
      // Set with 2 naturals and 2 wilds already
      const set = createMeld("set", [
        card("9", "diamonds"),
        card("9", "hearts"),
        joker(),
        card("2", "clubs"),
      ]);
      const cardToAdd = joker(); // Adding would make 2 natural, 3 wild
      expect(canLayOffToSet(cardToAdd, set)).toBe(false);
    });
  });

  describe("laying off to sets - wild ratio edge cases", () => {
    // given: set (9♦ 9♥ 9♠) — 3 natural, 0 wild
    it("adding Joker → 3 natural, 1 wild — valid", () => {
      const set = createMeld("set", [
        card("9", "diamonds"),
        card("9", "hearts"),
        card("9", "spades"),
      ]);
      expect(canLayOffToSet(joker(), set)).toBe(true);
    });

    it("adding 2♣ → 3 natural, 1 wild — valid", () => {
      const set = createMeld("set", [
        card("9", "diamonds"),
        card("9", "hearts"),
        card("9", "spades"),
      ]);
      expect(canLayOffToSet(card("2", "clubs"), set)).toBe(true);
    });

    // given: set (9♦ 9♥ Joker) — 2 natural, 1 wild
    it("adding 9♠ (natural) → 3 natural, 1 wild — valid", () => {
      const set = createMeld("set", [
        card("9", "diamonds"),
        card("9", "hearts"),
        joker(),
      ]);
      expect(canLayOffToSet(card("9", "spades"), set)).toBe(true);
    });

    it("adding 2♣ (wild) → 2 natural, 2 wild — valid (equal is OK)", () => {
      const set = createMeld("set", [
        card("9", "diamonds"),
        card("9", "hearts"),
        joker(),
      ]);
      expect(canLayOffToSet(card("2", "clubs"), set)).toBe(true);
    });

    // given: set (9♦ 9♥ Joker 2♣) — 2 natural, 2 wild
    it("adding 9♠ (natural) → 3 natural, 2 wild — valid", () => {
      const set = createMeld("set", [
        card("9", "diamonds"),
        card("9", "hearts"),
        joker(),
        card("2", "clubs"),
      ]);
      expect(canLayOffToSet(card("9", "spades"), set)).toBe(true);
    });

    it("adding Joker → 2 natural, 3 wild — INVALID (wilds outnumber)", () => {
      const set = createMeld("set", [
        card("9", "diamonds"),
        card("9", "hearts"),
        joker(),
        card("2", "clubs"),
      ]);
      expect(canLayOffToSet(joker(), set)).toBe(false);
    });
  });

  describe("laying off to runs", () => {
    it("valid: extending run at low end (4♠ to 5♠ 6♠ 7♠ 8♠)", () => {
      const run = createMeld("run", [
        card("5", "spades"),
        card("6", "spades"),
        card("7", "spades"),
        card("8", "spades"),
      ]);
      expect(canLayOffToRun(card("4", "spades"), run)).toBe(true);
    });

    it("valid: extending run at high end (9♠ to 5♠ 6♠ 7♠ 8♠)", () => {
      const run = createMeld("run", [
        card("5", "spades"),
        card("6", "spades"),
        card("7", "spades"),
        card("8", "spades"),
      ]);
      expect(canLayOffToRun(card("9", "spades"), run)).toBe(true);
    });

    it("valid: adding wild at low end (Joker to 5♠ 6♠ 7♠ 8♠) — acts as 4♠", () => {
      const run = createMeld("run", [
        card("5", "spades"),
        card("6", "spades"),
        card("7", "spades"),
        card("8", "spades"),
      ]);
      expect(canLayOffToRun(joker(), run)).toBe(true);
    });

    it("valid: adding wild at high end (2♣ to 5♠ 6♠ 7♠ 8♠) — acts as 9♠", () => {
      const run = createMeld("run", [
        card("5", "spades"),
        card("6", "spades"),
        card("7", "spades"),
        card("8", "spades"),
      ]);
      expect(canLayOffToRun(card("2", "clubs"), run)).toBe(true);
    });

    it("invalid: card doesn't connect (10♠ to 5♠ 6♠ 7♠ 8♠) — gap of 1", () => {
      const run = createMeld("run", [
        card("5", "spades"),
        card("6", "spades"),
        card("7", "spades"),
        card("8", "spades"),
      ]);
      expect(canLayOffToRun(card("10", "spades"), run)).toBe(false);
    });

    it("invalid: wrong suit (4♥ to 5♠ 6♠ 7♠ 8♠)", () => {
      const run = createMeld("run", [
        card("5", "spades"),
        card("6", "spades"),
        card("7", "spades"),
        card("8", "spades"),
      ]);
      expect(canLayOffToRun(card("4", "hearts"), run)).toBe(false);
    });

    it("invalid: rank already in run (6♠ to 5♠ 6♠ 7♠ 8♠) — duplicate rank", () => {
      const run = createMeld("run", [
        card("5", "spades"),
        card("6", "spades"),
        card("7", "spades"),
        card("8", "spades"),
      ]);
      expect(canLayOffToRun(card("6", "spades"), run)).toBe(false);
    });

    it("invalid: non-connecting card (3♠ to 5♠ 6♠ 7♠ 8♠) — gap too large", () => {
      const run = createMeld("run", [
        card("5", "spades"),
        card("6", "spades"),
        card("7", "spades"),
        card("8", "spades"),
      ]);
      expect(canLayOffToRun(card("3", "spades"), run)).toBe(false);
    });
  });

  describe("run extension boundaries", () => {
    // given: run (3♦ 4♦ 5♦ 6♦)
    it.todo("can extend high with 7♦ — valid", () => {});
    it.todo("cannot extend low (nothing below 3) — invalid", () => {});
    it.todo("wild at low end invalid (nothing for it to represent)", () => {});

    // given: run (J♥ Q♥ K♥ A♥)
    it.todo("can extend low with 10♥ — valid", () => {});
    it.todo("cannot extend high (nothing above A) — invalid", () => {});
    it.todo("wild at high end invalid (nothing for it to represent)", () => {});

    // given: run (3♠ 4♠ 5♠ 6♠ 7♠ 8♠ 9♠ 10♠ J♠ Q♠ K♠ A♠) — full 12-card run
    it.todo("cannot extend in either direction", () => {});
    it.todo("no cards can be added to full run", () => {});
  });

  describe("laying off to runs - wild ratio edge cases", () => {
    // given: run (5♠ 6♠ 7♠ 8♠) — 4 natural, 0 wild
    it.todo("adding Joker at either end → 4 natural, 1 wild — valid", () => {});

    // given: run (5♠ Joker 7♠ 8♠) — 3 natural, 1 wild
    it.todo("adding 4♠ (natural) → 4 natural, 1 wild — valid", () => {});
    it.todo("adding 9♠ (natural) → 4 natural, 1 wild — valid", () => {});
    it.todo("adding 2♣ (wild) at end → 3 natural, 2 wild — valid (equal OK)", () => {});

    // given: run (5♠ Joker 7♠ 2♣) — 2 natural, 2 wild
    it.todo("adding 4♠ (natural) → 3 natural, 2 wild — valid", () => {});
    it.todo("adding 9♠ (natural) → 3 natural, 2 wild — valid", () => {});
    it.todo("adding Joker → 2 natural, 3 wild — INVALID", () => {});
  });

  describe("card ownership for lay off", () => {
    it.todo("card must be in current player's hand", () => {});
    it.todo("cannot lay off card not in hand", () => {});
    it.todo("cannot lay off card from another player's hand", () => {});
    it.todo("cannot lay off card already on table", () => {});
    it.todo("cardId must exist", () => {});
  });

  describe("meld ownership - anyone can add to any meld", () => {
    it.todo("can lay off to your own melds", () => {});
    it.todo("can lay off to other players' melds", () => {});
    it.todo("meld ownership doesn't restrict who can add", () => {});
    it.todo("meld ownerId unchanged after lay off (original owner keeps credit)", () => {});
  });
});

describe("LAY_OFF action", () => {
  describe("successful lay off to set", () => {
    it.todo("removes card from player's hand", () => {});
    it.todo("adds card to target meld's cards array", () => {});
    it.todo("meld remains type: 'set'", () => {});
    it.todo("meld ownerId unchanged", () => {});
    it.todo("hand size decreases by 1", () => {});
    it.todo("player remains in 'drawn' state (can lay off more)", () => {});
  });

  describe("successful lay off to run - low end", () => {
    it.todo("given: run (5♠ 6♠ 7♠ 8♠), player has 4♠", () => {});
    it.todo("when: player lays off 4♠, run becomes (4♠ 5♠ 6♠ 7♠ 8♠)", () => {});
    it.todo("card at correct position (first)", () => {});
  });

  describe("successful lay off to run - high end", () => {
    it.todo("given: run (5♠ 6♠ 7♠ 8♠), player has 9♠", () => {});
    it.todo("when: player lays off 9♠, run becomes (5♠ 6♠ 7♠ 8♠ 9♠)", () => {});
    it.todo("card at correct position (last)", () => {});
  });

  describe("successful lay off - wild to run", () => {
    it.todo("given: run (5♠ 6♠ 7♠ 8♠), player has Joker", () => {});
    it.todo("when: player lays off Joker to high end, run becomes (5♠ 6♠ 7♠ 8♠ Joker)", () => {});
    it.todo("Joker represents 9♠", () => {});
  });

  describe("multiple lay offs in one turn", () => {
    it.todo("player can lay off first card, remain in 'drawn' state", () => {});
    it.todo("player can lay off second card, remain in 'drawn' state", () => {});
    it.todo("player can lay off third card, etc.", () => {});
    it.todo("each lay off is separate command", () => {});
    it.todo("hand decreases with each lay off", () => {});
    it.todo("can lay off to different melds in same turn", () => {});
    it.todo("can lay off multiple cards to same meld (one at a time)", () => {});
  });

  describe("state transitions after lay off", () => {
    it.todo("after LAY_OFF, remains in 'drawn' state", () => {});
    it.todo("can issue another LAY_OFF command", () => {});
    it.todo("can proceed to DISCARD (if not going out in round 6)", () => {});
    it.todo("going out triggered immediately if hand becomes empty", () => {});
  });
});

describe("LAY_OFF rejection", () => {
  describe("player state rejections", () => {
    it.todo("rejected if player not down (isDown: false)", () => {});
    it.todo("rejected if player laid down this turn (laidDownThisTurn: true)", () => {});
    it.todo("rejected if player hasn't drawn yet", () => {});
    it.todo("error message: 'must be down from a previous turn to lay off'", () => {});
    it.todo("error message: 'cannot lay off on same turn as laying down'", () => {});
    it.todo("state unchanged on rejection", () => {});
    it.todo("hand unchanged on rejection", () => {});
  });

  describe("invalid card rejections", () => {
    it.todo("rejected if cardId not in player's hand", () => {});
    it.todo("error message: 'card not in hand'", () => {});
  });

  describe("invalid meld rejections", () => {
    it.todo("rejected if meldId doesn't exist on table", () => {});
    it.todo("error message: 'meld not found'", () => {});
  });

  describe("card doesn't fit meld rejections", () => {
    it.todo("rejected if card doesn't match set's rank", () => {});
    it.todo("rejected if card doesn't extend run", () => {});
    it.todo("rejected if card wrong suit for run", () => {});
    it.todo("error message: 'card does not fit this meld'", () => {});
  });

  describe("wild ratio rejections", () => {
    it.todo("rejected if adding wild would make wilds > naturals", () => {});
    it.todo("error message: 'would make wilds outnumber naturals'", () => {});
  });
});
