/**
 * May I Integration tests - Phase 6
 *
 * End-to-end tests for complete May I flow scenarios
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
    { id: "card-9-hearts", suit: "hearts", rank: "9" },
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

describe("May I - complete flow scenarios", () => {
  describe("Scenario: Current player takes discard, no May I", () => {
    it("given: 4 players, P1 discards K♠, P2 is current, when: P2 issues DRAW_FROM_DISCARD, then: P2 receives K♠", () => {
      const discardedCard: Card = { id: "card-K-spades", suit: "spades", rank: "K" };
      const input = createTestInput({
        discardedCard,
        discardedByPlayerId: "player-1",
        currentPlayerId: "player-2",
      });
      const actor = createMayIActor(input);

      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.winnerId).toBe("player-2");
      expect(output?.winnerReceived).toContainEqual(discardedCard);
    });

    it("no penalty", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.penaltyCard).toBeNull();
      expect(output?.winnerReceived).toHaveLength(1);
    });

    it("May I window closes", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-2" });

      const snapshot = actor.getSnapshot();
      expect(snapshot.status).toBe("done");
    });

    it("P2's turn continues in 'drawn' state", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.type).toBe("CURRENT_PLAYER_CLAIMED");
      // Parent machine transitions turn to drawn state
    });
  });

  describe("Scenario: Current player draws stock, one May I claimant", () => {
    it("given: P1 discards K♠, P2 is current, when: P3 calls May I, P2 issues DRAW_FROM_STOCK", () => {
      const discardedCard: Card = { id: "card-K-spades", suit: "spades", rank: "K" };
      const input = createTestInput({
        discardedCard,
        discardedByPlayerId: "player-1",
        currentPlayerId: "player-2",
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.type).toBe("MAY_I_RESOLVED");
    });

    it("then: P2 receives stock card, May I resolves, P3 wins (only claimant)", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.winnerId).toBe("player-3");
      // P2's stock card draw is handled by TurnMachine, not May I window
    });

    it("P3 receives K♠ + penalty card, P2's turn continues", () => {
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
      expect(output?.winnerReceived).toHaveLength(2);
    });
  });

  describe("Scenario: Multiple claimants, priority resolution", () => {
    it("given: P1 discards K♠, P2 is current, when: P0 calls May I, P3 calls May I, P2 draws from stock", () => {
      const input = createTestInput({
        discardedByPlayerId: "player-1",
        currentPlayerId: "player-2",
        currentPlayerIndex: 2,
        playerOrder: ["player-0", "player-1", "player-2", "player-3"],
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-0" });
      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.type).toBe("MAY_I_RESOLVED");
    });

    it("then: priority order (after P2): P3, P0, P3 wins (closer to P2)", () => {
      const input = createTestInput({
        discardedByPlayerId: "player-1",
        currentPlayerId: "player-2",
        currentPlayerIndex: 2,
        playerOrder: ["player-0", "player-1", "player-2", "player-3"],
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-0" });
      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      // P3 is at index 3, P2 is at index 2, so P3 is next (1 away)
      // P0 is at index 0, wrapping from P3, so P0 is further (2 away)
      expect(output?.winnerId).toBe("player-3");
    });

    it("P3 receives K♠ + penalty, P0 receives nothing", () => {
      const discardedCard: Card = { id: "card-K-spades", suit: "spades", rank: "K" };
      const penaltyCard: Card = { id: "card-7-diamonds", suit: "diamonds", rank: "7" };
      const input = createTestInput({
        discardedCard,
        stock: [penaltyCard, { id: "card-3-clubs", suit: "clubs", rank: "3" }],
        discardedByPlayerId: "player-1",
        currentPlayerId: "player-2",
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-0" });
      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.winnerId).toBe("player-3");
      expect(output?.winnerReceived).toContainEqual(discardedCard);
      expect(output?.winnerReceived).toContainEqual(penaltyCard);
      // P0 receives nothing (implicit - not the winner)
    });
  });

  describe("Scenario: Current player vetoes May I", () => {
    it("given: P1 discards K♠, P2 is current, when: P3 calls May I, P0 calls May I, P2 draws from DISCARD (veto)", () => {
      const discardedCard: Card = { id: "card-K-spades", suit: "spades", rank: "K" };
      const input = createTestInput({
        discardedCard,
        discardedByPlayerId: "player-1",
        currentPlayerId: "player-2",
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "CALL_MAY_I", playerId: "player-0" });
      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.type).toBe("CURRENT_PLAYER_CLAIMED");
    });

    it("then: P2 receives K♠ (no penalty), P3's claim denied, P0's claim denied", () => {
      const discardedCard: Card = { id: "card-K-spades", suit: "spades", rank: "K" };
      const input = createTestInput({
        discardedCard,
        discardedByPlayerId: "player-1",
        currentPlayerId: "player-2",
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "CALL_MAY_I", playerId: "player-0" });
      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.winnerId).toBe("player-2");
      expect(output?.winnerReceived).toContainEqual(discardedCard);
      expect(output?.penaltyCard).toBeNull();
    });

    it("P2's turn continues", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-2" });

      const snapshot = actor.getSnapshot();
      expect(snapshot.status).toBe("done");
      expect(snapshot.output?.type).toBe("CURRENT_PLAYER_CLAIMED");
    });
  });

  describe("Scenario: Non-current player vetoes another", () => {
    it("given: P1 discards K♠, P2 is current, when: P0 calls May I (3 positions away), P3 calls May I (1 position away)", () => {
      const input = createTestInput({
        discardedByPlayerId: "player-1",
        currentPlayerId: "player-2",
        currentPlayerIndex: 2,
        playerOrder: ["player-0", "player-1", "player-2", "player-3"],
      });
      const actor = createMayIActor(input);

      // P0 calls first (further away)
      actor.send({ type: "CALL_MAY_I", playerId: "player-0" });
      // P3 calls second (closer)
      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });

      // Verify both called
      const context = actor.getSnapshot().context;
      expect(context.claimants).toContain("player-0");
      expect(context.claimants).toContain("player-3");
    });

    it("P2 draws from stock (passes), then: P3 wins over P0 (closer in priority)", () => {
      const input = createTestInput({
        discardedByPlayerId: "player-1",
        currentPlayerId: "player-2",
        currentPlayerIndex: 2,
        playerOrder: ["player-0", "player-1", "player-2", "player-3"],
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-0" });
      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.winnerId).toBe("player-3");
    });

    it("this is 'P3 vetoing P0', P3 receives K♠ + penalty, P0 receives nothing", () => {
      const discardedCard: Card = { id: "card-K-spades", suit: "spades", rank: "K" };
      const penaltyCard: Card = { id: "card-7-diamonds", suit: "diamonds", rank: "7" };
      const input = createTestInput({
        discardedCard,
        stock: [penaltyCard, { id: "card-3-clubs", suit: "clubs", rank: "3" }],
        discardedByPlayerId: "player-1",
        currentPlayerId: "player-2",
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-0" });
      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.winnerId).toBe("player-3");
      expect(output?.winnerReceived).toContainEqual(discardedCard);
      expect(output?.winnerReceived).toContainEqual(penaltyCard);
    });
  });

  describe("Scenario: No one wants the discard", () => {
    it("given: P1 discards 3♣ (low value), P2 is current, when: P2 draws from stock, no one calls May I", () => {
      const discardedCard: Card = { id: "card-3-clubs", suit: "clubs", rank: "3" };
      const input = createTestInput({
        discardedCard,
        discardedByPlayerId: "player-1",
        currentPlayerId: "player-2",
      });
      const actor = createMayIActor(input);

      // P2 draws from stock, no May I calls
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.type).toBe("NO_CLAIMS");
    });

    it("then: 3♣ remains on discard pile, P2's turn continues, no hands changed from May I", () => {
      const discardedCard: Card = { id: "card-3-clubs", suit: "clubs", rank: "3" };
      const stock: Card[] = [
        { id: "card-7-diamonds", suit: "diamonds", rank: "7" },
        { id: "card-9-hearts", suit: "hearts", rank: "9" },
      ];
      const input = createTestInput({
        discardedCard,
        stock,
        currentPlayerId: "player-2",
      });
      const actor = createMayIActor(input);

      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.discardedCard).toEqual(discardedCard);
      expect(output?.winnerId).toBeNull();
      expect(output?.winnerReceived).toEqual([]);
      expect(output?.updatedStock).toEqual(stock); // Stock unchanged
    });
  });

  describe("Scenario: May I before current player decides", () => {
    it("given: P1 discards K♠, P2's turn starts, when: P3 immediately calls May I (before P2 acts)", () => {
      const discardedCard: Card = { id: "card-K-spades", suit: "spades", rank: "K" };
      const input = createTestInput({
        discardedCard,
        discardedByPlayerId: "player-1",
        currentPlayerId: "player-2",
      });
      const actor = createMayIActor(input);

      // P3 calls May I before P2 makes any decision
      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });

      const context = actor.getSnapshot().context;
      expect(context.claimants).toContain("player-3");
      // Window still open, awaiting P2's decision
      expect(actor.getSnapshot().value).toBe("open");
    });

    it("P2 sees P3 wants it, P2 decides to draw from discard (veto)", () => {
      const discardedCard: Card = { id: "card-K-spades", suit: "spades", rank: "K" };
      const input = createTestInput({
        discardedCard,
        discardedByPlayerId: "player-1",
        currentPlayerId: "player-2",
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      // P2 decides to veto
      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.winnerId).toBe("player-2");
    });

    it("then: P2 gets K♠ (no penalty), P3's early claim denied", () => {
      const discardedCard: Card = { id: "card-K-spades", suit: "spades", rank: "K" };
      const input = createTestInput({
        discardedCard,
        discardedByPlayerId: "player-1",
        currentPlayerId: "player-2",
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.type).toBe("CURRENT_PLAYER_CLAIMED");
      expect(output?.winnerId).toBe("player-2");
      expect(output?.winnerReceived).toContainEqual(discardedCard);
      expect(output?.penaltyCard).toBeNull();
    });
  });
});

describe("May I - edge cases", () => {
  describe("May I with 3 players (minimum)", () => {
    it("given: 3 players [P0, P1, P2], P0 discards, P1 is current, then: only P2 can call May I", () => {
      const input = createTestInput({
        discardedByPlayerId: "player-0",
        currentPlayerId: "player-1",
        currentPlayerIndex: 1,
        playerOrder: ["player-0", "player-1", "player-2"],
      });
      const actor = createMayIActor(input);

      // P0 can't call - they discarded
      expect(actor.getSnapshot().can({ type: "CALL_MAY_I", playerId: "player-0" })).toBe(false);
      // P1 is current - they would use DRAW_FROM_DISCARD instead of CALL_MAY_I
      // (guard allows it, but semantically they claim via DRAW_FROM_DISCARD)
      expect(actor.getSnapshot().can({ type: "DRAW_FROM_DISCARD", playerId: "player-1" })).toBe(true);
      // P2 can call
      expect(actor.getSnapshot().can({ type: "CALL_MAY_I", playerId: "player-2" })).toBe(true);
    });

    it("P2 wins automatically if they call", () => {
      const input = createTestInput({
        discardedByPlayerId: "player-0",
        currentPlayerId: "player-1",
        currentPlayerIndex: 1,
        playerOrder: ["player-0", "player-1", "player-2"],
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-2" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-1" });

      const output = actor.getSnapshot().output;
      expect(output?.winnerId).toBe("player-2");
    });

    it("P1 can veto by taking discard", () => {
      const discardedCard: Card = { id: "card-K-spades", suit: "spades", rank: "K" };
      const input = createTestInput({
        discardedCard,
        discardedByPlayerId: "player-0",
        currentPlayerId: "player-1",
        currentPlayerIndex: 1,
        playerOrder: ["player-0", "player-1", "player-2"],
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-2" });
      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-1" });

      const output = actor.getSnapshot().output;
      expect(output?.winnerId).toBe("player-1");
      expect(output?.winnerReceived).toContainEqual(discardedCard);
    });
  });

  describe("May I with 8 players (maximum)", () => {
    it("given: 8 players, P0 discards, P1 is current, then: P2-P7 can all call May I", () => {
      const playerOrder = [
        "player-0",
        "player-1",
        "player-2",
        "player-3",
        "player-4",
        "player-5",
        "player-6",
        "player-7",
      ];
      const input = createTestInput({
        discardedByPlayerId: "player-0",
        currentPlayerId: "player-1",
        currentPlayerIndex: 1,
        playerOrder,
      });
      const actor = createMayIActor(input);

      // P0 can't - discarder
      expect(actor.getSnapshot().can({ type: "CALL_MAY_I", playerId: "player-0" })).toBe(false);
      // P1 is current - they would use DRAW_FROM_DISCARD instead
      expect(actor.getSnapshot().can({ type: "DRAW_FROM_DISCARD", playerId: "player-1" })).toBe(true);
      // P2-P7 can all call
      for (let i = 2; i <= 7; i++) {
        expect(actor.getSnapshot().can({ type: "CALL_MAY_I", playerId: `player-${i}` })).toBe(true);
      }
    });

    it("P2 has highest priority (closest to P1)", () => {
      const playerOrder = [
        "player-0",
        "player-1",
        "player-2",
        "player-3",
        "player-4",
        "player-5",
        "player-6",
        "player-7",
      ];
      const input = createTestInput({
        discardedByPlayerId: "player-0",
        currentPlayerId: "player-1",
        currentPlayerIndex: 1,
        playerOrder,
      });
      const actor = createMayIActor(input);

      // Everyone calls May I
      actor.send({ type: "CALL_MAY_I", playerId: "player-7" });
      actor.send({ type: "CALL_MAY_I", playerId: "player-5" });
      actor.send({ type: "CALL_MAY_I", playerId: "player-2" });
      actor.send({ type: "CALL_MAY_I", playerId: "player-4" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-1" });

      const output = actor.getSnapshot().output;
      // P2 is closest to P1 in turn order
      expect(output?.winnerId).toBe("player-2");
    });

    it("if only P7 calls, P7 wins", () => {
      const playerOrder = [
        "player-0",
        "player-1",
        "player-2",
        "player-3",
        "player-4",
        "player-5",
        "player-6",
        "player-7",
      ];
      const input = createTestInput({
        discardedByPlayerId: "player-0",
        currentPlayerId: "player-1",
        currentPlayerIndex: 1,
        playerOrder,
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-7" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-1" });

      const output = actor.getSnapshot().output;
      expect(output?.winnerId).toBe("player-7");
    });
  });

  describe("May I when stock is low", () => {
    it("given: stock has 1 card, P3 wins May I, when: penalty card drawn, then: stock becomes empty", () => {
      const penaltyCard: Card = { id: "card-7-diamonds", suit: "diamonds", rank: "7" };
      const input = createTestInput({
        stock: [penaltyCard], // Only 1 card in stock
        currentPlayerId: "player-2",
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.penaltyCard).toEqual(penaltyCard);
      expect(output?.updatedStock).toHaveLength(0);
    });

    it("next draw may trigger reshuffle", () => {
      const input = createTestInput({
        stock: [{ id: "card-7-diamonds", suit: "diamonds", rank: "7" }],
        currentPlayerId: "player-2",
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      // Stock is now empty - RoundMachine would handle reshuffle on next draw
      expect(output?.updatedStock).toHaveLength(0);
    });
  });

  describe("May I when stock is empty", () => {
    it("given: stock is empty, discard pile has cards, when: P3 wins May I", () => {
      // Edge case: stock is empty but May I still works
      // In this scenario, the penalty card would require reshuffle first
      // The May I window machine assumes stock has cards for penalty
      // If stock is empty, the penalty card would be null
      const input = createTestInput({
        stock: [], // Empty stock
        currentPlayerId: "player-2",
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.winnerId).toBe("player-3");
      // No penalty card available (null, not undefined)
      expect(output?.penaltyCard).toBeNull();
    });

    it("then: reshuffle discard (except top) to form stock, THEN draw penalty card", () => {
      // This logic is handled by RoundMachine, not MayIWindowMachine
      // RoundMachine would reshuffle before passing stock to MayIWindowMachine
      // Testing the contract that MayIWindowMachine receives a valid stock
      const reshuffledStock: Card[] = [
        { id: "card-Q-hearts", suit: "hearts", rank: "Q" },
        { id: "card-5-diamonds", suit: "diamonds", rank: "5" },
      ];
      const input = createTestInput({
        stock: reshuffledStock,
        currentPlayerId: "player-2",
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.penaltyCard).toEqual(reshuffledStock[0]);
    });

    it("May I completes normally", () => {
      const reshuffledStock: Card[] = [
        { id: "card-Q-hearts", suit: "hearts", rank: "Q" },
        { id: "card-5-diamonds", suit: "diamonds", rank: "5" },
      ];
      const input = createTestInput({
        stock: reshuffledStock,
        currentPlayerId: "player-2",
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const snapshot = actor.getSnapshot();
      expect(snapshot.status).toBe("done");
      expect(snapshot.output?.type).toBe("MAY_I_RESOLVED");
    });
  });

  describe("First discard of round", () => {
    it("given: round just started, first player's turn, when: first player discards", () => {
      // Simulating first turn: P0 is dealer, P1 goes first, P1 discards
      // Then P2's turn starts with May I window
      const input = createTestInput({
        discardedByPlayerId: "player-1", // First player just discarded
        currentPlayerId: "player-2",
        currentPlayerIndex: 2,
        playerOrder: ["player-0", "player-1", "player-2", "player-3"],
      });
      const actor = createMayIActor(input);

      // May I window opens normally
      expect(actor.getSnapshot().value).toBe("open");
    });

    it("then: May I window opens normally, second player is current, all rules apply", () => {
      const discardedCard: Card = { id: "card-K-spades", suit: "spades", rank: "K" };
      const input = createTestInput({
        discardedCard,
        discardedByPlayerId: "player-1",
        currentPlayerId: "player-2",
        currentPlayerIndex: 2,
        playerOrder: ["player-0", "player-1", "player-2", "player-3"],
      });
      const actor = createMayIActor(input);

      // P3 and P0 can call May I (P1 discarded, P2 is current)
      expect(actor.getSnapshot().can({ type: "CALL_MAY_I", playerId: "player-3" })).toBe(true);
      expect(actor.getSnapshot().can({ type: "CALL_MAY_I", playerId: "player-0" })).toBe(true);
      // P1 can't call - they discarded
      expect(actor.getSnapshot().can({ type: "CALL_MAY_I", playerId: "player-1" })).toBe(false);
      // P2 is current - they would use DRAW_FROM_DISCARD to claim
      expect(actor.getSnapshot().can({ type: "DRAW_FROM_DISCARD", playerId: "player-2" })).toBe(true);
    });
  });
});

describe("May I - turn order verification", () => {
  describe("turn order unchanged after May I", () => {
    it("given: turn order is P0 → P1 → P2 → P3 → P0..., P1's turn, P1 discards, P3 wins May I", () => {
      const input = createTestInput({
        discardedByPlayerId: "player-1",
        currentPlayerId: "player-2",
        currentPlayerIndex: 2,
        playerOrder: ["player-0", "player-1", "player-2", "player-3"],
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.winnerId).toBe("player-3");
    });

    it("then: P2 takes next turn (not P3), P3 takes turn after P2, order unchanged", () => {
      const input = createTestInput({
        discardedByPlayerId: "player-1",
        currentPlayerId: "player-2",
        currentPlayerIndex: 2,
        playerOrder: ["player-0", "player-1", "player-2", "player-3"],
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      // Output type is MAY_I_RESOLVED, current player (P2) continues their turn
      expect(output?.type).toBe("MAY_I_RESOLVED");
      // Player order in context unchanged
      const context = actor.getSnapshot().context;
      expect(context.playerOrder).toEqual(["player-0", "player-1", "player-2", "player-3"]);
    });

    it("P3 just got cards out of turn", () => {
      const discardedCard: Card = { id: "card-K-spades", suit: "spades", rank: "K" };
      const penaltyCard: Card = { id: "card-7-diamonds", suit: "diamonds", rank: "7" };
      const input = createTestInput({
        discardedCard,
        stock: [penaltyCard, { id: "card-3-clubs", suit: "clubs", rank: "3" }],
        discardedByPlayerId: "player-1",
        currentPlayerId: "player-2",
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      // P3 got cards but it's still P2's turn
      expect(output?.winnerId).toBe("player-3");
      expect(output?.winnerReceived).toHaveLength(2);
    });
  });

  describe("May I winner waits for their turn", () => {
    it("given: P3 wins May I during P2's turn, then: P2 completes their turn", () => {
      const input = createTestInput({
        discardedByPlayerId: "player-1",
        currentPlayerId: "player-2",
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.type).toBe("MAY_I_RESOLVED");
      // P2's turn continues after May I resolution
    });

    it("P3 takes their turn (with May I cards already in hand)", () => {
      const discardedCard: Card = { id: "card-K-spades", suit: "spades", rank: "K" };
      const penaltyCard: Card = { id: "card-7-diamonds", suit: "diamonds", rank: "7" };
      const input = createTestInput({
        discardedCard,
        stock: [penaltyCard, { id: "card-3-clubs", suit: "clubs", rank: "3" }],
        discardedByPlayerId: "player-1",
        currentPlayerId: "player-2",
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      // P3 receives cards now, will use them on their turn
      expect(output?.winnerId).toBe("player-3");
      expect(output?.winnerReceived).toContainEqual(discardedCard);
      expect(output?.winnerReceived).toContainEqual(penaltyCard);
    });

    it("P0 takes their turn, normal rotation", () => {
      const input = createTestInput({
        discardedByPlayerId: "player-1",
        currentPlayerId: "player-2",
        playerOrder: ["player-0", "player-1", "player-2", "player-3"],
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      // Turn order preserved in context
      const context = actor.getSnapshot().context;
      expect(context.playerOrder).toEqual(["player-0", "player-1", "player-2", "player-3"]);
      // After P2 is P3, after P3 is P0 (normal rotation)
    });
  });
});

describe("May I - strategic scenarios", () => {
  describe("May I to complete contract", () => {
    it("given: P3 needs K♠ to complete contract, P1 discards K♠, when: P3 calls May I, P2 draws from stock", () => {
      const discardedCard: Card = { id: "card-K-spades", suit: "spades", rank: "K" };
      const input = createTestInput({
        discardedCard,
        discardedByPlayerId: "player-1",
        currentPlayerId: "player-2",
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.winnerId).toBe("player-3");
    });

    it("then: P3 gets K♠ + penalty, P3 can now potentially lay down", () => {
      const discardedCard: Card = { id: "card-K-spades", suit: "spades", rank: "K" };
      const penaltyCard: Card = { id: "card-7-diamonds", suit: "diamonds", rank: "7" };
      const input = createTestInput({
        discardedCard,
        stock: [penaltyCard, { id: "card-3-clubs", suit: "clubs", rank: "3" }],
        discardedByPlayerId: "player-1",
        currentPlayerId: "player-2",
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.winnerReceived).toContainEqual(discardedCard);
      // P3 now has K♠ and can use it for contract
    });

    it("strategic advantage worth the penalty card", () => {
      // The penalty card is the cost of May I, but getting the card you need
      // may be worth it to complete contract and lay down
      const discardedCard: Card = { id: "card-K-spades", suit: "spades", rank: "K" };
      const penaltyCard: Card = { id: "card-2-clubs", suit: "clubs", rank: "2" }; // Low value
      const input = createTestInput({
        discardedCard,
        stock: [penaltyCard],
        discardedByPlayerId: "player-1",
        currentPlayerId: "player-2",
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.winnerReceived).toHaveLength(2);
      // Got K (10 points) + 2 (2 points) = 12 points of cards
      // But if K completes contract, worth it
    });
  });

  describe("May I risk - getting caught", () => {
    it("given: P3 has 15 cards (from multiple May I calls), P0 goes out", () => {
      // This scenario is about strategic risk
      // Each May I call adds 2 cards to hand
      // If you can't go out and someone else does, you score all those cards
      const input = createTestInput({
        currentPlayerId: "player-2",
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      // P3 gets 2 more cards (now would have 15 if they had 13)
      expect(output?.winnerReceived).toHaveLength(2);
    });

    it("then: P3 scores all 15 cards, potentially very high score", () => {
      // If P3 has face cards and wilds, score could be 100+ points
      // This is the risk of May I - you get cards but may not use them
      const penaltyCard: Card = { id: "card-Joker-0", suit: null, rank: "Joker" }; // 50 points!
      const input = createTestInput({
        stock: [penaltyCard],
        currentPlayerId: "player-2",
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.penaltyCard?.rank).toBe("Joker");
      // Ouch - 50 point penalty card if P3 gets caught
    });

    it("May I is high risk if you can't use the cards", () => {
      // Strategic lesson: only May I if the card is valuable to your strategy
      const discardedCard: Card = { id: "card-4-clubs", suit: "clubs", rank: "4" }; // Low value
      const penaltyCard: Card = { id: "card-Q-hearts", suit: "hearts", rank: "Q" }; // 10 points
      const input = createTestInput({
        discardedCard,
        stock: [penaltyCard],
        currentPlayerId: "player-2",
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      // P3 got 4 + Q = 14 points of cards
      // If these don't help complete contract, risky move
      expect(output?.winnerReceived).toHaveLength(2);
    });
  });

  describe("Vetoing to block opponent", () => {
    it("given: P3 needs K♠ to complete contract, P1 discards K♠, P3 calls May I", () => {
      const discardedCard: Card = { id: "card-K-spades", suit: "spades", rank: "K" };
      const input = createTestInput({
        discardedCard,
        discardedByPlayerId: "player-1",
        currentPlayerId: "player-2",
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });

      const context = actor.getSnapshot().context;
      expect(context.claimants).toContain("player-3");
    });

    it("when: P2 (current) doesn't need K♠ but wants to block P3, then: P2 can veto by taking discard (no penalty for P2)", () => {
      const discardedCard: Card = { id: "card-K-spades", suit: "spades", rank: "K" };
      const input = createTestInput({
        discardedCard,
        discardedByPlayerId: "player-1",
        currentPlayerId: "player-2",
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.winnerId).toBe("player-2");
      expect(output?.penaltyCard).toBeNull(); // No penalty for current player
    });

    it("P3 doesn't get the card, strategic blocking", () => {
      const discardedCard: Card = { id: "card-K-spades", suit: "spades", rank: "K" };
      const input = createTestInput({
        discardedCard,
        discardedByPlayerId: "player-1",
        currentPlayerId: "player-2",
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.winnerId).not.toBe("player-3");
      expect(output?.type).toBe("CURRENT_PLAYER_CLAIMED");
    });
  });

  describe("Non-current veto to block", () => {
    it("given: P0 (3 turns away) calls May I for K♠, P3 (1 turn away) doesn't need K♠ but wants to block P0", () => {
      const discardedCard: Card = { id: "card-K-spades", suit: "spades", rank: "K" };
      const input = createTestInput({
        discardedCard,
        discardedByPlayerId: "player-1",
        currentPlayerId: "player-2",
        playerOrder: ["player-0", "player-1", "player-2", "player-3"],
      });
      const actor = createMayIActor(input);

      // P0 calls first
      actor.send({ type: "CALL_MAY_I", playerId: "player-0" });
      // P3 calls to block
      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });

      const context = actor.getSnapshot().context;
      expect(context.claimants).toContain("player-0");
      expect(context.claimants).toContain("player-3");
    });

    it("when: P3 calls May I (veto), then: P3 gets K♠ + penalty, P0 blocked", () => {
      const discardedCard: Card = { id: "card-K-spades", suit: "spades", rank: "K" };
      const penaltyCard: Card = { id: "card-7-diamonds", suit: "diamonds", rank: "7" };
      const input = createTestInput({
        discardedCard,
        stock: [penaltyCard, { id: "card-3-clubs", suit: "clubs", rank: "3" }],
        discardedByPlayerId: "player-1",
        currentPlayerId: "player-2",
        playerOrder: ["player-0", "player-1", "player-2", "player-3"],
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-0" });
      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.winnerId).toBe("player-3");
      expect(output?.winnerReceived).toContainEqual(discardedCard);
      expect(output?.winnerReceived).toContainEqual(penaltyCard);
    });

    it("P3 paid penalty to block, may be worth it strategically", () => {
      const discardedCard: Card = { id: "card-K-spades", suit: "spades", rank: "K" };
      const penaltyCard: Card = { id: "card-3-clubs", suit: "clubs", rank: "3" }; // Only 3 points
      const input = createTestInput({
        discardedCard,
        stock: [penaltyCard],
        discardedByPlayerId: "player-1",
        currentPlayerId: "player-2",
        playerOrder: ["player-0", "player-1", "player-2", "player-3"],
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-0" });
      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      // P3 got K (10 pts) + 3 (3 pts) = 13 points of cards
      // But blocked P0 from completing their contract
      expect(output?.winnerId).toBe("player-3");
      expect(output?.winnerReceived).toHaveLength(2);
    });
  });
});
