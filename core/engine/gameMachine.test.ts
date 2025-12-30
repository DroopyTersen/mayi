/**
 * GameMachine tests - Phase 5
 *
 * GameMachine orchestrates the full game flow:
 * Setup -> Playing (with RoundMachine) -> RoundEnd -> GameEnd
 */

import { describe, it, expect } from "bun:test";
import { createActor } from "xstate";
import { gameMachine } from "./game.machine";

describe("GameMachine - setup state", () => {
  describe("initial state", () => {
    it("starts in 'setup' state", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
      expect(actor.getSnapshot().value).toBe("setup");
      actor.stop();
    });

    it("gameId is empty or generated", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
      // Default gameId is empty string
      expect(actor.getSnapshot().context.gameId).toBe("");
      actor.stop();
    });

    it("players array is empty", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
      expect(actor.getSnapshot().context.players).toEqual([]);
      actor.stop();
    });

    it("currentRound is 1", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
      expect(actor.getSnapshot().context.currentRound).toBe(1);
      actor.stop();
    });

    it("dealerIndex is 0", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
      expect(actor.getSnapshot().context.dealerIndex).toBe(0);
      actor.stop();
    });

    it("roundHistory is empty array", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
      expect(actor.getSnapshot().context.roundHistory).toEqual([]);
      actor.stop();
    });
  });

  describe("ADD_PLAYER command", () => {
    it("adds player to players array", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      expect(actor.getSnapshot().context.players.length).toBe(1);
      expect(actor.getSnapshot().context.players[0]!.name).toBe("Alice");
      actor.stop();
    });

    it("player has id, name, hand: [], isDown: false, totalScore: 0", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
      actor.send({ type: "ADD_PLAYER", name: "Bob" });
      const player = actor.getSnapshot().context.players[0]!;
      expect(player.id).toBe("player-0");
      expect(player.name).toBe("Bob");
      expect(player.hand).toEqual([]);
      expect(player.isDown).toBe(false);
      expect(player.totalScore).toBe(0);
      actor.stop();
    });

    it("can add multiple players sequentially", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "ADD_PLAYER", name: "Bob" });
      actor.send({ type: "ADD_PLAYER", name: "Carol" });
      const players = actor.getSnapshot().context.players;
      expect(players.length).toBe(3);
      expect(players.map((p) => p.name)).toEqual(["Alice", "Bob", "Carol"]);
      actor.stop();
    });

    it("players array grows with each ADD_PLAYER", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
      expect(actor.getSnapshot().context.players.length).toBe(0);
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      expect(actor.getSnapshot().context.players.length).toBe(1);
      actor.send({ type: "ADD_PLAYER", name: "Bob" });
      expect(actor.getSnapshot().context.players.length).toBe(2);
      actor.send({ type: "ADD_PLAYER", name: "Carol" });
      expect(actor.getSnapshot().context.players.length).toBe(3);
      actor.stop();
    });

    it("remains in 'setup' state after adding player", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      expect(actor.getSnapshot().value).toBe("setup");
      actor.send({ type: "ADD_PLAYER", name: "Bob" });
      expect(actor.getSnapshot().value).toBe("setup");
      actor.stop();
    });
  });

  describe("player limits", () => {
    it("minimum 3 players required", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "ADD_PLAYER", name: "Bob" });
      // Try to start with only 2 players - should stay in setup
      actor.send({ type: "START_GAME" });
      expect(actor.getSnapshot().value).toBe("setup");
      // Add third player and try again
      actor.send({ type: "ADD_PLAYER", name: "Carol" });
      actor.send({ type: "START_GAME" });
      expect(actor.getSnapshot().value).toBe("playing");
      actor.stop();
    });

    it("maximum 8 players allowed", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
      // Add 8 players
      for (let i = 0; i < 8; i++) {
        actor.send({ type: "ADD_PLAYER", name: `Player${i}` });
      }
      expect(actor.getSnapshot().context.players.length).toBe(8);
      actor.stop();
    });

    it("ADD_PLAYER rejected if already at 8 players", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
      // Add 8 players
      for (let i = 0; i < 8; i++) {
        actor.send({ type: "ADD_PLAYER", name: `Player${i}` });
      }
      expect(actor.getSnapshot().context.players.length).toBe(8);
      // Try to add a 9th player - should be rejected
      actor.send({ type: "ADD_PLAYER", name: "Player9" });
      expect(actor.getSnapshot().context.players.length).toBe(8);
      actor.stop();
    });
  });

  describe("START_GAME command", () => {
    it("requires minimum 3 players (guard: hasMinPlayers)", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "ADD_PLAYER", name: "Bob" });
      // 2 players - should not transition
      actor.send({ type: "START_GAME" });
      expect(actor.getSnapshot().value).toBe("setup");
      actor.stop();
    });

    it("rejected if fewer than 3 players", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
      // 0 players
      actor.send({ type: "START_GAME" });
      expect(actor.getSnapshot().value).toBe("setup");
      // 1 player
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "START_GAME" });
      expect(actor.getSnapshot().value).toBe("setup");
      actor.stop();
    });

    it("transitions to 'playing' state when valid", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "ADD_PLAYER", name: "Bob" });
      actor.send({ type: "ADD_PLAYER", name: "Carol" });
      actor.send({ type: "START_GAME" });
      expect(actor.getSnapshot().value).toBe("playing");
      actor.stop();
    });

    it("triggers initializePlayers action", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "ADD_PLAYER", name: "Bob" });
      actor.send({ type: "ADD_PLAYER", name: "Carol" });
      actor.send({ type: "START_GAME" });
      // All players should be initialized with hand: [], isDown: false, totalScore: 0
      const players = actor.getSnapshot().context.players;
      for (const player of players) {
        expect(player.hand).toEqual([]);
        expect(player.isDown).toBe(false);
        expect(player.totalScore).toBe(0);
      }
      actor.stop();
    });
  });

  describe("START_GAME rejected scenarios", () => {
    it("rejected with 0 players", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
      actor.send({ type: "START_GAME" });
      expect(actor.getSnapshot().value).toBe("setup");
      actor.stop();
    });

    it("rejected with 1 player", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "START_GAME" });
      expect(actor.getSnapshot().value).toBe("setup");
      actor.stop();
    });

    it("rejected with 2 players", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "ADD_PLAYER", name: "Bob" });
      actor.send({ type: "START_GAME" });
      expect(actor.getSnapshot().value).toBe("setup");
      actor.stop();
    });

    it("error message: 'minimum 3 players required'", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "ADD_PLAYER", name: "Bob" });
      actor.send({ type: "START_GAME" });
      expect(actor.getSnapshot().context.lastError).toBe("minimum 3 players required");
      actor.stop();
    });

    it("remains in 'setup' state on rejection", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "START_GAME" });
      expect(actor.getSnapshot().value).toBe("setup");
      expect(actor.getSnapshot().context.players.length).toBe(1);
      actor.stop();
    });
  });

  describe("initializePlayers action", () => {
    it("sets initial totalScore to 0 for all players", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "ADD_PLAYER", name: "Bob" });
      actor.send({ type: "ADD_PLAYER", name: "Carol" });
      actor.send({ type: "START_GAME" });
      for (const player of actor.getSnapshot().context.players) {
        expect(player.totalScore).toBe(0);
      }
      actor.stop();
    });

    it("sets isDown to false for all players", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "ADD_PLAYER", name: "Bob" });
      actor.send({ type: "ADD_PLAYER", name: "Carol" });
      actor.send({ type: "START_GAME" });
      for (const player of actor.getSnapshot().context.players) {
        expect(player.isDown).toBe(false);
      }
      actor.stop();
    });

    it("clears any existing hand data", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "ADD_PLAYER", name: "Bob" });
      actor.send({ type: "ADD_PLAYER", name: "Carol" });
      actor.send({ type: "START_GAME" });
      for (const player of actor.getSnapshot().context.players) {
        expect(player.hand).toEqual([]);
      }
      actor.stop();
    });

    it("prepares players for round 1", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "ADD_PLAYER", name: "Bob" });
      actor.send({ type: "ADD_PLAYER", name: "Carol" });
      actor.send({ type: "START_GAME" });
      expect(actor.getSnapshot().context.currentRound).toBe(1);
      expect(actor.getSnapshot().context.players.length).toBe(3);
      actor.stop();
    });
  });
});

