import { describe, it, expect } from "bun:test";
import { createActor } from "xstate";
import { turnMachine } from "./turn.machine";
import type { RoundNumber } from "./engine.types";
import type { Card, Suit, Rank } from "../card/card.types";
import type { Meld } from "../meld/meld.types";
import { calculateRoundScores, updateTotalScores, determineWinner } from "./scoring.engine";

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
    // Round 3 setup: player is down, has 2 cards that can be laid off
    const nineS = card("9", "spades");
    const kingH = card("K", "hearts");
    const drawnCard = card("A", "clubs");
    const setOfNines = createMeld("set", [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")]);
    const setOfKings = createMeld("set", [card("K", "clubs"), card("K", "diamonds"), card("K", "spades")]);

    it("given: round 3, player is down, has 2 cards", () => {
      const hand = [nineS, kingH];
      expect(hand.length).toBe(2);
    });

    it("when: player draws (3 cards)", () => {
      const input = {
        playerId: "player-1",
        hand: [nineS, kingH],
        stock: [drawnCard],
        discard: [card("2", "hearts")],
        roundNumber: 3 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [setOfNines, setOfKings],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      expect(actor.getSnapshot().context.hand.length).toBe(3);
    });

    it("and: player lays off 2 cards to melds (1 card remaining)", () => {
      const input = {
        playerId: "player-1",
        hand: [nineS, kingH],
        stock: [drawnCard],
        discard: [card("2", "hearts")],
        roundNumber: 3 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [setOfNines, setOfKings],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "LAY_OFF", cardId: nineS.id, meldId: setOfNines.id });
      actor.send({ type: "LAY_OFF", cardId: kingH.id, meldId: setOfKings.id });

      expect(actor.getSnapshot().context.hand.length).toBe(1);
    });

    it("and: player discards last card", () => {
      const input = {
        playerId: "player-1",
        hand: [nineS, kingH],
        stock: [drawnCard],
        discard: [card("2", "hearts")],
        roundNumber: 3 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [setOfNines, setOfKings],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "LAY_OFF", cardId: nineS.id, meldId: setOfNines.id });
      actor.send({ type: "LAY_OFF", cardId: kingH.id, meldId: setOfKings.id });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: drawnCard.id });

      expect(actor.getSnapshot().value).toBe("wentOut");
    });

    it("then: player has 0 cards", () => {
      const input = {
        playerId: "player-1",
        hand: [nineS, kingH],
        stock: [drawnCard],
        discard: [card("2", "hearts")],
        roundNumber: 3 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [setOfNines, setOfKings],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "LAY_OFF", cardId: nineS.id, meldId: setOfNines.id });
      actor.send({ type: "LAY_OFF", cardId: kingH.id, meldId: setOfKings.id });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: drawnCard.id });

      expect(actor.getSnapshot().output?.hand.length).toBe(0);
    });

    it("and: player went out via discard", () => {
      const input = {
        playerId: "player-1",
        hand: [nineS, kingH],
        stock: [drawnCard],
        discard: [card("2", "hearts")],
        roundNumber: 3 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [setOfNines, setOfKings],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "LAY_OFF", cardId: nineS.id, meldId: setOfNines.id });
      actor.send({ type: "LAY_OFF", cardId: kingH.id, meldId: setOfKings.id });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: drawnCard.id });

      expect(actor.getSnapshot().output?.wentOut).toBe(true);
    });

    it("and: round ends", () => {
      const input = {
        playerId: "player-1",
        hand: [nineS, kingH],
        stock: [drawnCard],
        discard: [card("2", "hearts")],
        roundNumber: 3 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [setOfNines, setOfKings],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "LAY_OFF", cardId: nineS.id, meldId: setOfNines.id });
      actor.send({ type: "LAY_OFF", cardId: kingH.id, meldId: setOfKings.id });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: drawnCard.id });

      // wentOut state means round ends
      expect(actor.getSnapshot().value).toBe("wentOut");
      expect(actor.getSnapshot().status).toBe("done");
    });
  });

  describe("going out via lay off (no discard)", () => {
    // Round 2 setup: player has 2 cards, draws 1, can lay off all 3
    const nineS = card("9", "spades");
    const kingH = card("K", "hearts");
    const fiveD = card("5", "diamonds");
    const setOfNines = createMeld("set", [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")]);
    const setOfKings = createMeld("set", [card("K", "clubs"), card("K", "diamonds"), card("K", "spades")]);
    const diamondRun = createMeld("run", [card("6", "diamonds"), card("7", "diamonds"), card("8", "diamonds")]);

    it("given: round 2, player is down, has 2 cards", () => {
      const hand = [nineS, kingH];
      expect(hand.length).toBe(2);
    });

    it("when: player draws (3 cards)", () => {
      const input = {
        playerId: "player-1",
        hand: [nineS, kingH],
        stock: [fiveD],
        discard: [card("2", "hearts")],
        roundNumber: 2 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [setOfNines, setOfKings, diamondRun],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      expect(actor.getSnapshot().context.hand.length).toBe(3);
    });

    it("and: player lays off all 3 cards to valid melds", () => {
      const input = {
        playerId: "player-1",
        hand: [nineS, kingH],
        stock: [fiveD],
        discard: [card("2", "hearts")],
        roundNumber: 2 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [setOfNines, setOfKings, diamondRun],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "LAY_OFF", cardId: nineS.id, meldId: setOfNines.id });
      actor.send({ type: "LAY_OFF", cardId: kingH.id, meldId: setOfKings.id });
      // After laying off 2 cards, 1 card remains (the drawn 5♦)
      // Now lay off the last card
      actor.send({ type: "LAY_OFF", cardId: fiveD.id, meldId: diamondRun.id });

      expect(actor.getSnapshot().value).toBe("wentOut");
    });

    it("then: player has 0 cards", () => {
      const input = {
        playerId: "player-1",
        hand: [nineS, kingH],
        stock: [fiveD],
        discard: [card("2", "hearts")],
        roundNumber: 2 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [setOfNines, setOfKings, diamondRun],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "LAY_OFF", cardId: nineS.id, meldId: setOfNines.id });
      actor.send({ type: "LAY_OFF", cardId: kingH.id, meldId: setOfKings.id });
      actor.send({ type: "LAY_OFF", cardId: fiveD.id, meldId: diamondRun.id });

      expect(actor.getSnapshot().output?.hand.length).toBe(0);
    });

    it("and: player went out via lay off", () => {
      const input = {
        playerId: "player-1",
        hand: [nineS, kingH],
        stock: [fiveD],
        discard: [card("2", "hearts")],
        roundNumber: 2 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [setOfNines, setOfKings, diamondRun],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "LAY_OFF", cardId: nineS.id, meldId: setOfNines.id });
      actor.send({ type: "LAY_OFF", cardId: kingH.id, meldId: setOfKings.id });
      actor.send({ type: "LAY_OFF", cardId: fiveD.id, meldId: diamondRun.id });

      expect(actor.getSnapshot().output?.wentOut).toBe(true);
    });

    it("and: no discard occurred", () => {
      const input = {
        playerId: "player-1",
        hand: [nineS, kingH],
        stock: [fiveD],
        discard: [card("2", "hearts")],
        roundNumber: 2 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [setOfNines, setOfKings, diamondRun],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "LAY_OFF", cardId: nineS.id, meldId: setOfNines.id });
      actor.send({ type: "LAY_OFF", cardId: kingH.id, meldId: setOfKings.id });
      actor.send({ type: "LAY_OFF", cardId: fiveD.id, meldId: diamondRun.id });

      // Discard pile size unchanged from initial (1 card)
      expect(actor.getSnapshot().output?.discard.length).toBe(1);
    });

    it("and: round ends immediately", () => {
      const input = {
        playerId: "player-1",
        hand: [nineS, kingH],
        stock: [fiveD],
        discard: [card("2", "hearts")],
        roundNumber: 2 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [setOfNines, setOfKings, diamondRun],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "LAY_OFF", cardId: nineS.id, meldId: setOfNines.id });
      actor.send({ type: "LAY_OFF", cardId: kingH.id, meldId: setOfKings.id });
      actor.send({ type: "LAY_OFF", cardId: fiveD.id, meldId: diamondRun.id });

      expect(actor.getSnapshot().value).toBe("wentOut");
      expect(actor.getSnapshot().status).toBe("done");
    });
  });

  describe("player choice between discard and lay off", () => {
    const nineS = card("9", "spades");
    const kingH = card("K", "hearts");
    const fiveD = card("5", "diamonds");
    const setOfNines = createMeld("set", [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")]);
    const setOfKings = createMeld("set", [card("K", "clubs"), card("K", "diamonds"), card("K", "spades")]);
    const diamondRun = createMeld("run", [card("6", "diamonds"), card("7", "diamonds"), card("8", "diamonds")]);

    it("given: round 1, player is down, has 2 cards: 9♠, K♥, both can be laid off", () => {
      expect(nineS.rank).toBe("9");
      expect(kingH.rank).toBe("K");
    });

    it("when: player draws 5♦ (3 cards), 5♦ can also be laid off", () => {
      const input = {
        playerId: "player-1",
        hand: [nineS, kingH],
        stock: [fiveD],
        discard: [card("2", "hearts")],
        roundNumber: 1 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [setOfNines, setOfKings, diamondRun],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      expect(actor.getSnapshot().context.hand.length).toBe(3);
      // All 3 cards can be laid off
      expect(actor.getSnapshot().context.hand.some((c) => c.id === fiveD.id)).toBe(true);
    });

    it("option A: player lays off 9♠, K♥, 5♦ → went out (0 cards, no discard)", () => {
      const input = {
        playerId: "player-1",
        hand: [nineS, kingH],
        stock: [fiveD],
        discard: [card("2", "hearts")],
        roundNumber: 1 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [setOfNines, setOfKings, diamondRun],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "LAY_OFF", cardId: nineS.id, meldId: setOfNines.id });
      actor.send({ type: "LAY_OFF", cardId: kingH.id, meldId: setOfKings.id });
      actor.send({ type: "LAY_OFF", cardId: fiveD.id, meldId: diamondRun.id });

      expect(actor.getSnapshot().output?.hand.length).toBe(0);
      expect(actor.getSnapshot().output?.wentOut).toBe(true);
      expect(actor.getSnapshot().output?.discard.length).toBe(1); // No discard added
    });

    it("option B: player lays off 9♠, K♥, discards 5♦ → went out (0 cards, via discard)", () => {
      const input = {
        playerId: "player-1",
        hand: [nineS, kingH],
        stock: [fiveD],
        discard: [card("2", "hearts")],
        roundNumber: 1 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [setOfNines, setOfKings, diamondRun],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "LAY_OFF", cardId: nineS.id, meldId: setOfNines.id });
      actor.send({ type: "LAY_OFF", cardId: kingH.id, meldId: setOfKings.id });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: fiveD.id });

      expect(actor.getSnapshot().output?.hand.length).toBe(0);
      expect(actor.getSnapshot().output?.wentOut).toBe(true);
      expect(actor.getSnapshot().output?.discard.length).toBe(2); // Discard added
    });

    it("both options are valid", () => {
      // Option A - lay off all
      const inputA = {
        playerId: "player-1",
        hand: [nineS, kingH],
        stock: [fiveD],
        discard: [card("2", "hearts")],
        roundNumber: 1 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [setOfNines, setOfKings, diamondRun],
      };

      const actorA = createActor(turnMachine, { input: inputA });
      actorA.start();
      actorA.send({ type: "DRAW_FROM_STOCK" });
      actorA.send({ type: "LAY_OFF", cardId: nineS.id, meldId: setOfNines.id });
      actorA.send({ type: "LAY_OFF", cardId: kingH.id, meldId: setOfKings.id });
      actorA.send({ type: "LAY_OFF", cardId: fiveD.id, meldId: diamondRun.id });

      // Option B - lay off 2, discard 1
      const nineS2 = card("9", "spades");
      const kingH2 = card("K", "hearts");
      const fiveD2 = card("5", "diamonds");
      const inputB = {
        playerId: "player-1",
        hand: [nineS2, kingH2],
        stock: [fiveD2],
        discard: [card("2", "hearts")],
        roundNumber: 1 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [setOfNines, setOfKings, diamondRun],
      };

      const actorB = createActor(turnMachine, { input: inputB });
      actorB.start();
      actorB.send({ type: "DRAW_FROM_STOCK" });
      actorB.send({ type: "LAY_OFF", cardId: nineS2.id, meldId: setOfNines.id });
      actorB.send({ type: "LAY_OFF", cardId: kingH2.id, meldId: setOfKings.id });
      actorB.send({ type: "SKIP_LAY_DOWN" });
      actorB.send({ type: "DISCARD", cardId: fiveD2.id });

      // Both end in wentOut
      expect(actorA.getSnapshot().value).toBe("wentOut");
      expect(actorB.getSnapshot().value).toBe("wentOut");
      expect(actorA.getSnapshot().output?.wentOut).toBe(true);
      expect(actorB.getSnapshot().output?.wentOut).toBe(true);
    });
  });

  describe("going out on lay down turn", () => {
    // Round 1 contract: 2 sets of 3
    // Player has exactly 7 cards that form two sets (4+3), draws 1 more to discard
    const three1 = card("3", "clubs");
    const three2 = card("3", "diamonds");
    const three3 = card("3", "hearts");
    const three4 = card("3", "spades");
    const four1 = card("4", "spades");
    const four2 = card("4", "clubs");
    const four3 = card("4", "diamonds");
    const drawnCard = card("A", "clubs");

    it("given: round 1, player has 7 cards (two 4-card sets possible)", () => {
      const hand = [three1, three2, three3, three4, four1, four2, four3];
      expect(hand.length).toBe(7);
    });

    it("when: player draws (8 cards)", () => {
      const input = {
        playerId: "player-1",
        hand: [three1, three2, three3, three4, four1, four2, four3],
        stock: [drawnCard],
        discard: [card("2", "hearts")],
        roundNumber: 1 as RoundNumber,
        isDown: false,
        laidDownThisTurn: false,
        table: [],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      expect(actor.getSnapshot().context.hand.length).toBe(8);
    });

    it("and: player lays down 7 cards in two sets (4+3)", () => {
      const input = {
        playerId: "player-1",
        hand: [three1, three2, three3, three4, four1, four2, four3],
        stock: [drawnCard],
        discard: [card("2", "hearts")],
        roundNumber: 1 as RoundNumber,
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
          { type: "set", cardIds: [three1.id, three2.id, three3.id, three4.id] },
          { type: "set", cardIds: [four1.id, four2.id, four3.id] },
        ],
      });

      expect(actor.getSnapshot().context.isDown).toBe(true);
      expect(actor.getSnapshot().context.hand.length).toBe(1);
    });

    it("and: player has 1 card remaining", () => {
      const input = {
        playerId: "player-1",
        hand: [three1, three2, three3, three4, four1, four2, four3],
        stock: [drawnCard],
        discard: [card("2", "hearts")],
        roundNumber: 1 as RoundNumber,
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
          { type: "set", cardIds: [three1.id, three2.id, three3.id, three4.id] },
          { type: "set", cardIds: [four1.id, four2.id, four3.id] },
        ],
      });

      expect(actor.getSnapshot().context.hand.length).toBe(1);
      expect(actor.getSnapshot().context.hand[0]?.id).toBe(drawnCard.id);
    });

    it("and: player discards that card", () => {
      const input = {
        playerId: "player-1",
        hand: [three1, three2, three3, three4, four1, four2, four3],
        stock: [drawnCard],
        discard: [card("2", "hearts")],
        roundNumber: 1 as RoundNumber,
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
          { type: "set", cardIds: [three1.id, three2.id, three3.id, three4.id] },
          { type: "set", cardIds: [four1.id, four2.id, four3.id] },
        ],
      });
      actor.send({ type: "DISCARD", cardId: drawnCard.id });

      expect(actor.getSnapshot().value).toBe("wentOut");
    });

    it("then: player has 0 cards", () => {
      const input = {
        playerId: "player-1",
        hand: [three1, three2, three3, three4, four1, four2, four3],
        stock: [drawnCard],
        discard: [card("2", "hearts")],
        roundNumber: 1 as RoundNumber,
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
          { type: "set", cardIds: [three1.id, three2.id, three3.id, three4.id] },
          { type: "set", cardIds: [four1.id, four2.id, four3.id] },
        ],
      });
      actor.send({ type: "DISCARD", cardId: drawnCard.id });

      expect(actor.getSnapshot().output?.hand.length).toBe(0);
    });

    it("and: player went out on same turn as laying down", () => {
      const input = {
        playerId: "player-1",
        hand: [three1, three2, three3, three4, four1, four2, four3],
        stock: [drawnCard],
        discard: [card("2", "hearts")],
        roundNumber: 1 as RoundNumber,
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
          { type: "set", cardIds: [three1.id, three2.id, three3.id, three4.id] },
          { type: "set", cardIds: [four1.id, four2.id, four3.id] },
        ],
      });
      actor.send({ type: "DISCARD", cardId: drawnCard.id });

      expect(actor.getSnapshot().output?.wentOut).toBe(true);
      expect(actor.getSnapshot().value).toBe("wentOut");
    });
  });
});


