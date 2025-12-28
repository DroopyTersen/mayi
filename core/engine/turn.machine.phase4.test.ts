import { describe, it, expect } from "bun:test";
import { createActor } from "xstate";
import { turnMachine } from "./turn.machine";
import type { RoundNumber } from "./engine.types";
import type { Card } from "../card/card.types";
import type { Meld } from "../meld/meld.types";

/**
 * Phase 4: Turn Machine Tests
 *
 * Tests for turn machine behavior related to laying off, going out, and round 6 rules.
 */

let cardId = 0;
function card(rank: Card["rank"], suit: Card["suit"] = "hearts"): Card {
  return { id: `card-${cardId++}`, suit, rank };
}

function createMeld(type: "set" | "run", cards: Card[], ownerId: string = "player-1"): Meld {
  return {
    id: `meld-${Math.random()}`,
    type,
    cards,
    ownerId,
  };
}

describe("TurnMachine - drawn state with lay off", () => {
  describe("LAY_OFF availability", () => {
    it("available when isDown: true AND laidDownThisTurn: false AND hasDrawn: true", () => {
      const cardToLayOff = card("3", "spades");
      const existingSet = createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")]);

      const input = {
        playerId: "player-1",
        hand: [cardToLayOff, card("K", "hearts")],
        stock: [card("A", "clubs")],
        discard: [card("Q", "diamonds")],
        roundNumber: 2 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [existingSet],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      // Should be able to lay off
      actor.send({ type: "LAY_OFF", cardId: cardToLayOff.id, meldId: existingSet.id });

      // Card should be removed from hand
      expect(actor.getSnapshot().context.hand.length).toBe(2); // 2 original + 1 draw - 1 layoff
    });

    it("NOT available when isDown: false (not down)", () => {
      const cardToLayOff = card("3", "spades");
      const existingSet = createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")]);

      const input = {
        playerId: "player-1",
        hand: [cardToLayOff, card("K", "hearts")],
        stock: [card("A", "clubs")],
        discard: [card("Q", "diamonds")],
        roundNumber: 2 as RoundNumber,
        isDown: false, // not down
        laidDownThisTurn: false,
        table: [existingSet],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "LAY_OFF", cardId: cardToLayOff.id, meldId: existingSet.id });

      // Should be rejected - hand unchanged (still has 3 cards)
      expect(actor.getSnapshot().context.hand.length).toBe(3);
    });

    it("NOT available when laidDownThisTurn: true (just laid down)", () => {
      // Set up a round 1 contract scenario
      const three1 = card("3", "clubs");
      const three2 = card("3", "diamonds");
      const three3 = card("3", "hearts");
      const four1 = card("4", "clubs");
      const four2 = card("4", "diamonds");
      const four3 = card("4", "hearts");
      const extraThree = card("3", "spades");

      const existingSet = createMeld("set", [card("5", "clubs"), card("5", "diamonds"), card("5", "hearts")]);

      const input = {
        playerId: "player-1",
        hand: [three1, three2, three3, four1, four2, four3, extraThree],
        stock: [card("A", "clubs")],
        discard: [card("Q", "diamonds")],
        roundNumber: 1 as RoundNumber,
        isDown: false,
        laidDownThisTurn: false,
        table: [existingSet],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      // Lay down contract
      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set", cardIds: [three1.id, three2.id, three3.id] },
          { type: "set", cardIds: [four1.id, four2.id, four3.id] },
        ],
      });

      expect(actor.getSnapshot().context.laidDownThisTurn).toBe(true);

      // Try to lay off - should be rejected because laidDownThisTurn is true
      const handBefore = actor.getSnapshot().context.hand.length;
      actor.send({ type: "LAY_OFF", cardId: extraThree.id, meldId: existingSet.id });
      expect(actor.getSnapshot().context.hand.length).toBe(handBefore);
    });

    it("NOT available when hasDrawn: false (haven't drawn yet)", () => {
      const cardToLayOff = card("3", "spades");
      const existingSet = createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")]);

      const input = {
        playerId: "player-1",
        hand: [cardToLayOff, card("K", "hearts")],
        stock: [card("A", "clubs")],
        discard: [card("Q", "diamonds")],
        roundNumber: 2 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [existingSet],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();

      // Don't draw - try to lay off immediately
      actor.send({ type: "LAY_OFF", cardId: cardToLayOff.id, meldId: existingSet.id });

      // Should be rejected - still in awaitingDraw state
      expect(actor.getSnapshot().value).toBe("awaitingDraw");
      expect(actor.getSnapshot().context.hand.length).toBe(2);
    });
  });

  describe("state after LAY_OFF", () => {
    it("remains in 'drawn' state after LAY_OFF", () => {
      const cardToLayOff = card("3", "spades");
      const existingSet = createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")]);

      const input = {
        playerId: "player-1",
        hand: [cardToLayOff, card("K", "hearts"), card("Q", "clubs")],
        stock: [card("A", "clubs")],
        discard: [card("J", "diamonds")],
        roundNumber: 2 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [existingSet],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "LAY_OFF", cardId: cardToLayOff.id, meldId: existingSet.id });

      expect(actor.getSnapshot().value).toBe("drawn");
    });

    it("can issue another LAY_OFF command", () => {
      const card1 = card("3", "spades");
      const card2 = card("3", "clubs");
      const existingSet = createMeld("set", [card("3", "hearts"), card("3", "diamonds"), card("3", "clubs")]);

      const input = {
        playerId: "player-1",
        hand: [card1, card2, card("K", "hearts")],
        stock: [card("A", "clubs")],
        discard: [card("J", "diamonds")],
        roundNumber: 2 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [existingSet],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      // First lay off
      actor.send({ type: "LAY_OFF", cardId: card1.id, meldId: existingSet.id });
      expect(actor.getSnapshot().context.hand.length).toBe(3); // 3 + 1 - 1 = 3

      // Second lay off
      actor.send({ type: "LAY_OFF", cardId: card2.id, meldId: existingSet.id });
      expect(actor.getSnapshot().context.hand.length).toBe(2); // 3 - 1 = 2
    });

    it("can issue DISCARD command (with restrictions in round 6)", () => {
      const cardToLayOff = card("3", "spades");
      const cardToDiscard = card("K", "hearts");
      const existingSet = createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")]);

      const input = {
        playerId: "player-1",
        hand: [cardToLayOff, cardToDiscard, card("Q", "clubs")],
        stock: [card("A", "clubs")],
        discard: [card("J", "diamonds")],
        roundNumber: 2 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [existingSet],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "LAY_OFF", cardId: cardToLayOff.id, meldId: existingSet.id });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: cardToDiscard.id });

      expect(actor.getSnapshot().status).toBe("done");
    });

    it("hasDrawn remains true", () => {
      const cardToLayOff = card("3", "spades");
      const existingSet = createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")]);

      const input = {
        playerId: "player-1",
        hand: [cardToLayOff, card("K", "hearts")],
        stock: [card("A", "clubs")],
        discard: [card("J", "diamonds")],
        roundNumber: 2 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [existingSet],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      expect(actor.getSnapshot().context.hasDrawn).toBe(true);

      actor.send({ type: "LAY_OFF", cardId: cardToLayOff.id, meldId: existingSet.id });

      expect(actor.getSnapshot().context.hasDrawn).toBe(true);
    });

    it("isDown remains true", () => {
      const cardToLayOff = card("3", "spades");
      const existingSet = createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")]);

      const input = {
        playerId: "player-1",
        hand: [cardToLayOff, card("K", "hearts")],
        stock: [card("A", "clubs")],
        discard: [card("J", "diamonds")],
        roundNumber: 2 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [existingSet],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      expect(actor.getSnapshot().context.isDown).toBe(true);

      actor.send({ type: "LAY_OFF", cardId: cardToLayOff.id, meldId: existingSet.id });

      expect(actor.getSnapshot().context.isDown).toBe(true);
    });
  });

  describe("multiple lay offs", () => {
    it("lay off first card → still in 'drawn'", () => {
      const card1 = card("3", "spades");
      const existingSet = createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")]);

      const input = {
        playerId: "player-1",
        hand: [card1, card("K", "hearts"), card("Q", "clubs")],
        stock: [card("A", "clubs")],
        discard: [card("J", "diamonds")],
        roundNumber: 2 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [existingSet],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "LAY_OFF", cardId: card1.id, meldId: existingSet.id });

      expect(actor.getSnapshot().value).toBe("drawn");
    });

    it("lay off second card → still in 'drawn'", () => {
      const card1 = card("3", "spades");
      const card2 = card("3", "clubs");
      const existingSet = createMeld("set", [card("3", "hearts"), card("3", "diamonds"), card("3", "clubs")]);

      const input = {
        playerId: "player-1",
        hand: [card1, card2, card("K", "hearts"), card("Q", "clubs")],
        stock: [card("A", "clubs")],
        discard: [card("J", "diamonds")],
        roundNumber: 2 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [existingSet],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "LAY_OFF", cardId: card1.id, meldId: existingSet.id });
      actor.send({ type: "LAY_OFF", cardId: card2.id, meldId: existingSet.id });

      expect(actor.getSnapshot().value).toBe("drawn");
    });

    it("lay off third card → still in 'drawn'", () => {
      const card1 = card("5", "spades");
      const card2 = card("5", "clubs");
      const card3 = card("5", "diamonds");
      const existingSet = createMeld("set", [card("5", "hearts"), card("5", "diamonds"), card("5", "clubs")]);

      const input = {
        playerId: "player-1",
        hand: [card1, card2, card3, card("K", "hearts"), card("Q", "clubs")],
        stock: [card("A", "clubs")],
        discard: [card("J", "diamonds")],
        roundNumber: 2 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [existingSet],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "LAY_OFF", cardId: card1.id, meldId: existingSet.id });
      actor.send({ type: "LAY_OFF", cardId: card2.id, meldId: existingSet.id });
      actor.send({ type: "LAY_OFF", cardId: card3.id, meldId: existingSet.id });

      expect(actor.getSnapshot().value).toBe("drawn");
      expect(actor.getSnapshot().context.hand.length).toBe(3); // 5 + 1 - 3 = 3
    });

    it("unlimited lay offs allowed per turn", () => {
      // Create multiple melds to lay off to
      const set1 = createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")]);
      const set2 = createMeld("set", [card("5", "clubs"), card("5", "diamonds"), card("5", "hearts")]);

      const card1 = card("3", "spades");
      const card2 = card("5", "spades");

      const input = {
        playerId: "player-1",
        hand: [card1, card2, card("K", "hearts")],
        stock: [card("A", "clubs")],
        discard: [card("J", "diamonds")],
        roundNumber: 2 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [set1, set2],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      // Lay off to first set
      actor.send({ type: "LAY_OFF", cardId: card1.id, meldId: set1.id });
      // Lay off to second set
      actor.send({ type: "LAY_OFF", cardId: card2.id, meldId: set2.id });

      // Both should succeed
      expect(actor.getSnapshot().context.hand.length).toBe(2); // 3 + 1 - 2 = 2
    });

    it("limited only by cards in hand and valid targets", () => {
      // Try to lay off a card that doesn't fit
      const invalidCard = card("K", "spades");
      const existingSet = createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")]);

      const input = {
        playerId: "player-1",
        hand: [invalidCard, card("Q", "hearts")],
        stock: [card("A", "clubs")],
        discard: [card("J", "diamonds")],
        roundNumber: 2 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [existingSet],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      const handBefore = actor.getSnapshot().context.hand.length;
      actor.send({ type: "LAY_OFF", cardId: invalidCard.id, meldId: existingSet.id });

      // Should be rejected - hand unchanged
      expect(actor.getSnapshot().context.hand.length).toBe(handBefore);
    });
  });
});