describe("GameMachine - playing state", () => {
  describe("entering playing state", () => {
    it("spawns RoundMachine with current round context", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "ADD_PLAYER", name: "Bob" });
      actor.send({ type: "ADD_PLAYER", name: "Carol" });
      actor.send({ type: "START_GAME" });

      // Verify roundMachine is invoked via persisted snapshot
      const persisted = actor.getPersistedSnapshot() as any;
      expect(persisted.children?.round).toBeDefined();
      expect(persisted.children?.round?.snapshot).toBeDefined();

      // Round machine should have correct round number
      const roundContext = persisted.children?.round?.snapshot?.context;
      expect(roundContext?.roundNumber).toBe(1);

      actor.stop();
    });

    it("passes roundNumber (starts at 1)", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "ADD_PLAYER", name: "Bob" });
      actor.send({ type: "ADD_PLAYER", name: "Carol" });
      actor.send({ type: "START_GAME" });
      expect(actor.getSnapshot().context.currentRound).toBe(1);
      actor.stop();
    });

    it("passes dealerIndex", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "ADD_PLAYER", name: "Bob" });
      actor.send({ type: "ADD_PLAYER", name: "Carol" });
      actor.send({ type: "START_GAME" });
      expect(actor.getSnapshot().context.dealerIndex).toBe(0);
      actor.stop();
    });
  });

  describe("RoundMachine input", () => {
    it("roundNumber: context.currentRound", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "ADD_PLAYER", name: "Bob" });
      actor.send({ type: "ADD_PLAYER", name: "Carol" });
      actor.send({ type: "START_GAME" });
      // Round number should be available in context for RoundMachine
      expect(actor.getSnapshot().context.currentRound).toBe(1);
      actor.stop();
    });

    it("players: context.players (with current totalScores)", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "ADD_PLAYER", name: "Bob" });
      actor.send({ type: "ADD_PLAYER", name: "Carol" });
      actor.send({ type: "START_GAME" });
      const players = actor.getSnapshot().context.players;
      expect(players.length).toBe(3);
      for (const player of players) {
        expect(player.totalScore).toBe(0);
      }
      actor.stop();
    });

    it("dealerIndex: context.dealerIndex", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "ADD_PLAYER", name: "Bob" });
      actor.send({ type: "ADD_PLAYER", name: "Carol" });
      actor.send({ type: "START_GAME" });
      expect(actor.getSnapshot().context.dealerIndex).toBe(0);
      actor.stop();
    });
  });

  describe("round completion", () => {
    it("when RoundMachine reaches final state", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "ADD_PLAYER", name: "Bob" });
      actor.send({ type: "ADD_PLAYER", name: "Carol" });
      actor.send({ type: "START_GAME" });
      // Simulate round completion via ROUND_COMPLETE event
      actor.send({
        type: "ROUND_COMPLETE",
        roundRecord: {
          roundNumber: 1,
          scores: { "player-0": 0, "player-1": 25, "player-2": 30 },
          winnerId: "player-0",
        },
      });
      // Should transition to roundEnd and then back to playing
      expect(actor.getSnapshot().value).toBe("playing");
      actor.stop();
    });

    it("receives roundRecord from RoundMachine output", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "ADD_PLAYER", name: "Bob" });
      actor.send({ type: "ADD_PLAYER", name: "Carol" });
      actor.send({ type: "START_GAME" });
      const roundRecord = {
        roundNumber: 1,
        scores: { "player-0": 0, "player-1": 25, "player-2": 30 },
        winnerId: "player-0",
      };
      actor.send({ type: "ROUND_COMPLETE", roundRecord });
      expect(actor.getSnapshot().context.roundHistory.length).toBe(1);
      expect(actor.getSnapshot().context.roundHistory[0]).toEqual(roundRecord);
      actor.stop();
    });

    it("adds roundRecord to roundHistory", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "ADD_PLAYER", name: "Bob" });
      actor.send({ type: "ADD_PLAYER", name: "Carol" });
      actor.send({ type: "START_GAME" });
      actor.send({
        type: "ROUND_COMPLETE",
        roundRecord: {
          roundNumber: 1,
          scores: { "player-0": 0, "player-1": 25, "player-2": 30 },
          winnerId: "player-0",
        },
      });
      expect(actor.getSnapshot().context.roundHistory.length).toBe(1);
      actor.stop();
    });

    it("transitions to 'roundEnd' state", () => {
      // Note: roundEnd has always transitions, so it immediately moves to playing or gameEnd
      // We can verify by checking context changes that happen in roundEnd
      const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "ADD_PLAYER", name: "Bob" });
      actor.send({ type: "ADD_PLAYER", name: "Carol" });
      actor.send({ type: "START_GAME" });
      actor.send({
        type: "ROUND_COMPLETE",
        roundRecord: {
          roundNumber: 1,
          scores: { "player-0": 0, "player-1": 25, "player-2": 30 },
          winnerId: "player-0",
        },
      });
      // After roundEnd, should transition back to playing (round 2)
      expect(actor.getSnapshot().context.currentRound).toBe(2);
      actor.stop();
    });
  });

  describe("roundHistory update", () => {
    it("appends new RoundRecord to existing history", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "ADD_PLAYER", name: "Bob" });
      actor.send({ type: "ADD_PLAYER", name: "Carol" });
      actor.send({ type: "START_GAME" });
      // Round 1
      actor.send({
        type: "ROUND_COMPLETE",
        roundRecord: { roundNumber: 1, scores: { "player-0": 0, "player-1": 25, "player-2": 30 }, winnerId: "player-0" },
      });
      // Round 2
      actor.send({
        type: "ROUND_COMPLETE",
        roundRecord: { roundNumber: 2, scores: { "player-0": 20, "player-1": 0, "player-2": 15 }, winnerId: "player-1" },
      });
      expect(actor.getSnapshot().context.roundHistory.length).toBe(2);
      expect(actor.getSnapshot().context.roundHistory[0]!.roundNumber).toBe(1);
      expect(actor.getSnapshot().context.roundHistory[1]!.roundNumber).toBe(2);
      actor.stop();
    });

    it("preserves all previous round records", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "ADD_PLAYER", name: "Bob" });
      actor.send({ type: "ADD_PLAYER", name: "Carol" });
      actor.send({ type: "START_GAME" });
      const record1 = { roundNumber: 1, scores: { "player-0": 0, "player-1": 25, "player-2": 30 }, winnerId: "player-0" };
      const record2 = { roundNumber: 2, scores: { "player-0": 20, "player-1": 0, "player-2": 15 }, winnerId: "player-1" };
      actor.send({ type: "ROUND_COMPLETE", roundRecord: record1 });
      actor.send({ type: "ROUND_COMPLETE", roundRecord: record2 });
      expect(actor.getSnapshot().context.roundHistory[0]).toEqual(record1);
      expect(actor.getSnapshot().context.roundHistory[1]).toEqual(record2);
      actor.stop();
    });

    it("roundHistory.length increases by 1", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "ADD_PLAYER", name: "Bob" });
      actor.send({ type: "ADD_PLAYER", name: "Carol" });
      actor.send({ type: "START_GAME" });
      expect(actor.getSnapshot().context.roundHistory.length).toBe(0);
      actor.send({
        type: "ROUND_COMPLETE",
        roundRecord: { roundNumber: 1, scores: { "player-0": 0, "player-1": 25, "player-2": 30 }, winnerId: "player-0" },
      });
      expect(actor.getSnapshot().context.roundHistory.length).toBe(1);
      actor.stop();
    });
  });
});

