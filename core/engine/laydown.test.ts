import { describe, it, expect } from "bun:test";
import { createActor } from "xstate";
import { turnMachine } from "./turn.machine";
import type { Card } from "../card/card.types";

// Helper to create a card
function card(rank: Card["rank"], suit: Card["suit"]): Card {
  return { id: `${rank}-${suit}-${Math.random()}`, rank, suit };
}

// Helper to create a basic turn input
function createTurnInput() {
  return {
    playerId: "player-1",
    hand: [card("9", "clubs"), card("9", "diamonds"), card("9", "hearts")],
    stock: [card("K", "spades"), card("Q", "hearts")],
    discard: [card("5", "clubs")],
    roundNumber: 1 as const,
    isDown: false,
    table: [],
  };
}

describe("TurnMachine - drawn state", () => {
  describe("state structure", () => {
    it("after drawing, enters 'drawn' state (not directly to awaitingDiscard)", () => {
      const actor = createActor(turnMachine, { input: createTurnInput() });
      actor.start();

      expect(actor.getSnapshot().value).toBe("awaitingDraw");

      actor.send({ type: "DRAW_FROM_STOCK" });

      // Should now be in 'drawn' state, not 'awaitingDiscard'
      expect(actor.getSnapshot().value).toBe("drawn");
    });

    it("hasDrawn is true", () => {
      const actor = createActor(turnMachine, { input: createTurnInput() });
      actor.start();

      expect(actor.getSnapshot().context.hasDrawn).toBe(false);

      actor.send({ type: "DRAW_FROM_STOCK" });

      expect(actor.getSnapshot().context.hasDrawn).toBe(true);
    });

    it("player can choose to lay down or proceed to discard", () => {
      const actor = createActor(turnMachine, { input: createTurnInput() });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("drawn");

      // Check that both LAY_DOWN and SKIP_LAY_DOWN events are possible
      // We verify by checking the state allows these transitions
      expect(snapshot.can({ type: "SKIP_LAY_DOWN" })).toBe(true);
      // LAY_DOWN would require valid melds, so we just check the state structure
    });
  });

  describe("proceeding without laying down", () => {
    it("SKIP_LAY_DOWN transitions to 'awaitingDiscard'", () => {
      const actor = createActor(turnMachine, { input: createTurnInput() });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      expect(actor.getSnapshot().value).toBe("drawn");

      actor.send({ type: "SKIP_LAY_DOWN" });
      expect(actor.getSnapshot().value).toBe("awaitingDiscard");
    });

    it("player remains not down (isDown: false)", () => {
      const actor = createActor(turnMachine, { input: createTurnInput() });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "SKIP_LAY_DOWN" });

      expect(actor.getSnapshot().context.isDown).toBe(false);
    });

    it("hand unchanged (still has drawn card)", () => {
      const input = createTurnInput();
      const initialHandSize = input.hand.length;
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      const handAfterDraw = actor.getSnapshot().context.hand;
      expect(handAfterDraw.length).toBe(initialHandSize + 1);

      actor.send({ type: "SKIP_LAY_DOWN" });

      // Hand should still have the drawn card
      expect(actor.getSnapshot().context.hand.length).toBe(initialHandSize + 1);
      expect(actor.getSnapshot().context.hand).toEqual(handAfterDraw);
    });

    it("can proceed even if player could lay down (optional action)", () => {
      // Player has cards for a valid contract but chooses not to lay down
      const input = {
        ...createTurnInput(),
        hand: [
          // Two valid sets for round 1
          card("9", "clubs"), card("9", "diamonds"), card("9", "hearts"),
          card("K", "clubs"), card("K", "diamonds"), card("K", "hearts"),
          card("5", "spades"), // Extra card
        ],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      // Player can skip laying down even though they could
      actor.send({ type: "SKIP_LAY_DOWN" });
      expect(actor.getSnapshot().value).toBe("awaitingDiscard");
      expect(actor.getSnapshot().context.isDown).toBe(false);
    });
  });
});

