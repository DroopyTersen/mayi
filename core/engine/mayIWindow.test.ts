/**
 * MayIWindowMachine tests - Phase 6
 *
 * Tests for the May I window state machine
 */

import { describe, it, expect } from "bun:test";
import { createActor } from "xstate";
import { mayIWindowMachine } from "./mayIWindow.machine";
import type { MayIWindowInput } from "./mayIWindow.machine";
import type { Card } from "../card/card.types";

/**
 * Helper to create test input
 */
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

/**
 * Helper to create and start a May I window actor
 */
function createMayIActor(input: MayIWindowInput) {
  const actor = createActor(mayIWindowMachine, { input });
  actor.start();
  return actor;
}

describe("MayIWindowMachine - initialization", () => {
  describe("context from input", () => {
    it("discardedCard: the card just discarded", () => {
      const discardedCard: Card = { id: "card-Q-hearts", suit: "hearts", rank: "Q" };
      const input = createTestInput({ discardedCard });
      const actor = createMayIActor(input);

      expect(actor.getSnapshot().context.discardedCard).toEqual(discardedCard);
    });

    it("discardedByPlayerId: player who discarded", () => {
      const input = createTestInput({ discardedByPlayerId: "player-3" });
      const actor = createMayIActor(input);

      expect(actor.getSnapshot().context.discardedByPlayerId).toBe("player-3");
    });

    it("currentPlayerId: player whose turn is next", () => {
      const input = createTestInput({ currentPlayerId: "player-0" });
      const actor = createMayIActor(input);

      expect(actor.getSnapshot().context.currentPlayerId).toBe("player-0");
    });

    it("currentPlayerIndex: index of player whose turn it is", () => {
      const input = createTestInput({ currentPlayerIndex: 1 });
      const actor = createMayIActor(input);

      expect(actor.getSnapshot().context.currentPlayerIndex).toBe(1);
    });

    it("playerOrder: array of player IDs in turn order", () => {
      const playerOrder = ["p0", "p1", "p2", "p3", "p4"];
      const input = createTestInput({ playerOrder, currentPlayerId: "p2", currentPlayerIndex: 2 });
      const actor = createMayIActor(input);

      expect(actor.getSnapshot().context.playerOrder).toEqual(playerOrder);
    });

    it("claimants: [] (empty initially)", () => {
      const input = createTestInput();
      const actor = createMayIActor(input);

      expect(actor.getSnapshot().context.claimants).toEqual([]);
    });

    it("currentPlayerClaimed: false", () => {
      const input = createTestInput();
      const actor = createMayIActor(input);

      expect(actor.getSnapshot().context.currentPlayerClaimed).toBe(false);
    });

    it("currentPlayerPassed: false", () => {
      const input = createTestInput();
      const actor = createMayIActor(input);

      expect(actor.getSnapshot().context.currentPlayerPassed).toBe(false);
    });

    it("winnerId: null", () => {
      const input = createTestInput();
      const actor = createMayIActor(input);

      expect(actor.getSnapshot().context.winnerId).toBeNull();
    });

    it("stock: current stock pile (for penalty card)", () => {
      const stock: Card[] = [
        { id: "card-A-hearts", suit: "hearts", rank: "A" },
        { id: "card-2-clubs", suit: "clubs", rank: "2" },
      ];
      const input = createTestInput({ stock });
      const actor = createMayIActor(input);

      expect(actor.getSnapshot().context.stock).toEqual(stock);
    });
  });

  describe("initial state", () => {
    it("starts in 'open' state", () => {
      const input = createTestInput();
      const actor = createMayIActor(input);

      expect(actor.getSnapshot().value).toBe("open");
    });

    it("discard is available for claiming", () => {
      const input = createTestInput();
      const actor = createMayIActor(input);

      expect(actor.getSnapshot().context.discardedCard).toBeDefined();
      expect(actor.getSnapshot().value).toBe("open");
    });

    it("current player hasn't decided yet", () => {
      const input = createTestInput();
      const actor = createMayIActor(input);

      expect(actor.getSnapshot().context.currentPlayerClaimed).toBe(false);
      expect(actor.getSnapshot().context.currentPlayerPassed).toBe(false);
    });

    it("no claimants yet", () => {
      const input = createTestInput();
      const actor = createMayIActor(input);

      expect(actor.getSnapshot().context.claimants).toHaveLength(0);
    });
  });
});

