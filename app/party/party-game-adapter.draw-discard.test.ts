/**
 * Test that drawing from discard works correctly through PartyGameAdapter.
 *
 * Bug reproduction: Kate drew J♠ from discard, but J♠ still showed in discard pile.
 */

import { describe, it, expect } from "bun:test";
import { PartyGameAdapter } from "./party-game-adapter";

describe("PartyGameAdapter draw from discard", () => {
  function createTestAdapter(): PartyGameAdapter {
    return PartyGameAdapter.createFromLobby({
      roomId: "test-room",
      humanPlayers: [
        { playerId: "kate", name: "Kate", avatarId: "kate", isConnected: true, disconnectedAt: null },
        { playerId: "curt", name: "Curt", avatarId: "curt", isConnected: true, disconnectedAt: null },
        { playerId: "jane", name: "Jane", avatarId: "jane", isConnected: true, disconnectedAt: null },
      ],
      aiPlayers: [],
      startingRound: 1,
    });
  }

  it("removes card from discard pile when drawing from discard", () => {
    const adapter = createTestAdapter();
    const snapshot1 = adapter.getSnapshot();
    expect(snapshot1.lastError).toBeNull();

    const awaitingLobbyId = adapter.getAwaitingLobbyPlayerId();
    expect(awaitingLobbyId).toBeDefined();

    const topDiscardBefore = snapshot1.discard[0];
    expect(topDiscardBefore).toBeDefined();
    const topDiscardId = topDiscardBefore!.id;

    console.log(`[Adapter] Top discard before draw: ${topDiscardId}`);

    // Draw from discard
    adapter.drawFromDiscard(awaitingLobbyId!);

    const snapshot2 = adapter.getSnapshot();
    expect(snapshot2.lastError).toBeNull();

    // Card should NOT be in discard pile anymore
    const cardInDiscard = snapshot2.discard.some(c => c.id === topDiscardId);
    expect(cardInDiscard).toBe(false);

    // Card should be in current player's hand
    const engineId = adapter.lobbyIdToEngineId(awaitingLobbyId!);
    const player = snapshot2.players.find(p => p.id === engineId);
    const cardInHand = player?.hand.some(c => c.id === topDiscardId);
    expect(cardInHand).toBe(true);

    adapter.stop();
  });

  it("maintains correct discard after save/restore cycle", () => {
    const adapter1 = createTestAdapter();
    const snapshot1 = adapter1.getSnapshot();

    const awaitingLobbyId = adapter1.getAwaitingLobbyPlayerId()!;
    const topDiscardBefore = snapshot1.discard[0]!;
    const topDiscardId = topDiscardBefore.id;

    console.log(`[Adapter] Top discard before draw: ${topDiscardId}`);

    // Draw from discard
    adapter1.drawFromDiscard(awaitingLobbyId);

    const snapshot2 = adapter1.getSnapshot();
    expect(snapshot2.lastError).toBeNull();
    expect(snapshot2.discard.some(c => c.id === topDiscardId)).toBe(false);

    // Save state
    const stored = adapter1.getStoredState();
    adapter1.stop();

    // Restore state
    const adapter2 = PartyGameAdapter.fromStoredState(stored);
    const snapshot3 = adapter2.getSnapshot();

    expect(snapshot3.lastError).toBeNull();

    // Card should still NOT be in discard after restore
    const cardInDiscardAfterRestore = snapshot3.discard.some(c => c.id === topDiscardId);
    expect(cardInDiscardAfterRestore).toBe(false);

    // Card should still be in hand after restore
    const engineId = adapter2.lobbyIdToEngineId(awaitingLobbyId);
    const player = snapshot3.players.find(p => p.id === engineId);
    const cardInHandAfterRestore = player?.hand.some(c => c.id === topDiscardId);
    expect(cardInHandAfterRestore).toBe(true);

    console.log(`[Adapter] After restore - card ${topDiscardId} in hand: ${cardInHandAfterRestore}, in discard: ${cardInDiscardAfterRestore}`);

    adapter2.stop();
  });

  it("maintains correct state through multiple save/restore cycles", () => {
    let adapter = createTestAdapter();

    // First cycle: draw from discard
    const awaitingLobbyId = adapter.getAwaitingLobbyPlayerId()!;
    const topDiscardBefore = adapter.getSnapshot().discard[0]!;
    const drawnCardId = topDiscardBefore.id;

    adapter.drawFromDiscard(awaitingLobbyId);

    // Save and restore multiple times
    for (let i = 0; i < 5; i++) {
      const snapshot = adapter.getSnapshot();
      if (snapshot.lastError) {
        throw new Error(`Cycle ${i}: ${snapshot.lastError}`);
      }

      // Verify card location on each cycle
      const cardInDiscard = snapshot.discard.some(c => c.id === drawnCardId);
      const engineId = adapter.lobbyIdToEngineId(awaitingLobbyId);
      const player = snapshot.players.find(p => p.id === engineId);
      const cardInHand = player?.hand.some(c => c.id === drawnCardId);

      console.log(`[Adapter] Cycle ${i} - card ${drawnCardId} in hand: ${cardInHand}, in discard: ${cardInDiscard}`);

      expect(cardInDiscard).toBe(false);
      expect(cardInHand).toBe(true);

      // Save and restore
      const stored = adapter.getStoredState();
      adapter.stop();
      adapter = PartyGameAdapter.fromStoredState(stored);
    }

    adapter.stop();
  });
});
