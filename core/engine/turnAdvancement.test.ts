/**
 * Turn Advancement tests - Phase 5
 *
 * Tests for turn rotation, first player calculation, and dealer rotation
 */

import { describe, it, expect } from "bun:test";
import { createActor } from "xstate";
import { roundMachine } from "./round.machine";
import { gameMachine } from "./game.machine";
import type { RoundInput } from "./round.machine";
import type { Player, RoundNumber } from "./engine.types";

/**
 * Helper to create test players
 */
function createTestPlayers(count: number): Player[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `player-${i}`,
    name: `Player ${i + 1}`,
    hand: [],
    isDown: false,
    totalScore: 0,
  }));
}

/**
 * Helper to create a round actor
 */
function createRoundActor(input: RoundInput) {
  const actor = createActor(roundMachine, { input });
  actor.start();
  return actor;
}

/**
 * Helper function to advance turn using proper event flow
 * This completes a turn by: DRAW_FROM_DISCARD → SKIP_LAY_DOWN → DISCARD
 */
function advanceTurn(actor: ReturnType<typeof createRoundActor>) {
  // Draw from discard (simpler - no May I window)
  actor.send({ type: "DRAW_FROM_DISCARD" });

  // Skip lay down
  actor.send({ type: "SKIP_LAY_DOWN" });

  // Get the turn context to find a card to discard
  const persisted = actor.getPersistedSnapshot() as any;
  const turnSnapshot = persisted.children?.turn?.snapshot;
  const cardToDiscard = turnSnapshot?.context?.hand?.[0];

  if (cardToDiscard) {
    actor.send({ type: "DISCARD", cardId: cardToDiscard.id });
  }
}

describe("turn advancement", () => {
  describe("clockwise rotation", () => {
    it("given: 4 players, currentPlayerIndex = 0, then: next is 1", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 3, // So first player is 0
      };
      const actor = createRoundActor(input);

      expect(actor.getSnapshot().context.currentPlayerIndex).toBe(0);

      advanceTurn(actor);

      expect(actor.getSnapshot().context.currentPlayerIndex).toBe(1);
    });

    it("given: 4 players, currentPlayerIndex = 1, then: next is 2", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 0, // So first player is 1
      };
      const actor = createRoundActor(input);

      expect(actor.getSnapshot().context.currentPlayerIndex).toBe(1);

      advanceTurn(actor);

      expect(actor.getSnapshot().context.currentPlayerIndex).toBe(2);
    });

    it("given: 4 players, currentPlayerIndex = 2, then: next is 3", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 1, // So first player is 2
      };
      const actor = createRoundActor(input);

      expect(actor.getSnapshot().context.currentPlayerIndex).toBe(2);

      advanceTurn(actor);

      expect(actor.getSnapshot().context.currentPlayerIndex).toBe(3);
    });

    it("given: 4 players, currentPlayerIndex = 3, then: next is 0 (wrapped)", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 2, // So first player is 3
      };
      const actor = createRoundActor(input);

      expect(actor.getSnapshot().context.currentPlayerIndex).toBe(3);

      advanceTurn(actor);

      expect(actor.getSnapshot().context.currentPlayerIndex).toBe(0);
    });
  });

  describe("wrap-around", () => {
    it("given: 4 players, currentPlayerIndex = 3, when: turn completes, then: currentPlayerIndex = 0", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 2, // So first player is 3
      };
      const actor = createRoundActor(input);

      expect(actor.getSnapshot().context.currentPlayerIndex).toBe(3);

      advanceTurn(actor);

      expect(actor.getSnapshot().context.currentPlayerIndex).toBe(0);
    });

    it("given: 5 players, currentPlayerIndex = 4, when: turn completes, then: currentPlayerIndex = 0", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(5),
        dealerIndex: 3, // So first player is 4
      };
      const actor = createRoundActor(input);

      expect(actor.getSnapshot().context.currentPlayerIndex).toBe(4);

      advanceTurn(actor);

      expect(actor.getSnapshot().context.currentPlayerIndex).toBe(0);
    });
  });

  describe("formula", () => {
    it("nextPlayer = (currentPlayerIndex + 1) % playerCount", () => {
      // Test the formula directly
      const playerCount = 4;
      expect((0 + 1) % playerCount).toBe(1);
      expect((1 + 1) % playerCount).toBe(2);
      expect((2 + 1) % playerCount).toBe(3);
      expect((3 + 1) % playerCount).toBe(0);
    });

    it("always produces valid index", () => {
      const playerCounts = [3, 4, 5, 6, 7, 8];

      for (const count of playerCounts) {
        for (let currentIndex = 0; currentIndex < count; currentIndex++) {
          const nextIndex = (currentIndex + 1) % count;
          expect(nextIndex).toBeGreaterThanOrEqual(0);
          expect(nextIndex).toBeLessThan(count);
        }
      }
    });
  });

  describe("full rotation", () => {
    it("given: 4 players, one full rotation = 4 turns", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 3, // So first player is 0
      };
      const actor = createRoundActor(input);

      // Track which player indices we see
      const indices: number[] = [];
      indices.push(actor.getSnapshot().context.currentPlayerIndex);

      for (let i = 0; i < 4; i++) {
        advanceTurn(actor);
        indices.push(actor.getSnapshot().context.currentPlayerIndex);
      }

      // After 4 turns, we should be back to player 0
      expect(indices).toEqual([0, 1, 2, 3, 0]);
    });

    it("each player gets exactly one turn per rotation", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 3, // So first player is 0
      };
      const actor = createRoundActor(input);

      const turnsTaken: number[] = [];

      // Complete one full rotation
      for (let i = 0; i < 4; i++) {
        turnsTaken.push(actor.getSnapshot().context.currentPlayerIndex);
        advanceTurn(actor);
      }

      // Each player (0, 1, 2, 3) should appear exactly once
      expect(turnsTaken.sort()).toEqual([0, 1, 2, 3]);
    });
  });
});

