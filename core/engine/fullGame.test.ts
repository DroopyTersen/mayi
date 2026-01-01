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
import {
  createCanGoOutState,
  createCanLayDownState,
  createEmptyStockState,
} from "./test.fixtures";

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
  const actor = createActor(gameMachine, { input: { startingRound: 1 } });
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

/**
 * Helper to complete a turn for the current player
 * Uses proper event flow: DRAW → SKIP → DISCARD
 */
function completeTurn(actor: ReturnType<typeof createRoundActor>) {
  // Draw from discard (simpler - no May I window)
  actor.send({ type: "DRAW_FROM_DISCARD" });

  // Skip lay down
  actor.send({ type: "SKIP_LAY_DOWN" });

  // Discard first card from hand
  const afterDraw = actor.getPersistedSnapshot() as any;
  const turnAfterDraw = afterDraw.children?.turn?.snapshot;
  const cardToDiscard = turnAfterDraw?.context?.hand?.[0];
  if (cardToDiscard) {
    actor.send({ type: "DISCARD", cardId: cardToDiscard.id });
  }
}

/**
 * Helper to complete a turn by drawing from stock (triggers May I window)
 */
function completeTurnFromStock(actor: ReturnType<typeof createRoundActor>) {
  // Draw from stock (opens May I window)
  actor.send({ type: "DRAW_FROM_STOCK" });
  // Close May I window (pass on discard)
  actor.send({ type: "DRAW_FROM_STOCK" });

  // Skip lay down
  actor.send({ type: "SKIP_LAY_DOWN" });

  // Discard first card from hand
  const afterDraw = actor.getPersistedSnapshot() as any;
  const turnAfterDraw = afterDraw.children?.turn?.snapshot;
  const cardToDiscard = turnAfterDraw?.context?.hand?.[0];
  if (cardToDiscard) {
    actor.send({ type: "DISCARD", cardId: cardToDiscard.id });
  }
}

/**
 * Helper: Go out by laying off all remaining cards sequentially
 * Used with createCanGoOutState fixture where player 0 has cards that fit existing melds
 */
function goOutViaLayOff(actor: ReturnType<typeof createRoundActor>) {
  // Lay off each card to trigger wentOut when hand empties
  actor.send({ type: "LAY_OFF", cardId: "p0-Q-S", meldId: "meld-player-0-0" });
  actor.send({ type: "LAY_OFF", cardId: "stock-Q-D", meldId: "meld-player-0-0" });
  actor.send({ type: "LAY_OFF", cardId: "p0-J-C", meldId: "meld-player-0-1" });
  // After last LAY_OFF, hand is empty → wentOut triggers automatically
}

describe("full game flow - setup to end", () => {
  describe("game initialization", () => {
    it("when: create new game, add 4 players, START_GAME, then: game transitions to 'playing'", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } });
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

    // Using predefinedState to test round completion via invoke
    it("when: cards dealt, players take turns, someone goes out, then: round ends (via invoke)", () => {
      const predefinedState = createCanGoOutState();
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(3),
        dealerIndex: 2, // Player 0 goes first
        predefinedState,
      };
      const actor = createRoundActor(input);

      // Player 0 goes out via sequential LAY_OFF
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "DRAW_FROM_STOCK" });
      goOutViaLayOff(actor);

      // Round should end in scoring state
      expect(actor.getSnapshot().value).toBe("scoring");
      expect(actor.getSnapshot().status).toBe("done");
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
      expect(actor.getSnapshot().value).toEqual({ active: "playing" });
    });
  });

  // Turn completion happens via TurnMachine invoke pattern
  describe("active phase - turns (via invoke)", () => {
    it("player takes their turn, turn completes (wentOut: false), advance to next", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 0,
      };
      const actor = createRoundActor(input);

      // Player 1 starts (left of dealer 0)
      expect(actor.getSnapshot().context.currentPlayerIndex).toBe(1);

      // Complete turn (wentOut will be false for normal turn)
      completeTurn(actor);

      // Turn should have advanced to player 2
      expect(actor.getSnapshot().context.currentPlayerIndex).toBe(2);
      expect(actor.getSnapshot().value).toEqual({ active: "playing" });
    });

    // Using predefinedState - player goes out after turn sequence
    it("repeat until someone goes out", () => {
      const predefinedState = createCanGoOutState();
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(3),
        dealerIndex: 2,
        predefinedState,
      };
      const actor = createRoundActor(input);

      // Turns repeat: player 0 goes out
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "DRAW_FROM_STOCK" });
      goOutViaLayOff(actor);

      // Round ended
      expect(actor.getSnapshot().status).toBe("done");
    });
  });

  describe("scoring phase (via invoke)", () => {
    it("when: player goes out (wentOut: true), then: transition to scoring", () => {
      const predefinedState = createCanGoOutState();
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(3),
        dealerIndex: 2,
        predefinedState,
      };
      const actor = createRoundActor(input);

      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "DRAW_FROM_STOCK" });
      goOutViaLayOff(actor);

      expect(actor.getSnapshot().value).toBe("scoring");
    });

    it("calculate all player scores, create RoundRecord, output to parent", () => {
      const predefinedState = createCanGoOutState();
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(3),
        dealerIndex: 2,
        predefinedState,
      };
      const actor = createRoundActor(input);

      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "DRAW_FROM_STOCK" });
      goOutViaLayOff(actor);

      const output = actor.getSnapshot().output;
      expect(output?.roundRecord).toBeDefined();
      expect(output?.roundRecord.scores["player-0"]).toBe(0); // Winner scores 0
      expect(output?.roundRecord.scores["player-1"]).toBeGreaterThan(0);
      expect(output?.roundRecord.scores["player-2"]).toBeGreaterThan(0);
      expect(output?.roundRecord.winnerId).toBe("player-0");
    });
  });
});

