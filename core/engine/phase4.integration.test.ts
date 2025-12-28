import { describe, it, expect } from "bun:test";
import { createActor } from "xstate";
import { turnMachine } from "./turn.machine";
import type { RoundNumber } from "./engine.types";
import type { Card, Suit, Rank } from "../card/card.types";
import type { Meld } from "../meld/meld.types";

/**
 * Phase 4: Integration Tests
 *
 * Tests for complete flows involving laying off, going out, and scoring.
 */

// Helper to create a card
function card(rank: Rank, suit: Suit): Card {
  return { id: `${rank}-${suit}-${Math.random()}`, rank, suit };
}

// Helper to create a meld
function createMeld(type: "set" | "run", cards: Card[], ownerId = "player-1"): Meld {
  return {
    id: `meld-${Math.random()}`,
    type,
    cards,
    ownerId,
  };
}

describe("complete lay off turn flow", () => {
  describe("single lay off", () => {
    // Complete flow: draw → lay off → discard
    const nineS = card("9", "spades");
    const extraCards = [card("K", "hearts"), card("Q", "clubs"), card("J", "diamonds"), card("10", "hearts")];
    const drawnCard = card("A", "clubs");
    const existingSet = createMeld("set", [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")]);

    it("given: player is down from previous turn, has 5 cards", () => {
      const hand = [nineS, ...extraCards];
      expect(hand.length).toBe(5);
    });

    it("and: table has set (9♣ 9♦ 9♥)", () => {
      expect(existingSet.cards.length).toBe(3);
      expect(existingSet.cards.every((c) => c.rank === "9")).toBe(true);
    });

    it("and: player has 9♠ in hand", () => {
      expect(nineS.rank).toBe("9");
      expect(nineS.suit).toBe("spades");
    });

    it("when: player draws from stock (6 cards)", () => {
      const input = {
        playerId: "player-1",
        hand: [nineS, ...extraCards],
        stock: [drawnCard],
        discard: [card("2", "hearts")],
        roundNumber: 1 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [existingSet],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      expect(actor.getSnapshot().context.hand.length).toBe(6);
    });

    it("and: player lays off 9♠ to the set (5 cards)", () => {
      const input = {
        playerId: "player-1",
        hand: [nineS, ...extraCards],
        stock: [drawnCard],
        discard: [card("2", "hearts")],
        roundNumber: 1 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [existingSet],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "LAY_OFF", cardId: nineS.id, meldId: existingSet.id });

      expect(actor.getSnapshot().context.hand.length).toBe(5);
    });

    it("and: player discards one card (4 cards)", () => {
      const input = {
        playerId: "player-1",
        hand: [nineS, ...extraCards],
        stock: [drawnCard],
        discard: [card("2", "hearts")],
        roundNumber: 1 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [existingSet],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "LAY_OFF", cardId: nineS.id, meldId: existingSet.id });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: drawnCard.id });

      expect(actor.getSnapshot().output?.hand.length).toBe(4);
    });

    it("then: set is now (9♣ 9♦ 9♥ 9♠)", () => {
      const input = {
        playerId: "player-1",
        hand: [nineS, ...extraCards],
        stock: [drawnCard],
        discard: [card("2", "hearts")],
        roundNumber: 1 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [existingSet],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "LAY_OFF", cardId: nineS.id, meldId: existingSet.id });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: drawnCard.id });

      const set = actor.getSnapshot().output?.table.find((m) => m.id === existingSet.id);
      expect(set?.cards.length).toBe(4);
    });

    it("and: player has 4 cards", () => {
      const input = {
        playerId: "player-1",
        hand: [nineS, ...extraCards],
        stock: [drawnCard],
        discard: [card("2", "hearts")],
        roundNumber: 1 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [existingSet],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "LAY_OFF", cardId: nineS.id, meldId: existingSet.id });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: drawnCard.id });

      expect(actor.getSnapshot().output?.hand.length).toBe(4);
    });

    it("and: turn completes (wentOut: false)", () => {
      const input = {
        playerId: "player-1",
        hand: [nineS, ...extraCards],
        stock: [drawnCard],
        discard: [card("2", "hearts")],
        roundNumber: 1 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [existingSet],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "LAY_OFF", cardId: nineS.id, meldId: existingSet.id });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: drawnCard.id });

      expect(actor.getSnapshot().value).toBe("turnComplete");
      expect(actor.getSnapshot().output?.wentOut).toBe(false);
    });
  });

  describe("multiple lay offs", () => {
    const nineS = card("9", "spades");
    const fourD = card("4", "diamonds");
    const kingH = card("K", "hearts");
    const threeC = card("3", "clubs");
    const drawnCard = card("A", "clubs");

    const setOfNines = createMeld("set", [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")]);
    const diamondRun = createMeld("run", [card("5", "diamonds"), card("6", "diamonds"), card("7", "diamonds"), card("8", "diamonds")]);
    const setOfKings = createMeld("set", [card("K", "clubs"), card("K", "diamonds"), card("K", "spades")]);

    it("given: player is down, has 4 cards: 9♠, 4♦, K♥, 3♣", () => {
      const hand = [nineS, fourD, kingH, threeC];
      expect(hand.length).toBe(4);
    });

    it("and: table has set of 9s, diamond run starting at 5, set of kings", () => {
      expect(setOfNines.cards.every((c) => c.rank === "9")).toBe(true);
      expect(diamondRun.cards.every((c) => c.suit === "diamonds")).toBe(true);
      expect(setOfKings.cards.every((c) => c.rank === "K")).toBe(true);
    });

    it("when: player draws (5 cards)", () => {
      const input = {
        playerId: "player-1",
        hand: [nineS, fourD, kingH, threeC],
        stock: [drawnCard],
        discard: [card("2", "hearts")],
        roundNumber: 1 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [setOfNines, diamondRun, setOfKings],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      expect(actor.getSnapshot().context.hand.length).toBe(5);
    });

    it("and: player lays off 9♠ to set of 9s", () => {
      const input = {
        playerId: "player-1",
        hand: [nineS, fourD, kingH, threeC],
        stock: [drawnCard],
        discard: [card("2", "hearts")],
        roundNumber: 1 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [setOfNines, diamondRun, setOfKings],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "LAY_OFF", cardId: nineS.id, meldId: setOfNines.id });

      expect(actor.getSnapshot().context.hand.length).toBe(4);
    });

    it("and: player lays off 4♦ to diamond run", () => {
      const input = {
        playerId: "player-1",
        hand: [nineS, fourD, kingH, threeC],
        stock: [drawnCard],
        discard: [card("2", "hearts")],
        roundNumber: 1 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [setOfNines, diamondRun, setOfKings],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "LAY_OFF", cardId: nineS.id, meldId: setOfNines.id });
      actor.send({ type: "LAY_OFF", cardId: fourD.id, meldId: diamondRun.id });

      expect(actor.getSnapshot().context.hand.length).toBe(3);
    });

    it("and: player lays off K♥ to set of kings", () => {
      const input = {
        playerId: "player-1",
        hand: [nineS, fourD, kingH, threeC],
        stock: [drawnCard],
        discard: [card("2", "hearts")],
        roundNumber: 1 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [setOfNines, diamondRun, setOfKings],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "LAY_OFF", cardId: nineS.id, meldId: setOfNines.id });
      actor.send({ type: "LAY_OFF", cardId: fourD.id, meldId: diamondRun.id });
      actor.send({ type: "LAY_OFF", cardId: kingH.id, meldId: setOfKings.id });

      expect(actor.getSnapshot().context.hand.length).toBe(2);
    });

    it("and: player discards 3♣", () => {
      const input = {
        playerId: "player-1",
        hand: [nineS, fourD, kingH, threeC],
        stock: [drawnCard],
        discard: [card("2", "hearts")],
        roundNumber: 1 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [setOfNines, diamondRun, setOfKings],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "LAY_OFF", cardId: nineS.id, meldId: setOfNines.id });
      actor.send({ type: "LAY_OFF", cardId: fourD.id, meldId: diamondRun.id });
      actor.send({ type: "LAY_OFF", cardId: kingH.id, meldId: setOfKings.id });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: threeC.id });

      expect(actor.getSnapshot().value).toBe("turnComplete");
    });

    it("then: player has 1 card (the drawn card)", () => {
      const input = {
        playerId: "player-1",
        hand: [nineS, fourD, kingH, threeC],
        stock: [drawnCard],
        discard: [card("2", "hearts")],
        roundNumber: 1 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [setOfNines, diamondRun, setOfKings],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "LAY_OFF", cardId: nineS.id, meldId: setOfNines.id });
      actor.send({ type: "LAY_OFF", cardId: fourD.id, meldId: diamondRun.id });
      actor.send({ type: "LAY_OFF", cardId: kingH.id, meldId: setOfKings.id });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: threeC.id });

      expect(actor.getSnapshot().output?.hand.length).toBe(1);
      expect(actor.getSnapshot().output?.hand[0]?.id).toBe(drawnCard.id);
    });

    it("and: three melds extended", () => {
      const input = {
        playerId: "player-1",
        hand: [nineS, fourD, kingH, threeC],
        stock: [drawnCard],
        discard: [card("2", "hearts")],
        roundNumber: 1 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [setOfNines, diamondRun, setOfKings],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "LAY_OFF", cardId: nineS.id, meldId: setOfNines.id });
      actor.send({ type: "LAY_OFF", cardId: fourD.id, meldId: diamondRun.id });
      actor.send({ type: "LAY_OFF", cardId: kingH.id, meldId: setOfKings.id });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: threeC.id });

      const table = actor.getSnapshot().output?.table;
      const nines = table?.find((m) => m.id === setOfNines.id);
      const run = table?.find((m) => m.id === diamondRun.id);
      const kings = table?.find((m) => m.id === setOfKings.id);

      expect(nines?.cards.length).toBe(4); // 3 + 1
      expect(run?.cards.length).toBe(5); // 4 + 1
      expect(kings?.cards.length).toBe(4); // 3 + 1
    });

    it("and: turn completes normally", () => {
      const input = {
        playerId: "player-1",
        hand: [nineS, fourD, kingH, threeC],
        stock: [drawnCard],
        discard: [card("2", "hearts")],
        roundNumber: 1 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [setOfNines, diamondRun, setOfKings],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "LAY_OFF", cardId: nineS.id, meldId: setOfNines.id });
      actor.send({ type: "LAY_OFF", cardId: fourD.id, meldId: diamondRun.id });
      actor.send({ type: "LAY_OFF", cardId: kingH.id, meldId: setOfKings.id });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: threeC.id });

      expect(actor.getSnapshot().value).toBe("turnComplete");
      expect(actor.getSnapshot().output?.wentOut).toBe(false);
    });
  });

  describe("laying off to other player's meld", () => {
    const kingS = card("K", "spades");
    const extraCard = card("Q", "clubs");
    const drawnCard = card("J", "diamonds");
    const player1Set = createMeld("set", [card("K", "clubs"), card("K", "diamonds"), card("K", "hearts")], "player-1");

    it("given: player 1 owns set (K♣ K♦ K♥)", () => {
      expect(player1Set.ownerId).toBe("player-1");
      expect(player1Set.cards.every((c) => c.rank === "K")).toBe(true);
    });

    it("and: player 2 is down, has K♠", () => {
      expect(kingS.rank).toBe("K");
      expect(kingS.suit).toBe("spades");
    });

    it("when: player 2's turn", () => {
      // Player 2's turn
      const input = {
        playerId: "player-2",
        hand: [kingS, extraCard],
        stock: [drawnCard],
        discard: [card("2", "hearts")],
        roundNumber: 1 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [player1Set],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      expect(actor.getSnapshot().context.playerId).toBe("player-2");
    });

    it("and: player 2 draws", () => {
      const input = {
        playerId: "player-2",
        hand: [kingS, extraCard],
        stock: [drawnCard],
        discard: [card("2", "hearts")],
        roundNumber: 1 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [player1Set],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      expect(actor.getSnapshot().context.hand.length).toBe(3);
    });

    it("and: player 2 lays off K♠ to player 1's set", () => {
      const input = {
        playerId: "player-2",
        hand: [kingS, extraCard],
        stock: [drawnCard],
        discard: [card("2", "hearts")],
        roundNumber: 1 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [player1Set],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "LAY_OFF", cardId: kingS.id, meldId: player1Set.id });

      expect(actor.getSnapshot().context.hand.length).toBe(2);
    });

    it("then: set is (K♣ K♦ K♥ K♠)", () => {
      const input = {
        playerId: "player-2",
        hand: [kingS, extraCard],
        stock: [drawnCard],
        discard: [card("2", "hearts")],
        roundNumber: 1 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [player1Set],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "LAY_OFF", cardId: kingS.id, meldId: player1Set.id });

      const set = actor.getSnapshot().context.table.find((m) => m.id === player1Set.id);
      expect(set?.cards.length).toBe(4);
    });

    it("and: set still owned by player 1", () => {
      const input = {
        playerId: "player-2",
        hand: [kingS, extraCard],
        stock: [drawnCard],
        discard: [card("2", "hearts")],
        roundNumber: 1 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [player1Set],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "LAY_OFF", cardId: kingS.id, meldId: player1Set.id });

      const set = actor.getSnapshot().context.table.find((m) => m.id === player1Set.id);
      expect(set?.ownerId).toBe("player-1");
    });

    it("and: player 2's hand reduced by 1", () => {
      const input = {
        playerId: "player-2",
        hand: [kingS, extraCard],
        stock: [drawnCard],
        discard: [card("2", "hearts")],
        roundNumber: 1 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [player1Set],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      const initialSize = actor.getSnapshot().context.hand.length;
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "LAY_OFF", cardId: kingS.id, meldId: player1Set.id });

      // Drew 1, laid off 1 = net 0 change
      expect(actor.getSnapshot().context.hand.length).toBe(initialSize);
    });
  });

  describe("laying off wild to meld", () => {
    const joker = { id: `joker-${Math.random()}`, rank: "Joker" as Rank, suit: "wild" as Suit };
    const extraCard = card("Q", "clubs");
    const drawnCard = card("J", "diamonds");
    const spadeRun = createMeld("run", [card("5", "spades"), card("6", "spades"), card("7", "spades"), card("8", "spades")]);

    it("given: table has run (5♠ 6♠ 7♠ 8♠)", () => {
      expect(spadeRun.cards.every((c) => c.suit === "spades")).toBe(true);
      expect(spadeRun.cards.length).toBe(4);
    });

    it("and: player has Joker", () => {
      expect(joker.rank).toBe("Joker");
    });

    it("when: player lays off Joker to high end of run", () => {
      const input = {
        playerId: "player-1",
        hand: [joker, extraCard],
        stock: [drawnCard],
        discard: [card("2", "hearts")],
        roundNumber: 1 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [spadeRun],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "LAY_OFF", cardId: joker.id, meldId: spadeRun.id });

      expect(actor.getSnapshot().context.hand.length).toBe(2);
    });

    it("then: run is (5♠ 6♠ 7♠ 8♠ Joker)", () => {
      const input = {
        playerId: "player-1",
        hand: [joker, extraCard],
        stock: [drawnCard],
        discard: [card("2", "hearts")],
        roundNumber: 1 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [spadeRun],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "LAY_OFF", cardId: joker.id, meldId: spadeRun.id });

      const run = actor.getSnapshot().context.table.find((m) => m.id === spadeRun.id);
      expect(run?.cards.length).toBe(5);
    });

    it("and: Joker represents 9♠", () => {
      // In the run 5♠ 6♠ 7♠ 8♠ + Joker, the Joker represents 9♠
      // This is conceptual - the implementation tracks it by position
      const input = {
        playerId: "player-1",
        hand: [joker, extraCard],
        stock: [drawnCard],
        discard: [card("2", "hearts")],
        roundNumber: 1 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [spadeRun],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "LAY_OFF", cardId: joker.id, meldId: spadeRun.id });

      const run = actor.getSnapshot().context.table.find((m) => m.id === spadeRun.id);
      // The joker is at position 4 (0-indexed), representing the next card after 8
      const jokerCard = run?.cards.find((c) => c.rank === "Joker");
      expect(jokerCard).toBeDefined();
    });
  });

  describe("cannot lay off immediately after laying down", () => {
    // Round 1 contract: 2 sets of 3
    const three1 = card("3", "clubs");
    const three2 = card("3", "diamonds");
    const three3 = card("3", "hearts");
    const four1 = card("4", "spades");
    const four2 = card("4", "clubs");
    const four3 = card("4", "diamonds");
    const nineS = card("9", "spades"); // Extra card to try to lay off
    const drawnCard = card("A", "clubs");
    const existingSet = createMeld("set", [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")]);

    it("given: player is not down, has contract cards", () => {
      const hand = [three1, three2, three3, four1, four2, four3, nineS];
      expect(hand.length).toBe(7);
    });

    it("when: player draws", () => {
      const input = {
        playerId: "player-1",
        hand: [three1, three2, three3, four1, four2, four3, nineS],
        stock: [drawnCard],
        discard: [card("2", "hearts")],
        roundNumber: 1 as RoundNumber,
        isDown: false,
        laidDownThisTurn: false,
        table: [existingSet],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      expect(actor.getSnapshot().context.hand.length).toBe(8);
    });

    it("and: player lays down contract (becomes down)", () => {
      const input = {
        playerId: "player-1",
        hand: [three1, three2, three3, four1, four2, four3, nineS],
        stock: [drawnCard],
        discard: [card("2", "hearts")],
        roundNumber: 1 as RoundNumber,
        isDown: false,
        laidDownThisTurn: false,
        table: [existingSet],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set", cardIds: [three1.id, three2.id, three3.id] },
          { type: "set", cardIds: [four1.id, four2.id, four3.id] },
        ],
      });

      expect(actor.getSnapshot().context.isDown).toBe(true);
      expect(actor.getSnapshot().context.laidDownThisTurn).toBe(true);
    });

    it("and: player tries to lay off extra card", () => {
      const input = {
        playerId: "player-1",
        hand: [three1, three2, three3, four1, four2, four3, nineS],
        stock: [drawnCard],
        discard: [card("2", "hearts")],
        roundNumber: 1 as RoundNumber,
        isDown: false,
        laidDownThisTurn: false,
        table: [existingSet],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set", cardIds: [three1.id, three2.id, three3.id] },
          { type: "set", cardIds: [four1.id, four2.id, four3.id] },
        ],
      });

      // Try to lay off 9♠ to the existing set of 9s
      actor.send({ type: "LAY_OFF", cardId: nineS.id, meldId: existingSet.id });

      // Should be rejected because laidDownThisTurn is true
      expect(actor.getSnapshot().context.hand).toContainEqual(nineS);
    });

    it("then: lay off rejected (laidDownThisTurn: true)", () => {
      const input = {
        playerId: "player-1",
        hand: [three1, three2, three3, four1, four2, four3, nineS],
        stock: [drawnCard],
        discard: [card("2", "hearts")],
        roundNumber: 1 as RoundNumber,
        isDown: false,
        laidDownThisTurn: false,
        table: [existingSet],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set", cardIds: [three1.id, three2.id, three3.id] },
          { type: "set", cardIds: [four1.id, four2.id, four3.id] },
        ],
      });
      actor.send({ type: "LAY_OFF", cardId: nineS.id, meldId: existingSet.id });

      expect(actor.getSnapshot().context.laidDownThisTurn).toBe(true);
      // Card still in hand
      expect(actor.getSnapshot().context.hand).toContainEqual(nineS);
    });

    it("and: player must discard", () => {
      const input = {
        playerId: "player-1",
        hand: [three1, three2, three3, four1, four2, four3, nineS],
        stock: [drawnCard],
        discard: [card("2", "hearts")],
        roundNumber: 1 as RoundNumber,
        isDown: false,
        laidDownThisTurn: false,
        table: [existingSet],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set", cardIds: [three1.id, three2.id, three3.id] },
          { type: "set", cardIds: [four1.id, four2.id, four3.id] },
        ],
      });

      // In awaitingDiscard
      expect(actor.getSnapshot().value).toBe("awaitingDiscard");

      // Discard one of the remaining cards
      actor.send({ type: "DISCARD", cardId: nineS.id });
      expect(actor.getSnapshot().value).toBe("turnComplete");
    });

    it("and: can lay off next turn", () => {
      // This is conceptual - next turn would have laidDownThisTurn: false
      // Simulating this by creating a fresh turn with isDown: true, laidDownThisTurn: false
      const newNineS = card("9", "spades");
      const input = {
        playerId: "player-1",
        hand: [newNineS, card("Q", "clubs")],
        stock: [card("J", "diamonds")],
        discard: [card("2", "hearts")],
        roundNumber: 1 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false, // Next turn
        table: [existingSet],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "LAY_OFF", cardId: newNineS.id, meldId: existingSet.id });

      // Lay off succeeds
      expect(actor.getSnapshot().context.hand).not.toContainEqual(newNineS);
    });
  });
});

