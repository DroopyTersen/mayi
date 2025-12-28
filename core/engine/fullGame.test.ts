/**
 * Full Game tests - Phase 5 Integration
 *
 * End-to-end tests for complete game flow and integration scenarios
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

/**
 * Helper to create a round actor
 */
function createRoundActor(input: RoundInput) {
  const actor = createActor(roundMachine, { input });
  actor.start();
  return actor;
}

describe("full game flow - setup to end", () => {
  describe("game initialization", () => {
    it("when: create new game, add 4 players, START_GAME, then: game transitions to 'playing'", () => {
      const actor = createActor(gameMachine);
      actor.start();

      expect(actor.getSnapshot().value).toBe("setup");

      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "ADD_PLAYER", name: "Bob" });
      actor.send({ type: "ADD_PLAYER", name: "Charlie" });
      actor.send({ type: "ADD_PLAYER", name: "Diana" });

      actor.send({ type: "START_GAME" });

      expect(actor.getSnapshot().value).toBe("playing");
    });

    it("round 1 begins", () => {
      const actor = createGameWithPlayers(4);
      expect(actor.getSnapshot().context.currentRound).toBe(1);
    });

    it("dealer is player 0", () => {
      const actor = createGameWithPlayers(4);
      expect(actor.getSnapshot().context.dealerIndex).toBe(0);
    });

    it("first player is player 1 (left of dealer)", () => {
      // This is determined by RoundMachine when spawned
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 0,
      };
      const roundActor = createRoundActor(input);

      expect(roundActor.getSnapshot().context.currentPlayerIndex).toBe(1);
    });
  });

  describe("round 1 flow", () => {
    it("given: game in round 1, contract is 2 sets", () => {
      const actor = createGameWithPlayers(4);
      expect(CONTRACTS[1]).toEqual({ roundNumber: 1, sets: 2, runs: 0 });
    });

    it("when: cards dealt, players take turns, someone goes out, then: round ends", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 0,
      };
      const roundActor = createRoundActor(input);

      // Simulate player going out
      roundActor.send({
        type: "TURN_COMPLETE",
        wentOut: true,
        playerId: "player-1",
        hand: [],
        stock: roundActor.getSnapshot().context.stock,
        discard: roundActor.getSnapshot().context.discard,
        table: [],
        isDown: true,
      });

      expect(roundActor.getSnapshot().status).toBe("done");
      expect(roundActor.getSnapshot().output?.roundRecord).toBeDefined();
    });

    it("game transitions from round 1 to round 2", () => {
      const actor = createGameWithPlayers(4);

      expect(actor.getSnapshot().context.currentRound).toBe(1);

      actor.send({
        type: "ROUND_COMPLETE",
        roundRecord: { roundNumber: 1, winnerId: "player-0", scores: {} },
      });

      expect(actor.getSnapshot().context.currentRound).toBe(2);
    });
  });

  describe("full 6 rounds", () => {
    it("round progression: contracts and dealers advance correctly", () => {
      const actor = createGameWithPlayers(4);

      // Verify initial state
      expect(actor.getSnapshot().context.currentRound).toBe(1);
      expect(actor.getSnapshot().context.dealerIndex).toBe(0);

      // Complete all 6 rounds
      for (let round = 1; round <= 6; round++) {
        // Verify contract for current round
        expect(CONTRACTS[round as RoundNumber]).toBeDefined();

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
  });

  describe("score accumulation through game", () => {
    it("scores accumulate across all 6 rounds", () => {
      const actor = createGameWithPlayers(4);

      const roundScores = [
        { "player-0": 0, "player-1": 20, "player-2": 30, "player-3": 25 },
        { "player-0": 15, "player-1": 0, "player-2": 25, "player-3": 30 },
        { "player-0": 10, "player-1": 15, "player-2": 0, "player-3": 20 },
        { "player-0": 25, "player-1": 30, "player-2": 15, "player-3": 0 },
        { "player-0": 0, "player-1": 10, "player-2": 20, "player-3": 15 },
        { "player-0": 20, "player-1": 0, "player-2": 10, "player-3": 15 },
      ];

      for (let round = 1; round <= 6; round++) {
        actor.send({
          type: "ROUND_COMPLETE",
          roundRecord: {
            roundNumber: round as RoundNumber,
            winnerId: `player-${(round - 1) % 4}`,
            scores: roundScores[round - 1]!,
          },
        });
      }

      // Verify final scores
      expect(actor.getSnapshot().context.players[0]!.totalScore).toBe(70); // 0+15+10+25+0+20
      expect(actor.getSnapshot().context.players[1]!.totalScore).toBe(75); // 20+0+15+30+10+0
    });
  });
});

describe("single round flow", () => {
  describe("dealing phase", () => {
    it("when: round starts, then: deck created for player count", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 0,
      };
      const actor = createRoundActor(input);

      // 4 players = 108 cards total
      const totalCards =
        actor.getSnapshot().context.players.reduce((sum, p) => sum + p.hand.length, 0) +
        actor.getSnapshot().context.stock.length +
        actor.getSnapshot().context.discard.length;

      expect(totalCards).toBe(108);
    });

    it("deck shuffled, 11 cards dealt to each player", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(5),
        dealerIndex: 0,
      };
      const actor = createRoundActor(input);

      actor.getSnapshot().context.players.forEach((player) => {
        expect(player.hand.length).toBe(11);
      });
    });

    it("first discard flipped, transition to active", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 0,
      };
      const actor = createRoundActor(input);

      expect(actor.getSnapshot().context.discard.length).toBe(1);
      expect(actor.getSnapshot().value).toBe("active");
    });
  });

  describe("active phase - turns", () => {
    it("player takes their turn, turn completes (wentOut: false), advance to next", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 0,
      };
      const actor = createRoundActor(input);

      expect(actor.getSnapshot().context.currentPlayerIndex).toBe(1);

      actor.send({
        type: "TURN_COMPLETE",
        wentOut: false,
        playerId: "player-1",
        hand: actor.getSnapshot().context.players[1]!.hand,
        stock: actor.getSnapshot().context.stock,
        discard: actor.getSnapshot().context.discard,
        table: [],
        isDown: false,
      });

      expect(actor.getSnapshot().context.currentPlayerIndex).toBe(2);
    });

    it("repeat until someone goes out", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 3, // First player is 0
      };
      const actor = createRoundActor(input);

      // Complete a few turns
      for (let turn = 0; turn < 8; turn++) {
        const currentIdx = actor.getSnapshot().context.currentPlayerIndex;
        actor.send({
          type: "TURN_COMPLETE",
          wentOut: false,
          playerId: `player-${currentIdx}`,
          hand: actor.getSnapshot().context.players[currentIdx]!.hand,
          stock: actor.getSnapshot().context.stock,
          discard: actor.getSnapshot().context.discard,
          table: [],
          isDown: false,
        });
      }

      // Still in active state
      expect(actor.getSnapshot().value).toBe("active");

      // Now someone goes out
      const currentIdx = actor.getSnapshot().context.currentPlayerIndex;
      actor.send({
        type: "TURN_COMPLETE",
        wentOut: true,
        playerId: `player-${currentIdx}`,
        hand: [],
        stock: actor.getSnapshot().context.stock,
        discard: actor.getSnapshot().context.discard,
        table: [],
        isDown: true,
      });

      expect(actor.getSnapshot().value).toBe("scoring");
    });
  });

  describe("scoring phase", () => {
    it("when: player goes out (wentOut: true), then: transition to scoring", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 0,
      };
      const actor = createRoundActor(input);

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

      expect(actor.getSnapshot().value).toBe("scoring");
    });

    it("calculate all player scores, create RoundRecord, output to parent", () => {
      const input: RoundInput = {
        roundNumber: 3,
        players: createTestPlayers(4),
        dealerIndex: 0,
      };
      const actor = createRoundActor(input);

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

      const output = actor.getSnapshot().output;
      expect(output?.roundRecord).toBeDefined();
      expect(output?.roundRecord.roundNumber).toBe(3);
      expect(output?.roundRecord.winnerId).toBe("player-1");
      expect(output?.roundRecord.scores["player-1"]).toBe(0);
    });
  });
});