describe("TurnMachine - LAY_DOWN command", () => {
  describe("preconditions", () => {
    it("rejects if player has not drawn yet (state is awaitingDraw)", () => {
      const input = createTurnInput();
      const actor = createActor(turnMachine, { input });
      actor.start();

      // Try to lay down before drawing
      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: ["c1", "c2", "c3"] },
          { type: "set" as const, cardIds: ["c4", "c5", "c6"] },
        ],
      });

      // Should still be in awaitingDraw
      expect(actor.getSnapshot().value).toBe("awaitingDraw");
    });

    it("rejects if player is already down this round (isDown: true)", () => {
      const input = {
        ...createTurnInput(),
        isDown: true, // Player already laid down this round
        hand: [
          card("9", "clubs"), card("9", "diamonds"), card("9", "hearts"),
          card("K", "clubs"), card("K", "diamonds"), card("K", "hearts"),
          card("5", "spades"),
        ],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      const handBefore = [...actor.getSnapshot().context.hand];

      // Try to lay down when already down
      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [handBefore[0]!.id, handBefore[1]!.id, handBefore[2]!.id] },
          { type: "set" as const, cardIds: [handBefore[3]!.id, handBefore[4]!.id, handBefore[5]!.id] },
        ],
      });

      // Should still be in drawn state, hand unchanged
      expect(actor.getSnapshot().value).toBe("drawn");
      expect(actor.getSnapshot().context.hand).toEqual(handBefore);
    });

    it("rejects if melds do not match contract", () => {
      const input = {
        ...createTurnInput(),
        roundNumber: 1 as const, // Round 1 needs 2 sets
        hand: [
          card("9", "clubs"), card("9", "diamonds"), card("9", "hearts"),
          card("5", "spades"), card("6", "spades"), card("7", "spades"), card("8", "spades"),
        ],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      const hand = actor.getSnapshot().context.hand;

      // Try to lay down 1 set + 1 run (wrong for round 1)
      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [hand[0]!.id, hand[1]!.id, hand[2]!.id] },
          { type: "run" as const, cardIds: [hand[3]!.id, hand[4]!.id, hand[5]!.id, hand[6]!.id] },
        ],
      });

      // Should still be in drawn state
      expect(actor.getSnapshot().value).toBe("drawn");
    });

    it("rejects if any meld is invalid", () => {
      const input = {
        ...createTurnInput(),
        hand: [
          // Invalid set - different ranks
          card("9", "clubs"), card("K", "diamonds"), card("5", "hearts"),
          card("K", "clubs"), card("K", "spades"), card("K", "hearts"),
        ],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      const hand = actor.getSnapshot().context.hand;

      // Try to lay down with invalid first set
      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [hand[0]!.id, hand[1]!.id, hand[2]!.id] }, // Invalid: different ranks
          { type: "set" as const, cardIds: [hand[3]!.id, hand[4]!.id, hand[5]!.id] }, // Valid
        ],
      });

      // Should still be in drawn state
      expect(actor.getSnapshot().value).toBe("drawn");
    });

    it("state unchanged on any rejection", () => {
      const input = {
        ...createTurnInput(),
        hand: [
          card("9", "clubs"), card("9", "diamonds"), card("9", "hearts"),
          card("K", "clubs"), card("K", "diamonds"), card("K", "hearts"),
        ],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      const contextBefore = actor.getSnapshot().context;
      const handBefore = [...contextBefore.hand];
      const tableBefore = [...contextBefore.table];

      // Send invalid lay down (wrong contract - only 1 set instead of 2)
      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [handBefore[0]!.id, handBefore[1]!.id, handBefore[2]!.id] },
        ],
      });

      const contextAfter = actor.getSnapshot().context;
      expect(contextAfter.hand).toEqual(handBefore);
      expect(contextAfter.table).toEqual(tableBefore);
      expect(contextAfter.isDown).toBe(false);
    });
  });

  describe("successful lay down - Round 1 (2 sets)", () => {
    it("accepts valid 2 sets", () => {
      const input = {
        ...createTurnInput(),
        roundNumber: 1 as const,
        hand: [
          card("9", "clubs"), card("9", "diamonds"), card("9", "hearts"),
          card("K", "clubs"), card("K", "diamonds"), card("K", "hearts"),
          card("5", "spades"),
        ],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      const hand = actor.getSnapshot().context.hand;
      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [hand[0]!.id, hand[1]!.id, hand[2]!.id] },
          { type: "set" as const, cardIds: [hand[3]!.id, hand[4]!.id, hand[5]!.id] },
        ],
      });

      // Should transition to awaitingDiscard
      expect(actor.getSnapshot().value).toBe("awaitingDiscard");
    });

    it("example: (9C 9D 9H) and (KC KD KS)", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingS = card("K", "spades");
      const extra = card("5", "spades");

      const input = {
        ...createTurnInput(),
        roundNumber: 1 as const,
        hand: [nineC, nineD, nineH, kingC, kingD, kingS, extra],
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

      expect(actor.getSnapshot().value).toBe("awaitingDiscard");
      expect(actor.getSnapshot().context.isDown).toBe(true);
    });

    it("removes meld cards from player's hand", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingS = card("K", "spades");
      const extra = card("5", "spades");

      const input = {
        ...createTurnInput(),
        roundNumber: 1 as const,
        hand: [nineC, nineD, nineH, kingC, kingD, kingS, extra],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      const handSizeBefore = actor.getSnapshot().context.hand.length;

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingS.id] },
        ],
      });

      const handAfter = actor.getSnapshot().context.hand;
      // 6 cards removed (2 sets of 3)
      expect(handAfter.length).toBe(handSizeBefore - 6);
      // Extra card and drawn card should remain
      expect(handAfter.find(c => c.id === extra.id)).toBeDefined();
      // Meld cards should be gone
      expect(handAfter.find(c => c.id === nineC.id)).toBeUndefined();
      expect(handAfter.find(c => c.id === kingC.id)).toBeUndefined();
    });

    it("adds melds to table", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingS = card("K", "spades");

      const input = {
        ...createTurnInput(),
        roundNumber: 1 as const,
        hand: [nineC, nineD, nineH, kingC, kingD, kingS, card("5", "spades")],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      expect(actor.getSnapshot().context.table.length).toBe(0);

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingS.id] },
        ],
      });

      const table = actor.getSnapshot().context.table;
      expect(table.length).toBe(2);
      expect(table[0]!.type).toBe("set");
      expect(table[0]!.cards.length).toBe(3);
      expect(table[1]!.type).toBe("set");
      expect(table[1]!.cards.length).toBe(3);
    });

    it("sets isDown to true", () => {
      const input = {
        ...createTurnInput(),
        roundNumber: 1 as const,
        hand: [
          card("9", "clubs"), card("9", "diamonds"), card("9", "hearts"),
          card("K", "clubs"), card("K", "diamonds"), card("K", "hearts"),
          card("5", "spades"),
        ],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      expect(actor.getSnapshot().context.isDown).toBe(false);

      const hand = actor.getSnapshot().context.hand;
      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [hand[0]!.id, hand[1]!.id, hand[2]!.id] },
          { type: "set" as const, cardIds: [hand[3]!.id, hand[4]!.id, hand[5]!.id] },
        ],
      });

      expect(actor.getSnapshot().context.isDown).toBe(true);
    });

    it("sets laidDownThisTurn to true", () => {
      const input = {
        ...createTurnInput(),
        roundNumber: 1 as const,
        hand: [
          card("9", "clubs"), card("9", "diamonds"), card("9", "hearts"),
          card("K", "clubs"), card("K", "diamonds"), card("K", "hearts"),
          card("5", "spades"),
        ],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      const hand = actor.getSnapshot().context.hand;
      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [hand[0]!.id, hand[1]!.id, hand[2]!.id] },
          { type: "set" as const, cardIds: [hand[3]!.id, hand[4]!.id, hand[5]!.id] },
        ],
      });

      expect(actor.getSnapshot().context.laidDownThisTurn).toBe(true);
    });

    it("transitions to awaitingDiscard (auto-transition)", () => {
      const input = {
        ...createTurnInput(),
        roundNumber: 1 as const,
        hand: [
          card("9", "clubs"), card("9", "diamonds"), card("9", "hearts"),
          card("K", "clubs"), card("K", "diamonds"), card("K", "hearts"),
          card("5", "spades"),
        ],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      const hand = actor.getSnapshot().context.hand;
      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [hand[0]!.id, hand[1]!.id, hand[2]!.id] },
          { type: "set" as const, cardIds: [hand[3]!.id, hand[4]!.id, hand[5]!.id] },
        ],
      });

      // Directly transitions to awaitingDiscard after laying down
      expect(actor.getSnapshot().value).toBe("awaitingDiscard");
    });
  });

  describe("successful lay down - Round 2 (1 set + 1 run)", () => {
    it("accepts valid 1 set and 1 run", () => {
      const input = {
        ...createTurnInput(),
        roundNumber: 2 as const,
        hand: [
          card("9", "clubs"), card("9", "diamonds"), card("9", "hearts"),
          card("5", "spades"), card("6", "spades"), card("7", "spades"), card("8", "spades"),
          card("K", "hearts"),
        ],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      const hand = actor.getSnapshot().context.hand;
      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [hand[0]!.id, hand[1]!.id, hand[2]!.id] },
          { type: "run" as const, cardIds: [hand[3]!.id, hand[4]!.id, hand[5]!.id, hand[6]!.id] },
        ],
      });

      expect(actor.getSnapshot().value).toBe("awaitingDiscard");
    });

    it("example: (9C 9D 9H) and (5S 6S 7S 8S)", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const fiveS = card("5", "spades");
      const sixS = card("6", "spades");
      const sevenS = card("7", "spades");
      const eightS = card("8", "spades");
      const extra = card("K", "hearts");

      const input = {
        ...createTurnInput(),
        roundNumber: 2 as const,
        hand: [nineC, nineD, nineH, fiveS, sixS, sevenS, eightS, extra],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
          { type: "run" as const, cardIds: [fiveS.id, sixS.id, sevenS.id, eightS.id] },
        ],
      });

      expect(actor.getSnapshot().value).toBe("awaitingDiscard");
      expect(actor.getSnapshot().context.isDown).toBe(true);
    });

    it("both melds added to table", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const fiveS = card("5", "spades");
      const sixS = card("6", "spades");
      const sevenS = card("7", "spades");
      const eightS = card("8", "spades");

      const input = {
        ...createTurnInput(),
        roundNumber: 2 as const,
        hand: [nineC, nineD, nineH, fiveS, sixS, sevenS, eightS, card("K", "hearts")],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
          { type: "run" as const, cardIds: [fiveS.id, sixS.id, sevenS.id, eightS.id] },
        ],
      });

      const table = actor.getSnapshot().context.table;
      expect(table.length).toBe(2);
      expect(table[0]!.type).toBe("set");
      expect(table[0]!.cards.length).toBe(3);
      expect(table[1]!.type).toBe("run");
      expect(table[1]!.cards.length).toBe(4);
    });

    it("player marked as down", () => {
      const input = {
        ...createTurnInput(),
        roundNumber: 2 as const,
        hand: [
          card("9", "clubs"), card("9", "diamonds"), card("9", "hearts"),
          card("5", "spades"), card("6", "spades"), card("7", "spades"), card("8", "spades"),
          card("K", "hearts"),
        ],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      expect(actor.getSnapshot().context.isDown).toBe(false);

      const hand = actor.getSnapshot().context.hand;
      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [hand[0]!.id, hand[1]!.id, hand[2]!.id] },
          { type: "run" as const, cardIds: [hand[3]!.id, hand[4]!.id, hand[5]!.id, hand[6]!.id] },
        ],
      });

      expect(actor.getSnapshot().context.isDown).toBe(true);
      expect(actor.getSnapshot().context.laidDownThisTurn).toBe(true);
    });
  });

  describe("successful lay down - Round 3 (2 runs)", () => {
    it("accepts valid 2 runs", () => {
      const input = {
        ...createTurnInput(),
        roundNumber: 3 as const,
        hand: [
          card("3", "diamonds"), card("4", "diamonds"), card("5", "diamonds"), card("6", "diamonds"),
          card("J", "hearts"), card("Q", "hearts"), card("K", "hearts"), card("A", "hearts"),
          card("2", "clubs"),
        ],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      const hand = actor.getSnapshot().context.hand;
      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "run" as const, cardIds: [hand[0]!.id, hand[1]!.id, hand[2]!.id, hand[3]!.id] },
          { type: "run" as const, cardIds: [hand[4]!.id, hand[5]!.id, hand[6]!.id, hand[7]!.id] },
        ],
      });

      expect(actor.getSnapshot().value).toBe("awaitingDiscard");
      expect(actor.getSnapshot().context.isDown).toBe(true);
    });

    it("example: (3D 4D 5D 6D) and (JH QH KH AH)", () => {
      const threeD = card("3", "diamonds");
      const fourD = card("4", "diamonds");
      const fiveD = card("5", "diamonds");
      const sixD = card("6", "diamonds");
      const jackH = card("J", "hearts");
      const queenH = card("Q", "hearts");
      const kingH = card("K", "hearts");
      const aceH = card("A", "hearts");
      const extra = card("2", "clubs");

      const input = {
        ...createTurnInput(),
        roundNumber: 3 as const,
        hand: [threeD, fourD, fiveD, sixD, jackH, queenH, kingH, aceH, extra],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "run" as const, cardIds: [threeD.id, fourD.id, fiveD.id, sixD.id] },
          { type: "run" as const, cardIds: [jackH.id, queenH.id, kingH.id, aceH.id] },
        ],
      });

      expect(actor.getSnapshot().value).toBe("awaitingDiscard");
      expect(actor.getSnapshot().context.isDown).toBe(true);
    });

    it("minimum 8 cards used", () => {
      const threeD = card("3", "diamonds");
      const fourD = card("4", "diamonds");
      const fiveD = card("5", "diamonds");
      const sixD = card("6", "diamonds");
      const jackH = card("J", "hearts");
      const queenH = card("Q", "hearts");
      const kingH = card("K", "hearts");
      const aceH = card("A", "hearts");

      const input = {
        ...createTurnInput(),
        roundNumber: 3 as const,
        hand: [threeD, fourD, fiveD, sixD, jackH, queenH, kingH, aceH, card("2", "clubs")],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      const handSizeBefore = actor.getSnapshot().context.hand.length;

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "run" as const, cardIds: [threeD.id, fourD.id, fiveD.id, sixD.id] },
          { type: "run" as const, cardIds: [jackH.id, queenH.id, kingH.id, aceH.id] },
        ],
      });

      const handAfter = actor.getSnapshot().context.hand;
      // 8 cards removed (2 runs of 4)
      expect(handAfter.length).toBe(handSizeBefore - 8);
      // Verify the table has 2 runs with 4 cards each
      const table = actor.getSnapshot().context.table;
      expect(table.length).toBe(2);
      expect(table[0]!.cards.length).toBe(4);
      expect(table[1]!.cards.length).toBe(4);
    });
  });

  describe("successful lay down - Round 4 (3 sets)", () => {
    it("accepts valid 3 sets", () => {
      const input = {
        ...createTurnInput(),
        roundNumber: 4 as const,
        hand: [
          card("3", "clubs"), card("3", "diamonds"), card("3", "hearts"),
          card("7", "spades"), card("7", "diamonds"), card("7", "clubs"),
          card("Q", "hearts"), card("Q", "spades"), card("Q", "diamonds"),
          card("K", "clubs"),
        ],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      const hand = actor.getSnapshot().context.hand;
      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [hand[0]!.id, hand[1]!.id, hand[2]!.id] },
          { type: "set" as const, cardIds: [hand[3]!.id, hand[4]!.id, hand[5]!.id] },
          { type: "set" as const, cardIds: [hand[6]!.id, hand[7]!.id, hand[8]!.id] },
        ],
      });

      expect(actor.getSnapshot().value).toBe("awaitingDiscard");
      expect(actor.getSnapshot().context.isDown).toBe(true);
    });

    it("example: (3C 3D 3H) and (7S 7D 7C) and (QH QS QD)", () => {
      const threeC = card("3", "clubs");
      const threeD = card("3", "diamonds");
      const threeH = card("3", "hearts");
      const sevenS = card("7", "spades");
      const sevenD = card("7", "diamonds");
      const sevenC = card("7", "clubs");
      const queenH = card("Q", "hearts");
      const queenS = card("Q", "spades");
      const queenD = card("Q", "diamonds");
      const extra = card("K", "clubs");

      const input = {
        ...createTurnInput(),
        roundNumber: 4 as const,
        hand: [threeC, threeD, threeH, sevenS, sevenD, sevenC, queenH, queenS, queenD, extra],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [threeC.id, threeD.id, threeH.id] },
          { type: "set" as const, cardIds: [sevenS.id, sevenD.id, sevenC.id] },
          { type: "set" as const, cardIds: [queenH.id, queenS.id, queenD.id] },
        ],
      });

      expect(actor.getSnapshot().value).toBe("awaitingDiscard");
      expect(actor.getSnapshot().context.isDown).toBe(true);
    });

    it("minimum 9 cards used", () => {
      const threeC = card("3", "clubs");
      const threeD = card("3", "diamonds");
      const threeH = card("3", "hearts");
      const sevenS = card("7", "spades");
      const sevenD = card("7", "diamonds");
      const sevenC = card("7", "clubs");
      const queenH = card("Q", "hearts");
      const queenS = card("Q", "spades");
      const queenD = card("Q", "diamonds");

      const input = {
        ...createTurnInput(),
        roundNumber: 4 as const,
        hand: [threeC, threeD, threeH, sevenS, sevenD, sevenC, queenH, queenS, queenD, card("K", "clubs")],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      const handSizeBefore = actor.getSnapshot().context.hand.length;

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [threeC.id, threeD.id, threeH.id] },
          { type: "set" as const, cardIds: [sevenS.id, sevenD.id, sevenC.id] },
          { type: "set" as const, cardIds: [queenH.id, queenS.id, queenD.id] },
        ],
      });

      const handAfter = actor.getSnapshot().context.hand;
      // 9 cards removed (3 sets of 3)
      expect(handAfter.length).toBe(handSizeBefore - 9);
      // Verify the table has 3 sets with 3 cards each
      const table = actor.getSnapshot().context.table;
      expect(table.length).toBe(3);
      expect(table[0]!.cards.length).toBe(3);
      expect(table[1]!.cards.length).toBe(3);
      expect(table[2]!.cards.length).toBe(3);
    });
  });

  describe("successful lay down - Round 5 (2 sets + 1 run)", () => {
    it("accepts valid 2 sets and 1 run", () => {
      const input = {
        ...createTurnInput(),
        roundNumber: 5 as const,
        hand: [
          card("3", "clubs"), card("3", "diamonds"), card("3", "hearts"),
          card("7", "spades"), card("7", "diamonds"), card("7", "clubs"),
          card("9", "hearts"), card("10", "hearts"), card("J", "hearts"), card("Q", "hearts"),
          card("K", "clubs"),
        ],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      const hand = actor.getSnapshot().context.hand;
      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [hand[0]!.id, hand[1]!.id, hand[2]!.id] },
          { type: "set" as const, cardIds: [hand[3]!.id, hand[4]!.id, hand[5]!.id] },
          { type: "run" as const, cardIds: [hand[6]!.id, hand[7]!.id, hand[8]!.id, hand[9]!.id] },
        ],
      });

      expect(actor.getSnapshot().value).toBe("awaitingDiscard");
      expect(actor.getSnapshot().context.isDown).toBe(true);
    });

    it("minimum 10 cards used", () => {
      const threeC = card("3", "clubs");
      const threeD = card("3", "diamonds");
      const threeH = card("3", "hearts");
      const sevenS = card("7", "spades");
      const sevenD = card("7", "diamonds");
      const sevenC = card("7", "clubs");
      const nineH = card("9", "hearts");
      const tenH = card("10", "hearts");
      const jackH = card("J", "hearts");
      const queenH = card("Q", "hearts");

      const input = {
        ...createTurnInput(),
        roundNumber: 5 as const,
        hand: [threeC, threeD, threeH, sevenS, sevenD, sevenC, nineH, tenH, jackH, queenH, card("K", "clubs")],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      const handSizeBefore = actor.getSnapshot().context.hand.length;

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [threeC.id, threeD.id, threeH.id] },
          { type: "set" as const, cardIds: [sevenS.id, sevenD.id, sevenC.id] },
          { type: "run" as const, cardIds: [nineH.id, tenH.id, jackH.id, queenH.id] },
        ],
      });

      const handAfter = actor.getSnapshot().context.hand;
      // 10 cards removed (2 sets of 3 + 1 run of 4)
      expect(handAfter.length).toBe(handSizeBefore - 10);
      // Verify the table has 2 sets and 1 run
      const table = actor.getSnapshot().context.table;
      expect(table.length).toBe(3);
      expect(table[0]!.type).toBe("set");
      expect(table[1]!.type).toBe("set");
      expect(table[2]!.type).toBe("run");
      expect(table[2]!.cards.length).toBe(4);
    });
  });

  describe("successful lay down - Round 6 (1 set + 2 runs)", () => {
    it("accepts valid 1 set and 2 runs", () => {
      const input = {
        ...createTurnInput(),
        roundNumber: 6 as const,
        hand: [
          card("3", "clubs"), card("3", "diamonds"), card("3", "hearts"),
          card("5", "spades"), card("6", "spades"), card("7", "spades"), card("8", "spades"),
          card("9", "hearts"), card("10", "hearts"), card("J", "hearts"), card("Q", "hearts"),
          card("K", "clubs"),
        ],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      const hand = actor.getSnapshot().context.hand;
      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [hand[0]!.id, hand[1]!.id, hand[2]!.id] },
          { type: "run" as const, cardIds: [hand[3]!.id, hand[4]!.id, hand[5]!.id, hand[6]!.id] },
          { type: "run" as const, cardIds: [hand[7]!.id, hand[8]!.id, hand[9]!.id, hand[10]!.id] },
        ],
      });

      expect(actor.getSnapshot().value).toBe("awaitingDiscard");
      expect(actor.getSnapshot().context.isDown).toBe(true);
    });

    it("minimum 11 cards used", () => {
      const threeC = card("3", "clubs");
      const threeD = card("3", "diamonds");
      const threeH = card("3", "hearts");
      const fiveS = card("5", "spades");
      const sixS = card("6", "spades");
      const sevenS = card("7", "spades");
      const eightS = card("8", "spades");
      const nineH = card("9", "hearts");
      const tenH = card("10", "hearts");
      const jackH = card("J", "hearts");
      const queenH = card("Q", "hearts");

      const input = {
        ...createTurnInput(),
        roundNumber: 6 as const,
        hand: [threeC, threeD, threeH, fiveS, sixS, sevenS, eightS, nineH, tenH, jackH, queenH, card("K", "clubs")],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      const handSizeBefore = actor.getSnapshot().context.hand.length;

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [threeC.id, threeD.id, threeH.id] },
          { type: "run" as const, cardIds: [fiveS.id, sixS.id, sevenS.id, eightS.id] },
          { type: "run" as const, cardIds: [nineH.id, tenH.id, jackH.id, queenH.id] },
        ],
      });

      const handAfter = actor.getSnapshot().context.hand;
      // 11 cards removed (1 set of 3 + 2 runs of 4)
      expect(handAfter.length).toBe(handSizeBefore - 11);
      // Verify the table has 1 set and 2 runs
      const table = actor.getSnapshot().context.table;
      expect(table.length).toBe(3);
      expect(table[0]!.type).toBe("set");
      expect(table[1]!.type).toBe("run");
      expect(table[2]!.type).toBe("run");
    });
  });

  describe("melds with wilds", () => {
    it("accepts set with valid wild ratio: (9C 9D Joker)", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const joker: Card = { id: `Joker-${Math.random()}`, rank: "Joker", suit: null };
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingH = card("K", "hearts");
      const extra = card("5", "spades");

      const input = {
        ...createTurnInput(),
        roundNumber: 1 as const,
        hand: [nineC, nineD, joker, kingC, kingD, kingH, extra],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, joker.id] }, // 2 naturals, 1 wild - valid
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingH.id] },
        ],
      });

      expect(actor.getSnapshot().value).toBe("awaitingDiscard");
      expect(actor.getSnapshot().context.isDown).toBe(true);
    });

    it("accepts set with equal wilds/naturals: (9C 9D 2H Joker) - 2 natural, 2 wild", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const twoH = card("2", "hearts");
      const joker: Card = { id: `Joker-${Math.random()}`, rank: "Joker", suit: null };
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingH = card("K", "hearts");
      const extra = card("5", "spades");

      const input = {
        ...createTurnInput(),
        roundNumber: 1 as const,
        hand: [nineC, nineD, twoH, joker, kingC, kingD, kingH, extra],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, twoH.id, joker.id] }, // 2 naturals, 2 wilds - equal, valid
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingH.id] },
        ],
      });

      expect(actor.getSnapshot().value).toBe("awaitingDiscard");
      expect(actor.getSnapshot().context.isDown).toBe(true);
    });

    it("accepts run with wild filling gap: (5S 6S Joker 8S)", () => {
      const fiveS = card("5", "spades");
      const sixS = card("6", "spades");
      const joker: Card = { id: `Joker-${Math.random()}`, rank: "Joker", suit: null };
      const eightS = card("8", "spades");
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const extra = card("K", "hearts");

      const input = {
        ...createTurnInput(),
        roundNumber: 2 as const, // 1 set + 1 run
        hand: [fiveS, sixS, joker, eightS, nineC, nineD, nineH, extra],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
          { type: "run" as const, cardIds: [fiveS.id, sixS.id, joker.id, eightS.id] }, // Joker fills 7S gap
        ],
      });

      expect(actor.getSnapshot().value).toBe("awaitingDiscard");
      expect(actor.getSnapshot().context.isDown).toBe(true);
    });

    it("accepts run with wild at end: (5S 6S 7S 2C)", () => {
      const fiveS = card("5", "spades");
      const sixS = card("6", "spades");
      const sevenS = card("7", "spades");
      const twoC = card("2", "clubs"); // Wild at end, filling 8S position
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const extra = card("K", "hearts");

      const input = {
        ...createTurnInput(),
        roundNumber: 2 as const, // 1 set + 1 run
        hand: [fiveS, sixS, sevenS, twoC, nineC, nineD, nineH, extra],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
          { type: "run" as const, cardIds: [fiveS.id, sixS.id, sevenS.id, twoC.id] }, // 2C fills 8S position
        ],
      });

      expect(actor.getSnapshot().value).toBe("awaitingDiscard");
      expect(actor.getSnapshot().context.isDown).toBe(true);
    });

    it("rejects set with too many wilds: (9C Joker Joker)", () => {
      const nineC = card("9", "clubs");
      const joker1: Card = { id: `Joker-1-${Math.random()}`, rank: "Joker", suit: null };
      const joker2: Card = { id: `Joker-2-${Math.random()}`, rank: "Joker", suit: null };
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingH = card("K", "hearts");
      const extra = card("5", "spades");

      const input = {
        ...createTurnInput(),
        roundNumber: 1 as const,
        hand: [nineC, joker1, joker2, kingC, kingD, kingH, extra],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      const handBefore = [...actor.getSnapshot().context.hand];

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, joker1.id, joker2.id] }, // 1 natural, 2 wilds - invalid
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingH.id] },
        ],
      });

      // Should still be in drawn state, command rejected
      expect(actor.getSnapshot().value).toBe("drawn");
      expect(actor.getSnapshot().context.hand).toEqual(handBefore);
      expect(actor.getSnapshot().context.isDown).toBe(false);
    });

    it("rejects run with too many wilds: (5S Joker Joker 2C) - 1 natural, 3 wild", () => {
      const fiveS = card("5", "spades");
      const joker1: Card = { id: `Joker-1-${Math.random()}`, rank: "Joker", suit: null };
      const joker2: Card = { id: `Joker-2-${Math.random()}`, rank: "Joker", suit: null };
      const twoC = card("2", "clubs");
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const extra = card("K", "hearts");

      const input = {
        ...createTurnInput(),
        roundNumber: 2 as const, // 1 set + 1 run
        hand: [fiveS, joker1, joker2, twoC, nineC, nineD, nineH, extra],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      const handBefore = [...actor.getSnapshot().context.hand];

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
          { type: "run" as const, cardIds: [fiveS.id, joker1.id, joker2.id, twoC.id] }, // 1 natural, 3 wilds - invalid
        ],
      });

      // Should still be in drawn state, command rejected
      expect(actor.getSnapshot().value).toBe("drawn");
      expect(actor.getSnapshot().context.hand).toEqual(handBefore);
      expect(actor.getSnapshot().context.isDown).toBe(false);
    });

    it("each meld validated independently for wild ratio", () => {
      // First set: 2 naturals, 1 wild (valid)
      // Second set: 1 natural, 2 wilds (invalid)
      // Overall: 3 naturals, 3 wilds might seem balanced, but per-meld validation fails
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const joker1: Card = { id: `Joker-1-${Math.random()}`, rank: "Joker", suit: null };
      const kingC = card("K", "clubs");
      const joker2: Card = { id: `Joker-2-${Math.random()}`, rank: "Joker", suit: null };
      const twoH = card("2", "hearts");
      const extra = card("5", "spades");

      const input = {
        ...createTurnInput(),
        roundNumber: 1 as const,
        hand: [nineC, nineD, joker1, kingC, joker2, twoH, extra],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      const handBefore = [...actor.getSnapshot().context.hand];

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, joker1.id] }, // 2 naturals, 1 wild - valid
          { type: "set" as const, cardIds: [kingC.id, joker2.id, twoH.id] }, // 1 natural, 2 wilds - INVALID
        ],
      });

      // Should still be in drawn state, command rejected (second meld invalid)
      expect(actor.getSnapshot().value).toBe("drawn");
      expect(actor.getSnapshot().context.hand).toEqual(handBefore);
      expect(actor.getSnapshot().context.isDown).toBe(false);
    });
  });

  describe("larger than minimum melds", () => {
    it("accepts 4-card set: (9C 9D 9H 9S)", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const nineS = card("9", "spades");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingH = card("K", "hearts");
      const extra = card("5", "spades");

      const input = {
        ...createTurnInput(),
        roundNumber: 1 as const,
        hand: [nineC, nineD, nineH, nineS, kingC, kingD, kingH, extra],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id, nineS.id] }, // 4-card set
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingH.id] },
        ],
      });

      expect(actor.getSnapshot().value).toBe("awaitingDiscard");
      expect(actor.getSnapshot().context.isDown).toBe(true);
      expect(actor.getSnapshot().context.table[0]!.cards.length).toBe(4);
    });

    it("accepts 5-card set: (9C 9D 9H 9S 9C) - duplicate from multi-deck", () => {
      // In a multi-deck game, duplicate cards of same rank+suit can exist
      const nineC1 = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const nineS = card("9", "spades");
      const nineC2 = card("9", "clubs"); // Duplicate from second deck
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingH = card("K", "hearts");
      const extra = card("5", "spades");

      const input = {
        ...createTurnInput(),
        roundNumber: 1 as const,
        hand: [nineC1, nineD, nineH, nineS, nineC2, kingC, kingD, kingH, extra],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC1.id, nineD.id, nineH.id, nineS.id, nineC2.id] }, // 5-card set
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingH.id] },
        ],
      });

      expect(actor.getSnapshot().value).toBe("awaitingDiscard");
      expect(actor.getSnapshot().context.isDown).toBe(true);
      expect(actor.getSnapshot().context.table[0]!.cards.length).toBe(5);
    });

    it("accepts 5-card run: (5S 6S 7S 8S 9S)", () => {
      const fiveS = card("5", "spades");
      const sixS = card("6", "spades");
      const sevenS = card("7", "spades");
      const eightS = card("8", "spades");
      const nineS = card("9", "spades");
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const extra = card("K", "hearts");

      const input = {
        ...createTurnInput(),
        roundNumber: 2 as const, // 1 set + 1 run
        hand: [fiveS, sixS, sevenS, eightS, nineS, nineC, nineD, nineH, extra],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
          { type: "run" as const, cardIds: [fiveS.id, sixS.id, sevenS.id, eightS.id, nineS.id] }, // 5-card run
        ],
      });

      expect(actor.getSnapshot().value).toBe("awaitingDiscard");
      expect(actor.getSnapshot().context.isDown).toBe(true);
      expect(actor.getSnapshot().context.table[1]!.cards.length).toBe(5);
    });

    it("accepts 6+ card run: (5S 6S 7S 8S 9S 10S)", () => {
      const fiveS = card("5", "spades");
      const sixS = card("6", "spades");
      const sevenS = card("7", "spades");
      const eightS = card("8", "spades");
      const nineS = card("9", "spades");
      const tenS = card("10", "spades");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingH = card("K", "hearts");
      const extra = card("Q", "hearts");

      const input = {
        ...createTurnInput(),
        roundNumber: 2 as const, // 1 set + 1 run
        hand: [fiveS, sixS, sevenS, eightS, nineS, tenS, kingC, kingD, kingH, extra],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingH.id] },
          { type: "run" as const, cardIds: [fiveS.id, sixS.id, sevenS.id, eightS.id, nineS.id, tenS.id] }, // 6-card run
        ],
      });

      expect(actor.getSnapshot().value).toBe("awaitingDiscard");
      expect(actor.getSnapshot().context.isDown).toBe(true);
      expect(actor.getSnapshot().context.table[1]!.cards.length).toBe(6);
    });

    it("larger melds still count as 1 set or 1 run toward contract", () => {
      // Round 1 requires 2 sets. A 4-card set still counts as 1 set.
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const nineS = card("9", "spades");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingH = card("K", "hearts");
      const kingS = card("K", "spades");
      const extra = card("5", "spades");

      const input = {
        ...createTurnInput(),
        roundNumber: 1 as const,
        hand: [nineC, nineD, nineH, nineS, kingC, kingD, kingH, kingS, extra],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      // Two 4-card sets satisfy the 2 sets contract
      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id, nineS.id] }, // 4-card set counts as 1
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingH.id, kingS.id] }, // 4-card set counts as 1
        ],
      });

      expect(actor.getSnapshot().value).toBe("awaitingDiscard");
      expect(actor.getSnapshot().context.isDown).toBe(true);
      // Contract is satisfied with 2 melds (even though they're larger than minimum)
      expect(actor.getSnapshot().context.table.length).toBe(2);
    });
  });

  describe("card removal from hand", () => {
    it("only cards in melds are removed from hand", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingH = card("K", "hearts");
      const extra1 = card("5", "spades");
      const extra2 = card("6", "hearts");

      const input = {
        ...createTurnInput(),
        roundNumber: 1 as const,
        hand: [nineC, nineD, nineH, kingC, kingD, kingH, extra1, extra2],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      const drawnCard = actor.getSnapshot().context.hand[8]; // The drawn card

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingH.id] },
        ],
      });

      const handAfter = actor.getSnapshot().context.hand;
      // Only the meld cards (6 cards) should be removed
      // Extra cards + drawn card should remain
      expect(handAfter.find(c => c.id === nineC.id)).toBeUndefined();
      expect(handAfter.find(c => c.id === kingC.id)).toBeUndefined();
      expect(handAfter.find(c => c.id === extra1.id)).toBeDefined();
      expect(handAfter.find(c => c.id === extra2.id)).toBeDefined();
      expect(handAfter.find(c => c.id === drawnCard!.id)).toBeDefined();
    });

    it("remaining cards stay in hand", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingH = card("K", "hearts");
      const extra1 = card("5", "spades");
      const extra2 = card("6", "hearts");
      const extra3 = card("7", "diamonds");

      const input = {
        ...createTurnInput(),
        roundNumber: 1 as const,
        hand: [nineC, nineD, nineH, kingC, kingD, kingH, extra1, extra2, extra3],
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

      const handAfter = actor.getSnapshot().context.hand;
      // All three extra cards should still be in hand
      expect(handAfter.some(c => c.id === extra1.id)).toBe(true);
      expect(handAfter.some(c => c.id === extra2.id)).toBe(true);
      expect(handAfter.some(c => c.id === extra3.id)).toBe(true);
    });

    it("hand size = previous size - cards laid down", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingH = card("K", "hearts");
      const extra1 = card("5", "spades");
      const extra2 = card("6", "hearts");

      const input = {
        ...createTurnInput(),
        roundNumber: 1 as const,
        hand: [nineC, nineD, nineH, kingC, kingD, kingH, extra1, extra2],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      const handSizeBefore = actor.getSnapshot().context.hand.length; // 9 cards (8 + 1 drawn)
      const cardsLaidDown = 6; // 2 sets of 3

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingH.id] },
        ],
      });

      const handSizeAfter = actor.getSnapshot().context.hand.length;
      expect(handSizeAfter).toBe(handSizeBefore - cardsLaidDown);
    });

    it("example: 12 cards - 6 laid down = 6 remaining", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingH = card("K", "hearts");
      const extra1 = card("3", "spades");
      const extra2 = card("4", "hearts");
      const extra3 = card("5", "diamonds");
      const extra4 = card("6", "clubs");
      const extra5 = card("7", "spades");

      const input = {
        ...createTurnInput(),
        roundNumber: 1 as const,
        // 11 cards in hand
        hand: [nineC, nineD, nineH, kingC, kingD, kingH, extra1, extra2, extra3, extra4, extra5],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" }); // Now 12 cards

      expect(actor.getSnapshot().context.hand.length).toBe(12);

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingH.id] },
        ],
      });

      expect(actor.getSnapshot().context.hand.length).toBe(6); // 12 - 6 = 6
    });

    it("correct cards removed (verified by cardId)", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingH = card("K", "hearts");
      const extra = card("5", "spades");

      const input = {
        ...createTurnInput(),
        roundNumber: 1 as const,
        hand: [nineC, nineD, nineH, kingC, kingD, kingH, extra],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      const drawnCard = actor.getSnapshot().context.hand.find(c =>
        c.id !== nineC.id && c.id !== nineD.id && c.id !== nineH.id &&
        c.id !== kingC.id && c.id !== kingD.id && c.id !== kingH.id &&
        c.id !== extra.id
      );

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingH.id] },
        ],
      });

      const handAfter = actor.getSnapshot().context.hand;
      const handCardIds = handAfter.map(c => c.id);

      // Verify exact IDs removed
      expect(handCardIds).not.toContain(nineC.id);
      expect(handCardIds).not.toContain(nineD.id);
      expect(handCardIds).not.toContain(nineH.id);
      expect(handCardIds).not.toContain(kingC.id);
      expect(handCardIds).not.toContain(kingD.id);
      expect(handCardIds).not.toContain(kingH.id);

      // Verify exact IDs remain
      expect(handCardIds).toContain(extra.id);
      expect(handCardIds).toContain(drawnCard!.id);
    });
  });

  describe("meld ownership", () => {
    it("each meld has ownerId set to current player", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingH = card("K", "hearts");
      const extra = card("5", "spades");

      const input = {
        ...createTurnInput(),
        playerId: "player-42",
        roundNumber: 1 as const,
        hand: [nineC, nineD, nineH, kingC, kingD, kingH, extra],
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
      expect(table[0]!.ownerId).toBe("player-42");
      expect(table[1]!.ownerId).toBe("player-42");
    });

    it("melds appear on table with correct owner", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingH = card("K", "hearts");
      const extra = card("5", "spades");

      const input = {
        ...createTurnInput(),
        playerId: "alice",
        roundNumber: 1 as const,
        hand: [nineC, nineD, nineH, kingC, kingD, kingH, extra],
        table: [], // Empty table
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
      expect(table.length).toBe(2);
      expect(table.every(m => m.ownerId === "alice")).toBe(true);
    });

    it("multiple players' melds can coexist on table", () => {
      // Simulate a table that already has another player's melds
      const existingMeld = {
        id: "meld-bob-1",
        type: "set" as const,
        cards: [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")],
        ownerId: "bob",
      };

      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingH = card("K", "hearts");
      const extra = card("5", "spades");

      const input = {
        ...createTurnInput(),
        playerId: "alice",
        roundNumber: 1 as const,
        hand: [nineC, nineD, nineH, kingC, kingD, kingH, extra],
        table: [existingMeld], // Bob's meld already on table
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
      expect(table.length).toBe(3); // 1 from bob + 2 from alice

      // Bob's meld still present
      expect(table.some(m => m.ownerId === "bob")).toBe(true);
      // Alice's melds added
      expect(table.filter(m => m.ownerId === "alice").length).toBe(2);
    });
  });
});