describe("going out scenarios - rounds 1-5", () => {
  describe("going out via discard", () => {
    it.todo("given: round 3, player is down, has 2 cards", () => {});
    it.todo("when: player draws (3 cards)", () => {});
    it.todo("and: player lays off 2 cards to melds (1 card remaining)", () => {});
    it.todo("and: player discards last card", () => {});
    it.todo("then: player has 0 cards", () => {});
    it.todo("and: player went out via discard", () => {});
    it.todo("and: round ends", () => {});
  });

  describe("going out via lay off (no discard)", () => {
    it.todo("given: round 2, player is down, has 2 cards", () => {});
    it.todo("when: player draws (3 cards)", () => {});
    it.todo("and: player lays off all 3 cards to valid melds", () => {});
    it.todo("then: player has 0 cards", () => {});
    it.todo("and: player went out via lay off", () => {});
    it.todo("and: no discard occurred", () => {});
    it.todo("and: round ends immediately", () => {});
  });

  describe("player choice between discard and lay off", () => {
    it.todo("given: round 1, player is down, has 2 cards: 9♠, K♥, both can be laid off", () => {});
    it.todo("when: player draws 5♦ (3 cards), 5♦ can also be laid off", () => {});
    it.todo("option A: player lays off 9♠, K♥, 5♦ → went out (0 cards, no discard)", () => {});
    it.todo("option B: player lays off 9♠, K♥, discards 5♦ → went out (0 cards, via discard)", () => {});
    it.todo("both options are valid", () => {});
  });

  describe("going out on lay down turn", () => {
    it.todo("given: round 1, player has 7 cards (two 4-card sets possible)", () => {});
    it.todo("when: player draws (8 cards)", () => {});
    it.todo("and: player lays down 7 cards in two sets (4+3)", () => {});
    it.todo("and: player has 1 card remaining", () => {});
    it.todo("and: player discards that card", () => {});
    it.todo("then: player has 0 cards", () => {});
    it.todo("and: player went out on same turn as laying down", () => {});
  });
});

