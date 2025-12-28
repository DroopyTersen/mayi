/**
 * Tests for the May I? Orchestrator
 *
 * TDD approach: verify orchestrator behavior matches existing harness behavior
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Orchestrator, getOrchestrator } from "./orchestrator";
import { clearSavedGame } from "./orchestrator.persistence";

describe("Orchestrator", () => {
  let orchestrator: Orchestrator;

  beforeEach(() => {
    orchestrator = new Orchestrator();
  });

  afterEach(() => {
    clearSavedGame();
  });

  describe("serialization (WebSocket/D1 support)", () => {
    it("round-trips state through getSerializableState and fromState", () => {
      orchestrator.newGame(["Alice", "Bob", "Carol"]);
      orchestrator.drawFromDiscard();

      const serialized = orchestrator.getSerializableState();

      // Create new orchestrator from serialized state
      const restored = Orchestrator.fromState(serialized);
      const restoredState = restored.getStateView();

      expect(restoredState.gameId).toBe(serialized.gameId);
      expect(restoredState.phase).toBe("AWAITING_ACTION");
      expect(restoredState.players).toHaveLength(3);
      expect(restoredState.currentRound).toBe(1);
    });

    it("serializable state includes all game state", () => {
      orchestrator.newGame(["Alice", "Bob", "Carol"]);
      const serialized = orchestrator.getSerializableState();

      expect(serialized.version).toBe("2.0");
      expect(serialized.gameId).toBeDefined();
      expect(serialized.players).toHaveLength(3);
      expect(serialized.stock.length).toBeGreaterThan(0);
      expect(serialized.discard.length).toBeGreaterThan(0);
      expect(serialized.table).toEqual([]);
      expect(serialized.harnessPhase).toBe("AWAITING_DRAW");
    });
  });

  describe("newGame", () => {
    it("creates a new 3-player game", () => {
      const state = orchestrator.newGame(["Alice", "Bob", "Carol"]);

      expect(state.gameId).toBeDefined();
      expect(state.players).toHaveLength(3);
      expect(state.players[0]!.name).toBe("Alice");
      expect(state.players[1]!.name).toBe("Bob");
      expect(state.players[2]!.name).toBe("Carol");
      expect(state.currentRound).toBe(1);
      expect(state.phase).toBe("AWAITING_DRAW");
    });

    it("deals 11 cards to each player", () => {
      const state = orchestrator.newGame(["Alice", "Bob", "Carol"]);

      for (const player of state.players) {
        expect(player.hand).toHaveLength(11);
      }
    });

    it("initializes stock and discard", () => {
      const state = orchestrator.newGame(["Alice", "Bob", "Carol"]);

      // 2 decks + 4 jokers = 108 cards
      // Dealt: 3 players * 11 cards = 33 cards
      // Remaining: 108 - 33 = 75 cards (74 stock + 1 discard)
      expect(state.stock.length).toBe(74);
      expect(state.discard.length).toBe(1);
    });

    it("sets first player to left of dealer", () => {
      const state = orchestrator.newGame(["Alice", "Bob", "Carol"]);

      // Dealer is player 0 (Alice), first player is player 1 (Bob)
      expect(state.currentPlayerIndex).toBe(1);
      expect(state.awaitingPlayerId).toBe("player-1");
    });

    it("rejects games with less than 3 players", () => {
      expect(() => orchestrator.newGame(["Alice", "Bob"])).toThrow("May I requires 3-8 players");
    });

    it("rejects games with more than 8 players", () => {
      const players = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9"];
      expect(() => orchestrator.newGame(players)).toThrow("May I requires 3-8 players");
    });
  });

  describe("drawFromStock", () => {
    beforeEach(() => {
      orchestrator.newGame(["Alice", "Bob", "Carol"]);
    });

    it("draws a card from stock and opens May I window", () => {
      const result = orchestrator.drawFromStock();

      expect(result.success).toBe(true);
      expect(result.message).toContain("drew");
      expect(result.message).toContain("from stock");

      const state = orchestrator.getStateView();
      expect(state.phase).toBe("MAY_I_WINDOW");
      expect(state.players[1]!.hand).toHaveLength(12); // 11 + 1 drawn
    });

    it("fails when called in wrong phase", () => {
      orchestrator.drawFromStock(); // Opens May I window

      expect(() => orchestrator.drawFromStock()).toThrow("Invalid command for current phase");
    });
  });

  describe("drawFromDiscard", () => {
    beforeEach(() => {
      orchestrator.newGame(["Alice", "Bob", "Carol"]);
    });

    it("draws a card from discard and goes to action phase", () => {
      const result = orchestrator.drawFromDiscard();

      expect(result.success).toBe(true);
      expect(result.message).toContain("took");
      expect(result.message).toContain("from discard");

      const state = orchestrator.getStateView();
      expect(state.phase).toBe("AWAITING_ACTION");
      expect(state.discard).toHaveLength(0);
    });

    it("fails for down players", () => {
      // First player draws, skips, discards, then draws again to become "simulated down"
      // Actually, we need to lay down first. Let's just test the guard directly.
      // Simulate a down player by manipulating state
      const state = orchestrator.getStateView();
      const player = orchestrator.getAwaitingPlayer()!;
      player.isDown = true;

      const result = orchestrator.drawFromDiscard();
      expect(result.success).toBe(false);
      expect(result.error).toBe("down_player_discard");
    });
  });

  describe("skip", () => {
    beforeEach(() => {
      orchestrator.newGame(["Alice", "Bob", "Carol"]);
      orchestrator.drawFromDiscard(); // Go to AWAITING_ACTION
    });

    it("skips laying down and goes to discard phase", () => {
      const result = orchestrator.skip();

      expect(result.success).toBe(true);
      expect(result.message).toContain("skipped");

      const state = orchestrator.getStateView();
      expect(state.phase).toBe("AWAITING_DISCARD");
    });
  });

  describe("discardCard", () => {
    beforeEach(() => {
      orchestrator.newGame(["Alice", "Bob", "Carol"]);
      orchestrator.drawFromDiscard();
      orchestrator.skip();
    });

    it("discards a card and advances to next player", () => {
      const stateBefore = orchestrator.getStateView();
      const handSize = stateBefore.players[1]!.hand.length;

      const result = orchestrator.discardCard(1);

      expect(result.success).toBe(true);
      expect(result.message).toContain("discarded");

      const stateAfter = orchestrator.getStateView();
      expect(stateAfter.phase).toBe("AWAITING_DRAW");
      expect(stateAfter.currentPlayerIndex).toBe(2); // Carol's turn
      expect(stateAfter.players[1]!.hand).toHaveLength(handSize - 1);
      expect(stateAfter.discard).toHaveLength(1);
    });

    it("fails with out of range position", () => {
      const result = orchestrator.discardCard(100);
      expect(result.success).toBe(false);
      expect(result.error).toBe("position_out_of_range");
    });
  });

  describe("May I window", () => {
    beforeEach(() => {
      orchestrator.newGame(["Alice", "Bob", "Carol"]);
      orchestrator.drawFromStock(); // Opens May I window
    });

    it("allows non-current player to call May I", () => {
      // Bob drew from stock, now Carol can call May I
      // Current awaiting is Carol (player 2)
      const state = orchestrator.getStateView();
      expect(state.awaitingPlayerId).toBe("player-2");

      const result = orchestrator.callMayI();
      expect(result.success).toBe(true);
      expect(result.message).toContain("May I");
    });

    it("allows player to pass", () => {
      const result = orchestrator.pass();
      expect(result.success).toBe(true);
      expect(result.message).toContain("passed");
    });

    it("resolves May I window after all players respond", () => {
      // Carol passes
      orchestrator.pass();
      // Alice (player 0) responds next - she passes too
      orchestrator.pass();

      // Now back to Bob's action phase
      const state = orchestrator.getStateView();
      expect(state.phase).toBe("AWAITING_ACTION");
      expect(state.awaitingPlayerId).toBe("player-1"); // Bob
    });

    it("gives card to May I winner", () => {
      // Carol calls May I
      orchestrator.callMayI();
      // Alice passes
      orchestrator.pass();

      // Carol should have received the discard + penalty
      const state = orchestrator.getStateView();
      expect(state.players[2]!.hand.length).toBeGreaterThan(11); // Carol got cards
    });
  });

  describe("persistence", () => {
    it("saves and loads game state", () => {
      orchestrator.newGame(["Alice", "Bob", "Carol"]);
      orchestrator.drawFromDiscard();

      // Create new orchestrator and load
      const newOrchestrator = new Orchestrator();
      const loadedState = newOrchestrator.loadGame();

      expect(loadedState.gameId).toBeDefined();
      expect(loadedState.phase).toBe("AWAITING_ACTION");
      expect(loadedState.players).toHaveLength(3);
    });
  });

  describe("layOff rules", () => {
    it("prevents laying off on the same turn as laying down", () => {
      // This is a critical house rule - you cannot lay off on the turn you lay down
      orchestrator.newGame(["Alice", "Bob", "Carol"]);
      orchestrator.drawFromDiscard();

      // Simulate a successful laydown by setting internal state
      const player = orchestrator.getAwaitingPlayer()!;
      player.isDown = true;
      // Access private field to set laidDownThisTurn (test-only hack)
      (orchestrator as unknown as { laidDownThisTurn: boolean }).laidDownThisTurn = true;

      // Create a meld on the table to lay off to
      const state = orchestrator.getStateView();
      state.table.push({
        id: "test-meld",
        type: "set",
        cards: [
          { id: "c1", suit: "hearts", rank: "7" },
          { id: "c2", suit: "diamonds", rank: "7" },
          { id: "c3", suit: "clubs", rank: "7" },
        ],
        ownerId: "player-0",
      });

      // Give the player a matching card
      player.hand.push({ id: "c4", suit: "spades", rank: "7" });

      // Try to lay off - should fail because laidDownThisTurn is true
      const result = orchestrator.layOff(player.hand.length, 1);
      expect(result.success).toBe(false);
      expect(result.error).toBe("laid_down_this_turn");
    });

    it("allows laying off on subsequent turns after laying down", () => {
      orchestrator.newGame(["Alice", "Bob", "Carol"]);
      orchestrator.drawFromDiscard();

      // Simulate a player who laid down on a previous turn
      const player = orchestrator.getAwaitingPlayer()!;
      player.isDown = true;
      // laidDownThisTurn is false (default) - meaning they laid down before

      // Create a meld on the table
      const state = orchestrator.getStateView();
      state.table.push({
        id: "test-meld",
        type: "set",
        cards: [
          { id: "c1", suit: "hearts", rank: "7" },
          { id: "c2", suit: "diamonds", rank: "7" },
          { id: "c3", suit: "clubs", rank: "7" },
        ],
        ownerId: "player-0",
      });

      // Give the player a matching card
      player.hand.push({ id: "c4", suit: "spades", rank: "7" });

      // Try to lay off - should succeed
      const result = orchestrator.layOff(player.hand.length, 1);
      expect(result.success).toBe(true);
    });
  });

  describe("full turn flow", () => {
    it("completes a basic turn: draw, skip, discard", () => {
      orchestrator.newGame(["Alice", "Bob", "Carol"]);

      // Bob's turn (player 1)
      let state = orchestrator.getStateView();
      expect(state.currentPlayerIndex).toBe(1);
      expect(state.phase).toBe("AWAITING_DRAW");

      // Draw from discard
      orchestrator.drawFromDiscard();
      state = orchestrator.getStateView();
      expect(state.phase).toBe("AWAITING_ACTION");

      // Skip
      orchestrator.skip();
      state = orchestrator.getStateView();
      expect(state.phase).toBe("AWAITING_DISCARD");

      // Discard
      orchestrator.discardCard(1);
      state = orchestrator.getStateView();
      expect(state.phase).toBe("AWAITING_DRAW");
      expect(state.currentPlayerIndex).toBe(2); // Carol's turn
    });
  });
});
