/**
 * Unit tests for AITurnCoordinator
 *
 * Tests the abort/persist coordination logic without PartyKit.
 * Uses dependency injection with simple fake implementations.
 */

import { describe, it, expect } from "bun:test";
import { AITurnCoordinator, type AITurnCoordinatorDeps } from "./ai-turn-coordinator";
import type { StoredGameState, PlayerMapping } from "./party-game-adapter";

// Minimal fake adapter for testing
interface FakeAdapter {
  getSnapshot: () => { phase: string };
  getStoredState: () => StoredGameState;
}

// Test helper to create a minimal stored game state
function createTestGameState(): StoredGameState {
  return {
    roomId: "test-room",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    activityLog: [],
    playerMappings: [
      {
        lobbyId: "ai-player-1",
        engineId: "player-0",
        name: "AI 1",
        isAI: true,
        aiModelId: "default:grok",
      },
      {
        lobbyId: "human-player-1",
        engineId: "player-1",
        name: "Human 1",
        isAI: false,
      },
    ],
    engineSnapshot: "{}",
  };
}

// Create a fake PlayerMapping for AI player
function createAIPlayerMapping(): PlayerMapping {
  return {
    lobbyId: "ai-player-1",
    engineId: "player-0",
    name: "AI 1",
    isAI: true,
    aiModelId: "default:grok",
  };
}

// Simple fake deps for testing
function createFakeDeps(options: Partial<{
  isAITurn: boolean;
  executeAITurnFn: AITurnCoordinatorDeps["executeAITurn"];
  isAIPlayerTurnSequence: (boolean | null)[];
}> = {}): {
  deps: AITurnCoordinatorDeps;
  state: { current: StoredGameState };
  persistCount: { value: number };
  broadcastCount: { value: number };
} {
  const state = { current: createTestGameState() };
  const persistCount = { value: 0 };
  const broadcastCount = { value: 0 };

  const defaultExecuteAITurn: AITurnCoordinatorDeps["executeAITurn"] = async () => ({
    success: true,
    actions: ["draw", "discard"],
    usedFallback: false,
  });

  // Track calls to isAIPlayerTurn for sequence-based testing
  let isAITurnCallCount = 0;
  const isAITurnSequence = options.isAIPlayerTurnSequence ?? (options.isAITurn ? [true, false] : [false]);

  const deps: AITurnCoordinatorDeps = {
    getState: async () => state.current,
    setState: async (s) => {
      state.current = s;
      persistCount.value++;
    },
    broadcast: async () => {
      broadcastCount.value++;
    },
    executeAITurn: options.executeAITurnFn ?? defaultExecuteAITurn,
    env: {} as AITurnCoordinatorDeps["env"],
    // Inject fake isAIPlayerTurn that returns based on sequence
    isAIPlayerTurn: () => {
      const result = isAITurnSequence[isAITurnCallCount];
      isAITurnCallCount++;
      return result ? createAIPlayerMapping() : null;
    },
    // Inject fake createAdapter that returns a minimal adapter
    createAdapter: (s: StoredGameState) =>
      ({
        getSnapshot: () => ({ phase: "ROUND_ACTIVE" }),
        getStoredState: () => s,
      }) as unknown as ReturnType<AITurnCoordinatorDeps["createAdapter"] & {}>,
    // Disable delays for fast tests
    thinkingDelayMs: 0,
    interTurnDelayMs: 0,
  };

  return { deps, state, persistCount, broadcastCount };
}