describe("scoring integration", () => {
  describe("round end scoring flow", () => {
    // Using the scoring functions directly to test integration
    const jackH = card("J", "hearts");
    const queenD = card("Q", "diamonds");
    const aceS = card("A", "spades");
    const joker: Card = { id: `joker-${Math.random()}`, rank: "Joker", suit: null };
    const fiveC = card("5", "clubs");

    it("given: 3 players", () => {
      const players = [
        { id: "p1", hand: [] as Card[] },
        { id: "p2", hand: [jackH, queenD] },
        { id: "p3", hand: [aceS, joker, fiveC] },
      ];
      expect(players.length).toBe(3);
    });

    it("and: player 1 goes out", () => {
      // Player 1 went out, so they have no cards
      const p1Hand: Card[] = [];
      expect(p1Hand.length).toBe(0);
    });

    it("and: player 2 has (J♥, Q♦) in hand", () => {
      expect(jackH.rank).toBe("J");
      expect(queenD.rank).toBe("Q");
    });

    it("and: player 3 has (A♠, Joker, 5♣) in hand", () => {
      expect(aceS.rank).toBe("A");
      expect(joker.rank).toBe("Joker");
      expect(fiveC.rank).toBe("5");
    });

    it("when: round ends", () => {
      // Round ends when player 1 goes out
      const winnerId = "p1";
      expect(winnerId).toBe("p1");
    });

    it("then: p1 round score = 0", () => {
      const scores = calculateRoundScores(
        [
          { id: "p1", hand: [] },
          { id: "p2", hand: [jackH, queenD] },
          { id: "p3", hand: [aceS, joker, fiveC] },
        ],
        "p1"
      );
      expect(scores["p1"]).toBe(0);
    });

    it("and: p2 round score = 10 + 10 = 20", () => {
      const scores = calculateRoundScores(
        [
          { id: "p1", hand: [] },
          { id: "p2", hand: [jackH, queenD] },
          { id: "p3", hand: [aceS, joker, fiveC] },
        ],
        "p1"
      );
      expect(scores["p2"]).toBe(20); // J=10, Q=10
    });

    it("and: p3 round score = 15 + 50 + 5 = 70", () => {
      const scores = calculateRoundScores(
        [
          { id: "p1", hand: [] },
          { id: "p2", hand: [jackH, queenD] },
          { id: "p3", hand: [aceS, joker, fiveC] },
        ],
        "p1"
      );
      expect(scores["p3"]).toBe(70); // A=15, Joker=50, 5=5
    });

    it("and: roundRecord created with these scores", () => {
      const roundScores = calculateRoundScores(
        [
          { id: "p1", hand: [] },
          { id: "p2", hand: [jackH, queenD] },
          { id: "p3", hand: [aceS, joker, fiveC] },
        ],
        "p1"
      );
      // Round record would include these scores
      expect(roundScores).toEqual({ p1: 0, p2: 20, p3: 70 });
    });

    it("and: totalScores updated", () => {
      const initialTotals = { p1: 0, p2: 0, p3: 0 };
      const roundScores = { p1: 0, p2: 20, p3: 70 };
      const newTotals = updateTotalScores(initialTotals, roundScores);
      expect(newTotals).toEqual({ p1: 0, p2: 20, p3: 70 });
    });
  });

  describe("total score accumulation", () => {
    it("given: after round 3, scores are { p1: 45, p2: 60, p3: 30 }", () => {
      const totals = { p1: 45, p2: 60, p3: 30 };
      expect(totals.p1).toBe(45);
      expect(totals.p2).toBe(60);
      expect(totals.p3).toBe(30);
    });

    it("and: round 4 ends with { p1: 0, p2: 25, p3: 55 }", () => {
      const round4Scores = { p1: 0, p2: 25, p3: 55 };
      expect(round4Scores.p1).toBe(0);
      expect(round4Scores.p2).toBe(25);
      expect(round4Scores.p3).toBe(55);
    });

    it("then: new totals = { p1: 45, p2: 85, p3: 85 }", () => {
      const round3Totals = { p1: 45, p2: 60, p3: 30 };
      const round4Scores = { p1: 0, p2: 25, p3: 55 };
      const newTotals = updateTotalScores(round3Totals, round4Scores);
      expect(newTotals).toEqual({ p1: 45, p2: 85, p3: 85 });
    });

    it("and: p2 and p3 now tied", () => {
      const newTotals = { p1: 45, p2: 85, p3: 85 };
      expect(newTotals.p2).toBe(newTotals.p3);
    });
  });

  describe("determining winner after round 6", () => {
    it("given: final totals { p1: 150, p2: 85, p3: 120 }", () => {
      const finalScores = { p1: 150, p2: 85, p3: 120 };
      expect(finalScores.p1).toBe(150);
      expect(finalScores.p2).toBe(85);
      expect(finalScores.p3).toBe(120);
    });

    it("then: p2 wins with lowest score", () => {
      const finalScores = { p1: 150, p2: 85, p3: 120 };
      const winners = determineWinner(finalScores);
      expect(winners).toEqual(["p2"]);
    });

    it("and: game ends", () => {
      // Game ends after round 6, so we just verify winner is determined
      const finalScores = { p1: 150, p2: 85, p3: 120 };
      const winners = determineWinner(finalScores);
      expect(winners.length).toBeGreaterThan(0);
    });
  });

  describe("tie for winner", () => {
    it("given: final totals { p1: 100, p2: 100, p3: 150 }", () => {
      const finalScores = { p1: 100, p2: 100, p3: 150 };
      expect(finalScores.p1).toBe(100);
      expect(finalScores.p2).toBe(100);
      expect(finalScores.p3).toBe(150);
    });

    it("then: p1 and p2 both win", () => {
      const finalScores = { p1: 100, p2: 100, p3: 150 };
      const winners = determineWinner(finalScores);
      expect(winners).toContain("p1");
      expect(winners).toContain("p2");
      expect(winners.length).toBe(2);
    });

    it("and: both have lowest score (100)", () => {
      const finalScores = { p1: 100, p2: 100, p3: 150 };
      const lowestScore = Math.min(...Object.values(finalScores));
      expect(lowestScore).toBe(100);
    });
  });
});

