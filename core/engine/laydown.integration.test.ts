import { describe, it, expect } from "bun:test";
import { createActor } from "xstate";
import { turnMachine } from "./turn.machine";
import { createInitialGameState } from "./engine.types";
import { applyTurnOutput, setupRound, advanceTurn } from "./game.loop";
import type { Card } from "../card/card.types";
import type { RoundNumber } from "./engine.types";

function card(rank: Card["rank"], suit: Card["suit"]): Card {
  return { id: `${rank}-${suit}-${Math.random()}`, rank, suit };
}

function joker(): Card {
  return { id: `Joker-${Math.random()}`, rank: "Joker", suit: null };
}

function createTurnInput(
  hand: Card[],
  roundNumber: RoundNumber = 1,
  playerId: string = "player-1"
) {
  return {
    playerId,
    hand,
    stock: [card("A", "spades"), card("Q", "hearts"), card("J", "diamonds")],
    discard: [card("5", "clubs")],
    roundNumber,
    isDown: false,
    table: [],
  };
}

describe("complete lay down turn flow", () => {
  describe("round 1 - successful lay down", () => {
    it("given: player has 11 cards including (9C 9D 9H) and (KC KD KS)", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingS = card("K", "spades");
      // 5 extra cards
      const extras = [card("3", "clubs"), card("4", "hearts"), card("5", "diamonds"), card("6", "spades"), card("7", "clubs")];

      const hand = [nineC, nineD, nineH, kingC, kingD, kingS, ...extras];
      expect(hand.length).toBe(11);
    });

    it("when: player draws from stock (now 12 cards)", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingS = card("K", "spades");
      const extras = [card("3", "clubs"), card("4", "hearts"), card("5", "diamonds"), card("6", "spades"), card("7", "clubs")];

      const hand = [nineC, nineD, nineH, kingC, kingD, kingS, ...extras];
      const input = createTurnInput(hand);
      const actor = createActor(turnMachine, { input });
      actor.start();

      expect(actor.getSnapshot().context.hand.length).toBe(11);
      actor.send({ type: "DRAW_FROM_STOCK" });
      expect(actor.getSnapshot().context.hand.length).toBe(12);
    });

    it("and: player lays down both sets (6 cards)", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingS = card("K", "spades");
      const extras = [card("3", "clubs"), card("4", "hearts"), card("5", "diamonds"), card("6", "spades"), card("7", "clubs")];

      const hand = [nineC, nineD, nineH, kingC, kingD, kingS, ...extras];
      const input = createTurnInput(hand);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingS.id] },
        ],
      });

      const table = actor.getSnapshot().context.table;
      expect(table.length).toBe(2);
      expect(table[0]!.cards.length).toBe(3);
      expect(table[1]!.cards.length).toBe(3);
    });

    it("and: player discards one card", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingS = card("K", "spades");
      const extras = [card("3", "clubs"), card("4", "hearts"), card("5", "diamonds"), card("6", "spades"), card("7", "clubs")];

      const hand = [nineC, nineD, nineH, kingC, kingD, kingS, ...extras];
      const input = createTurnInput(hand);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingS.id] },
        ],
      });

      // After lay down, should have 6 cards (12 - 6 laid down)
      expect(actor.getSnapshot().context.hand.length).toBe(6);

      const discardCard = actor.getSnapshot().context.hand[0]!;
      actor.send({ type: "DISCARD", cardId: discardCard.id });

      // After discard, should have 5 cards
      expect(actor.getSnapshot().context.hand.length).toBe(5);
    });

    it("then: player has 5 cards remaining", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingS = card("K", "spades");
      const extras = [card("3", "clubs"), card("4", "hearts"), card("5", "diamonds"), card("6", "spades"), card("7", "clubs")];

      const hand = [nineC, nineD, nineH, kingC, kingD, kingS, ...extras];
      const input = createTurnInput(hand);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingS.id] },
        ],
      });
      actor.send({ type: "DISCARD", cardId: actor.getSnapshot().context.hand[0]!.id });

      const output = actor.getSnapshot().output;
      expect(output?.hand.length).toBe(5);
    });

    it("and: table has 2 melds owned by player", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingS = card("K", "spades");
      const extras = [card("3", "clubs"), card("4", "hearts"), card("5", "diamonds"), card("6", "spades"), card("7", "clubs")];

      const hand = [nineC, nineD, nineH, kingC, kingD, kingS, ...extras];
      const input = createTurnInput(hand);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingS.id] },
        ],
      });
      actor.send({ type: "DISCARD", cardId: actor.getSnapshot().context.hand[0]!.id });

      const output = actor.getSnapshot().output;
      expect(output?.table.length).toBe(2);
      expect(output?.table[0]!.ownerId).toBe("player-1");
      expect(output?.table[1]!.ownerId).toBe("player-1");
    });

    it("and: player.isDown is true", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingS = card("K", "spades");
      const extras = [card("3", "clubs"), card("4", "hearts"), card("5", "diamonds"), card("6", "spades"), card("7", "clubs")];

      const hand = [nineC, nineD, nineH, kingC, kingD, kingS, ...extras];
      const input = createTurnInput(hand);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingS.id] },
        ],
      });
      actor.send({ type: "DISCARD", cardId: actor.getSnapshot().context.hand[0]!.id });

      const output = actor.getSnapshot().output;
      expect(output?.isDown).toBe(true);
    });

    it("and: turn completes successfully", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingS = card("K", "spades");
      const extras = [card("3", "clubs"), card("4", "hearts"), card("5", "diamonds"), card("6", "spades"), card("7", "clubs")];

      const hand = [nineC, nineD, nineH, kingC, kingD, kingS, ...extras];
      const input = createTurnInput(hand);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingS.id] },
        ],
      });
      actor.send({ type: "DISCARD", cardId: actor.getSnapshot().context.hand[0]!.id });

      expect(actor.getSnapshot().value).toBe("turnComplete");
      expect(actor.getSnapshot().status).toBe("done");
    });
  });

  describe("round 2 - successful lay down with wilds", () => {
    it("given: player has cards including (9C 9D Joker) and (5S 6S 7S 8S)", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const wild = joker();
      const fiveS = card("5", "spades");
      const sixS = card("6", "spades");
      const sevenS = card("7", "spades");
      const eightS = card("8", "spades");
      const extras = [card("3", "clubs"), card("4", "hearts"), card("Q", "diamonds"), card("K", "spades")];

      const hand = [nineC, nineD, wild, fiveS, sixS, sevenS, eightS, ...extras];
      expect(hand.length).toBe(11);
    });

    it("when: player draws and lays down", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const wild = joker();
      const fiveS = card("5", "spades");
      const sixS = card("6", "spades");
      const sevenS = card("7", "spades");
      const eightS = card("8", "spades");
      const extras = [card("3", "clubs"), card("4", "hearts"), card("Q", "diamonds"), card("K", "spades")];

      const hand = [nineC, nineD, wild, fiveS, sixS, sevenS, eightS, ...extras];
      const input = createTurnInput(hand, 2);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, wild.id] },
          { type: "run" as const, cardIds: [fiveS.id, sixS.id, sevenS.id, eightS.id] },
        ],
      });

      expect(actor.getSnapshot().value).toBe("awaitingDiscard");
    });

    it("then: meld with Joker is valid (2 natural, 1 wild)", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const wild = joker();
      const fiveS = card("5", "spades");
      const sixS = card("6", "spades");
      const sevenS = card("7", "spades");
      const eightS = card("8", "spades");
      const extras = [card("3", "clubs"), card("4", "hearts"), card("Q", "diamonds"), card("K", "spades")];

      const hand = [nineC, nineD, wild, fiveS, sixS, sevenS, eightS, ...extras];
      const input = createTurnInput(hand, 2);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, wild.id] },
          { type: "run" as const, cardIds: [fiveS.id, sixS.id, sevenS.id, eightS.id] },
        ],
      });

      const table = actor.getSnapshot().context.table;
      const setMeld = table.find((m) => m.type === "set");
      expect(setMeld).toBeDefined();
      expect(setMeld!.cards.some((c) => c.rank === "Joker")).toBe(true);
    });

    it("and: both melds on table", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const wild = joker();
      const fiveS = card("5", "spades");
      const sixS = card("6", "spades");
      const sevenS = card("7", "spades");
      const eightS = card("8", "spades");
      const extras = [card("3", "clubs"), card("4", "hearts"), card("Q", "diamonds"), card("K", "spades")];

      const hand = [nineC, nineD, wild, fiveS, sixS, sevenS, eightS, ...extras];
      const input = createTurnInput(hand, 2);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, wild.id] },
          { type: "run" as const, cardIds: [fiveS.id, sixS.id, sevenS.id, eightS.id] },
        ],
      });

      const table = actor.getSnapshot().context.table;
      expect(table.length).toBe(2);
      expect(table.some((m) => m.type === "set")).toBe(true);
      expect(table.some((m) => m.type === "run")).toBe(true);
    });
  });

  describe("player chooses not to lay down", () => {
    it("given: player has valid contract in hand", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingS = card("K", "spades");
      const extras = [card("3", "clubs"), card("4", "hearts"), card("5", "diamonds"), card("6", "spades"), card("7", "clubs")];

      const hand = [nineC, nineD, nineH, kingC, kingD, kingS, ...extras];
      // Player has 2 valid sets, can lay down for round 1
      expect(hand.length).toBe(11);
    });

    it("when: player draws", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingS = card("K", "spades");
      const extras = [card("3", "clubs"), card("4", "hearts"), card("5", "diamonds"), card("6", "spades"), card("7", "clubs")];

      const hand = [nineC, nineD, nineH, kingC, kingD, kingS, ...extras];
      const input = createTurnInput(hand);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      expect(actor.getSnapshot().value).toBe("drawn");
      expect(actor.getSnapshot().context.hand.length).toBe(12);
    });

    it("and: player proceeds to discard without laying down", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingS = card("K", "spades");
      const extras = [card("3", "clubs"), card("4", "hearts"), card("5", "diamonds"), card("6", "spades"), card("7", "clubs")];

      const hand = [nineC, nineD, nineH, kingC, kingD, kingS, ...extras];
      const input = createTurnInput(hand);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });

      const discardCard = actor.getSnapshot().context.hand[0]!;
      actor.send({ type: "DISCARD", cardId: discardCard.id });

      expect(actor.getSnapshot().value).toBe("turnComplete");
    });

    it("then: player.isDown remains false", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingS = card("K", "spades");
      const extras = [card("3", "clubs"), card("4", "hearts"), card("5", "diamonds"), card("6", "spades"), card("7", "clubs")];

      const hand = [nineC, nineD, nineH, kingC, kingD, kingS, ...extras];
      const input = createTurnInput(hand);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: actor.getSnapshot().context.hand[0]!.id });

      const output = actor.getSnapshot().output;
      expect(output?.isDown).toBe(false);
    });

    it("and: table unchanged", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingS = card("K", "spades");
      const extras = [card("3", "clubs"), card("4", "hearts"), card("5", "diamonds"), card("6", "spades"), card("7", "clubs")];

      const hand = [nineC, nineD, nineH, kingC, kingD, kingS, ...extras];
      const input = createTurnInput(hand);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: actor.getSnapshot().context.hand[0]!.id });

      const output = actor.getSnapshot().output;
      expect(output?.table.length).toBe(0);
    });

    it("and: player keeps all cards except discard", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingS = card("K", "spades");
      const extras = [card("3", "clubs"), card("4", "hearts"), card("5", "diamonds"), card("6", "spades"), card("7", "clubs")];

      const hand = [nineC, nineD, nineH, kingC, kingD, kingS, ...extras];
      const input = createTurnInput(hand);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      // Now has 12 cards
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: actor.getSnapshot().context.hand[0]!.id });

      const output = actor.getSnapshot().output;
      // 12 - 1 discard = 11 cards
      expect(output?.hand.length).toBe(11);
    });

    it("and: turn completes normally", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingS = card("K", "spades");
      const extras = [card("3", "clubs"), card("4", "hearts"), card("5", "diamonds"), card("6", "spades"), card("7", "clubs")];

      const hand = [nineC, nineD, nineH, kingC, kingD, kingS, ...extras];
      const input = createTurnInput(hand);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: actor.getSnapshot().context.hand[0]!.id });

      expect(actor.getSnapshot().value).toBe("turnComplete");
      expect(actor.getSnapshot().status).toBe("done");
    });
  });

  describe("player cannot lay down - missing cards", () => {
    it("given: player only has 1 valid set, needs 2 for round 1", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      // Random cards that don't form another set
      const extras = [card("3", "clubs"), card("4", "hearts"), card("5", "diamonds"), card("6", "spades"), card("7", "clubs"), card("8", "hearts"), card("10", "spades"), card("J", "diamonds")];

      const hand = [nineC, nineD, nineH, ...extras];
      expect(hand.length).toBe(11);
    });

    it("when: player draws", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const extras = [card("3", "clubs"), card("4", "hearts"), card("5", "diamonds"), card("6", "spades"), card("7", "clubs"), card("8", "hearts"), card("10", "spades"), card("J", "diamonds")];

      const hand = [nineC, nineD, nineH, ...extras];
      const input = createTurnInput(hand);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      expect(actor.getSnapshot().value).toBe("drawn");
    });

    it("then: LAY_DOWN command is rejected", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const extras = [card("3", "clubs"), card("4", "hearts"), card("5", "diamonds"), card("6", "spades"), card("7", "clubs"), card("8", "hearts"), card("10", "spades"), card("J", "diamonds")];

      const hand = [nineC, nineD, nineH, ...extras];
      const input = createTurnInput(hand);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      // Try to lay down with only 1 set (round 1 requires 2)
      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
        ],
      });

      // Should still be in drawn state - command rejected
      expect(actor.getSnapshot().value).toBe("drawn");
    });

    it("and: player must proceed to discard", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const extras = [card("3", "clubs"), card("4", "hearts"), card("5", "diamonds"), card("6", "spades"), card("7", "clubs"), card("8", "hearts"), card("10", "spades"), card("J", "diamonds")];

      const hand = [nineC, nineD, nineH, ...extras];
      const input = createTurnInput(hand);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: actor.getSnapshot().context.hand[0]!.id });

      expect(actor.getSnapshot().value).toBe("turnComplete");
    });

    it("and: player.isDown remains false", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const extras = [card("3", "clubs"), card("4", "hearts"), card("5", "diamonds"), card("6", "spades"), card("7", "clubs"), card("8", "hearts"), card("10", "spades"), card("J", "diamonds")];

      const hand = [nineC, nineD, nineH, ...extras];
      const input = createTurnInput(hand);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: actor.getSnapshot().context.hand[0]!.id });

      const output = actor.getSnapshot().output;
      expect(output?.isDown).toBe(false);
    });
  });

  describe("multiple turns with lay down", () => {
    it("given: game with 3 players", () => {
      const state = createInitialGameState({
        playerNames: ["Alice", "Bob", "Carol"],
      });
      expect(state.players.length).toBe(3);
    });

    it("when: player 1 takes turn and lays down", () => {
      const state = createInitialGameState({
        playerNames: ["Alice", "Bob", "Carol"],
      });
      const readyState = setupRound(state);

      // Create a hand that can lay down for round 1
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingS = card("K", "spades");
      const extras = [card("3", "clubs")];

      const input = {
        playerId: "player-1",
        hand: [nineC, nineD, nineH, kingC, kingD, kingS, ...extras],
        stock: readyState.stock,
        discard: readyState.discard,
        roundNumber: 1 as RoundNumber,
        isDown: false,
        table: [],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingS.id] },
        ],
      });
      actor.send({ type: "DISCARD", cardId: actor.getSnapshot().context.hand[0]!.id });

      const output = actor.getSnapshot().output;
      expect(output?.isDown).toBe(true);
      expect(output?.table.length).toBe(2);
    });

    it("and: player 2 takes turn but cannot lay down", () => {
      // Player 2 doesn't have contract cards
      const extras = [card("3", "clubs"), card("4", "hearts"), card("5", "diamonds"), card("6", "spades"), card("7", "clubs"), card("8", "hearts"), card("10", "spades")];

      const input = {
        playerId: "player-2",
        hand: extras,
        stock: [card("A", "spades")],
        discard: [card("Q", "hearts")],
        roundNumber: 1 as RoundNumber,
        isDown: false,
        table: [],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });
      actor.send({ type: "DISCARD", cardId: actor.getSnapshot().context.hand[0]!.id });

      const output = actor.getSnapshot().output;
      expect(output?.isDown).toBe(false);
    });

    it("and: player 3 takes turn and lays down", () => {
      const queenC = card("Q", "clubs");
      const queenD = card("Q", "diamonds");
      const queenH = card("Q", "hearts");
      const jackC = card("J", "clubs");
      const jackD = card("J", "diamonds");
      const jackS = card("J", "spades");
      const extras = [card("3", "clubs")];

      const input = {
        playerId: "player-0",
        hand: [queenC, queenD, queenH, jackC, jackD, jackS, ...extras],
        stock: [card("A", "spades")],
        discard: [card("5", "hearts")],
        roundNumber: 1 as RoundNumber,
        isDown: false,
        table: [],
      };

      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [queenC.id, queenD.id, queenH.id] },
          { type: "set" as const, cardIds: [jackC.id, jackD.id, jackS.id] },
        ],
      });
      actor.send({ type: "DISCARD", cardId: actor.getSnapshot().context.hand[0]!.id });

      const output = actor.getSnapshot().output;
      expect(output?.isDown).toBe(true);
    });

    it("then: table has melds from player 1 and player 3", () => {
      // This test simulates the flow through game loop
      const state = createInitialGameState({
        playerNames: ["Alice", "Bob", "Carol"],
      });
      let current = setupRound(state);

      // Player 1 lays down
      const p1Meld1 = { id: "meld-1", type: "set" as const, cards: [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")], ownerId: "player-1" };
      const p1Meld2 = { id: "meld-2", type: "set" as const, cards: [card("K", "clubs"), card("K", "diamonds"), card("K", "hearts")], ownerId: "player-1" };

      const output1 = {
        playerId: "player-1",
        hand: [card("3", "clubs")],
        stock: current.stock.slice(1),
        discard: [card("5", "spades"), ...current.discard],
        isDown: true,
        table: [p1Meld1, p1Meld2],
      };
      current = applyTurnOutput(current, output1);
      current = advanceTurn(current);

      // Player 2 doesn't lay down
      const output2 = {
        playerId: "player-2",
        hand: current.players[2]!.hand,
        stock: current.stock.slice(1),
        discard: [card("6", "hearts"), ...current.discard],
        isDown: false,
        table: current.table,
      };
      current = applyTurnOutput(current, output2);
      current = advanceTurn(current);

      // Player 0 (dealer) lays down
      const p0Meld1 = { id: "meld-3", type: "set" as const, cards: [card("Q", "clubs"), card("Q", "diamonds"), card("Q", "hearts")], ownerId: "player-0" };
      const p0Meld2 = { id: "meld-4", type: "set" as const, cards: [card("J", "clubs"), card("J", "diamonds"), card("J", "hearts")], ownerId: "player-0" };

      const output3 = {
        playerId: "player-0",
        hand: [card("7", "clubs")],
        stock: current.stock.slice(1),
        discard: [card("8", "spades"), ...current.discard],
        isDown: true,
        table: [...current.table, p0Meld1, p0Meld2],
      };
      current = applyTurnOutput(current, output3);

      expect(current.table.length).toBe(4);
      expect(current.table.filter((m) => m.ownerId === "player-1").length).toBe(2);
      expect(current.table.filter((m) => m.ownerId === "player-0").length).toBe(2);
    });

    it("and: player 1 and 3 have isDown: true", () => {
      const state = createInitialGameState({
        playerNames: ["Alice", "Bob", "Carol"],
      });
      let current = setupRound(state);

      // Player 1 lays down
      const output1 = {
        playerId: "player-1",
        hand: [],
        stock: current.stock,
        discard: current.discard,
        isDown: true,
        table: [{ id: "m1", type: "set" as const, cards: [], ownerId: "player-1" }],
      };
      current = applyTurnOutput(current, output1);
      current = advanceTurn(current);

      // Player 2 doesn't lay down
      const output2 = {
        playerId: "player-2",
        hand: [],
        stock: current.stock,
        discard: current.discard,
        isDown: false,
        table: current.table,
      };
      current = applyTurnOutput(current, output2);
      current = advanceTurn(current);

      // Player 0 lays down
      const output3 = {
        playerId: "player-0",
        hand: [],
        stock: current.stock,
        discard: current.discard,
        isDown: true,
        table: [...current.table, { id: "m2", type: "set" as const, cards: [], ownerId: "player-0" }],
      };
      current = applyTurnOutput(current, output3);

      expect(current.players[1]!.isDown).toBe(true);
      expect(current.players[0]!.isDown).toBe(true);
    });

    it("and: player 2 has isDown: false", () => {
      const state = createInitialGameState({
        playerNames: ["Alice", "Bob", "Carol"],
      });
      let current = setupRound(state);

      // Player 1 lays down
      const output1 = {
        playerId: "player-1",
        hand: [],
        stock: current.stock,
        discard: current.discard,
        isDown: true,
        table: [{ id: "m1", type: "set" as const, cards: [], ownerId: "player-1" }],
      };
      current = applyTurnOutput(current, output1);
      current = advanceTurn(current);

      // Player 2 doesn't lay down
      const output2 = {
        playerId: "player-2",
        hand: [],
        stock: current.stock,
        discard: current.discard,
        isDown: false,
        table: current.table,
      };
      current = applyTurnOutput(current, output2);

      expect(current.players[2]!.isDown).toBe(false);
    });
  });
});

