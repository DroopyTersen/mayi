/**
 * Tests that drawing from discard updates both round-owned card state and the
 * active turn actor's local copy.
 */

import { describe, it, expect } from "bun:test";
import { GameEngine } from "./game-engine";

describe("GameEngine turnContext.discard population", () => {
  it("turnContext.discard is defined after draw from discard", () => {
    const engine = GameEngine.createGame({
      playerNames: ["Kate", "Curt", "Jane"],
      startingRound: 1,
    });

    const snapshot1 = engine.getSnapshot();
    const currentPlayerId = snapshot1.players[snapshot1.currentPlayerIndex]!.id;
    const topDiscardBefore = snapshot1.discard[0]!;
    const topDiscardId = topDiscardBefore.id;

    engine.drawFromDiscard(currentPlayerId);

    // Get persisted snapshot to examine raw structure
    const persisted = engine.getPersistedSnapshot() as any;
    const turnContext = persisted.children?.round?.snapshot?.children?.turn?.snapshot?.context;
    const roundContext = persisted.children?.round?.snapshot?.context;

    expect(turnContext).toBeDefined();
    expect(turnContext.discard).toBeDefined();
    expect(Array.isArray(turnContext.discard)).toBe(true);
    expect(roundContext).toBeDefined();
    expect(roundContext.discard).toBeDefined();
    expect(Array.isArray(roundContext.discard)).toBe(true);

    const cardInTurnDiscard = turnContext.discard.some(
      (c: { id: string }) => c.id === topDiscardId
    );
    expect(cardInTurnDiscard).toBe(false);

    const cardInTurnHand = turnContext.hand.some(
      (c: { id: string }) => c.id === topDiscardId
    );
    expect(cardInTurnHand).toBe(true);

    const cardInRoundDiscard = roundContext.discard.some(
      (c: { id: string }) => c.id === topDiscardId
    );
    expect(cardInRoundDiscard).toBe(false);

    // The extracted snapshot should show the correct discard
    const snapshot2 = engine.getSnapshot();
    const cardInSnapshotDiscard = snapshot2.discard.some(
      (c) => c.id === topDiscardId
    );
    expect(cardInSnapshotDiscard).toBe(false);

    engine.stop();
  });

  it("after save/restore, turnContext.discard is still correct", () => {
    const engine = GameEngine.createGame({
      playerNames: ["Kate", "Curt", "Jane"],
      startingRound: 1,
    });

    const snapshot1 = engine.getSnapshot();
    const currentPlayerId = snapshot1.players[snapshot1.currentPlayerIndex]!.id;
    const topDiscardBefore = snapshot1.discard[0]!;
    const topDiscardId = topDiscardBefore.id;

    // Draw from discard
    engine.drawFromDiscard(currentPlayerId);

    // Save and restore
    const json = engine.toJSON();
    engine.stop();

    const restored = GameEngine.fromJSON(json);

    // Get persisted snapshot of restored engine
    const persisted = restored.getPersistedSnapshot() as any;
    const turnContext = persisted.children?.round?.snapshot?.children?.turn?.snapshot?.context;

    expect(turnContext).toBeDefined();
    expect(turnContext.discard).toBeDefined();

    const cardInTurnDiscard = turnContext.discard.some(
      (c: { id: string }) => c.id === topDiscardId
    );
    expect(cardInTurnDiscard).toBe(false);

    // Extracted snapshot should also be correct
    const snapshot2 = restored.getSnapshot();
    const cardInSnapshotDiscard = snapshot2.discard.some(
      (c) => c.id === topDiscardId
    );
    expect(cardInSnapshotDiscard).toBe(false);

    restored.stop();
  });
});
