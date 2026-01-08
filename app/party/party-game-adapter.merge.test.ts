/**
 * Tests for mergeAIStatePreservingOtherPlayerHands
 *
 * These tests verify the merge function correctly preserves non-current players'
 * hand reorders when merging AI state changes.
 */

import { describe, it, expect } from "bun:test";
import {
  PartyGameAdapter,
  mergeAIStatePreservingOtherPlayerHands,
  type StoredGameState,
} from "./party-game-adapter";
import { GameEngine } from "../../core/engine/game-engine";

// Helper to create a test game state
function createTestGameState(playerNames: string[]): StoredGameState {
  const engine = GameEngine.createGame({ playerNames });
  const snapshot = engine.getSnapshot();
  const now = new Date().toISOString();

  return {
    engineSnapshot: engine.toJSON(),
    playerMappings: snapshot.players.map((p, i) => ({
      engineId: p.id,
      lobbyId: `lobby-${i + 1}`,
      name: playerNames[i]!,
      isAI: i > 0,
      aiModelId: i > 0 ? "default:fallback" : undefined,
    })),
    roomId: "test-room",
    createdAt: now,
    updatedAt: now,
    activityLog: [],
  };
}

// Helper to get player hand from stored state
function getPlayerHand(
  state: StoredGameState,
  engineId: string
): string[] | undefined {
  const snapshot = JSON.parse(state.engineSnapshot);
  const players = snapshot.children?.round?.snapshot?.context?.players;
  const player = players?.find((p: { id: string }) => p.id === engineId);
  return player?.hand?.map((c: { id: string }) => c.id);
}