describe("GameMachine - roundEnd state", () => {
  // Helper to start a game with 3 players
  function startGame() {
    const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
    actor.send({ type: "ADD_PLAYER", name: "Alice" });
    actor.send({ type: "ADD_PLAYER", name: "Bob" });
    actor.send({ type: "ADD_PLAYER", name: "Carol" });
    actor.send({ type: "START_GAME" });
    return actor;
  }

  // Helper to create a round record
  function roundRecord(roundNumber: number, winnerId = "player-0") {
    return {
      roundNumber,
      scores: { "player-0": winnerId === "player-0" ? 0 : 25, "player-1": winnerId === "player-1" ? 0 : 30, "player-2": winnerId === "player-2" ? 0 : 20 },
      winnerId,
    };
  }

  describe("game continuation (rounds 1-5)", () => {
    it("guard 'isGameOver' returns false when currentRound is 1, 2, 3, 4, or 5", () => {
      const actor = startGame();
      // Complete rounds 1-5, should stay in playing
      for (let round = 1; round <= 5; round++) {
        actor.send({ type: "ROUND_COMPLETE", roundRecord: roundRecord(round) });
        expect(actor.getSnapshot().value).toBe("playing");
      }
      actor.stop();
    });

    it("transitions back to 'playing'", () => {
      const actor = startGame();
      actor.send({ type: "ROUND_COMPLETE", roundRecord: roundRecord(1) });
      expect(actor.getSnapshot().value).toBe("playing");
      actor.stop();
    });

    it("incrementRound action fires", () => {
      const actor = startGame();
      expect(actor.getSnapshot().context.currentRound).toBe(1);
      actor.send({ type: "ROUND_COMPLETE", roundRecord: roundRecord(1) });
      expect(actor.getSnapshot().context.currentRound).toBe(2);
      actor.stop();
    });

    it("advanceDealer action fires", () => {
      const actor = startGame();
      expect(actor.getSnapshot().context.dealerIndex).toBe(0);
      actor.send({ type: "ROUND_COMPLETE", roundRecord: roundRecord(1) });
      expect(actor.getSnapshot().context.dealerIndex).toBe(1);
      actor.stop();
    });
  });

  describe("incrementRound action", () => {
    it("currentRound increases by 1", () => {
      const actor = startGame();
      expect(actor.getSnapshot().context.currentRound).toBe(1);
      actor.send({ type: "ROUND_COMPLETE", roundRecord: roundRecord(1) });
      expect(actor.getSnapshot().context.currentRound).toBe(2);
      actor.send({ type: "ROUND_COMPLETE", roundRecord: roundRecord(2) });
      expect(actor.getSnapshot().context.currentRound).toBe(3);
      actor.stop();
    });

    it("round progression: 1 -> 2 -> 3 -> 4 -> 5 -> 6", () => {
      const actor = startGame();
      const expectedRounds = [1, 2, 3, 4, 5, 6] as const;
      for (let i = 0; i < expectedRounds.length; i++) {
        expect(actor.getSnapshot().context.currentRound).toBe(expectedRounds[i]!);
        if (i < 5) {
          actor.send({ type: "ROUND_COMPLETE", roundRecord: roundRecord(expectedRounds[i]!) });
        }
      }
      actor.stop();
    });

    it("after round 6, game ends (no increment needed)", () => {
      const actor = startGame();
      // Complete all 6 rounds
      for (let round = 1; round <= 6; round++) {
        actor.send({ type: "ROUND_COMPLETE", roundRecord: roundRecord(round) });
      }
      // After round 6 completes, game ends - currentRound stays at 6
      expect(actor.getSnapshot().context.currentRound).toBe(6);
      expect(actor.getSnapshot().value).toBe("gameEnd");
      actor.stop();
    });
  });

  describe("advanceDealer action", () => {
    it("dealerIndex increases by 1", () => {
      const actor = startGame();
      expect(actor.getSnapshot().context.dealerIndex).toBe(0);
      actor.send({ type: "ROUND_COMPLETE", roundRecord: roundRecord(1) });
      expect(actor.getSnapshot().context.dealerIndex).toBe(1);
      actor.send({ type: "ROUND_COMPLETE", roundRecord: roundRecord(2) });
      expect(actor.getSnapshot().context.dealerIndex).toBe(2);
      actor.stop();
    });

    it("wraps around: (dealerIndex + 1) % playerCount", () => {
      const actor = startGame();
      // With 3 players: 0 -> 1 -> 2 -> 0
      actor.send({ type: "ROUND_COMPLETE", roundRecord: roundRecord(1) });
      expect(actor.getSnapshot().context.dealerIndex).toBe(1);
      actor.send({ type: "ROUND_COMPLETE", roundRecord: roundRecord(2) });
      expect(actor.getSnapshot().context.dealerIndex).toBe(2);
      actor.send({ type: "ROUND_COMPLETE", roundRecord: roundRecord(3) });
      expect(actor.getSnapshot().context.dealerIndex).toBe(0); // Wrapped!
      actor.stop();
    });

    it("with 4 players: 0 -> 1 -> 2 -> 3 -> 0 -> 1 ...", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "ADD_PLAYER", name: "Bob" });
      actor.send({ type: "ADD_PLAYER", name: "Carol" });
      actor.send({ type: "ADD_PLAYER", name: "Dave" });
      actor.send({ type: "START_GAME" });

      const record = { roundNumber: 1, scores: { "player-0": 0, "player-1": 25, "player-2": 30, "player-3": 15 }, winnerId: "player-0" };
      expect(actor.getSnapshot().context.dealerIndex).toBe(0);
      actor.send({ type: "ROUND_COMPLETE", roundRecord: { ...record, roundNumber: 1 } });
      expect(actor.getSnapshot().context.dealerIndex).toBe(1);
      actor.send({ type: "ROUND_COMPLETE", roundRecord: { ...record, roundNumber: 2 } });
      expect(actor.getSnapshot().context.dealerIndex).toBe(2);
      actor.send({ type: "ROUND_COMPLETE", roundRecord: { ...record, roundNumber: 3 } });
      expect(actor.getSnapshot().context.dealerIndex).toBe(3);
      actor.send({ type: "ROUND_COMPLETE", roundRecord: { ...record, roundNumber: 4 } });
      expect(actor.getSnapshot().context.dealerIndex).toBe(0); // Wrapped!
      actor.send({ type: "ROUND_COMPLETE", roundRecord: { ...record, roundNumber: 5 } });
      expect(actor.getSnapshot().context.dealerIndex).toBe(1);
      actor.stop();
    });

    it("dealer rotates left (clockwise)", () => {
      // Same as wrap-around test - dealer index increases (left/clockwise)
      const actor = startGame();
      expect(actor.getSnapshot().context.dealerIndex).toBe(0);
      actor.send({ type: "ROUND_COMPLETE", roundRecord: roundRecord(1) });
      expect(actor.getSnapshot().context.dealerIndex).toBe(1);
      actor.stop();
    });
  });

  describe("game end condition (after round 6)", () => {
    it("guard 'isGameOver' returns true when currentRound >= 6", () => {
      const actor = startGame();
      // Complete all 6 rounds
      for (let round = 1; round <= 6; round++) {
        actor.send({ type: "ROUND_COMPLETE", roundRecord: roundRecord(round) });
      }
      expect(actor.getSnapshot().context.currentRound).toBe(6);
      expect(actor.getSnapshot().value).toBe("gameEnd");
      actor.stop();
    });

    it("game ends after round 6 completes", () => {
      const actor = startGame();
      for (let round = 1; round <= 6; round++) {
        actor.send({ type: "ROUND_COMPLETE", roundRecord: roundRecord(round) });
      }
      // currentRound stays at 6 (no increment when game ends)
      expect(actor.getSnapshot().context.currentRound).toBe(6);
      expect(actor.getSnapshot().value).toBe("gameEnd");
      actor.stop();
    });

    it("transitions to 'gameEnd' state", () => {
      const actor = startGame();
      for (let round = 1; round <= 6; round++) {
        actor.send({ type: "ROUND_COMPLETE", roundRecord: roundRecord(round) });
      }
      expect(actor.getSnapshot().value).toBe("gameEnd");
      actor.stop();
    });
  });
});

