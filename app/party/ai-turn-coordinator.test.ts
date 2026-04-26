import { describe, expect, it } from "bun:test";

import { AITurnCoordinator, type AITurnCoordinatorDeps } from "./ai-turn-coordinator";
import type { GameSnapshot } from "../../core/engine/game-engine.types";
import type { PlayerMapping, StoredGameState } from "./party-game-adapter";
import type { GameAction } from "./protocol.types";
import type { PartyGameAdapter } from "./party-game-adapter";

function createSnapshot(overrides: Partial<GameSnapshot> = {}): GameSnapshot {
  return {
    version: "3.0",
    gameId: "test-room",
    phase: "ROUND_ACTIVE",
    turnPhase: "AWAITING_DRAW",
    awaitingPlayerId: "player-0",
    currentRound: 1,
    contract: { roundNumber: 1, sets: 2, runs: 0 },
    players: [],
    dealerIndex: 2,
    currentPlayerIndex: 0,
    table: [],
    stock: [],
    discard: [],
    turnNumber: 1,
    hasDrawn: false,
    laidDownThisTurn: false,
    tookActionThisTurn: false,
    lastDiscardedByPlayerId: null,
    discardClaimed: false,
    mayIContext: null,
    roundHistory: [],
    lastError: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createStoredState(label = "initial"): StoredGameState {
  return {
    roomId: "test-room",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    activityLog: [],
    playerMappings: [],
    engineSnapshot: JSON.stringify({ label }),
  };
}

function createAIPlayerMapping(): PlayerMapping {
  return {
    lobbyId: "ai-player-1",
    engineId: "player-0",
    name: "AI 1",
    isAI: true,
    aiModelId: "default:grok",
  };
}

function createDeps(options: Partial<{
  aiTurnSequence: boolean[];
  executeAITurn: AITurnCoordinatorDeps["executeAITurn"];
  snapshotForState: (state: StoredGameState) => GameSnapshot;
}> = {}): {
  deps: AITurnCoordinatorDeps;
  state: { current: StoredGameState };
  executedActions: GameAction[];
} {
  const state = { current: createStoredState() };
  const executedActions: GameAction[] = [];
  const aiTurnSequence = options.aiTurnSequence ?? [true, false];
  let aiTurnCallCount = 0;

  const deps: AITurnCoordinatorDeps = {
    getState: async () => state.current,
    executeAIAction: async (_playerId, action) => {
      executedActions.push(action);
      return {
        ok: true,
        snapshot: createSnapshot({ turnPhase: "AWAITING_ACTION", hasDrawn: true }),
      };
    },
    executeAITurn:
      options.executeAITurn ??
      (async () => ({
        success: true,
        actions: ["draw_from_stock"],
      })),
    env: {} as AITurnCoordinatorDeps["env"],
    isAIPlayerTurn: () => {
      const isAITurn = aiTurnSequence[aiTurnCallCount] ?? false;
      aiTurnCallCount++;
      return isAITurn ? createAIPlayerMapping() : null;
    },
    createAdapter: (storedState) =>
      ({
        getSnapshot: () =>
          options.snapshotForState?.(storedState) ?? createSnapshot(),
      }) as PartyGameAdapter,
    thinkingDelayMs: 0,
    interTurnDelayMs: 0,
    toolDelayMs: 0,
  };

  return { deps, state, executedActions };
}

describe("AITurnCoordinator", () => {
  it("exits immediately when the latest state is not awaiting an AI", async () => {
    let executed = false;
    const { deps } = createDeps({
      aiTurnSequence: [false],
      executeAITurn: async () => {
        executed = true;
        return { success: true, actions: [] };
      },
    });

    const coordinator = new AITurnCoordinator(deps);
    await coordinator.executeAITurnsIfNeeded();

    expect(executed).toBe(false);
    expect(coordinator.isRunning()).toBe(false);
  });

  it("passes an AIActionRuntime that executes normal game actions", async () => {
    const { deps, executedActions } = createDeps({
      executeAITurn: async ({ runtime }) => {
        const result = await runtime.executeAction({ type: "DRAW_FROM_STOCK" });
        expect(result.ok).toBe(true);
        return { success: true, actions: ["draw_from_stock"] };
      },
    });

    const coordinator = new AITurnCoordinator(deps);
    await coordinator.executeAITurnsIfNeeded();

    expect(executedActions).toEqual([{ type: "DRAW_FROM_STOCK" }]);
  });

  it("runtime snapshots are read from the latest stored state", async () => {
    const { deps, state } = createDeps({
      snapshotForState: (storedState) =>
        createSnapshot({
          turnPhase:
            storedState.engineSnapshot.includes("latest")
              ? "AWAITING_DISCARD"
              : "AWAITING_DRAW",
        }),
      executeAITurn: async ({ runtime }) => {
        state.current = createStoredState("latest");
        const snapshot = await runtime.getSnapshot();
        expect(snapshot.turnPhase).toBe("AWAITING_DISCARD");
        return { success: true, actions: [] };
      },
    });

    const coordinator = new AITurnCoordinator(deps);
    await coordinator.executeAITurnsIfNeeded();
  });

  it("does not run stale final persistence after runtime actions", async () => {
    let executeTurnCompleted = false;
    const { deps, executedActions } = createDeps({
      executeAITurn: async ({ runtime }) => {
        await runtime.executeAction({ type: "DISCARD", cardId: "card-1" });
        executeTurnCompleted = true;
        return { success: true, actions: ["discard"] };
      },
    });

    const coordinator = new AITurnCoordinator(deps);
    await coordinator.executeAITurnsIfNeeded();

    expect(executeTurnCompleted).toBe(true);
    expect(executedActions).toEqual([{ type: "DISCARD", cardId: "card-1" }]);
  });

  it("calls done and exits cleanly when a turn is aborted", async () => {
    const { deps } = createDeps({
      executeAITurn: async ({ abortSignal }) =>
        new Promise((_, reject) => {
          abortSignal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    });

    const coordinator = new AITurnCoordinator(deps);
    const doneCalls: string[] = [];

    const promise = coordinator.executeAITurnsIfNeeded({
      onAIDone: (playerId) => {
        doneCalls.push(playerId);
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    coordinator.abortCurrentTurn();
    await promise;

    expect(doneCalls).toEqual(["ai-player-1"]);
    expect(coordinator.isRunning()).toBe(false);
  });

  it("stops chaining when executeAITurn reports an abort", async () => {
    let turns = 0;
    const { deps } = createDeps({
      aiTurnSequence: [true, true],
      executeAITurn: async () => {
        turns++;
        return { success: true, actions: [], aborted: true };
      },
    });

    const coordinator = new AITurnCoordinator(deps);
    await coordinator.executeAITurnsIfNeeded();

    expect(turns).toBe(1);
  });

  it("handles chained AI turns with the safety limit", async () => {
    let turns = 0;
    const { deps } = createDeps({
      aiTurnSequence: Array(20).fill(true),
      executeAITurn: async () => {
        turns++;
        return { success: true, actions: ["draw", "discard"] };
      },
    });

    const coordinator = new AITurnCoordinator(deps);
    await coordinator.executeAITurnsIfNeeded();

    expect(turns).toBe(8);
  });

  it("is safe to abort when no turn is running", () => {
    const { deps } = createDeps({ aiTurnSequence: [false] });
    const coordinator = new AITurnCoordinator(deps);

    expect(() => coordinator.abortCurrentTurn()).not.toThrow();
    expect(coordinator.isRunning()).toBe(false);
  });
});