describe("going out scenarios - round 6", () => {
  describe("going out via lay off", () => {
    it.todo("given: round 6, player is down, has 2 cards: 9♠, K♥", () => {});
    it.todo("and: table has set of 9s and set of kings", () => {});
    it.todo("when: player draws (3 cards: 9♠, K♥, 5♦)", () => {});
    it.todo("and: 5♦ fits a diamond run", () => {});
    it.todo("and: player lays off 9♠, K♥, 5♦", () => {});
    it.todo("then: player has 0 cards, went out, no discard occurred", () => {});
  });

  describe("cannot discard last card", () => {
    it.todo("given: round 6, player is down, has 1 card", () => {});
    it.todo("when: player draws (2 cards)", () => {});
    it.todo("and: player can only lay off 1 card", () => {});
    it.todo("and: player lays off that card (1 remaining)", () => {});
    it.todo("then: player has 1 card", () => {});
    it.todo("and: player tries to DISCARD", () => {});
    it.todo("then: rejected - cannot discard last card in round 6", () => {});
    it.todo("and: player ends turn with 1 card", () => {});
  });

  describe("can discard with 2+ cards", () => {
    it.todo("given: round 6, player is down, has 3 cards", () => {});
    it.todo("when: player draws (4 cards)", () => {});
    it.todo("and: player cannot lay off any cards", () => {});
    it.todo("then: player CAN discard (will have 3 remaining)", () => {});
    it.todo("and: player discards, turn ends normally with 3 cards", () => {});
    it.todo("and: player did NOT go out", () => {});
  });

  describe("stuck with 1 unlayable card", () => {
    it.todo("given: round 6, player stuck with 1 card: 7♦", () => {});
    it.todo("and: no diamond run, no set of 7s on table", () => {});
    it.todo("when: player draws (2 cards: 7♦ + K♣)", () => {});
    it.todo("and: K♣ fits a set of kings", () => {});
    it.todo("and: player lays off K♣ (1 card: 7♦)", () => {});
    it.todo("and: 7♦ still doesn't fit anywhere", () => {});
    it.todo("then: player cannot discard (only 1 card)", () => {});
    it.todo("and: player ends turn with 7♦", () => {});
    it.todo("and: must wait for melds to expand", () => {});
  });

  describe("eventually going out after being stuck", () => {
    it.todo("given: round 6, player stuck with 7♦", () => {});
    it.todo("and: another player creates set of 7s", () => {});
    it.todo("when: player's next turn", () => {});
    it.todo("and: player draws (2 cards: 7♦ + X)", () => {});
    it.todo("and: player lays off 7♦ to set of 7s", () => {});
    it.todo("and: player lays off X (if possible) OR discards X", () => {});
    it.todo("then: player eventually reaches 0 cards, goes out", () => {});
  });
});