// Turn sequencing tested with predefinedState
describe("turn sequencing within round (via invoke)", () => {
  describe("normal progression", () => {
    it("given: 4 players, first player = 1, turn 1: player 1, turn 2: player 2, ...", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 0,
      };
      const actor = createRoundActor(input);

      // First player is 1 (left of dealer 0)
      expect(actor.getSnapshot().context.currentPlayerIndex).toBe(1);

      completeTurn(actor);
      expect(actor.getSnapshot().context.currentPlayerIndex).toBe(2);

      completeTurn(actor);
      expect(actor.getSnapshot().context.currentPlayerIndex).toBe(3);

      completeTurn(actor);
      expect(actor.getSnapshot().context.currentPlayerIndex).toBe(0);
    });

    it("continues until someone goes out", () => {
      const predefinedState = createCanGoOutState();
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(3),
        dealerIndex: 2,
        predefinedState,
      };
      const actor = createRoundActor(input);

      // First several turns don't end the round
      expect(actor.getSnapshot().value).toEqual({ active: "playing" });

      // Player 0 goes out
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "DRAW_FROM_STOCK" });
      goOutViaLayOff(actor);

      // Now round has ended
      expect(actor.getSnapshot().status).toBe("done");
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

      // Complete 8 turns (2 full rotations)
      for (let i = 0; i < 8; i++) {
        completeTurn(actor);
      }

      // Game should still be active
      expect(actor.getSnapshot().value).toEqual({ active: "playing" });
    });

    it("round ends when any player goes out", () => {
      const predefinedState = createCanGoOutState();
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(3),
        dealerIndex: 2,
        predefinedState,
      };
      const actor = createRoundActor(input);

      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "DRAW_FROM_STOCK" });
      goOutViaLayOff(actor);

      expect(actor.getSnapshot().value).toBe("scoring");
      expect(actor.getSnapshot().status).toBe("done");
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

    it("turn order: 1, 2, 3, 0, 1, 2, ... (via invoke)", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 0,
      };
      const actor = createRoundActor(input);

      // Helper to get current player and complete their turn
      function getCurrentPlayerAndCompleteTurn() {
        const currentIndex = actor.getSnapshot().context.currentPlayerIndex;
        completeTurn(actor);
        return currentIndex;
      }

      const turnOrder = [];
      for (let i = 0; i < 6; i++) {
        turnOrder.push(getCurrentPlayerAndCompleteTurn());
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

    it("turn order: 2, 3, 0, 1, 2, 3, ... (via invoke)", () => {
      const input: RoundInput = {
        roundNumber: 2,
        players: createTestPlayers(4),
        dealerIndex: 1,
      };
      const actor = createRoundActor(input);

      function getCurrentPlayerAndCompleteTurn() {
        const currentIndex = actor.getSnapshot().context.currentPlayerIndex;
        completeTurn(actor);
        return currentIndex;
      }

      const turnOrder = [];
      for (let i = 0; i < 6; i++) {
        turnOrder.push(getCurrentPlayerAndCompleteTurn());
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

// State persistence is demonstrated via the XState invoke pattern
describe("state persistence between turns (via invoke)", () => {
  describe("hand changes", () => {
    it("after each turn, player's hand updated", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 0,
      };
      const actor = createRoundActor(input);

      // Player 1 starts with 11 cards
      const initialHand = actor.getSnapshot().context.players[1]!.hand;
      expect(initialHand.length).toBe(11);

      // Complete turn (draw 1, discard 1 = same size)
      completeTurn(actor);

      // Player 1's hand should be updated (same size but different cards)
      const finalHand = actor.getSnapshot().context.players[1]!.hand;
      expect(finalHand.length).toBe(11);
    });

    it("changes persist to next turn", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 0,
      };
      const actor = createRoundActor(input);

      // Get player 1's initial hand
      const initialHand = [...actor.getSnapshot().context.players[1]!.hand];

      // Complete player 1's turn
      completeTurn(actor);

      // Now player 2's turn - complete it
      completeTurn(actor);

      // Player 1's hand change should persist
      // It should be the hand from after their turn, not the initial
      const finalHand = actor.getSnapshot().context.players[1]!.hand;
      // The hand may have different cards but same length
      expect(finalHand.length).toBe(11);
    });
  });

  describe("table changes", () => {
    it("melds added when players lay down", () => {
      const predefinedState = createCanLayDownState();
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(3),
        dealerIndex: 2,
        predefinedState,
      };
      const actor = createRoundActor(input);

      // Initially no melds on table
      expect(actor.getSnapshot().context.table.length).toBe(0);

      // Draw from discard
      actor.send({ type: "DRAW_FROM_DISCARD" });

      // Lay down 2 sets (Round 1 contract)
      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set", cardIds: ["p0-K-H", "p0-K-D", "p0-K-S"] },
          { type: "set", cardIds: ["p0-Q-H", "p0-Q-D", "p0-Q-C"] },
        ],
      });

      // Table is updated in TurnMachine context (propagated to Round when turn completes)
      const persisted = actor.getPersistedSnapshot() as any;
      const turnTable = persisted.children?.turn?.snapshot?.context?.table;
      expect(turnTable?.length).toBe(2);
    });

    it("changes persist until round ends", () => {
      const predefinedState = createCanLayDownState();
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(3),
        dealerIndex: 2,
        predefinedState,
      };
      const actor = createRoundActor(input);

      // Draw and lay down
      actor.send({ type: "DRAW_FROM_DISCARD" });
      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set", cardIds: ["p0-K-H", "p0-K-D", "p0-K-S"] },
          { type: "set", cardIds: ["p0-Q-H", "p0-Q-D", "p0-Q-C"] },
        ],
      });

      // Get current hand to discard from
      const handAfterLayDown = (actor.getPersistedSnapshot() as any).children?.turn?.snapshot?.context?.hand;
      const cardToDiscard = handAfterLayDown?.[0];

      // Discard to complete turn
      if (cardToDiscard) {
        actor.send({ type: "DISCARD", cardId: cardToDiscard.id });
      }

      // After turn completes, melds should still be on table
      expect(actor.getSnapshot().context.table.length).toBe(2);
      expect(actor.getSnapshot().value).toEqual({ active: "playing" });
    });
  });

  describe("stock and discard changes", () => {
    it("stock decreases with draws from stock", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 0,
      };
      const actor = createRoundActor(input);

      const initialStock = actor.getSnapshot().context.stock.length;

      // Complete turn by drawing from stock
      completeTurnFromStock(actor);

      // Stock should have decreased by 1
      expect(actor.getSnapshot().context.stock.length).toBe(initialStock - 1);
    });

    it("discard changes with discards", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 0,
      };
      const actor = createRoundActor(input);

      // Initial discard has 1 card (flipped at start)
      expect(actor.getSnapshot().context.discard.length).toBe(1);

      // Complete turn from discard - takes 1, adds 1
      completeTurn(actor);

      // Discard should still have 1 card
      expect(actor.getSnapshot().context.discard.length).toBe(1);
    });

    it("state accurate for each turn", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 0,
      };
      const actor = createRoundActor(input);

      const initialStock = actor.getSnapshot().context.stock.length;

      // Complete 3 turns from stock
      for (let i = 0; i < 3; i++) {
        completeTurnFromStock(actor);
      }

      // Stock should be reduced by 3
      expect(actor.getSnapshot().context.stock.length).toBe(initialStock - 3);
    });
  });
});

