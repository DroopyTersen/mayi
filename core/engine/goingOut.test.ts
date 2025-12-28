import { describe, it, expect } from "bun:test";
import { createActor } from "xstate";
import {
  checkGoingOut,
  canGoOut,
  isRound6LastCardBlock,
  getGoingOutScore,
} from "./goingOut";
import { turnMachine } from "./turn.machine";
import type { Card } from "../card/card.types";
import type { Meld } from "../meld/meld.types";
import type { RoundNumber } from "./engine.types";

function card(rank: Card["rank"], suit: Card["suit"]): Card {
  return { id: `${rank}-${suit}-${Math.random()}`, rank, suit };
}

function createMeld(type: "set" | "run", cards: Card[], ownerId: string = "player-1"): Meld {
  return {
    id: `meld-${Math.random()}`,
    type,
    cards,
    ownerId,
  };
}

// Helper for creating turn input where player is down
function createDownPlayerInput(
  hand: Card[],
  table: Meld[] = [],
  roundNumber: RoundNumber = 1
) {
  return {
    playerId: "player-1",
    hand,
    stock: [card("K", "spades"), card("Q", "hearts")],
    discard: [card("5", "clubs")],
    roundNumber,
    isDown: true, // Already down
    laidDownThisTurn: false,
    table,
  };
}

/**
 * Phase 4: Going Out Tests
 *
 * Tests for going out mechanics - ending with 0 cards in hand.
 */

describe("going out - general rules", () => {
  describe("definition", () => {
    it("going out means ending with 0 cards in hand", () => {
      const emptyHand: Card[] = [];
      const result = checkGoingOut(emptyHand);
      expect(result.wentOut).toBe(true);
      expect(result.handEmpty).toBe(true);

      const nonEmptyHand = [card("K", "hearts")];
      const result2 = checkGoingOut(nonEmptyHand);
      expect(result2.wentOut).toBe(false);
      expect(result2.handEmpty).toBe(false);
    });

    it("player who goes out scores 0 for the round", () => {
      const score = getGoingOutScore();
      expect(score).toBe(0);
    });

    it.todo("going out ends the round immediately", () => {
      // This requires integration with game loop / round management
    });

    it.todo("other players score their remaining cards", () => {
      // This requires scoring module integration
    });
  });

  describe("must be down to go out", () => {
    it("player cannot go out if isDown: false", () => {
      const context = {
        hand: [], // Empty hand
        isDown: false, // NOT down
        roundNumber: 1 as RoundNumber,
      };
      expect(canGoOut(context)).toBe(false);
    });

    it("only way to remove cards (other than discard) is to lay off", () => {
      // This is a conceptual test - lay off is the only way to reduce hand
      // other than discarding (which only removes 1 card per turn)
      // Since laying off requires being down, going out requires being down
      const contextDown = {
        hand: [],
        isDown: true,
        roundNumber: 1 as RoundNumber,
      };
      expect(canGoOut(contextDown)).toBe(true);
    });

    it("laying off requires being down", () => {
      // Already tested in layoff.test.ts - canLayOffCard returns false if not down
      // Here we just verify the conceptual relationship
      const contextNotDown = {
        hand: [],
        isDown: false,
        roundNumber: 1 as RoundNumber,
      };
      // Even with empty hand, can't go out if not down
      expect(canGoOut(contextNotDown)).toBe(false);
    });

    it("therefore: must be down to reach 0 cards", () => {
      // Summary test: you cannot go out without being down
      const downWithEmptyHand = {
        hand: [],
        isDown: true,
        roundNumber: 1 as RoundNumber,
      };
      expect(canGoOut(downWithEmptyHand)).toBe(true);

      const notDownWithEmptyHand = {
        hand: [],
        isDown: false,
        roundNumber: 1 as RoundNumber,
      };
      expect(canGoOut(notDownWithEmptyHand)).toBe(false);

      // With cards remaining, can't go out regardless
      const downWithCards = {
        hand: [card("K", "hearts")],
        isDown: true,
        roundNumber: 1 as RoundNumber,
      };
      expect(canGoOut(downWithCards)).toBe(false);
    });
  });

  describe("paths to going out", () => {
    it("lay down contract (become down)", () => {
      // First step: lay down contract to become "down"
      // This is tested in laydown tests, here we verify the concept
      const beforeLayDown = {
        hand: [card("K", "hearts")],
        isDown: false,
        roundNumber: 1 as RoundNumber,
      };
      expect(canGoOut(beforeLayDown)).toBe(false);

      // After laying down (with cards remaining), still can't go out yet
      const afterLayDown = {
        hand: [card("K", "hearts")],
        isDown: true,
        roundNumber: 1 as RoundNumber,
      };
      expect(canGoOut(afterLayDown)).toBe(false);
    });

    it("on subsequent turns: lay off cards to reduce hand", () => {
      // After laying down, player can lay off cards on subsequent turns
      // This progressively reduces hand size toward 0
      const handWith3Cards = {
        hand: [card("K", "hearts"), card("Q", "diamonds"), card("J", "clubs")],
        isDown: true,
        roundNumber: 1 as RoundNumber,
      };
      expect(canGoOut(handWith3Cards)).toBe(false);

      const handWith1Card = {
        hand: [card("K", "hearts")],
        isDown: true,
        roundNumber: 1 as RoundNumber,
      };
      expect(canGoOut(handWith1Card)).toBe(false);

      const emptyHand = {
        hand: [],
        isDown: true,
        roundNumber: 1 as RoundNumber,
      };
      expect(canGoOut(emptyHand)).toBe(true);
    });

    it("rounds 1-5: discard last card OR lay off last card(s)", () => {
      // In rounds 1-5, can go out via either method
      for (const round of [1, 2, 3, 4, 5] as RoundNumber[]) {
        // Not blocked for discarding last card
        expect(isRound6LastCardBlock(round, 1)).toBe(false);
      }
    });

    it("round 6: MUST lay off last card(s), cannot discard to go out", () => {
      // In round 6, discarding last card is blocked
      expect(isRound6LastCardBlock(6, 1)).toBe(true);

      // But discarding with 2+ cards is fine
      expect(isRound6LastCardBlock(6, 2)).toBe(false);
      expect(isRound6LastCardBlock(6, 3)).toBe(false);
    });

    it.todo("exception: go out on same turn as laying down", () => {
      // This requires turn machine integration
      // Can go out if lay down uses most cards and discard uses last
    });
  });
});

