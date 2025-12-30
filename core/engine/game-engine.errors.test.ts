/**
 * GameEngine error + playerId behavior
 *
 * TDD: These tests lock in two requirements needed by the CLI adapter:
 * 1) GameSnapshot exposes machine error information (`lastError`)
 * 2) Commands are ignored when `playerId` is not the current actor
 */

import { describe, it, expect } from "bun:test";
import { GameEngine } from "./game-engine";

describe("GameEngine - errors and playerId enforcement", () => {
  it("exposes lastError from the underlying machine in GameSnapshot", () => {
    const engine = GameEngine.createGame({
      playerNames: ["Alice", "Bob", "Carol"],
    });

    const currentPlayerId = engine.getSnapshot().awaitingPlayerId;

    // Draw so we're in a state where LAY_DOWN is handled (and can set lastError)
    engine.drawFromStock(currentPlayerId);

    const hand = engine
      .getSnapshot()
      .players.find((p) => p.id === currentPlayerId)!.hand;

    // Invalid laydown: Round 1 contract requires 2 sets, but we provide only 1.
    const after = engine.layDown(currentPlayerId, [
      { type: "set", cardIds: hand.slice(0, 3).map((c) => c.id) },
    ]);

    expect((after as any).lastError).toContain("contract requires");
  });

  it("ignores turn actions from the wrong playerId", () => {
    const engine = GameEngine.createGame({
      playerNames: ["Alice", "Bob", "Carol"],
    });

    const snapshot = engine.getSnapshot();
    const currentPlayerId = snapshot.awaitingPlayerId;
    const wrongPlayerId = snapshot.players.find((p) => p.id !== currentPlayerId)!.id;

    engine.drawFromStock(currentPlayerId);
    expect(engine.getSnapshot().turnPhase).toBe("AWAITING_ACTION");

    // Should be ignored because wrongPlayerId is not the current turn owner
    engine.skip(wrongPlayerId);

    expect(engine.getSnapshot().turnPhase).toBe("AWAITING_ACTION");
  });
});

