/**
 * Unit tests for mayIAgent
 *
 * Tests stopWhenTurnComplete - a pure function that determines
 * when to stop the agent loop.
 */

import { APICallError } from "@ai-sdk/provider";
import { describe, it, expect } from "bun:test";
import type { LanguageModel } from "ai";
import type { AIActionRuntime } from "./ai-action-runtime.types";
import { executeTurn, stopWhenTurnComplete } from "./mayIAgent";
import type { GameSnapshot } from "../core/engine/game-engine.types";

/**
 * Helper to create a minimal step with optional turnComplete in tool result
 */
function makeStep(turnComplete?: boolean) {
  if (turnComplete === undefined) {
    return { toolResults: undefined };
  }
  return {
    toolResults: [
      {
        output: {
          success: true,
          message: "OK",
          turnComplete,
        },
      },
    ],
  };
}

describe("stopWhenTurnComplete", () => {
  describe("maxSteps limit", () => {
    it("stops when maxSteps reached", () => {
      const shouldStop = stopWhenTurnComplete(3);
      const steps = [makeStep(false), makeStep(false), makeStep(false)];
      expect(shouldStop({ steps } as never)).toBe(true);
    });

    it("continues when under maxSteps", () => {
      const shouldStop = stopWhenTurnComplete(5);
      const steps = [makeStep(false), makeStep(false)];
      expect(shouldStop({ steps } as never)).toBe(false);
    });

    it("stops exactly at maxSteps boundary", () => {
      const shouldStop = stopWhenTurnComplete(2);
      const oneStep = [makeStep(false)];
      const twoSteps = [makeStep(false), makeStep(false)];

      expect(shouldStop({ steps: oneStep } as never)).toBe(false);
      expect(shouldStop({ steps: twoSteps } as never)).toBe(true);
    });
  });

  describe("turnComplete flag", () => {
    it("stops immediately when turnComplete is true", () => {
      const shouldStop = stopWhenTurnComplete(10);
      const steps = [makeStep(true)];
      expect(shouldStop({ steps } as never)).toBe(true);
    });

    it("continues when turnComplete is false", () => {
      const shouldStop = stopWhenTurnComplete(10);
      const steps = [makeStep(false)];
      expect(shouldStop({ steps } as never)).toBe(false);
    });

    it("stops when turnComplete appears in later step", () => {
      const shouldStop = stopWhenTurnComplete(10);
      const steps = [makeStep(false), makeStep(false), makeStep(true)];
      expect(shouldStop({ steps } as never)).toBe(true);
    });

    it("stops on first turnComplete even if more steps follow", () => {
      const shouldStop = stopWhenTurnComplete(10);
      // First step has turnComplete, should stop there
      const steps = [makeStep(true), makeStep(false)];
      expect(shouldStop({ steps } as never)).toBe(true);
    });
  });

  describe("undefined/empty toolResults", () => {
    it("continues when toolResults is undefined", () => {
      const shouldStop = stopWhenTurnComplete(10);
      const steps = [{ toolResults: undefined }];
      expect(shouldStop({ steps } as never)).toBe(false);
    });

    it("continues when toolResults is empty array", () => {
      const shouldStop = stopWhenTurnComplete(10);
      const steps = [{ toolResults: [] }];
      expect(shouldStop({ steps } as never)).toBe(false);
    });

    it("continues with empty steps array", () => {
      const shouldStop = stopWhenTurnComplete(10);
      expect(shouldStop({ steps: [] } as never)).toBe(false);
    });
  });

  describe("mixed scenarios", () => {
    it("prefers turnComplete over maxSteps if both conditions met", () => {
      const shouldStop = stopWhenTurnComplete(2);
      // Two steps AND turnComplete - both would trigger stop
      const steps = [makeStep(false), makeStep(true)];
      expect(shouldStop({ steps } as never)).toBe(true);
    });

    it("handles step with multiple tool results", () => {
      const shouldStop = stopWhenTurnComplete(10);
      const steps = [
        {
          toolResults: [
            { output: { success: true, turnComplete: false } },
            { output: { success: true, turnComplete: true } },
          ],
        },
      ];
      expect(shouldStop({ steps } as never)).toBe(true);
    });
  });
});

function createRetryableFailureModel(options: {
  attempts: { count: number };
  failuresBeforeSuccess: number;
}): LanguageModel {
  return {
    specificationVersion: "v3",
    provider: "test-provider",
    modelId: "retryable-failure-model",
    supportedUrls: {},
    doGenerate: async () => {
      options.attempts.count++;
      if (options.attempts.count <= options.failuresBeforeSuccess) {
        throw new APICallError({
          message: "retryable failure",
          url: "https://example.test/ai",
          requestBodyValues: {},
          statusCode: 500,
          responseHeaders: { "retry-after-ms": "0" },
        });
      }

      return {
        content: [{ type: "text", text: "done" }],
        finishReason: { unified: "stop", raw: "stop" },
        usage: {
          inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 1, text: 1, reasoning: 0 },
        },
        warnings: [],
      };
    },
    doStream: async () => {
      throw new Error("streaming is not used by executeTurn");
    },
  };
}

function createAISnapshot(): GameSnapshot {
  return {
    version: "3.0",
    gameId: "test-game",
    lastError: null,
    phase: "ROUND_ACTIVE",
    turnPhase: "AWAITING_DRAW",
    turnNumber: 1,
    lastDiscardedByPlayerId: null,
    discardClaimed: false,
    currentRound: 1,
    contract: { roundNumber: 1, sets: 2, runs: 0 },
    players: [
      {
        id: "ai",
        name: "AI",
        hand: [],
        isDown: false,
        totalScore: 0,
      },
    ],
    dealerIndex: 0,
    currentPlayerIndex: 0,
    awaitingPlayerId: "ai",
    stock: [],
    discard: [],
    table: [],
    hasDrawn: false,
    laidDownThisTurn: false,
    tookActionThisTurn: false,
    mayIContext: null,
    roundHistory: [],
    createdAt: "2026-04-26T00:00:00.000Z",
    updatedAt: "2026-04-26T00:00:00.000Z",
  };
}

function createRuntime(snapshot: GameSnapshot): AIActionRuntime {
  return {
    getSnapshot: async () => snapshot,
    executeAction: async () => ({ ok: true, snapshot }),
  };
}

describe("executeTurn retry settings", () => {
  it("passes maxRetries through to the AI SDK", async () => {
    const attempts = { count: 0 };

    const result = await executeTurn({
      model: createRetryableFailureModel({ attempts, failuresBeforeSuccess: 1 }),
      runtime: createRuntime(createAISnapshot()),
      playerId: "ai",
      maxSteps: 1,
      maxRetries: 0,
      telemetry: false,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("retryable failure");
    expect(attempts.count).toBe(1);
  });

  it("reports an incomplete turn when retries end in text without a terminal tool", async () => {
    const attempts = { count: 0 };

    const result = await executeTurn({
      model: createRetryableFailureModel({ attempts, failuresBeforeSuccess: 2 }),
      runtime: createRuntime(createAISnapshot()),
      playerId: "ai",
      maxSteps: 1,
      maxRetries: 2,
      telemetry: false,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("without completing the game turn");
    expect(attempts.count).toBe(3);
  });
});
