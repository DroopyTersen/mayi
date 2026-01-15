/**
 * Tests for race condition when human reorders during AI turn
 *
 * Bug scenario:
 * 1. AI turn starts (coordinator loads state A)
 * 2. Human reorders hand (handleGameAction saves state B)
 * 3. AI finishes turn, saves state A' (overwrites human's reorder!)
 * 4. UI blips back to old hand order
 */

import { describe, it, expect } from "bun:test";
import {
  AITurnCoordinator,
  type AITurnCoordinatorDeps,
} from "./ai-turn-coordinator";
import {
  PartyGameAdapter,
  type StoredGameState,
  type PlayerMapping,
} from "./party-game-adapter";
import { executeGameAction } from "./game-actions";
import type { AITurnResult } from "./ai-turn-handler";

// Helper to create a test game state
function createTestGameState(playerNames: string[]): StoredGameState {
  const { GameEngine } = require("../../core/engine/game-engine");
  const engine = GameEngine.createGame({ playerNames });
  const snapshot = engine.getSnapshot();

  // Create player mappings
  const playerMappings: PlayerMapping[] = snapshot.players.map((p: any, i: number) => ({
    engineId: p.id,
    lobbyId: `lobby-${i + 1}`,
    name: playerNames[i],
    isAI: i > 0, // First player is human, rest are AI
    aiModelId: i > 0 ? "default:fallback" : undefined,
  }));

  // Get the serialized state (JSON string)
  const engineSnapshot = engine.toJSON();
  const now = new Date().toISOString();

  return {
    engineSnapshot,
    playerMappings,
    roomId: "test-room",
    createdAt: now,
    updatedAt: now,
    activityLog: [],
  };
}

