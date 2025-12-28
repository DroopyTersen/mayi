/**
 * Game End tests - Phase 5
 *
 * Tests for game end trigger, final score calculation, and winner determination
 */

import { describe, it, expect } from "bun:test";
import { createActor } from "xstate";
import { gameMachine } from "./game.machine";
import type { RoundNumber } from "./engine.types";

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

/**
 * Helper to complete all 6 rounds
 */
function completeAllRounds(
  actor: ReturnType<typeof createGameWithPlayers>,
  roundScores: Array<Record<string, number>>
) {
  for (let round = 1; round <= 6; round++) {
    actor.send({
      type: "ROUND_COMPLETE",
      roundRecord: {
        roundNumber: round as RoundNumber,
        winnerId: "player-0",
        scores: roundScores[round - 1] ?? {},
      },
    });
  }
}

describe("game end trigger", () => {
  describe("after round 6", () => {
    it("given: round 6 completes, isGameOver guard returns true", () => {
      const actor = createGameWithPlayers(4);

      // Complete rounds 1-5
      for (let round = 1; round <= 5; round++) {
        actor.send({
          type: "ROUND_COMPLETE",
          roundRecord: {
            roundNumber: round as RoundNumber,
            winnerId: "player-0",
            scores: {},
          },
        });
      }

      expect(actor.getSnapshot().context.currentRound).toBe(6);
      expect(actor.getSnapshot().value).toBe("playing");

      // Complete round 6
      actor.send({
        type: "ROUND_COMPLETE",
        roundRecord: {
          roundNumber: 6,
          winnerId: "player-0",
          scores: {},
        },
      });

      // Should transition to gameEnd
      expect(actor.getSnapshot().value).toBe("gameEnd");
    });

    it("transitions to gameEnd state", () => {
      const actor = createGameWithPlayers(4);

      // Complete all 6 rounds
      for (let round = 1; round <= 6; round++) {
        actor.send({
          type: "ROUND_COMPLETE",
          roundRecord: {
            roundNumber: round as RoundNumber,
            winnerId: "player-0",
            scores: {},
          },
        });
      }

      expect(actor.getSnapshot().value).toBe("gameEnd");
    });

    it("gameEnd is final state", () => {
      const actor = createGameWithPlayers(4);

      // Complete all 6 rounds
      for (let round = 1; round <= 6; round++) {
        actor.send({
          type: "ROUND_COMPLETE",
          roundRecord: {
            roundNumber: round as RoundNumber,
            winnerId: "player-0",
            scores: {},
          },
        });
      }

      expect(actor.getSnapshot().status).toBe("done");
    });
  });

  describe("not triggered early", () => {
    it("given: rounds 1-5, when: round completes, then: isGameOver returns false", () => {
      const actor = createGameWithPlayers(4);

      for (let round = 1; round <= 5; round++) {
        actor.send({
          type: "ROUND_COMPLETE",
          roundRecord: {
            roundNumber: round as RoundNumber,
            winnerId: "player-0",
            scores: {},
          },
        });

        // Should still be playing, not gameEnd
        expect(actor.getSnapshot().value).toBe("playing");
      }
    });

    it("game continues to next round", () => {
      const actor = createGameWithPlayers(4);

      actor.send({
        type: "ROUND_COMPLETE",
        roundRecord: { roundNumber: 1, winnerId: "player-0", scores: {} },
      });

      expect(actor.getSnapshot().context.currentRound).toBe(2);
      expect(actor.getSnapshot().value).toBe("playing");
    });
  });
});