describe("turn sequencing within round", () => {
  describe("normal progression", () => {
    it("given: 4 players, first player = 1, turn 1: player 1, turn 2: player 2, ...", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 0,
      };
      const actor = createRoundActor(input);

      const turnOrder: number[] = [];

      for (let turn = 0; turn < 8; turn++) {
        turnOrder.push(actor.getSnapshot().context.currentPlayerIndex);
        const currentIdx = actor.getSnapshot().context.currentPlayerIndex;
        actor.send({
          type: "TURN_COMPLETE",
          wentOut: false,
          playerId: `player-${currentIdx}`,
          hand: actor.getSnapshot().context.players[currentIdx]!.hand,
          stock: actor.getSnapshot().context.stock,
          discard: actor.getSnapshot().context.discard,
          table: [],
          isDown: false,
        });
      }

      expect(turnOrder).toEqual([1, 2, 3, 0, 1, 2, 3, 0]);
    });

    it("continues until someone goes out", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 0,
      };
      const actor = createRoundActor(input);

      // 12 turns without going out
      for (let turn = 0; turn < 12; turn++) {
        expect(actor.getSnapshot().value).toBe("active");
        const currentIdx = actor.getSnapshot().context.currentPlayerIndex;
        actor.send({
          type: "TURN_COMPLETE",
          wentOut: false,
          playerId: `player-${currentIdx}`,
          hand: actor.getSnapshot().context.players[currentIdx]!.hand,
          stock: actor.getSnapshot().context.stock,
          discard: actor.getSnapshot().context.discard,
          table: [],
          isDown: false,
        });
      }

      expect(actor.getSnapshot().value).toBe("active");
    });
  });

  describe("multiple rotations", () => {
    it("players may go around multiple times", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 0,
      };
      const actor = createRoundActor(input);

      // 3 full rotations = 12 turns
      for (let turn = 0; turn < 12; turn++) {
        const currentIdx = actor.getSnapshot().context.currentPlayerIndex;
        actor.send({
          type: "TURN_COMPLETE",
          wentOut: false,
          playerId: `player-${currentIdx}`,
          hand: actor.getSnapshot().context.players[currentIdx]!.hand,
          stock: actor.getSnapshot().context.stock,
          discard: actor.getSnapshot().context.discard,
          table: [],
          isDown: false,
        });
      }

      // Should still be in active state
      expect(actor.getSnapshot().value).toBe("active");
    });

    it("round ends when any player goes out", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 0,
      };
      const actor = createRoundActor(input);

      // 5 turns, then player 2 goes out
      for (let turn = 0; turn < 5; turn++) {
        const currentIdx = actor.getSnapshot().context.currentPlayerIndex;
        actor.send({
          type: "TURN_COMPLETE",
          wentOut: false,
          playerId: `player-${currentIdx}`,
          hand: actor.getSnapshot().context.players[currentIdx]!.hand,
          stock: actor.getSnapshot().context.stock,
          discard: actor.getSnapshot().context.discard,
          table: [],
          isDown: false,
        });
      }

      const currentIdx = actor.getSnapshot().context.currentPlayerIndex;
      actor.send({
        type: "TURN_COMPLETE",
        wentOut: true,
        playerId: `player-${currentIdx}`,
        hand: [],
        stock: actor.getSnapshot().context.stock,
        discard: actor.getSnapshot().context.discard,
        table: [],
        isDown: true,
      });

      expect(actor.getSnapshot().value).toBe("scoring");
    });
  });
});