describe("GameMachine - gameEnd state", () => {
  // Helper to play a full game
  function playFullGame() {
    const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
    actor.send({ type: "ADD_PLAYER", name: "Alice" });
    actor.send({ type: "ADD_PLAYER", name: "Bob" });
    actor.send({ type: "ADD_PLAYER", name: "Carol" });
    actor.send({ type: "START_GAME" });

    // Complete all 6 rounds with varying winners and scores
    const rounds = [
      { roundNumber: 1, scores: { "player-0": 0, "player-1": 25, "player-2": 30 }, winnerId: "player-0" },
      { roundNumber: 2, scores: { "player-0": 20, "player-1": 0, "player-2": 15 }, winnerId: "player-1" },
      { roundNumber: 3, scores: { "player-0": 10, "player-1": 35, "player-2": 0 }, winnerId: "player-2" },
      { roundNumber: 4, scores: { "player-0": 0, "player-1": 15, "player-2": 40 }, winnerId: "player-0" },
      { roundNumber: 5, scores: { "player-0": 25, "player-1": 0, "player-2": 20 }, winnerId: "player-1" },
      { roundNumber: 6, scores: { "player-0": 15, "player-1": 30, "player-2": 0 }, winnerId: "player-2" },
    ];

    for (const round of rounds) {
      actor.send({ type: "ROUND_COMPLETE", roundRecord: round });
    }

    return actor;
  }

  describe("entering gameEnd", () => {
    it("triggers calculateFinalScores action", () => {
      const actor = playFullGame();
      // Winner should be determined based on accumulated scores
      expect(actor.getSnapshot().context.winners.length).toBeGreaterThan(0);
      actor.stop();
    });

    it("gameEnd is a final state", () => {
      const actor = playFullGame();
      expect(actor.getSnapshot().value).toBe("gameEnd");
      expect(actor.getSnapshot().status).toBe("done");
      actor.stop();
    });

    it("no further transitions possible", () => {
      const actor = playFullGame();
      // Try to send events - should have no effect
      actor.send({ type: "ROUND_COMPLETE", roundRecord: { roundNumber: 7, scores: {}, winnerId: "player-0" } });
      expect(actor.getSnapshot().value).toBe("gameEnd");
      expect(actor.getSnapshot().context.roundHistory.length).toBe(6); // Still 6
      actor.stop();
    });

    it("no further commands accepted", () => {
      const actor = playFullGame();
      // ADD_PLAYER should not work
      actor.send({ type: "ADD_PLAYER", name: "NewPlayer" });
      expect(actor.getSnapshot().context.players.length).toBe(3);
      actor.stop();
    });
  });

  describe("calculateFinalScores action", () => {
    it("final scores already accumulated in player.totalScore", () => {
      const actor = playFullGame();
      const players = actor.getSnapshot().context.players;
      // Player 0: 0 + 20 + 10 + 0 + 25 + 15 = 70
      // Player 1: 25 + 0 + 35 + 15 + 0 + 30 = 105
      // Player 2: 30 + 15 + 0 + 40 + 20 + 0 = 105
      expect(players[0]!.totalScore).toBe(70);
      expect(players[1]!.totalScore).toBe(105);
      expect(players[2]!.totalScore).toBe(105);
      actor.stop();
    });

    it("determines winner(s) - lowest total score", () => {
      const actor = playFullGame();
      // Player 0 has lowest score (70)
      expect(actor.getSnapshot().context.winners).toEqual(["player-0"]);
      actor.stop();
    });

    it("handles ties (multiple winners)", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "ADD_PLAYER", name: "Bob" });
      actor.send({ type: "ADD_PLAYER", name: "Carol" });
      actor.send({ type: "START_GAME" });

      // All players tie with same score
      for (let round = 1; round <= 6; round++) {
        actor.send({
          type: "ROUND_COMPLETE",
          roundRecord: {
            roundNumber: round,
            scores: { "player-0": 10, "player-1": 10, "player-2": 10 },
            winnerId: "player-0",
          },
        });
      }

      // All players have 60 points - all should be winners
      expect(actor.getSnapshot().context.winners.length).toBe(3);
      expect(actor.getSnapshot().context.winners).toContain("player-0");
      expect(actor.getSnapshot().context.winners).toContain("player-1");
      expect(actor.getSnapshot().context.winners).toContain("player-2");
      actor.stop();
    });
  });

  describe("final state output", () => {
    it("includes final scores for all players", () => {
      const actor = playFullGame();
      const snapshot = actor.getSnapshot();
      expect(snapshot.context.players.map((p) => p.totalScore)).toEqual([70, 105, 105]);
      actor.stop();
    });

    it("includes winner(s) array", () => {
      const actor = playFullGame();
      expect(actor.getSnapshot().context.winners).toEqual(["player-0"]);
      actor.stop();
    });

    it("includes complete roundHistory", () => {
      const actor = playFullGame();
      expect(actor.getSnapshot().context.roundHistory.length).toBe(6);
      actor.stop();
    });

    it("game is complete", () => {
      const actor = playFullGame();
      expect(actor.getSnapshot().value).toBe("gameEnd");
      expect(actor.getSnapshot().status).toBe("done");
      actor.stop();
    });
  });
});

