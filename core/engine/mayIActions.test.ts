/**
 * May I Actions tests - Phase 6
 *
 * Tests for May I claiming actions and state updates
 */

import { describe, it, expect } from "bun:test";
import { createActor } from "xstate";
import { mayIWindowMachine } from "./mayIWindow.machine";
import type { MayIWindowInput } from "./mayIWindow.machine";
import type { Card } from "../card/card.types";

function createTestInput(overrides?: Partial<MayIWindowInput>): MayIWindowInput {
  const discardedCard: Card = { id: "card-K-spades", suit: "spades", rank: "K" };
  const stock: Card[] = [
    { id: "card-7-diamonds", suit: "diamonds", rank: "7" },
    { id: "card-3-clubs", suit: "clubs", rank: "3" },
  ];
  const playerOrder = overrides?.playerOrder ?? ["player-0", "player-1", "player-2", "player-3"];
  // Default: all players NOT down
  const playerDownStatus = overrides?.playerDownStatus ?? Object.fromEntries(playerOrder.map(id => [id, false]));

  return {
    discardedCard,
    discardedByPlayerId: "player-1",
    currentPlayerId: "player-2",
    currentPlayerIndex: 2,
    playerOrder,
    stock,
    playerDownStatus,
    ...overrides,
  };
}

function createMayIActor(input: MayIWindowInput) {
  const actor = createActor(mayIWindowMachine, { input });
  actor.start();
  return actor;
}

describe("current player claiming", () => {
  describe("claim via DRAW_FROM_DISCARD", () => {
    it("current player receives discardedCard", () => {
      const discardedCard: Card = { id: "card-K-spades", suit: "spades", rank: "K" };
      const input = createTestInput({ discardedCard, currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.winnerReceived).toContainEqual(discardedCard);
    });

    it("NO penalty card (it's their normal draw)", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.penaltyCard).toBeNull();
      expect(output?.winnerReceived).toHaveLength(1);
    });

    it("discard pile top removed", () => {
      const discardedCard: Card = { id: "card-K-spades", suit: "spades", rank: "K" };
      const input = createTestInput({ discardedCard, currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      // The discardedCard was taken by the winner
      expect(output?.discardedCard).toEqual(discardedCard);
      expect(output?.winnerId).toBe("player-2");
    });

    it("stock unchanged", () => {
      const stock: Card[] = [
        { id: "card-7-diamonds", suit: "diamonds", rank: "7" },
        { id: "card-3-clubs", suit: "clubs", rank: "3" },
      ];
      const input = createTestInput({ stock, currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      // Stock should be unchanged (no penalty card drawn)
      expect(output?.updatedStock).toEqual(stock);
    });

    it("current player's hand += 1", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      // Winner receives exactly 1 card (the discard)
      expect(output?.winnerReceived).toHaveLength(1);
    });
  });

  describe("claim voids other May I calls", () => {
    it("given: P3 and P0 have called May I, when: current player (P2) issues DRAW_FROM_DISCARD, then: P2 gets the card", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "CALL_MAY_I", playerId: "player-0" });
      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.winnerId).toBe("player-2");
    });

    it("P3's claim voided", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.type).toBe("CURRENT_PLAYER_CLAIMED");
      expect(output?.winnerId).not.toBe("player-3");
    });

    it("P0's claim voided", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-0" });
      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.type).toBe("CURRENT_PLAYER_CLAIMED");
      expect(output?.winnerId).not.toBe("player-0");
    });

    it("no penalty cards drawn by anyone", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "CALL_MAY_I", playerId: "player-0" });
      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.penaltyCard).toBeNull();
    });
  });

  describe("counts as current player's draw", () => {
    it("given: current player claims discard, then: they cannot also draw from stock", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-2" });

      // Machine is in final state - no more events accepted
      const snapshot = actor.getSnapshot();
      expect(snapshot.status).toBe("done");
    });

    it("turn continues from 'drawn' state", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.type).toBe("CURRENT_PLAYER_CLAIMED");
      // Parent machine should transition turn to drawn state
    });

    it("they can lay down, lay off, etc.", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      // The output indicates the window is closed, turn continues
      expect(output?.type).toBe("CURRENT_PLAYER_CLAIMED");
      expect(output?.winnerId).toBe("player-2");
    });
  });
});