describe("first player each round", () => {
  describe("left of dealer", () => {
    it("given: dealerIndex = 0, 4 players, then: first player = 1", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 0,
      };
      const actor = createRoundActor(input);

      expect(actor.getSnapshot().context.currentPlayerIndex).toBe(1);
    });

    it("given: dealerIndex = 3, 4 players, then: first player = 0 (wraps)", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 3,
      };
      const actor = createRoundActor(input);

      expect(actor.getSnapshot().context.currentPlayerIndex).toBe(0);
    });

    it("given: dealerIndex = 2, 5 players, then: first player = 3", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(5),
        dealerIndex: 2,
      };
      const actor = createRoundActor(input);

      expect(actor.getSnapshot().context.currentPlayerIndex).toBe(3);
    });
  });

  describe("formula", () => {
    it("firstPlayer = (dealerIndex + 1) % playerCount", () => {
      const playerCount = 5;
      expect((0 + 1) % playerCount).toBe(1);
      expect((1 + 1) % playerCount).toBe(2);
      expect((2 + 1) % playerCount).toBe(3);
      expect((3 + 1) % playerCount).toBe(4);
      expect((4 + 1) % playerCount).toBe(0);
    });

    it("same formula as turn advancement", () => {
      // Both use (index + 1) % count
      const turnAdvanceFormula = (current: number, count: number) => (current + 1) % count;
      const firstPlayerFormula = (dealer: number, count: number) => (dealer + 1) % count;

      // They produce the same results
      expect(turnAdvanceFormula(0, 4)).toBe(firstPlayerFormula(0, 4));
      expect(turnAdvanceFormula(3, 4)).toBe(firstPlayerFormula(3, 4));
    });
  });
});

