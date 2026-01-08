/**
 * Unit tests for round-level REORDER_HAND handling
 *
 * Tests that hand reordering:
 * - Works during a player's own turn (current player)
 * - Works during another player's turn (non-current player)
 * - Properly syncs to turn machine when reordering current player's hand
 * - Validates card ownership and completeness
 */

import { describe, it, expect } from "bun:test";
import { GameEngine } from "./game-engine";

describe("Round Machine - REORDER_HAND", () => {
  describe("during own turn", () => {
    it("allows reordering hand during AWAITING_DRAW phase", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Human", "AI Alice", "AI Bob"],
      });

      const before = engine.getSnapshot();
      expect(before.turnPhase).toBe("AWAITING_DRAW");

      const currentPlayerId = before.awaitingPlayerId;
      const player = before.players.find((p) => p.id === currentPlayerId)!;
      const originalOrder = player.hand.map((c) => c.id);

      // Reverse the hand order
      const newOrder = [...originalOrder].reverse();
      engine.reorderHand(currentPlayerId, newOrder);

      const after = engine.getSnapshot();
      const playerAfter = after.players.find((p) => p.id === currentPlayerId)!;
      expect(playerAfter.hand.map((c) => c.id)).toEqual(newOrder);
      // Turn phase should be unchanged (reorder is a free action)
      expect(after.turnPhase).toBe("AWAITING_DRAW");
    });

    it("allows reordering hand during AWAITING_ACTION phase", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Human", "AI Alice", "AI Bob"],
      });

      const before = engine.getSnapshot();
      const currentPlayerId = before.awaitingPlayerId;

      // Draw to advance to AWAITING_ACTION
      engine.drawFromStock(currentPlayerId);

      const mid = engine.getSnapshot();
      expect(mid.turnPhase).toBe("AWAITING_ACTION");

      // Get hand AFTER draw (now has 12 cards)
      const player = mid.players.find((p) => p.id === currentPlayerId)!;
      const originalOrder = player.hand.map((c) => c.id);
      const newOrder = [...originalOrder].reverse();

      engine.reorderHand(currentPlayerId, newOrder);

      const after = engine.getSnapshot();
      const playerAfter = after.players.find((p) => p.id === currentPlayerId)!;
      expect(playerAfter.hand.map((c) => c.id)).toEqual(newOrder);
      expect(after.turnPhase).toBe("AWAITING_ACTION");
    });

    it("allows reordering hand during AWAITING_DISCARD phase", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Human", "AI Alice", "AI Bob"],
      });

      const before = engine.getSnapshot();
      const currentPlayerId = before.awaitingPlayerId;

      // Draw and skip to AWAITING_DISCARD
      engine.drawFromStock(currentPlayerId);
      engine.skip(currentPlayerId);

      const mid = engine.getSnapshot();
      expect(mid.turnPhase).toBe("AWAITING_DISCARD");

      const player = mid.players.find((p) => p.id === currentPlayerId)!;
      const originalOrder = player.hand.map((c) => c.id);
      const newOrder = [...originalOrder].reverse();

      engine.reorderHand(currentPlayerId, newOrder);

      const after = engine.getSnapshot();
      const playerAfter = after.players.find((p) => p.id === currentPlayerId)!;
      expect(playerAfter.hand.map((c) => c.id)).toEqual(newOrder);
      expect(after.turnPhase).toBe("AWAITING_DISCARD");
    });
  });

  describe("during other player's turn", () => {
    it("allows non-current player to reorder their hand", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Human", "AI Alice", "AI Bob"],
      });

      const before = engine.getSnapshot();
      const currentPlayerId = before.awaitingPlayerId;

      // Find a non-current player
      const nonCurrentPlayer = before.players.find((p) => p.id !== currentPlayerId)!;
      const originalOrder = nonCurrentPlayer.hand.map((c) => c.id);
      const newOrder = [...originalOrder].reverse();

      engine.reorderHand(nonCurrentPlayer.id, newOrder);

      const after = engine.getSnapshot();
      const playerAfter = after.players.find((p) => p.id === nonCurrentPlayer.id)!;
      expect(playerAfter.hand.map((c) => c.id)).toEqual(newOrder);
      // Turn should still be the original player's
      expect(after.awaitingPlayerId).toBe(currentPlayerId);
      expect(after.turnPhase).toBe("AWAITING_DRAW");
    });

    it("does not affect current player's turn state when non-current player reorders", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Human", "AI Alice", "AI Bob"],
      });

      const before = engine.getSnapshot();
      const currentPlayerId = before.awaitingPlayerId;

      // Advance current player to AWAITING_ACTION
      engine.drawFromStock(currentPlayerId);
      const mid = engine.getSnapshot();
      expect(mid.turnPhase).toBe("AWAITING_ACTION");

      // Non-current player reorders their hand
      const nonCurrentPlayer = mid.players.find((p) => p.id !== currentPlayerId)!;
      const originalOrder = nonCurrentPlayer.hand.map((c) => c.id);
      const newOrder = [...originalOrder].reverse();

      engine.reorderHand(nonCurrentPlayer.id, newOrder);

      const after = engine.getSnapshot();
      // Non-current player's hand is reordered
      const playerAfter = after.players.find((p) => p.id === nonCurrentPlayer.id)!;
      expect(playerAfter.hand.map((c) => c.id)).toEqual(newOrder);
      // Turn state is unchanged
      expect(after.awaitingPlayerId).toBe(currentPlayerId);
      expect(after.turnPhase).toBe("AWAITING_ACTION");
    });
  });

  describe("validation", () => {
    it("rejects reorder with wrong card IDs", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Human", "AI Alice", "AI Bob"],
      });

      const before = engine.getSnapshot();
      const currentPlayerId = before.awaitingPlayerId;
      const player = before.players.find((p) => p.id === currentPlayerId)!;
      const originalOrder = player.hand.map((c) => c.id);

      // Try to reorder with cards that don't exist in hand
      engine.reorderHand(currentPlayerId, ["wrong1", "wrong2", "wrong3"]);

      const after = engine.getSnapshot();
      // Hand should be unchanged
      const playerAfter = after.players.find((p) => p.id === currentPlayerId)!;
      expect(playerAfter.hand.map((c) => c.id)).toEqual(originalOrder);
    });

    it("rejects reorder with duplicate card IDs", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Human", "AI Alice", "AI Bob"],
      });

      const before = engine.getSnapshot();
      const currentPlayerId = before.awaitingPlayerId;
      const player = before.players.find((p) => p.id === currentPlayerId)!;
      const originalOrder = player.hand.map((c) => c.id);
      const firstCardId = originalOrder[0]!;

      // Try to reorder with duplicate cards
      engine.reorderHand(currentPlayerId, Array(originalOrder.length).fill(firstCardId));

      const after = engine.getSnapshot();
      // Hand should be unchanged
      const playerAfter = after.players.find((p) => p.id === currentPlayerId)!;
      expect(playerAfter.hand.map((c) => c.id)).toEqual(originalOrder);
    });

    it("rejects reorder with missing cards", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Human", "AI Alice", "AI Bob"],
      });

      const before = engine.getSnapshot();
      const currentPlayerId = before.awaitingPlayerId;
      const player = before.players.find((p) => p.id === currentPlayerId)!;
      const originalOrder = player.hand.map((c) => c.id);

      // Try to reorder with only partial cards
      engine.reorderHand(currentPlayerId, originalOrder.slice(0, 2));

      const after = engine.getSnapshot();
      // Hand should be unchanged
      const playerAfter = after.players.find((p) => p.id === currentPlayerId)!;
      expect(playerAfter.hand.map((c) => c.id)).toEqual(originalOrder);
    });

    it("rejects reorder for non-existent player", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Human", "AI Alice", "AI Bob"],
      });

      const before = engine.getSnapshot();

      // Try to reorder for a non-existent player
      engine.reorderHand("non-existent-player", ["c1", "c2", "c3"]);

      const after = engine.getSnapshot();
      // All hands should be unchanged
      for (let i = 0; i < before.players.length; i++) {
        expect(after.players[i]!.hand.map((c) => c.id)).toEqual(
          before.players[i]!.hand.map((c) => c.id)
        );
      }
    });
  });

  describe("current player sync", () => {
    it("syncs reordered hand to turn machine when current player reorders", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Human", "AI Alice", "AI Bob"],
      });

      const before = engine.getSnapshot();
      const currentPlayerId = before.awaitingPlayerId;

      // Draw first to have the turn machine fully active
      engine.drawFromStock(currentPlayerId);

      const mid = engine.getSnapshot();
      const player = mid.players.find((p) => p.id === currentPlayerId)!;
      const originalOrder = player.hand.map((c) => c.id);
      const newOrder = [...originalOrder].reverse();

      // Reorder while it's your turn
      engine.reorderHand(currentPlayerId, newOrder);

      // The turn can continue normally after reorder
      engine.skip(currentPlayerId);

      const afterSkip = engine.getSnapshot();
      expect(afterSkip.turnPhase).toBe("AWAITING_DISCARD");

      // Hand order is preserved
      const playerAfterSkip = afterSkip.players.find((p) => p.id === currentPlayerId)!;
      expect(playerAfterSkip.hand.map((c) => c.id)).toEqual(newOrder);

      // Can discard successfully from the reordered hand
      const cardToDiscard = newOrder[0]!;
      engine.discard(currentPlayerId, cardToDiscard);

      const afterDiscard = engine.getSnapshot();
      const playerAfterDiscard = afterDiscard.players.find((p) => p.id === currentPlayerId)!;
      expect(playerAfterDiscard.hand.map((c) => c.id)).toEqual(newOrder.slice(1));
    });
  });

  describe("availability", () => {
    it("canReorderHand is true during ROUND_ACTIVE phase for any player", () => {
      const engine = GameEngine.createGame({
        playerNames: ["Human", "AI Alice", "AI Bob"],
      });

      const snapshot = engine.getSnapshot();

      // Check for current player
      const currentPlayerView = engine.getPlayerView(snapshot.awaitingPlayerId);
      expect(currentPlayerView.availableActions.canReorderHand).toBe(true);

      // Check for non-current player
      const nonCurrentPlayer = snapshot.players.find((p) => p.id !== snapshot.awaitingPlayerId)!;
      const nonCurrentPlayerView = engine.getPlayerView(nonCurrentPlayer.id);
      expect(nonCurrentPlayerView.availableActions.canReorderHand).toBe(true);
    });
  });
});