describe("dealer and first player tracking", () => {
  describe("round 1", () => {
    it("given: initial dealer = 0, then: first player = 1", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 0,
      };
      const actor = createRoundActor(input);

      expect(actor.getSnapshot().context.currentPlayerIndex).toBe(1);
    });

    it("turn order: 1, 2, 3, 0, 1, 2, ...", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 0,
      };
      const actor = createRoundActor(input);

      const turnOrder: number[] = [];
      for (let i = 0; i < 6; i++) {
        turnOrder.push(actor.getSnapshot().context.currentPlayerIndex);
        const currentIdx = actor.getSnapshot().context.currentPlayerIndex;
        actor.send({
          type: "TURN_COMPLETE",
          wentOut: false,
          playerId: `player-${currentIdx}`,
          hand: actor.getSnapshot().context.players[currentIdx]!.hand,
          stock: actor.getSnapshot().context.stock,
          discard: actor.getSnapshot().context.discard,
          table: [],
          isDown: false,
        });
      }

      expect(turnOrder).toEqual([1, 2, 3, 0, 1, 2]);
    });
  });

  describe("round 2", () => {
    it("given: dealer advances to 1, then: first player = 2", () => {
      const input: RoundInput = {
        roundNumber: 2,
        players: createTestPlayers(4),
        dealerIndex: 1,
      };
      const actor = createRoundActor(input);

      expect(actor.getSnapshot().context.currentPlayerIndex).toBe(2);
    });

    it("turn order: 2, 3, 0, 1, 2, 3, ...", () => {
      const input: RoundInput = {
        roundNumber: 2,
        players: createTestPlayers(4),
        dealerIndex: 1,
      };
      const actor = createRoundActor(input);

      const turnOrder: number[] = [];
      for (let i = 0; i < 6; i++) {
        turnOrder.push(actor.getSnapshot().context.currentPlayerIndex);
        const currentIdx = actor.getSnapshot().context.currentPlayerIndex;
        actor.send({
          type: "TURN_COMPLETE",
          wentOut: false,
          playerId: `player-${currentIdx}`,
          hand: actor.getSnapshot().context.players[currentIdx]!.hand,
          stock: actor.getSnapshot().context.stock,
          discard: actor.getSnapshot().context.discard,
          table: [],
          isDown: false,
        });
      }

      expect(turnOrder).toEqual([2, 3, 0, 1, 2, 3]);
    });
  });

  describe("tracking across rounds", () => {
    it("dealer advances each round in GameMachine", () => {
      const actor = createGameWithPlayers(4);

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

      expect(dealerProgression).toEqual([0, 1, 2, 3, 0, 1]);
    });
  });
});

