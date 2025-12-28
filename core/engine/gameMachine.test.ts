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
      const actor = createActor(gameMachine).start();
      expect(actor.getSnapshot().value).toBe("setup");
      actor.stop();
    });

    it("gameId is empty or generated", () => {
      const actor = createActor(gameMachine).start();
      // Default gameId is empty string
      expect(actor.getSnapshot().context.gameId).toBe("");
      actor.stop();
    });

    it("players array is empty", () => {
      const actor = createActor(gameMachine).start();
      expect(actor.getSnapshot().context.players).toEqual([]);
      actor.stop();
    });

    it("currentRound is 1", () => {
      const actor = createActor(gameMachine).start();
      expect(actor.getSnapshot().context.currentRound).toBe(1);
      actor.stop();
    });

    it("dealerIndex is 0", () => {
      const actor = createActor(gameMachine).start();
      expect(actor.getSnapshot().context.dealerIndex).toBe(0);
      actor.stop();
    });

    it("roundHistory is empty array", () => {
      const actor = createActor(gameMachine).start();
      expect(actor.getSnapshot().context.roundHistory).toEqual([]);
      actor.stop();
    });
  });

  describe("ADD_PLAYER command", () => {
    it("adds player to players array", () => {
      const actor = createActor(gameMachine).start();
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      expect(actor.getSnapshot().context.players.length).toBe(1);
      expect(actor.getSnapshot().context.players[0]!.name).toBe("Alice");
      actor.stop();
    });

    it("player has id, name, hand: [], isDown: false, totalScore: 0", () => {
      const actor = createActor(gameMachine).start();
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
      const actor = createActor(gameMachine).start();
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "ADD_PLAYER", name: "Bob" });
      actor.send({ type: "ADD_PLAYER", name: "Carol" });
      const players = actor.getSnapshot().context.players;
      expect(players.length).toBe(3);
      expect(players.map((p) => p.name)).toEqual(["Alice", "Bob", "Carol"]);
      actor.stop();
    });

    it("players array grows with each ADD_PLAYER", () => {
      const actor = createActor(gameMachine).start();
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
      const actor = createActor(gameMachine).start();
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      expect(actor.getSnapshot().value).toBe("setup");
      actor.send({ type: "ADD_PLAYER", name: "Bob" });
      expect(actor.getSnapshot().value).toBe("setup");
      actor.stop();
    });
  });

  describe("player limits", () => {
    it("minimum 3 players required", () => {
      const actor = createActor(gameMachine).start();
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
      const actor = createActor(gameMachine).start();
      // Add 8 players
      for (let i = 0; i < 8; i++) {
        actor.send({ type: "ADD_PLAYER", name: `Player${i}` });
      }
      expect(actor.getSnapshot().context.players.length).toBe(8);
      actor.stop();
    });

    it("ADD_PLAYER rejected if already at 8 players", () => {
      const actor = createActor(gameMachine).start();
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
      const actor = createActor(gameMachine).start();
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "ADD_PLAYER", name: "Bob" });
      // 2 players - should not transition
      actor.send({ type: "START_GAME" });
      expect(actor.getSnapshot().value).toBe("setup");
      actor.stop();
    });

    it("rejected if fewer than 3 players", () => {
      const actor = createActor(gameMachine).start();
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
      const actor = createActor(gameMachine).start();
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "ADD_PLAYER", name: "Bob" });
      actor.send({ type: "ADD_PLAYER", name: "Carol" });
      actor.send({ type: "START_GAME" });
      expect(actor.getSnapshot().value).toBe("playing");
      actor.stop();
    });

    it("triggers initializePlayers action", () => {
      const actor = createActor(gameMachine).start();
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
      const actor = createActor(gameMachine).start();
      actor.send({ type: "START_GAME" });
      expect(actor.getSnapshot().value).toBe("setup");
      actor.stop();
    });

    it("rejected with 1 player", () => {
      const actor = createActor(gameMachine).start();
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "START_GAME" });
      expect(actor.getSnapshot().value).toBe("setup");
      actor.stop();
    });

    it("rejected with 2 players", () => {
      const actor = createActor(gameMachine).start();
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "ADD_PLAYER", name: "Bob" });
      actor.send({ type: "START_GAME" });
      expect(actor.getSnapshot().value).toBe("setup");
      actor.stop();
    });

    it.todo("error message: 'minimum 3 players required'", () => {});

    it("remains in 'setup' state on rejection", () => {
      const actor = createActor(gameMachine).start();
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "START_GAME" });
      expect(actor.getSnapshot().value).toBe("setup");
      expect(actor.getSnapshot().context.players.length).toBe(1);
      actor.stop();
    });
  });

  describe("initializePlayers action", () => {
    it("sets initial totalScore to 0 for all players", () => {
      const actor = createActor(gameMachine).start();
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
      const actor = createActor(gameMachine).start();
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
      const actor = createActor(gameMachine).start();
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
      const actor = createActor(gameMachine).start();
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
    it.todo("spawns RoundMachine with current round context", () => {});
    it.todo("passes roundNumber (starts at 1)", () => {});
    it.todo("passes dealerIndex", () => {});
  });

  describe("RoundMachine input", () => {
    it.todo("roundNumber: context.currentRound", () => {});
    it.todo("players: context.players (with current totalScores)", () => {});
    it.todo("dealerIndex: context.dealerIndex", () => {});
  });

  describe("round completion", () => {
    it.todo("when RoundMachine reaches final state", () => {});
    it.todo("receives roundRecord from RoundMachine output", () => {});
    it.todo("adds roundRecord to roundHistory", () => {});
    it.todo("transitions to 'roundEnd' state", () => {});
  });

  describe("roundHistory update", () => {
    it.todo("appends new RoundRecord to existing history", () => {});
    it.todo("preserves all previous round records", () => {});
    it.todo("roundHistory.length increases by 1", () => {});
  });
});