describe("AITurnCoordinator", () => {
  describe("executeAITurnsIfNeeded", () => {
    it("should exit immediately if it's not an AI's turn", async () => {
      const { deps, persistCount } = createFakeDeps({
        isAITurn: false,
      });

      const coordinator = new AITurnCoordinator(deps);
      await coordinator.executeAITurnsIfNeeded();

      expect(coordinator.isRunning()).toBe(false);
      expect(persistCount.value).toBe(0); // No AI turn executed
    });

    it("should execute AI turn when it's an AI's turn", async () => {
      let aiTurnExecuted = false;
      const { deps } = createFakeDeps({
        isAITurn: true,
        executeAITurnFn: async () => {
          aiTurnExecuted = true;
          return {
            success: true,
            actions: ["draw", "discard"],
            usedFallback: false,
          };
        },
      });

      const coordinator = new AITurnCoordinator(deps);
      await coordinator.executeAITurnsIfNeeded();

      expect(aiTurnExecuted).toBe(true);
      expect(coordinator.isRunning()).toBe(false); // Cleaned up after completion
    });

    it("should abort when abortCurrentTurn is called mid-turn", async () => {
      const { deps, persistCount } = createFakeDeps({
        isAITurn: true,
        executeAITurnFn: async ({ abortSignal, onPersist }) => {
          // Simulate: persist after draw
          if (onPersist) await onPersist();

          // Simulate LLM thinking (where abort happens)
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(resolve, 1000);
            abortSignal?.addEventListener("abort", () => {
              clearTimeout(timeout);
              reject(new DOMException("Aborted", "AbortError"));
            });
          });

          return { success: true, actions: ["draw", "discard"], usedFallback: false };
        },
      });

      const coordinator = new AITurnCoordinator(deps);

      // Start turn, abort after 50ms
      const turnPromise = coordinator.executeAITurnsIfNeeded();
      await new Promise((r) => setTimeout(r, 50));
      coordinator.abortCurrentTurn();
      await turnPromise;

      expect(persistCount.value).toBeGreaterThan(0); // Draw was persisted before abort
      expect(coordinator.isRunning()).toBe(false); // Cleaned up
    });

    it("should call onPersist after each tool execution", async () => {
      let persistCallCount = 0;

      const { deps } = createFakeDeps({
        isAITurn: true,
        executeAITurnFn: async ({ onPersist }) => {
          if (onPersist) {
            await onPersist(); // After draw
            await onPersist(); // After skip
            await onPersist(); // After discard
          }
          return { success: true, actions: ["draw", "skip", "discard"], usedFallback: false };
        },
      });

      // Track persist calls
      const originalSetState = deps.setState;
      deps.setState = async (s) => {
        persistCallCount++;
        await originalSetState(s);
      };

      const coordinator = new AITurnCoordinator(deps);
      await coordinator.executeAITurnsIfNeeded();

      // 3 from onPersist + 1 final save
      expect(persistCallCount).toBe(4);
    });

    it("should exit loop cleanly on abort without throwing", async () => {
      const { deps } = createFakeDeps({
        isAITurn: true,
        executeAITurnFn: async ({ abortSignal }) => {
          return new Promise((_, reject) => {
            abortSignal?.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
          });
        },
      });

      const coordinator = new AITurnCoordinator(deps);

      const turnPromise = coordinator.executeAITurnsIfNeeded();
      // Give it a tick to start the AI turn (delays are 0 in tests)
      await new Promise((r) => setTimeout(r, 10));
      coordinator.abortCurrentTurn();

      // Should resolve without throwing
      await expect(turnPromise).resolves.toBeUndefined();
    });

    it("should clean up AbortController on normal completion", async () => {
      const { deps } = createFakeDeps({
        isAITurn: false, // Not AI's turn - exit immediately
      });

      const coordinator = new AITurnCoordinator(deps);
      await coordinator.executeAITurnsIfNeeded();

      expect(coordinator.isRunning()).toBe(false);
    });

    it("should broadcast after each persist", async () => {
      let broadcastCount = 0;

      const { deps } = createFakeDeps({
        isAITurn: true,
        executeAITurnFn: async ({ onPersist }) => {
          if (onPersist) await onPersist();
          return { success: true, actions: ["draw"], usedFallback: false };
        },
      });

      deps.broadcast = async () => {
        broadcastCount++;
      };

      const coordinator = new AITurnCoordinator(deps);
      await coordinator.executeAITurnsIfNeeded();

      expect(broadcastCount).toBeGreaterThanOrEqual(1);
    });

    it("should handle chained AI turns", async () => {
      let aiTurnCount = 0;

      const { deps } = createFakeDeps({
        // 3 AI turns, then human turn
        isAIPlayerTurnSequence: [true, true, true, false],
        executeAITurnFn: async () => {
          aiTurnCount++;
          return { success: true, actions: ["draw", "discard"], usedFallback: false };
        },
      });

      const coordinator = new AITurnCoordinator(deps);
      await coordinator.executeAITurnsIfNeeded();

      expect(aiTurnCount).toBe(3);
    });

    it("should respect MAX_CHAINED_TURNS limit", async () => {
      let aiTurnCount = 0;

      const { deps } = createFakeDeps({
        // Always AI turn (would loop forever without limit)
        isAIPlayerTurnSequence: Array(20).fill(true),
        executeAITurnFn: async () => {
          aiTurnCount++;
          return { success: true, actions: ["draw", "discard"], usedFallback: false };
        },
      });

      const coordinator = new AITurnCoordinator(deps);
      await coordinator.executeAITurnsIfNeeded();

      // Should stop at MAX_CHAINED_TURNS (8)
      expect(aiTurnCount).toBe(8);
    });
  });

  describe("abortCurrentTurn", () => {
    it("should be safe to call when no turn is running", () => {
      const { deps } = createFakeDeps({
        isAITurn: false,
      });

      const coordinator = new AITurnCoordinator(deps);

      // Should not throw
      expect(() => coordinator.abortCurrentTurn()).not.toThrow();
    });
  });

  describe("isRunning", () => {
    it("should return false when no turn is running", () => {
      const { deps } = createFakeDeps();
      const coordinator = new AITurnCoordinator(deps);

      expect(coordinator.isRunning()).toBe(false);
    });
  });
});