describe("non-current player winning May I", () => {
  describe("receives discard + penalty", () => {
    it("given: P3 wins May I, then: P3 receives discardedCard", () => {
      const discardedCard: Card = { id: "card-K-spades", suit: "spades", rank: "K" };
      const input = createTestInput({ discardedCard, currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.winnerId).toBe("player-3");
      expect(output?.winnerReceived).toContainEqual(discardedCard);
    });

    it("P3 receives penalty card (top of stock)", () => {
      const penaltyCard: Card = { id: "card-7-diamonds", suit: "diamonds", rank: "7" };
      const input = createTestInput({
        stock: [penaltyCard, { id: "card-3-clubs", suit: "clubs", rank: "3" }],
        currentPlayerId: "player-2",
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.penaltyCard).toEqual(penaltyCard);
      expect(output?.winnerReceived).toContainEqual(penaltyCard);
    });

    it("P3's hand += 2", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.winnerReceived).toHaveLength(2);
    });
  });

  describe("discard and stock updated", () => {
    it("discard = [Q♥, ...] (K♠ removed)", () => {
      const discardedCard: Card = { id: "card-K-spades", suit: "spades", rank: "K" };
      const input = createTestInput({ discardedCard, currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      // The discardedCard was taken by winner
      expect(output?.discardedCard).toEqual(discardedCard);
      expect(output?.winnerId).toBe("player-3");
    });

    it("stock = [3♣, ...] (7♦ removed as penalty)", () => {
      const penaltyCard: Card = { id: "card-7-diamonds", suit: "diamonds", rank: "7" };
      const remainingStock: Card = { id: "card-3-clubs", suit: "clubs", rank: "3" };
      const input = createTestInput({
        stock: [penaltyCard, remainingStock],
        currentPlayerId: "player-2",
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      // Stock should have penalty card removed
      expect(output?.updatedStock).toEqual([remainingStock]);
    });

    it("P3's hand includes K♠ and 7♦", () => {
      const discardedCard: Card = { id: "card-K-spades", suit: "spades", rank: "K" };
      const penaltyCard: Card = { id: "card-7-diamonds", suit: "diamonds", rank: "7" };
      const input = createTestInput({
        discardedCard,
        stock: [penaltyCard, { id: "card-3-clubs", suit: "clubs", rank: "3" }],
        currentPlayerId: "player-2",
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.winnerReceived).toContainEqual(discardedCard);
      expect(output?.winnerReceived).toContainEqual(penaltyCard);
    });
  });

  describe("turn order unchanged", () => {
    it("given: P2 is current player, drew from stock, P3 wins May I, then: it's still P2's turn", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      // Output type is MAY_I_RESOLVED, current player continues their turn
      const output = actor.getSnapshot().output;
      expect(output?.type).toBe("MAY_I_RESOLVED");
      // The machine doesn't change turn order - P2 continues
    });

    it("P3 must wait for their normal turn", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      // P3 won the May I but doesn't get to play now
      const output = actor.getSnapshot().output;
      expect(output?.winnerId).toBe("player-3");
      expect(output?.type).toBe("MAY_I_RESOLVED");
    });

    it("turn order: P2 (current) → P3 → P0 → P1 → ...", () => {
      const input = createTestInput({
        currentPlayerId: "player-2",
        playerOrder: ["player-0", "player-1", "player-2", "player-3"],
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      // Verify context preserves player order
      const context = actor.getSnapshot().context;
      expect(context.playerOrder).toEqual(["player-0", "player-1", "player-2", "player-3"]);
    });
  });
});

describe("no claims scenario", () => {
  describe("discard stays on pile", () => {
    it("given: current player drew from stock, no one called May I, then: discard pile unchanged", () => {
      const discardedCard: Card = { id: "card-K-spades", suit: "spades", rank: "K" };
      const input = createTestInput({ discardedCard, currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.type).toBe("NO_CLAIMS");
      expect(output?.discardedCard).toEqual(discardedCard);
    });

    it("discardedCard still on top", () => {
      const discardedCard: Card = { id: "card-K-spades", suit: "spades", rank: "K" };
      const input = createTestInput({ discardedCard, currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.discardedCard).toEqual(discardedCard);
      expect(output?.winnerId).toBeNull();
    });

    it("stock unchanged", () => {
      const stock: Card[] = [
        { id: "card-7-diamonds", suit: "diamonds", rank: "7" },
        { id: "card-3-clubs", suit: "clubs", rank: "3" },
      ];
      const input = createTestInput({ stock, currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.updatedStock).toEqual(stock);
    });

    it("no hands changed (from May I)", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.winnerReceived).toEqual([]);
      expect(output?.winnerId).toBeNull();
    });
  });
});