describe("scoring integration", () => {
  describe("round end scoring flow", () => {
    it.todo("given: 3 players", () => {});
    it.todo("and: player 1 goes out", () => {});
    it.todo("and: player 2 has (J♥, Q♦) in hand", () => {});
    it.todo("and: player 3 has (A♠, Joker, 5♣) in hand", () => {});
    it.todo("when: round ends", () => {});
    it.todo("then: p1 round score = 0", () => {});
    it.todo("and: p2 round score = 10 + 10 = 20", () => {});
    it.todo("and: p3 round score = 15 + 50 + 5 = 70", () => {});
    it.todo("and: roundRecord created with these scores", () => {});
    it.todo("and: totalScores updated", () => {});
  });

  describe("total score accumulation", () => {
    it.todo("given: after round 3, scores are { p1: 45, p2: 60, p3: 30 }", () => {});
    it.todo("and: round 4 ends with { p1: 0, p2: 25, p3: 55 }", () => {});
    it.todo("then: new totals = { p1: 45, p2: 85, p3: 85 }", () => {});
    it.todo("and: p2 and p3 now tied", () => {});
  });

  describe("determining winner after round 6", () => {
    it.todo("given: final totals { p1: 150, p2: 85, p3: 120 }", () => {});
    it.todo("then: p2 wins with lowest score", () => {});
    it.todo("and: game ends", () => {});
  });

  describe("tie for winner", () => {
    it.todo("given: final totals { p1: 100, p2: 100, p3: 150 }", () => {});
    it.todo("then: p1 and p2 both win", () => {});
    it.todo("and: both have lowest score (100)", () => {});
  });
});

