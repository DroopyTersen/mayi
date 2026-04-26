import { describe, expect, it } from "bun:test";

import { GameEngine } from "../../core/engine/game-engine";
import { AITurnCoordinator, type AITurnCoordinatorDeps } from "./ai-turn-coordinator";
import { executeStoredGameAction } from "./game-action-executor";
import { PartyGameAdapter, type PlayerMapping, type StoredGameState } from "./party-game-adapter";

function createTestGameState(playerNames: string[]): StoredGameState {
  const engine = GameEngine.createGame({ playerNames });
  const snapshot = engine.getSnapshot();
  const now = new Date().toISOString();

  const playerMappings: PlayerMapping[] = snapshot.players.map((player, index) => ({
    engineId: player.id,
    lobbyId: `lobby-${index + 1}`,
    name: playerNames[index]!,
    isAI: index > 0,
    aiModelId: index > 0 ? "default:grok" : undefined,
  }));

  return {
    engineSnapshot: engine.toJSON(),
    playerMappings,
    roomId: "test-room",
    createdAt: now,
    updatedAt: now,
    activityLog: [],
  };
}

async function executeQueuedAction(
  storedStateRef: { current: StoredGameState | null },
  playerId: string,
  action: Parameters<AITurnCoordinatorDeps["executeAIAction"]>[1]
) {
  const result = await executeStoredGameAction({
    roomPhase: "playing",
    callerPlayerId: playerId,
    action,
    getState: async () => storedStateRef.current,
    setState: async (state) => {
      storedStateRef.current = state;
    },
  });

  if (!result.ok) {
    const latestState = storedStateRef.current;
    if (!latestState) {
      throw new Error(result.outboundMessages[0].message);
    }
    return {
      ok: false as const,
      snapshot: PartyGameAdapter.fromStoredState(latestState).getSnapshot(),
      error: result.outboundMessages[0].error,
    };
  }

  return {
    ok: true as const,
    snapshot: result.snapshot,
  };
}

describe("AI Turn Coordinator - Reorder Race Condition", () => {
  it("preserves a human reorder made while an AI turn is running", async () => {
    let initialState = createTestGameState(["Human", "AI-Alice", "AI-Bob"]);

    // Advance the opening human turn if needed so an AI is awaited.
    const openingAdapter = PartyGameAdapter.fromStoredState(initialState);
    const humanMapping = openingAdapter.getAllPlayerMappings().find((mapping) => !mapping.isAI)!;
    if (openingAdapter.getAwaitingLobbyPlayerId() === humanMapping.lobbyId) {
      const before = openingAdapter.getSnapshot();
      openingAdapter.drawFromStock(humanMapping.lobbyId);
      openingAdapter.skip(humanMapping.lobbyId);
      const human = before.players.find((player) => player.id === humanMapping.engineId)!;
      openingAdapter.discard(humanMapping.lobbyId, human.hand[0]!.id);
      initialState = openingAdapter.getStoredState();
    }

    const storedState = { current: initialState as StoredGameState | null };
    const adapter = PartyGameAdapter.fromStoredState(initialState);
    const human = adapter
      .getSnapshot()
      .players.find((player) => player.id === humanMapping.engineId)!;
    const reversedHandOrder = human.hand.map((card) => card.id).reverse();

    let aiTurnChecks = 0;
    const deps: AITurnCoordinatorDeps = {
      getState: async () => storedState.current,
      executeAIAction: (playerId, action) => executeQueuedAction(storedState, playerId, action),
      executeAITurn: async ({ runtime }) => {
        const reorderResult = await executeQueuedAction(storedState, humanMapping.lobbyId, {
          type: "REORDER_HAND",
          cardIds: reversedHandOrder,
        });
        expect(reorderResult.ok).toBe(true);

        const drawResult = await runtime.executeAction({ type: "DRAW_FROM_STOCK" });
        return {
          success: drawResult.ok,
          actions: ["draw_from_stock"],
          error: drawResult.ok ? undefined : drawResult.error,
        };
      },
      isAIPlayerTurn: (latestAdapter) => {
        if (aiTurnChecks++ > 0) return null;
        const awaitingLobbyId = latestAdapter.getAwaitingLobbyPlayerId();
        if (!awaitingLobbyId) return null;
        const mapping = latestAdapter.getPlayerMapping(awaitingLobbyId);
        return mapping?.isAI ? mapping : null;
      },
      createAdapter: PartyGameAdapter.fromStoredState,
      env: {} as AITurnCoordinatorDeps["env"],
      thinkingDelayMs: 0,
      interTurnDelayMs: 0,
      toolDelayMs: 0,
    };

    const coordinator = new AITurnCoordinator(deps);
    await coordinator.executeAITurnsIfNeeded();

    const finalAdapter = PartyGameAdapter.fromStoredState(storedState.current!);
    const finalHuman = finalAdapter
      .getSnapshot()
      .players.find((player) => player.id === humanMapping.engineId)!;

    expect(finalHuman.hand.map((card) => card.id)).toEqual(reversedHandOrder);
  });

  it("does not run overlapping AI loops when called concurrently", async () => {
    const storedState = { current: createTestGameState(["Human", "AI-Alice", "AI-Bob"]) };
    const aiMapping = PartyGameAdapter.fromStoredState(storedState.current)
      .getAllPlayerMappings()
      .find((mapping) => mapping.isAI)!;

    let executeCalls = 0;
    let releaseAITurn!: () => void;
    const waitForRelease = new Promise<void>((resolve) => {
      releaseAITurn = resolve;
    });

    const deps: AITurnCoordinatorDeps = {
      getState: async () => storedState.current,
      executeAIAction: (playerId, action) => executeQueuedAction(storedState, playerId, action),
      executeAITurn: async () => {
        executeCalls++;
        await waitForRelease;
        return { success: true, actions: [] };
      },
      isAIPlayerTurn: () => (executeCalls === 0 ? aiMapping : null),
      createAdapter: PartyGameAdapter.fromStoredState,
      env: {} as AITurnCoordinatorDeps["env"],
      thinkingDelayMs: 0,
      interTurnDelayMs: 0,
      toolDelayMs: 0,
    };

    const coordinator = new AITurnCoordinator(deps);

    const first = coordinator.executeAITurnsIfNeeded();
    await Promise.resolve();
    const second = coordinator.executeAITurnsIfNeeded();

    releaseAITurn();
    await Promise.all([first, second]);

    expect(executeCalls).toBe(1);
  });
});
