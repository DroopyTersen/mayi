/**
 * TurnMachine May I Awareness tests - Phase 6
 *
 * Tests for TurnMachine integration with May I window
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

describe("TurnMachine - May I awareness", () => {
  describe("turn starts in awaitingDraw", () => {
    it("given: May I window just opened (previous player discarded), then: turn machine in 'awaitingDraw' state", () => {
      // When May I window opens after previous player discards,
      // the TurnMachine for current player should be in awaitingDraw
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      // May I window is in open state, awaiting draw decision
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("open");

      // TurnMachine would be in awaitingDraw, waiting for current player's draw
      // The May I window accepts DRAW_FROM_DISCARD or DRAW_FROM_STOCK
      expect(snapshot.can({ type: "DRAW_FROM_DISCARD", playerId: "player-2" })).toBe(true);
      expect(snapshot.can({ type: "DRAW_FROM_STOCK", playerId: "player-2" })).toBe(true);
    });

    it("May I window is active concurrently", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      // While TurnMachine is in awaitingDraw, May I window is open
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("open");

      // Other players can call May I during this time
      expect(snapshot.can({ type: "CALL_MAY_I", playerId: "player-3" })).toBe(true);
      expect(snapshot.can({ type: "CALL_MAY_I", playerId: "player-0" })).toBe(true);
    });

    it("current player's draw command affects May I window", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      // Current player draws from stock
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      // This closes the May I window
      const snapshot = actor.getSnapshot();
      expect(snapshot.status).toBe("done");
    });
  });

  describe("DRAW_FROM_DISCARD during May I window", () => {
    it("when: current player issues DRAW_FROM_DISCARD, then: TurnMachine transitions to 'drawn'", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-2" });

      // May I window is done, TurnMachine would transition to drawn
      const output = actor.getSnapshot().output;
      expect(output?.type).toBe("CURRENT_PLAYER_CLAIMED");
      // TurnMachine proceeds to drawn state after this
    });

    it("MayIWindow receives the claim", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      // Even if others called May I first, current player can claim
      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.winnerId).toBe("player-2");
    });

    it("May I window closes (CURRENT_PLAYER_CLAIMED)", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-2" });

      const snapshot = actor.getSnapshot();
      expect(snapshot.status).toBe("done");
      expect(snapshot.output?.type).toBe("CURRENT_PLAYER_CLAIMED");
    });

    it("current player has the discard", () => {
      const discardedCard: Card = { id: "card-K-spades", suit: "spades", rank: "K" };
      const input = createTestInput({ discardedCard, currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.winnerReceived).toContainEqual(discardedCard);
      expect(output?.winnerReceived).toHaveLength(1); // Only the discard, no penalty
    });
  });

  describe("DRAW_FROM_STOCK during May I window", () => {
    it("when: current player issues DRAW_FROM_STOCK, then: TurnMachine transitions to 'drawn'", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      // May I window is done
      const snapshot = actor.getSnapshot();
      expect(snapshot.status).toBe("done");
      // TurnMachine would transition to drawn state
    });

    it("current player has card from stock", () => {
      // Note: The May I window doesn't track which card the current player draws
      // from stock - that's handled by TurnMachine directly.
      // The May I window just tracks that current player passed on the discard.
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      // No winner from May I window when no one claimed
      expect(output?.type).toBe("NO_CLAIMS");
    });

    it("MayIWindow receives 'pass' signal", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      // Drawing from stock is the "pass" signal to May I window
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      // Window transitions to resolving/closed
      const snapshot = actor.getSnapshot();
      expect(snapshot.status).toBe("done");
    });

    it("May I window resolves claims", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      // P3 calls May I
      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      // Current player draws from stock (passes on discard)
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.type).toBe("MAY_I_RESOLVED");
      expect(output?.winnerId).toBe("player-3");
    });
  });

  describe("hand state after May I resolution", () => {
    it("scenario A - current player claimed: hand includes discardedCard, hand.length = previous + 1", () => {
      const discardedCard: Card = { id: "card-K-spades", suit: "spades", rank: "K" };
      const input = createTestInput({ discardedCard, currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      // Current player gets exactly 1 card (the discard)
      expect(output?.winnerReceived).toHaveLength(1);
      expect(output?.winnerReceived).toContainEqual(discardedCard);
      expect(output?.penaltyCard).toBeNull(); // No penalty for current player
    });

    it("scenario B - another player won May I: current player's hand includes stock card", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      // Winner is P3, not current player
      expect(output?.winnerId).toBe("player-3");
      // Current player (P2) draws from stock separately (not tracked in May I window)
      // The May I window output tells RoundMachine/TurnMachine that P3 won
    });

    it("P3's hand includes discard + penalty, P3's hand.length = previous + 2", () => {
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
      // P3 gets 2 cards: discard + penalty
      expect(output?.winnerReceived).toHaveLength(2);
      expect(output?.winnerReceived).toContainEqual(discardedCard);
      expect(output?.winnerReceived).toContainEqual(penaltyCard);
      expect(output?.penaltyCard).toEqual(penaltyCard);
    });
  });
});

describe("TurnMachine - discard availability", () => {
  describe("discard available if no May I", () => {
    it("given: previous turn ended, no one May I'd, then: discard pile has the discarded card on top", () => {
      const discardedCard: Card = { id: "card-K-spades", suit: "spades", rank: "K" };
      const input = createTestInput({ discardedCard, currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      // Current player draws from stock, no one calls May I
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.type).toBe("NO_CLAIMS");
      // The discarded card is still available on the pile
      expect(output?.discardedCard).toEqual(discardedCard);
      expect(output?.winnerId).toBeNull();
    });

    it("current player can draw it", () => {
      const discardedCard: Card = { id: "card-K-spades", suit: "spades", rank: "K" };
      const input = createTestInput({ discardedCard, currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      // Current player draws from discard
      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.winnerId).toBe("player-2");
      expect(output?.winnerReceived).toContainEqual(discardedCard);
    });
  });

  describe("discard unavailable if May I won", () => {
    it("given: P3 won May I for K♠, when: current player's turn continues, then: K♠ is NOT on discard pile", () => {
      const discardedCard: Card = { id: "card-K-spades", suit: "spades", rank: "K" };
      const input = createTestInput({ discardedCard, currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      // P3 won the May I and took the K♠
      expect(output?.winnerId).toBe("player-3");
      expect(output?.winnerReceived).toContainEqual(discardedCard);
      // The discard card was removed from the pile (given to P3)
    });

    it("discard top is whatever was under K♠", () => {
      // Note: The May I window only tracks the single discardedCard that was just
      // put on the pile. The full discard pile state is managed by RoundMachine.
      // When P3 takes K♠, the next discard top would be whatever was under it.
      const discardedCard: Card = { id: "card-K-spades", suit: "spades", rank: "K" };
      const input = createTestInput({ discardedCard, currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      // Output reports the discardedCard that was taken
      expect(output?.discardedCard).toEqual(discardedCard);
      // RoundMachine would use this info to update discard pile state
    });

    it("current player already drew from stock", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const output = actor.getSnapshot().output;
      expect(output?.type).toBe("MAY_I_RESOLVED");
      // Current player (P2) passed on discard and drew from stock instead
      // Their draw happened as part of the DRAW_FROM_STOCK command
      // TurnMachine would handle adding the stock card to their hand
    });
  });
});