describe("MayIWindowMachine - open state", () => {
  describe("current player takes discard (immediate claim)", () => {
    it("given: window is open, when: current player issues DRAW_FROM_DISCARD, then: currentPlayerClaimed = true", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-2" });

      expect(actor.getSnapshot().context.currentPlayerClaimed).toBe(true);
    });

    it("transitions to 'closedByCurrentPlayer'", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-2" });

      expect(actor.getSnapshot().value).toBe("closedByCurrentPlayer");
    });

    it("current player receives discard (NO penalty)", () => {
      const discardedCard: Card = { id: "card-Q-hearts", suit: "hearts", rank: "Q" };
      const input = createTestInput({ discardedCard, currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-2" });

      const snapshot = actor.getSnapshot();
      expect(snapshot.status).toBe("done");
      expect(snapshot.output?.type).toBe("CURRENT_PLAYER_CLAIMED");
      expect(snapshot.output?.winnerReceived).toEqual([discardedCard]);
      expect(snapshot.output?.penaltyCard).toBeNull();
    });

    it("this counts as their draw", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-2" });

      const snapshot = actor.getSnapshot();
      expect(snapshot.output?.winnerId).toBe("player-2");
      expect(snapshot.output?.winnerReceived).toHaveLength(1);
    });

    it("all May I claims voided", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      // Player-3 calls May I first
      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      expect(actor.getSnapshot().context.claimants).toContain("player-3");

      // Current player takes the discard anyway (veto)
      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-2" });

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("closedByCurrentPlayer");
      expect(snapshot.output?.type).toBe("CURRENT_PLAYER_CLAIMED");
      expect(snapshot.output?.winnerId).toBe("player-2");
    });
  });

  describe("current player draws from stock (passes)", () => {
    it("given: window is open, when: current player issues DRAW_FROM_STOCK, then: currentPlayerPassed = true", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      expect(actor.getSnapshot().context.currentPlayerPassed).toBe(true);
    });

    it("current player loses veto rights", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      // Pass on the discard
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      // Machine transitions immediately to final state (no claimants)
      // Current player can no longer claim the discard
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.currentPlayerPassed).toBe(true);
      expect(snapshot.context.currentPlayerClaimed).toBe(false);
    });

    it("transitions to 'resolvingClaims'", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      // Add a claimant first so we stay in resolvingClaims longer to see the transition
      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      // resolvingClaims has "always" transitions, so it immediately resolves
      // We verify the result indicates claims were resolved
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("resolved");
    });

    it("May I claims will be resolved", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      // With no claimants, it goes to closedNoClaim
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("closedNoClaim");
      expect(snapshot.output?.type).toBe("NO_CLAIMS");
    });
  });

  describe("other player calls May I (before current player decides)", () => {
    it("given: window is open, when: player-3 calls May I, then: player-3 added to claimants array", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });

      expect(actor.getSnapshot().context.claimants).toContain("player-3");
    });

    it("remains in 'open' state", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });

      expect(actor.getSnapshot().value).toBe("open");
    });

    it("waiting for current player to decide", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("open");
      expect(snapshot.context.currentPlayerPassed).toBe(false);
      expect(snapshot.context.currentPlayerClaimed).toBe(false);
    });
  });

  describe("multiple players call May I before current player decides", () => {
    it("given: window is open, when: player-3 and player-0 call May I, then: claimants = [player-3, player-0]", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "CALL_MAY_I", playerId: "player-0" });

      expect(actor.getSnapshot().context.claimants).toEqual(["player-3", "player-0"]);
    });

    it("still waiting for current player", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "CALL_MAY_I", playerId: "player-0" });

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("open");
      expect(snapshot.context.currentPlayerPassed).toBe(false);
      expect(snapshot.context.currentPlayerClaimed).toBe(false);
    });
  });

  describe("current player vetoes (claims after others called)", () => {
    it("given: player-3 has called May I, when: current player issues DRAW_FROM_DISCARD, then: current player takes discard", () => {
      const discardedCard: Card = { id: "card-K-spades", suit: "spades", rank: "K" };
      const input = createTestInput({ discardedCard, currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-2" });

      const snapshot = actor.getSnapshot();
      expect(snapshot.output?.winnerId).toBe("player-2");
      expect(snapshot.output?.winnerReceived).toEqual([discardedCard]);
    });

    it("transitions to 'closedByCurrentPlayer'", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-2" });

      expect(actor.getSnapshot().value).toBe("closedByCurrentPlayer");
    });

    it("player-3's May I claim is denied", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-2" });

      const snapshot = actor.getSnapshot();
      // player-3 was in claimants but did not win
      expect(snapshot.output?.type).toBe("CURRENT_PLAYER_CLAIMED");
      expect(snapshot.output?.winnerId).toBe("player-2");
    });

    it("current player takes discard with NO penalty (veto)", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-2" });

      const snapshot = actor.getSnapshot();
      expect(snapshot.output?.penaltyCard).toBeNull();
      expect(snapshot.output?.winnerReceived).toHaveLength(1);
    });
  });

  describe("guards - canCallMayI", () => {
    it("returns false if caller is the one who discarded", () => {
      const input = createTestInput({ discardedByPlayerId: "player-1", currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      // Player-1 discarded, they cannot call May I on their own discard
      actor.send({ type: "CALL_MAY_I", playerId: "player-1" });

      // Claimants should remain empty - the event was rejected
      expect(actor.getSnapshot().context.claimants).toEqual([]);
    });

    it("returns true for current player (they can claim as their draw)", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      // Current player can call May I (though they'd typically use DRAW_FROM_DISCARD)
      actor.send({ type: "CALL_MAY_I", playerId: "player-2" });

      expect(actor.getSnapshot().context.claimants).toContain("player-2");
    });

    it("returns true for any other player", () => {
      const input = createTestInput({
        discardedByPlayerId: "player-1",
        currentPlayerId: "player-2",
      });
      const actor = createMayIActor(input);

      // player-3 and player-0 are neither discarder nor current player
      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "CALL_MAY_I", playerId: "player-0" });

      expect(actor.getSnapshot().context.claimants).toEqual(["player-3", "player-0"]);
    });
  });

  describe("guards - isCurrentPlayer", () => {
    it("returns true if event.playerId === currentPlayerId", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      // Only current player can draw from discard
      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-2" });

      expect(actor.getSnapshot().value).toBe("closedByCurrentPlayer");
    });

    it("used to handle current player's draw actions", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      // Non-current player cannot draw from discard
      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-3" });

      // Should still be in open state - event was rejected
      expect(actor.getSnapshot().value).toBe("open");
    });
  });
});