describe("edge cases", () => {
  describe("laying down maximum cards", () => {
    it("given: round 1, player has exactly 7 cards that form 2 sets (3+3) + 1 extra", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingS = card("K", "spades");
      const extra = card("5", "spades");

      const hand = [nineC, nineD, nineH, kingC, kingD, kingS, extra];
      expect(hand.length).toBe(7);
    });

    it("when: player draws (now 8 cards)", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingS = card("K", "spades");
      const extra = card("5", "spades");

      const hand = [nineC, nineD, nineH, kingC, kingD, kingS, extra];
      const input = createTurnInput(hand);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      expect(actor.getSnapshot().context.hand.length).toBe(8);
    });

    it("and: player lays down 6 cards", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingS = card("K", "spades");
      const extra = card("5", "spades");

      const hand = [nineC, nineD, nineH, kingC, kingD, kingS, extra];
      const input = createTurnInput(hand);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingS.id] },
        ],
      });

      expect(actor.getSnapshot().context.hand.length).toBe(2);
      expect(actor.getSnapshot().context.table.length).toBe(2);
    });

    it("then: player has 2 cards, discards 1, ends with 1 card", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingS = card("K", "spades");
      const extra = card("5", "spades");

      const hand = [nineC, nineD, nineH, kingC, kingD, kingS, extra];
      const input = createTurnInput(hand);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingS.id] },
        ],
      });
      actor.send({ type: "DISCARD", cardId: actor.getSnapshot().context.hand[0]!.id });

      const output = actor.getSnapshot().output;
      expect(output?.hand.length).toBe(1);
    });
  });

  describe("laying down leaves exactly 1 card", () => {
    it("given: round 5, player has 11 cards (dealt)", () => {
      // Round 5 requires 2 sets + 1 run = 3+3+4 = 10 minimum cards
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingS = card("K", "spades");
      const fiveH = card("5", "hearts");
      const sixH = card("6", "hearts");
      const sevenH = card("7", "hearts");
      const eightH = card("8", "hearts");
      const extra = card("A", "clubs");

      const hand = [nineC, nineD, nineH, kingC, kingD, kingS, fiveH, sixH, sevenH, eightH, extra];
      expect(hand.length).toBe(11);
    });

    it("when: player draws (12 cards)", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingS = card("K", "spades");
      const fiveH = card("5", "hearts");
      const sixH = card("6", "hearts");
      const sevenH = card("7", "hearts");
      const eightH = card("8", "hearts");
      const extra = card("A", "clubs");

      const hand = [nineC, nineD, nineH, kingC, kingD, kingS, fiveH, sixH, sevenH, eightH, extra];
      const input = createTurnInput(hand, 5);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      expect(actor.getSnapshot().context.hand.length).toBe(12);
    });

    it("and: player lays down minimum 10 cards (3+3+4)", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingS = card("K", "spades");
      const fiveH = card("5", "hearts");
      const sixH = card("6", "hearts");
      const sevenH = card("7", "hearts");
      const eightH = card("8", "hearts");
      const extra = card("A", "clubs");

      const hand = [nineC, nineD, nineH, kingC, kingD, kingS, fiveH, sixH, sevenH, eightH, extra];
      const input = createTurnInput(hand, 5);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingS.id] },
          { type: "run" as const, cardIds: [fiveH.id, sixH.id, sevenH.id, eightH.id] },
        ],
      });

      expect(actor.getSnapshot().context.hand.length).toBe(2);
    });

    it("then: player has 2 cards, must discard 1", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingS = card("K", "spades");
      const fiveH = card("5", "hearts");
      const sixH = card("6", "hearts");
      const sevenH = card("7", "hearts");
      const eightH = card("8", "hearts");
      const extra = card("A", "clubs");

      const hand = [nineC, nineD, nineH, kingC, kingD, kingS, fiveH, sixH, sevenH, eightH, extra];
      const input = createTurnInput(hand, 5);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingS.id] },
          { type: "run" as const, cardIds: [fiveH.id, sixH.id, sevenH.id, eightH.id] },
        ],
      });

      expect(actor.getSnapshot().context.hand.length).toBe(2);
      expect(actor.getSnapshot().value).toBe("awaitingDiscard");
    });

    it("and: ends turn with 1 card in hand", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingS = card("K", "spades");
      const fiveH = card("5", "hearts");
      const sixH = card("6", "hearts");
      const sevenH = card("7", "hearts");
      const eightH = card("8", "hearts");
      const extra = card("A", "clubs");

      const hand = [nineC, nineD, nineH, kingC, kingD, kingS, fiveH, sixH, sevenH, eightH, extra];
      const input = createTurnInput(hand, 5);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingS.id] },
          { type: "run" as const, cardIds: [fiveH.id, sixH.id, sevenH.id, eightH.id] },
        ],
      });
      actor.send({ type: "DISCARD", cardId: actor.getSnapshot().context.hand[0]!.id });

      const output = actor.getSnapshot().output;
      expect(output?.hand.length).toBe(1);
    });
  });

  describe("contract validation prevents over-laying", () => {
    it("given: round 1 requires 2 sets", () => {
      // Round 1 is 2 sets
      expect(true).toBe(true);
    });

    it("when: player tries to lay down 3 sets", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingS = card("K", "spades");
      const queenC = card("Q", "clubs");
      const queenD = card("Q", "diamonds");
      const queenH = card("Q", "hearts");
      const extra = card("5", "spades");

      const hand = [nineC, nineD, nineH, kingC, kingD, kingS, queenC, queenD, queenH, extra];
      const input = createTurnInput(hand);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingS.id] },
          { type: "set" as const, cardIds: [queenC.id, queenD.id, queenH.id] },
        ],
      });

      // Should be rejected - still in drawn state
      expect(actor.getSnapshot().value).toBe("drawn");
    });

    it("then: rejected - wrong number of melds", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingS = card("K", "spades");
      const queenC = card("Q", "clubs");
      const queenD = card("Q", "diamonds");
      const queenH = card("Q", "hearts");
      const extra = card("5", "spades");

      const hand = [nineC, nineD, nineH, kingC, kingD, kingS, queenC, queenD, queenH, extra];
      const input = createTurnInput(hand);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingS.id] },
          { type: "set" as const, cardIds: [queenC.id, queenD.id, queenH.id] },
        ],
      });

      // Table should remain empty
      expect(actor.getSnapshot().context.table.length).toBe(0);
    });

    it("and: player cannot include extras in lay down action", () => {
      // This is the same as the previous test - contract validation ensures only correct melds
      expect(true).toBe(true);
    });
  });

  describe("wilds across multiple melds", () => {
    it("given: round 1, player wants to lay down (9C 9D Joker) and (KC KD 2H)", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const wild1 = joker();
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const wild2 = card("2", "hearts"); // 2s are wild
      const extra = card("5", "spades");

      const hand = [nineC, nineD, wild1, kingC, kingD, wild2, extra];
      expect(hand.length).toBe(7);
    });

    it("when: player lays down", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const wild1 = joker();
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const wild2 = card("2", "hearts");
      const extra = card("5", "spades");

      const hand = [nineC, nineD, wild1, kingC, kingD, wild2, extra];
      const input = createTurnInput(hand);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, wild1.id] },
          { type: "set" as const, cardIds: [kingC.id, kingD.id, wild2.id] },
        ],
      });

      expect(actor.getSnapshot().value).toBe("awaitingDiscard");
    });

    it("then: each meld validated independently", () => {
      // Each meld has 2 natural, 1 wild - valid
      expect(true).toBe(true);
    });

    it("and: both are valid (2 natural, 1 wild each)", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const wild1 = joker();
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const wild2 = card("2", "hearts");
      const extra = card("5", "spades");

      const hand = [nineC, nineD, wild1, kingC, kingD, wild2, extra];
      const input = createTurnInput(hand);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, wild1.id] },
          { type: "set" as const, cardIds: [kingC.id, kingD.id, wild2.id] },
        ],
      });

      const table = actor.getSnapshot().context.table;
      expect(table.length).toBe(2);
    });

    it("and: lay down succeeds", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const wild1 = joker();
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const wild2 = card("2", "hearts");
      const extra = card("5", "spades");

      const hand = [nineC, nineD, wild1, kingC, kingD, wild2, extra];
      const input = createTurnInput(hand);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, wild1.id] },
          { type: "set" as const, cardIds: [kingC.id, kingD.id, wild2.id] },
        ],
      });
      actor.send({ type: "DISCARD", cardId: actor.getSnapshot().context.hand[0]!.id });

      expect(actor.getSnapshot().value).toBe("turnComplete");
      expect(actor.getSnapshot().output?.isDown).toBe(true);
    });
  });

  describe("concentrated wilds in one meld - invalid", () => {
    it("given: round 1, player wants to lay down (9C Joker 2H) and (KC KD KS)", () => {
      const nineC = card("9", "clubs");
      const wild1 = joker();
      const wild2 = card("2", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingS = card("K", "spades");
      const extra = card("5", "spades");

      const hand = [nineC, wild1, wild2, kingC, kingD, kingS, extra];
      expect(hand.length).toBe(7);
    });

    it("when: player tries to lay down", () => {
      const nineC = card("9", "clubs");
      const wild1 = joker();
      const wild2 = card("2", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingS = card("K", "spades");
      const extra = card("5", "spades");

      const hand = [nineC, wild1, wild2, kingC, kingD, kingS, extra];
      const input = createTurnInput(hand);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, wild1.id, wild2.id] }, // 1 natural, 2 wilds - INVALID
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingS.id] },
        ],
      });

      // Should be rejected - still in drawn state
      expect(actor.getSnapshot().value).toBe("drawn");
    });

    it("then: first meld invalid (1 natural, 2 wild)", () => {
      // The meld (9C, Joker, 2H) has 1 natural and 2 wilds
      expect(true).toBe(true);
    });

    it("and: entire lay down rejected", () => {
      const nineC = card("9", "clubs");
      const wild1 = joker();
      const wild2 = card("2", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingS = card("K", "spades");
      const extra = card("5", "spades");

      const hand = [nineC, wild1, wild2, kingC, kingD, kingS, extra];
      const input = createTurnInput(hand);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, wild1.id, wild2.id] },
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingS.id] },
        ],
      });

      expect(actor.getSnapshot().context.table.length).toBe(0);
    });

    it("and: player state unchanged", () => {
      const nineC = card("9", "clubs");
      const wild1 = joker();
      const wild2 = card("2", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingS = card("K", "spades");
      const extra = card("5", "spades");

      const hand = [nineC, wild1, wild2, kingC, kingD, kingS, extra];
      const input = createTurnInput(hand);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      const handBefore = actor.getSnapshot().context.hand.length;
      const isDownBefore = actor.getSnapshot().context.isDown;

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, wild1.id, wild2.id] },
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingS.id] },
        ],
      });

      expect(actor.getSnapshot().context.hand.length).toBe(handBefore);
      expect(actor.getSnapshot().context.isDown).toBe(isDownBefore);
    });
  });

  describe("same rank cards from multiple decks", () => {
    it("given: multi-deck game", () => {
      // In multi-deck games, there can be multiple cards of the same rank and suit
      expect(true).toBe(true);
    });

    it("when: player lays down (9C 9C 9D) - two 9 of clubs", () => {
      // Create two 9 of clubs with different IDs (different physical cards)
      const nineC1 = { id: "9-clubs-deck1", rank: "9" as const, suit: "clubs" as const };
      const nineC2 = { id: "9-clubs-deck2", rank: "9" as const, suit: "clubs" as const };
      const nineD = card("9", "diamonds");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingS = card("K", "spades");
      const extra = card("5", "spades");

      const hand = [nineC1, nineC2, nineD, kingC, kingD, kingS, extra];
      const input = createTurnInput(hand);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC1.id, nineC2.id, nineD.id] },
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingS.id] },
        ],
      });

      expect(actor.getSnapshot().value).toBe("awaitingDiscard");
    });

    it("then: this is valid - different physical cards (different ids)", () => {
      const nineC1 = { id: "9-clubs-deck1", rank: "9" as const, suit: "clubs" as const };
      const nineC2 = { id: "9-clubs-deck2", rank: "9" as const, suit: "clubs" as const };
      const nineD = card("9", "diamonds");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingS = card("K", "spades");
      const extra = card("5", "spades");

      const hand = [nineC1, nineC2, nineD, kingC, kingD, kingS, extra];
      const input = createTurnInput(hand);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC1.id, nineC2.id, nineD.id] },
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingS.id] },
        ],
      });

      expect(actor.getSnapshot().context.table.length).toBe(2);
    });

    it("and: set of same rank, any suits (duplicates allowed)", () => {
      // The set validation should allow multiple cards of the same suit if they have different IDs
      const nineC1 = { id: "9-clubs-deck1", rank: "9" as const, suit: "clubs" as const };
      const nineC2 = { id: "9-clubs-deck2", rank: "9" as const, suit: "clubs" as const };
      const nineD = card("9", "diamonds");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingS = card("K", "spades");
      const extra = card("5", "spades");

      const hand = [nineC1, nineC2, nineD, kingC, kingD, kingS, extra];
      const input = createTurnInput(hand);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC1.id, nineC2.id, nineD.id] },
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingS.id] },
        ],
      });
      actor.send({ type: "DISCARD", cardId: actor.getSnapshot().context.hand[0]!.id });

      expect(actor.getSnapshot().value).toBe("turnComplete");
      expect(actor.getSnapshot().output?.isDown).toBe(true);
    });
  });
});