describe("TurnMachine - wentOut state", () => {
  describe("transition to wentOut via discard (rounds 1-5)", () => {
    it("given: rounds 1-5, player is in 'awaitingDiscard' state", () => {
      // Player draws, skips lay down, reaches awaitingDiscard
      const lastCard = card("K", "hearts");
      const input = {
        playerId: "player-1",
        hand: [], // will have 1 card after draw
        stock: [lastCard],
        discard: [card("Q", "diamonds")],
        roundNumber: 3 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")])],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });

      expect(actor.getSnapshot().value).toBe("awaitingDiscard");
      expect(actor.getSnapshot().context.hand.length).toBe(1);
    });

    it("and: player has 1 card in hand", () => {
      const lastCard = card("K", "hearts");
      const input = {
        playerId: "player-1",
        hand: [],
        stock: [lastCard],
        discard: [card("Q", "diamonds")],
        roundNumber: 2 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")])],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });

      expect(actor.getSnapshot().context.hand.length).toBe(1);
      expect(actor.getSnapshot().context.hand[0]!.id).toBe(lastCard.id);
    });

    it("when: player discards that card", () => {
      const lastCard = card("K", "hearts");
      const input = {
        playerId: "player-1",
        hand: [],
        stock: [lastCard],
        discard: [card("Q", "diamonds")],
        roundNumber: 1 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")])],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: lastCard.id });

      // Discard should succeed
      expect(actor.getSnapshot().status).toBe("done");
    });

    it("then: hand becomes empty", () => {
      const lastCard = card("K", "hearts");
      const input = {
        playerId: "player-1",
        hand: [],
        stock: [lastCard],
        discard: [card("Q", "diamonds")],
        roundNumber: 4 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")])],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: lastCard.id });

      expect(actor.getSnapshot().output?.hand).toEqual([]);
    });

    it("and: state transitions to 'wentOut' (not 'turnComplete')", () => {
      const lastCard = card("K", "hearts");
      const input = {
        playerId: "player-1",
        hand: [],
        stock: [lastCard],
        discard: [card("Q", "diamonds")],
        roundNumber: 5 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")])],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: lastCard.id });

      expect(actor.getSnapshot().value).toBe("wentOut");
      expect(actor.getSnapshot().output?.wentOut).toBe(true);
    });
  });

  describe("transition to wentOut via lay off (any round)", () => {
    it("given: player is in 'drawn' state", () => {
      const cardToLayOff = card("3", "spades");
      const existingSet = createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")]);

      const input = {
        playerId: "player-1",
        hand: [cardToLayOff],
        stock: [card("A", "clubs")],
        discard: [card("Q", "diamonds")],
        roundNumber: 2 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [existingSet],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      expect(actor.getSnapshot().value).toBe("drawn");
    });

    it("and: player has 1 card in hand", () => {
      const cardToLayOff = card("3", "spades");
      const existingSet = createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")]);

      const input = {
        playerId: "player-1",
        hand: [], // 0 cards, will have 1 after draw
        stock: [cardToLayOff],
        discard: [card("Q", "diamonds")],
        roundNumber: 3 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [existingSet],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      expect(actor.getSnapshot().context.hand.length).toBe(1);
    });

    it("when: player lays off that card", () => {
      const cardToLayOff = card("3", "spades");
      const existingSet = createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")]);

      const input = {
        playerId: "player-1",
        hand: [],
        stock: [cardToLayOff],
        discard: [card("Q", "diamonds")],
        roundNumber: 4 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [existingSet],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "LAY_OFF", cardId: cardToLayOff.id, meldId: existingSet.id });

      // Lay off should succeed and trigger wentOut
      expect(actor.getSnapshot().status).toBe("done");
    });

    it("then: hand becomes empty", () => {
      const cardToLayOff = card("3", "spades");
      const existingSet = createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")]);

      const input = {
        playerId: "player-1",
        hand: [],
        stock: [cardToLayOff],
        discard: [card("Q", "diamonds")],
        roundNumber: 5 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [existingSet],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "LAY_OFF", cardId: cardToLayOff.id, meldId: existingSet.id });

      expect(actor.getSnapshot().output?.hand).toEqual([]);
    });

    it("and: state transitions to 'wentOut'", () => {
      const cardToLayOff = card("3", "spades");
      const existingSet = createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")]);

      const input = {
        playerId: "player-1",
        hand: [],
        stock: [cardToLayOff],
        discard: [card("Q", "diamonds")],
        roundNumber: 6 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [existingSet],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "LAY_OFF", cardId: cardToLayOff.id, meldId: existingSet.id });

      expect(actor.getSnapshot().value).toBe("wentOut");
    });

    it("and: no discard needed", () => {
      const cardToLayOff = card("3", "spades");
      const existingSet = createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")]);

      const input = {
        playerId: "player-1",
        hand: [],
        stock: [cardToLayOff],
        discard: [card("Q", "diamonds")],
        roundNumber: 2 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [existingSet],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "LAY_OFF", cardId: cardToLayOff.id, meldId: existingSet.id });

      // Machine is done without requiring a discard
      expect(actor.getSnapshot().status).toBe("done");
      expect(actor.getSnapshot().value).toBe("wentOut");
      // Discard pile unchanged (only original card)
      expect(actor.getSnapshot().output?.discard.length).toBe(1);
    });
  });

  describe("wentOut is final state", () => {
    it("no commands accepted in wentOut state", () => {
      const lastCard = card("K", "hearts");
      const input = {
        playerId: "player-1",
        hand: [],
        stock: [lastCard],
        discard: [card("Q", "diamonds")],
        roundNumber: 1 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")])],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: lastCard.id });

      expect(actor.getSnapshot().value).toBe("wentOut");

      // Try to send another command - should be ignored (machine is done)
      actor.send({ type: "DRAW_FROM_STOCK" });
      expect(actor.getSnapshot().value).toBe("wentOut");
    });

    it("turn machine terminates", () => {
      const lastCard = card("K", "hearts");
      const input = {
        playerId: "player-1",
        hand: [],
        stock: [lastCard],
        discard: [card("Q", "diamonds")],
        roundNumber: 2 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")])],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: lastCard.id });

      expect(actor.getSnapshot().status).toBe("done");
    });

    it("round ends", () => {
      // wentOut: true signals to parent machine that round should end
      const lastCard = card("K", "hearts");
      const input = {
        playerId: "player-1",
        hand: [],
        stock: [lastCard],
        discard: [card("Q", "diamonds")],
        roundNumber: 3 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")])],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: lastCard.id });

      expect(actor.getSnapshot().output?.wentOut).toBe(true);
    });
  });

  describe("wentOut output", () => {
    it("output.wentOut === true", () => {
      const lastCard = card("K", "hearts");
      const input = {
        playerId: "player-1",
        hand: [],
        stock: [lastCard],
        discard: [card("Q", "diamonds")],
        roundNumber: 1 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")])],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: lastCard.id });

      expect(actor.getSnapshot().output?.wentOut).toBe(true);
    });

    it("output.playerId === current player's id", () => {
      const lastCard = card("K", "hearts");
      const input = {
        playerId: "player-42",
        hand: [],
        stock: [lastCard],
        discard: [card("Q", "diamonds")],
        roundNumber: 2 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")])],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: lastCard.id });

      expect(actor.getSnapshot().output?.playerId).toBe("player-42");
    });

    it("output.hand === [] (empty array)", () => {
      const lastCard = card("K", "hearts");
      const input = {
        playerId: "player-1",
        hand: [],
        stock: [lastCard],
        discard: [card("Q", "diamonds")],
        roundNumber: 3 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")])],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: lastCard.id });

      expect(actor.getSnapshot().output?.hand).toEqual([]);
    });

    it("distinct from turnComplete output where wentOut === false", () => {
      // turnComplete case: player has cards remaining
      const cardToDiscard = card("K", "hearts");
      const remainingCard = card("Q", "spades");
      const inputNormal = {
        playerId: "player-1",
        hand: [remainingCard],
        stock: [cardToDiscard],
        discard: [card("J", "diamonds")],
        roundNumber: 1 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")])],
      };

      const normalActor = createActor(turnMachine, { input: inputNormal });
      normalActor.start();
      normalActor.send({ type: "DRAW_FROM_STOCK" });
      normalActor.send({ type: "SKIP_LAY_DOWN" });
      normalActor.send({ type: "DISCARD", cardId: cardToDiscard.id });

      expect(normalActor.getSnapshot().value).toBe("turnComplete");
      expect(normalActor.getSnapshot().output?.wentOut).toBe(false);
      expect(normalActor.getSnapshot().output?.hand.length).toBe(1);

      // wentOut case: player has no cards remaining
      const lastCard = card("A", "clubs");
      const inputWentOut = {
        playerId: "player-1",
        hand: [],
        stock: [lastCard],
        discard: [card("J", "diamonds")],
        roundNumber: 1 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")])],
      };

      const wentOutActor = createActor(turnMachine, { input: inputWentOut });
      wentOutActor.start();
      wentOutActor.send({ type: "DRAW_FROM_STOCK" });
      wentOutActor.send({ type: "SKIP_LAY_DOWN" });
      wentOutActor.send({ type: "DISCARD", cardId: lastCard.id });

      expect(wentOutActor.getSnapshot().value).toBe("wentOut");
      expect(wentOutActor.getSnapshot().output?.wentOut).toBe(true);
      expect(wentOutActor.getSnapshot().output?.hand.length).toBe(0);
    });
  });
});

describe("TurnMachine - turnComplete vs wentOut", () => {
  describe("turnComplete output", () => {
    it("wentOut: false", () => {
      const cardToDiscard = card("K", "hearts");
      const input = {
        playerId: "player-1",
        hand: [card("Q", "spades"), card("J", "diamonds")],
        stock: [cardToDiscard],
        discard: [card("10", "clubs")],
        roundNumber: 1 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")])],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: cardToDiscard.id });

      expect(actor.getSnapshot().output?.wentOut).toBe(false);
    });

    it("playerId: current player", () => {
      const cardToDiscard = card("K", "hearts");
      const input = {
        playerId: "player-99",
        hand: [card("Q", "spades")],
        stock: [cardToDiscard],
        discard: [card("10", "clubs")],
        roundNumber: 2 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")])],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: cardToDiscard.id });

      expect(actor.getSnapshot().output?.playerId).toBe("player-99");
    });

    it("hand: remaining cards (length >= 1)", () => {
      const cardToDiscard = card("K", "hearts");
      const remainingCards = [card("Q", "spades"), card("J", "diamonds"), card("10", "hearts")];
      const input = {
        playerId: "player-1",
        hand: remainingCards,
        stock: [cardToDiscard],
        discard: [card("9", "clubs")],
        roundNumber: 3 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")])],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: cardToDiscard.id });

      expect(actor.getSnapshot().output?.hand.length).toBe(3);
      expect(actor.getSnapshot().output?.hand.length).toBeGreaterThanOrEqual(1);
    });

    it("normal turn ending", () => {
      const cardToDiscard = card("K", "hearts");
      const input = {
        playerId: "player-1",
        hand: [card("Q", "spades")],
        stock: [cardToDiscard],
        discard: [card("10", "clubs")],
        roundNumber: 4 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")])],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: cardToDiscard.id });

      expect(actor.getSnapshot().value).toBe("turnComplete");
      expect(actor.getSnapshot().status).toBe("done");
    });
  });

  describe("wentOut output", () => {
    it("wentOut: true", () => {
      const lastCard = card("K", "hearts");
      const input = {
        playerId: "player-1",
        hand: [],
        stock: [lastCard],
        discard: [card("Q", "diamonds")],
        roundNumber: 1 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")])],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: lastCard.id });

      expect(actor.getSnapshot().output?.wentOut).toBe(true);
    });

    it("playerId: current player", () => {
      const lastCard = card("K", "hearts");
      const input = {
        playerId: "player-77",
        hand: [],
        stock: [lastCard],
        discard: [card("Q", "diamonds")],
        roundNumber: 2 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")])],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: lastCard.id });

      expect(actor.getSnapshot().output?.playerId).toBe("player-77");
    });

    it("hand: [] empty", () => {
      const lastCard = card("K", "hearts");
      const input = {
        playerId: "player-1",
        hand: [],
        stock: [lastCard],
        discard: [card("Q", "diamonds")],
        roundNumber: 3 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")])],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: lastCard.id });

      expect(actor.getSnapshot().output?.hand).toEqual([]);
      expect(actor.getSnapshot().output?.hand.length).toBe(0);
    });

    it("triggers round end", () => {
      // wentOut: true is the signal that round should end
      const lastCard = card("K", "hearts");
      const input = {
        playerId: "player-1",
        hand: [],
        stock: [lastCard],
        discard: [card("Q", "diamonds")],
        roundNumber: 4 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")])],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: lastCard.id });

      // The output signals to parent machine to end the round
      const output = actor.getSnapshot().output!;
      expect(output.wentOut).toBe(true);
      // Parent would check this and trigger round scoring
    });
  });

  describe("parent machine behavior", () => {
    it("on turnComplete → advance to next player's turn", () => {
      // turnComplete with wentOut: false means game continues
      const cardToDiscard = card("K", "hearts");
      const input = {
        playerId: "player-1",
        hand: [card("Q", "spades"), card("J", "diamonds")],
        stock: [cardToDiscard],
        discard: [card("10", "clubs")],
        roundNumber: 1 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")])],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: cardToDiscard.id });

      const output = actor.getSnapshot().output!;
      // Parent checks wentOut to decide what to do
      expect(output.wentOut).toBe(false);
      // When false, parent advances to next player
    });

    it("on wentOut → transition to round scoring", () => {
      // wentOut: true means round ends and scoring happens
      const lastCard = card("K", "hearts");
      const input = {
        playerId: "player-1",
        hand: [],
        stock: [lastCard],
        discard: [card("Q", "diamonds")],
        roundNumber: 5 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")])],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: lastCard.id });

      const output = actor.getSnapshot().output!;
      // Parent checks wentOut to decide what to do
      expect(output.wentOut).toBe(true);
      // When true, parent transitions to round scoring
    });
  });
});

describe("TurnMachine - round 6 specific behavior", () => {
  describe("normal turns still have discard", () => {
    it("round 6 normal turn: draw → lay off → discard", () => {
      const cardToLayOff = card("3", "spades");
      const cardToDiscard = card("K", "hearts");
      const existingSet = createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")]);

      const input = {
        playerId: "player-1",
        hand: [cardToLayOff, cardToDiscard, card("Q", "clubs")],
        stock: [card("A", "diamonds")],
        discard: [card("J", "spades")],
        roundNumber: 6 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [existingSet],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "LAY_OFF", cardId: cardToLayOff.id, meldId: existingSet.id });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: cardToDiscard.id });

      expect(actor.getSnapshot().status).toBe("done");
      expect(actor.getSnapshot().value).toBe("turnComplete");
    });

    it("same as other rounds when NOT going out", () => {
      const cardToDiscard = card("K", "hearts");
      const input = {
        playerId: "player-1",
        hand: [cardToDiscard, card("Q", "clubs"), card("J", "diamonds")],
        stock: [card("A", "diamonds")],
        discard: [card("10", "spades")],
        roundNumber: 6 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")])],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: cardToDiscard.id });

      expect(actor.getSnapshot().value).toBe("turnComplete");
      expect(actor.getSnapshot().output?.hand.length).toBe(3);
    });

    it("DISCARD command available when player has 2+ cards", () => {
      const cardToDiscard = card("K", "hearts");
      const input = {
        playerId: "player-1",
        hand: [cardToDiscard, card("Q", "clubs")], // 2 cards + 1 from draw = 3
        stock: [card("A", "diamonds")],
        discard: [card("10", "spades")],
        roundNumber: 6 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")])],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: cardToDiscard.id });

      // Should succeed - will have 2 cards left
      expect(actor.getSnapshot().status).toBe("done");
    });
  });

  describe("cannot discard last card in round 6", () => {
    it("given: round 6, player has 1 card in hand", () => {
      const lastCard = card("K", "hearts");
      const input = {
        playerId: "player-1",
        hand: [],
        stock: [lastCard],
        discard: [card("Q", "diamonds")],
        roundNumber: 6 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")])],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      expect(actor.getSnapshot().context.hand.length).toBe(1);
    });

    it("when: player tries to DISCARD", () => {
      const lastCard = card("K", "hearts");
      const input = {
        playerId: "player-1",
        hand: [],
        stock: [lastCard],
        discard: [card("Q", "diamonds")],
        roundNumber: 6 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")])],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });

      // Try to discard
      actor.send({ type: "DISCARD", cardId: lastCard.id });

      // Should be rejected - still in awaitingDiscard
      expect(actor.getSnapshot().value).toBe("awaitingDiscard");
    });

    it("then: rejected - 'cannot discard last card in round 6'", () => {
      const lastCard = card("K", "hearts");
      const input = {
        playerId: "player-1",
        hand: [],
        stock: [lastCard],
        discard: [card("Q", "diamonds")],
        roundNumber: 6 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")])],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: lastCard.id });

      // Hand still has the card
      expect(actor.getSnapshot().context.hand.length).toBe(1);
    });

    it("and: must lay off to go out, or keep the card", () => {
      // If card can be laid off, must lay off to go out
      const cardToLayOff = card("3", "spades");
      const existingSet = createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")]);

      const input = {
        playerId: "player-1",
        hand: [],
        stock: [cardToLayOff],
        discard: [card("Q", "diamonds")],
        roundNumber: 6 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [existingSet],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      // Lay off to go out
      actor.send({ type: "LAY_OFF", cardId: cardToLayOff.id, meldId: existingSet.id });

      expect(actor.getSnapshot().value).toBe("wentOut");
    });
  });

  describe("DISCARD availability in round 6", () => {
    it("player has 3+ cards → can discard (will have 2+ left)", () => {
      const cardToDiscard = card("K", "hearts");
      const input = {
        playerId: "player-1",
        hand: [card("Q", "clubs"), card("J", "diamonds")], // 2 + 1 draw = 3
        stock: [cardToDiscard],
        discard: [card("10", "spades")],
        roundNumber: 6 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")])],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: cardToDiscard.id });

      expect(actor.getSnapshot().status).toBe("done");
      expect(actor.getSnapshot().output?.hand.length).toBe(2);
    });

    it("player has 2 cards → can discard (will have 1 left)", () => {
      const cardToDiscard = card("K", "hearts");
      const input = {
        playerId: "player-1",
        hand: [card("Q", "clubs")], // 1 + 1 draw = 2
        stock: [cardToDiscard],
        discard: [card("10", "spades")],
        roundNumber: 6 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")])],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: cardToDiscard.id });

      expect(actor.getSnapshot().status).toBe("done");
      expect(actor.getSnapshot().output?.hand.length).toBe(1);
    });

    it("player has 1 card → CANNOT discard (would go out)", () => {
      const lastCard = card("K", "hearts");
      const input = {
        playerId: "player-1",
        hand: [],
        stock: [lastCard],
        discard: [card("10", "spades")],
        roundNumber: 6 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")])],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: lastCard.id });

      // Should be rejected
      expect(actor.getSnapshot().value).toBe("awaitingDiscard");
      expect(actor.getSnapshot().context.hand.length).toBe(1);
    });
  });

  describe("state transitions in round 6", () => {
    it("from 'awaitingDraw': DRAW_FROM_STOCK → 'drawn'", () => {
      const input = {
        playerId: "player-1",
        hand: [card("K", "hearts")],
        stock: [card("A", "clubs")],
        discard: [card("Q", "diamonds")],
        roundNumber: 6 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")])],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();

      expect(actor.getSnapshot().value).toBe("awaitingDraw");
      actor.send({ type: "DRAW_FROM_STOCK" });
      expect(actor.getSnapshot().value).toBe("drawn");
    });

    it("from 'awaitingDraw': DRAW_FROM_DISCARD → 'drawn'", () => {
      const topDiscard = card("Q", "diamonds");
      const input = {
        playerId: "player-1",
        hand: [card("K", "hearts")],
        stock: [card("A", "clubs")],
        discard: [topDiscard],
        roundNumber: 6 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")])],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();

      expect(actor.getSnapshot().value).toBe("awaitingDraw");
      actor.send({ type: "DRAW_FROM_DISCARD" });
      expect(actor.getSnapshot().value).toBe("drawn");
    });

    it("from 'drawn': LAY_OFF (if valid) → stay in 'drawn' OR 'wentOut' if hand empty", () => {
      // Case 1: Stay in drawn (hand not empty after lay off)
      const cardToLayOff1 = card("3", "spades");
      const existingSet = createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")]);

      const input1 = {
        playerId: "player-1",
        hand: [cardToLayOff1, card("K", "hearts")],
        stock: [card("A", "clubs")],
        discard: [card("Q", "diamonds")],
        roundNumber: 6 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [existingSet],
      };

      const actor1 = createActor(turnMachine, { input: input1 });
      actor1.start();
      actor1.send({ type: "DRAW_FROM_STOCK" });
      actor1.send({ type: "LAY_OFF", cardId: cardToLayOff1.id, meldId: existingSet.id });

      expect(actor1.getSnapshot().value).toBe("drawn");

      // Case 2: wentOut (hand empty after lay off)
      const cardToLayOff2 = card("3", "diamonds");
      const existingSet2 = createMeld("set", [card("3", "clubs"), card("3", "spades"), card("3", "hearts")]);

      const input2 = {
        playerId: "player-1",
        hand: [],
        stock: [cardToLayOff2],
        discard: [card("Q", "diamonds")],
        roundNumber: 6 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [existingSet2],
      };

      const actor2 = createActor(turnMachine, { input: input2 });
      actor2.start();
      actor2.send({ type: "DRAW_FROM_STOCK" });
      actor2.send({ type: "LAY_OFF", cardId: cardToLayOff2.id, meldId: existingSet2.id });

      expect(actor2.getSnapshot().value).toBe("wentOut");
    });

    it("from 'drawn': LAY_DOWN (if valid) → stay in 'drawn'", () => {
      // Round 6 contract: 1 set + 2 runs
      const three1 = card("3", "clubs");
      const three2 = card("3", "diamonds");
      const three3 = card("3", "hearts");
      const run1_1 = card("4", "spades");
      const run1_2 = card("5", "spades");
      const run1_3 = card("6", "spades");
      const run1_4 = card("7", "spades");
      const run2_1 = card("9", "hearts");
      const run2_2 = card("10", "hearts");
      const run2_3 = card("J", "hearts");
      const run2_4 = card("Q", "hearts");
      const extraCard = card("K", "clubs");

      const input = {
        playerId: "player-1",
        hand: [three1, three2, three3, run1_1, run1_2, run1_3, run1_4, run2_1, run2_2, run2_3, run2_4, extraCard],
        stock: [card("A", "clubs")],
        discard: [card("Q", "diamonds")],
        roundNumber: 6 as RoundNumber,
        isDown: false,
        laidDownThisTurn: false,
        table: [],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set", cardIds: [three1.id, three2.id, three3.id] },
          { type: "run", cardIds: [run1_1.id, run1_2.id, run1_3.id, run1_4.id] },
          { type: "run", cardIds: [run2_1.id, run2_2.id, run2_3.id, run2_4.id] },
        ],
      });

      // In round 6, after LAY_DOWN player stays in 'drawn' to allow lay offs
      expect(actor.getSnapshot().value).toBe("drawn");
      expect(actor.getSnapshot().context.isDown).toBe(true);
    });

    it("from 'drawn': hand empty after lay off → 'wentOut'", () => {
      const cardToLayOff = card("3", "spades");
      const existingSet = createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")]);

      const input = {
        playerId: "player-1",
        hand: [],
        stock: [cardToLayOff],
        discard: [card("Q", "diamonds")],
        roundNumber: 6 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [existingSet],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "LAY_OFF", cardId: cardToLayOff.id, meldId: existingSet.id });

      expect(actor.getSnapshot().value).toBe("wentOut");
      expect(actor.getSnapshot().output?.hand).toEqual([]);
    });

    it("from 'drawn': DISCARD (if 2+ cards) → 'awaitingDiscard' → 'turnComplete'", () => {
      const cardToDiscard = card("K", "hearts");
      const input = {
        playerId: "player-1",
        hand: [card("Q", "clubs")],
        stock: [cardToDiscard],
        discard: [card("J", "diamonds")],
        roundNumber: 6 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")])],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });

      expect(actor.getSnapshot().value).toBe("awaitingDiscard");

      actor.send({ type: "DISCARD", cardId: cardToDiscard.id });

      expect(actor.getSnapshot().value).toBe("turnComplete");
    });

    it("from 'drawn': DISCARD (if 1 card) → rejected", () => {
      const lastCard = card("K", "hearts");
      const input = {
        playerId: "player-1",
        hand: [],
        stock: [lastCard],
        discard: [card("J", "diamonds")],
        roundNumber: 6 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")])],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: lastCard.id });

      // Rejected - still in awaitingDiscard
      expect(actor.getSnapshot().value).toBe("awaitingDiscard");
      expect(actor.getSnapshot().context.hand.length).toBe(1);
    });
  });

  describe("round 6 - must lay off last card", () => {
    it("given: round 6, player is down, has 1 card", () => {
      const lastCard = card("3", "spades");
      const input = {
        playerId: "player-1",
        hand: [],
        stock: [lastCard],
        discard: [card("Q", "diamonds")],
        roundNumber: 6 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")])],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      expect(actor.getSnapshot().context.isDown).toBe(true);
      expect(actor.getSnapshot().context.hand.length).toBe(1);
    });

    it("and: card can be laid off", () => {
      const cardToLayOff = card("3", "spades");
      const existingSet = createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")]);

      const input = {
        playerId: "player-1",
        hand: [],
        stock: [cardToLayOff],
        discard: [card("Q", "diamonds")],
        roundNumber: 6 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [existingSet],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      // Card can be laid off - test by doing it
      actor.send({ type: "LAY_OFF", cardId: cardToLayOff.id, meldId: existingSet.id });
      expect(actor.getSnapshot().context.hand.length).toBe(0);
    });

    it("when: player tries to DISCARD", () => {
      const lastCard = card("3", "spades");
      const input = {
        playerId: "player-1",
        hand: [],
        stock: [lastCard],
        discard: [card("Q", "diamonds")],
        roundNumber: 6 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")])],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: lastCard.id });

      // Discard should be rejected
      expect(actor.getSnapshot().value).toBe("awaitingDiscard");
    });

    it("then: rejected", () => {
      const lastCard = card("3", "spades");
      const input = {
        playerId: "player-1",
        hand: [],
        stock: [lastCard],
        discard: [card("Q", "diamonds")],
        roundNumber: 6 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")])],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: lastCard.id });

      // Card still in hand
      expect(actor.getSnapshot().context.hand.length).toBe(1);
    });

    it("when: player lays off that card", () => {
      const cardToLayOff = card("3", "spades");
      const existingSet = createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")]);

      const input = {
        playerId: "player-1",
        hand: [],
        stock: [cardToLayOff],
        discard: [card("Q", "diamonds")],
        roundNumber: 6 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [existingSet],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "LAY_OFF", cardId: cardToLayOff.id, meldId: existingSet.id });

      // Lay off succeeds
      expect(actor.getSnapshot().status).toBe("done");
    });

    it("then: hand empty → wentOut", () => {
      const cardToLayOff = card("3", "spades");
      const existingSet = createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")]);

      const input = {
        playerId: "player-1",
        hand: [],
        stock: [cardToLayOff],
        discard: [card("Q", "diamonds")],
        roundNumber: 6 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [existingSet],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "LAY_OFF", cardId: cardToLayOff.id, meldId: existingSet.id });

      expect(actor.getSnapshot().value).toBe("wentOut");
      expect(actor.getSnapshot().output?.hand).toEqual([]);
    });
  });

  describe("round 6 - stuck with 1 unlayable card", () => {
    it("given: round 6, player has 1 card that can't be laid off", () => {
      const unlayableCard = card("K", "hearts"); // Can't lay off to a set of 3s
      const input = {
        playerId: "player-1",
        hand: [],
        stock: [unlayableCard],
        discard: [card("Q", "diamonds")],
        roundNumber: 6 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")])],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      expect(actor.getSnapshot().context.hand.length).toBe(1);
    });

    it("when: player tries to DISCARD", () => {
      const unlayableCard = card("K", "hearts");
      const input = {
        playerId: "player-1",
        hand: [],
        stock: [unlayableCard],
        discard: [card("Q", "diamonds")],
        roundNumber: 6 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")])],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: unlayableCard.id });

      // Should be rejected
      expect(actor.getSnapshot().value).toBe("awaitingDiscard");
    });

    it("then: rejected", () => {
      const unlayableCard = card("K", "hearts");
      const input = {
        playerId: "player-1",
        hand: [],
        stock: [unlayableCard],
        discard: [card("Q", "diamonds")],
        roundNumber: 6 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")])],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: unlayableCard.id });

      expect(actor.getSnapshot().context.hand.length).toBe(1);
    });

    it("when: player has no valid moves", () => {
      const unlayableCard = card("K", "hearts");
      const existingSet = createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")]);

      const input = {
        playerId: "player-1",
        hand: [],
        stock: [unlayableCard],
        discard: [card("Q", "diamonds")],
        roundNumber: 6 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [existingSet],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      // Try to lay off - should fail
      actor.send({ type: "LAY_OFF", cardId: unlayableCard.id, meldId: existingSet.id });
      expect(actor.getSnapshot().context.hand.length).toBe(1); // Still has card

      actor.send({ type: "SKIP_LAY_DOWN" });

      // Try to discard - should fail
      actor.send({ type: "DISCARD", cardId: unlayableCard.id });
      expect(actor.getSnapshot().context.hand.length).toBe(1); // Still has card
    });

    it("then: turn ends, player keeps the card", () => {
      const unlayableCard = card("K", "hearts");
      const input = {
        playerId: "player-1",
        hand: [],
        stock: [unlayableCard],
        discard: [card("Q", "diamonds")],
        roundNumber: 6 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")])],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });

      // Use END_TURN_STUCK to end turn when stuck
      actor.send({ type: "END_TURN_STUCK" });

      expect(actor.getSnapshot().status).toBe("done");
      expect(actor.getSnapshot().output?.hand.length).toBe(1);
    });

    it("and: transitions to 'turnComplete' with 1 card in hand", () => {
      const unlayableCard = card("K", "hearts");
      const input = {
        playerId: "player-1",
        hand: [],
        stock: [unlayableCard],
        discard: [card("Q", "diamonds")],
        roundNumber: 6 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [createMeld("set", [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")])],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "END_TURN_STUCK" });

      expect(actor.getSnapshot().value).toBe("turnComplete");
      expect(actor.getSnapshot().output?.hand.length).toBe(1);
      expect(actor.getSnapshot().output?.wentOut).toBe(false);
    });
  });
});

describe("TurnMachine - going out detection", () => {
  describe("checked after discard", () => {
    it.todo("after DISCARD command processes", () => {});
    it.todo("check if hand.length === 0", () => {});
    it.todo("if yes → wentOut", () => {});
    it.todo("if no → turnComplete", () => {});
  });

  describe("checked after lay off", () => {
    it.todo("after each LAY_OFF command processes", () => {});
    it.todo("check if hand.length === 0", () => {});
    it.todo("if yes → wentOut immediately", () => {});
    it.todo("if no → remain in 'drawn', can continue", () => {});
  });

  describe("checked after GO_OUT", () => {
    it.todo("GO_OUT processes all finalLayOffs", () => {});
    it.todo("then checks hand.length", () => {});
    it.todo("should be 0 (validated before execution)", () => {});
    it.todo("transitions to wentOut", () => {});
  });

  describe("immediate trigger on 0 cards", () => {
    it.todo("wentOut triggers immediately when hand empties", () => {});
    it.todo("no waiting for 'end of turn'", () => {});
    it.todo("round ends right away", () => {});
  });
});

describe("TurnMachine - player not down behavior", () => {
  describe("all rounds - not down", () => {
    it.todo("can draw (DRAW_FROM_STOCK or DRAW_FROM_DISCARD)", () => {});
    it.todo("can lay down (if have contract)", () => {});
    it.todo("cannot lay off", () => {});
    it.todo("must discard to end turn", () => {});
    it.todo("flow: awaitingDraw → drawn → awaitingDiscard → turnComplete", () => {});
    it.todo("hand size unchanged: draw +1, discard -1 = net 0", () => {});
  });

  describe("cannot go out while not down", () => {
    it.todo("if not down, can't lay off", () => {});
    it.todo("can only draw and discard", () => {});
    it.todo("draw +1, discard -1 = net 0", () => {});
    it.todo("impossible to reach 0 cards", () => {});
    it.todo("must lay down contract first", () => {});
  });
});