describe("state persistence between turns", () => {
  describe("hand changes", () => {
    it("after each turn, player's hand updated", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 0,
      };
      const actor = createRoundActor(input);

      const initialHandSize = actor.getSnapshot().context.players[1]!.hand.length;
      expect(initialHandSize).toBe(11);

      // Player 1 takes turn and reduces hand by 2 cards (laid down)
      const newHand = actor.getSnapshot().context.players[1]!.hand.slice(0, 9);
      actor.send({
        type: "TURN_COMPLETE",
        wentOut: false,
        playerId: "player-1",
        hand: newHand,
        stock: actor.getSnapshot().context.stock,
        discard: actor.getSnapshot().context.discard,
        table: [],
        isDown: false,
      });

      expect(actor.getSnapshot().context.players[1]!.hand.length).toBe(9);
    });

    it("changes persist to next turn", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 0,
      };
      const actor = createRoundActor(input);

      // Player 1 reduces hand
      actor.send({
        type: "TURN_COMPLETE",
        wentOut: false,
        playerId: "player-1",
        hand: actor.getSnapshot().context.players[1]!.hand.slice(0, 8),
        stock: actor.getSnapshot().context.stock,
        discard: actor.getSnapshot().context.discard,
        table: [],
        isDown: false,
      });

      // Player 2's turn
      actor.send({
        type: "TURN_COMPLETE",
        wentOut: false,
        playerId: "player-2",
        hand: actor.getSnapshot().context.players[2]!.hand,
        stock: actor.getSnapshot().context.stock,
        discard: actor.getSnapshot().context.discard,
        table: [],
        isDown: false,
      });

      // Player 1's hand change should persist
      expect(actor.getSnapshot().context.players[1]!.hand.length).toBe(8);
    });
  });

  describe("table changes", () => {
    it("melds added when players lay down", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 0,
      };
      const actor = createRoundActor(input);

      expect(actor.getSnapshot().context.table.length).toBe(0);

      const meld = {
        id: "meld-1",
        type: "set" as const,
        cards: actor.getSnapshot().context.players[1]!.hand.slice(0, 3),
        ownerId: "player-1",
      };

      actor.send({
        type: "TURN_COMPLETE",
        wentOut: false,
        playerId: "player-1",
        hand: actor.getSnapshot().context.players[1]!.hand.slice(3),
        stock: actor.getSnapshot().context.stock,
        discard: actor.getSnapshot().context.discard,
        table: [meld],
        isDown: true,
      });

      expect(actor.getSnapshot().context.table.length).toBe(1);
    });

    it("changes persist until round ends", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 0,
      };
      const actor = createRoundActor(input);

      const meld = {
        id: "meld-1",
        type: "set" as const,
        cards: actor.getSnapshot().context.players[1]!.hand.slice(0, 3),
        ownerId: "player-1",
      };

      actor.send({
        type: "TURN_COMPLETE",
        wentOut: false,
        playerId: "player-1",
        hand: actor.getSnapshot().context.players[1]!.hand.slice(3),
        stock: actor.getSnapshot().context.stock,
        discard: actor.getSnapshot().context.discard,
        table: [meld],
        isDown: true,
      });

      // More turns
      for (let i = 0; i < 3; i++) {
        const currentIdx = actor.getSnapshot().context.currentPlayerIndex;
        actor.send({
          type: "TURN_COMPLETE",
          wentOut: false,
          playerId: `player-${currentIdx}`,
          hand: actor.getSnapshot().context.players[currentIdx]!.hand,
          stock: actor.getSnapshot().context.stock,
          discard: actor.getSnapshot().context.discard,
          table: actor.getSnapshot().context.table, // Keep existing table
          isDown: false,
        });
      }

      expect(actor.getSnapshot().context.table.length).toBe(1);
    });
  });

  describe("stock and discard changes", () => {
    it("stock decreases with draws", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 0,
      };
      const actor = createRoundActor(input);

      const initialStockSize = actor.getSnapshot().context.stock.length;

      // Simulate drawing 1 card from stock
      const newStock = actor.getSnapshot().context.stock.slice(1);

      actor.send({
        type: "TURN_COMPLETE",
        wentOut: false,
        playerId: "player-1",
        hand: actor.getSnapshot().context.players[1]!.hand,
        stock: newStock,
        discard: actor.getSnapshot().context.discard,
        table: [],
        isDown: false,
      });

      expect(actor.getSnapshot().context.stock.length).toBe(initialStockSize - 1);
    });

    it("discard changes with discards", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 0,
      };
      const actor = createRoundActor(input);

      const initialDiscardSize = actor.getSnapshot().context.discard.length;
      const cardToDiscard = actor.getSnapshot().context.players[1]!.hand[0]!;
      const newDiscard = [...actor.getSnapshot().context.discard, cardToDiscard];

      actor.send({
        type: "TURN_COMPLETE",
        wentOut: false,
        playerId: "player-1",
        hand: actor.getSnapshot().context.players[1]!.hand.slice(1),
        stock: actor.getSnapshot().context.stock,
        discard: newDiscard,
        table: [],
        isDown: false,
      });

      expect(actor.getSnapshot().context.discard.length).toBe(initialDiscardSize + 1);
    });

    it("state accurate for each turn", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 0,
      };
      const actor = createRoundActor(input);

      // Track changes across multiple turns
      let currentStock = actor.getSnapshot().context.stock.length;
      let currentDiscard = actor.getSnapshot().context.discard.length;

      for (let turn = 0; turn < 4; turn++) {
        const snapshot = actor.getSnapshot();
        const currentIdx = snapshot.context.currentPlayerIndex;

        // Simulate draw from stock and discard one card
        const newStock = snapshot.context.stock.slice(1);
        const newDiscard = [...snapshot.context.discard, snapshot.context.players[currentIdx]!.hand[0]!];

        actor.send({
          type: "TURN_COMPLETE",
          wentOut: false,
          playerId: `player-${currentIdx}`,
          hand: snapshot.context.players[currentIdx]!.hand.slice(1),
          stock: newStock,
          discard: newDiscard,
          table: [],
          isDown: false,
        });

        // Verify changes
        expect(actor.getSnapshot().context.stock.length).toBe(currentStock - 1);
        expect(actor.getSnapshot().context.discard.length).toBe(currentDiscard + 1);

        currentStock = actor.getSnapshot().context.stock.length;
        currentDiscard = actor.getSnapshot().context.discard.length;
      }
    });
  });
});

