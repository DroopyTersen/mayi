import { describe, expect, it } from "bun:test";

import { summarizeAITurnMetrics } from "./ai-turn-metrics";

describe("AI turn metrics", () => {
  it("separates provider response time from full turn duration", () => {
    expect(
      summarizeAITurnMetrics({
        turnDurationMs: 2_000,
        stepPerformance: [
          { responseTimeMs: 500, toolExecutionMs: { draw: 25 } },
          { responseTimeMs: 700, toolExecutionMs: { discard: 15 } },
        ],
        usage: {
          inputTokens: 3_000,
          inputTokenDetails: {
            noCacheTokens: 1_000,
            cacheReadTokens: 1_500,
            cacheWriteTokens: 500,
          },
          outputTokens: 400,
          outputTokenDetails: {
            textTokens: 100,
            reasoningTokens: 300,
          },
          totalTokens: 3_400,
        },
      }),
    ).toEqual({
      turnDurationMs: 2_000,
      providerDurationMs: 1_200,
      toolExecutionDurationMs: 40,
      orchestrationDurationMs: 760,
      stepCount: 2,
      inputTokens: 3_000,
      noCacheInputTokens: 1_000,
      cacheReadInputTokens: 1_500,
      cacheWriteInputTokens: 500,
      outputTokens: 400,
      textOutputTokens: 100,
      reasoningOutputTokens: 300,
      totalTokens: 3_400,
    });
  });
});
