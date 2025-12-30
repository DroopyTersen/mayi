/**
 * Tests for the May I? Orchestrator
 *
 * TDD approach: verify orchestrator behavior matches existing harness behavior
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Orchestrator, getOrchestrator } from "./orchestrator";

// Track games that existed before tests started, so we only clean up test-created ones
let preExistingGames: Set<string> = new Set();

// Capture existing games before any tests run
function captureExistingGames(): void {
  const fs = require("fs");
  preExistingGames = new Set();
  if (fs.existsSync(".data")) {
    const entries = fs.readdirSync(".data");
    for (const entry of entries) {
      preExistingGames.add(entry);
    }
  }
}

// Clean up only games created during tests (not pre-existing ones)
function cleanupTestGames(): void {
  const fs = require("fs");
  if (fs.existsSync(".data")) {
    const entries = fs.readdirSync(".data");
    for (const entry of entries) {
      if (!preExistingGames.has(entry)) {
        const dir = `.data/${entry}`;
        if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
          fs.rmSync(dir, { recursive: true });
        }
      }
    }
  }
}

// Capture existing games before any tests in this file run
captureExistingGames();

describe("Orchestrator", () => {
  let orchestrator: Orchestrator;

  beforeEach(() => {
    orchestrator = new Orchestrator();
  });

  afterEach(() => {
    // Clean up any games created during this test
    cleanupTestGames();
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

    it("includes all non-current players in May I window at game start (deal discard)", () => {
      // At game start, no player has discarded yet - the discard is from the deal
      // So all non-current players should be in the May I responders
      const state = orchestrator.getStateView();
      expect(state.mayIContext!.discardedByPlayerId).toBe(""); // No player discarded
      expect(state.mayIContext!.awaitingResponseFrom).toContain("player-0"); // Alice
      expect(state.mayIContext!.awaitingResponseFrom).toContain("player-2"); // Carol
      expect(state.mayIContext!.awaitingResponseFrom).not.toContain("player-1"); // Bob is current
    });

    it("excludes down players from May I window responders", () => {
      // Down players cannot draw from discard, so they should not be in the May I window
      // Setup: 3 players - Alice (0), Bob (1), Carol (2)
      orchestrator.newGame(["Alice", "Bob", "Carol"]);

      // Simulate Alice (player 0) being down - she laid down on a previous turn
      const alice = orchestrator.getStateView().players[0]!;
      alice.isDown = true;

      // Bob's turn (player 1) - draw from stock to open May I window
      orchestrator.drawFromStock();

      const state = orchestrator.getStateView();
      expect(state.phase).toBe("MAY_I_WINDOW");

      // Alice is down, so she should NOT be in the May I responders
      // Only Carol (player 2) should be asked
      expect(state.mayIContext!.awaitingResponseFrom).not.toContain("player-0"); // Alice is down
      expect(state.mayIContext!.awaitingResponseFrom).toContain("player-2"); // Carol should be asked
    });

    it("skips May I window when no eligible responders exist", () => {
      // Edge case: All non-current players are either down or just discarded
      // Setup: 3 players - Alice (0), Bob (1), Carol (2)
      orchestrator.newGame(["Alice", "Bob", "Carol"]);

      // Alice (player 0) is down
      const alice = orchestrator.getStateView().players[0]!;
      alice.isDown = true;

      // Bob's turn (player 1) - draw and discard
      orchestrator.drawFromDiscard();
      orchestrator.skip();
      orchestrator.discardCard(1);

      // Now Carol's turn (player 2) - draw from stock
      // At this point: Alice is down, Bob just discarded, Carol is current
      // No one can respond to May I!
      const stateBefore = orchestrator.getStateView();
      expect(stateBefore.currentPlayerIndex).toBe(2); // Carol

      orchestrator.drawFromStock();

      // Should skip directly to AWAITING_ACTION since no one can respond
      const state = orchestrator.getStateView();
      expect(state.phase).toBe("AWAITING_ACTION");
      expect(state.mayIContext).toBeNull();
    });

    it("excludes the player who discarded from May I window responders", () => {
      // Setup: 3 players - Alice (0), Bob (1), Carol (2)
      // Alice is dealer (0), so Bob (1) goes first
      orchestrator.newGame(["Alice", "Bob", "Carol"]);

      // Bob's turn (player 1) - draw and discard
      let state = orchestrator.getStateView();
      expect(state.currentPlayerIndex).toBe(1); // Bob
      orchestrator.drawFromDiscard();
      orchestrator.skip();
      orchestrator.discardCard(1);

      // Now Carol's turn (player 2) - draw from stock to open May I window
      state = orchestrator.getStateView();
      expect(state.currentPlayerIndex).toBe(2); // Carol
      orchestrator.drawFromStock();

      state = orchestrator.getStateView();
      expect(state.phase).toBe("MAY_I_WINDOW");

      // Bob just discarded, so he should NOT be in the May I responders
      // Only Alice should be asked (Carol is current player, Bob just discarded)
      expect(state.mayIContext!.discardedByPlayerId).toBe("player-1"); // Bob discarded
      expect(state.mayIContext!.awaitingResponseFrom).not.toContain("player-1"); // Bob not asked
      expect(state.mayIContext!.awaitingResponseFrom).toContain("player-0"); // Alice should be asked
    });

    it("exits May I window immediately when caller has priority (no one ahead wants it)", () => {
      // Bob drew from stock, Carol is first to respond
      // Carol calls May I - since no one ahead of her claimed it, she wins immediately
      orchestrator.callMayI();

      // Alice passes (confirming she doesn't want to claim over Carol)
      orchestrator.pass();

      // May I window should now be resolved - phase should change
      const state = orchestrator.getStateView();
      expect(state.phase).toBe("AWAITING_ACTION");

      // Calling pass again should fail because we're no longer in MAY_I_WINDOW
      expect(() => orchestrator.pass()).toThrow("Invalid command for current phase");
    });
  });

  describe("persistence", () => {
    it("saves and loads game state", () => {
      const state = orchestrator.newGame(["Alice", "Bob", "Carol"]);
      const gameId = state.gameId;
      orchestrator.drawFromDiscard();

      // Create new orchestrator and load using the game ID
      const newOrchestrator = new Orchestrator();
      const loadedState = newOrchestrator.loadGame(gameId);

      expect(loadedState.gameId).toBe(gameId);
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

  describe("layDown exact contract enforcement", () => {
    beforeEach(() => {
      orchestrator.newGame(["Alice", "Bob", "Carol"]);
      orchestrator.drawFromDiscard(); // Go to AWAITING_ACTION
    });

    it("rejects set with more than 3 cards in Rounds 1-5", () => {
      const player = orchestrator.getAwaitingPlayer()!;
      // Replace hand with 4 cards of same rank (oversized set)
      player.hand = [
        { id: "c1", suit: "hearts", rank: "7" },
        { id: "c2", suit: "diamonds", rank: "7" },
        { id: "c3", suit: "clubs", rank: "7" },
        { id: "c4", suit: "spades", rank: "7" },
        // Second set - valid
        { id: "c5", suit: "hearts", rank: "9" },
        { id: "c6", suit: "diamonds", rank: "9" },
        { id: "c7", suit: "clubs", rank: "9" },
        // Extra cards
        { id: "c8", suit: "hearts", rank: "K" },
      ];

      // Try to lay down with a 4-card set (should fail)
      const result = orchestrator.layDown([[1, 2, 3, 4], [5, 6, 7]]);
      expect(result.success).toBe(false);
      expect(result.error).toBe("set_wrong_size");
      expect(result.message).toContain("exactly 3 cards");
    });

    it("rejects run with more than 4 cards in Rounds 1-5", () => {
      const player = orchestrator.getAwaitingPlayer()!;
      // Set up hand for Round 2 (1 set + 1 run)
      // Manipulate to Round 2
      (orchestrator as unknown as { currentRound: number }).currentRound = 2;

      player.hand = [
        // Valid set
        { id: "c1", suit: "hearts", rank: "7" },
        { id: "c2", suit: "diamonds", rank: "7" },
        { id: "c3", suit: "clubs", rank: "7" },
        // Oversized run - 5 cards
        { id: "c4", suit: "spades", rank: "5" },
        { id: "c5", suit: "spades", rank: "6" },
        { id: "c6", suit: "spades", rank: "7" },
        { id: "c7", suit: "spades", rank: "8" },
        { id: "c8", suit: "spades", rank: "9" },
        // Extra
        { id: "c9", suit: "hearts", rank: "K" },
      ];

      // Try to lay down with a 5-card run (should fail)
      const result = orchestrator.layDown([[1, 2, 3], [4, 5, 6, 7, 8]]);
      expect(result.success).toBe(false);
      expect(result.error).toBe("run_wrong_size");
      expect(result.message).toContain("exactly 4 cards");
    });

    it("accepts exactly 3-card sets and 4-card runs in Rounds 1-5", () => {
      const player = orchestrator.getAwaitingPlayer()!;
      // Set up hand for Round 1 (2 sets)
      player.hand = [
        // Set 1 - exactly 3 cards
        { id: "c1", suit: "hearts", rank: "7" },
        { id: "c2", suit: "diamonds", rank: "7" },
        { id: "c3", suit: "clubs", rank: "7" },
        // Set 2 - exactly 3 cards
        { id: "c4", suit: "hearts", rank: "9" },
        { id: "c5", suit: "diamonds", rank: "9" },
        { id: "c6", suit: "clubs", rank: "9" },
        // Extra cards
        { id: "c7", suit: "hearts", rank: "K" },
        { id: "c8", suit: "hearts", rank: "Q" },
      ];

      const result = orchestrator.layDown([[1, 2, 3], [4, 5, 6]]);
      expect(result.success).toBe(true);
    });
  });

  describe("swap modifies hand in place", () => {
    it("removes swap card from hand and adds joker at the end", () => {
      orchestrator.newGame(["Alice", "Bob", "Carol"]);
      orchestrator.drawFromDiscard(); // Go to AWAITING_ACTION

      const player = orchestrator.getAwaitingPlayer()!;

      // Set up a run with a joker on the table
      const state = orchestrator.getStateView();
      state.table.push({
        id: "test-run",
        type: "run",
        cards: [
          { id: "r1", suit: "hearts", rank: "5" },
          { id: "r2", suit: "hearts", rank: "6" },
          { id: "joker1", suit: "hearts", rank: "Joker" }, // Acting as 7♥
          { id: "r3", suit: "hearts", rank: "8" },
        ],
        ownerId: "player-0",
      });

      // Give the player a 7♥ to swap
      const sevenOfHearts = { id: "swap-card", suit: "hearts" as const, rank: "7" as const };
      player.hand = [
        { id: "c1", suit: "clubs", rank: "3" },
        sevenOfHearts,  // Position 2
        { id: "c2", suit: "diamonds", rank: "K" },
      ];

      const handBefore = [...player.hand];
      const cardAtPos2Before = player.hand[1]; // The 7♥

      // Swap the card at position 2 for the joker
      const result = orchestrator.swap(1, 3, 2); // meld 1, joker at pos 3, card at pos 2

      expect(result.success).toBe(true);

      // CRITICAL: After swap, hand[1] is now a DIFFERENT card
      // The 7♥ was removed and the Joker was added at the end
      expect(player.hand[1]!.id).not.toBe(cardAtPos2Before!.id);
      expect(player.hand[1]!.rank).toBe("K"); // The K♦ shifted down
      expect(player.hand[player.hand.length - 1]!.rank).toBe("Joker"); // Joker at end

      // This test documents why interactive code must capture the card BEFORE calling swap
    });
  });

  describe("stock auto-replenishment", () => {
    beforeEach(() => {
      orchestrator.newGame(["Alice", "Bob", "Carol"]);
    });

    it("replenishes stock from discard when stock is empty", () => {
      // Simulate empty stock with multiple discard cards
      const state = orchestrator.getStateView();
      (orchestrator as unknown as { stock: typeof state.stock }).stock = [];
      (orchestrator as unknown as { discard: typeof state.discard }).discard = [
        { id: "d1", suit: "hearts", rank: "7" },
        { id: "d2", suit: "diamonds", rank: "8" },
        { id: "d3", suit: "clubs", rank: "9" },
        { id: "d4", suit: "spades", rank: "10" },
      ];

      // Draw from stock should trigger replenishment
      const result = orchestrator.drawFromStock();
      expect(result.success).toBe(true);

      // After replenishment: top discard stays, rest becomes stock
      const afterState = orchestrator.getStateView();
      expect(afterState.discard.length).toBe(1);
      expect(afterState.discard[0]!.id).toBe("d1"); // Top discard preserved
    });

    it("fails when stock empty and only 1 discard card", () => {
      // Simulate empty stock with only 1 discard card (cannot replenish)
      const state = orchestrator.getStateView();
      (orchestrator as unknown as { stock: typeof state.stock }).stock = [];
      (orchestrator as unknown as { discard: typeof state.discard }).discard = [
        { id: "d1", suit: "hearts", rank: "7" },
      ];

      const result = orchestrator.drawFromStock();
      expect(result.success).toBe(false);
      expect(result.error).toBe("stock_empty");
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

    it("requires skip() before discardCard() - cannot discard directly from AWAITING_ACTION", () => {
      orchestrator.newGame(["Alice", "Bob", "Carol"]);

      // Draw to get to AWAITING_ACTION
      orchestrator.drawFromDiscard();
      const state = orchestrator.getStateView();
      expect(state.phase).toBe("AWAITING_ACTION");

      // Attempting to discard directly from AWAITING_ACTION should fail
      // This documents why interactive mode must call skip() first
      expect(() => orchestrator.discardCard(1)).toThrow("Invalid command for current phase");
    });
  });
});