describe("edge cases", () => {
  describe("quick round - going out on first turn", () => {
    it("given: player 1 goes out immediately, then: round ends after just 1 turn", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 0, // First player is 1
      };
      const actor = createRoundActor(input);

      // Player 1 goes out immediately
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

      expect(actor.getSnapshot().value).toBe("scoring");
      expect(actor.getSnapshot().status).toBe("done");
    });

    it("other players still have 11 cards in hand when scored", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 0,
      };
      const actor = createRoundActor(input);

      // Player 1 goes out immediately
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

      // Other players (0, 2, 3) still have their original hands
      expect(actor.getSnapshot().context.players[0]!.hand.length).toBe(11);
      expect(actor.getSnapshot().context.players[2]!.hand.length).toBe(11);
      expect(actor.getSnapshot().context.players[3]!.hand.length).toBe(11);
    });

    it("winner (player who went out) scores 0", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 0,
      };
      const actor = createRoundActor(input);

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

      const output = actor.getSnapshot().output;
      expect(output?.roundRecord.scores["player-1"]).toBe(0);
      expect(output?.roundRecord.winnerId).toBe("player-1");
    });
  });

  describe("long round - many rotations", () => {
    it("turns continue for many rotations", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 0,
      };
      const actor = createRoundActor(input);

      // Complete 20 turns (5 full rotations)
      for (let turn = 0; turn < 20; turn++) {
        const currentIdx = actor.getSnapshot().context.currentPlayerIndex;
        actor.send({
          type: "TURN_COMPLETE",
          wentOut: false,
          playerId: `player-${currentIdx}`,
          hand: actor.getSnapshot().context.players[currentIdx]!.hand,
          stock: actor.getSnapshot().context.stock,
          discard: actor.getSnapshot().context.discard,
          table: [],
          isDown: false,
        });
      }

      expect(actor.getSnapshot().value).toBe("active");
    });

    it("eventually someone goes out and round ends", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 0,
      };
      const actor = createRoundActor(input);

      // 15 turns without going out
      for (let turn = 0; turn < 15; turn++) {
        const currentIdx = actor.getSnapshot().context.currentPlayerIndex;
        actor.send({
          type: "TURN_COMPLETE",
          wentOut: false,
          playerId: `player-${currentIdx}`,
          hand: actor.getSnapshot().context.players[currentIdx]!.hand,
          stock: actor.getSnapshot().context.stock,
          discard: actor.getSnapshot().context.discard,
          table: [],
          isDown: false,
        });
      }

      // Now someone goes out
      const currentIdx = actor.getSnapshot().context.currentPlayerIndex;
      actor.send({
        type: "TURN_COMPLETE",
        wentOut: true,
        playerId: `player-${currentIdx}`,
        hand: [],
        stock: actor.getSnapshot().context.stock,
        discard: actor.getSnapshot().context.discard,
        table: [],
        isDown: true,
      });

      expect(actor.getSnapshot().value).toBe("scoring");
    });
  });

  describe("stock depletion during round", () => {
    it.todo("given: many draws, when: stock runs out, then: reshuffle triggered (TurnMachine integration)", () => {});
  });

  describe("minimum length game", () => {
    it("given: one player goes out every round, game has exactly 6 rounds", () => {
      const actor = createGameWithPlayers(4);

      for (let round = 1; round <= 6; round++) {
        actor.send({
          type: "ROUND_COMPLETE",
          roundRecord: {
            roundNumber: round as RoundNumber,
            winnerId: "player-0",
            scores: { "player-0": 0, "player-1": 50, "player-2": 50, "player-3": 50 },
          },
        });
      }

      expect(actor.getSnapshot().value).toBe("gameEnd");
      expect(actor.getSnapshot().context.roundHistory.length).toBe(6);
    });
  });
});

describe("contract enforcement per round", () => {
  describe("round 1", () => {
    it.todo("players must lay down 2 sets to go down", () => {});
    it.todo("1 set insufficient", () => {});
    it.todo("sets + runs insufficient (wrong combination)", () => {});
  });

  describe("round 2", () => {
    it.todo("players must lay down 1 set + 1 run", () => {});
    it.todo("2 sets insufficient, 2 runs insufficient", () => {});
  });

  describe("round 3", () => {
    it.todo("players must lay down 2 runs, sets not accepted", () => {});
  });

  describe("round 4", () => {
    it.todo("players must lay down 3 sets", () => {});
  });

  describe("round 5", () => {
    it.todo("players must lay down 2 sets + 1 run", () => {});
  });

  describe("round 6", () => {
    it.todo("players must lay down 1 set + 2 runs", () => {});
    it.todo("minimum 11 cards required, special going out rules (no discard)", () => {});
  });
});

