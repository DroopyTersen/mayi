/**
 * Tests for the XState-backed GameEngine
 *
 * This test file verifies the new architecture where GameEngine is a thin
 * wrapper around XState actors. The key differences from the old implementation:
 *
 * 1. The engine wraps a mutable XState actor
 * 2. Persistence uses XState's getPersistedSnapshot() format
 * 3. Hydration uses fromPersistedSnapshot() or fromJSON()
 */

import { describe, it, expect, afterEach } from "bun:test";
import { GameEngine } from "./game-engine";

describe("GameEngine (XState-backed)", () => {
  let engine: GameEngine | null = null;

  afterEach(() => {
    // Cleanup actor
    if (engine) {
      engine.stop();
      engine = null;
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // createGame
  // ═══════════════════════════════════════════════════════════════════════════

  describe("createGame", () => {
    it("creates a game with the specified players", () => {
      engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
      });

      const snapshot = engine.getSnapshot();
      expect(snapshot.players).toHaveLength(3);
      expect(snapshot.players[0]!.name).toBe("Alice");
      expect(snapshot.players[1]!.name).toBe("Bob");
      expect(snapshot.players[2]!.name).toBe("Carol");
    });

    it("assigns unique player IDs", () => {
      engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
      });

      const snapshot = engine.getSnapshot();
      const ids = snapshot.players.map((p) => p.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(3);
    });

    it("deals 11 cards to each player", () => {
      engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
      });

      const snapshot = engine.getSnapshot();
      for (const player of snapshot.players) {
        expect(player.hand).toHaveLength(11);
      }
    });

    it("starts at round 1", () => {
      engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
      });

      const snapshot = engine.getSnapshot();
      expect(snapshot.currentRound).toBe(1);
      expect(snapshot.contract).toEqual({
        roundNumber: 1,
        sets: 2,
        runs: 0,
      });
    });

    it("rejects fewer than 3 players", () => {
      expect(() =>
        GameEngine.createGame({
          playerNames: ["Alice", "Bob"],
        })
      ).toThrow("Game requires 3-8 players");
    });

    it("rejects more than 8 players", () => {
      expect(() =>
        GameEngine.createGame({
          playerNames: ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9"],
        })
      ).toThrow("Game requires 3-8 players");
    });

    it("starts in ROUND_ACTIVE phase with AWAITING_DRAW turn phase", () => {
      engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
      });

      const snapshot = engine.getSnapshot();
      expect(snapshot.phase).toBe("ROUND_ACTIVE");
      expect(snapshot.turnPhase).toBe("AWAITING_DRAW");
    });

    it("sets first player (left of dealer) as awaiting player", () => {
      engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
      });

      const snapshot = engine.getSnapshot();
      // Dealer is at index 0, so first player is at index 1
      const expectedFirstPlayer = snapshot.players[(snapshot.dealerIndex + 1) % 3];
      expect(snapshot.awaitingPlayerId).toBe(expectedFirstPlayer!.id);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Persistence & Hydration
  // ═══════════════════════════════════════════════════════════════════════════

  describe("persistence", () => {
    it("can get persisted snapshot for database storage", () => {
      engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
      });

      const persisted = engine.getPersistedSnapshot();

      // Should be a plain object that can be JSON serialized
      expect(persisted).toBeDefined();
      expect(typeof persisted).toBe("object");
      expect(() => JSON.stringify(persisted)).not.toThrow();
    });

    it("can get persisted snapshot as JSON string", () => {
      engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
      });

      const json = engine.toJSON();

      expect(typeof json).toBe("string");
      expect(() => JSON.parse(json)).not.toThrow();
    });

    it("persisted snapshot includes nested actor state", () => {
      engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
      });

      const persisted = engine.getPersistedSnapshot() as any;

      // Should have children (round actor)
      expect(persisted.children).toBeDefined();
      expect(persisted.children.round).toBeDefined();
      expect(persisted.children.round.snapshot).toBeDefined();

      // Round should have children (turn actor)
      expect(persisted.children.round.snapshot.children).toBeDefined();
      expect(persisted.children.round.snapshot.children.turn).toBeDefined();
    });
  });

  describe("hydration", () => {
    it("can restore from persisted snapshot", () => {
      const original = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
      });

      const persisted = original.getPersistedSnapshot();
      const gameId = "test-game-id";
      original.stop();

      // Restore
      engine = GameEngine.fromPersistedSnapshot(persisted, gameId);

      const snapshot = engine.getSnapshot();
      expect(snapshot.players).toHaveLength(3);
      expect(snapshot.gameId).toBe(gameId);
    });

    it("can restore from JSON string", () => {
      const original = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
      });

      const json = original.toJSON();
      original.stop();

      // Restore
      engine = GameEngine.fromJSON(json);

      const snapshot = engine.getSnapshot();
      expect(snapshot.players).toHaveLength(3);
    });

    it("restored game preserves player state", () => {
      const original = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
      });

      const originalSnapshot = original.getSnapshot();
      const persisted = original.getPersistedSnapshot();
      original.stop();

      // Restore
      engine = GameEngine.fromPersistedSnapshot(persisted);

      const restoredSnapshot = engine.getSnapshot();

      // Check players match
      expect(restoredSnapshot.players.length).toBe(originalSnapshot.players.length);
      for (let i = 0; i < restoredSnapshot.players.length; i++) {
        expect(restoredSnapshot.players[i]!.name).toBe(originalSnapshot.players[i]!.name);
        expect(restoredSnapshot.players[i]!.hand.length).toBe(originalSnapshot.players[i]!.hand.length);
      }
    });

    it("restored game can continue receiving commands", () => {
      const original = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
      });

      const persisted = original.getPersistedSnapshot();
      const awaitingPlayerId = original.getSnapshot().awaitingPlayerId;
      original.stop();

      // Restore
      engine = GameEngine.fromPersistedSnapshot(persisted);

      // Continue playing - should work and change state
      engine.drawFromStock(awaitingPlayerId);
      // Verify state changed (player drew)
      expect(engine.getSnapshot().hasDrawn).toBe(true);
    });
  });

  describe("hydration after gameplay", () => {
    it("can hydrate during May I resolution", () => {
      const original = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
      });

      const snapshotBefore = original.getSnapshot();
      const currentPlayerId = snapshotBefore.awaitingPlayerId;

      // Another player calls May I to start resolution
      const callerId = snapshotBefore.players.find((p) => p.id !== currentPlayerId)!.id;
      original.callMayI(callerId);

      // Persist while in May I resolution
      const persisted = original.getPersistedSnapshot();
      original.stop();

      // Hydrate
      engine = GameEngine.fromPersistedSnapshot(persisted);

      const snapshot = engine.getSnapshot();
      expect(snapshot.phase).toBe("RESOLVING_MAY_I");
      expect(snapshot.mayIContext).not.toBeNull();
      expect(snapshot.mayIContext!.originalCaller).toBe(callerId);
      const prompted = snapshot.mayIContext!.playerBeingPrompted;
      if (!prompted) {
        throw new Error("Expected a prompted player during May I resolution");
      }
      expect(snapshot.awaitingPlayerId).toBe(prompted);
    });

    it("can hydrate after skip and discard", () => {
      const original = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
      });

      // Play a turn
      const snapshot1 = original.getSnapshot();
      const playerId = snapshot1.awaitingPlayerId;

      // Draw from stock
      original.drawFromStock(playerId);

      // Skip laydown
      original.skip(playerId);

      // Discard first card
      const snapshot2 = original.getSnapshot();
      const player = snapshot2.players.find((p) => p.id === playerId)!;
      original.discard(playerId, player.hand[0]!.id);

      // Persist
      const persisted = original.getPersistedSnapshot();
      original.stop();

      // Hydrate
      engine = GameEngine.fromPersistedSnapshot(persisted);

      const snapshot3 = engine.getSnapshot();
      // Should be next player's turn now
      expect(snapshot3.awaitingPlayerId).not.toBe(playerId);
    });

    it("JSON roundtrip preserves game state", () => {
      const original = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
      });

      // Make some moves (including May I window resolution)
      const playerId = original.getSnapshot().awaitingPlayerId;
      original.drawFromStock(playerId); // Opens May I window
      original.drawFromStock(playerId); // Pass on May I
      original.skip(playerId);

      const snapshotBefore = original.getSnapshot();

      // Serialize to JSON (like storing in database)
      const json = original.toJSON();
      original.stop();

      // Deserialize (like loading from database)
      engine = GameEngine.fromJSON(json);

      const snapshotAfter = engine.getSnapshot();

      // Compare key fields
      expect(snapshotAfter.currentRound).toBe(snapshotBefore.currentRound);
      expect(snapshotAfter.turnPhase).toBe(snapshotBefore.turnPhase);
      expect(snapshotAfter.awaitingPlayerId).toBe(snapshotBefore.awaitingPlayerId);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Commands
  // ═══════════════════════════════════════════════════════════════════════════

  describe("drawFromStock", () => {
    it("adds a card to player's hand", () => {
      engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
      });

      const snapshotBefore = engine.getSnapshot();
      const playerId = snapshotBefore.awaitingPlayerId;
      const handBefore = snapshotBefore.players.find((p) => p.id === playerId)!.hand.length;

      engine.drawFromStock(playerId);

      const snapshotAfter = engine.getSnapshot();
      const handAfter = snapshotAfter.players.find((p) => p.id === playerId)!.hand.length;
      expect(handAfter).toBe(handBefore + 1);
    });

    it("wrong player - state unchanged", () => {
      engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
      });

      const before = engine.getSnapshot();
      const wrongPlayerId = before.players.find((p) => p.id !== before.awaitingPlayerId)!.id;

      const after = engine.drawFromStock(wrongPlayerId);

      // State unchanged - still in AWAITING_DRAW
      expect(after.turnPhase).toBe("AWAITING_DRAW");
      expect(after.awaitingPlayerId).toBe(before.awaitingPlayerId);
    });
  });

  describe("drawFromDiscard", () => {
    it("takes top card from discard pile", () => {
      engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
      });

      const snapshot = engine.getSnapshot();
      expect(snapshot.discard.length).toBeGreaterThan(0);

      const topDiscard = snapshot.discard[0]!;
      const playerId = snapshot.awaitingPlayerId;

      engine.drawFromDiscard(playerId);

      const snapshotAfter = engine.getSnapshot();

      // Top discard should now be in player's hand
      const player = snapshotAfter.players.find((p) => p.id === playerId)!;
      expect(player.hand.some((c) => c.id === topDiscard.id)).toBe(true);
    });
  });

  describe("skip", () => {
    it("advances to discard phase", () => {
      engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
      });

      const playerId = engine.getSnapshot().awaitingPlayerId;

      // Draw from stock - this opens the May I window
      engine.drawFromStock(playerId);

      // Pass on May I window (call drawFromStock again to decline the discard)
      // This closes the window and moves to "drawn" state
      engine.drawFromStock(playerId);

      // Now we can skip
      engine.skip(playerId);

      expect(engine.getSnapshot().turnPhase).toBe("AWAITING_DISCARD");
    });
  });

  describe("discard", () => {
    it("removes card from hand and adds to discard", () => {
      engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
      });

      const playerId = engine.getSnapshot().awaitingPlayerId;

      // Draw from stock (opens May I window)
      engine.drawFromStock(playerId);
      // Pass on May I (closes window, moves to drawn state)
      engine.drawFromStock(playerId);

      // Skip to discard phase
      engine.skip(playerId);

      // Get a card to discard
      const player = engine.getSnapshot().players.find((p) => p.id === playerId)!;
      const cardToDiscard = player.hand[0]!;

      // Discard
      engine.discard(playerId, cardToDiscard.id);

      const snapshotAfter = engine.getSnapshot();
      // Card should be on top of discard
      expect(snapshotAfter.discard[0]!.id).toBe(cardToDiscard.id);
      // Card should not be in hand
      const playerAfter = snapshotAfter.players.find((p) => p.id === playerId)!;
      expect(playerAfter.hand.some((c) => c.id === cardToDiscard.id)).toBe(false);
    });

    it("advances to next player's turn", () => {
      engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
      });

      const snapshotBefore = engine.getSnapshot();
      const playerId = snapshotBefore.awaitingPlayerId;
      const currentPlayerIndex = snapshotBefore.currentPlayerIndex;

      // Complete a turn (including May I window resolution)
      engine.drawFromStock(playerId); // Opens May I window
      engine.drawFromStock(playerId); // Pass on May I
      engine.skip(playerId);
      const player = engine.getSnapshot().players.find((p) => p.id === playerId)!;
      engine.discard(playerId, player.hand[0]!.id);

      const snapshotAfter = engine.getSnapshot();
      // Should be next player's turn
      const expectedNextIndex = (currentPlayerIndex + 1) % 3;
      expect(snapshotAfter.awaitingPlayerId).toBe(snapshotAfter.players[expectedNextIndex]!.id);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PlayerView
  // ═══════════════════════════════════════════════════════════════════════════

  describe("getPlayerView", () => {
    it("returns the player's own hand", () => {
      engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
      });

      const snapshot = engine.getSnapshot();
      const playerId = snapshot.players[0]!.id;
      const view = engine.getPlayerView(playerId);

      expect(view.yourHand).toHaveLength(11);
      expect(view.yourHand).toEqual(snapshot.players[0]!.hand);
    });

    it("hides other players' hands (only shows count)", () => {
      engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
      });

      const snapshot = engine.getSnapshot();
      const playerId = snapshot.players[0]!.id;
      const view = engine.getPlayerView(playerId);

      expect(view.opponents).toHaveLength(2);
      for (const opponent of view.opponents) {
        expect(opponent.handCount).toBe(11);
        // Should NOT have a 'hand' property
        expect((opponent as any).hand).toBeUndefined();
      }
    });

    it("indicates whether it's the player's turn", () => {
      engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
      });

      const snapshot = engine.getSnapshot();
      const currentPlayerId = snapshot.awaitingPlayerId;
      const otherPlayerId = snapshot.players.find((p) => p.id !== currentPlayerId)!.id;

      const currentView = engine.getPlayerView(currentPlayerId);
      const otherView = engine.getPlayerView(otherPlayerId);

      expect(currentView.isYourTurn).toBe(true);
      expect(otherView.isYourTurn).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // May I Resolution
  // ═══════════════════════════════════════════════════════════════════════════

  describe("May I resolution", () => {
    it("callMayI starts resolution and changes phase", () => {
      engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
      });

      const snapshot = engine.getSnapshot();
      const currentPlayerId = snapshot.awaitingPlayerId;
      // Carol (player-2) calls May I
      const callerId = snapshot.players.find((p) => p.id !== currentPlayerId)!.id;

      engine.callMayI(callerId);

      const afterSnapshot = engine.getSnapshot();
      expect(afterSnapshot.phase).toBe("RESOLVING_MAY_I");
      expect(afterSnapshot.mayIContext).not.toBeNull();
      expect(afterSnapshot.mayIContext?.originalCaller).toBe(callerId);
    });

    it("allowMayI advances to next player in priority", () => {
      engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol", "Dave"],
      });

      const snapshot = engine.getSnapshot();
      const currentPlayerId = snapshot.awaitingPlayerId;
      // Dave (player-3) calls May I
      const callerId = "player-3";

      engine.callMayI(callerId);

      // Current player (player-1) is first in line
      let state = engine.getSnapshot();
      expect(state.mayIContext?.playerBeingPrompted).toBe(currentPlayerId);

      // Current player allows
      engine.allowMayI(currentPlayerId);

      state = engine.getSnapshot();
      // Next player (player-2) should be prompted
      expect(state.mayIContext?.playerBeingPrompted).toBe("player-2");
    });

    it("claimMayI blocks caller and awards card to claimer", () => {
      engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol", "Dave"],
      });

      const snapshot = engine.getSnapshot();
      const currentPlayerId = snapshot.awaitingPlayerId;
      const topDiscard = snapshot.discard[0]!;
      // Dave (player-3) calls May I
      const callerId = "player-3";

      engine.callMayI(callerId);

      // Current player claims instead
      engine.claimMayI(currentPlayerId);

      const afterSnapshot = engine.getSnapshot();
      // Should be back to ROUND_ACTIVE
      expect(afterSnapshot.phase).toBe("ROUND_ACTIVE");
      // Current player should have the claimed card
      const currentPlayer = afterSnapshot.players.find((p) => p.id === currentPlayerId)!;
      expect(currentPlayer.hand.some((c) => c.id === topDiscard.id)).toBe(true);
    });

    it("awaitingPlayerId reflects who is being prompted during resolution", () => {
      engine = GameEngine.createGame({
        playerNames: ["Alice", "Bob", "Carol"],
      });

      const snapshot = engine.getSnapshot();
      const currentPlayerId = snapshot.awaitingPlayerId;
      // Carol (player-2) calls May I
      const callerId = "player-2";

      engine.callMayI(callerId);

      const afterSnapshot = engine.getSnapshot();
      expect(afterSnapshot.mayIContext).not.toBeNull();
      const prompted = afterSnapshot.mayIContext!.playerBeingPrompted;
      if (!prompted) {
        throw new Error("Expected a prompted player during May I resolution");
      }
      // awaitingPlayerId should be the player being prompted
      expect(afterSnapshot.awaitingPlayerId).toBe(prompted);
    });
  });
});
