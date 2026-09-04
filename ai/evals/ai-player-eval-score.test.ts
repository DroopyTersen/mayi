import { describe, expect, it } from "bun:test";
import {
  aggregateAIPlayerEvalResults,
  reconstructAIPlayerEvalCostUsd,
  scoreAIPlayerEvalCase,
  type AIPlayerEvalCaseResult,
} from "./ai-player-eval-score";

function result(
  overrides: Partial<AIPlayerEvalCaseResult> = {},
): AIPlayerEvalCaseResult {
  return {
    schemaVersion: 1,
    runId: "run-1",
    candidate: {
      id: "luna-xhigh-house-rules-v3",
      modelId: "default:openai",
      provider: "openai",
      reasoningEffort: "xhigh",
      promptVersion: "house-rules-v3",
    },
    scenario: {
      id: "go-down-now",
      split: "development",
      category: "contract",
      description: "Lay down a complete contract immediately.",
    },
    repetition: 1,
    completed: true,
    legal: true,
    criteria: [
      {
        id: "laid-down",
        description: "The player lays down the available contract.",
        weight: 80,
        passed: true,
        evidence: "LAY_DOWN was accepted",
      },
      {
        id: "safe-discard",
        description: "The player discards the safest remaining card.",
        weight: 20,
        passed: true,
        evidence: "discarded 4 clubs",
      },
    ],
    failureMode: "none",
    retries: 0,
    timing: {
      turnDurationMs: 1_000,
      providerDurationMs: 700,
      toolExecutionDurationMs: 100,
      orchestrationDurationMs: 200,
      pacingDelayMs: 10_000,
    },
    usage: {
      inputTokens: 1_000,
      noCacheInputTokens: 600,
      cacheReadInputTokens: 400,
      cacheWriteInputTokens: 0,
      outputTokens: 200,
      reasoningOutputTokens: 150,
      totalTokens: 1_200,
    },
    providerReportedCostUsd: 0.002,
    reconstructedCostUsd: 0.001,
    inputState: "Rendered state shown to the evaluated player.",
    outcome: {
      phase: "ROUND_ACTIVE",
      turnPhase: "AWAITING_DRAW",
      awaitingPlayerId: "eval-player-1",
      evaluatedPlayerHandCardIds: ["p0-3"],
      tableMeldCount: 2,
      topDiscardCardId: "stock-a",
      lastError: null,
    },
    actions: ["lay_down", "discard"],
    warnings: [],
    ...overrides,
  };
}

describe("AI player evaluation scoring", () => {
  it("uses completion and legality as hard gates for tactical quality", () => {
    expect(scoreAIPlayerEvalCase(result())).toEqual({
      earnedWeight: 100,
      possibleWeight: 100,
      qualityPercent: 100,
    });

    expect(
      scoreAIPlayerEvalCase(result({ completed: false, failureMode: "turn-incomplete" })),
    ).toEqual({
      earnedWeight: 0,
      possibleWeight: 100,
      qualityPercent: 0,
    });

    expect(
      scoreAIPlayerEvalCase(
        result({
          legal: true,
          criteria: [
            {
              id: "laid-down",
              description: "The player lays down the available contract.",
              weight: 80,
              passed: true,
              evidence: "LAY_DOWN was accepted",
            },
            {
              id: "safe-discard",
              description: "The player discards the safest remaining card.",
              weight: 20,
              passed: false,
              evidence: "discarded a card collected by the opponent",
            },
          ],
        }),
      ),
    ).toEqual({
      earnedWeight: 80,
      possibleWeight: 100,
      qualityPercent: 80,
    });
  });

  it("prefers provider-reported cost and keeps raw latency separate from pacing", () => {
    const summary = aggregateAIPlayerEvalResults([
      result(),
      result({
        scenario: {
          id: "holdout-may-i",
          split: "holdout",
          category: "may-i",
          description: "Decline a strategically harmful May I claim.",
        },
        completed: false,
        legal: false,
        failureMode: "turn-incomplete",
        timing: {
          turnDurationMs: 3_000,
          providerDurationMs: 2_500,
          toolExecutionDurationMs: 100,
          orchestrationDurationMs: 400,
          pacingDelayMs: 10_000,
        },
        providerReportedCostUsd: undefined,
        reconstructedCostUsd: 0.001,
      }),
    ]);

    expect(summary.caseCount).toBe(2);
    expect(summary.completionRate).toBe(0.5);
    expect(summary.legalRate).toBe(0.5);
    expect(summary.qualityPercent).toBe(50);
    expect(summary.qualityConfidence95).toEqual({ lower: 0, upper: 100 });
    expect(summary.developmentQualityPercent).toBe(100);
    expect(summary.holdoutQualityPercent).toBe(0);
    expect(summary.turnLatencyMs).toEqual({ p50: 1_000, p95: 3_000 });
    expect(summary.providerLatencyMs).toEqual({ p50: 700, p95: 2_500 });
    expect(summary.pacingDelayMs).toEqual({ p50: 10_000, p95: 10_000 });
    expect(summary.totalCostUsd).toBeCloseTo(0.003, 12);
    expect(summary.costPerCompletedTurnUsd).toBeCloseTo(0.003, 12);
    expect(summary.failureModes).toEqual({
      none: 1,
      "turn-incomplete": 1,
    });
  });

  it("reports a bounded 95 percent confidence interval for tactical quality", () => {
    const results = [100, 80, 80, 100].map((quality, index) =>
      result({
        repetition: index + 1,
        criteria: [
          {
            id: "core-quality",
            description: "Core tactical quality.",
            weight: 80,
            passed: true,
            evidence: String(quality),
          },
          {
            id: "bonus-quality",
            description: "Additional tactical quality.",
            weight: 20,
            passed: quality === 100,
            evidence: String(quality),
          },
        ],
      }),
    );

    const summary = aggregateAIPlayerEvalResults(results);
    expect(summary.qualityPercent).toBe(90);
    expect(summary.qualityConfidence95.lower).toBeCloseTo(78.68, 2);
    expect(summary.qualityConfidence95.upper).toBe(100);
  });

  it("reconstructs cost from mutually exclusive token buckets", () => {
    expect(
      reconstructAIPlayerEvalCostUsd(
        {
          inputTokens: 1_000,
          noCacheInputTokens: 600,
          cacheReadInputTokens: 300,
          cacheWriteInputTokens: 100,
          outputTokens: 200,
          reasoningOutputTokens: 150,
          totalTokens: 1_200,
        },
        {
          noCacheInputPerMillionUsd: 0.2,
          cacheReadInputPerMillionUsd: 0.02,
          cacheWriteInputPerMillionUsd: 0.25,
          outputPerMillionUsd: 1.2,
        },
      ),
    ).toBeCloseTo(0.000391, 12);
  });
});