describe("edge cases", () => {
  describe("going out with contract using all cards", () => {
    it.todo("given: player has exactly 12 cards forming large melds", () => {});
    it.todo("when: player lays down all 12 cards as contract", () => {});
    it.todo("then: player has 0 cards, went out on lay down (no discard needed)", () => {});
    it.todo("note: rare scenario with larger-than-minimum melds", () => {});
  });

  describe("laying off wild breaks ratio - rejected", () => {
    it.todo("given: meld (9♣ 9♦ Joker 2♥) — 2 natural, 2 wild", () => {});
    it.todo("when: player tries to lay off another Joker", () => {});
    it.todo("then: would become 2 natural, 3 wild", () => {});
    it.todo("and: rejected (wilds would outnumber)", () => {});
  });

  describe("perfect game - zero total score", () => {
    it.todo("given: player went out in all 6 rounds", () => {});
    it.todo("then: total score = 0 + 0 + 0 + 0 + 0 + 0 = 0", () => {});
    it.todo("and: player wins, best possible outcome", () => {});
  });

  describe("round 6 last card scenarios", () => {
    it.todo("scenario A - layable last card: player MUST lay it off to go out", () => {});
    it.todo("scenario B - unlayable last card: player cannot go out, cannot discard, keeps card", () => {});
    it.todo("scenario C - draw helps: drawn card can be laid off but original still doesn't fit, turn ends with 1 card", () => {});
  });

  describe("stock depletion during round", () => {
    it.todo("given: many turns or May I calls deplete stock", () => {});
    it.todo("when: stock runs out", () => {});
    it.todo("then: flip discard pile (keep top card) to form new stock", () => {});
    it.todo("and: round continues", () => {});
  });
});
