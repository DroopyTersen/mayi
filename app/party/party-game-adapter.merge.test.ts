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

  it("prefers fresh state when snapshot structure is invalid", () => {
    const state = createTestGameState(["Human", "AI-Alice", "AI-Bob"]);

    // Create an invalid fresh state (simulating mid-transition)
    const invalidFresh: StoredGameState = {
      ...state,
      engineSnapshot: JSON.stringify({ invalid: true }),
    };

    const result = mergeAIStatePreservingOtherPlayerHands(
      invalidFresh,
      state,
      "player-1"
    );

    // Should return fresh state (authoritative from storage) when structure is invalid
    // This prevents stale AI data from overwriting fresh storage state
    expect(result).toBe(invalidFresh);
  });

  it("prefers fresh state when player count mismatch", () => {
    const state3Players = createTestGameState(["A", "B", "C"]);
    const state4Players = createTestGameState(["A", "B", "C", "D"]);

    const result = mergeAIStatePreservingOtherPlayerHands(
      state3Players,
      state4Players,
      "player-1"
    );

    // Should return fresh state (authoritative from storage) when player counts don't match
    expect(result).toBe(state3Players);
  });

  it("prefers fresh state when currentPlayerEngineId is invalid", () => {
    const state = createTestGameState(["Human", "AI-Alice", "AI-Bob"]);

    const result = mergeAIStatePreservingOtherPlayerHands(
      state,
      state,
      "player-999" // Invalid ID
    );

    // Should return fresh state since merge can't proceed safely
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

  describe("round transition handling", () => {
    // Helper to get round number from stored state
    function getRoundNumber(state: StoredGameState): number | undefined {
      const snapshot = JSON.parse(state.engineSnapshot);
      return snapshot.children?.round?.snapshot?.context?.roundNumber;
    }

    // Helper to create a state with specific round number
    function createStateWithRound(
      baseState: StoredGameState,
      roundNumber: number
    ): StoredGameState {
      const snapshot = JSON.parse(baseState.engineSnapshot);
      if (snapshot.children?.round?.snapshot?.context) {
        snapshot.children.round.snapshot.context.roundNumber = roundNumber;
      }
      return {
        ...baseState,
        engineSnapshot: JSON.stringify(snapshot),
      };
    }

    it("returns fresh state when round numbers differ", () => {
      // Setup: 3-player game
      const state = createTestGameState(["Human", "AI-Alice", "AI-Bob"]);

      // Create two states with different rounds
      // Fresh state is round 2, AI state is round 1 (stale)
      const freshState = createStateWithRound(state, 2);
      const staleAiState = createStateWithRound(state, 1);

      // Verify our setup
      expect(getRoundNumber(freshState)).toBe(2);
      expect(getRoundNumber(staleAiState)).toBe(1);

      // When round numbers differ, should return fresh state entirely
      // (not merge stale hands from old round)
      const result = mergeAIStatePreservingOtherPlayerHands(
        freshState,
        staleAiState,
        "player-1"
      );

      // Should return fresh state, not stale AI state
      expect(getRoundNumber(result)).toBe(2);
      // The result should be the fresh state (not merged)
      expect(result.engineSnapshot).toBe(freshState.engineSnapshot);
    });

    it("still merges when round numbers are the same", () => {
      // Setup: 3-player game
      const state = createTestGameState(["Human", "AI-Alice", "AI-Bob"]);
      const adapter = PartyGameAdapter.fromStoredState(state);
      const humanMapping = adapter
        .getAllPlayerMappings()
        .find((m) => !m.isAI)!;

      // Get human's original hand and create reversed version
      const originalHand = getPlayerHand(state, humanMapping.engineId)!;
      const reversedHand = [...originalHand].reverse();

      // Simulate human reorder -> fresh state
      const adapter2 = PartyGameAdapter.fromStoredState(state);
      adapter2.reorderHand(humanMapping.lobbyId, reversedHand);
      const freshState = adapter2.getStoredState();

      // Both states are round 1 (same round)
      expect(getRoundNumber(state)).toBe(1);
      expect(getRoundNumber(freshState)).toBe(1);

      // Same round should still merge properly (preserve human's reorder)
      const merged = mergeAIStatePreservingOtherPlayerHands(
        freshState, // Has human's reorder
        state, // Original (AI's stale view)
        "player-1" // AI is current player
      );

      // Human's reordered hand should be preserved from fresh state
      expect(getPlayerHand(merged, humanMapping.engineId)).toEqual(reversedHand);
    });

    it("prefers fresh state when fallback conditions are met", () => {
      // Bug fix test: When the merge function can't find valid player data,
      // it should return fresh state (authoritative from storage)
      // rather than stale AI state
      const state = createTestGameState(["Human", "AI-Alice", "AI-Bob"]);

      // Create a fresh state with invalid round structure
      // (simulating mid-transition state)
      const freshState: StoredGameState = {
        ...state,
        engineSnapshot: JSON.stringify({
          ...JSON.parse(state.engineSnapshot),
          children: {
            round: {
              snapshot: {
                context: {
                  // Missing players array - simulates mid-transition
                  roundNumber: 2,
                },
              },
            },
          },
        }),
      };

      // Currently, this would return staleAiState (bug)
      // After fix, it should return freshState
      const result = mergeAIStatePreservingOtherPlayerHands(
        freshState,
        state, // Stale AI state with old round data
        "player-1"
      );

      // Should return fresh state, not stale AI state
      // This test will FAIL until the bug is fixed
      expect(result).toBe(freshState);
    });
  });
});
