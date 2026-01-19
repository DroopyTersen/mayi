/**
 * Test that PartyGameAdapter operations don't create duplicate cards.
 */

import { describe, it, expect } from "bun:test";
import { PartyGameAdapter } from "./party-game-adapter";

describe("PartyGameAdapter duplicate detection", () => {
  function createTestAdapter(): PartyGameAdapter {
    return PartyGameAdapter.createFromLobby({
      roomId: "test-room",
      humanPlayers: [
        { playerId: "human-1", name: "Kate", avatarId: "kate", isConnected: true, disconnectedAt: null },
      ],
      aiPlayers: [
        { playerId: "ai-1", name: "Curt", modelId: "default:grok", modelDisplayName: "Grok", avatarId: "curt" },
        { playerId: "ai-2", name: "Jane", modelId: "default:grok", modelDisplayName: "Grok", avatarId: "jane" },
      ],
      startingRound: 1,
    });
  }

  it("newly created game has no duplicates", () => {
    const adapter = createTestAdapter();
    const snapshot = adapter.getSnapshot();
    expect(snapshot.lastError).toBeNull();
    adapter.stop();
  });

  it("draw and discard by current player has no duplicates", () => {
    const adapter = createTestAdapter();
    const snapshot = adapter.getSnapshot();

    // Find the current player
    const awaitingLobbyId = adapter.getAwaitingLobbyPlayerId();
    if (!awaitingLobbyId) throw new Error("No awaiting player");

    // Draw
    adapter.drawFromStock(awaitingLobbyId);
    const afterDraw = adapter.getSnapshot();
    expect(afterDraw.lastError).toBeNull();

    // Find a card to discard
    const engineId = adapter.lobbyIdToEngineId(awaitingLobbyId);
    const player = afterDraw.players.find(p => p.id === engineId);
    if (!player || player.hand.length === 0) throw new Error("No cards in hand");

    // Discard
    adapter.discard(awaitingLobbyId, player.hand[0]!.id);
    const afterDiscard = adapter.getSnapshot();
    expect(afterDiscard.lastError).toBeNull();

    adapter.stop();
  });

  it("store and restore cycle preserves state without duplicates", () => {
    const adapter1 = createTestAdapter();

    // Make some actions
    const awaitingLobbyId = adapter1.getAwaitingLobbyPlayerId();
    if (!awaitingLobbyId) throw new Error("No awaiting player");

    adapter1.drawFromStock(awaitingLobbyId);
    const snapshot1 = adapter1.getSnapshot();
    expect(snapshot1.lastError).toBeNull();

    // Store and restore
    const stored = adapter1.getStoredState();
    adapter1.stop();

    const adapter2 = PartyGameAdapter.fromStoredState(stored);
    const snapshot2 = adapter2.getSnapshot();
    expect(snapshot2.lastError).toBeNull();

    adapter2.stop();
  });

  it("multiple store/restore cycles do not create duplicates", () => {
    let adapter = createTestAdapter();

    for (let i = 0; i < 5; i++) {
      const snapshot = adapter.getSnapshot();
      if (snapshot.lastError) {
        throw new Error(`Cycle ${i} start: ${snapshot.lastError}`);
      }

      const awaitingLobbyId = adapter.getAwaitingLobbyPlayerId();
      if (!awaitingLobbyId) continue; // Game ended

      // Only act if it's the awaiting player's turn phase
      if (snapshot.turnPhase === "AWAITING_DRAW") {
        adapter.drawFromStock(awaitingLobbyId);
        const afterDraw = adapter.getSnapshot();
        if (afterDraw.lastError) {
          throw new Error(`Cycle ${i} draw: ${afterDraw.lastError}`);
        }
      }

      // Find card to discard
      const engineId = adapter.lobbyIdToEngineId(awaitingLobbyId);
      const afterAction = adapter.getSnapshot();
      const player = afterAction.players.find(p => p.id === engineId);
      if (!player || player.hand.length === 0) continue;

      adapter.discard(awaitingLobbyId, player.hand[0]!.id);
      const afterDiscard = adapter.getSnapshot();
      if (afterDiscard.lastError) {
        throw new Error(`Cycle ${i} discard: ${afterDiscard.lastError}`);
      }

      // Store and restore
      const stored = adapter.getStoredState();
      adapter.stop();
      adapter = PartyGameAdapter.fromStoredState(stored);
    }

    const finalSnapshot = adapter.getSnapshot();
    expect(finalSnapshot.lastError).toBeNull();
    adapter.stop();
  });

  it("simulates production flow: game start -> AI turns -> human turn", async () => {
    // Create game (human is player-0, AI-1 and AI-2)
    const adapter = createTestAdapter();
    const humanLobbyId = "human-1";

    // Simulate AI-1's turn (if it's their turn)
    let snapshot = adapter.getSnapshot();
    expect(snapshot.lastError).toBeNull();

    // Keep taking turns until it's human's turn
    let maxIterations = 10;
    while (adapter.getAwaitingLobbyPlayerId() !== humanLobbyId && maxIterations-- > 0) {
      const awaitingId = adapter.getAwaitingLobbyPlayerId();
      if (!awaitingId) break;

      // Simulate AI draw
      adapter.drawFromStock(awaitingId);
      let s = adapter.getSnapshot();
      if (s.lastError) throw new Error(`AI draw: ${s.lastError}`);

      // Simulate AI discard
      const engineId = adapter.lobbyIdToEngineId(awaitingId);
      const player = s.players.find(p => p.id === engineId);
      if (!player || player.hand.length === 0) break;
      adapter.discard(awaitingId, player.hand[0]!.id);

      s = adapter.getSnapshot();
      if (s.lastError) throw new Error(`AI discard: ${s.lastError}`);

      // Simulate store/restore (like what happens between turns in production)
      const stored = adapter.getStoredState();
      const restored = PartyGameAdapter.fromStoredState(stored);
      // Copy state back (in production, we'd use the restored adapter)
      snapshot = restored.getSnapshot();
      if (snapshot.lastError) throw new Error(`After restore: ${snapshot.lastError}`);
    }

    // Now it should be human's turn
    expect(adapter.getAwaitingLobbyPlayerId()).toBe(humanLobbyId);

    // Human draws
    adapter.drawFromStock(humanLobbyId);
    const afterHumanDraw = adapter.getSnapshot();
    expect(afterHumanDraw.lastError).toBeNull();

    // Human discards
    const humanEngineId = adapter.lobbyIdToEngineId(humanLobbyId);
    const humanPlayer = afterHumanDraw.players.find(p => p.id === humanEngineId);
    if (!humanPlayer || humanPlayer.hand.length === 0) throw new Error("Human has no cards");

    adapter.discard(humanLobbyId, humanPlayer.hand[0]!.id);
    const afterHumanDiscard = adapter.getSnapshot();
    expect(afterHumanDiscard.lastError).toBeNull();

    adapter.stop();
  });
});
