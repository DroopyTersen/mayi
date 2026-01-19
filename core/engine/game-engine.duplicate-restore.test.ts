/**
 * Test that restoring a game from JSON doesn't create duplicate cards.
 */

import { describe, it, expect } from "bun:test";
import { GameEngine } from "./game-engine";

describe("GameEngine restore without duplicates", () => {
  it("restoring from JSON does not create duplicate card IDs", () => {
    // Create a fresh game
    const engine = GameEngine.createGame({
      playerNames: ["Kate", "Curt", "Jane"],
      startingRound: 1,
    });

    const initialSnapshot = engine.getSnapshot();
    expect(initialSnapshot.lastError).toBeNull();

    // Serialize to JSON
    const json = engine.toJSON();
    engine.stop();

    // Restore from JSON
    const restored = GameEngine.fromJSON(json);
    const restoredSnapshot = restored.getSnapshot();

    // Should have no duplicate errors
    expect(restoredSnapshot.lastError).toBeNull();

    // All card counts should match
    expect(restoredSnapshot.stock.length).toBe(initialSnapshot.stock.length);
    expect(restoredSnapshot.discard.length).toBe(initialSnapshot.discard.length);
    expect(restoredSnapshot.players.length).toBe(initialSnapshot.players.length);

    restored.stop();
  });

  it("draw action followed by restore does not create duplicates", () => {
    // Create a fresh game
    const engine = GameEngine.createGame({
      playerNames: ["Kate", "Curt", "Jane"],
      startingRound: 1,
    });

    // Get current player and draw
    const snapshot1 = engine.getSnapshot();
    const currentPlayerId = snapshot1.players[snapshot1.currentPlayerIndex]!.id;
    engine.drawFromStock(currentPlayerId);

    const snapshot2 = engine.getSnapshot();
    expect(snapshot2.lastError).toBeNull();

    // Serialize and restore
    const json = engine.toJSON();
    engine.stop();

    const restored = GameEngine.fromJSON(json);
    const restoredSnapshot = restored.getSnapshot();

    // Should have no duplicate errors
    expect(restoredSnapshot.lastError).toBeNull();

    restored.stop();
  });

  it("draw and discard followed by restore does not create duplicates", () => {
    // Create a fresh game
    const engine = GameEngine.createGame({
      playerNames: ["Kate", "Curt", "Jane"],
      startingRound: 1,
    });

    // Get current player and draw
    const snapshot1 = engine.getSnapshot();
    const currentPlayerId = snapshot1.players[snapshot1.currentPlayerIndex]!.id;
    engine.drawFromStock(currentPlayerId);

    // Discard first card
    const snapshot2 = engine.getSnapshot();
    expect(snapshot2.lastError).toBeNull();
    const currentPlayer = snapshot2.players.find(p => p.id === currentPlayerId)!;
    const cardToDiscard = currentPlayer.hand[0]!;
    engine.discard(currentPlayerId, cardToDiscard.id);

    const snapshot3 = engine.getSnapshot();
    expect(snapshot3.lastError).toBeNull();

    // Serialize and restore
    const json = engine.toJSON();
    engine.stop();

    const restored = GameEngine.fromJSON(json);
    const restoredSnapshot = restored.getSnapshot();

    // Should have no duplicate errors
    expect(restoredSnapshot.lastError).toBeNull();

    restored.stop();
  });

  it("multiple restore cycles do not accumulate duplicates", () => {
    let engine = GameEngine.createGame({
      playerNames: ["Kate", "Curt", "Jane"],
      startingRound: 1,
    });

    // Do multiple serialize/restore cycles
    for (let i = 0; i < 5; i++) {
      const snapshot = engine.getSnapshot();
      expect(snapshot.lastError).toBeNull();

      // Draw and discard for current player
      const currentPlayerId = snapshot.players[snapshot.currentPlayerIndex]!.id;

      if (snapshot.turnPhase === "AWAITING_DRAW") {
        engine.drawFromStock(currentPlayerId);
      }

      const afterDraw = engine.getSnapshot();
      if (afterDraw.lastError) {
        throw new Error(`Cycle ${i}: Error after draw: ${afterDraw.lastError}`);
      }

      const player = afterDraw.players.find(p => p.id === currentPlayerId)!;
      engine.discard(currentPlayerId, player.hand[0]!.id);

      const afterDiscard = engine.getSnapshot();
      if (afterDiscard.lastError) {
        throw new Error(`Cycle ${i}: Error after discard: ${afterDiscard.lastError}`);
      }

      // Serialize and restore
      const json = engine.toJSON();
      engine.stop();
      engine = GameEngine.fromJSON(json);
    }

    const finalSnapshot = engine.getSnapshot();
    expect(finalSnapshot.lastError).toBeNull();
    engine.stop();
  });
});