describe("mergeAIStatePreservingOtherPlayerHands", () => {
  it("preserves non-current player hand reorder when merging", () => {
    // Setup: 3-player game
    const state = createTestGameState(["Human", "AI-Alice", "AI-Bob"]);
    const adapter = PartyGameAdapter.fromStoredState(state);
    const humanMapping = adapter
      .getAllPlayerMappings()
      .find((m) => !m.isAI)!;

    // Get human's original hand
    const originalHand = getPlayerHand(state, humanMapping.engineId)!;
    const reversedHand = [...originalHand].reverse();

    // State A: AI's view (original hand)
    const stateA = state;

    // Simulate human reorder -> state B
    const adapter2 = PartyGameAdapter.fromStoredState(state);
    adapter2.reorderHand(humanMapping.lobbyId, reversedHand);
    const stateB = adapter2.getStoredState();

    // Verify state B has reversed hand
    expect(getPlayerHand(stateB, humanMapping.engineId)).toEqual(reversedHand);

    // Merge: fresh=B (has reorder), ai=A (no reorder), currentPlayer=AI (player-1)
    const merged = mergeAIStatePreservingOtherPlayerHands(
      stateB,
      stateA,
      "player-1"
    );

    // Human's hand should be preserved from state B (the reordered version)
    expect(getPlayerHand(merged, humanMapping.engineId)).toEqual(reversedHand);
  });

  it("keeps current player hand from AI state", () => {
    // Setup: 3-player game
    const state = createTestGameState(["Human", "AI-Alice", "AI-Bob"]);

    // Simulate AI (player-1) draws a card
    const adapter = PartyGameAdapter.fromStoredState(state);
    const snapshot = adapter.getSnapshot();

    // Make sure it's AI's turn by checking awaiting player
    // If not AI's turn, just use the state as-is for this test
    const aiMapping = adapter.getAllPlayerMappings().find((m) => m.isAI)!;
    const aiHandBefore = getPlayerHand(state, aiMapping.engineId)!;

    // Create modified AI state with different hand (simulate AI drew)
    const modifiedState = { ...state };
    const modifiedSnapshot = JSON.parse(modifiedState.engineSnapshot);
    const players =
      modifiedSnapshot.children?.round?.snapshot?.context?.players;
    const aiPlayer = players?.find(
      (p: { id: string }) => p.id === aiMapping.engineId
    );
    if (aiPlayer) {
      aiPlayer.hand = [...aiPlayer.hand, { id: "new-card", rank: "A", suit: "S" }];
    }
    modifiedState.engineSnapshot = JSON.stringify(modifiedSnapshot);

    // Merge with AI as current player - AI's hand should be preserved
    const merged = mergeAIStatePreservingOtherPlayerHands(
      state, // fresh
      modifiedState, // AI's modified state
      aiMapping.engineId
    );

    // AI's modified hand should be in the merged result
    const mergedAiHand = getPlayerHand(merged, aiMapping.engineId);
    expect(mergedAiHand).toContain("new-card");
    expect(mergedAiHand?.length).toBe(aiHandBefore.length + 1);
  });

  it("handles null fresh state by returning AI state", () => {
    const state = createTestGameState(["Human", "AI-Alice", "AI-Bob"]);

    const result = mergeAIStatePreservingOtherPlayerHands(
      null,
      state,
      "player-1"
    );

    expect(result).toBe(state);
  });

  it("falls back to AI state when snapshot structure is invalid", () => {
    const state = createTestGameState(["Human", "AI-Alice", "AI-Bob"]);

    // Create an invalid fresh state
    const invalidFresh: StoredGameState = {
      ...state,
      engineSnapshot: JSON.stringify({ invalid: true }),
    };

    const result = mergeAIStatePreservingOtherPlayerHands(
      invalidFresh,
      state,
      "player-1"
    );

    // Should return AI state since fresh is invalid
    expect(result).toBe(state);
  });

  it("handles player count mismatch by returning AI state", () => {
    const state3Players = createTestGameState(["A", "B", "C"]);
    const state4Players = createTestGameState(["A", "B", "C", "D"]);

    const result = mergeAIStatePreservingOtherPlayerHands(
      state3Players,
      state4Players,
      "player-1"
    );

    // Should return AI state since player counts don't match
    expect(result).toBe(state4Players);
  });

  it("handles invalid currentPlayerEngineId by returning AI state", () => {
    const state = createTestGameState(["Human", "AI-Alice", "AI-Bob"]);

    const result = mergeAIStatePreservingOtherPlayerHands(
      state,
      state,
      "player-999" // Invalid ID
    );

    // Should return AI state since current player not found
    expect(result).toBe(state);
  });

  it("preserves multiple non-current players hands", () => {
    // Setup: 4-player game (1 human, 3 AI)
    const state = createTestGameState(["Human", "AI-A", "AI-B", "AI-C"]);
    const adapter = PartyGameAdapter.fromStoredState(state);
    const humanMapping = adapter.getAllPlayerMappings().find((m) => !m.isAI)!;

    // Get human's original hand
    const originalHand = getPlayerHand(state, humanMapping.engineId)!;
    const reversedHand = [...originalHand].reverse();

    // State A: AI's view
    const stateA = state;

    // Simulate human reorder -> state B
    const adapter2 = PartyGameAdapter.fromStoredState(state);
    adapter2.reorderHand(humanMapping.lobbyId, reversedHand);
    const stateB = adapter2.getStoredState();

    // Current player is player-1 (AI-A), merge should preserve:
    // - player-0 (human) hand from fresh
    // - player-2, player-3 hands from fresh (they're also not current)
    const merged = mergeAIStatePreservingOtherPlayerHands(
      stateB,
      stateA,
      "player-1"
    );

    // Human's hand should come from fresh (reversed)
    expect(getPlayerHand(merged, "player-0")).toEqual(reversedHand);

    // Other AI hands should also come from fresh (unchanged in this test)
    const ai2Hand = getPlayerHand(state, "player-2");
    const ai3Hand = getPlayerHand(state, "player-3");
    expect(getPlayerHand(merged, "player-2")).toEqual(ai2Hand);
    expect(getPlayerHand(merged, "player-3")).toEqual(ai3Hand);
  });
});
