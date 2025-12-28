/**
 * Round Transition tests - Phase 5
 *
 * Tests for state reset between rounds, preserved state, and contract progression
 */

import { describe, it, expect } from "bun:test";
import { createActor } from "xstate";
import { gameMachine } from "./game.machine";
import { roundMachine } from "./round.machine";
import { CONTRACTS } from "./contracts";
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
 * Helper to create and start a game with players
 */
function createGameWithPlayers(playerCount: number) {
  const actor = createActor(gameMachine);
  actor.start();

  for (let i = 0; i < playerCount; i++) {
    actor.send({ type: "ADD_PLAYER", name: `Player ${i}` });
  }

  actor.send({ type: "START_GAME" });
  return actor;
}

describe("round transition", () => {
  describe("state reset for new round", () => {
    it("all players' isDown reset to false", () => {
      const input: RoundInput = {
        roundNumber: 2, // New round
        players: createTestPlayers(4).map((p) => ({ ...p, isDown: true })), // Pre-set to true
        dealerIndex: 1,
      };
      const actor = createActor(roundMachine, { input });
      actor.start();

      // All players should have isDown = false for new round
      actor.getSnapshot().context.players.forEach((player) => {
        expect(player.isDown).toBe(false);
      });
    });

    it("all players' hands dealt fresh (11 cards each)", () => {
      const input: RoundInput = {
        roundNumber: 2,
        players: createTestPlayers(4),
        dealerIndex: 1,
      };
      const actor = createActor(roundMachine, { input });
      actor.start();

      // Each player should have 11 new cards
      actor.getSnapshot().context.players.forEach((player) => {
        expect(player.hand.length).toBe(11);
      });
    });

    it("table cleared (no melds)", () => {
      const input: RoundInput = {
        roundNumber: 2,
        players: createTestPlayers(4),
        dealerIndex: 1,
      };
      const actor = createActor(roundMachine, { input });
      actor.start();

      expect(actor.getSnapshot().context.table).toEqual([]);
    });

    it("stock replenished (fresh shuffled deck)", () => {
      const input: RoundInput = {
        roundNumber: 2,
        players: createTestPlayers(4),
        dealerIndex: 1,
      };
      const actor = createActor(roundMachine, { input });
      actor.start();

      // 4 players: 108 - 44 dealt - 1 discard = 63 stock
      expect(actor.getSnapshot().context.stock.length).toBe(63);
    });

    it("discard reset (single flipped card)", () => {
      const input: RoundInput = {
        roundNumber: 2,
        players: createTestPlayers(4),
        dealerIndex: 1,
      };
      const actor = createActor(roundMachine, { input });
      actor.start();

      expect(actor.getSnapshot().context.discard.length).toBe(1);
    });
  });

  describe("preserved state", () => {
    it("player.totalScore NOT reset", () => {
      // Players come into round with existing scores
      const playersWithScores = createTestPlayers(4).map((p, i) => ({
        ...p,
        totalScore: (i + 1) * 20, // 20, 40, 60, 80
      }));

      const input: RoundInput = {
        roundNumber: 3,
        players: playersWithScores,
        dealerIndex: 2,
      };
      const actor = createActor(roundMachine, { input });
      actor.start();

      // Scores should be preserved
      expect(actor.getSnapshot().context.players[0]!.totalScore).toBe(20);
      expect(actor.getSnapshot().context.players[1]!.totalScore).toBe(40);
      expect(actor.getSnapshot().context.players[2]!.totalScore).toBe(60);
      expect(actor.getSnapshot().context.players[3]!.totalScore).toBe(80);
    });

    it("roundHistory preserved and extended", () => {
      const actor = createGameWithPlayers(4);

      // Complete round 1
      actor.send({
        type: "ROUND_COMPLETE",
        roundRecord: {
          roundNumber: 1,
          winnerId: "player-0",
          scores: { "player-0": 0, "player-1": 30, "player-2": 25, "player-3": 15 },
        },
      });

      expect(actor.getSnapshot().context.roundHistory.length).toBe(1);

      // Complete round 2
      actor.send({
        type: "ROUND_COMPLETE",
        roundRecord: {
          roundNumber: 2,
          winnerId: "player-1",
          scores: { "player-0": 20, "player-1": 0, "player-2": 35, "player-3": 10 },
        },
      });

      expect(actor.getSnapshot().context.roundHistory.length).toBe(2);
      expect(actor.getSnapshot().context.roundHistory[0]!.roundNumber).toBe(1);
      expect(actor.getSnapshot().context.roundHistory[1]!.roundNumber).toBe(2);
    });

    it("gameId unchanged", () => {
      const actor = createGameWithPlayers(4);
      const initialGameId = actor.getSnapshot().context.gameId;

      // Complete round 1
      actor.send({
        type: "ROUND_COMPLETE",
        roundRecord: { roundNumber: 1, winnerId: "player-0", scores: {} },
      });

      expect(actor.getSnapshot().context.gameId).toBe(initialGameId);
    });

    it("players array (identities) unchanged", () => {
      const actor = createGameWithPlayers(4);
      const initialPlayerIds = actor.getSnapshot().context.players.map((p) => p.id);

      // Complete round 1
      actor.send({
        type: "ROUND_COMPLETE",
        roundRecord: { roundNumber: 1, winnerId: "player-0", scores: {} },
      });

      const currentPlayerIds = actor.getSnapshot().context.players.map((p) => p.id);
      expect(currentPlayerIds).toEqual(initialPlayerIds);
    });
  });

  describe("round number progression", () => {
    it("round 1 -> round 2 -> round 3 -> round 4 -> round 5 -> round 6", () => {
      const actor = createGameWithPlayers(4);

      expect(actor.getSnapshot().context.currentRound).toBe(1);

      for (let round = 1; round <= 5; round++) {
        actor.send({
          type: "ROUND_COMPLETE",
          roundRecord: {
            roundNumber: round as RoundNumber,
            winnerId: "player-0",
            scores: {},
          },
        });
        expect(actor.getSnapshot().context.currentRound).toBe(round + 1);
      }
    });

    it("currentRound increments by 1", () => {
      const actor = createGameWithPlayers(4);

      expect(actor.getSnapshot().context.currentRound).toBe(1);

      actor.send({
        type: "ROUND_COMPLETE",
        roundRecord: { roundNumber: 1, winnerId: "player-0", scores: {} },
      });

      expect(actor.getSnapshot().context.currentRound).toBe(2);
    });
  });

  describe("contract progression", () => {
    it("round 1: 2 sets, round 2: 1 set + 1 run, round 3: 2 runs, round 4: 3 sets, round 5: 2 sets + 1 run, round 6: 1 set + 2 runs", () => {
      expect(CONTRACTS[1]).toEqual({ roundNumber: 1, sets: 2, runs: 0 });
      expect(CONTRACTS[2]).toEqual({ roundNumber: 2, sets: 1, runs: 1 });
      expect(CONTRACTS[3]).toEqual({ roundNumber: 3, sets: 0, runs: 2 });
      expect(CONTRACTS[4]).toEqual({ roundNumber: 4, sets: 3, runs: 0 });
      expect(CONTRACTS[5]).toEqual({ roundNumber: 5, sets: 2, runs: 1 });
      expect(CONTRACTS[6]).toEqual({ roundNumber: 6, sets: 1, runs: 2 });
    });
  });

  describe("score accumulation", () => {
    it("given: player has totalScore = 45 after round 3 and scores 25 in round 4, then: player.totalScore = 70", () => {
      const actor = createGameWithPlayers(4);

      // Complete rounds 1-3 to build up score
      actor.send({
        type: "ROUND_COMPLETE",
        roundRecord: {
          roundNumber: 1,
          winnerId: "player-0",
          scores: { "player-0": 0, "player-1": 15, "player-2": 0, "player-3": 0 },
        },
      });
      actor.send({
        type: "ROUND_COMPLETE",
        roundRecord: {
          roundNumber: 2,
          winnerId: "player-0",
          scores: { "player-0": 0, "player-1": 15, "player-2": 0, "player-3": 0 },
        },
      });
      actor.send({
        type: "ROUND_COMPLETE",
        roundRecord: {
          roundNumber: 3,
          winnerId: "player-0",
          scores: { "player-0": 0, "player-1": 15, "player-2": 0, "player-3": 0 },
        },
      });

      // Player 1 has totalScore = 45
      expect(actor.getSnapshot().context.players[1]!.totalScore).toBe(45);

      // Round 4 - player 1 scores 25 more
      actor.send({
        type: "ROUND_COMPLETE",
        roundRecord: {
          roundNumber: 4,
          winnerId: "player-0",
          scores: { "player-0": 0, "player-1": 25, "player-2": 0, "player-3": 0 },
        },
      });

      expect(actor.getSnapshot().context.players[1]!.totalScore).toBe(70);
    });

    it("player scores 0 in round 5 (went out), then: player.totalScore unchanged", () => {
      const actor = createGameWithPlayers(4);

      // Build up a score
      actor.send({
        type: "ROUND_COMPLETE",
        roundRecord: {
          roundNumber: 1,
          winnerId: "player-1",
          scores: { "player-0": 20, "player-1": 0, "player-2": 30, "player-3": 25 },
        },
      });

      const scoreAfterRound1 = actor.getSnapshot().context.players[1]!.totalScore;
      expect(scoreAfterRound1).toBe(0);

      // Player 1 goes out again in round 2 - score stays 0
      actor.send({
        type: "ROUND_COMPLETE",
        roundRecord: {
          roundNumber: 2,
          winnerId: "player-1",
          scores: { "player-0": 15, "player-1": 0, "player-2": 20, "player-3": 10 },
        },
      });

      expect(actor.getSnapshot().context.players[1]!.totalScore).toBe(0);
    });
  });
});