describe("TurnMachine - invalid LAY_DOWN scenarios", () => {
  describe("wrong number of melds", () => {
    it("round 1: rejects 1 set (need 2)", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const extra1 = card("5", "spades");
      const extra2 = card("6", "hearts");

      const input = {
        ...createTurnInput(),
        roundNumber: 1 as const,
        hand: [nineC, nineD, nineH, extra1, extra2],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      const handBefore = [...actor.getSnapshot().context.hand];

      // Try to lay down only 1 set (round 1 requires 2 sets)
      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
        ],
      });

      // Should stay in drawn state, command rejected
      expect(actor.getSnapshot().value).toBe("drawn");
      expect(actor.getSnapshot().context.hand).toEqual(handBefore);
      expect(actor.getSnapshot().context.isDown).toBe(false);
    });

    it("round 1: rejects 3 sets (too many)", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingH = card("K", "hearts");
      const threeC = card("3", "clubs");
      const threeD = card("3", "diamonds");
      const threeH = card("3", "hearts");
      const extra = card("5", "spades");

      const input = {
        ...createTurnInput(),
        roundNumber: 1 as const,
        hand: [nineC, nineD, nineH, kingC, kingD, kingH, threeC, threeD, threeH, extra],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      const handBefore = [...actor.getSnapshot().context.hand];

      // Try to lay down 3 sets (round 1 requires exactly 2 sets)
      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingH.id] },
          { type: "set" as const, cardIds: [threeC.id, threeD.id, threeH.id] },
        ],
      });

      // Should stay in drawn state, command rejected
      expect(actor.getSnapshot().value).toBe("drawn");
      expect(actor.getSnapshot().context.hand).toEqual(handBefore);
      expect(actor.getSnapshot().context.isDown).toBe(false);
    });

    it("round 2: rejects 2 sets + 0 runs (wrong combination)", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingH = card("K", "hearts");
      const extra = card("5", "spades");

      const input = {
        ...createTurnInput(),
        roundNumber: 2 as const, // Round 2 requires 1 set + 1 run
        hand: [nineC, nineD, nineH, kingC, kingD, kingH, extra],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      const handBefore = [...actor.getSnapshot().context.hand];

      // Try to lay down 2 sets (round 2 requires 1 set + 1 run)
      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingH.id] },
        ],
      });

      // Should stay in drawn state, command rejected
      expect(actor.getSnapshot().value).toBe("drawn");
      expect(actor.getSnapshot().context.hand).toEqual(handBefore);
      expect(actor.getSnapshot().context.isDown).toBe(false);
    });

    it("round 2: rejects 0 sets + 2 runs (wrong combination)", () => {
      const fiveS = card("5", "spades");
      const sixS = card("6", "spades");
      const sevenS = card("7", "spades");
      const eightS = card("8", "spades");
      const threeH = card("3", "hearts");
      const fourH = card("4", "hearts");
      const fiveH = card("5", "hearts");
      const sixH = card("6", "hearts");
      const extra = card("K", "clubs");

      const input = {
        ...createTurnInput(),
        roundNumber: 2 as const, // Round 2 requires 1 set + 1 run
        hand: [fiveS, sixS, sevenS, eightS, threeH, fourH, fiveH, sixH, extra],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      const handBefore = [...actor.getSnapshot().context.hand];

      // Try to lay down 2 runs (round 2 requires 1 set + 1 run)
      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "run" as const, cardIds: [fiveS.id, sixS.id, sevenS.id, eightS.id] },
          { type: "run" as const, cardIds: [threeH.id, fourH.id, fiveH.id, sixH.id] },
        ],
      });

      // Should stay in drawn state, command rejected
      expect(actor.getSnapshot().value).toBe("drawn");
      expect(actor.getSnapshot().context.hand).toEqual(handBefore);
      expect(actor.getSnapshot().context.isDown).toBe(false);
    });

    it.todo("provides clear error message about contract requirement", () => {
      // Note: This test requires error messaging support in the TurnMachine
      // which is not yet implemented. Add to discovered tasks.
    });
  });

  describe("invalid individual melds", () => {
    it("rejects if first meld is invalid, even if second is valid", () => {
      const nineC = card("9", "clubs");
      const tenD = card("10", "diamonds"); // Different rank - invalid for set
      const jackH = card("J", "hearts"); // Different rank - invalid for set
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingH = card("K", "hearts");
      const extra = card("5", "spades");

      const input = {
        ...createTurnInput(),
        roundNumber: 1 as const,
        hand: [nineC, tenD, jackH, kingC, kingD, kingH, extra],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      const handBefore = [...actor.getSnapshot().context.hand];

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, tenD.id, jackH.id] }, // Invalid: different ranks
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingH.id] }, // Valid set
        ],
      });

      expect(actor.getSnapshot().value).toBe("drawn");
      expect(actor.getSnapshot().context.hand).toEqual(handBefore);
      expect(actor.getSnapshot().context.isDown).toBe(false);
    });

    it("rejects if second meld is invalid, even if first is valid", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const queenD = card("Q", "diamonds"); // Different rank - invalid for set
      const jackH = card("J", "hearts"); // Different rank - invalid for set
      const extra = card("5", "spades");

      const input = {
        ...createTurnInput(),
        roundNumber: 1 as const,
        hand: [nineC, nineD, nineH, kingC, queenD, jackH, extra],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      const handBefore = [...actor.getSnapshot().context.hand];

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] }, // Valid set
          { type: "set" as const, cardIds: [kingC.id, queenD.id, jackH.id] }, // Invalid: different ranks
        ],
      });

      expect(actor.getSnapshot().value).toBe("drawn");
      expect(actor.getSnapshot().context.hand).toEqual(handBefore);
      expect(actor.getSnapshot().context.isDown).toBe(false);
    });

    it("rejects set with different ranks: (9C 10D JH)", () => {
      const nineC = card("9", "clubs");
      const tenD = card("10", "diamonds");
      const jackH = card("J", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingH = card("K", "hearts");
      const extra = card("5", "spades");

      const input = {
        ...createTurnInput(),
        roundNumber: 1 as const,
        hand: [nineC, tenD, jackH, kingC, kingD, kingH, extra],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      const handBefore = [...actor.getSnapshot().context.hand];

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, tenD.id, jackH.id] }, // Invalid: different ranks
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingH.id] },
        ],
      });

      expect(actor.getSnapshot().value).toBe("drawn");
      expect(actor.getSnapshot().context.hand).toEqual(handBefore);
    });

    it("rejects run with gap: (5S 6S 8S 9S)", () => {
      const fiveS = card("5", "spades");
      const sixS = card("6", "spades");
      const eightS = card("8", "spades"); // Gap - no 7S
      const nineS = card("9", "spades");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingH = card("K", "hearts");
      const extra = card("Q", "hearts");

      const input = {
        ...createTurnInput(),
        roundNumber: 2 as const, // 1 set + 1 run
        hand: [fiveS, sixS, eightS, nineS, kingC, kingD, kingH, extra],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      const handBefore = [...actor.getSnapshot().context.hand];

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingH.id] },
          { type: "run" as const, cardIds: [fiveS.id, sixS.id, eightS.id, nineS.id] }, // Invalid: gap
        ],
      });

      expect(actor.getSnapshot().value).toBe("drawn");
      expect(actor.getSnapshot().context.hand).toEqual(handBefore);
    });

    it("rejects run with mixed suits: (5S 6H 7S 8S)", () => {
      const fiveS = card("5", "spades");
      const sixH = card("6", "hearts"); // Wrong suit
      const sevenS = card("7", "spades");
      const eightS = card("8", "spades");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingH = card("K", "hearts");
      const extra = card("Q", "hearts");

      const input = {
        ...createTurnInput(),
        roundNumber: 2 as const, // 1 set + 1 run
        hand: [fiveS, sixH, sevenS, eightS, kingC, kingD, kingH, extra],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      const handBefore = [...actor.getSnapshot().context.hand];

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingH.id] },
          { type: "run" as const, cardIds: [fiveS.id, sixH.id, sevenS.id, eightS.id] }, // Invalid: mixed suits
        ],
      });

      expect(actor.getSnapshot().value).toBe("drawn");
      expect(actor.getSnapshot().context.hand).toEqual(handBefore);
    });

    it("rejects run with only 3 cards: (5S 6S 7S)", () => {
      const fiveS = card("5", "spades");
      const sixS = card("6", "spades");
      const sevenS = card("7", "spades");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingH = card("K", "hearts");
      const extra = card("Q", "hearts");

      const input = {
        ...createTurnInput(),
        roundNumber: 2 as const, // 1 set + 1 run
        hand: [fiveS, sixS, sevenS, kingC, kingD, kingH, extra],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      const handBefore = [...actor.getSnapshot().context.hand];

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingH.id] },
          { type: "run" as const, cardIds: [fiveS.id, sixS.id, sevenS.id] }, // Invalid: only 3 cards (runs need 4+)
        ],
      });

      expect(actor.getSnapshot().value).toBe("drawn");
      expect(actor.getSnapshot().context.hand).toEqual(handBefore);
    });

    it("rejects set with only 2 cards: (9C 9D)", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingH = card("K", "hearts");
      const extra = card("5", "spades");

      const input = {
        ...createTurnInput(),
        roundNumber: 1 as const,
        hand: [nineC, nineD, kingC, kingD, kingH, extra],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      const handBefore = [...actor.getSnapshot().context.hand];

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id] }, // Invalid: only 2 cards (sets need 3+)
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingH.id] },
        ],
      });

      expect(actor.getSnapshot().value).toBe("drawn");
      expect(actor.getSnapshot().context.hand).toEqual(handBefore);
    });

    it.todo("provides specific error about which meld is invalid", () => {
      // Note: This test requires error messaging support in the TurnMachine
      // which is not yet implemented. Add to discovered tasks.
    });
  });

  describe("card not in hand", () => {
    it("rejects if any cardId in melds is not in player's hand", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingH = card("K", "hearts");
      const extra = card("5", "spades");

      // Card not in hand
      const outsideCard = card("Q", "hearts");

      const input = {
        ...createTurnInput(),
        roundNumber: 1 as const,
        hand: [nineC, nineD, nineH, kingC, kingD, kingH, extra],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      const handBefore = [...actor.getSnapshot().context.hand];

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
          { type: "set" as const, cardIds: [kingC.id, kingD.id, outsideCard.id] }, // outsideCard not in hand
        ],
      });

      expect(actor.getSnapshot().value).toBe("drawn");
      expect(actor.getSnapshot().context.hand).toEqual(handBefore);
      expect(actor.getSnapshot().context.isDown).toBe(false);
    });

    it("rejects if cardId belongs to another player", () => {
      // In practice, another player's cards are not in our hand
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const extra = card("5", "spades");

      // Card belonging to another player (not in our hand)
      const otherPlayerCard = card("K", "hearts");

      const input = {
        ...createTurnInput(),
        roundNumber: 1 as const,
        hand: [nineC, nineD, nineH, kingC, kingD, extra], // Notice: no kingH
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      const handBefore = [...actor.getSnapshot().context.hand];

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
          { type: "set" as const, cardIds: [kingC.id, kingD.id, otherPlayerCard.id] }, // otherPlayerCard not in hand
        ],
      });

      expect(actor.getSnapshot().value).toBe("drawn");
      expect(actor.getSnapshot().context.hand).toEqual(handBefore);
    });

    it("rejects if cardId is on the table already", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingH = card("K", "hearts");
      const extra = card("5", "spades");

      // Card already on table (not in hand)
      const tableCard = card("3", "hearts");
      const existingMeld = {
        id: "meld-existing",
        type: "set" as const,
        cards: [tableCard, card("3", "clubs"), card("3", "diamonds")],
        ownerId: "other-player",
      };

      const input = {
        ...createTurnInput(),
        roundNumber: 1 as const,
        hand: [nineC, nineD, nineH, kingC, kingD, extra], // Notice: no kingH
        table: [existingMeld],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      const handBefore = [...actor.getSnapshot().context.hand];

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
          { type: "set" as const, cardIds: [kingC.id, kingD.id, tableCard.id] }, // tableCard not in hand (it's on table)
        ],
      });

      expect(actor.getSnapshot().value).toBe("drawn");
      expect(actor.getSnapshot().context.hand).toEqual(handBefore);
    });

    it("rejects if cardId does not exist", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingH = card("K", "hearts");
      const extra = card("5", "spades");

      const input = {
        ...createTurnInput(),
        roundNumber: 1 as const,
        hand: [nineC, nineD, nineH, kingC, kingD, kingH, extra],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      const handBefore = [...actor.getSnapshot().context.hand];

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
          { type: "set" as const, cardIds: [kingC.id, kingD.id, "non-existent-card-id"] }, // fake ID
        ],
      });

      expect(actor.getSnapshot().value).toBe("drawn");
      expect(actor.getSnapshot().context.hand).toEqual(handBefore);
    });
  });

  describe("duplicate card usage", () => {
    it("rejects if same cardId appears in two melds", () => {
      // Create two valid sets that share a card (cheat attempt)
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const nineS = card("9", "spades");
      const extra = card("5", "spades");

      const input = {
        ...createTurnInput(),
        roundNumber: 1 as const,
        hand: [nineC, nineD, nineH, nineS, extra],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      const handBefore = [...actor.getSnapshot().context.hand];

      // Try to use nineC in both melds (cheat attempt)
      // First set: 9C, 9D, 9H - valid
      // Second set: 9C, 9H, 9S - also valid BUT 9C is reused!
      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
          { type: "set" as const, cardIds: [nineC.id, nineH.id, nineS.id] }, // nineC and nineH used again!
        ],
      });

      expect(actor.getSnapshot().value).toBe("drawn");
      expect(actor.getSnapshot().context.hand).toEqual(handBefore);
      expect(actor.getSnapshot().context.isDown).toBe(false);
    });

    it("rejects overlapping cardIds (bug/cheat attempt)", () => {
      // Create scenario where one card appears in both melds
      const threeC = card("3", "clubs");
      const threeD = card("3", "diamonds");
      const threeH = card("3", "hearts");
      const threeS = card("3", "spades");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingH = card("K", "hearts");
      const extra = card("5", "spades");

      const input = {
        ...createTurnInput(),
        roundNumber: 1 as const,
        hand: [threeC, threeD, threeH, threeS, kingC, kingD, kingH, extra],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      const handBefore = [...actor.getSnapshot().context.hand];

      // Try to use threeH in both melds
      // First set: 3C, 3D, 3H - valid
      // Second set: 3H, KC, KD, KH - would be valid but 3H is reused
      // Wait, that's not a valid set. Let me use:
      // First set: 3C, 3D, 3H - valid
      // Second set: 3H, 3S, KC - not valid, different ranks
      // Actually for round 1 we need 2 sets, so let me use:
      // First set: 3C, 3D, 3H - valid
      // Second set: 3H, 3S, KC - invalid anyway
      //
      // Better approach: use threeH in both valid sets
      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [threeC.id, threeD.id, threeH.id] }, // threeH here
          { type: "set" as const, cardIds: [threeH.id, threeS.id, kingC.id] }, // threeH again + invalid meld
        ],
      });

      // This will be rejected for multiple reasons (invalid meld AND duplicate)
      // But we're testing that it gets rejected
      expect(actor.getSnapshot().value).toBe("drawn");
      expect(actor.getSnapshot().context.hand).toEqual(handBefore);
      expect(actor.getSnapshot().context.isDown).toBe(false);
    });
  });

  describe("already down", () => {
    it("rejects LAY_DOWN if player already laid down this round", () => {
      // Note: This is tested by starting a turn with isDown: true
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingH = card("K", "hearts");
      const extra = card("5", "spades");

      const input = {
        ...createTurnInput(),
        roundNumber: 1 as const,
        isDown: true, // Player already laid down this round
        hand: [nineC, nineD, nineH, kingC, kingD, kingH, extra],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      const handBefore = [...actor.getSnapshot().context.hand];

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingH.id] },
        ],
      });

      expect(actor.getSnapshot().value).toBe("drawn");
      expect(actor.getSnapshot().context.hand).toEqual(handBefore);
      expect(actor.getSnapshot().context.isDown).toBe(true); // Still true, not modified
    });

    it("isDown: true prevents any further lay down attempts", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingH = card("K", "hearts");
      const extra = card("5", "spades");

      const input = {
        ...createTurnInput(),
        roundNumber: 1 as const,
        isDown: true, // Already down
        hand: [nineC, nineD, nineH, kingC, kingD, kingH, extra],
        table: [{
          id: "existing-meld",
          type: "set" as const,
          cards: [card("3", "clubs"), card("3", "diamonds"), card("3", "hearts")],
          ownerId: "player-1",
        }],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      const tableBefore = actor.getSnapshot().context.table.length;

      // Try multiple times - all should fail
      for (let i = 0; i < 3; i++) {
        actor.send({
          type: "LAY_DOWN",
          melds: [
            { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
            { type: "set" as const, cardIds: [kingC.id, kingD.id, kingH.id] },
          ],
        });
      }

      expect(actor.getSnapshot().value).toBe("drawn");
      expect(actor.getSnapshot().context.table.length).toBe(tableBefore); // No new melds
    });

    it.todo("error message: already laid down this round", () => {
      // Note: This test requires error messaging support in the TurnMachine
      // which is not yet implemented. Add to discovered tasks.
    });
  });
});