describe("complete game simulation", () => {
  describe("4 player game", () => {
    it("given: 4 players, when: game played to completion, then: winner determined", () => {
      const actor = createGameWithPlayers(4);

      // Complete all 6 rounds with varying scores
      const roundScores = [
        { "player-0": 0, "player-1": 30, "player-2": 25, "player-3": 20 },
        { "player-0": 25, "player-1": 0, "player-2": 30, "player-3": 15 },
        { "player-0": 15, "player-1": 20, "player-2": 0, "player-3": 30 },
        { "player-0": 20, "player-1": 25, "player-2": 30, "player-3": 0 },
        { "player-0": 0, "player-1": 15, "player-2": 20, "player-3": 25 },
        { "player-0": 10, "player-1": 0, "player-2": 15, "player-3": 20 },
      ];

      for (let round = 1; round <= 6; round++) {
        actor.send({
          type: "ROUND_COMPLETE",
          roundRecord: {
            roundNumber: round as RoundNumber,
            winnerId: `player-${(round - 1) % 4}`,
            scores: roundScores[round - 1]!,
          },
        });
      }

      expect(actor.getSnapshot().value).toBe("gameEnd");
      expect(actor.getSnapshot().context.winners.length).toBeGreaterThan(0);
    });

    it("roundHistory has 6 entries after game completion", () => {
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

      expect(actor.getSnapshot().context.roundHistory.length).toBe(6);
    });

    it("game ends in 'gameEnd' state", () => {
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

      expect(actor.getSnapshot().value).toBe("gameEnd");
      expect(actor.getSnapshot().status).toBe("done");
    });
  });

  describe("3 player game (minimum)", () => {
    it("given: 3 players, uses 108 card deck", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(3),
        dealerIndex: 0,
      };
      const actor = createRoundActor(input);

      // 3 players * 11 cards + stock + 1 discard = 108
      const totalCards =
        actor.getSnapshot().context.players.reduce((sum, p) => sum + p.hand.length, 0) +
        actor.getSnapshot().context.stock.length +
        actor.getSnapshot().context.discard.length;

      expect(totalCards).toBe(108);
    });

    it("all 6 rounds completed, winner determined", () => {
      const actor = createActor(gameMachine);
      actor.start();

      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "ADD_PLAYER", name: "Bob" });
      actor.send({ type: "ADD_PLAYER", name: "Charlie" });
      actor.send({ type: "START_GAME" });

      for (let round = 1; round <= 6; round++) {
        actor.send({
          type: "ROUND_COMPLETE",
          roundRecord: {
            roundNumber: round as RoundNumber,
            winnerId: "player-0",
            scores: { "player-0": 0, "player-1": 30, "player-2": 25 },
          },
        });
      }

      expect(actor.getSnapshot().value).toBe("gameEnd");
      expect(actor.getSnapshot().context.winners).toContain("player-0");
    });
  });

  describe("8 player game (maximum)", () => {
    it("given: 8 players, uses 162 card deck", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(8),
        dealerIndex: 0,
      };
      const actor = createRoundActor(input);

      // 8 players * 11 cards + stock + 1 discard = 162
      const totalCards =
        actor.getSnapshot().context.players.reduce((sum, p) => sum + p.hand.length, 0) +
        actor.getSnapshot().context.stock.length +
        actor.getSnapshot().context.discard.length;

      expect(totalCards).toBe(162);
    });

    it("all 6 rounds completed, winner determined", () => {
      const actor = createActor(gameMachine);
      actor.start();

      for (let i = 0; i < 8; i++) {
        actor.send({ type: "ADD_PLAYER", name: `Player ${i}` });
      }
      actor.send({ type: "START_GAME" });

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
      expect(actor.getSnapshot().context.winners.length).toBeGreaterThan(0);
    });
  });
});

describe("game state at each phase", () => {
  describe("setup", () => {
    it("players being added, game not started, no rounds played", () => {
      const actor = createActor(gameMachine);
      actor.start();

      expect(actor.getSnapshot().value).toBe("setup");
      expect(actor.getSnapshot().context.players.length).toBe(0);
      expect(actor.getSnapshot().context.roundHistory.length).toBe(0);

      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "ADD_PLAYER", name: "Bob" });

      expect(actor.getSnapshot().value).toBe("setup");
      expect(actor.getSnapshot().context.players.length).toBe(2);
    });
  });

  describe("playing (mid-round)", () => {
    it("currentRound set when game starts", () => {
      const actor = createGameWithPlayers(4);
      expect(actor.getSnapshot().value).toBe("playing");
      expect(actor.getSnapshot().context.currentRound).toBe(1);
    });

    it("cards dealt at round start (via RoundMachine)", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 0,
      };
      const actor = createRoundActor(input);

      // All players have 11 cards
      actor.getSnapshot().context.players.forEach((p) => {
        expect(p.hand.length).toBe(11);
      });
    });

    it("turns in progress, melds may be on table", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 0,
      };
      const actor = createRoundActor(input);

      expect(actor.getSnapshot().value).toBe("active");
      expect(actor.getSnapshot().context.table.length).toBe(0);

      // Add a meld
      const meld = {
        id: "meld-1",
        type: "set" as const,
        cards: actor.getSnapshot().context.players[1]!.hand.slice(0, 3),
        ownerId: "player-1",
      };

      actor.send({
        type: "TURN_COMPLETE",
        wentOut: false,
        playerId: "player-1",
        hand: actor.getSnapshot().context.players[1]!.hand.slice(3),
        stock: actor.getSnapshot().context.stock,
        discard: actor.getSnapshot().context.discard,
        table: [meld],
        isDown: true,
      });

      expect(actor.getSnapshot().context.table.length).toBe(1);
    });
  });

  describe("roundEnd (between rounds)", () => {
    it("round just completed, scores calculated", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 0,
      };
      const actor = createRoundActor(input);

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

      expect(actor.getSnapshot().value).toBe("scoring");
      expect(actor.getSnapshot().output?.roundRecord.scores).toBeDefined();
    });

    it("GameMachine advances to next round after ROUND_COMPLETE", () => {
      const actor = createGameWithPlayers(4);

      expect(actor.getSnapshot().context.currentRound).toBe(1);

      actor.send({
        type: "ROUND_COMPLETE",
        roundRecord: { roundNumber: 1, winnerId: "player-0", scores: {} },
      });

      expect(actor.getSnapshot().context.currentRound).toBe(2);
      expect(actor.getSnapshot().value).toBe("playing");
    });
  });

  describe("gameEnd", () => {
    it("all 6 rounds complete, final scores set", () => {
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

      expect(actor.getSnapshot().value).toBe("gameEnd");
      expect(actor.getSnapshot().context.players[0]!.totalScore).toBe(0);
      expect(actor.getSnapshot().context.players[1]!.totalScore).toBe(120);
    });

    it("winners determined, game over", () => {
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

      expect(actor.getSnapshot().context.winners).toContain("player-0");
      expect(actor.getSnapshot().status).toBe("done");
    });
  });
});