describe("MayIWindowMachine - resolvingClaims state", () => {
  describe("entering state", () => {
    it("given: current player drew from stock (passed), then: window transitions to 'resolvingClaims'", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      // Add a claimant to verify we go through resolvingClaims
      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      // resolvingClaims has always transitions, so we end up in resolved
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("resolved");
      expect(snapshot.context.currentPlayerPassed).toBe(true);
    });

    it("resolve claims by priority", () => {
      // Setup: player-1 discarded, player-2 is current
      // playerOrder: [player-0, player-1, player-2, player-3]
      // Priority order after player-2: player-3, player-0 (player-1 excluded as discarder)
      const input = createTestInput({
        discardedByPlayerId: "player-1",
        currentPlayerId: "player-2",
        currentPlayerIndex: 2,
        playerOrder: ["player-0", "player-1", "player-2", "player-3"],
      });
      const actor = createMayIActor(input);

      // player-0 calls first, then player-3
      actor.send({ type: "CALL_MAY_I", playerId: "player-0" });
      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      // player-3 should win (closer in turn order after player-2)
      const snapshot = actor.getSnapshot();
      expect(snapshot.output?.winnerId).toBe("player-3");
    });
  });

  describe("no claimants", () => {
    it("given: in resolvingClaims, claimants = [], then: transitions to 'closedNoClaim'", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      expect(actor.getSnapshot().value).toBe("closedNoClaim");
    });

    it("discard remains on pile", () => {
      const discardedCard: Card = { id: "card-K-spades", suit: "spades", rank: "K" };
      const input = createTestInput({ discardedCard, currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const snapshot = actor.getSnapshot();
      expect(snapshot.output?.type).toBe("NO_CLAIMS");
      expect(snapshot.output?.discardedCard).toEqual(discardedCard);
      expect(snapshot.output?.winnerId).toBeNull();
    });

    it("no one gets penalty card", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const snapshot = actor.getSnapshot();
      expect(snapshot.output?.penaltyCard).toBeNull();
      expect(snapshot.output?.winnerReceived).toEqual([]);
    });
  });

  describe("single claimant", () => {
    it("given: in resolvingClaims, claimants = [player-3], then: player-3 wins", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      expect(actor.getSnapshot().output?.winnerId).toBe("player-3");
    });

    it("player-3 receives discard + penalty card", () => {
      const discardedCard: Card = { id: "card-K-spades", suit: "spades", rank: "K" };
      const stock: Card[] = [
        { id: "card-7-diamonds", suit: "diamonds", rank: "7" },
        { id: "card-3-clubs", suit: "clubs", rank: "3" },
      ];
      const input = createTestInput({ discardedCard, stock, currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const snapshot = actor.getSnapshot();
      expect(snapshot.output?.winnerReceived).toHaveLength(2);
      expect(snapshot.output?.winnerReceived[0]).toEqual(discardedCard);
      expect(snapshot.output?.winnerReceived[1]).toEqual(stock[0]);
    });

    it("transitions to 'resolved'", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      expect(actor.getSnapshot().value).toBe("resolved");
    });
  });

  describe("multiple claimants - priority resolution", () => {
    it("given: claimants = [player-3, player-0], currentPlayerIndex = 2, then: player-3 wins (closer in priority)", () => {
      // playerOrder: [player-0, player-1, player-2, player-3]
      // currentPlayerIndex = 2 (player-2)
      // Priority after player-2: player-3 (index 3), then wraps to player-0 (index 0)
      const input = createTestInput({
        discardedByPlayerId: "player-1",
        currentPlayerId: "player-2",
        currentPlayerIndex: 2,
        playerOrder: ["player-0", "player-1", "player-2", "player-3"],
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "CALL_MAY_I", playerId: "player-0" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      expect(actor.getSnapshot().output?.winnerId).toBe("player-3");
    });

    it("player-3 receives discard + penalty card", () => {
      const discardedCard: Card = { id: "card-K-spades", suit: "spades", rank: "K" };
      const stock: Card[] = [
        { id: "card-7-diamonds", suit: "diamonds", rank: "7" },
      ];
      const input = createTestInput({
        discardedCard,
        stock,
        discardedByPlayerId: "player-1",
        currentPlayerId: "player-2",
        currentPlayerIndex: 2,
        playerOrder: ["player-0", "player-1", "player-2", "player-3"],
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "CALL_MAY_I", playerId: "player-0" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const snapshot = actor.getSnapshot();
      expect(snapshot.output?.winnerReceived).toHaveLength(2);
      expect(snapshot.output?.winnerReceived).toContainEqual(discardedCard);
      expect(snapshot.output?.winnerReceived).toContainEqual(stock[0]);
    });

    it("player-0 receives nothing", () => {
      const input = createTestInput({
        discardedByPlayerId: "player-1",
        currentPlayerId: "player-2",
        currentPlayerIndex: 2,
        playerOrder: ["player-0", "player-1", "player-2", "player-3"],
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "CALL_MAY_I", playerId: "player-0" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      // player-0 lost the priority contest
      const snapshot = actor.getSnapshot();
      expect(snapshot.output?.winnerId).toBe("player-3");
      expect(snapshot.output?.winnerId).not.toBe("player-0");
    });
  });

  describe("veto between non-current players", () => {
    it("given: player-0 calls May I (3 turns away), player-3 calls May I (1 turn away), then: player-3 wins", () => {
      // playerOrder: [player-0, player-1, player-2, player-3]
      // currentPlayerIndex = 2 (player-2)
      // Priority: player-3 (1 away), player-0 (2 away after wrapping)
      const input = createTestInput({
        discardedByPlayerId: "player-1",
        currentPlayerId: "player-2",
        currentPlayerIndex: 2,
        playerOrder: ["player-0", "player-1", "player-2", "player-3"],
      });
      const actor = createMayIActor(input);

      // player-0 calls first but is farther in turn order
      actor.send({ type: "CALL_MAY_I", playerId: "player-0" });
      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      expect(actor.getSnapshot().output?.winnerId).toBe("player-3");
    });

    it("player-3 receives discard + penalty card", () => {
      const discardedCard: Card = { id: "card-K-spades", suit: "spades", rank: "K" };
      const penaltyCard: Card = { id: "card-7-diamonds", suit: "diamonds", rank: "7" };
      const input = createTestInput({
        discardedCard,
        stock: [penaltyCard],
        discardedByPlayerId: "player-1",
        currentPlayerId: "player-2",
        currentPlayerIndex: 2,
        playerOrder: ["player-0", "player-1", "player-2", "player-3"],
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-0" });
      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const snapshot = actor.getSnapshot();
      expect(snapshot.output?.winnerId).toBe("player-3");
      expect(snapshot.output?.winnerReceived).toEqual([discardedCard, penaltyCard]);
    });

    it("player-0 receives nothing", () => {
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

      // Only player-3 wins, player-0 gets nothing
      const snapshot = actor.getSnapshot();
      expect(snapshot.output?.winnerId).toBe("player-3");
    });
  });
});

describe("MayIWindowMachine - priority calculation", () => {
  describe("basic priority", () => {
    it("given: 4 players, P1 discarded, P2 is current (passed), then: priority order: P3 → P0", () => {
      // playerOrder: [P0, P1, P2, P3], currentPlayerIndex = 2
      // After P2: P3 (index 3), P0 (index 0), skip P1 (discarder)
      const input = createTestInput({
        discardedByPlayerId: "player-1",
        currentPlayerId: "player-2",
        currentPlayerIndex: 2,
        playerOrder: ["player-0", "player-1", "player-2", "player-3"],
      });
      const actor = createMayIActor(input);

      // Test by having both claim - player-3 should win due to priority
      actor.send({ type: "CALL_MAY_I", playerId: "player-0" });
      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      expect(actor.getSnapshot().output?.winnerId).toBe("player-3");
    });

    it("P1 cannot claim (discarded the card)", () => {
      const input = createTestInput({
        discardedByPlayerId: "player-1",
        currentPlayerId: "player-2",
        currentPlayerIndex: 2,
        playerOrder: ["player-0", "player-1", "player-2", "player-3"],
      });
      const actor = createMayIActor(input);

      // P1 tries to call May I on their own discard - should be rejected
      actor.send({ type: "CALL_MAY_I", playerId: "player-1" });

      expect(actor.getSnapshot().context.claimants).not.toContain("player-1");
    });

    it("claimants = [P0, P3], then: winner = P3 (P3 comes before P0)", () => {
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

      expect(actor.getSnapshot().output?.winnerId).toBe("player-3");
    });
  });

  describe("wrap-around priority", () => {
    it("given: 4 players, P3 discarded, P0 is current (passed), then: priority order: P1 → P2", () => {
      // playerOrder: [P0, P1, P2, P3], currentPlayerIndex = 0
      // After P0: P1 (index 1), P2 (index 2), skip P3 (discarder)
      const input = createTestInput({
        discardedByPlayerId: "player-3",
        currentPlayerId: "player-0",
        currentPlayerIndex: 0,
        playerOrder: ["player-0", "player-1", "player-2", "player-3"],
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-2" });
      actor.send({ type: "CALL_MAY_I", playerId: "player-1" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-0" });

      expect(actor.getSnapshot().output?.winnerId).toBe("player-1");
    });

    it("claimants = [P1, P2], then: winner = P1 (closest to P0)", () => {
      const input = createTestInput({
        discardedByPlayerId: "player-3",
        currentPlayerId: "player-0",
        currentPlayerIndex: 0,
        playerOrder: ["player-0", "player-1", "player-2", "player-3"],
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-1" });
      actor.send({ type: "CALL_MAY_I", playerId: "player-2" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-0" });

      expect(actor.getSnapshot().output?.winnerId).toBe("player-1");
    });
  });

  describe("current player in priority (but already passed)", () => {
    it("given: P2 is current, already drew from stock (passed), then: P2 cannot win", () => {
      const input = createTestInput({
        discardedByPlayerId: "player-1",
        currentPlayerId: "player-2",
        currentPlayerIndex: 2,
        playerOrder: ["player-0", "player-1", "player-2", "player-3"],
      });
      const actor = createMayIActor(input);

      // P2 passes by drawing from stock
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      // P2 cannot win since they passed - window is already resolved
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.currentPlayerPassed).toBe(true);
      expect(snapshot.output?.winnerId).not.toBe("player-2");
    });

    it("claimants = [P3, P0], then: winner = P3 (priority among remaining)", () => {
      const input = createTestInput({
        discardedByPlayerId: "player-1",
        currentPlayerId: "player-2",
        currentPlayerIndex: 2,
        playerOrder: ["player-0", "player-1", "player-2", "player-3"],
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "CALL_MAY_I", playerId: "player-0" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      expect(actor.getSnapshot().output?.winnerId).toBe("player-3");
    });
  });

  describe("5 player scenario", () => {
    it("given: 5 players, P2 discarded, P3 is current (passed), then: priority: P4 → P0 → P1", () => {
      // playerOrder: [P0, P1, P2, P3, P4], currentPlayerIndex = 3
      // After P3: P4 (index 4), P0 (index 0), P1 (index 1), skip P2 (discarder)
      const input = createTestInput({
        discardedByPlayerId: "player-2",
        currentPlayerId: "player-3",
        currentPlayerIndex: 3,
        playerOrder: ["player-0", "player-1", "player-2", "player-3", "player-4"],
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-0" });
      actor.send({ type: "CALL_MAY_I", playerId: "player-4" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-3" });

      // P4 is first in priority order
      expect(actor.getSnapshot().output?.winnerId).toBe("player-4");
    });

    it("claimants = [P0, P1], then: winner = P0", () => {
      const input = createTestInput({
        discardedByPlayerId: "player-2",
        currentPlayerId: "player-3",
        currentPlayerIndex: 3,
        playerOrder: ["player-0", "player-1", "player-2", "player-3", "player-4"],
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-0" });
      actor.send({ type: "CALL_MAY_I", playerId: "player-1" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-3" });

      // Priority: P4, P0, P1 - so P0 wins over P1
      expect(actor.getSnapshot().output?.winnerId).toBe("player-0");
    });

    it("claimants = [P4, P0], then: winner = P4", () => {
      const input = createTestInput({
        discardedByPlayerId: "player-2",
        currentPlayerId: "player-3",
        currentPlayerIndex: 3,
        playerOrder: ["player-0", "player-1", "player-2", "player-3", "player-4"],
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-4" });
      actor.send({ type: "CALL_MAY_I", playerId: "player-0" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-3" });

      expect(actor.getSnapshot().output?.winnerId).toBe("player-4");
    });
  });
});

describe("MayIWindowMachine - final states", () => {
  describe("closedByCurrentPlayer", () => {
    it("is final state", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-2" });

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("closedByCurrentPlayer");
      expect(snapshot.status).toBe("done");
    });

    it("output type: 'CURRENT_PLAYER_CLAIMED'", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-2" });

      expect(actor.getSnapshot().output?.type).toBe("CURRENT_PLAYER_CLAIMED");
    });

    it("current player received discard (no penalty)", () => {
      const discardedCard: Card = { id: "card-K-spades", suit: "spades", rank: "K" };
      const input = createTestInput({ discardedCard, currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-2" });

      const snapshot = actor.getSnapshot();
      expect(snapshot.output?.winnerId).toBe("player-2");
      expect(snapshot.output?.winnerReceived).toEqual([discardedCard]);
      expect(snapshot.output?.penaltyCard).toBeNull();
    });

    it("all May I claims voided", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      // Someone calls May I
      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      // Current player takes it anyway
      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-2" });

      const snapshot = actor.getSnapshot();
      expect(snapshot.output?.type).toBe("CURRENT_PLAYER_CLAIMED");
      expect(snapshot.output?.winnerId).toBe("player-2");
    });

    it("current player's turn continues (they've drawn)", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "DRAW_FROM_DISCARD", playerId: "player-2" });

      // Output indicates current player claimed, their turn continues with a meld/discard
      const snapshot = actor.getSnapshot();
      expect(snapshot.output?.type).toBe("CURRENT_PLAYER_CLAIMED");
      expect(snapshot.output?.winnerId).toBe("player-2");
    });
  });

  describe("resolved", () => {
    it("is final state", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("resolved");
      expect(snapshot.status).toBe("done");
    });

    it("output type: 'MAY_I_RESOLVED'", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      expect(actor.getSnapshot().output?.type).toBe("MAY_I_RESOLVED");
    });

    it("winnerId: player who won", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      expect(actor.getSnapshot().output?.winnerId).toBe("player-3");
    });

    it("winnerReceived: [discardedCard, penaltyCard]", () => {
      const discardedCard: Card = { id: "card-K-spades", suit: "spades", rank: "K" };
      const penaltyCard: Card = { id: "card-7-diamonds", suit: "diamonds", rank: "7" };
      const input = createTestInput({
        discardedCard,
        stock: [penaltyCard],
        currentPlayerId: "player-2",
      });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const snapshot = actor.getSnapshot();
      expect(snapshot.output?.winnerReceived).toEqual([discardedCard, penaltyCard]);
      expect(snapshot.output?.penaltyCard).toEqual(penaltyCard);
    });

    it("current player's turn continues (they drew from stock)", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "CALL_MAY_I", playerId: "player-3" });
      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      // Current player passed - their turn continues with meld/discard
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.currentPlayerPassed).toBe(true);
      expect(snapshot.output?.type).toBe("MAY_I_RESOLVED");
    });
  });

  describe("closedNoClaim", () => {
    it("is final state", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe("closedNoClaim");
      expect(snapshot.status).toBe("done");
    });

    it("output type: 'NO_CLAIMS'", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      expect(actor.getSnapshot().output?.type).toBe("NO_CLAIMS");
    });

    it("discard remains on pile", () => {
      const discardedCard: Card = { id: "card-K-spades", suit: "spades", rank: "K" };
      const input = createTestInput({ discardedCard, currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const snapshot = actor.getSnapshot();
      expect(snapshot.output?.discardedCard).toEqual(discardedCard);
      expect(snapshot.output?.winnerId).toBeNull();
      expect(snapshot.output?.winnerReceived).toEqual([]);
    });

    it("current player's turn continues (they drew from stock)", () => {
      const input = createTestInput({ currentPlayerId: "player-2" });
      const actor = createMayIActor(input);

      actor.send({ type: "DRAW_FROM_STOCK", playerId: "player-2" });

      const snapshot = actor.getSnapshot();
      expect(snapshot.context.currentPlayerPassed).toBe(true);
      expect(snapshot.output?.type).toBe("NO_CLAIMS");
    });
  });
});
