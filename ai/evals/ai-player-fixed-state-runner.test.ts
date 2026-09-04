import { describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AI_PLAYER_EVAL_HARNESS_VERSION,
  createAIPlayerEvalRunDirectory,
  createAIPlayerEvalPromptSnapshot,
  formatAIPlayerEvalSummaryMarkdown,
  parseAIPlayerFixedStateRunnerArguments,
  summarizeAIPlayerEvalRun,
} from "./ai-player-fixed-state-runner";
import type { AIPlayerEvalCaseResult } from "./ai-player-eval-score";

function caseResult(
  candidateId: "spark-minimal" | "spark-high",
  qualityPassed: boolean,
  scenario: {
    id: string;
    split: "development" | "holdout";
    category: string;
  } = {
    id: "draw-stock-safe-discard",
    split: "development",
    category: "draw-discard",
  },
): AIPlayerEvalCaseResult {
  const effort = candidateId === "spark-minimal" ? "minimal" : "high";
  return {
    schemaVersion: 1,
    runId: "eval-run",
    candidate: {
      id: candidateId,
      modelId: "default:meta",
      provider: "openrouter",
      reasoningEffort: effort,
      promptVersion: "house-rules-v3",
    },
    scenario: {
      ...scenario,
      description: "Shed the highest-point liability.",
    },
    repetition: 1,
    completed: true,
    legal: true,
    criteria: [
      {
        id: "discard-liability",
        description: "Discard the highest-point liability.",
        weight: 100,
        passed: qualityPassed,
        evidence: qualityPassed ? "discarded stock-a" : "discarded p0-q",
      },
    ],
    failureMode: qualityPassed ? "none" : "strategy",
    retries: 0,
    timing: {
      turnDurationMs: candidateId === "spark-minimal" ? 2_000 : 4_000,
      providerDurationMs: candidateId === "spark-minimal" ? 1_800 : 3_800,
      toolExecutionDurationMs: 50,
      orchestrationDurationMs: 150,
      pacingDelayMs: 0,
    },
    usage: {
      inputTokens: 1_000,
      noCacheInputTokens: 1_000,
      cacheReadInputTokens: 0,
      cacheWriteInputTokens: 0,
      outputTokens: 100,
      reasoningOutputTokens: 80,
      totalTokens: 1_100,
    },
    providerReportedCostUsd: candidateId === "spark-minimal" ? 0.001 : 0.002,
    reconstructedCostUsd: 0.00012,
    inputState: "Rendered state shown to the evaluated player.",
    outcome: {
      phase: "ROUND_ACTIVE",
      turnPhase: "AWAITING_DRAW",
      awaitingPlayerId: "eval-player-1",
      evaluatedPlayerHandCardIds: ["p0-3"],
      tableMeldCount: 0,
      topDiscardCardId: "stock-a",
      lastError: null,
    },
    actions: ["draw_from_stock({})", "discard({cardId:stock-a})"],
    warnings: [],
  };
}

