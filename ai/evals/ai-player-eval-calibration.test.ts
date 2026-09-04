import { describe, expect, it } from "bun:test";
import { LUNA_BASELINE_CANDIDATE_ID } from "./ai-player-eval-candidates";
import {
  createAIPlayerFixedStateCalibrationReport,
  parseAIPlayerFixedStateCalibrationArguments,
} from "./ai-player-eval-calibration";
import type { AIPlayerEvalCaseResult } from "./ai-player-eval-score";
import type { AIPlayerEvalRunArtifact } from "./ai-player-eval-run-comparison";
import {
  AI_PLAYER_FIXED_STATE_SCENARIOS,
  AI_PLAYER_FIXED_STATE_SUITE_VERSION,
} from "./ai-player-fixed-state-scenarios";
import { AI_PLAYER_EVAL_HARNESS_VERSION } from "./ai-player-fixed-state-runner";

function frozenLunaArtifact(failedScenarioCount = 4): AIPlayerEvalRunArtifact {
  const cases: AIPlayerEvalCaseResult[] = AI_PLAYER_FIXED_STATE_SCENARIOS.map(
    (scenario, index) => {
      const failed = index < failedScenarioCount;
      return {
        schemaVersion: 1,
        runId: "luna-certified",
        candidate: {
          id: LUNA_BASELINE_CANDIDATE_ID,
          modelId: "default:openai",
          provider: "openai",
          reasoningEffort: "xhigh",
          promptVersion: "house-rules-v3",
        },
        scenario: scenario.identity,
        repetition: 1,
        completed: true,
        legal: !failed,
        criteria: scenario.rubric.map((criterion) => ({
          ...criterion,
          passed: !failed,
          evidence: failed ? "synthetic miss" : "synthetic pass",
        })),
        failureMode: failed ? "illegal-action" : "none",
        retries: 0,
        timing: {
          turnDurationMs: 6_000,
          providerDurationMs: 5_000,
          toolExecutionDurationMs: 100,
          orchestrationDurationMs: 900,
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
        providerReportedCostUsd: undefined,
        reconstructedCostUsd: 0.001,
        inputState: scenario.identity.id,
        outcome: {
          phase: "ROUND_ACTIVE",
          turnPhase: "AWAITING_DRAW",
          awaitingPlayerId: "eval-player-1",
          evaluatedPlayerHandCardIds: [],
          tableMeldCount: 0,
          topDiscardCardId: null,
          lastError: failed ? "synthetic rejection" : null,
        },
        actions: [],
        warnings: [],
      };
    },
  );

  return {
    manifest: {
      schemaVersion: 1,
      runId: "luna-certified",
      harnessVersion: AI_PLAYER_EVAL_HARNESS_VERSION,
      suiteVersion: AI_PLAYER_FIXED_STATE_SUITE_VERSION,
      split: "all",
      prompt: { version: "house-rules-v3", sha256: "prompt-sha" },
      candidates: [cases[0]!.candidate],
    },
    cases,
  };
}

describe("AI player fixed-state calibration report", () => {
  it("parses the frozen Luna input and output paths", () => {
    expect(parseAIPlayerFixedStateCalibrationArguments([])).toEqual({
      lunaDirectory: ".data/ai-evals/luna-frozen-baseline-certified-v4",
      outputDirectory: ".data/ai-evals/fixed-state-v2-calibration",
    });
    expect(
      parseAIPlayerFixedStateCalibrationArguments([
        "--luna-run",
        "luna-artifact",
        "--output",
        "calibration-artifact",
      ]),
    ).toEqual({
      lunaDirectory: "luna-artifact",
      outputDirectory: "calibration-artifact",
    });
  });

  it("proves a stable blind, greedy, frozen-model, and oracle skill ladder", async () => {
    const report = await createAIPlayerFixedStateCalibrationReport(
      frozenLunaArtifact(),
      3,
    );

    expect(report.schemaVersion).toBe(1);
    expect(report.suiteVersion).toBe(AI_PLAYER_FIXED_STATE_SUITE_VERSION);
    expect(report.strictOrderingPassed).toBe(true);
    expect(report.rungs.map((rung) => [rung.id, rung.qualityPercent])).toEqual([
      ["blind-legal-v2", 31],
      ["rule-aware-greedy-v1", 62],
      [LUNA_BASELINE_CANDIDATE_ID, 80],
      ["reference-oracle", 100],
    ]);
    expect(report.qualityGapsPercentPoints).toEqual([31, 18, 20]);
    expect(report.rungs[2]?.providerLatencyP50Ms).toBe(5_000);
    expect(report.rungs[2]?.observedCostUsd).toBeCloseTo(0.02, 12);
  });

  it("rejects stale or non-discriminating Luna evidence", async () => {
    const stale = frozenLunaArtifact();
    stale.manifest.suiteVersion = "fixed-state-v1";
    await expect(
      createAIPlayerFixedStateCalibrationReport(stale, 3),
    ).rejects.toThrow("current fixed-state suite");

    await expect(
      createAIPlayerFixedStateCalibrationReport(frozenLunaArtifact(8), 3),
    ).rejects.toThrow("strictly ordered");
  });
});