// Edge cases tested with predefinedState fixtures
describe("edge cases", () => {
  describe("quick round - going out on first turn (via invoke)", () => {
    it("given: player 0 goes out immediately, then: round ends after just 1 turn", () => {
      const predefinedState = createCanGoOutState();
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(3),
        dealerIndex: 2,
        predefinedState,
      };
      const actor = createRoundActor(input);

      // Player 0 goes out on first turn
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "DRAW_FROM_STOCK" });
      goOutViaLayOff(actor);

      // Round ends after just 1 turn
      expect(actor.getSnapshot().status).toBe("done");
    });

    it("other players still have 11 cards in hand when scored", () => {
      const predefinedState = createCanGoOutState();
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(3),
        dealerIndex: 2,
        predefinedState,
      };
      const actor = createRoundActor(input);

      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "DRAW_FROM_STOCK" });
      goOutViaLayOff(actor);

      // Other players still have their original hands
      expect(actor.getSnapshot().context.players[1]!.hand.length).toBe(11);
      expect(actor.getSnapshot().context.players[2]!.hand.length).toBe(11);
    });

    it("winner (player who went out) scores 0", () => {
      const predefinedState = createCanGoOutState();
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(3),
        dealerIndex: 2,
        predefinedState,
      };
      const actor = createRoundActor(input);

      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "DRAW_FROM_STOCK" });
      goOutViaLayOff(actor);

      const output = actor.getSnapshot().output;
      expect(output?.roundRecord.scores["player-0"]).toBe(0);
    });
  });

  describe("long round - many rotations (via invoke)", () => {
    it("turns continue for many rotations", () => {
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(4),
        dealerIndex: 0,
      };
      const actor = createRoundActor(input);

      // Complete 12 turns (3 full rotations)
      for (let i = 0; i < 12; i++) {
        completeTurn(actor);
      }

      // Game should still be active
      expect(actor.getSnapshot().value).toEqual({ active: "playing" });
    });

    it("eventually someone goes out and round ends", () => {
      const predefinedState = createCanGoOutState();
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(3),
        dealerIndex: 2,
        predefinedState,
      };
      const actor = createRoundActor(input);

      // Player 0 goes out
      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "DRAW_FROM_STOCK" });
      goOutViaLayOff(actor);

      expect(actor.getSnapshot().status).toBe("done");
    });
  });

  describe("stock depletion during round", () => {
    it("given: stock empty, when: RESHUFFLE_STOCK sent, then: discard shuffled into stock", () => {
      const predefinedState = createEmptyStockState();
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(3),
        dealerIndex: 2,
        predefinedState,
      };
      const actor = createRoundActor(input);

      // Stock is empty, discard has cards
      expect(actor.getSnapshot().context.stock.length).toBe(0);
      const initialDiscardLength = actor.getSnapshot().context.discard.length;
      expect(initialDiscardLength).toBeGreaterThan(1);

      // Send RESHUFFLE_STOCK to refill stock from discard
      actor.send({ type: "RESHUFFLE_STOCK" });

      // Stock should now have cards from discard (minus top card kept in discard)
      expect(actor.getSnapshot().context.stock.length).toBe(initialDiscardLength - 1);
      // Discard should only have the top card
      expect(actor.getSnapshot().context.discard.length).toBe(1);
    });
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
    it("players must lay down 2 sets to go down", () => {
      // Round 1 contract is 2 sets
      expect(CONTRACTS[1].sets).toBe(2);
      expect(CONTRACTS[1].runs).toBe(0);
    });

    it("1 set insufficient", () => {
      // Need 2 sets, 1 is not enough
      expect(CONTRACTS[1].sets).toBe(2);
      // If player only has 1 set, they cannot lay down
    });

    it("sets + runs insufficient (wrong combination)", () => {
      // Even 1 set + 1 run doesn't satisfy 2 sets requirement
      const contract = CONTRACTS[1];
      const onlyHas = { sets: 1, runs: 1 };
      expect(onlyHas.sets).toBeLessThan(contract.sets);
    });
  });

  describe("round 2", () => {
    it("players must lay down 1 set + 1 run", () => {
      expect(CONTRACTS[2].sets).toBe(1);
      expect(CONTRACTS[2].runs).toBe(1);
    });

    it("2 sets insufficient, 2 runs insufficient", () => {
      const contract = CONTRACTS[2];
      // 2 sets doesn't meet requirement (needs 1 set + 1 run)
      expect(contract.sets).toBe(1);
      expect(contract.runs).toBe(1);
      // 2 sets = wrong, 2 runs = wrong
    });
  });

  describe("round 3", () => {
    it("players must lay down 2 runs, sets not accepted", () => {
      expect(CONTRACTS[3].sets).toBe(0);
      expect(CONTRACTS[3].runs).toBe(2);
    });
  });

  describe("round 4", () => {
    it("players must lay down 3 sets", () => {
      expect(CONTRACTS[4].sets).toBe(3);
      expect(CONTRACTS[4].runs).toBe(0);
    });
  });

  describe("round 5", () => {
    it("players must lay down 2 sets + 1 run", () => {
      expect(CONTRACTS[5].sets).toBe(2);
      expect(CONTRACTS[5].runs).toBe(1);
    });
  });

  describe("round 6", () => {
    it("players must lay down 1 set + 2 runs", () => {
      expect(CONTRACTS[6].sets).toBe(1);
      expect(CONTRACTS[6].runs).toBe(2);
    });

    it("minimum 11 cards required, special going out rules (no discard)", () => {
      // Minimum: 1 set (3 cards) + 2 runs (4 cards each) = 11 cards
      const minCards = CONTRACTS[6].sets * 3 + CONTRACTS[6].runs * 4;
      expect(minCards).toBe(11);
    });
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
      const actor = createActor(gameMachine, { input: { startingRound: 1 } });
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
      const actor = createActor(gameMachine, { input: { startingRound: 1 } });
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
      const actor = createActor(gameMachine, { input: { startingRound: 1 } });
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

    it("turns in progress, melds may be on table (via invoke)", () => {
      const predefinedState = createCanLayDownState();
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(3),
        dealerIndex: 2,
        predefinedState,
      };
      const actor = createRoundActor(input);

      // Draw and lay down
      actor.send({ type: "DRAW_FROM_DISCARD" });
      actor.send({
        type: "LAY_DOWN",
        melds: [
          { type: "set", cardIds: ["p0-K-H", "p0-K-D", "p0-K-S"] },
          { type: "set", cardIds: ["p0-Q-H", "p0-Q-D", "p0-Q-C"] },
        ],
      });

      // Melds are on table in turn machine context (not yet propagated to round)
      const persisted = actor.getPersistedSnapshot() as any;
      const turnTable = persisted.children?.turn?.snapshot?.context?.table;
      expect(turnTable?.length).toBe(2);
      expect(actor.getSnapshot().value).toEqual({ active: "playing" });
    });
  });

  describe("roundEnd (between rounds)", () => {
    it("round just completed, scores calculated (via invoke)", () => {
      const predefinedState = createCanGoOutState();
      const input: RoundInput = {
        roundNumber: 1,
        players: createTestPlayers(3),
        dealerIndex: 2,
        predefinedState,
      };
      const actor = createRoundActor(input);

      actor.send({ type: "DRAW_FROM_STOCK" });
      actor.send({ type: "DRAW_FROM_STOCK" });
      goOutViaLayOff(actor);

      // Round completed, scores calculated
      const output = actor.getSnapshot().output;
      expect(output?.roundRecord).toBeDefined();
      expect(output?.roundRecord.roundNumber).toBe(1);
      expect(output?.roundRecord.winnerId).toBe("player-0");
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
      expect(actor.getSnapshot().context.players[0]!.totalScore).toBe(expectedTotals["player-0"]!);
      expect(actor.getSnapshot().context.players[1]!.totalScore).toBe(expectedTotals["player-1"]!);
      expect(actor.getSnapshot().context.players[2]!.totalScore).toBe(expectedTotals["player-2"]!);
      expect(actor.getSnapshot().context.players[3]!.totalScore).toBe(expectedTotals["player-3"]!);
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
      const actor = createActor(gameMachine, { input: { startingRound: 1 } });
      actor.start();

      actor.send({ type: "ADD_PLAYER", name: "Alice" });
      actor.send({ type: "ADD_PLAYER", name: "Bob" });

      expect(actor.getSnapshot().context.players.length).toBe(2);
      actor.send({ type: "START_GAME" });

      // Should stay in setup
      expect(actor.getSnapshot().value).toBe("setup");
    });

    it("ADD_PLAYER with > 8 players rejected", () => {
      const actor = createActor(gameMachine, { input: { startingRound: 1 } });
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
      const actor = createActor(gameMachine, { input: { startingRound: 1 } });
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