describe("final score calculation", () => {
  describe("already accumulated", () => {
    it("totalScore already updated after each round", () => {
      const actor = createGameWithPlayers(4);

      // Complete rounds with scores
      const roundScores = [
        { "player-0": 0, "player-1": 30, "player-2": 25, "player-3": 15 },
        { "player-0": 20, "player-1": 0, "player-2": 35, "player-3": 10 },
        { "player-0": 15, "player-1": 25, "player-2": 0, "player-3": 40 },
      ];

      for (let round = 1; round <= 3; round++) {
        actor.send({
          type: "ROUND_COMPLETE",
          roundRecord: {
            roundNumber: round as RoundNumber,
            winnerId: `player-${round % 4}`,
            scores: roundScores[round - 1]!,
          },
        });
      }

      // Verify accumulated scores
      expect(actor.getSnapshot().context.players[0]!.totalScore).toBe(35); // 0 + 20 + 15
      expect(actor.getSnapshot().context.players[1]!.totalScore).toBe(55); // 30 + 0 + 25
      expect(actor.getSnapshot().context.players[2]!.totalScore).toBe(60); // 25 + 35 + 0
      expect(actor.getSnapshot().context.players[3]!.totalScore).toBe(65); // 15 + 10 + 40
    });

    it("no additional calculation needed at game end", () => {
      const actor = createGameWithPlayers(4);

      // Set specific scores through rounds
      for (let round = 1; round <= 6; round++) {
        actor.send({
          type: "ROUND_COMPLETE",
          roundRecord: {
            roundNumber: round as RoundNumber,
            winnerId: "player-0",
            scores: { "player-0": 0, "player-1": 10, "player-2": 10, "player-3": 10 },
          },
        });
      }

      // Player 0: 0, others: 60 each
      expect(actor.getSnapshot().context.players[0]!.totalScore).toBe(0);
      expect(actor.getSnapshot().context.players[1]!.totalScore).toBe(60);
    });
  });

  describe("winner determination", () => {
    it("player(s) with lowest totalScore win", () => {
      const actor = createGameWithPlayers(4);

      // Complete all rounds with player 0 winning (scoring 0 each round)
      for (let round = 1; round <= 6; round++) {
        actor.send({
          type: "ROUND_COMPLETE",
          roundRecord: {
            roundNumber: round as RoundNumber,
            winnerId: "player-0",
            scores: { "player-0": 0, "player-1": 20, "player-2": 30, "player-3": 25 },
          },
        });
      }

      expect(actor.getSnapshot().context.winners).toContain("player-0");
    });

    it("single winner if one player has unique lowest", () => {
      const actor = createGameWithPlayers(4);

      // Player 1 has lowest score
      for (let round = 1; round <= 6; round++) {
        actor.send({
          type: "ROUND_COMPLETE",
          roundRecord: {
            roundNumber: round as RoundNumber,
            winnerId: "player-1",
            scores: { "player-0": 20, "player-1": 0, "player-2": 30, "player-3": 25 },
          },
        });
      }

      expect(actor.getSnapshot().context.winners.length).toBe(1);
      expect(actor.getSnapshot().context.winners[0]).toBe("player-1");
    });
  });
});

describe("determineWinner", () => {
  describe("single winner", () => {
    it("given: final scores { p0: 120, p1: 85, p2: 200, p3: 150 }, then: winner = [p1]", () => {
      const actor = createGameWithPlayers(4);

      // Set up scores so player 1 has lowest (85)
      const scores = [120, 85, 200, 150];
      for (let round = 1; round <= 6; round++) {
        const roundScore = round === 6 ? { "player-0": 20, "player-1": 14, "player-2": 33, "player-3": 25 } : { "player-0": 20, "player-1": 14, "player-2": 33, "player-3": 25 };

        actor.send({
          type: "ROUND_COMPLETE",
          roundRecord: {
            roundNumber: round as RoundNumber,
            winnerId: "player-1",
            scores: roundScore,
          },
        });
      }

      // Player 1 should have lowest score
      const minScore = Math.min(...actor.getSnapshot().context.players.map((p) => p.totalScore));
      const lowestPlayer = actor.getSnapshot().context.players.find((p) => p.totalScore === minScore);
      expect(lowestPlayer!.id).toBe("player-1");
    });
  });

  describe("two-way tie", () => {
    it("given: same lowest scores, both win", () => {
      const actor = createGameWithPlayers(4);

      // Players 0 and 1 tie with lowest score
      for (let round = 1; round <= 6; round++) {
        actor.send({
          type: "ROUND_COMPLETE",
          roundRecord: {
            roundNumber: round as RoundNumber,
            winnerId: round % 2 === 0 ? "player-0" : "player-1",
            scores: { "player-0": 10, "player-1": 10, "player-2": 30, "player-3": 25 },
          },
        });
      }

      expect(actor.getSnapshot().context.winners.length).toBe(2);
      expect(actor.getSnapshot().context.winners).toContain("player-0");
      expect(actor.getSnapshot().context.winners).toContain("player-1");
    });

    it("both have lowest score (same points)", () => {
      const actor = createGameWithPlayers(4);

      for (let round = 1; round <= 6; round++) {
        actor.send({
          type: "ROUND_COMPLETE",
          roundRecord: {
            roundNumber: round as RoundNumber,
            winnerId: "player-0",
            scores: { "player-0": 15, "player-1": 15, "player-2": 30, "player-3": 40 },
          },
        });
      }

      const p0Score = actor.getSnapshot().context.players[0]!.totalScore;
      const p1Score = actor.getSnapshot().context.players[1]!.totalScore;
      expect(p0Score).toBe(p1Score);
    });
  });

  describe("three-way tie", () => {
    it("given: three players with same lowest score, all three win", () => {
      const actor = createGameWithPlayers(4);

      for (let round = 1; round <= 6; round++) {
        actor.send({
          type: "ROUND_COMPLETE",
          roundRecord: {
            roundNumber: round as RoundNumber,
            winnerId: "player-0",
            scores: { "player-0": 10, "player-1": 10, "player-2": 10, "player-3": 40 },
          },
        });
      }

      expect(actor.getSnapshot().context.winners.length).toBe(3);
      expect(actor.getSnapshot().context.winners).toContain("player-0");
      expect(actor.getSnapshot().context.winners).toContain("player-1");
      expect(actor.getSnapshot().context.winners).toContain("player-2");
    });
  });

  describe("all players tie", () => {
    it("given: all players have same score, all win", () => {
      const actor = createGameWithPlayers(4);

      for (let round = 1; round <= 6; round++) {
        actor.send({
          type: "ROUND_COMPLETE",
          roundRecord: {
            roundNumber: round as RoundNumber,
            winnerId: "player-0",
            scores: { "player-0": 25, "player-1": 25, "player-2": 25, "player-3": 25 },
          },
        });
      }

      expect(actor.getSnapshot().context.winners.length).toBe(4);
    });
  });

  describe("perfect game", () => {
    it("given: player went out all 6 rounds, then: totalScore = 0", () => {
      const actor = createGameWithPlayers(4);

      // Player 0 goes out (scores 0) every round
      for (let round = 1; round <= 6; round++) {
        actor.send({
          type: "ROUND_COMPLETE",
          roundRecord: {
            roundNumber: round as RoundNumber,
            winnerId: "player-0",
            scores: { "player-0": 0, "player-1": 30, "player-2": 25, "player-3": 20 },
          },
        });
      }

      expect(actor.getSnapshot().context.players[0]!.totalScore).toBe(0);
      expect(actor.getSnapshot().context.winners).toContain("player-0");
    });
  });
});