describe("GameMachine - roundEnd state", () => {
  describe("game continuation (rounds 1-5)", () => {
    it.todo("guard 'isGameOver' returns false when currentRound is 1, 2, 3, 4, or 5", () => {});
    it.todo("transitions back to 'playing'", () => {});
    it.todo("incrementRound action fires", () => {});
    it.todo("advanceDealer action fires", () => {});
  });

  describe("incrementRound action", () => {
    it.todo("currentRound increases by 1", () => {});
    it.todo("round progression: 1 -> 2 -> 3 -> 4 -> 5 -> 6", () => {});
    it.todo("after round 6, currentRound becomes 7 (triggers game end)", () => {});
  });

  describe("advanceDealer action", () => {
    it.todo("dealerIndex increases by 1", () => {});
    it.todo("wraps around: (dealerIndex + 1) % playerCount", () => {});
    it.todo("with 4 players: 0 -> 1 -> 2 -> 3 -> 0 -> 1 ...", () => {});
    it.todo("dealer rotates left (clockwise)", () => {});
  });

  describe("game end condition (after round 6)", () => {
    it.todo("guard 'isGameOver' returns true when currentRound > 6", () => {});
    it.todo("incrementRound makes currentRound = 7", () => {});
    it.todo("transitions to 'gameEnd' state", () => {});
  });
});

describe("GameMachine - gameEnd state", () => {
  describe("entering gameEnd", () => {
    it.todo("triggers calculateFinalScores action", () => {});
    it.todo("gameEnd is a final state", () => {});
    it.todo("no further transitions possible", () => {});
    it.todo("no further commands accepted", () => {});
  });

  describe("calculateFinalScores action", () => {
    it.todo("final scores already accumulated in player.totalScore", () => {});
    it.todo("determines winner(s) - lowest total score", () => {});
    it.todo("handles ties (multiple winners)", () => {});
  });

  describe("final state output", () => {
    it.todo("includes final scores for all players", () => {});
    it.todo("includes winner(s) array", () => {});
    it.todo("includes complete roundHistory", () => {});
    it.todo("game is complete", () => {});
  });
});

describe("GameMachine - guards", () => {
  describe("hasMinPlayers", () => {
    it.todo("returns false when players.length < 3", () => {});
    it.todo("returns true when players.length >= 3", () => {});
    it.todo("returns true when players.length === 8", () => {});
  });

  describe("isGameOver", () => {
    it.todo("returns false when currentRound <= 6", () => {});
    it.todo("returns true when currentRound > 6", () => {});
    it.todo("checked in roundEnd state", () => {});
  });
});

describe("GameMachine - context preservation", () => {
  describe("across rounds", () => {
    it.todo("players array persists", () => {});
    it.todo("player.totalScore accumulates", () => {});
    it.todo("roundHistory grows", () => {});
    it.todo("gameId unchanged", () => {});
  });

  describe("player scores", () => {
    it.todo("totalScore updated after each round", () => {});
    it.todo("scores from roundRecord added to player.totalScore", () => {});
    it.todo("cumulative across all 6 rounds", () => {});
  });
});
