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
    it.todo("accepts valid 2 sets and 1 run", () => {});
    it.todo("minimum 10 cards used", () => {});
  });

  describe("successful lay down - Round 6 (1 set + 2 runs)", () => {
    it.todo("accepts valid 1 set and 2 runs", () => {});
    it.todo("minimum 11 cards used", () => {});
  });

  describe("melds with wilds", () => {
    it.todo("accepts set with valid wild ratio: (9C 9D Joker)", () => {});
    it.todo("accepts set with equal wilds/naturals: (9C 9D 2H Joker) - 2 natural, 2 wild", () => {});
    it.todo("accepts run with wild filling gap: (5S 6S Joker 8S)", () => {});
    it.todo("accepts run with wild at end: (5S 6S 7S 2C)", () => {});
    it.todo("rejects set with too many wilds: (9C Joker Joker)", () => {});
    it.todo("rejects run with too many wilds: (5S Joker Joker 2C) - 1 natural, 3 wild", () => {});
    it.todo("each meld validated independently for wild ratio", () => {});
  });

  describe("larger than minimum melds", () => {
    it.todo("accepts 4-card set: (9C 9D 9H 9S)", () => {});
    it.todo("accepts 5-card set: (9C 9D 9H 9S 9C) - duplicate from multi-deck", () => {});
    it.todo("accepts 5-card run: (5S 6S 7S 8S 9S)", () => {});
    it.todo("accepts 6+ card run: (5S 6S 7S 8S 9S 10S)", () => {});
    it.todo("larger melds still count as 1 set or 1 run toward contract", () => {});
  });

  describe("card removal from hand", () => {
    it.todo("only cards in melds are removed from hand", () => {});
    it.todo("remaining cards stay in hand", () => {});
    it.todo("hand size = previous size - cards laid down", () => {});
    it.todo("example: 12 cards - 6 laid down = 6 remaining", () => {});
    it.todo("correct cards removed (verified by cardId)", () => {});
  });

  describe("meld ownership", () => {
    it.todo("each meld has ownerId set to current player", () => {});
    it.todo("melds appear on table with correct owner", () => {});
    it.todo("multiple players' melds can coexist on table", () => {});
  });
});

describe("TurnMachine - invalid LAY_DOWN scenarios", () => {
  describe("wrong number of melds", () => {
    it.todo("round 1: rejects 1 set (need 2)", () => {});
    it.todo("round 1: rejects 3 sets (too many)", () => {});
    it.todo("round 2: rejects 2 sets + 0 runs (wrong combination)", () => {});
    it.todo("round 2: rejects 0 sets + 2 runs (wrong combination)", () => {});
    it.todo("provides clear error message about contract requirement", () => {});
  });

  describe("invalid individual melds", () => {
    it.todo("rejects if first meld is invalid, even if second is valid", () => {});
    it.todo("rejects if second meld is invalid, even if first is valid", () => {});
    it.todo("rejects set with different ranks: (9C 10D JH)", () => {});
    it.todo("rejects run with gap: (5S 6S 8S 9S)", () => {});
    it.todo("rejects run with mixed suits: (5S 6H 7S 8S)", () => {});
    it.todo("rejects run with only 3 cards: (5S 6S 7S)", () => {});
    it.todo("rejects set with only 2 cards: (9C 9D)", () => {});
    it.todo("provides specific error about which meld is invalid", () => {});
  });

  describe("card not in hand", () => {
    it.todo("rejects if any cardId in melds is not in player's hand", () => {});
    it.todo("rejects if cardId belongs to another player", () => {});
    it.todo("rejects if cardId is on the table already", () => {});
    it.todo("rejects if cardId does not exist", () => {});
  });

  describe("duplicate card usage", () => {
    it.todo("rejects if same cardId appears in two melds", () => {});
    it.todo("rejects overlapping cardIds (bug/cheat attempt)", () => {});
  });

  describe("already down", () => {
    it.todo("rejects LAY_DOWN if player already laid down this round", () => {});
    it.todo("isDown: true prevents any further lay down attempts", () => {});
    it.todo("error message: already laid down this round", () => {});
  });
});

describe("TurnMachine - post lay down behavior", () => {
  describe("auto-transition to awaitingDiscard", () => {
    it.todo("after successful LAY_DOWN, state becomes awaitingDiscard", () => {});
    it.todo("laidDownThisTurn flag causes this auto-transition", () => {});
    it.todo("player cannot stay in 'drawn' state after laying down", () => {});
  });

  describe("turn end after laying down", () => {
    it.todo("if hand.length > 0: must discard one card to end turn", () => {});
    it.todo("if hand.length === 0: goes out immediately (no discard)", () => {});
  });

  describe("cannot lay off on same turn", () => {
    it.todo("LAY_OFF command rejected when laidDownThisTurn is true", () => {});
    it.todo("error: cannot lay off on same turn as laying down", () => {});
    it.todo("must wait until next turn to lay off", () => {});
  });

  describe("cannot lay down again", () => {
    it.todo("second LAY_DOWN command rejected", () => {});
    it.todo("isDown already true", () => {});
  });
});

describe("TurnMachine - turn completion after lay down", () => {
  describe("discard after laying down", () => {
    it.todo("from awaitingDiscard, DISCARD command works normally", () => {});
    it.todo("card removed from hand, added to discard pile", () => {});
    it.todo("transitions to turnComplete", () => {});
    it.todo("output includes updated hand, table, discard", () => {});
  });

  describe("turn output reflects lay down", () => {
    it.todo("output.isDown is true", () => {});
    it.todo("output.table includes new melds", () => {});
    it.todo("output.hand is reduced by meld cards + discard", () => {});
  });
});