describe("roundHistory completeness", () => {
  describe("after each round", () => {
    it("roundHistory grows after each round", () => {
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
        expect(actor.getSnapshot().context.roundHistory.length).toBe(round);
      }
    });
  });

  describe("record contents", () => {
    it("each record has roundNumber", () => {
      const actor = createGameWithPlayers(4);

      for (let round = 1; round <= 3; round++) {
        actor.send({
          type: "ROUND_COMPLETE",
          roundRecord: {
            roundNumber: round as RoundNumber,
            winnerId: "player-0",
            scores: {},
          },
        });
      }

      actor.getSnapshot().context.roundHistory.forEach((record, idx) => {
        expect(record.roundNumber).toBe(idx + 1);
      });
    });

    it("each record has scores for all players", () => {
      const actor = createGameWithPlayers(4);

      actor.send({
        type: "ROUND_COMPLETE",
        roundRecord: {
          roundNumber: 1,
          winnerId: "player-0",
          scores: { "player-0": 0, "player-1": 20, "player-2": 30, "player-3": 25 },
        },
      });

      const record = actor.getSnapshot().context.roundHistory[0]!;
      expect(record.scores["player-0"]).toBe(0);
      expect(record.scores["player-1"]).toBe(20);
      expect(record.scores["player-2"]).toBe(30);
      expect(record.scores["player-3"]).toBe(25);
    });

    it("each record has winnerId (who went out)", () => {
      const actor = createGameWithPlayers(4);

      actor.send({
        type: "ROUND_COMPLETE",
        roundRecord: {
          roundNumber: 1,
          winnerId: "player-2",
          scores: { "player-0": 20, "player-1": 20, "player-2": 0, "player-3": 25 },
        },
      });

      const record = actor.getSnapshot().context.roundHistory[0]!;
      expect(record.winnerId).toBe("player-2");
    });
  });

  describe("can reconstruct game", () => {
    it("sum of round scores = total score", () => {
      const actor = createGameWithPlayers(4);

      const roundScores = [
        { "player-0": 0, "player-1": 20, "player-2": 30, "player-3": 25 },
        { "player-0": 15, "player-1": 0, "player-2": 25, "player-3": 30 },
        { "player-0": 20, "player-1": 25, "player-2": 0, "player-3": 15 },
      ];

      for (let round = 1; round <= 3; round++) {
        actor.send({
          type: "ROUND_COMPLETE",
          roundRecord: {
            roundNumber: round as RoundNumber,
            winnerId: `player-${(round - 1) % 4}`,
            scores: roundScores[round - 1]!,
          },
        });
      }

      // Calculate expected totals from history
      const expectedTotals: Record<string, number> = {};
      actor.getSnapshot().context.roundHistory.forEach((record) => {
        for (const [playerId, score] of Object.entries(record.scores)) {
          expectedTotals[playerId] = (expectedTotals[playerId] ?? 0) + score;
        }
      });

      // Verify against actual totals
      expect(actor.getSnapshot().context.players[0]!.totalScore).toBe(expectedTotals["player-0"]);
      expect(actor.getSnapshot().context.players[1]!.totalScore).toBe(expectedTotals["player-1"]);
      expect(actor.getSnapshot().context.players[2]!.totalScore).toBe(expectedTotals["player-2"]);
      expect(actor.getSnapshot().context.players[3]!.totalScore).toBe(expectedTotals["player-3"]);
    });

    it("can identify who won each round", () => {
      const actor = createGameWithPlayers(4);

      const winners = ["player-0", "player-2", "player-1", "player-3"];

      for (let round = 1; round <= 4; round++) {
        actor.send({
          type: "ROUND_COMPLETE",
          roundRecord: {
            roundNumber: round as RoundNumber,
            winnerId: winners[round - 1]!,
            scores: {},
          },
        });
      }

      const history = actor.getSnapshot().context.roundHistory;
      expect(history[0]!.winnerId).toBe("player-0");
      expect(history[1]!.winnerId).toBe("player-2");
      expect(history[2]!.winnerId).toBe("player-1");
      expect(history[3]!.winnerId).toBe("player-3");
    });

    it("full audit trail available", () => {
      const actor = createGameWithPlayers(4);

      for (let round = 1; round <= 6; round++) {
        actor.send({
          type: "ROUND_COMPLETE",
          roundRecord: {
            roundNumber: round as RoundNumber,
            winnerId: `player-${(round - 1) % 4}`,
            scores: {
              "player-0": round * 5,
              "player-1": round * 10,
              "player-2": round * 15,
              "player-3": round * 20,
            },
          },
        });
      }

      const history = actor.getSnapshot().context.roundHistory;
      expect(history.length).toBe(6);

      // Can trace through entire game
      history.forEach((record, idx) => {
        expect(record.roundNumber).toBe(idx + 1);
        expect(record.winnerId).toBeDefined();
        expect(record.scores).toBeDefined();
      });
    });
  });
});

