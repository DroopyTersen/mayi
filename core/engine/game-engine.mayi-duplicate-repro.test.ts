/**
 * Manufactured May-I duplicate snapshot repro.
 *
 * This test simulates a May-I sequence, then mutates the persisted snapshot
 * to introduce a duplicate card ID. The duplicate detection now logs a warning
 * but does NOT set lastError (because that would cause valid actions to fail).
 */

import { describe, it, expect } from "bun:test";
import { GameEngine } from "./game-engine";

describe("GameEngine May-I duplicate snapshot repro", () => {
  it("logs warning for duplicates in corrupted May-I snapshot but does not set lastError", () => {
    // Duplicate detection logs a warning but doesn't set lastError,
    // because setting lastError would cause game-actions.ts to treat
    // valid actions as failed (see specs/may-i-bugs.bug.md).
    const engine = GameEngine.createGame({
      playerNames: ["Mom", "Dad", "Jane"],
      startingRound: 5,
    });

    const initial = engine.getSnapshot();
    const callerId = initial.players[2]?.id;
    const currentPlayerId = initial.players[initial.currentPlayerIndex]?.id;
    if (!callerId || !currentPlayerId) {
      throw new Error("Expected players for May-I setup");
    }

    engine.callMayI(callerId);
    const afterCall = engine.getSnapshot();
    const promptedId = afterCall.mayIContext?.playerBeingPrompted;
    if (!promptedId) {
      throw new Error("Expected a prompted player after May-I call");
    }

    engine.allowMayI(promptedId);

    const persisted = engine.getPersistedSnapshot() as any;
    const roundSnapshot = persisted.children?.round?.snapshot;
    const roundContext = roundSnapshot?.context;
    const turnContext = roundSnapshot?.children?.turn?.snapshot?.context;

    const discardPile = turnContext?.discard ?? roundContext?.discard;
    const stockPile = turnContext?.stock ?? roundContext?.stock;
    const hand = turnContext?.hand ?? roundContext?.players?.[0]?.hand;

    if (!Array.isArray(hand)) {
      throw new Error("Expected hand in persisted snapshot");
    }

    const duplicateCard =
      (Array.isArray(discardPile) ? discardPile[0] : undefined) ??
      (Array.isArray(stockPile) ? stockPile[0] : undefined) ??
      hand[0];

    if (!duplicateCard) {
      throw new Error("Expected a card to duplicate in persisted snapshot");
    }
    if (turnContext) {
      turnContext.hand = [...hand, duplicateCard];
    } else if (roundContext?.players?.[0]) {
      roundContext.players[0].hand = [...hand, duplicateCard];
    }

    engine.stop();
    const restored = GameEngine.fromPersistedSnapshot(persisted);
    const restoredSnapshot = restored.getSnapshot();

    // Warning is logged to console.warn but lastError is NOT set
    // This allows the game to continue even when duplicates are detected
    expect(restoredSnapshot.lastError).toBeNull();
    restored.stop();
  });
});
