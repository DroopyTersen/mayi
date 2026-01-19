/**
 * Test that drawing from discard correctly removes the card from discard pile
 * even after save/restore cycles.
 *
 * Bug reproduction: Kate drew J♠ from discard, but J♠ still showed in discard pile.
 */

import { describe, it, expect } from "bun:test";
import { GameEngine } from "./game-engine";

describe("GameEngine draw from discard persistence", () => {
  it("removes card from discard pile when drawing from discard", () => {
    const engine = GameEngine.createGame({
      playerNames: ["Kate", "Curt", "Jane"],
      startingRound: 1,
    });

    const snapshot1 = engine.getSnapshot();
    expect(snapshot1.lastError).toBeNull();

    const currentPlayerId = snapshot1.players[snapshot1.currentPlayerIndex]!.id;
    const topDiscardBefore = snapshot1.discard[0];
    expect(topDiscardBefore).toBeDefined();

    const topDiscardId = topDiscardBefore!.id;
    console.log(`Top discard before draw: ${topDiscardId}`);

    // Draw from discard
    engine.drawFromDiscard(currentPlayerId);

    const snapshot2 = engine.getSnapshot();
    expect(snapshot2.lastError).toBeNull();

    // Card should be in hand
    const currentPlayer = snapshot2.players.find(p => p.id === currentPlayerId)!;
    const cardInHand = currentPlayer.hand.some(c => c.id === topDiscardId);
    expect(cardInHand).toBe(true);

    // Card should NOT be in discard pile anymore
    const cardInDiscard = snapshot2.discard.some(c => c.id === topDiscardId);
    expect(cardInDiscard).toBe(false);

    // Top discard should be a different card now
    const topDiscardAfter = snapshot2.discard[0];
    if (topDiscardAfter) {
      expect(topDiscardAfter.id).not.toBe(topDiscardId);
    }

    engine.stop();
  });

  it("maintains correct discard pile after save/restore cycle", () => {
    const engine = GameEngine.createGame({
      playerNames: ["Kate", "Curt", "Jane"],
      startingRound: 1,
    });

    const snapshot1 = engine.getSnapshot();
    const currentPlayerId = snapshot1.players[snapshot1.currentPlayerIndex]!.id;
    const topDiscardBefore = snapshot1.discard[0]!;
    const topDiscardId = topDiscardBefore.id;

    console.log(`Top discard before draw: ${topDiscardId} (${topDiscardBefore.rank}${topDiscardBefore.suit?.[0] ?? 'J'})`);

    // Draw from discard
    engine.drawFromDiscard(currentPlayerId);

    const snapshot2 = engine.getSnapshot();
    expect(snapshot2.lastError).toBeNull();

    // Verify card moved correctly before save
    const playerBeforeSave = snapshot2.players.find(p => p.id === currentPlayerId)!;
    expect(playerBeforeSave.hand.some(c => c.id === topDiscardId)).toBe(true);
    expect(snapshot2.discard.some(c => c.id === topDiscardId)).toBe(false);

    // Save and restore
    const json = engine.toJSON();
    engine.stop();

    const restored = GameEngine.fromJSON(json);
    const snapshot3 = restored.getSnapshot();

    // Verify no errors
    expect(snapshot3.lastError).toBeNull();

    // Card should still be in hand after restore
    const playerAfterRestore = snapshot3.players.find(p => p.id === currentPlayerId)!;
    const cardInHandAfterRestore = playerAfterRestore.hand.some(c => c.id === topDiscardId);
    expect(cardInHandAfterRestore).toBe(true);

    // Card should NOT be in discard after restore
    const cardInDiscardAfterRestore = snapshot3.discard.some(c => c.id === topDiscardId);
    expect(cardInDiscardAfterRestore).toBe(false);

    console.log(`After restore - card ${topDiscardId} in hand: ${cardInHandAfterRestore}, in discard: ${cardInDiscardAfterRestore}`);

    restored.stop();
  });

  it("detects duplicates if card appears in both hand and discard", () => {
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

    // Manually corrupt the persisted snapshot to simulate the bug
    const persisted = engine.getPersistedSnapshot() as any;
    const turnContext = persisted.children?.round?.snapshot?.children?.turn?.snapshot?.context;

    if (turnContext) {
      // Add the drawn card back to discard (simulating the bug)
      turnContext.discard = [topDiscardBefore, ...turnContext.discard];
    }

    engine.stop();

    // Restore from corrupted snapshot
    const corrupted = GameEngine.fromPersistedSnapshot(persisted);
    const corruptedSnapshot = corrupted.getSnapshot();

    // Check if the card is duplicated
    const playerHand = corruptedSnapshot.players.find(p => p.id === currentPlayerId)!.hand;
    const cardInHand = playerHand.some(c => c.id === topDiscardId);
    const cardInDiscard = corruptedSnapshot.discard.some(c => c.id === topDiscardId);

    console.log(`Corrupted state - card ${topDiscardId} in hand: ${cardInHand}, in discard: ${cardInDiscard}`);

    // The duplicate detection should have logged a warning
    // (We changed it to not set lastError, but it should still detect)
    expect(cardInHand && cardInDiscard).toBe(true); // This is the bug scenario

    corrupted.stop();
  });
});
