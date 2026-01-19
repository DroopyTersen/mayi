/**
 * Repro: duplicate card appears when turnContext.discard is missing after draw.
 */

import { describe, it, expect } from "bun:test";
import { GameEngine } from "./game-engine";
import type { GameSnapshot } from "./game-engine.types";

function findDuplicateIds(snapshot: GameSnapshot): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  const addCard = (id: string | undefined) => {
    if (!id) return;
    if (seen.has(id)) {
      duplicates.add(id);
    } else {
      seen.add(id);
    }
  };

  for (const player of snapshot.players) {
    for (const card of player.hand) {
      addCard(card.id);
    }
  }

  for (const card of snapshot.stock) addCard(card.id);
  for (const card of snapshot.discard) addCard(card.id);

  for (const meld of snapshot.table) {
    for (const card of meld.cards) {
      addCard(card.id);
    }
  }

  return [...duplicates];
}

describe("GameEngine turn discard fallback duplicate repro", () => {
  it("does not duplicate discard card when turnContext.discard is missing", () => {
    const engine = GameEngine.createGame({
      playerNames: ["Kate", "Curt", "Jane"],
      startingRound: 1,
    });

    const snapshot1 = engine.getSnapshot();
    const currentPlayerId = snapshot1.players[snapshot1.currentPlayerIndex]?.id;
    if (!currentPlayerId) {
      throw new Error("Expected current player");
    }

    const topDiscardBefore = snapshot1.discard[0];
    if (!topDiscardBefore) {
      throw new Error("Expected a discard card");
    }

    engine.drawFromDiscard(currentPlayerId);

    const persisted = engine.getPersistedSnapshot() as any;
    const turnContext = persisted.children?.round?.snapshot?.children?.turn?.snapshot?.context;
    if (!turnContext) {
      throw new Error("Expected turn context in snapshot");
    }

    // Simulate persistence bug: turnContext.discard missing after draw.
    delete turnContext.discard;

    engine.stop();

    const restored = GameEngine.fromPersistedSnapshot(persisted);
    const snapshot2 = restored.getSnapshot();
    const duplicates = findDuplicateIds(snapshot2);

    // Expected: no duplicates in snapshot.
    expect(duplicates).toEqual([]);

    restored.stop();
  });
});
