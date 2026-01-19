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

  it("prefers fresh state when merge would duplicate a card across hands", () => {
    const state = createTestGameState(["Human", "AI-Alice", "AI-Bob"]);
    const adapter = PartyGameAdapter.fromStoredState(state);
    const mappings = adapter.getAllPlayerMappings();
    const human = mappings.find((m) => !m.isAI);
    const ai = mappings.find((m) => m.isAI);
    if (!human || !ai) {
      throw new Error("Expected a human and AI player mapping");
    }

    const staleSnapshot = JSON.parse(state.engineSnapshot);
    const players = staleSnapshot.children?.round?.snapshot?.context?.players;
    if (!Array.isArray(players)) {
      throw new Error("Expected players in stale snapshot");
    }
    const humanPlayer = players.find((p: { id: string }) => p.id === human.engineId);
    const aiPlayer = players.find((p: { id: string }) => p.id === ai.engineId);
    if (!humanPlayer || !aiPlayer) {
      throw new Error("Expected human and AI players in snapshot");
    }

    const duplicateCard = humanPlayer.hand.find(
      (card: { id: string }) => !aiPlayer.hand.some((c: { id: string }) => c.id === card.id)
    );
    if (!duplicateCard) {
      throw new Error("Expected a card to duplicate across hands");
    }

    aiPlayer.hand = [...aiPlayer.hand, duplicateCard];

    const staleState: StoredGameState = {
      ...state,
      engineSnapshot: JSON.stringify(staleSnapshot),
    };

    const result = mergeAIStatePreservingOtherPlayerHands(
      state,
      staleState,
      ai.engineId
    );

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

  describe("turn context stock/discard sync (#74)", () => {
    // Helper to get stock from turn context in stored state
    function getTurnContextStock(state: StoredGameState): string[] | undefined {
      const snapshot = JSON.parse(state.engineSnapshot);
      const turnContext =
        snapshot.children?.round?.snapshot?.children?.turn?.snapshot?.context;
      return turnContext?.stock?.map((c: { id: string }) => c.id);
    }

    // Helper to get stock from round context in stored state
    function getRoundContextStock(state: StoredGameState): string[] | undefined {
      const snapshot = JSON.parse(state.engineSnapshot);
      const roundContext = snapshot.children?.round?.snapshot?.context;
      return roundContext?.stock?.map((c: { id: string }) => c.id);
    }

    it("syncs turn context stock/discard to prevent duplicate card detection", () => {
      // BUG REPRODUCTION: #74 duplicate card-42 on first discard
      //
      // Scenario:
      // 1. Fresh state has current player drawing card-X (card is in hand, removed from stock)
      // 2. AI state (stale) has card-X still in turn.context.stock
      // 3. Merge patches turn.context.hand but NOT turn.context.stock
      // 4. Result: card-X appears in BOTH hand and turn.context.stock
      // 5. findDuplicateCardIds detects duplicate
      //
      // This test simulates that scenario by directly manipulating snapshots.

      const state = createTestGameState(["Human", "AI-Alice", "AI-Bob"]);

      // Get the initial snapshot to find a card in stock
      const snapshot = JSON.parse(state.engineSnapshot);
      const turnContext =
        snapshot.children?.round?.snapshot?.children?.turn?.snapshot?.context;
      const roundContext = snapshot.children?.round?.snapshot?.context;

      if (!turnContext || !roundContext) {
        throw new Error("Expected turn and round context in snapshot");
      }

      // Find the current turn player (from turn context)
      const currentPlayerId = turnContext.playerId as string;
      expect(currentPlayerId).toBeDefined();

      // Get the first card from stock - we'll simulate drawing this
      const drawnCard = turnContext.stock[0];
      if (!drawnCard) {
        throw new Error("Expected at least one card in stock");
      }
      const drawnCardId = drawnCard.id;

      // Create "fresh" state: card has been drawn (in hand, removed from stock)
      const freshSnapshot = JSON.parse(state.engineSnapshot);
      const freshTurnContext =
        freshSnapshot.children?.round?.snapshot?.children?.turn?.snapshot?.context;
      const freshRoundContext = freshSnapshot.children?.round?.snapshot?.context;

      // Add drawn card to player's hand (both turn context and round context player)
      freshTurnContext.hand = [...freshTurnContext.hand, drawnCard];
      freshTurnContext.hasDrawn = true;
      // Remove drawn card from stock
      freshTurnContext.stock = freshTurnContext.stock.slice(1);
      // Also update round context stock and player hand (to match)
      freshRoundContext.stock = freshRoundContext.stock.slice(1);
      const roundPlayer = freshRoundContext.players.find(
        (p: { id: string }) => p.id === currentPlayerId
      );
      if (roundPlayer) {
        roundPlayer.hand = [...roundPlayer.hand, drawnCard];
      }

      const freshState: StoredGameState = {
        ...state,
        engineSnapshot: JSON.stringify(freshSnapshot),
      };

      // The stale AI state still has the original state (card in stock, not in hand)
      const staleAiState = state;

      // Verify setup: fresh state has card in hand for the current player
      expect(getPlayerHand(freshState, currentPlayerId)).toContain(drawnCardId);
      // Stale state does NOT have card in hand
      expect(getPlayerHand(staleAiState, currentPlayerId)).not.toContain(drawnCardId);

      // Now merge: fresh state has human's draw, AI state is stale
      // Use a different player ID for the "AI" (not the current turn player)
      const aiPlayerId = currentPlayerId === "player-0" ? "player-1" : "player-0";
      const merged = mergeAIStatePreservingOtherPlayerHands(
        freshState, // fresh: has the draw
        staleAiState, // AI: stale, turn.context.stock has drawn card
        aiPlayerId // AI is not the current turn player
      );

      // After merge, BOTH turn context AND round context stock should NOT contain
      // the drawn card, because that card is now in the current player's hand
      const mergedTurnStock = getTurnContextStock(merged);
      const mergedRoundStock = getRoundContextStock(merged);

      // Check that the drawn card is NOT in turn context stock
      if (mergedTurnStock) {
        expect(mergedTurnStock).not.toContain(drawnCardId);
      }

      // Check that the drawn card is NOT in round context stock
      // BUG: The merge function doesn't sync round.context.stock from fresh state
      if (mergedRoundStock) {
        expect(mergedRoundStock).not.toContain(drawnCardId);
      }

      // Verify no duplicates would be detected by loading the merged state
      const mergedAdapter = PartyGameAdapter.fromStoredState(merged);
      const mergedSnapshot = mergedAdapter.getSnapshot();

      // This assertion will FAIL until the bug is fixed - the duplicate detection
      // will find the drawn card in both hand and round.context.stock
      expect(mergedSnapshot.lastError).toBeNull();
    });

    it("patches turn context stock/discard when patching turn context hand", () => {
      // BUG: The merge function patches turn.context.hand (via turnContextPatch)
      // but does NOT patch turn.context.stock or turn.context.discard.
      //
      // When findDuplicateCardIds runs, it uses turnContext?.stock (stale)
      // which may still contain cards that are now in the patched turn.context.hand.
      //
      // This test verifies that when the merge patches the turn context hand,
      // it also syncs the turn context stock/discard from the fresh state.

      const state = createTestGameState(["Human", "AI-Alice", "AI-Bob"]);

      // Get the initial snapshot
      const snapshot = JSON.parse(state.engineSnapshot);
      const turnContext =
        snapshot.children?.round?.snapshot?.children?.turn?.snapshot?.context;
      const roundContext = snapshot.children?.round?.snapshot?.context;

      if (!turnContext || !roundContext) {
        throw new Error("Expected turn and round context in snapshot");
      }

      // Find the current turn player (from turn context)
      const currentPlayerId = turnContext.playerId as string;
      expect(currentPlayerId).toBeDefined();

      // Get the first card from stock - we'll simulate drawing this
      const drawnCard = turnContext.stock[0];
      if (!drawnCard) {
        throw new Error("Expected at least one card in stock");
      }
      const drawnCardId = drawnCard.id;

      // Create "fresh" state: card has been drawn (in hand, removed from stock)
      const freshSnapshot = JSON.parse(state.engineSnapshot);
      const freshTurnContext =
        freshSnapshot.children?.round?.snapshot?.children?.turn?.snapshot?.context;
      const freshRoundContext = freshSnapshot.children?.round?.snapshot?.context;

      // Add drawn card to player's hand in both turn and round context
      freshTurnContext.hand = [...freshTurnContext.hand, drawnCard];
      freshTurnContext.hasDrawn = true;
      // Remove drawn card from stock in both contexts
      freshTurnContext.stock = freshTurnContext.stock.slice(1);
      freshRoundContext.stock = freshRoundContext.stock.slice(1);

      // Also update round context player hand
      const roundPlayer = freshRoundContext.players.find(
        (p: { id: string }) => p.id === currentPlayerId
      );
      if (roundPlayer) {
        roundPlayer.hand = [...roundPlayer.hand, drawnCard];
      }

      const freshState: StoredGameState = {
        ...state,
        engineSnapshot: JSON.stringify(freshSnapshot),
      };

      // The stale AI state still has the original state
      // Key: turn.context.stock still has the drawn card
      const staleAiState = state;

      // Verify the stale turn context stock has the card
      const staleTurnStock = getTurnContextStock(staleAiState);
      expect(staleTurnStock).toContain(drawnCardId);

      // Verify fresh turn context stock does NOT have the card
      const freshTurnStock = getTurnContextStock(freshState);
      expect(freshTurnStock).not.toContain(drawnCardId);

      // Now merge: this should trigger turnContextPatch because
      // the turn player differs from the AI player
      const aiPlayerId = currentPlayerId === "player-0" ? "player-1" : "player-0";
      const merged = mergeAIStatePreservingOtherPlayerHands(
        freshState,
        staleAiState,
        aiPlayerId
      );

      // The merge patches turn.context.hand from fresh, but the BUG is that
      // it doesn't patch turn.context.stock from fresh.
      // This means turn.context.stock would still have the drawn card (stale).

      // After merge, turn context stock should match fresh state (no drawn card)
      const mergedTurnStock = getTurnContextStock(merged);
      if (mergedTurnStock) {
        // BUG: This will FAIL because turn.context.stock isn't patched
        expect(mergedTurnStock).not.toContain(drawnCardId);
      }

      // The ultimate check: no duplicates should be detected
      const mergedAdapter = PartyGameAdapter.fromStoredState(merged);
      const mergedSnapshot = mergedAdapter.getSnapshot();
      expect(mergedSnapshot.lastError).toBeNull();
    });
  });

  describe("pile-to-pile duplicate detection (#74 hypothesis)", () => {
    /**
     * HYPOTHESIS TEST: The merge safeguard only checks hand-pile overlap,
     * NOT pile-to-pile overlap. If a card exists in BOTH:
     * - round.context.stock AND turn.context.discard
     * - OR round.context.discard AND turn.context.stock
     *
     * ...the merge function would NOT catch it and would return corrupted state.
     *
     * This test manufactures such a scenario to prove the gap exists.
     */
    it("should reject merge when card appears in both round.stock and turn.discard", () => {
      const state = createTestGameState(["Human", "AI-Alice", "AI-Bob"]);

      // Parse and manipulate snapshot to create pile-to-pile duplicate
      const corruptedSnapshot = JSON.parse(state.engineSnapshot);
      const roundContext = corruptedSnapshot.children?.round?.snapshot?.context;
      const turnContext =
        corruptedSnapshot.children?.round?.snapshot?.children?.turn?.snapshot?.context;

      if (!roundContext || !turnContext) {
        throw new Error("Expected round and turn context in snapshot");
      }

      // Get a card from the stock
      const cardToDuplicate = roundContext.stock?.[0] ?? turnContext.stock?.[0];
      if (!cardToDuplicate) {
        throw new Error("Expected at least one card in stock");
      }

      // Create the pile-to-pile duplicate:
      // Put the same card in BOTH round.context.stock AND turn.context.discard
      // (simulating a desync between round and turn actor states)
      if (!roundContext.stock?.includes(cardToDuplicate)) {
        roundContext.stock = [cardToDuplicate, ...(roundContext.stock ?? [])];
      }
      turnContext.discard = [cardToDuplicate, ...(turnContext.discard ?? [])];

      const corruptedState: StoredGameState = {
        ...state,
        engineSnapshot: JSON.stringify(corruptedSnapshot),
      };

      // Fresh state is clean (no duplicates)
      const freshState = state;

      // The AI state has pile-to-pile duplicates
      const aiStateWithDuplicates = corruptedState;

      // When we merge, the safeguard should detect pile-to-pile duplicates
      // and return freshState instead of the corrupted merge result
      const merged = mergeAIStatePreservingOtherPlayerHands(
        freshState,
        aiStateWithDuplicates,
        "player-1" // AI is current player
      );

      // HYPOTHESIS: This will FAIL because the merge doesn't check pile-to-pile
      // Current safeguard only checks: handCardIds.has(pileCardId)
      // It does NOT check if a card appears in multiple piles

      // If the safeguard worked, it would return freshState (clean)
      // If the safeguard is missing, it returns the corrupted merged state
      expect(merged.engineSnapshot).toBe(freshState.engineSnapshot);
    });

    it("should reject merge when card appears in both turn.stock and turn.discard", () => {
      const state = createTestGameState(["Human", "AI-Alice", "AI-Bob"]);

      // Parse and manipulate snapshot to create pile-to-pile duplicate within turn context
      const corruptedSnapshot = JSON.parse(state.engineSnapshot);
      const turnContext =
        corruptedSnapshot.children?.round?.snapshot?.children?.turn?.snapshot?.context;

      if (!turnContext) {
        throw new Error("Expected turn context in snapshot");
      }

      // Get a card from the stock
      const cardToDuplicate = turnContext.stock?.[0];
      if (!cardToDuplicate) {
        throw new Error("Expected at least one card in stock");
      }

      // Create duplicate: same card in BOTH turn.stock AND turn.discard
      turnContext.discard = [cardToDuplicate, ...(turnContext.discard ?? [])];

      const corruptedState: StoredGameState = {
        ...state,
        engineSnapshot: JSON.stringify(corruptedSnapshot),
      };

      const freshState = state;
      const aiStateWithDuplicates = corruptedState;

      const merged = mergeAIStatePreservingOtherPlayerHands(
        freshState,
        aiStateWithDuplicates,
        "player-1"
      );

      // HYPOTHESIS: Merge doesn't detect stock-discard overlap within same context
      expect(merged.engineSnapshot).toBe(freshState.engineSnapshot);
    });

    it("should reject merge when round and turn contexts have desynchronized stock", () => {
      // This tests the specific scenario from the screenshot:
      // AI turns complete, state gets merged, but round.context and turn.context
      // have different views of where cards are located.

      const state = createTestGameState(["Human", "AI-Alice", "AI-Bob"]);

      const desyncedSnapshot = JSON.parse(state.engineSnapshot);
      const roundContext = desyncedSnapshot.children?.round?.snapshot?.context;
      const turnContext =
        desyncedSnapshot.children?.round?.snapshot?.children?.turn?.snapshot?.context;

      if (!roundContext || !turnContext) {
        throw new Error("Expected round and turn context in snapshot");
      }

      // Simulate desync: round.stock has card-42, but turn.stock doesn't
      // (and turn.discard has card-42 instead - as if AI discarded but round wasn't updated)
      const card42 = turnContext.stock?.find(
        (c: { id: string }) => c.id === "card-42"
      ) ?? roundContext.stock?.find((c: { id: string }) => c.id === "card-42");

      if (!card42) {
        // If card-42 doesn't exist, use the first available card
        const anyCard = turnContext.stock?.[0] ?? roundContext.stock?.[0];
        if (!anyCard) {
          throw new Error("No cards available for test");
        }

        // Create the desync scenario with this card instead
        // Card is in round.stock but we'll also put it in turn.discard
        if (!Array.isArray(roundContext.stock)) {
          roundContext.stock = [];
        }
        if (!roundContext.stock.some((c: { id: string }) => c.id === anyCard.id)) {
          roundContext.stock.push(anyCard);
        }

        if (!Array.isArray(turnContext.discard)) {
          turnContext.discard = [];
        }
        turnContext.discard = [anyCard, ...turnContext.discard];

        // Remove from turn.stock to simulate the "discarded" state
        turnContext.stock = turnContext.stock?.filter(
          (c: { id: string }) => c.id !== anyCard.id
        ) ?? [];
      } else {
        // Use card-42 for the test (matches the screenshot)
        if (!Array.isArray(turnContext.discard)) {
          turnContext.discard = [];
        }
        turnContext.discard = [card42, ...turnContext.discard];

        // Remove from turn.stock
        turnContext.stock = turnContext.stock?.filter(
          (c: { id: string }) => c.id !== "card-42"
        ) ?? [];

        // Ensure it's still in round.stock (the desync)
        if (!roundContext.stock?.some((c: { id: string }) => c.id === "card-42")) {
          roundContext.stock = [card42, ...(roundContext.stock ?? [])];
        }
      }

      const desyncedState: StoredGameState = {
        ...state,
        engineSnapshot: JSON.stringify(desyncedSnapshot),
      };

      const freshState = state;

      const merged = mergeAIStatePreservingOtherPlayerHands(
        freshState,
        desyncedState,
        "player-1"
      );

      // The merged state should be freshState (clean), not the desynced state
      // HYPOTHESIS: This will FAIL - merge doesn't detect round/turn context desync
      expect(merged.engineSnapshot).toBe(freshState.engineSnapshot);
    });
  });
});