describe("AI player fixed-state runner", () => {
  it("versions the command-policy-aware evaluation harness", () => {
    expect(AI_PLAYER_EVAL_HARNESS_VERSION).toBe("ai-player-eval-harness-v3");
  });

  it("defaults to the cheapest Spark development candidate", () => {
    expect(parseAIPlayerFixedStateRunnerArguments([])).toEqual({
      candidateIds: ["spark-minimal"],
      repetitions: 1,
      split: "development",
      runId: undefined,
      scenarioIds: undefined,
      promptExperiment: undefined,
      maxCostUsd: 0.25,
    });
  });

  it("expands the Spark hill-climb ladder without adding Luna", () => {
    expect(
      parseAIPlayerFixedStateRunnerArguments([
        "--all-spark",
        "--repetitions",
        "3",
        "--split",
        "all",
        "--run-id",
        "pilot-1",
      ]),
    ).toEqual({
      candidateIds: [
        "spark-minimal",
        "spark-low",
        "spark-medium",
        "spark-high",
        "spark-xhigh",
      ],
      repetitions: 3,
      split: "all",
      runId: "pilot-1",
      scenarioIds: undefined,
      promptExperiment: undefined,
      maxCostUsd: 0.25,
    });
  });

  it("supports a named scenario subset for cheap smoke tests and repairs", () => {
    expect(
      parseAIPlayerFixedStateRunnerArguments([
        "--scenario",
        "ace-high-run-contract,wild-ratio-valid-contract",
      ]).scenarioIds,
    ).toEqual(["ace-high-run-contract", "wild-ratio-valid-contract"]);
  });

  it("allows the frozen Luna baseline only when explicitly selected", () => {
    expect(
      parseAIPlayerFixedStateRunnerArguments([
        "--candidate",
        "luna-xhigh-baseline",
      ]).candidateIds,
    ).toEqual(["luna-xhigh-baseline"]);
  });

  it("accepts isolated Spark prompt experiments and never applies them to Luna", () => {
    expect(
      parseAIPlayerFixedStateRunnerArguments([
        "--candidate",
        "spark-medium",
        "--prompt-experiment",
        "phase-checklist-v1",
        "--prompt-addendum-file",
        "ai/evals/prompts/phase-checklist-v1.md",
      ]).promptExperiment,
    ).toEqual({
      id: "phase-checklist-v1",
      addendumFile: "ai/evals/prompts/phase-checklist-v1.md",
    });
    expect(() =>
      parseAIPlayerFixedStateRunnerArguments([
        "--candidate",
        "luna-xhigh-baseline",
        "--prompt-experiment",
        "phase-checklist-v1",
        "--prompt-addendum-file",
        "ai/evals/prompts/phase-checklist-v1.md",
      ]),
    ).toThrow("Prompt experiments are Spark-only");
  });

  it("rejects unknown candidates and invalid repetition counts", () => {
    expect(() =>
      parseAIPlayerFixedStateRunnerArguments(["--candidate", "mystery-model"]),
    ).toThrow("Unknown AI player evaluation candidate: mystery-model");
    expect(() =>
      parseAIPlayerFixedStateRunnerArguments(["--repetitions", "0"]),
    ).toThrow("Repetitions must be a positive integer");
    expect(() =>
      parseAIPlayerFixedStateRunnerArguments(["--scenario", "missing-case"]),
    ).toThrow("Unknown AI player evaluation scenario: missing-case");
    expect(() =>
      parseAIPlayerFixedStateRunnerArguments(["--max-cost-usd", "0"]),
    ).toThrow("Maximum cost must be a positive finite number");
  });

  it("accepts an explicit observed-cost stop threshold", () => {
    expect(
      parseAIPlayerFixedStateRunnerArguments([
        "--max-cost-usd",
        "0.05",
      ]).maxCostUsd,
    ).toBe(0.05);
  });

  it("refuses to mix a new experiment into an existing run directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "mayi-ai-eval-"));
    try {
      expect(await createAIPlayerEvalRunDirectory(root, "experiment-1")).toBe(
        join(root, "experiment-1"),
      );
      await expect(
        createAIPlayerEvalRunDirectory(root, "experiment-1"),
      ).rejects.toThrow("AI evaluation run already exists: experiment-1");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("fingerprints and preserves the exact system prompt used by a run", () => {
    const first = createAIPlayerEvalPromptSnapshot("prompt-v1", "exact prompt");
    const second = createAIPlayerEvalPromptSnapshot(
      "prompt-v1",
      "exact prompt with one change",
    );

    expect(first).toMatchObject({
      version: "prompt-v1",
      content: "exact prompt",
    });
    expect(first.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(second.sha256).not.toBe(first.sha256);
  });

  it("summarizes each candidate without combining skill, time, and cost", () => {
    const summary = summarizeAIPlayerEvalRun("eval-run", [
      caseResult("spark-minimal", true),
      caseResult("spark-high", false),
    ]);

    expect(summary.candidates).toHaveLength(2);
    expect(summary.comparisons).toEqual([
      {
        referenceCandidateId: "spark-minimal",
        candidateId: "spark-high",
        matchedCaseCount: 1,
        qualityDeltaPercentPoints: -100,
        providerLatencyDeltaMs: 2_000,
        costDeltaUsd: 0.001,
        wins: 0,
        ties: 0,
        losses: 1,
      },
    ]);
    expect(summary.candidates[0]).toMatchObject({
      candidateId: "spark-minimal",
      qualityPercent: 100,
      completionRate: 1,
      totalCostUsd: 0.001,
      scenarios: [
        {
          scenarioId: "draw-stock-safe-discard",
          split: "development",
          caseCount: 1,
          qualityPercent: 100,
          completionRate: 1,
          legalRate: 1,
        },
      ],
    });
    expect(summary.candidates[1]).toMatchObject({
      candidateId: "spark-high",
      qualityPercent: 0,
      providerLatencyMs: { p50: 3_800, p95: 3_800 },
      totalCostUsd: 0.002,
    });

    const markdown = formatAIPlayerEvalSummaryMarkdown(summary);
    expect(markdown).toContain("# AI Player Fixed-State Evaluation");
    expect(markdown).toContain("spark-minimal");
    expect(markdown).toContain("100.0%");
    expect(markdown).toContain("$0.001000");
    expect(markdown).toContain("## spark-high scenario results");
    expect(markdown).toContain("draw-stock-safe-discard | development | 0.0%");
    expect(markdown).toContain("## Matched candidate deltas");
    expect(markdown).toContain("spark-high | spark-minimal | 1 | -100.0");
  });

  it("exposes a failed strategic category that an aggregate score can hide", () => {
    const summary = summarizeAIPlayerEvalRun("category-slices", [
      caseResult("spark-minimal", true, {
        id: "safe-discard-a",
        split: "development",
        category: "draw-discard",
      }),
      caseResult("spark-minimal", true, {
        id: "safe-discard-b",
        split: "development",
        category: "draw-discard",
      }),
      caseResult("spark-minimal", false, {
        id: "contract-a",
        split: "development",
        category: "contract",
      }),
      caseResult("spark-minimal", true, {
        id: "contract-holdout",
        split: "holdout",
        category: "contract",
      }),
    ]);

    const candidate = summary.candidates[0];
    expect(candidate?.qualityPercent).toBe(75);
    expect(candidate?.categories).toEqual([
      {
        category: "draw-discard",
        split: "development",
        scenarioCount: 2,
        caseCount: 2,
        qualityPercent: 100,
        completionRate: 1,
        legalRate: 1,
      },
      {
        category: "contract",
        split: "development",
        scenarioCount: 1,
        caseCount: 1,
        qualityPercent: 0,
        completionRate: 1,
        legalRate: 1,
      },
      {
        category: "contract",
        split: "holdout",
        scenarioCount: 1,
        caseCount: 1,
        qualityPercent: 100,
        completionRate: 1,
        legalRate: 1,
      },
    ]);

    const markdown = formatAIPlayerEvalSummaryMarkdown(summary);
    expect(markdown).toContain("## spark-minimal category results");
    expect(markdown).toContain(
      "contract | development | 1 | 1 | 0.0% | 100.0% | 100.0%",
    );
  });

  it("uses distinct scenarios rather than repetitions as quality confidence units", () => {
    const summary = summarizeAIPlayerEvalRun("clustered-confidence", [
      ...Array.from({ length: 10 }, () =>
        caseResult("spark-minimal", true, {
          id: "scenario-a",
          split: "development",
          category: "draw-discard",
        }),
      ),
      ...Array.from({ length: 10 }, () =>
        caseResult("spark-minimal", false, {
          id: "scenario-b",
          split: "development",
          category: "contract",
        }),
      ),
    ]);

    const candidate = summary.candidates[0];
    expect(summary.schemaVersion).toBe(2);
    expect(candidate?.qualityPercent).toBe(50);
    expect(candidate?.qualityConfidenceUnit).toBe("scenario-mean");
    expect(candidate?.qualityConfidenceScenarioCount).toBe(2);
    expect(candidate?.qualityConfidence95).toEqual({ lower: 0, upper: 100 });

    const markdown = formatAIPlayerEvalSummaryMarkdown(summary);
    expect(markdown).toContain("Scenario-mean quality 95% CI");
    expect(markdown).toContain("Confidence scenarios");
  });
});