describe("gameEnd output", () => {
  describe("final state data", () => {
    it("includes finalScores: map of playerId -> total score", () => {
      const actor = createGameWithPlayers(4);

      for (let round = 1; round <= 6; round++) {
        actor.send({
          type: "ROUND_COMPLETE",
          roundRecord: {
            roundNumber: round as RoundNumber,
            winnerId: "player-0",
            scores: { "player-0": 0, "player-1": 20, "player-2": 30, "player-3": 25 },
          },
        });
      }

      const output = actor.getSnapshot().output;
      expect(output?.finalScores).toBeDefined();
      expect(output?.finalScores["player-0"]).toBe(0);
      expect(output?.finalScores["player-1"]).toBe(120);
      expect(output?.finalScores["player-2"]).toBe(180);
      expect(output?.finalScores["player-3"]).toBe(150);
    });

    it("includes winners: array of winning player IDs", () => {
      const actor = createGameWithPlayers(4);

      for (let round = 1; round <= 6; round++) {
        actor.send({
          type: "ROUND_COMPLETE",
          roundRecord: {
            roundNumber: round as RoundNumber,
            winnerId: "player-0",
            scores: { "player-0": 0, "player-1": 20, "player-2": 30, "player-3": 25 },
          },
        });
      }

      const output = actor.getSnapshot().output;
      expect(output?.winners).toBeDefined();
      expect(Array.isArray(output?.winners)).toBe(true);
      expect(output?.winners).toContain("player-0");
    });
  });

  describe("game completion", () => {
    it("gameEnd is final state", () => {
      const actor = createGameWithPlayers(4);

      for (let round = 1; round <= 6; round++) {
        actor.send({
          type: "ROUND_COMPLETE",
          roundRecord: {
            roundNumber: round as RoundNumber,
            winnerId: "player-0",
            scores: {},
          },
        });
      }

      expect(actor.getSnapshot().status).toBe("done");
      expect(actor.getSnapshot().value).toBe("gameEnd");
    });

    it("no further commands accepted after game ends", () => {
      const actor = createGameWithPlayers(4);

      for (let round = 1; round <= 6; round++) {
        actor.send({
          type: "ROUND_COMPLETE",
          roundRecord: {
            roundNumber: round as RoundNumber,
            winnerId: "player-0",
            scores: {},
          },
        });
      }

      // Game is done
      expect(actor.getSnapshot().status).toBe("done");

      // Sending more events should not change state
      const roundsBefore = actor.getSnapshot().context.roundHistory.length;
      actor.send({
        type: "ROUND_COMPLETE",
        roundRecord: { roundNumber: 1, winnerId: "player-0", scores: {} },
      });
      expect(actor.getSnapshot().context.roundHistory.length).toBe(roundsBefore);
    });
  });
});