describe("GameMachine - guards", () => {
  describe("hasMinPlayers", () => {
    it("returns false when players.length < 3", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "ADD_PLAYER", name: "Bob" });
      actor.send({ type: "START_GAME" });
      expect(actor.getSnapshot().value).toBe("setup"); // Didn't transition
      actor.stop();
    });

    it("returns true when players.length >= 3", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "ADD_PLAYER", name: "Bob" });
      actor.send({ type: "ADD_PLAYER", name: "Carol" });
      actor.send({ type: "START_GAME" });
      expect(actor.getSnapshot().value).toBe("playing"); // Did transition
      actor.stop();
    });

    it("returns true when players.length === 8", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
      for (let i = 0; i < 8; i++) {
        actor.send({ type: "ADD_PLAYER", name: `Player${i}` });
      }
      actor.send({ type: "START_GAME" });
      expect(actor.getSnapshot().value).toBe("playing");
      expect(actor.getSnapshot().context.players.length).toBe(8);
      actor.stop();
    });
  });

  describe("isGameOver", () => {
    it("returns false when currentRound < 6", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "ADD_PLAYER", name: "Bob" });
      actor.send({ type: "ADD_PLAYER", name: "Carol" });
      actor.send({ type: "START_GAME" });

      // Complete rounds 1-5
      for (let round = 1; round <= 5; round++) {
        actor.send({
          type: "ROUND_COMPLETE",
          roundRecord: { roundNumber: round, scores: { "player-0": 10, "player-1": 15, "player-2": 20 }, winnerId: "player-0" },
        });
        expect(actor.getSnapshot().value).toBe("playing"); // Not game over
      }
      actor.stop();
    });

    it("returns true when currentRound >= 6", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "ADD_PLAYER", name: "Bob" });
      actor.send({ type: "ADD_PLAYER", name: "Carol" });
      actor.send({ type: "START_GAME" });

      // Complete all 6 rounds
      for (let round = 1; round <= 6; round++) {
        actor.send({
          type: "ROUND_COMPLETE",
          roundRecord: { roundNumber: round, scores: { "player-0": 10, "player-1": 15, "player-2": 20 }, winnerId: "player-0" },
        });
      }
      expect(actor.getSnapshot().value).toBe("gameEnd");
      actor.stop();
    });

    it("checked in roundEnd state", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "ADD_PLAYER", name: "Bob" });
      actor.send({ type: "ADD_PLAYER", name: "Carol" });
      actor.send({ type: "START_GAME" });

      // After round completion, state goes through roundEnd (with always transitions)
      actor.send({
        type: "ROUND_COMPLETE",
        roundRecord: { roundNumber: 1, scores: { "player-0": 10, "player-1": 15, "player-2": 20 }, winnerId: "player-0" },
      });
      // Guard was checked, game continued to playing
      expect(actor.getSnapshot().value).toBe("playing");
      expect(actor.getSnapshot().context.currentRound).toBe(2);
      actor.stop();
    });
  });
});

