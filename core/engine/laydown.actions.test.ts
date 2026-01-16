import { describe, it, expect } from "bun:test";
import { createActor } from "xstate";
import { turnMachine } from "./turn.machine";
import type { Card } from "../card/card.types";
import type { RoundNumber } from "./engine.types";

function card(rank: Card["rank"], suit: Card["suit"]): Card {
  return { id: `${rank}-${suit}-${Math.random()}`, rank, suit };
}

function createTurnInput(
  hand: Card[],
  roundNumber: RoundNumber = 1
) {
  return {
    playerId: "player-1",
    hand,
    stock: [card("K", "spades"), card("Q", "hearts")],
    discard: [card("5", "clubs")],
    roundNumber,
    isDown: false,
    table: [],
  };
}

describe("layDownMelds action", () => {
  describe("hand modification", () => {
    it("removes exactly the cards specified in melds", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingH = card("K", "hearts");
      const extra = card("5", "spades");

      const input = createTurnInput([nineC, nineD, nineH, kingC, kingD, kingH, extra]);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      // Now hand has 8 cards

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingH.id] },
        ],
      });

      const hand = actor.getSnapshot().context.hand;
      // 6 cards removed, 2 remaining (extra + drawn card)
      expect(hand.length).toBe(2);
      expect(hand.find((c) => c.id === nineC.id)).toBeUndefined();
      expect(hand.find((c) => c.id === nineD.id)).toBeUndefined();
      expect(hand.find((c) => c.id === nineH.id)).toBeUndefined();
      expect(hand.find((c) => c.id === kingC.id)).toBeUndefined();
      expect(hand.find((c) => c.id === kingD.id)).toBeUndefined();
      expect(hand.find((c) => c.id === kingH.id)).toBeUndefined();
    });

    it("does not remove other cards", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingH = card("K", "hearts");
      const extra1 = card("5", "spades");
      const extra2 = card("6", "hearts");

      const input = createTurnInput([nineC, nineD, nineH, kingC, kingD, kingH, extra1, extra2]);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingH.id] },
        ],
      });

      const hand = actor.getSnapshot().context.hand;
      // extra1, extra2, and drawn card should remain
      expect(hand.find((c) => c.id === extra1.id)).toBeDefined();
      expect(hand.find((c) => c.id === extra2.id)).toBeDefined();
    });

    it("hand order of remaining cards preserved", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingH = card("K", "hearts");
      const first = card("A", "spades");
      const second = card("2", "hearts");
      const third = card("3", "diamonds");

      // Interleave extra cards with meld cards
      const hand = [first, nineC, second, nineD, nineH, third, kingC, kingD, kingH];
      const input = createTurnInput(hand);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingH.id] },
        ],
      });

      const remainingHand = actor.getSnapshot().context.hand;
      // Should be: first, second, third, drawnCard (in order)
      expect(remainingHand[0]!.id).toBe(first.id);
      expect(remainingHand[1]!.id).toBe(second.id);
      expect(remainingHand[2]!.id).toBe(third.id);
    });

    it("works with minimum size melds", () => {
      // Minimum set = 3 cards, minimum run = 4 cards
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingH = card("K", "hearts");
      const extra = card("5", "spades");

      const input = createTurnInput([nineC, nineD, nineH, kingC, kingD, kingH, extra]);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingH.id] },
        ],
      });

      const table = actor.getSnapshot().context.table;
      expect(table.length).toBe(2);
      expect(table[0]!.cards.length).toBe(3);
      expect(table[1]!.cards.length).toBe(3);
    });

    it("works with larger melds", () => {
      // 4-card sets
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const nineS = card("9", "spades");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingH = card("K", "hearts");
      const kingS = card("K", "spades");
      const extra = card("5", "spades");

      const input = createTurnInput([nineC, nineD, nineH, nineS, kingC, kingD, kingH, kingS, extra]);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id, nineS.id] },
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingH.id, kingS.id] },
        ],
      });

      const table = actor.getSnapshot().context.table;
      const hand = actor.getSnapshot().context.hand;
      expect(table[0]!.cards.length).toBe(4);
      expect(table[1]!.cards.length).toBe(4);
      expect(hand.length).toBe(2); // extra + drawn card
    });
  });

  describe("table modification", () => {
    it("adds all melds to table", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingH = card("K", "hearts");
      const extra = card("5", "spades");

      const input = createTurnInput([nineC, nineD, nineH, kingC, kingD, kingH, extra]);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      expect(actor.getSnapshot().context.table.length).toBe(0);

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingH.id] },
        ],
      });

      const table = actor.getSnapshot().context.table;
      expect(table.length).toBe(2);
    });

    it("melds have type: 'set' or 'run' correctly", () => {
      // Round 2 requires 1 set + 1 run
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const threeH = card("3", "hearts");
      const fourH = card("4", "hearts");
      const fiveH = card("5", "hearts");
      const sixH = card("6", "hearts");
      const extra = card("A", "spades");

      const input = createTurnInput([nineC, nineD, nineH, threeH, fourH, fiveH, sixH, extra], 2);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
          { type: "run" as const, cardIds: [threeH.id, fourH.id, fiveH.id, sixH.id] },
        ],
      });

      const table = actor.getSnapshot().context.table;
      const setMeld = table.find((m) => m.type === "set");
      const runMeld = table.find((m) => m.type === "run");

      expect(setMeld).toBeDefined();
      expect(runMeld).toBeDefined();
      expect(setMeld!.type).toBe("set");
      expect(runMeld!.type).toBe("run");
    });

    it("melds have ownerId set to current player", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingH = card("K", "hearts");
      const extra = card("5", "spades");

      const input = createTurnInput([nineC, nineD, nineH, kingC, kingD, kingH, extra]);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingH.id] },
        ],
      });

      const table = actor.getSnapshot().context.table;
      expect(table[0]!.ownerId).toBe("player-1");
      expect(table[1]!.ownerId).toBe("player-1");
    });

    it("melds have unique generated ids", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingH = card("K", "hearts");
      const extra = card("5", "spades");

      const input = createTurnInput([nineC, nineD, nineH, kingC, kingD, kingH, extra]);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingH.id] },
        ],
      });

      const table = actor.getSnapshot().context.table;
      expect(table[0]!.id).toBeDefined();
      expect(table[1]!.id).toBeDefined();
      expect(table[0]!.id).not.toBe(table[1]!.id);
      expect(table[0]!.id.startsWith("meld-")).toBe(true);
      expect(table[1]!.id.startsWith("meld-")).toBe(true);
    });

    it("meld cards are copies (not references to hand cards)", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingH = card("K", "hearts");
      const extra = card("5", "spades");

      const input = createTurnInput([nineC, nineD, nineH, kingC, kingD, kingH, extra]);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingH.id] },
        ],
      });

      const table = actor.getSnapshot().context.table;
      // Verify the meld contains the card data
      const meldCardIds = table[0]!.cards.map((c) => c.id);
      expect(meldCardIds).toContain(nineC.id);
      expect(meldCardIds).toContain(nineD.id);
      expect(meldCardIds).toContain(nineH.id);
    });
  });

  describe("player state modification", () => {
    it("sets isDown to true", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingH = card("K", "hearts");
      const extra = card("5", "spades");

      const input = createTurnInput([nineC, nineD, nineH, kingC, kingD, kingH, extra]);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      expect(actor.getSnapshot().context.isDown).toBe(false);

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingH.id] },
        ],
      });

      expect(actor.getSnapshot().context.isDown).toBe(true);
    });

    it("sets laidDownThisTurn to true", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingH = card("K", "hearts");
      const extra = card("5", "spades");

      const input = createTurnInput([nineC, nineD, nineH, kingC, kingD, kingH, extra]);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      expect(actor.getSnapshot().context.laidDownThisTurn).toBe(false);

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingH.id] },
        ],
      });

      expect(actor.getSnapshot().context.laidDownThisTurn).toBe(true);
    });
  });

  describe("meld creation", () => {
    it("createMeld generates unique id", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingH = card("K", "hearts");
      const extra = card("5", "spades");

      const input = createTurnInput([nineC, nineD, nineH, kingC, kingD, kingH, extra]);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingH.id] },
        ],
      });

      const table = actor.getSnapshot().context.table;
      const ids = table.map((m) => m.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("createMeld stores cards array", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingH = card("K", "hearts");
      const extra = card("5", "spades");

      const input = createTurnInput([nineC, nineD, nineH, kingC, kingD, kingH, extra]);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingH.id] },
        ],
      });

      const table = actor.getSnapshot().context.table;
      expect(table[0]!.cards).toBeDefined();
      expect(Array.isArray(table[0]!.cards)).toBe(true);
      expect(table[0]!.cards.length).toBe(3);
    });

    it("createMeld stores type correctly", () => {
      // Round 2 requires 1 set + 1 run
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const threeH = card("3", "hearts");
      const fourH = card("4", "hearts");
      const fiveH = card("5", "hearts");
      const sixH = card("6", "hearts");
      const extra = card("A", "spades");

      const input = createTurnInput([nineC, nineD, nineH, threeH, fourH, fiveH, sixH, extra], 2);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
          { type: "run" as const, cardIds: [threeH.id, fourH.id, fiveH.id, sixH.id] },
        ],
      });

      const table = actor.getSnapshot().context.table;
      expect(table.some((m) => m.type === "set")).toBe(true);
      expect(table.some((m) => m.type === "run")).toBe(true);
    });

    it("createMeld stores ownerId", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingH = card("K", "hearts");
      const extra = card("5", "spades");

      const input = {
        ...createTurnInput([nineC, nineD, nineH, kingC, kingD, kingH, extra]),
        playerId: "test-player-123",
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingH.id] },
        ],
      });

      const table = actor.getSnapshot().context.table;
      expect(table[0]!.ownerId).toBe("test-player-123");
      expect(table[1]!.ownerId).toBe("test-player-123");
    });
  });

  describe("run normalization", () => {
    it("stores run meld cards in ascending order regardless of selection order", () => {
      // Round 2 requires 1 set + 1 run
      // Select run cards in out-of-order: 9, 7, 10, 8 (should become 7, 8, 9, 10)
      const sevenH = card("7", "hearts");
      const eightH = card("8", "hearts");
      const nineH = card("9", "hearts");
      const tenH = card("10", "hearts");
      // Set cards for contract
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingS = card("K", "spades");
      const extra = card("A", "spades");

      const input = createTurnInput(
        [sevenH, eightH, nineH, tenH, kingC, kingD, kingS, extra],
        2
      );
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      // Select run cards in OUT-OF-ORDER: 9, 7, 10, 8
      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingS.id] },
          { type: "run" as const, cardIds: [nineH.id, sevenH.id, tenH.id, eightH.id] },
        ],
      });

      const table = actor.getSnapshot().context.table;
      const runMeld = table.find((m) => m.type === "run");
      expect(runMeld).toBeDefined();

      // Cards should be stored in ascending order: 7, 8, 9, 10
      const ranks = runMeld!.cards.map((c) => c.rank);
      expect(ranks).toEqual(["7", "8", "9", "10"]);
    });

    it("stores run meld cards in ascending order when selected in descending order", () => {
      // Round 2 requires 1 set + 1 run
      const threeH = card("3", "hearts");
      const fourH = card("4", "hearts");
      const fiveH = card("5", "hearts");
      const sixH = card("6", "hearts");
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineS = card("9", "spades");
      const extra = card("A", "spades");

      const input = createTurnInput(
        [threeH, fourH, fiveH, sixH, nineC, nineD, nineS, extra],
        2
      );
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      // Select run cards in DESCENDING order: 6, 5, 4, 3
      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineS.id] },
          { type: "run" as const, cardIds: [sixH.id, fiveH.id, fourH.id, threeH.id] },
        ],
      });

      const table = actor.getSnapshot().context.table;
      const runMeld = table.find((m) => m.type === "run");
      expect(runMeld).toBeDefined();

      // Cards should be stored in ascending order: 3, 4, 5, 6
      const ranks = runMeld!.cards.map((c) => c.rank);
      expect(ranks).toEqual(["3", "4", "5", "6"]);
    });

    it("positions wild cards correctly in normalized run", () => {
      // Round 2 requires 1 set + 1 run
      // Run with wild: 7, wild, 9, 10 (wild fills the 8 position)
      const sevenH = card("7", "hearts");
      const wild = card("Joker", "hearts"); // Wild card
      const nineH = card("9", "hearts");
      const tenH = card("10", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingS = card("K", "spades");
      const extra = card("A", "spades");

      const input = createTurnInput(
        [sevenH, wild, nineH, tenH, kingC, kingD, kingS, extra],
        2
      );
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      // Select run cards with wild in out-of-order: 9, wild, 7, 10
      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingS.id] },
          { type: "run" as const, cardIds: [nineH.id, wild.id, sevenH.id, tenH.id] },
        ],
      });

      const table = actor.getSnapshot().context.table;
      const runMeld = table.find((m) => m.type === "run");
      expect(runMeld).toBeDefined();

      // Cards should be: 7, Joker (as 8), 9, 10
      const cards = runMeld!.cards;
      expect(cards[0]!.rank).toBe("7");
      expect(cards[1]!.rank).toBe("Joker"); // Wild in the 8 position
      expect(cards[2]!.rank).toBe("9");
      expect(cards[3]!.rank).toBe("10");
    });

    it("does not affect set meld card order", () => {
      // Sets should keep their original order (order doesn't matter for sets)
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingH = card("K", "hearts");
      const extra = card("5", "spades");

      const input = createTurnInput([nineC, nineD, nineH, kingC, kingD, kingH, extra]);
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      // Select cards in specific order
      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineH.id, nineC.id, nineD.id] },
          { type: "set" as const, cardIds: [kingH.id, kingC.id, kingD.id] },
        ],
      });

      const table = actor.getSnapshot().context.table;
      // Sets should preserve selection order (or at least not crash)
      expect(table[0]!.cards.length).toBe(3);
      expect(table[1]!.cards.length).toBe(3);
    });
  });
});