describe("AI Turn Coordinator - Reorder Race Condition", () => {
  it("human reorder during AI turn gets overwritten when AI saves", async () => {
    // Setup: Create a game where it's NOT the human's turn (AI's turn)
    // We'll simulate the human is player 2, and it's player 3 (AI)'s turn
    const initialState = createTestGameState(["Human", "AI-Alice", "AI-Bob"]);

    // Make it AI-Alice's turn by advancing past human's turn
    const adapter1 = PartyGameAdapter.fromStoredState(initialState);
    const humanId = adapter1.getAllPlayerMappings().find(m => m.name === "Human")!.lobbyId;
    const humanEngineId = adapter1.getAllPlayerMappings().find(m => m.name === "Human")!.engineId;

    // Complete human's turn if it's their turn
    let currentState = initialState;
    {
      const snap = adapter1.getSnapshot();
      if (snap.awaitingPlayerId === humanEngineId) {
        adapter1.drawFromStock(humanId);
        adapter1.skip(humanId);
        const hand = snap.players.find((p: any) => p.id === humanEngineId)?.hand;
        if (hand?.[0]) {
          adapter1.discard(humanId, hand[0].id);
        }
        currentState = adapter1.getStoredState();
      }
    }

    // Storage simulation - this will be modified during the test
    let storedState: StoredGameState | null = currentState;
    const broadcasts: StoredGameState[] = [];

    // Create adapter that the AI coordinator will use
    const aiAdapter = PartyGameAdapter.fromStoredState(storedState);
    const snapshot = aiAdapter.getSnapshot();

    // Get the human player's current hand order
    const humanMapping = aiAdapter.getAllPlayerMappings().find(m => m.name === "Human")!;
    const humanPlayer = snapshot.players.find((p: any) => p.id === humanMapping.engineId)!;
    const originalHandOrder = humanPlayer.hand.map((c: any) => c.id);
    const reversedHandOrder = [...originalHandOrder].reverse();

    // Track whether AI has loaded state yet
    let aiLoadedState = false;
    let aiFinishedTurn = false;

    // Create deps for AI coordinator that simulates the race
    let aiTurnChecks = 0;
    const deps: AITurnCoordinatorDeps = {
      getState: async () => {
        aiLoadedState = true;
        // AI loads the state BEFORE human reorders
        return storedState;
      },
      setState: async (state) => {
        // AI saving its state after turn
        aiFinishedTurn = true;
        storedState = state;
      },
      broadcast: async () => {
        broadcasts.push(storedState!);
      },
      executeAITurn: async ({ adapter, onPersist }) => {
        // Simulate AI taking some time (during which human reorders)

        // AI starts executing...
        // At this point, simulate human reordering their hand in parallel

        // Human's reorder action (happens "during" AI turn)
        // This is what handleGameAction does:
        const humanReorderAdapter = PartyGameAdapter.fromStoredState(storedState!);
        const result = executeGameAction(humanReorderAdapter, humanMapping.lobbyId, {
          type: "REORDER_HAND",
          cardIds: reversedHandOrder,
        });

        if (result.success) {
          // Human's action saves to storage
          storedState = humanReorderAdapter.getStoredState();
          // Verify human's reorder was saved
          const savedSnap = humanReorderAdapter.getSnapshot();
          const savedHumanHand = savedSnap.players.find((p: any) => p.id === humanMapping.engineId)!.hand;
          // This should be the reversed order
          expect(savedHumanHand.map((c: any) => c.id)).toEqual(reversedHandOrder);
        }

        // AI continues and finishes its turn
        // The AI's adapter was created from the OLD state, doesn't have human's reorder
        const aiEngineId = adapter.getAllPlayerMappings().find(m => m.isAI)?.engineId;
        const aiLobbyId = adapter.getAllPlayerMappings().find(m => m.isAI)?.lobbyId;

        if (aiEngineId && aiLobbyId) {
          const aiSnap = adapter.getSnapshot();
          if (aiSnap.awaitingPlayerId === aiEngineId) {
            adapter.drawFromStock(aiLobbyId);
            adapter.skip(aiLobbyId);
            // Find AI's hand to discard
            const aiPlayer = aiSnap.players.find((p: any) => p.id === aiEngineId);
            const firstCard = aiPlayer?.hand?.[0];
            if (firstCard) {
              adapter.discard(aiLobbyId, firstCard.id);
            }
          }
        }

        // Call onPersist which saves the AI's adapter state
        await onPersist?.();

        return {
          success: true,
          actions: ["draw", "skip", "discard"],
          usedFallback: true,
        } as AITurnResult;
      },
      isAIPlayerTurn: (adapter) => {
        // This test only needs to exercise a single AI turn.
        // Prevent long chained AI loops from hitting MAX_CHAINED_TURNS.
        if (aiTurnChecks++ > 0) return null;
        const snap = adapter.getSnapshot();
        const awaiting = snap.awaitingPlayerId;
        const mapping = adapter.getAllPlayerMappings().find(m => m.engineId === awaiting);
        if (mapping?.isAI) {
          return mapping;
        }
        return null;
      },
      createAdapter: PartyGameAdapter.fromStoredState,
      env: {},
      thinkingDelayMs: 0,
      interTurnDelayMs: 0,
      toolDelayMs: 0,
      debug: false,
    };

    const coordinator = new AITurnCoordinator(deps);

    // Execute AI turns - this should expose the race condition
    await coordinator.executeAITurnsIfNeeded();

    // After AI turn, check human's hand order in final stored state
    const finalAdapter = PartyGameAdapter.fromStoredState(storedState!);
    const finalSnapshot = finalAdapter.getSnapshot();
    const finalHumanPlayer = finalSnapshot.players.find((p: any) => p.id === humanMapping.engineId)!;
    const finalHandOrder = finalHumanPlayer.hand.map((c: any) => c.id);

    // After fix: Human's reorder should be preserved during AI turn
    // The merge function ensures non-current players' hands come from fresh state
    console.log("Original hand order:", originalHandOrder);
    console.log("Expected (reversed) order:", reversedHandOrder);
    console.log("Final hand order:", finalHandOrder);

    // Verify that the merge preserved the human's reorder
    expect(finalHandOrder).toEqual(reversedHandOrder);
  });

  it("does not run overlapping AI loops when called concurrently", async () => {
    const initialState = createTestGameState(["Human", "AI-Alice", "AI-Bob"]);

    let storedState: StoredGameState | null = initialState;

    // Use the real adapter so merge + serialization paths stay realistic.
    const adapter = PartyGameAdapter.fromStoredState(storedState);
    const aiMapping = adapter.getAllPlayerMappings().find((m) => m.isAI)!;

    let executeCalls = 0;
    let releaseAITurn!: () => void;
    const waitForRelease = new Promise<void>((resolve) => {
      releaseAITurn = () => resolve();
    });

    const deps: AITurnCoordinatorDeps = {
      getState: async () => storedState,
      setState: async (state) => {
        storedState = state;
      },
      broadcast: async () => {},
      // Block the "AI turn" so we can call executeAITurnsIfNeeded again while it's running.
      executeAITurn: async () => {
        executeCalls++;
        await waitForRelease;
        return {
          success: true,
          actions: [],
          usedFallback: true,
        };
      },
      // Return an AI player exactly once so the coordinator exits after one "turn".
      isAIPlayerTurn: () => (executeCalls === 0 ? aiMapping : null),
      createAdapter: PartyGameAdapter.fromStoredState,
      env: {},
      thinkingDelayMs: 0,
      interTurnDelayMs: 0,
      toolDelayMs: 0,
      debug: false,
    };

    const coordinator = new AITurnCoordinator(deps);

    const first = coordinator.executeAITurnsIfNeeded();
    // Ensure the first call has started and is blocked inside executeAITurn.
    await Promise.resolve();
    const second = coordinator.executeAITurnsIfNeeded();

    // Unblock the AI "turn" and wait for both calls to settle.
    releaseAITurn();
    await Promise.all([first, second]);

    expect(executeCalls).toBe(1);
  });
});