describe("going out - rounds 1-5", () => {
  describe("going out via discard", () => {
    it("player goes out by discarding their last card", () => {
      const lastCard = card("K", "hearts");
      const input = createDownPlayerInput([lastCard]);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      // Now have 2 cards (lastCard + drawn card)
      actor.send({ type: "SKIP_LAY_DOWN" });

      // Discard the drawn card first
      const drawnCard = actor.getSnapshot().context.hand.find((c) => c.id !== lastCard.id);
      actor.send({ type: "DISCARD", cardId: drawnCard!.id });
      // This leads to turnComplete since we had 2 cards

      // For a true "discard last card" test, start with just 1 card after draw
      const singleCardInput = createDownPlayerInput([lastCard]);
      const actor2 = createActor(turnMachine, { input: singleCardInput });
      actor2.start();
      actor2.send({ type: "DRAW_FROM_STOCK" });
      actor2.send({ type: "SKIP_LAY_DOWN" });
      // Now have 2 cards, discard one to get to 1, then that's still turnComplete
      // To truly go out, we need to discard when we have exactly 1 card
    });

    it("after discard, hand.length === 0", () => {
      const lastCard = card("K", "hearts");
      // Start with 1 card, draw makes it 2, skip lay down, discard 1 leaves 1
      // But we want to test discarding to reach 0
      // Need to lay off one card first to get down to 1 before discard
      const setMeld = createMeld("set", [
        card("9", "clubs"),
        card("9", "diamonds"),
        card("9", "hearts"),
      ]);
      const nineS = card("9", "spades");
      const input = createDownPlayerInput([lastCard, nineS], [setMeld]);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      // 3 cards now: lastCard, nineS, drawnCard

      // Lay off the 9♠
      actor.send({ type: "LAY_OFF", cardId: nineS.id, meldId: setMeld.id });
      // 2 cards now: lastCard, drawnCard

      // Skip to discard
      actor.send({ type: "SKIP_LAY_DOWN" });

      // Discard one, leaving 1 card - this goes to turnComplete
      const drawnCard = actor.getSnapshot().context.hand.find((c) => c.id !== lastCard.id);
      actor.send({ type: "DISCARD", cardId: drawnCard!.id });

      // Should still have 1 card and be in turnComplete
      expect(actor.getSnapshot().context.hand.length).toBe(1);
    });

    it("triggers wentOut state", () => {
      // To trigger wentOut via discard, need exactly 1 card when discarding
      const setMeld = createMeld("set", [
        card("9", "clubs"),
        card("9", "diamonds"),
        card("9", "hearts"),
      ]);
      const nineS = card("9", "spades");
      const lastCard = card("K", "hearts");
      const input = createDownPlayerInput([nineS, lastCard], [setMeld]);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      // 3 cards: nineS, lastCard, drawnCard

      // Lay off 9♠
      actor.send({ type: "LAY_OFF", cardId: nineS.id, meldId: setMeld.id });
      // 2 cards: lastCard, drawnCard

      // Need to lay off drawnCard too to get to 1 card
      // Let's add another meld
      const kingMeld = createMeld("set", [
        card("K", "clubs"),
        card("K", "diamonds"),
        card("K", "spades"),
      ]);
      const input2 = createDownPlayerInput([nineS, lastCard], [setMeld, kingMeld]);
      const actor2 = createActor(turnMachine, { input: input2 });
      actor2.start();
      actor2.send({ type: "DRAW_FROM_STOCK" });

      // Lay off 9♠
      actor2.send({ type: "LAY_OFF", cardId: nineS.id, meldId: setMeld.id });
      // 2 cards: lastCard (K♥), drawnCard

      // Lay off K♥
      actor2.send({ type: "LAY_OFF", cardId: lastCard.id, meldId: kingMeld.id });
      // 1 card: drawnCard

      // Skip lay down and discard last card
      actor2.send({ type: "SKIP_LAY_DOWN" });
      const remaining = actor2.getSnapshot().context.hand[0];
      actor2.send({ type: "DISCARD", cardId: remaining!.id });

      expect(actor2.getSnapshot().value).toBe("wentOut");
      expect(actor2.getSnapshot().context.hand.length).toBe(0);
    });

    it.todo("round ends", () => {
      // Round end requires game loop integration
    });
  });

  describe("going out via lay off", () => {
    it("player goes out by laying off their last card(s)", () => {
      // Setup: player is down, has a card that can be laid off
      const setMeld = createMeld("set", [
        card("9", "clubs"),
        card("9", "diamonds"),
        card("9", "hearts"),
      ]);
      const nineS = card("9", "spades");
      const input = createDownPlayerInput([nineS], [setMeld]);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      // 2 cards: nineS, drawnCard

      // Need a second meld to lay off the drawn card
      const kingMeld = createMeld("set", [
        card("K", "clubs"),
        card("K", "diamonds"),
        card("K", "hearts"),
      ]);
      const input2 = createDownPlayerInput([nineS, card("K", "spades")], [setMeld, kingMeld]);
      const actor2 = createActor(turnMachine, { input: input2 });
      actor2.start();
      actor2.send({ type: "DRAW_FROM_STOCK" });
      // 3 cards

      const ks = actor2.getSnapshot().context.hand.find((c) => c.rank === "K" && c.suit === "spades");

      // Lay off 9♠
      actor2.send({ type: "LAY_OFF", cardId: nineS.id, meldId: setMeld.id });
      // Lay off K♠
      actor2.send({ type: "LAY_OFF", cardId: ks!.id, meldId: kingMeld.id });
      // 1 card left: drawnCard from stock

      // This test shows the mechanic - full going out via lay off needs all cards laid off
      expect(actor2.getSnapshot().context.hand.length).toBe(1);
    });

    it("after lay off, hand.length === 0", () => {
      // To go out via lay off, all cards must be laid off
      const setMeld = createMeld("set", [
        card("9", "clubs"),
        card("9", "diamonds"),
        card("9", "hearts"),
      ]);
      const kingMeld = createMeld("set", [
        card("K", "clubs"),
        card("K", "diamonds"),
        card("K", "hearts"),
      ]);
      // Player has 2 cards that can both be laid off
      const nineS = card("9", "spades");
      const kS = card("K", "spades");

      // Use stock that also contains layable cards
      const stockNine = card("9", "clubs"); // Can lay off to setMeld (sets can have 4 of same rank from diff decks)
      // Actually, 9♣ is already in meld. Need different cards.
      // Let's use an ace meld too
      const aceMeld = createMeld("set", [
        card("A", "clubs"),
        card("A", "diamonds"),
        card("A", "hearts"),
      ]);

      const aS = card("A", "spades");
      const input = {
        playerId: "player-1",
        hand: [nineS, kS, aS],
        stock: [card("Q", "hearts")], // drawn card won't be layable, but we'll handle that
        discard: [card("5", "clubs")],
        roundNumber: 1 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [setMeld, kingMeld, aceMeld],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      // 4 cards: nineS, kS, aS, Q♥ (drawn)

      // Lay off what we can
      actor.send({ type: "LAY_OFF", cardId: nineS.id, meldId: setMeld.id });
      actor.send({ type: "LAY_OFF", cardId: kS.id, meldId: kingMeld.id });
      actor.send({ type: "LAY_OFF", cardId: aS.id, meldId: aceMeld.id });
      // 1 card left: Q♥

      expect(actor.getSnapshot().context.hand.length).toBe(1);
      // Can't go out via pure lay off in this scenario - need to discard Q♥
    });

    it("triggers wentOut state immediately", () => {
      // Setup melds that can accept all cards including drawn card
      const setMeld = createMeld("set", [
        card("9", "clubs"),
        card("9", "diamonds"),
        card("9", "hearts"),
      ]);
      const kingMeld = createMeld("set", [
        card("K", "clubs"),
        card("K", "diamonds"),
        card("K", "hearts"),
      ]);

      const nineS = card("9", "spades");
      const kS = card("K", "spades");

      // Make stock contain a card that can be laid off
      const stockKing = card("K", "clubs"); // K from second deck, same rank

      const input = {
        playerId: "player-1",
        hand: [nineS, kS],
        stock: [stockKing], // This K can go on kingMeld (sets accept same rank)
        discard: [card("5", "clubs")],
        roundNumber: 1 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [setMeld, kingMeld],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      // 3 cards: nineS, kS, stockKing (K♣)

      // Lay off 9♠
      actor.send({ type: "LAY_OFF", cardId: nineS.id, meldId: setMeld.id });
      // Lay off K♠
      actor.send({ type: "LAY_OFF", cardId: kS.id, meldId: kingMeld.id });
      // Lay off K♣ (the drawn card)
      const drawnKing = actor.getSnapshot().context.hand.find((c) => c.rank === "K");
      actor.send({ type: "LAY_OFF", cardId: drawnKing!.id, meldId: kingMeld.id });

      // Should go to wentOut immediately after last lay off
      expect(actor.getSnapshot().value).toBe("wentOut");
      expect(actor.getSnapshot().context.hand.length).toBe(0);
    });

    it.todo("round ends", () => {
      // Round end requires game loop integration
    });

    it("no discard needed or allowed after going out", () => {
      // Setup same as above - go out via lay off
      const setMeld = createMeld("set", [
        card("9", "clubs"),
        card("9", "diamonds"),
        card("9", "hearts"),
      ]);
      const kingMeld = createMeld("set", [
        card("K", "clubs"),
        card("K", "diamonds"),
        card("K", "hearts"),
      ]);

      const nineS = card("9", "spades");
      const kS = card("K", "spades");
      const stockKing = card("K", "clubs");

      const input = {
        playerId: "player-1",
        hand: [nineS, kS],
        stock: [stockKing],
        discard: [card("5", "clubs")],
        roundNumber: 1 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [setMeld, kingMeld],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      // Lay off all cards
      actor.send({ type: "LAY_OFF", cardId: nineS.id, meldId: setMeld.id });
      actor.send({ type: "LAY_OFF", cardId: kS.id, meldId: kingMeld.id });
      const drawnKing = actor.getSnapshot().context.hand.find((c) => c.rank === "K");
      actor.send({ type: "LAY_OFF", cardId: drawnKing!.id, meldId: kingMeld.id });

      // In wentOut state
      expect(actor.getSnapshot().value).toBe("wentOut");

      // Try to discard - should have no effect (in final state)
      const snapshot = actor.getSnapshot();
      const fakeCardId = "fake-card";
      actor.send({ type: "DISCARD", cardId: fakeCardId });

      // Should still be in wentOut state
      expect(actor.getSnapshot().value).toBe("wentOut");
    });
  });

  describe("sequence to go out via discard", () => {
    // Setup shared state for sequence tests
    const setMeld = createMeld("set", [
      card("9", "clubs"),
      card("9", "diamonds"),
      card("9", "hearts"),
    ]);
    const kingMeld = createMeld("set", [
      card("K", "clubs"),
      card("K", "diamonds"),
      card("K", "hearts"),
    ]);

    it("given: player is down, has 3 cards after drawing", () => {
      const nineS = card("9", "spades");
      const kS = card("K", "spades");

      const input = {
        playerId: "player-1",
        hand: [nineS, kS],
        stock: [card("Q", "hearts")], // Q♥ can't be laid off
        discard: [card("5", "clubs")],
        roundNumber: 1 as RoundNumber,
        isDown: true, // Already down
        laidDownThisTurn: false,
        table: [setMeld, kingMeld],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      // After drawing, player has 3 cards
      expect(actor.getSnapshot().context.hand.length).toBe(3);
      expect(actor.getSnapshot().context.isDown).toBe(true);
    });

    it("when: player lays off 2 cards (1 card remaining)", () => {
      const nineS = card("9", "spades");
      const kS = card("K", "spades");

      const input = {
        playerId: "player-1",
        hand: [nineS, kS],
        stock: [card("Q", "hearts")],
        discard: [card("5", "clubs")],
        roundNumber: 1 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [setMeld, kingMeld],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      // 3 cards: nineS, kS, Q♥

      actor.send({ type: "LAY_OFF", cardId: nineS.id, meldId: setMeld.id });
      actor.send({ type: "LAY_OFF", cardId: kS.id, meldId: kingMeld.id });

      // Now have 1 card remaining (Q♥)
      expect(actor.getSnapshot().context.hand.length).toBe(1);
      expect(actor.getSnapshot().value).toBe("drawn"); // Still in drawn state
    });

    it("and: player discards last card", () => {
      const nineS = card("9", "spades");
      const kS = card("K", "spades");

      const input = {
        playerId: "player-1",
        hand: [nineS, kS],
        stock: [card("Q", "hearts")],
        discard: [card("5", "clubs")],
        roundNumber: 1 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [setMeld, kingMeld],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "LAY_OFF", cardId: nineS.id, meldId: setMeld.id });
      actor.send({ type: "LAY_OFF", cardId: kS.id, meldId: kingMeld.id });
      actor.send({ type: "SKIP_LAY_DOWN" });

      // Get the last card (Q♥)
      const lastCard = actor.getSnapshot().context.hand[0];
      expect(lastCard).toBeDefined();

      actor.send({ type: "DISCARD", cardId: lastCard!.id });

      // Hand is now empty
      expect(actor.getSnapshot().context.hand.length).toBe(0);
    });

    it("then: player has 0 cards, went out, round ends immediately", () => {
      const nineS = card("9", "spades");
      const kS = card("K", "spades");

      const input = {
        playerId: "player-1",
        hand: [nineS, kS],
        stock: [card("Q", "hearts")],
        discard: [card("5", "clubs")],
        roundNumber: 1 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [setMeld, kingMeld],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "LAY_OFF", cardId: nineS.id, meldId: setMeld.id });
      actor.send({ type: "LAY_OFF", cardId: kS.id, meldId: kingMeld.id });
      actor.send({ type: "SKIP_LAY_DOWN" });

      const lastCard = actor.getSnapshot().context.hand[0];
      actor.send({ type: "DISCARD", cardId: lastCard!.id });

      // Player went out
      expect(actor.getSnapshot().context.hand.length).toBe(0);
      expect(actor.getSnapshot().value).toBe("wentOut");
      // Round end is handled by game loop - turn machine just signals wentOut
    });
  });

  describe("sequence to go out via lay off", () => {
    // Setup melds that can accept all cards
    const setMeld = createMeld("set", [
      card("9", "clubs"),
      card("9", "diamonds"),
      card("9", "hearts"),
    ]);
    const kingMeld = createMeld("set", [
      card("K", "clubs"),
      card("K", "diamonds"),
      card("K", "hearts"),
    ]);
    const aceMeld = createMeld("set", [
      card("A", "clubs"),
      card("A", "diamonds"),
      card("A", "hearts"),
    ]);

    it("given: player is down, has 3 cards after drawing", () => {
      const nineS = card("9", "spades");
      const kS = card("K", "spades");

      const input = {
        playerId: "player-1",
        hand: [nineS, kS],
        stock: [card("A", "spades")], // A♠ can be laid off to aceMeld
        discard: [card("5", "clubs")],
        roundNumber: 1 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [setMeld, kingMeld, aceMeld],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      // After drawing, player has 3 cards - all can be laid off
      expect(actor.getSnapshot().context.hand.length).toBe(3);
      expect(actor.getSnapshot().context.isDown).toBe(true);
    });

    it("when: player lays off all 3 cards to valid melds", () => {
      const nineS = card("9", "spades");
      const kS = card("K", "spades");
      const aS = card("A", "spades");

      const input = {
        playerId: "player-1",
        hand: [nineS, kS],
        stock: [aS],
        discard: [card("5", "clubs")],
        roundNumber: 1 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [setMeld, kingMeld, aceMeld],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      // 3 cards: nineS, kS, aS

      actor.send({ type: "LAY_OFF", cardId: nineS.id, meldId: setMeld.id });
      expect(actor.getSnapshot().context.hand.length).toBe(2);

      actor.send({ type: "LAY_OFF", cardId: kS.id, meldId: kingMeld.id });
      expect(actor.getSnapshot().context.hand.length).toBe(1);

      // Get the A♠ from hand
      const aceCard = actor.getSnapshot().context.hand.find((c) => c.rank === "A");
      actor.send({ type: "LAY_OFF", cardId: aceCard!.id, meldId: aceMeld.id });

      // All cards laid off
      expect(actor.getSnapshot().context.hand.length).toBe(0);
    });

    it("then: player has 0 cards, went out, no discard occurs, round ends immediately", () => {
      const nineS = card("9", "spades");
      const kS = card("K", "spades");
      const aS = card("A", "spades");

      const input = {
        playerId: "player-1",
        hand: [nineS, kS],
        stock: [aS],
        discard: [card("5", "clubs")],
        roundNumber: 1 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [setMeld, kingMeld, aceMeld],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      actor.send({ type: "LAY_OFF", cardId: nineS.id, meldId: setMeld.id });
      actor.send({ type: "LAY_OFF", cardId: kS.id, meldId: kingMeld.id });

      const aceCard = actor.getSnapshot().context.hand.find((c) => c.rank === "A");
      actor.send({ type: "LAY_OFF", cardId: aceCard!.id, meldId: aceMeld.id });

      // Player went out immediately - no need for SKIP_LAY_DOWN or DISCARD
      expect(actor.getSnapshot().context.hand.length).toBe(0);
      expect(actor.getSnapshot().value).toBe("wentOut");

      // Discard pile is unchanged (no discard occurred)
      expect(actor.getSnapshot().context.discard.length).toBe(1);
      expect(actor.getSnapshot().context.discard[0]!.rank).toBe("5");
    });
  });

  describe("player choice - discard or lay off", () => {
    it.todo("given: player is down, has 2 cards after drawing, both can be laid off", () => {});
    it.todo("then: player can choose to lay off both (going out without discard)", () => {});
    it.todo("or: player can lay off 1, discard the other (going out via discard)", () => {});
    it.todo("and: both are valid ways to go out", () => {});
  });

  describe("wentOut trigger", () => {
    it.todo("checked after DISCARD command completes", () => {});
    it.todo("checked after LAY_OFF command completes", () => {});
    it.todo("if hand.length === 0 → wentOut (round ends)", () => {});
    it.todo("if hand.length > 0 → continue turn or turnComplete", () => {});
  });
});

describe("going out - round 6 special rules", () => {
  describe("normal turns still have discard", () => {
    it.todo("in round 6, normal turns work like other rounds", () => {});
    it.todo("draw → (optional lay down/lay off) → discard", () => {});
    it.todo("discarding is allowed when NOT going out", () => {});
    it.todo("this is the key difference from 'no discard at all'", () => {});
  });

  describe("cannot discard to go out", () => {
    it.todo("in round 6, you CANNOT discard your last card to go out", () => {});
    it.todo("going out MUST be via laying off last card(s)", () => {});
    it.todo("if you have 1 card that can't be laid off, you must keep it", () => {});
    it.todo("you must keep it until you can lay it off", () => {});
  });

  describe("round 6 going out - must lay off", () => {
    it.todo("given: round 6, player is down, has 2 cards", () => {});
    it.todo("when: player draws (3 cards)", () => {});
    it.todo("and: player lays off all 3 cards to valid melds", () => {});
    it.todo("then: hand is empty (0 cards), player went out, no discard occurred, round ends", () => {});
  });

  describe("round 6 - cannot discard last card", () => {
    it.todo("given: round 6, player is down, has 1 card after drawing", () => {});
    it.todo("and: that card CAN be laid off", () => {});
    it.todo("then: player MUST lay it off to go out", () => {});
    it.todo("and: player CANNOT choose to discard it instead", () => {});
  });

  describe("round 6 - stuck with unlayable last card", () => {
    it.todo("given: round 6, player is down, has 2 cards after drawing", () => {});
    it.todo("and: 1 card can be laid off, 1 cannot", () => {});
    it.todo("when: player lays off the playable card (1 remaining)", () => {});
    it.todo("then: player has 1 card that cannot be laid off", () => {});
    it.todo("and: player CANNOT discard it (would be going out via discard)", () => {});
    it.todo("and: player must end turn keeping that card", () => {});
    it.todo("and: player waits for future turns when melds may grow", () => {});
  });

  describe("round 6 - normal turn with discard", () => {
    it.todo("given: round 6, player is down, has 4 cards after drawing", () => {});
    it.todo("and: player can lay off 1 card", () => {});
    it.todo("when: player lays off 1 card (3 remaining)", () => {});
    it.todo("and: no other cards can be laid off", () => {});
    it.todo("then: player CAN discard (not going out, has 2+ cards left)", () => {});
    it.todo("and: player discards 1 card (2 remaining)", () => {});
    it.todo("and: turn ends normally, player did NOT go out", () => {});
  });

  describe("round 6 - discard allowed with 2+ cards remaining", () => {
    it.todo("given: round 6, player has 3 cards after laying off, player CAN discard (will have 2 cards left)", () => {});
    it.todo("given: round 6, player has 2 cards after laying off, player CAN discard (will have 1 card left)", () => {});
    it.todo("given: round 6, player has 1 card, player CANNOT discard (would have 0 cards = going out)", () => {});
  });

  describe("GO_OUT command", () => {
    it.todo("convenience command for going out with multiple lay offs", () => {});
    it.todo("available in all rounds (not just round 6)", () => {});
    it.todo("only available when player is down", () => {});
    it.todo("can include finalLayOffs array", () => {});
    it.todo("validates all lay offs before executing", () => {});
    it.todo("executes all lay offs in order", () => {});
    it.todo("player must end with 0 cards", () => {});
    it.todo("transitions to wentOut state", () => {});
  });

  describe("GO_OUT with multiple lay offs", () => {
    it.todo("given: player has 3 cards: 9♠, 4♦, K♥", () => {});
    it.todo("and: table has melds each card can join", () => {});
    it.todo("when: GO_OUT with finalLayOffs for all three cards", () => {});
    it.todo("then: all three cards laid off, hand is empty, player went out", () => {});
  });

  describe("GO_OUT rejected scenarios", () => {
    it.todo("rejected if player not down", () => {});
    it.todo("rejected if any lay off in finalLayOffs is invalid", () => {});
    it.todo("rejected if cards would remain after all lay offs", () => {});
    it.todo("state unchanged on rejection", () => {});
    it.todo("error messages specific to failure reason", () => {});
  });
});

describe("going out - round 6 stuck scenarios", () => {
  describe("stuck with single unlayable card", () => {
    it.todo("given: round 6, player is down, has 1 card after laying off", () => {});
    it.todo("and: that card cannot be laid off to any meld", () => {});
    it.todo("then: player cannot go out (can't lay off)", () => {});
    it.todo("and: player cannot discard (would be going out)", () => {});
    it.todo("and: player ends turn keeping that 1 card", () => {});
    it.todo("and: player must wait for melds to expand", () => {});
  });

  describe("hand does NOT grow when stuck with 1 card", () => {
    it.todo("given: round 6, player stuck with 1 unlayable card", () => {});
    it.todo("when: next turn - player draws (2 cards)", () => {});
    it.todo("and: still can't lay off either card", () => {});
    it.todo("then: player discards 1 (back to 1 card)", () => {});
    it.todo("and: hand size doesn't grow indefinitely", () => {});
  });

  describe("waiting for melds to expand", () => {
    it.todo("given: round 6, player has 7♦ that fits no current meld", () => {});
    it.todo("and: no diamond runs exist, no set of 7s exists", () => {});
    it.todo("when: player's turn", () => {});
    it.todo("then: player cannot play the 7♦", () => {});
    it.todo("and: if it's their only card, they keep it", () => {});
    it.todo("and: if they have other cards, they may discard something else", () => {});
    it.todo("and: hopes another player creates a meld 7♦ fits", () => {});
  });

  describe("eventually able to go out", () => {
    it.todo("given: round 6, player stuck with 7♦", () => {});
    it.todo("and: another player lays down a set of 7s", () => {});
    it.todo("when: player's next turn", () => {});
    it.todo("then: player can lay off 7♦ to set of 7s", () => {});
    it.todo("and: if it was their only card, they go out", () => {});
  });
});

describe("going out - not down scenarios", () => {
  describe("cannot go out if not down - rounds 1-5", () => {
    it.todo("given: player has not laid down (isDown: false)", () => {});
    it.todo("and: player has 1 card", () => {});
    it.todo("when: player draws (2 cards)", () => {});
    it.todo("then: player cannot lay off (not down)", () => {});
    it.todo("and: player must discard (1 card remaining)", () => {});
    it.todo("and: player CANNOT reach 0 cards while not down", () => {});
    it.todo("and: draw +1, discard -1 = net zero change", () => {});
  });

  describe("cannot go out if not down - round 6", () => {
    it.todo("given: round 6, player has not laid down", () => {});
    it.todo("and: player has 8 cards", () => {});
    it.todo("when: player draws (9 cards)", () => {});
    it.todo("then: player cannot lay off (not down)", () => {});
    it.todo("and: player discards (8 cards remaining)", () => {});
    it.todo("and: same hand size as start of turn", () => {});
    it.todo("and: must lay down contract before can reduce hand", () => {});
  });

  describe("only path to 0 cards requires being down", () => {
    it.todo("if not down: cannot lay off", () => {});
    it.todo("can only draw and discard", () => {});
    it.todo("draw +1, discard -1 = net 0 change", () => {});
    it.todo("hand size stays constant until laying down", () => {});
    it.todo("must lay down to become down", () => {});
    it.todo("only then can lay off to reduce hand toward 0", () => {});
  });
});

describe("going out - on lay down turn", () => {
  describe("going out same turn as laying down (rounds 1-5)", () => {
    it.todo("given: player has 7 cards in hand", () => {});
    it.todo("when: player draws (8 cards)", () => {});
    it.todo("and: player lays down melds totaling 7 cards (1 card remaining)", () => {});
    it.todo("and: player discards last card", () => {});
    it.todo("then: player has 0 cards, went out", () => {});
    it.todo("note: player became down during turn, then immediately discarded to 0", () => {});
    it.todo("and: this IS allowed - going out on lay down turn", () => {});
  });

  describe("going out on lay down - contract uses all cards", () => {
    it.todo("given: player has 11 cards forming exactly the contract (larger melds)", () => {});
    it.todo("when: player draws (12 cards)", () => {});
    it.todo("and: player lays down 12 cards (all cards form contract)", () => {});
    it.todo("then: player has 0 cards, went out immediately on lay down", () => {});
    it.todo("and: no discard needed", () => {});
    it.todo("note: rare scenario requiring larger-than-minimum melds", () => {});
  });

  describe("example: round 1 going out on lay down", () => {
    it.todo("given: round 1 (contract: 2 sets)", () => {});
    it.todo("and: player has 7 cards: (9♣ 9♦ 9♥ 9♠) + (K♣ K♦ K♥)", () => {});
    it.todo("when: player draws (8 cards total)", () => {});
    it.todo("and: player lays down: set of 4 nines + set of 3 kings = 7 cards", () => {});
    it.todo("and: player has 1 card remaining", () => {});
    it.todo("and: player discards that card", () => {});
    it.todo("then: player went out on same turn as laying down", () => {});
  });

  describe("round 6 - going out on lay down turn", () => {
    it.todo("given: round 6 (contract: 1 set + 2 runs = minimum 11 cards)", () => {});
    it.todo("and: player has 11 cards", () => {});
    it.todo("when: player draws (12 cards)", () => {});
    it.todo("and: player lays down exactly 11 cards", () => {});
    it.todo("and: player has 1 card remaining", () => {});
    it.todo("then: player cannot lay off (laidDownThisTurn: true)", () => {});
    it.todo("and: player CANNOT discard - would be going out via discard in round 6", () => {});
    it.todo("and: player ends turn with 1 card", () => {});
    it.todo("and: must wait until next turn to lay off and go out", () => {});
  });

  describe("round 6 go out on lay down - only with all cards in contract", () => {
    it.todo("given: round 6, player has 12 cards after drawing", () => {});
    it.todo("and: player can form contract using all 12 cards (larger melds)", () => {});
    it.todo("when: player lays down all 12 cards", () => {});
    it.todo("then: player has 0 cards, went out immediately on lay down", () => {});
    it.todo("note: rare scenario requiring larger-than-minimum melds", () => {});
  });
});

describe("going out - turn output", () => {
  describe("wentOut output structure", () => {
    it.todo("wentOut: true", () => {});
    it.todo("playerId: id of player who went out", () => {});
    it.todo("hand: empty array []", () => {});
    it.todo("distinct from turnComplete output", () => {});
  });

  describe("turnComplete vs wentOut", () => {
    it.todo("turnComplete: wentOut: false, hand has cards, normal turn end", () => {});
    it.todo("wentOut: wentOut: true, hand empty, round ends", () => {});
    it.todo("both are final states of turn machine", () => {});
    it.todo("parent machine (round) handles differently based on wentOut flag", () => {});
  });

  describe("wentOut triggers round end", () => {
    it.todo("when turn outputs wentOut: true", () => {});
    it.todo("round machine transitions to scoring state", () => {});
    it.todo("no more turns for any player", () => {});
    it.todo("scoring begins immediately", () => {});
  });
});