describe("TurnMachine - post lay down behavior", () => {
  describe("auto-transition to awaitingDiscard", () => {
    it("after successful LAY_DOWN, state becomes awaitingDiscard", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingH = card("K", "hearts");
      const extra = card("5", "spades");

      const input = {
        ...createTurnInput(),
        roundNumber: 1 as const,
        hand: [nineC, nineD, nineH, kingC, kingD, kingH, extra],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      expect(actor.getSnapshot().value).toBe("drawn");

      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingH.id] },
        ],
      });

      // Should auto-transition to awaitingDiscard after laying down
      expect(actor.getSnapshot().value).toBe("awaitingDiscard");
    });

    it("laidDownThisTurn flag is set after laying down", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingH = card("K", "hearts");
      const extra = card("5", "spades");

      const input = {
        ...createTurnInput(),
        roundNumber: 1 as const,
        hand: [nineC, nineD, nineH, kingC, kingD, kingH, extra],
      };
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

    it("player cannot stay in drawn state after laying down", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingH = card("K", "hearts");
      const extra = card("5", "spades");

      const input = {
        ...createTurnInput(),
        roundNumber: 1 as const,
        hand: [nineC, nineD, nineH, kingC, kingD, kingH, extra],
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

      // After laying down, we're in awaitingDiscard, not drawn
      expect(actor.getSnapshot().value).not.toBe("drawn");
      expect(actor.getSnapshot().value).toBe("awaitingDiscard");

      // SKIP_LAY_DOWN should not be available in awaitingDiscard
      expect(actor.getSnapshot().can({ type: "SKIP_LAY_DOWN" })).toBe(false);
    });
  });

  describe("turn end after laying down", () => {
    it("if hand.length > 0: must discard one card to end turn", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingH = card("K", "hearts");
      const extra1 = card("5", "spades");
      const extra2 = card("6", "hearts");

      const input = {
        ...createTurnInput(),
        roundNumber: 1 as const,
        hand: [nineC, nineD, nineH, kingC, kingD, kingH, extra1, extra2],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      // Lay down
      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingH.id] },
        ],
      });

      expect(actor.getSnapshot().value).toBe("awaitingDiscard");
      expect(actor.getSnapshot().context.hand.length).toBeGreaterThan(0);

      // Must discard to complete turn
      actor.send({ type: "DISCARD", cardId: extra1.id });

      expect(actor.getSnapshot().value).toBe("turnComplete");
    });

    it.todo("if hand.length === 0: goes out immediately (no discard)", () => {
      // Note: This requires implementation of "going out" logic which is Phase 4
      // When a player lays down all their cards, they go out without discarding
    });
  });

  describe("cannot lay off on same turn", () => {
    it.todo("LAY_OFF command rejected when laidDownThisTurn is true", () => {});
    it.todo("error: cannot lay off on same turn as laying down", () => {});
    it.todo("must wait until next turn to lay off", () => {});
  });

  describe("cannot lay down again", () => {
    it("second LAY_DOWN command rejected", () => {
      // Create enough cards for two lay downs
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingH = card("K", "hearts");
      const threeC = card("3", "clubs");
      const threeD = card("3", "diamonds");
      const threeH = card("3", "hearts");
      const queenC = card("Q", "clubs");
      const queenD = card("Q", "diamonds");
      const queenH = card("Q", "hearts");
      const extra = card("5", "spades");

      const input = {
        ...createTurnInput(),
        roundNumber: 1 as const,
        hand: [nineC, nineD, nineH, kingC, kingD, kingH, threeC, threeD, threeH, queenC, queenD, queenH, extra],
      };
      const actor = createActor(turnMachine, { input });
      actor.start();
      actor.send({ type: "DRAW_FROM_STOCK" });

      // First lay down - succeeds
      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [nineC.id, nineD.id, nineH.id] },
          { type: "set" as const, cardIds: [kingC.id, kingD.id, kingH.id] },
        ],
      });

      expect(actor.getSnapshot().value).toBe("awaitingDiscard");
      expect(actor.getSnapshot().context.isDown).toBe(true);

      const tableBefore = actor.getSnapshot().context.table.length;

      // Second lay down attempt - should be rejected (not even possible in awaitingDiscard state)
      // In awaitingDiscard, only DISCARD is allowed
      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set" as const, cardIds: [threeC.id, threeD.id, threeH.id] },
          { type: "set" as const, cardIds: [queenC.id, queenD.id, queenH.id] },
        ],
      });

      // Should still be in awaitingDiscard, no additional melds
      expect(actor.getSnapshot().value).toBe("awaitingDiscard");
      expect(actor.getSnapshot().context.table.length).toBe(tableBefore);
    });

    it("isDown already true after first lay down", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingH = card("K", "hearts");
      const extra = card("5", "spades");

      const input = {
        ...createTurnInput(),
        roundNumber: 1 as const,
        isDown: false,
        hand: [nineC, nineD, nineH, kingC, kingD, kingH, extra],
      };
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
      // isDown is now true, which prevents future lay downs
    });
  });
});

