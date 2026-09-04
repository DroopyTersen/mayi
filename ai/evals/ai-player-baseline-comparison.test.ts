import { describe, expect, it } from "bun:test";
import type { AIPlayerEvalCaseResult } from "./ai-player-eval-score";
import type { AIPlayerEvalRunArtifact } from "./ai-player-eval-run-comparison";
import {
  compareAIPlayerToFrozenLuna,
  formatAIPlayerFrozenBaselineComparisonMarkdown,
  parseAIPlayerFrozenBaselineComparisonArguments,
} from "./ai-player-baseline-comparison";

function result(options: {
  runId: "luna" | "spark";
  candidateId: "luna-xhigh-baseline" | "spark-high";
  scenarioId: string;
  split: "development" | "holdout";
  repetition: number;
  passed: boolean;
  providerDurationMs: number;
  costUsd: number;
}): AIPlayerEvalCaseResult {
  return {
    schemaVersion: 1,
    runId: options.runId,
    candidate: {
      id: options.candidateId,
      modelId:
        options.candidateId === "luna-xhigh-baseline"
          ? "default:openai"
          : "default:meta",
      provider:
        options.candidateId === "luna-xhigh-baseline" ? "openai" : "openrouter",
      reasoningEffort: "xhigh",
      promptVersion:
        options.candidateId === "luna-xhigh-baseline"
          ? "house-rules-v3"
          : "house-rules-v3+winning-prompt",
    },
    scenario: {
      id: options.scenarioId,
      split: options.split,
      category: "strategy",
      description: options.scenarioId,
    },
    repetition: options.repetition,
    completed: true,
    legal: true,
    criteria: [
      {
        id: "best-action",
        description: "Choose the best action",
        weight: 100,
        passed: options.passed,
        evidence: options.passed ? "best action" : "weaker action",
      },
    ],
    failureMode: options.passed ? "none" : "strategy",
    retries: 0,
    timing: {
      turnDurationMs: options.providerDurationMs + 20,
      providerDurationMs: options.providerDurationMs,
      toolExecutionDurationMs: 10,
      orchestrationDurationMs: 10,
      pacingDelayMs: 0,
    },
    usage: {
      inputTokens: 1_000,
      noCacheInputTokens: 1_000,
      cacheReadInputTokens: 0,
      cacheWriteInputTokens: 0,
      outputTokens: 100,
      reasoningOutputTokens: 50,
      totalTokens: 1_100,
    },
    providerReportedCostUsd: options.costUsd,
    reconstructedCostUsd: undefined,
    inputState: `canonical state ${options.scenarioId}:${options.repetition}`,
    outcome: {
      phase: "ROUND_ACTIVE",
      turnPhase: "AWAITING_DRAW",
      awaitingPlayerId: "next-player",
      evaluatedPlayerHandCardIds: [],
      tableMeldCount: 0,
      topDiscardCardId: null,
      lastError: null,
    },
    actions: [],
    warnings: [],
  };
}

function artifact(
  kind: "luna" | "spark",
  passByScenario: readonly boolean[],
): AIPlayerEvalRunArtifact {
  const candidateId = kind === "luna" ? "luna-xhigh-baseline" : "spark-high";
  const repetitions = kind === "luna" ? 1 : 3;
  const scenarioIds = ["dev-a", "dev-b", "holdout-a", "holdout-b"];
  const cases = scenarioIds.flatMap((scenarioId, scenarioIndex) =>
    Array.from({ length: repetitions }, (_, repetitionIndex) =>
      result({
        runId: kind,
        candidateId,
        scenarioId,
        split: scenarioId.startsWith("holdout") ? "holdout" : "development",
        repetition: repetitionIndex + 1,
        passed: passByScenario[scenarioIndex] ?? false,
        providerDurationMs: kind === "luna" ? 8_000 : 2_000,
        costUsd: kind === "luna" ? 0.001 : 0.0001,
      }),
    ),
  );
  return {
    manifest: {
      schemaVersion: 1,
      runId: kind,
      harnessVersion: "ai-player-eval-harness-v2",
      suiteVersion: "fixed-state-v1",
      split: "all",
      prompt: {
        version:
          kind === "luna" ? "house-rules-v3" : "house-rules-v3+winning-prompt",
        sha256: kind === "luna" ? "luna-prompt" : "spark-prompt",
      },
      candidates: [
        {
          id: candidateId,
          modelId: kind === "luna" ? "default:openai" : "default:meta",
          provider: kind === "luna" ? "openai" : "openrouter",
          reasoningEffort: "xhigh",
          promptVersion:
            kind === "luna"
              ? "house-rules-v3"
              : "house-rules-v3+winning-prompt",
        },
      ],
    },
    cases,
    ...(kind === "luna"
      ? {}
      : {
          runStatus: {
            policyVersion: "matched-unit-observed-cost-v1" as const,
            status: "completed" as const,
            maxCostUsd: 0.25,
            observedCostUsd: 0.0012,
            overshootUsd: 0,
            unknownCostResultCount: 0,
            plannedUnitCount: 12,
            completedUnitCount: 12,
            plannedResultCount: 12,
            executedResultCount: 12,
          },
        }),
  };
}

