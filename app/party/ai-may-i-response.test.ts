import { describe, expect, it } from "bun:test";

import type { AIActionRuntime, GameAction } from "../../ai/ai-action-runtime.types";
import type { GameSnapshot } from "../../core/engine/game-engine.types";
import { settleAIMayIResponse } from "./ai-may-i-response";

function createResolvingMayISnapshot(overrides: Partial<GameSnapshot> = {}): GameSnapshot {
  return {
    version: "3.0",
    gameId: "test-room",
    phase: "RESOLVING_MAY_I",
    turnPhase: "AWAITING_ACTION",
    awaitingPlayerId: "ai-engine-id",
    currentRound: 1,
    contract: { roundNumber: 1, sets: 2, runs: 0 },
    players: [],
    dealerIndex: 2,
    currentPlayerIndex: 0,
    table: [],
    stock: [],
    discard: [],
    turnNumber: 1,
    hasDrawn: true,
    laidDownThisTurn: false,
    tookActionThisTurn: false,
    lastDiscardedByPlayerId: "current-player",
    discardClaimed: false,
    mayIContext: {
      originalCaller: "caller",
      cardBeingClaimed: { id: "discard-card", rank: "K", suit: "spades" },
      playersToCheck: ["ai-engine-id"],
      currentPromptIndex: 0,
      playerBeingPrompted: "ai-engine-id",
      playersWhoAllowed: [],
      winner: null,
      outcome: null,
    },
    roundHistory: [],
    lastError: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createRuntime(snapshot: GameSnapshot, actions: GameAction[]): AIActionRuntime {
  return {
    getSnapshot: async () => snapshot,
    executeAction: async (action) => {
      actions.push(action);
      return {
        ok: true,
        snapshot: createResolvingMayISnapshot({
          phase: "ROUND_ACTIVE",
          awaitingPlayerId: "current-player",
          mayIContext: null,
        }),
      };
    },
  };
}

describe("settleAIMayIResponse", () => {
  it("defaults a failed AI May-I response to allow through the normal action runtime", async () => {
    const actions: GameAction[] = [];
    const result = await settleAIMayIResponse({
      promptedEngineId: "ai-engine-id",
      runtime: createRuntime(createResolvingMayISnapshot(), actions),
      executeResponse: async () => ({
        success: false,
        actions: [],
        error: "inference API failed",
      }),
    });

    expect(result.defaultAllowed).toBe(true);
    expect(actions).toEqual([{ type: "ALLOW_MAY_I" }]);
  });

  it("defaults a no-op AI May-I response to allow when the same AI is still prompted", async () => {
    const actions: GameAction[] = [];
    const result = await settleAIMayIResponse({
      promptedEngineId: "ai-engine-id",
      runtime: createRuntime(createResolvingMayISnapshot(), actions),
      executeResponse: async () => ({
        success: true,
        actions: [],
      }),
    });

    expect(result.defaultAllowed).toBe(true);
    expect(actions).toEqual([{ type: "ALLOW_MAY_I" }]);
  });

  it("does not default allow after a successful response advances May-I resolution", async () => {
    const actions: GameAction[] = [];
    const result = await settleAIMayIResponse({
      promptedEngineId: "ai-engine-id",
      runtime: createRuntime(
        createResolvingMayISnapshot({
          awaitingPlayerId: "next-player",
          mayIContext: {
            originalCaller: "caller",
            cardBeingClaimed: { id: "discard-card", rank: "K", suit: "spades" },
            playersToCheck: ["ai-engine-id", "next-player"],
            currentPromptIndex: 1,
            playerBeingPrompted: "next-player",
            playersWhoAllowed: ["ai-engine-id"],
            winner: null,
            outcome: null,
          },
        }),
        actions
      ),
      executeResponse: async () => ({
        success: true,
        actions: ["allow_may_i({})"],
      }),
    });

    expect(result.defaultAllowed).toBe(false);
    expect(actions).toEqual([]);
  });
});
