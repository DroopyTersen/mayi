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
    it.todo("given: rounds 1-5, player is in 'awaitingDiscard' state", () => {});
    it.todo("and: player has 1 card in hand", () => {});
    it.todo("when: player discards that card", () => {});
    it.todo("then: hand becomes empty", () => {});
    it.todo("and: state transitions to 'wentOut' (not 'turnComplete')", () => {});
  });

  describe("transition to wentOut via lay off (any round)", () => {
    it.todo("given: player is in 'drawn' state", () => {});
    it.todo("and: player has 1 card in hand", () => {});
    it.todo("when: player lays off that card", () => {});
    it.todo("then: hand becomes empty", () => {});
    it.todo("and: state transitions to 'wentOut'", () => {});
    it.todo("and: no discard needed", () => {});
  });

  describe("wentOut is final state", () => {
    it.todo("no commands accepted in wentOut state", () => {});
    it.todo("turn machine terminates", () => {});
    it.todo("round ends", () => {});
  });

  describe("wentOut output", () => {
    it.todo("output.wentOut === true", () => {});
    it.todo("output.playerId === current player's id", () => {});
    it.todo("output.hand === [] (empty array)", () => {});
    it.todo("distinct from turnComplete output where wentOut === false", () => {});
  });
});

describe("TurnMachine - turnComplete vs wentOut", () => {
  describe("turnComplete output", () => {
    it.todo("wentOut: false", () => {});
    it.todo("playerId: current player", () => {});
    it.todo("hand: remaining cards (length >= 1)", () => {});
    it.todo("normal turn ending", () => {});
  });

  describe("wentOut output", () => {
    it.todo("wentOut: true", () => {});
    it.todo("playerId: current player", () => {});
    it.todo("hand: [] empty", () => {});
    it.todo("triggers round end", () => {});
  });

  describe("parent machine behavior", () => {
    it.todo("on turnComplete → advance to next player's turn", () => {});
    it.todo("on wentOut → transition to round scoring", () => {});
  });
});

describe("TurnMachine - round 6 specific behavior", () => {
  describe("normal turns still have discard", () => {
    it.todo("round 6 normal turn: draw → lay off → discard", () => {});
    it.todo("same as other rounds when NOT going out", () => {});
    it.todo("DISCARD command available when player has 2+ cards", () => {});
  });

  describe("cannot discard last card in round 6", () => {
    it.todo("given: round 6, player has 1 card in hand", () => {});
    it.todo("when: player tries to DISCARD", () => {});
    it.todo("then: rejected - 'cannot discard last card in round 6'", () => {});
    it.todo("and: must lay off to go out, or keep the card", () => {});
  });

  describe("DISCARD availability in round 6", () => {
    it.todo("player has 3+ cards → can discard (will have 2+ left)", () => {});
    it.todo("player has 2 cards → can discard (will have 1 left)", () => {});
    it.todo("player has 1 card → CANNOT discard (would go out)", () => {});
  });

  describe("state transitions in round 6", () => {
    it.todo("from 'awaitingDraw': DRAW_FROM_STOCK → 'drawn'", () => {});
    it.todo("from 'awaitingDraw': DRAW_FROM_DISCARD → 'drawn'", () => {});
    it.todo("from 'drawn': LAY_OFF (if valid) → stay in 'drawn' OR 'wentOut' if hand empty", () => {});
    it.todo("from 'drawn': LAY_DOWN (if valid) → stay in 'drawn'", () => {});
    it.todo("from 'drawn': hand empty after lay off → 'wentOut'", () => {});
    it.todo("from 'drawn': DISCARD (if 2+ cards) → 'awaitingDiscard' → 'turnComplete'", () => {});
    it.todo("from 'drawn': DISCARD (if 1 card) → rejected", () => {});
  });

  describe("round 6 - must lay off last card", () => {
    it.todo("given: round 6, player is down, has 1 card", () => {});
    it.todo("and: card can be laid off", () => {});
    it.todo("when: player tries to DISCARD", () => {});
    it.todo("then: rejected", () => {});
    it.todo("when: player lays off that card", () => {});
    it.todo("then: hand empty → wentOut", () => {});
  });

  describe("round 6 - stuck with 1 unlayable card", () => {
    it.todo("given: round 6, player has 1 card that can't be laid off", () => {});
    it.todo("when: player tries to DISCARD", () => {});
    it.todo("then: rejected", () => {});
    it.todo("when: player has no valid moves", () => {});
    it.todo("then: turn ends, player keeps the card", () => {});
    it.todo("and: transitions to 'turnComplete' with 1 card in hand", () => {});
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