describe("frozen Luna baseline comparison", () => {
  it("defaults to the current replay-certified Luna artifact", () => {
    expect(
      parseAIPlayerFrozenBaselineComparisonArguments([
        "--spark-run",
        ".data/ai-evals/spark-checkpoint",
        "--spark-candidate",
        "spark-high",
      ]),
    ).toEqual({
      referenceDirectory: ".data/ai-evals/luna-frozen-baseline-certified-v4",
      sparkDirectory: ".data/ai-evals/spark-checkpoint",
      sparkCandidateId: "spark-high",
    });
  });

  it("compares canonical matched skill while preserving repeated Spark metrics", () => {
    const comparison = compareAIPlayerToFrozenLuna(
      artifact("luna", [true, false, true, false]),
      artifact("spark", [true, true, true, true]),
      "spark-high",
    );

    expect(comparison.comparisonKind).toBe("descriptive-frozen-baseline");
    expect(comparison.matchedCanonicalCaseCount).toBe(4);
    expect(comparison.qualityDeltaPercentPoints).toBe(50);
    expect(comparison.canonicalWins).toBe(2);
    expect(comparison.canonicalLosses).toBe(0);
    expect(comparison.reference.candidateId).toBe("luna-xhigh-baseline");
    expect(comparison.reference.qualityPercent).toBe(50);
    expect(comparison.reference.providerLatencyP50Ms).toBe(8_000);
    expect(comparison.reference.costPerCaseUsd).toBeCloseTo(0.001);
    expect(comparison.reference.repetitionCount).toBe(1);
    expect(comparison.candidate.candidateId).toBe("spark-high");
    expect(comparison.candidate.canonicalQualityPercent).toBe(100);
    expect(comparison.candidate.repeatedQualityPercent).toBe(100);
    expect(comparison.candidate.providerLatencyP50Ms).toBe(2_000);
    expect(comparison.candidate.costPerCaseUsd).toBeCloseTo(0.0001);
    expect(comparison.candidate.repetitionCount).toBe(3);
  });

  it("requires the frozen Luna identity and a complete three-repeat Spark checkpoint", () => {
    const luna = artifact("luna", [true, true, true, true]);
    const spark = artifact("spark", [true, true, true, true]);
    if (spark.runStatus === undefined) {
      throw new Error("Missing Spark status fixture");
    }
    spark.runStatus.status = "cost-limit";
    expect(() =>
      compareAIPlayerToFrozenLuna(luna, spark, "spark-high"),
    ).toThrow("Spark checkpoint must be complete");

    const wrongReference = artifact("spark", [true, true, true, true]);
    expect(() =>
      compareAIPlayerToFrozenLuna(
        wrongReference,
        artifact("spark", [true, true, true, true]),
        "spark-high",
      ),
    ).toThrow("Reference must be the frozen Luna baseline");
  });

  it("refuses v3 baseline evidence whose cases are not tied to manifest configurations", () => {
    const luna = artifact("luna", [true, true, true, true]);
    const spark = artifact("spark", [true, true, true, true]);
    luna.manifest.harnessVersion = "ai-player-eval-harness-v3";
    spark.manifest.harnessVersion = "ai-player-eval-harness-v3";

    expect(() =>
      compareAIPlayerToFrozenLuna(luna, spark, "spark-high"),
    ).toThrow("Resolved model configuration is missing for spark-high");
  });

  it("refuses mismatched canonical state or rubric evidence", () => {
    const luna = artifact("luna", [true, true, true, true]);
    const spark = artifact("spark", [true, true, true, true]);
    const changed = spark.cases.find(
      (entry) => entry.scenario.id === "dev-a" && entry.repetition === 1,
    );
    if (changed === undefined) throw new Error("Missing canonical fixture");
    changed.inputState = "different state";

    expect(() =>
      compareAIPlayerToFrozenLuna(luna, spark, "spark-high"),
    ).toThrow("Canonical evidence differs for dev-a");
  });

  it("labels the one-shot Luna uncertainty instead of issuing a promotion verdict", () => {
    const comparison = compareAIPlayerToFrozenLuna(
      artifact("luna", [true, false, true, false]),
      artifact("spark", [true, true, true, true]),
      "spark-high",
    );
    const markdown = formatAIPlayerFrozenBaselineComparisonMarkdown(comparison);

    expect(markdown).toContain("descriptive baseline, not a promotion gate");
    expect(markdown).toContain(
      "Luna has one provider observation per position",
    );
    expect(markdown).toContain("Gameplay quality");
    expect(markdown).toContain("Provider p95 ms");
    expect(markdown).toContain("Cost/case USD");
  });
});