describe("error handling", () => {
  describe("invalid commands in setup", () => {
    it("START_GAME with < 3 players rejected (stays in setup)", () => {
      const actor = createActor(gameMachine);
      actor.start();

      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "ADD_PLAYER", name: "Bob" });

      expect(actor.getSnapshot().context.players.length).toBe(2);
      actor.send({ type: "START_GAME" });

      // Should stay in setup
      expect(actor.getSnapshot().value).toBe("setup");
    });

    it("ADD_PLAYER with > 8 players rejected", () => {
      const actor = createActor(gameMachine);
      actor.start();

      // Add 8 players
      for (let i = 0; i < 8; i++) {
        actor.send({ type: "ADD_PLAYER", name: `Player ${i}` });
      }
      expect(actor.getSnapshot().context.players.length).toBe(8);

      // Try to add 9th player
      actor.send({ type: "ADD_PLAYER", name: "Player 9" });

      // Should still be 8
      expect(actor.getSnapshot().context.players.length).toBe(8);
    });

    it("game stays in setup until valid start", () => {
      const actor = createActor(gameMachine);
      actor.start();

      // Only 1 player
      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "START_GAME" });
      expect(actor.getSnapshot().value).toBe("setup");

      // 2 players - still not enough
      actor.send({ type: "ADD_PLAYER", name: "Bob" });
      actor.send({ type: "START_GAME" });
      expect(actor.getSnapshot().value).toBe("setup");

      // 3 players - now valid
      actor.send({ type: "ADD_PLAYER", name: "Charlie" });
      actor.send({ type: "START_GAME" });
      expect(actor.getSnapshot().value).toBe("playing");
    });
  });

  describe("commands in wrong state", () => {
    it("ADD_PLAYER rejected after game started", () => {
      const actor = createGameWithPlayers(4);

      expect(actor.getSnapshot().value).toBe("playing");
      const playerCountBefore = actor.getSnapshot().context.players.length;

      actor.send({ type: "ADD_PLAYER", name: "NewPlayer" });

      expect(actor.getSnapshot().context.players.length).toBe(playerCountBefore);
    });

    it("START_GAME has no effect when already playing", () => {
      const actor = createGameWithPlayers(4);

      expect(actor.getSnapshot().value).toBe("playing");
      expect(actor.getSnapshot().context.currentRound).toBe(1);

      actor.send({ type: "START_GAME" });

      // State unchanged
      expect(actor.getSnapshot().value).toBe("playing");
      expect(actor.getSnapshot().context.currentRound).toBe(1);
    });

    it("game state unchanged on invalid command", () => {
      const actor = createGameWithPlayers(4);
      const snapshotBefore = JSON.stringify(actor.getSnapshot().context);

      // Invalid commands - ADD_PLAYER and START_GAME shouldn't work in playing state
      actor.send({ type: "ADD_PLAYER", name: "Test" });
      actor.send({ type: "START_GAME" });

      const snapshotAfter = JSON.stringify(actor.getSnapshot().context);
      expect(snapshotAfter).toBe(snapshotBefore);
    });
  });

  describe("game integrity", () => {
    it("all cards accounted for each round (4 players = 108 cards)", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 0,
      };
      const actor = createRoundActor(input);

      // Initial card count
      const totalCards =
        actor.getSnapshot().context.players.reduce((sum, p) => sum + p.hand.length, 0) +
        actor.getSnapshot().context.stock.length +
        actor.getSnapshot().context.discard.length;

      expect(totalCards).toBe(108);
    });

    it("all cards accounted for each round (8 players = 162 cards)", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(8),
        dealerIndex: 0,
      };
      const actor = createRoundActor(input);

      const totalCards =
        actor.getSnapshot().context.players.reduce((sum, p) => sum + p.hand.length, 0) +
        actor.getSnapshot().context.stock.length +
        actor.getSnapshot().context.discard.length;

      expect(totalCards).toBe(162);
    });

    it("scores accumulate (never decrease) during game", () => {
      const actor = createGameWithPlayers(4);

      let previousScores = actor.getSnapshot().context.players.map((p) => p.totalScore);

      for (let round = 1; round <= 6; round++) {
        actor.send({
          type: "ROUND_COMPLETE",
          roundRecord: {
            roundNumber: round as RoundNumber,
            winnerId: "player-0",
            scores: { "player-0": 0, "player-1": 10, "player-2": 15, "player-3": 20 },
          },
        });

        const currentScores = actor.getSnapshot().context.players.map((p) => p.totalScore);

        // All scores should be >= previous
        currentScores.forEach((score, idx) => {
          expect(score).toBeGreaterThanOrEqual(previousScores[idx]!);
        });

        previousScores = currentScores;
      }
    });

    it("player count never changes mid-game", () => {
      const actor = createGameWithPlayers(4);
      const initialCount = actor.getSnapshot().context.players.length;

      // Complete several rounds
      for (let round = 1; round <= 3; round++) {
        actor.send({
          type: "ROUND_COMPLETE",
          roundRecord: {
            roundNumber: round as RoundNumber,
            winnerId: "player-0",
            scores: {},
          },
        });

        expect(actor.getSnapshot().context.players.length).toBe(initialCount);
      }

      // Try to add player mid-game
      actor.send({ type: "ADD_PLAYER", name: "NewPlayer" });
      expect(actor.getSnapshot().context.players.length).toBe(initialCount);
    });
  });
});
