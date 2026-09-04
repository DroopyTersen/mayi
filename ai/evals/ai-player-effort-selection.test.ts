import { describe, expect, it } from "bun:test";
import type { AIPlayerEvalCaseResult } from "./ai-player-eval-score";
import type { AIPlayerEvalRunArtifact } from "./ai-player-eval-run-comparison";
import {
  DEFAULT_SPARK_NONINFERIORITY_MARGIN_PERCENT_POINTS,
  formatAIPlayerEffortSelectionMarkdown,
  parseAIPlayerEffortSelectionArguments,
  selectAIPlayerSparkEffort,
} from "./ai-player-effort-selection";

type SparkFixtureCandidate =
  | "spark-minimal"
  | "spark-medium"
  | "spark-high";

function fixtureResult(options: {
  candidateId: SparkFixtureCandidate;
  scenarioId: string;
  category?: string;
  repetition: number;
  passed: boolean;
  completed?: boolean;
  legal?: boolean;
  costUsd: number;
  providerDurationMs: number;
}): AIPlayerEvalCaseResult {
  const effort = options.candidateId.replace("spark-", "");
  return {
    schemaVersion: 1,
    runId: "spark-effort-sweep",
    candidate: {
      id: options.candidateId,
      modelId: "default:meta",
      provider: "openrouter",
      reasoningEffort: effort,
      promptVersion: "house-rules-v3",
    },
    scenario: {
      id: options.scenarioId,
      split: "development",
      category: options.category ?? "strategy",
      description: options.scenarioId,
    },
    repetition: options.repetition,
    completed: options.completed ?? true,
    legal: options.legal ?? true,
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
    inputState: `same state ${options.scenarioId}:${options.repetition}`,
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

function fixtureArtifact(options: {
  candidateIds: SparkFixtureCandidate[];
  passed?: Partial<Record<SparkFixtureCandidate, readonly boolean[]>>;
  incompleteCandidateId?: SparkFixtureCandidate;
  repetitions?: number;
  scenarioIds?: readonly string[];
  categoryByScenario?: Readonly<Record<string, string>>;
}): AIPlayerEvalRunArtifact {
  const repetitions = options.repetitions ?? 3;
  const scenarioIds = options.scenarioIds ?? ["case-a", "case-b", "case-c"];
  const cases = options.candidateIds.flatMap((candidateId) =>
    scenarioIds.flatMap((scenarioId, scenarioIndex) =>
      Array.from({ length: repetitions }, (_, repetitionIndex) => {
        const resultIndex = scenarioIndex * repetitions + repetitionIndex;
        const passed = options.passed?.[candidateId]?.[resultIndex] ?? true;
        return fixtureResult({
          candidateId,
          scenarioId,
          category: options.categoryByScenario?.[scenarioId],
          repetition: repetitionIndex + 1,
          passed,
          completed:
            options.incompleteCandidateId === candidateId && resultIndex === 0
              ? false
              : true,
          costUsd:
            candidateId === "spark-minimal"
              ? 0.001
              : candidateId === "spark-medium"
                ? 0.002
                : 0.003,
          providerDurationMs:
            candidateId === "spark-minimal"
              ? 1_000
              : candidateId === "spark-medium"
                ? 2_000
                : 3_000,
        });
      }),
    ),
  );
  return {
    manifest: {
      schemaVersion: 1,
      runId: "spark-effort-sweep",
      harnessVersion: "ai-player-eval-harness-v2",
      executionScheduleVersion: "rotating-interleaved-v1",
      suiteVersion: "fixed-state-v1",
      split: "development",
      prompt: { version: "house-rules-v3", sha256: "same-prompt" },
      candidates: options.candidateIds.map((candidateId) => ({
        id: candidateId,
        modelId: "default:meta",
        provider: "openrouter",
        reasoningEffort: candidateId.replace("spark-", ""),
        promptVersion: "house-rules-v3",
      })),
    },
    cases,
    runStatus: {
      policyVersion: "matched-unit-observed-cost-v1",
      status: "completed",
      maxCostUsd: 0.25,
      observedCostUsd: cases.reduce(
        (total, result) => total + (result.providerReportedCostUsd ?? 0),
        0,
      ),
      overshootUsd: 0,
      unknownCostResultCount: 0,
      plannedUnitCount: scenarioIds.length * repetitions,
      completedUnitCount: scenarioIds.length * repetitions,
      plannedResultCount: cases.length,
      executedResultCount: cases.length,
    },
  };
}

describe("Spark reasoning-effort selection", () => {
  it("parses a completed sweep and optional strict margin", () => {
    expect(
      parseAIPlayerEffortSelectionArguments([
        "--run",
        ".data/ai-evals/spark-effort-sweep",
        "--noninferiority-margin-pp",
        "1.5",
      ]),
    ).toEqual({
      runDirectory: ".data/ai-evals/spark-effort-sweep",
      noninferiorityMarginPercentPoints: 1.5,
    });
    expect(() => parseAIPlayerEffortSelectionArguments([])).toThrow(
      "--run is required",
    );
    expect(() =>
      parseAIPlayerEffortSelectionArguments([
        "--run",
        "sweep",
        "--noninferiority-margin-pp",
        "-1",
      ]),
    ).toThrow("Non-inferiority margin must be a nonnegative finite number");
  });

  it("chooses the cheaper effort when skill and reliability are matched", () => {
    const selection = selectAIPlayerSparkEffort(
      fixtureArtifact({
        candidateIds: ["spark-minimal", "spark-high"],
      }),
    );

    expect(DEFAULT_SPARK_NONINFERIORITY_MARGIN_PERCENT_POINTS).toBe(2.5);
    expect(selection.qualityConfidenceUnit).toBe("scenario-mean");
    expect(selection.scenarioCount).toBe(3);
    expect(selection.strongestCandidateId).toBe("spark-high");
    expect(selection.selectedCandidateId).toBe("spark-minimal");
    const minimal = selection.candidates[0];
    const high = selection.candidates[1];
    expect(minimal?.candidateId).toBe("spark-minimal");
    expect(minimal?.eligible).toBe(true);
    expect(minimal?.qualityDeltaVsStrongestPercentPoints).toBe(0);
    expect(minimal?.costPerCaseUsd).toBeCloseTo(0.001);
    expect(high?.candidateId).toBe("spark-high");
    expect(high?.eligible).toBe(true);
    expect(high?.costPerCaseUsd).toBeCloseTo(0.003);
  });

  it("refuses a v3 effort sweep without the current resolved configurations", () => {
    const artifact = fixtureArtifact({
      candidateIds: ["spark-minimal", "spark-high"],
    });
    artifact.manifest.harnessVersion = "ai-player-eval-harness-v3";

    expect(() => selectAIPlayerSparkEffort(artifact)).toThrow(
      "Resolved model configuration is invalid for spark-minimal",
    );
  });

  it("keeps the strongest effort when the cheap arm is materially weaker", () => {
    const selection = selectAIPlayerSparkEffort(
      fixtureArtifact({
        candidateIds: ["spark-minimal", "spark-high"],
        passed: {
          "spark-minimal": [true, true, true, true, true, false],
        },
      }),
    );

    expect(selection.selectedCandidateId).toBe("spark-high");
    expect(selection.candidates[0]).toMatchObject({
      candidateId: "spark-minimal",
      eligible: false,
    });
    expect(selection.candidates[0]?.eligibilityReasons).toContain(
      "Scenario-clustered quality is not within the 2.5 percentage-point non-inferiority margin",
    );
  });

  it("does not trade away a strategic category hidden by the overall average", () => {
    const scenarioIds = Array.from(
      { length: 10 },
      (_, index) => `case-${index + 1}`,
    );
    const repeatedPasses = (failedScenarioIndex: number) =>
      scenarioIds.flatMap((_, scenarioIndex) =>
        Array.from({ length: 3 }, () => scenarioIndex !== failedScenarioIndex),
      );
    const selection = selectAIPlayerSparkEffort(
      fixtureArtifact({
        candidateIds: ["spark-minimal", "spark-high"],
        scenarioIds,
        categoryByScenario: {
          "case-1": "contract",
          "case-2": "draw-discard",
        },
        passed: {
          "spark-minimal": repeatedPasses(0),
          "spark-high": repeatedPasses(1),
        },
      }),
      50,
    );

    const minimal = selection.candidates[0];
    expect(selection.strongestCandidateId).toBe("spark-high");
    expect(minimal?.qualityDeltaConfidence95.lower).toBeGreaterThan(-50);
    expect(minimal?.categoryDeltasVsStrongest).toEqual([
      {
        category: "contract",
        scenarioCount: 1,
        qualityDeltaPercentPoints: -100,
      },
      {
        category: "draw-discard",
        scenarioCount: 1,
        qualityDeltaPercentPoints: 100,
      },
      {
        category: "strategy",
        scenarioCount: 8,
        qualityDeltaPercentPoints: 0,
      },
    ]);
    expect(minimal?.eligible).toBe(false);
    expect(minimal?.eligibilityReasons).toContain(
      "Category contract is 100.0 percentage points below the strongest effort, exceeding the 50 percentage-point non-inferiority margin",
    );
    expect(selection.selectedCandidateId).toBe("spark-high");

    const markdown = formatAIPlayerEffortSelectionMarkdown(selection);
    expect(markdown).toContain("## spark-minimal category deltas");
    expect(markdown).toContain("contract | 1 | -100.0");
    expect(markdown).toContain("every strategic-category mean");
  });

  it("never trades away completion reliability for lower cost", () => {
    const selection = selectAIPlayerSparkEffort(
      fixtureArtifact({
        candidateIds: ["spark-minimal", "spark-medium"],
        incompleteCandidateId: "spark-minimal",
      }),
    );

    expect(selection.selectedCandidateId).toBe("spark-medium");
    expect(selection.candidates[0]?.eligibilityReasons).toContain(
      "Completion or legality regressed versus the strongest effort",
    );
  });

  it("requires a complete, repeated, matched development sweep", () => {
    const underRepeated = fixtureArtifact({
      candidateIds: ["spark-minimal", "spark-high"],
      repetitions: 2,
    });
    expect(() => selectAIPlayerSparkEffort(underRepeated)).toThrow(
      "at least 3 repetitions per scenario",
    );

    const costStopped = fixtureArtifact({
      candidateIds: ["spark-minimal", "spark-high"],
    });
    if (costStopped.runStatus === undefined) {
      throw new Error("Missing run-status fixture");
    }
    costStopped.runStatus.status = "cost-limit";
    expect(() => selectAIPlayerSparkEffort(costStopped)).toThrow(
      "must be completed before effort selection",
    );
  });

  it("rejects a sweep that over-repeats some scenarios and under-repeats others", () => {
    const artifact = fixtureArtifact({
      candidateIds: ["spark-minimal", "spark-high"],
      repetitions: 4,
    });
    for (const candidateId of ["spark-minimal", "spark-high"] as const) {
      const shifted = artifact.cases.find(
        (result) =>
          result.candidate.id === candidateId &&
          result.scenario.id === "case-c" &&
          result.repetition === 4,
      );
      if (shifted === undefined) throw new Error("Missing shifted fixture case");
      shifted.scenario = {
        ...shifted.scenario,
        id: "case-a",
      };
      shifted.repetition = 5;
    }

    expect(() => selectAIPlayerSparkEffort(artifact)).toThrow(
      "same repetition set for every scenario",
    );
  });

  it("reports skill, latency, and cost separately", () => {
    const markdown = formatAIPlayerEffortSelectionMarkdown(
      selectAIPlayerSparkEffort(
        fixtureArtifact({
          candidateIds: ["spark-minimal", "spark-high"],
        }),
      ),
    );

    expect(markdown).toContain("Selected effort: `spark-minimal`");
    expect(markdown).toContain("Quality");
    expect(markdown).toContain("Scenario-mean confidence units: 3");
    expect(markdown).toContain("Scenario-mean delta 95% CI");
    expect(markdown).toContain("Provider p95 ms");
    expect(markdown).toContain("Cost/case USD");
  });
});