describe("GameMachine - context preservation", () => {
  describe("across rounds", () => {
    it("players array persists", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "ADD_PLAYER", name: "Bob" });
      actor.send({ type: "ADD_PLAYER", name: "Carol" });
      actor.send({ type: "START_GAME" });

      const initialPlayers = actor.getSnapshot().context.players;
      actor.send({
        type: "ROUND_COMPLETE",
        roundRecord: { roundNumber: 1, scores: { "player-0": 10, "player-1": 15, "player-2": 20 }, winnerId: "player-0" },
      });
      const afterRoundPlayers = actor.getSnapshot().context.players;

      expect(afterRoundPlayers.length).toBe(initialPlayers.length);
      expect(afterRoundPlayers.map((p) => p.id)).toEqual(initialPlayers.map((p) => p.id));
      actor.stop();
    });

    it("player.totalScore accumulates", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "ADD_PLAYER", name: "Bob" });
      actor.send({ type: "ADD_PLAYER", name: "Carol" });
      actor.send({ type: "START_GAME" });

      actor.send({
        type: "ROUND_COMPLETE",
        roundRecord: { roundNumber: 1, scores: { "player-0": 10, "player-1": 15, "player-2": 20 }, winnerId: "player-0" },
      });
      expect(actor.getSnapshot().context.players[0]!.totalScore).toBe(10);

      actor.send({
        type: "ROUND_COMPLETE",
        roundRecord: { roundNumber: 2, scores: { "player-0": 5, "player-1": 0, "player-2": 25 }, winnerId: "player-1" },
      });
      expect(actor.getSnapshot().context.players[0]!.totalScore).toBe(15); // 10 + 5
      actor.stop();
    });

    it("roundHistory grows", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "ADD_PLAYER", name: "Bob" });
      actor.send({ type: "ADD_PLAYER", name: "Carol" });
      actor.send({ type: "START_GAME" });

      expect(actor.getSnapshot().context.roundHistory.length).toBe(0);

      actor.send({
        type: "ROUND_COMPLETE",
        roundRecord: { roundNumber: 1, scores: { "player-0": 10, "player-1": 15, "player-2": 20 }, winnerId: "player-0" },
      });
      expect(actor.getSnapshot().context.roundHistory.length).toBe(1);

      actor.send({
        type: "ROUND_COMPLETE",
        roundRecord: { roundNumber: 2, scores: { "player-0": 5, "player-1": 0, "player-2": 25 }, winnerId: "player-1" },
      });
      expect(actor.getSnapshot().context.roundHistory.length).toBe(2);
      actor.stop();
    });

    it("gameId unchanged", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "ADD_PLAYER", name: "Bob" });
      actor.send({ type: "ADD_PLAYER", name: "Carol" });
      actor.send({ type: "START_GAME" });

      const initialGameId = actor.getSnapshot().context.gameId;

      actor.send({
        type: "ROUND_COMPLETE",
        roundRecord: { roundNumber: 1, scores: { "player-0": 10, "player-1": 15, "player-2": 20 }, winnerId: "player-0" },
      });

      expect(actor.getSnapshot().context.gameId).toBe(initialGameId);
      actor.stop();
    });
  });

  describe("player scores", () => {
    it("totalScore updated after each round", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "ADD_PLAYER", name: "Bob" });
      actor.send({ type: "ADD_PLAYER", name: "Carol" });
      actor.send({ type: "START_GAME" });

      for (let round = 1; round <= 3; round++) {
        actor.send({
          type: "ROUND_COMPLETE",
          roundRecord: {
            roundNumber: round,
            scores: { "player-0": 10 * round, "player-1": 5 * round, "player-2": 15 * round },
            winnerId: "player-1",
          },
        });
      }

      // player-0: 10 + 20 + 30 = 60
      // player-1: 5 + 10 + 15 = 30
      // player-2: 15 + 30 + 45 = 90
      expect(actor.getSnapshot().context.players[0]!.totalScore).toBe(60);
      expect(actor.getSnapshot().context.players[1]!.totalScore).toBe(30);
      expect(actor.getSnapshot().context.players[2]!.totalScore).toBe(90);
      actor.stop();
    });

    it("scores from roundRecord added to player.totalScore", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "ADD_PLAYER", name: "Bob" });
      actor.send({ type: "ADD_PLAYER", name: "Carol" });
      actor.send({ type: "START_GAME" });

      actor.send({
        type: "ROUND_COMPLETE",
        roundRecord: { roundNumber: 1, scores: { "player-0": 0, "player-1": 42, "player-2": 17 }, winnerId: "player-0" },
      });

      expect(actor.getSnapshot().context.players[0]!.totalScore).toBe(0);
      expect(actor.getSnapshot().context.players[1]!.totalScore).toBe(42);
      expect(actor.getSnapshot().context.players[2]!.totalScore).toBe(17);
      actor.stop();
    });

    it("cumulative across all 6 rounds", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } }).start();
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "ADD_PLAYER", name: "Bob" });
      actor.send({ type: "ADD_PLAYER", name: "Carol" });
      actor.send({ type: "START_GAME" });

      // Complete all 6 rounds
      for (let round = 1; round <= 6; round++) {
        actor.send({
          type: "ROUND_COMPLETE",
          roundRecord: { roundNumber: round, scores: { "player-0": 10, "player-1": 20, "player-2": 30 }, winnerId: "player-0" },
        });
      }

      // Each player's score is cumulative over 6 rounds
      expect(actor.getSnapshot().context.players[0]!.totalScore).toBe(60); // 10 * 6
      expect(actor.getSnapshot().context.players[1]!.totalScore).toBe(120); // 20 * 6
      expect(actor.getSnapshot().context.players[2]!.totalScore).toBe(180); // 30 * 6
      actor.stop();
    });
  });
});