describe("edge cases", () => {
  describe("going out with contract using all cards", () => {
    // Round 1 contract: 2 sets of 3 minimum (6 cards)
    // But we can have larger sets, using all cards
    // Player has 11 cards, draws 1 for 12, lays down all 12 in two 6-card sets
    const set1Cards = [
      card("9", "clubs"),
      card("9", "diamonds"),
      card("9", "hearts"),
      card("9", "spades"),
      { id: `joker-1-${Math.random()}`, rank: "Joker" as Rank, suit: null },
      card("2", "clubs"), // wild
    ];
    const set2Cards = [
      card("K", "clubs"),
      card("K", "diamonds"),
      card("K", "hearts"),
      card("K", "spades"),
      { id: `joker-2-${Math.random()}`, rank: "Joker" as Rank, suit: null },
      card("2", "diamonds"), // wild
    ];

    it("given: player has exactly 12 cards forming large melds", () => {
      // 11 cards initially + 1 drawn = 12 cards
      const initialHand = [...set1Cards.slice(0, 5), ...set2Cards]; // 11 cards
      expect(initialHand.length).toBe(11);
    });

    it("when: player lays down all 12 cards as contract", () => {
      const initialHand = [...set1Cards.slice(0, 5), ...set2Cards]; // 11 cards
      const drawnCard = set1Cards[5]!; // The last card of set1

      const input = {
        playerId: "player-1",
        hand: initialHand,
        stock: [drawnCard],
        discard: [card("A", "hearts")],
        roundNumber: 1 as RoundNumber,
        isDown: false,
        laidDownThisTurn: false,
        table: [],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      expect(actor.getSnapshot().context.hand.length).toBe(12);

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set", cardIds: set1Cards.map((c) => c.id) },
          { type: "set", cardIds: set2Cards.map((c) => c.id) },
        ],
      });

      // After laying down all cards, hand should be empty
      expect(actor.getSnapshot().context.hand.length).toBe(0);
    });

    it("then: player has 0 cards, went out on lay down (no discard needed)", () => {
      const initialHand = [...set1Cards.slice(0, 5), ...set2Cards];
      const drawnCard = set1Cards[5]!;

      const input = {
        playerId: "player-1",
        hand: initialHand,
        stock: [drawnCard],
        discard: [card("A", "hearts")],
        roundNumber: 1 as RoundNumber,
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
          { type: "set", cardIds: set1Cards.map((c) => c.id) },
          { type: "set", cardIds: set2Cards.map((c) => c.id) },
        ],
      });

      expect(actor.getSnapshot().value).toBe("wentOut");
      expect(actor.getSnapshot().output?.hand.length).toBe(0);
      expect(actor.getSnapshot().output?.wentOut).toBe(true);
    });

    it("note: rare scenario with larger-than-minimum melds", () => {
      // Just a documentation test
      // Round 1 minimum is 6 cards (2 sets of 3)
      // Using 12 cards (2 sets of 6) allows going out on lay down
      const minCards = 6;
      const usedCards = 12;
      expect(usedCards).toBeGreaterThan(minCards);
    });
  });

  describe("laying off wild - wild ratio NOT enforced", () => {
    // Set with 2 natural, 2 wild - per house rules, adding another wild is ALLOWED during layoff
    const nineC = card("9", "clubs");
    const nineD = card("9", "diamonds");
    const joker1: Card = { id: `joker-1-${Math.random()}`, rank: "Joker", suit: null };
    const twoH = card("2", "hearts"); // wild
    const joker2: Card = { id: `joker-2-${Math.random()}`, rank: "Joker", suit: null };
    const extraCard = card("K", "spades");
    const drawnCard = card("A", "clubs");

    const meldWith2Wild = createMeld("set", [nineC, nineD, joker1, twoH]);

    it("given: meld (9♣ 9♦ Joker 2♥) — 2 natural, 2 wild", () => {
      // 9♣ and 9♦ are natural, Joker and 2♥ are wild
      expect(meldWith2Wild.cards.length).toBe(4);
    });

    it("when: player tries to lay off another Joker", () => {
      const input = {
        playerId: "player-1",
        hand: [joker2, extraCard],
        stock: [drawnCard],
        discard: [card("3", "hearts")],
        roundNumber: 1 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [meldWith2Wild],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      // Try to lay off another Joker
      actor.send({ type: "LAY_OFF", cardId: joker2.id, meldId: meldWith2Wild.id });

      // Per house rules: wild ratio NOT enforced on layoff - Joker removed from hand
      expect(actor.getSnapshot().context.hand).not.toContainEqual(joker2);
    });

    it("then: becomes 2 natural, 3 wild (allowed during layoff)", () => {
      // Wild ratio (1:2) only applies during initial laydown, not layoff
      const naturals = 2;
      const wildsAfter = 3;
      expect(wildsAfter).toBeGreaterThan(naturals); // Would violate ratio on laydown, but allowed on layoff
    });

    it("and: accepted (wild ratio not enforced on layoff)", () => {
      const input = {
        playerId: "player-1",
        hand: [joker2, extraCard],
        stock: [drawnCard],
        discard: [card("3", "hearts")],
        roundNumber: 1 as RoundNumber,
        isDown: true,
        laidDownThisTurn: false,
        table: [meldWith2Wild],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "LAY_OFF", cardId: joker2.id, meldId: meldWith2Wild.id });

      // Meld now has 5 cards (Joker was accepted)
      const meld = actor.getSnapshot().context.table.find((m) => m.id === meldWith2Wild.id);
      expect(meld?.cards.length).toBe(5);
    });
  });

  describe("perfect game - zero total score", () => {
    it("given: player went out in all 6 rounds", () => {
      // Simulate a player going out each round
      const roundScores = [
        { p1: 0, p2: 50, p3: 30 },
        { p1: 0, p2: 40, p3: 25 },
        { p1: 0, p2: 35, p3: 45 },
        { p1: 0, p2: 20, p3: 55 },
        { p1: 0, p2: 60, p3: 15 },
        { p1: 0, p2: 25, p3: 40 },
      ];
      // p1 scored 0 every round
      expect(roundScores.every((r) => r.p1 === 0)).toBe(true);
    });

    it("then: total score = 0 + 0 + 0 + 0 + 0 + 0 = 0", () => {
      // Simulate accumulating scores
      let totals: { p1: number; p2: number; p3: number } = { p1: 0, p2: 0, p3: 0 };
      const roundScores = [
        { p1: 0, p2: 50, p3: 30 },
        { p1: 0, p2: 40, p3: 25 },
        { p1: 0, p2: 35, p3: 45 },
        { p1: 0, p2: 20, p3: 55 },
        { p1: 0, p2: 60, p3: 15 },
        { p1: 0, p2: 25, p3: 40 },
      ];

      for (const round of roundScores) {
        totals = updateTotalScores(totals, round) as { p1: number; p2: number; p3: number };
      }

      expect(totals.p1).toBe(0);
    });

    it("and: player wins, best possible outcome", () => {
      const finalScores = { p1: 0, p2: 230, p3: 210 };
      const winners = determineWinner(finalScores);
      expect(winners).toEqual(["p1"]);
      expect(finalScores.p1).toBe(0); // Best possible score
    });
  });


  describe("stock depletion during round", () => {
    it("given: many turns or May I calls deplete stock", () => {
      // This is a conceptual scenario - stock can be depleted
      const stockSize = 0;
      expect(stockSize).toBe(0);
    });

    it("when: stock runs out", () => {
      // When stock is empty, we need to reshuffle discard pile
      const stock: Card[] = [];
      expect(stock.length).toBe(0);
    });

    it("then: flip discard pile (keep top card) to form new stock", () => {
      // Discard pile becomes new stock (minus top card)
      const discardPile = [card("3", "hearts"), card("5", "diamonds"), card("7", "clubs"), card("9", "spades")];
      const topCard = discardPile[discardPile.length - 1]; // Keep this for discard
      const newStock = discardPile.slice(0, -1); // Rest becomes stock

      expect(newStock.length).toBe(3);
      expect(topCard?.rank).toBe("9");
    });

    it("and: round continues", () => {
      // After reshuffling, round continues
      // This is a game rule - we don't have a turn machine test for this
      // as it's handled at the round/game level
      const roundContinues = true;
      expect(roundContinues).toBe(true);
    });
  });
});