describe("dealer rotation between rounds", () => {
  describe("advancement", () => {
    it("given: 4 players, dealer = 0 in round 1, when: round 1 ends, then: dealer = 1 for round 2", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } });
      actor.start();

      // Add 4 players
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "ADD_PLAYER", name: "Bob" });
      actor.send({ type: "ADD_PLAYER", name: "Charlie" });
      actor.send({ type: "ADD_PLAYER", name: "Diana" });

      expect(actor.getSnapshot().context.dealerIndex).toBe(0);

      actor.send({ type: "START_GAME" });

      // Complete round 1
      actor.send({
        type: "ROUND_COMPLETE",
        roundRecord: {
          roundNumber: 1,
          winnerId: "player-0",
          scores: { "player-0": 0, "player-1": 50, "player-2": 30, "player-3": 20 },
        },
      });

      // After round 1 ends and round 2 begins
      expect(actor.getSnapshot().context.dealerIndex).toBe(1);
    });

    it("given: 4 players, dealer = 1 in round 2, when: round 2 ends, then: dealer = 2 for round 3", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } });
      actor.start();

      // Add 4 players
      for (let i = 0; i < 4; i++) {
        actor.send({ type: "ADD_PLAYER", name: `Player ${i}` });
      }

      actor.send({ type: "START_GAME" });

      // Complete rounds 1 and 2
      actor.send({
        type: "ROUND_COMPLETE",
        roundRecord: { roundNumber: 1, winnerId: "player-0", scores: {} },
      });
      actor.send({
        type: "ROUND_COMPLETE",
        roundRecord: { roundNumber: 2, winnerId: "player-0", scores: {} },
      });

      expect(actor.getSnapshot().context.dealerIndex).toBe(2);
    });

    it("continues through round 6", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } });
      actor.start();

      // Add 4 players
      for (let i = 0; i < 4; i++) {
        actor.send({ type: "ADD_PLAYER", name: `Player ${i}` });
      }

      actor.send({ type: "START_GAME" });

      // Track dealer through all rounds
      const dealerProgression: number[] = [actor.getSnapshot().context.dealerIndex];

      for (let round = 1; round <= 5; round++) {
        actor.send({
          type: "ROUND_COMPLETE",
          roundRecord: {
            roundNumber: round as RoundNumber,
            winnerId: "player-0",
            scores: {},
          },
        });
        dealerProgression.push(actor.getSnapshot().context.dealerIndex);
      }

      // Dealer advances each round: 0 -> 1 -> 2 -> 3 -> 0 -> 1
      expect(dealerProgression).toEqual([0, 1, 2, 3, 0, 1]);
    });
  });

  describe("wrap-around", () => {
    it("given: 4 players, dealer = 3 in round 4, when: round 4 ends, then: dealer = 0 for round 5", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } });
      actor.start();

      // Add 4 players
      for (let i = 0; i < 4; i++) {
        actor.send({ type: "ADD_PLAYER", name: `Player ${i}` });
      }

      actor.send({ type: "START_GAME" });

      // Complete rounds 1-4
      for (let round = 1; round <= 4; round++) {
        actor.send({
          type: "ROUND_COMPLETE",
          roundRecord: {
            roundNumber: round as RoundNumber,
            winnerId: "player-0",
            scores: {},
          },
        });
      }

      // After round 4 (dealer was 3), dealer wraps to 0
      expect(actor.getSnapshot().context.dealerIndex).toBe(0);
    });
  });

  describe("full game dealer rotation", () => {
    it("round 1: dealer = 0, round 2: dealer = 1, ... through round 6", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } });
      actor.start();

      // Add 4 players
      for (let i = 0; i < 4; i++) {
        actor.send({ type: "ADD_PLAYER", name: `Player ${i}` });
      }

      actor.send({ type: "START_GAME" });

      // Initial dealer is 0
      expect(actor.getSnapshot().context.dealerIndex).toBe(0);
      expect(actor.getSnapshot().context.currentRound).toBe(1);

      // Complete all 6 rounds and track dealer
      const dealerByRound: Record<number, number> = {
        1: actor.getSnapshot().context.dealerIndex,
      };

      for (let round = 1; round < 6; round++) {
        actor.send({
          type: "ROUND_COMPLETE",
          roundRecord: {
            roundNumber: round as RoundNumber,
            winnerId: "player-0",
            scores: {},
          },
        });
        dealerByRound[round + 1] = actor.getSnapshot().context.dealerIndex;
      }

      // Verify dealer progression (with 4 players, wraps at round 5)
      expect(dealerByRound[1]).toBe(0);
      expect(dealerByRound[2]).toBe(1);
      expect(dealerByRound[3]).toBe(2);
      expect(dealerByRound[4]).toBe(3);
      expect(dealerByRound[5]).toBe(0);
      expect(dealerByRound[6]).toBe(1);
    });
  });
});