describe("round end to round start flow", () => {
  describe("sequence", () => {
    it("Round N ends (someone goes out) -> scores calculated -> RoundRecord created", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 0,
      };
      const actor = createActor(roundMachine, { input });
      actor.start();

      // Simulate going out
      actor.send({
        type: "TURN_COMPLETE",
        wentOut: true,
        playerId: "player-1",
        hand: [],
        stock: actor.getSnapshot().context.stock,
        discard: actor.getSnapshot().context.discard,
        table: [],
        isDown: true,
      });

      // Round is in scoring state (final)
      expect(actor.getSnapshot().status).toBe("done");
      expect(actor.getSnapshot().output?.roundRecord).toBeDefined();
      expect(actor.getSnapshot().output?.roundRecord.winnerId).toBe("player-1");
    });

    it("Player totalScores updated -> increment round -> advance dealer", () => {
      const actor = createGameWithPlayers(4);

      expect(actor.getSnapshot().context.currentRound).toBe(1);
      expect(actor.getSnapshot().context.dealerIndex).toBe(0);

      // Complete round 1 with scores
      actor.send({
        type: "ROUND_COMPLETE",
        roundRecord: {
          roundNumber: 1,
          winnerId: "player-0",
          scores: { "player-0": 0, "player-1": 30, "player-2": 25, "player-3": 15 },
        },
      });

      // Scores updated
      expect(actor.getSnapshot().context.players[0]!.totalScore).toBe(0);
      expect(actor.getSnapshot().context.players[1]!.totalScore).toBe(30);

      // Round incremented
      expect(actor.getSnapshot().context.currentRound).toBe(2);

      // Dealer advanced
      expect(actor.getSnapshot().context.dealerIndex).toBe(1);
    });
  });

  describe("timing", () => {
    it("scoring happens before round transition", () => {
      const actor = createGameWithPlayers(4);

      // Before round completion, score is 0
      expect(actor.getSnapshot().context.players[1]!.totalScore).toBe(0);

      // Complete round 1
      actor.send({
        type: "ROUND_COMPLETE",
        roundRecord: {
          roundNumber: 1,
          winnerId: "player-0",
          scores: { "player-0": 0, "player-1": 50, "player-2": 30, "player-3": 20 },
        },
      });

      // Score is updated and we're in round 2
      expect(actor.getSnapshot().context.players[1]!.totalScore).toBe(50);
      expect(actor.getSnapshot().context.currentRound).toBe(2);
    });

    it("dealer advances before dealing (visible in new round)", () => {
      const actor = createGameWithPlayers(4);

      expect(actor.getSnapshot().context.dealerIndex).toBe(0);

      // Complete round 1
      actor.send({
        type: "ROUND_COMPLETE",
        roundRecord: { roundNumber: 1, winnerId: "player-0", scores: {} },
      });

      // Dealer has advanced for round 2
      expect(actor.getSnapshot().context.dealerIndex).toBe(1);
    });
  });
});