describe("TurnMachine - turn completion after lay down", () => {
  describe("discard after laying down", () => {
    it("from awaitingDiscard, DISCARD command works normally", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingH = card("K", "hearts");
      const extra = card("5", "spades");

      const input = {
        ...createTurnInput(),
        roundNumber: 1 as const,
        hand: [nineC, nineD, nineH, kingC, kingD, kingH, extra],
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

      expect(actor.getSnapshot().value).toBe("awaitingDiscard");

      // Discard works in awaitingDiscard
      const discardableCard = actor.getSnapshot().context.hand[0]!;
      actor.send({ type: "DISCARD", cardId: discardableCard.id });

      expect(actor.getSnapshot().value).toBe("turnComplete");
    });

    it("card removed from hand, added to discard pile", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingH = card("K", "hearts");
      const extra = card("5", "spades");

      const input = {
        ...createTurnInput(),
        roundNumber: 1 as const,
        hand: [nineC, nineD, nineH, kingC, kingD, kingH, extra],
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

      const handBefore = actor.getSnapshot().context.hand;
      const discardPileBefore = actor.getSnapshot().context.discard;
      const discardCard = handBefore[0]!;

      actor.send({ type: "DISCARD", cardId: discardCard.id });

      const handAfter = actor.getSnapshot().context.hand;
      const discardPileAfter = actor.getSnapshot().context.discard;

      expect(handAfter.find(c => c.id === discardCard.id)).toBeUndefined();
      expect(discardPileAfter[0]!.id).toBe(discardCard.id);
      expect(discardPileAfter.length).toBe(discardPileBefore.length + 1);
    });

    it("transitions to turnComplete", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingH = card("K", "hearts");
      const extra = card("5", "spades");

      const input = {
        ...createTurnInput(),
        roundNumber: 1 as const,
        hand: [nineC, nineD, nineH, kingC, kingD, kingH, extra],
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

      expect(actor.getSnapshot().value).toBe("awaitingDiscard");

      const discardCard = actor.getSnapshot().context.hand[0]!;
      actor.send({ type: "DISCARD", cardId: discardCard.id });

      expect(actor.getSnapshot().value).toBe("turnComplete");
      expect(actor.getSnapshot().status).toBe("done");
    });

    it("output includes updated hand, table, discard", () => {
      const nineC = card("9", "clubs");
      const nineD = card("9", "diamonds");
      const nineH = card("9", "hearts");
      const kingC = card("K", "clubs");
      const kingD = card("K", "diamonds");
      const kingH = card("K", "hearts");
      const extra = card("5", "spades");

      const input = {
        ...createTurnInput(),
        roundNumber: 1 as const,
        hand: [nineC, nineD, nineH, kingC, kingD, kingH, extra],
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

      const discardCard = actor.getSnapshot().context.hand[0]!;
      actor.send({ type: "DISCARD", cardId: discardCard.id });

      const output = actor.getSnapshot().output;
      expect(output).toBeDefined();
      expect(output?.hand).toBeDefined();
      expect(output?.discard).toBeDefined();
      // Note: output doesn't currently include table, that's stored in context
    });
  });

  describe("turn output reflects lay down", () => {
    it.todo("output.isDown is true", () => {});
    it.todo("output.table includes new melds", () => {});
    it.todo("output.hand is reduced by meld cards + discard", () => {});
  });
});
