/**
 * Test that turnContext.discard is properly populated after drawing from discard.
 *
 * Bug hypothesis: turnContext.discard might be undefined, causing fallback to
 * roundContext.discard which still has the drawn card.
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

    console.log(`Top discard before: ${topDiscardId}`);
    console.log(`Discard count before: ${snapshot1.discard.length}`);

    // Draw from discard
    engine.drawFromDiscard(currentPlayerId);

    // Get persisted snapshot to examine raw structure
    const persisted = engine.getPersistedSnapshot() as any;
    const turnContext = persisted.children?.round?.snapshot?.children?.turn?.snapshot?.context;
    const roundContext = persisted.children?.round?.snapshot?.context;

    console.log(`turnContext exists: ${!!turnContext}`);
    console.log(`turnContext.discard exists: ${turnContext?.discard !== undefined}`);
    console.log(`turnContext.discard length: ${turnContext?.discard?.length}`);
    console.log(`roundContext.discard exists: ${roundContext?.discard !== undefined}`);
    console.log(`roundContext.discard length: ${roundContext?.discard?.length}`);

    // Check if turnContext.discard is defined
    expect(turnContext).toBeDefined();
    expect(turnContext.discard).toBeDefined();
    expect(Array.isArray(turnContext.discard)).toBe(true);

    // Card should NOT be in turnContext.discard
    const cardInTurnDiscard = turnContext.discard.some(
      (c: { id: string }) => c.id === topDiscardId
    );
    expect(cardInTurnDiscard).toBe(false);

    // Card SHOULD be in turnContext.hand
    const cardInTurnHand = turnContext.hand.some(
      (c: { id: string }) => c.id === topDiscardId
    );
    expect(cardInTurnHand).toBe(true);

    // roundContext.discard might still have the old card (it's not updated until turn ends)
    // But extractGameSnapshot should prefer turnContext.discard
    console.log(
      `Card ${topDiscardId} in turnContext.discard: ${cardInTurnDiscard}`
    );
    console.log(`Card ${topDiscardId} in turnContext.hand: ${cardInTurnHand}`);

    // The extracted snapshot should show the correct discard
    const snapshot2 = engine.getSnapshot();
    const cardInSnapshotDiscard = snapshot2.discard.some(
      (c) => c.id === topDiscardId
    );
    expect(cardInSnapshotDiscard).toBe(false);

    console.log(
      `Card ${topDiscardId} in extracted snapshot.discard: ${cardInSnapshotDiscard}`
    );

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

    console.log(`After restore - turnContext exists: ${!!turnContext}`);
    console.log(`After restore - turnContext.discard exists: ${turnContext?.discard !== undefined}`);
    console.log(`After restore - turnContext.discard length: ${turnContext?.discard?.length}`);

    // turnContext.discard should still be defined and correct
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

    console.log(
      `After restore - Card ${topDiscardId} in snapshot.discard: ${cardInSnapshotDiscard}`
    );

    restored.stop();
  });
});
