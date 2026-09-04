import { describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AIPlayerEvalCaseResult } from "./ai-player-eval-score";
import { AI_PLAYER_EVAL_CANDIDATES } from "./ai-player-eval-candidates";
import { fingerprintAIPlayerEvalModelConfiguration } from "./ai-player-model-configuration";
import {
  compareAIPlayerEvalRuns,
  formatAIPlayerEvalRunComparisonMarkdown,
  loadAIPlayerEvalRunArtifact,
  parseAIPlayerEvalRunComparisonArguments,
  type AIPlayerEvalRunArtifact,
} from "./ai-player-eval-run-comparison";

function result(options: {
  runId: string;
  scenarioId: string;
  split?: "development" | "holdout";
  repetition?: number;
  qualityPercent: 0 | 50 | 100;
  completed?: boolean;
  legal?: boolean;
  providerDurationMs?: number;
  costUsd?: number;
  failureMode?: AIPlayerEvalCaseResult["failureMode"];
}): AIPlayerEvalCaseResult {
  const completed = options.completed ?? true;
  const legal = options.legal ?? true;
  return {
    schemaVersion: 1,
    runId: options.runId,
    candidate: {
      id: "spark-medium",
      modelId: "default:meta",
      provider: "openrouter",
      reasoningEffort: "medium",
      promptVersion: options.runId === "reference" ? "prompt-v1" : "prompt-v2",
    },
    scenario: {
      id: options.scenarioId,
      split: options.split ?? "development",
      category: "strategy",
      description: options.scenarioId,
    },
    repetition: options.repetition ?? 1,
    completed,
    legal,
    criteria: [
      {
        id: "primary",
        description: "Primary tactical objective",
        weight: 50,
        passed: options.qualityPercent >= 50,
        evidence: "fixture",
      },
      {
        id: "secondary",
        description: "Secondary tactical objective",
        weight: 50,
        passed: options.qualityPercent === 100,
        evidence: "fixture",
      },
    ],
    failureMode:
      options.failureMode ??
      (!completed ? "turn-incomplete" : !legal ? "illegal-action" : "none"),
    retries: 0,
    timing: {
      turnDurationMs: options.providerDurationMs,
      providerDurationMs: options.providerDurationMs,
      toolExecutionDurationMs: 0,
      orchestrationDurationMs: 0,
      pacingDelayMs: 0,
    },
    usage: {
      inputTokens: undefined,
      noCacheInputTokens: undefined,
      cacheReadInputTokens: undefined,
      cacheWriteInputTokens: undefined,
      outputTokens: undefined,
      reasoningOutputTokens: undefined,
      totalTokens: undefined,
    },
    providerReportedCostUsd: options.costUsd,
    reconstructedCostUsd: undefined,
    inputState: `fixed state for ${options.scenarioId} repetition ${options.repetition ?? 1}`,
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
  runId: string,
  cases: AIPlayerEvalCaseResult[],
  options: { harnessVersion?: string; suiteVersion?: string } = {},
): AIPlayerEvalRunArtifact {
  return {
    manifest: {
      schemaVersion: 1,
      runId,
      harnessVersion:
        options.harnessVersion ?? "ai-player-eval-harness-v2",
      executionScheduleVersion: "rotating-interleaved-v1",
      suiteVersion: options.suiteVersion ?? "fixed-state-v1",
      split: "development",
      prompt: {
        version: runId === "reference" ? "prompt-v1" : "prompt-v2",
        sha256: runId === "reference" ? "reference-sha" : "candidate-sha",
      },
      candidates: [
        {
          id: "spark-medium",
          modelId: "default:meta",
          provider: "openrouter",
          reasoningEffort: "medium",
          promptVersion: runId === "reference" ? "prompt-v1" : "prompt-v2",
        },
      ],
    },
    cases,
  };
}

describe("AI player evaluation run comparison", () => {
  it("parses two immutable runs and optional candidate arms", () => {
    expect(
      parseAIPlayerEvalRunComparisonArguments([
        "--reference",
        ".data/ai-evals/reference",
        "--reference-candidate",
        "spark-medium",
        "--candidate",
        ".data/ai-evals/candidate",
        "--candidate-id",
        "spark-high",
      ]),
    ).toEqual({
      referenceDirectory: ".data/ai-evals/reference",
      referenceCandidateId: "spark-medium",
      candidateDirectory: ".data/ai-evals/candidate",
      candidateCandidateId: "spark-high",
    });
    expect(() =>
      parseAIPlayerEvalRunComparisonArguments([
        "--reference",
        ".data/ai-evals/reference",
      ]),
    ).toThrow("--reference and --candidate are required");
  });

  it("promotes a matched Spark prompt that improves skill without regressions", () => {
    const scenarioIds = [
      "discard-liability",
      "take-contract-card",
      "layoff-all",
    ];
    const reference = artifact(
      "reference",
      scenarioIds.flatMap((scenarioId) =>
        [1, 2, 3].map((repetition) =>
          result({
            runId: "reference",
            scenarioId,
            repetition,
            qualityPercent: 50,
            providerDurationMs: 8_000,
            costUsd: 0.001,
            failureMode: "strategy",
          }),
        ),
      ),
    );
    const candidate = artifact(
      "candidate",
      scenarioIds.flatMap((scenarioId) =>
        [1, 2, 3].map((repetition) =>
          result({
            runId: "candidate",
            scenarioId,
            repetition,
            qualityPercent: 100,
            providerDurationMs: 10_000,
            costUsd: 0.0015,
          }),
        ),
      ),
    );

    const comparison = compareAIPlayerEvalRuns(reference, candidate);

    expect(comparison).toMatchObject({
      schemaVersion: 4,
      comparisonKind: "prompt-experiment",
      verdict: "promote",
      qualityConfidenceUnit: "scenario-mean",
      matchedCaseCount: 9,
      scenarioCount: 3,
      minimumRepetitionsPerScenario: 3,
      maximumRepetitionsPerScenario: 3,
      qualityDeltaPercentPoints: 50,
      qualityDeltaConfidence95: { lower: 50, upper: 50 },
      completionRateDeltaPercentPoints: 0,
      legalRateDeltaPercentPoints: 0,
      providerLatencyDeltaMs: 2_000,
      costPerCaseDeltaUsd: 0.0005,
      wins: 9,
      ties: 0,
      losses: 0,
      improvedCaseKeys: scenarioIds
        .flatMap((scenarioId) =>
          [1, 2, 3].map((repetition) => `${scenarioId}:${repetition}`),
        )
        .sort(),
      regressedCaseKeys: [],
      hardGateRegressionCaseKeys: [],
      failureModeChanges: scenarioIds
        .flatMap((scenarioId) =>
          [1, 2, 3].map((repetition) => ({
            caseKey: `${scenarioId}:${repetition}`,
            reference: "strategy",
            candidate: "none",
          })),
        )
        .sort((left, right) => left.caseKey.localeCompare(right.caseKey)),
    });
    expect(comparison.splits).toEqual([
      expect.objectContaining({
        split: "development",
        qualityConfidenceUnit: "scenario-mean",
        matchedCaseCount: 9,
        scenarioCount: 3,
        minimumRepetitionsPerScenario: 3,
        qualityDeltaPercentPoints: 50,
        qualityDeltaConfidence95: { lower: 50, upper: 50 },
      }),
    ]);

    const markdown = formatAIPlayerEvalRunComparisonMarkdown(comparison);
    expect(markdown).toContain("Verdict: **PROMOTE**");
    expect(markdown).toContain("Quality delta | +50.0 pp");
    expect(markdown).toContain(
      "Scenario-clustered quality 95% CI | +50.0 to +50.0 pp",
    );
    expect(markdown).toContain("Provider latency delta | +2000 ms");
    expect(markdown).toContain("Cost per case delta | +$0.000500");
    expect(markdown).toContain("discard-liability:1");
  });

  it("does not promote an unchanged prompt and refuses model configuration drift", () => {
    const reference = artifact(
      "reference",
      [1, 2, 3].map((repetition) =>
        result({
          runId: "reference",
          scenarioId: "a",
          repetition,
          qualityPercent: 0,
        }),
      ),
    );
    const unchanged = artifact(
      "candidate",
      [1, 2, 3].map((repetition) =>
        result({
          runId: "candidate",
          scenarioId: "a",
          repetition,
          qualityPercent: 100,
        }),
      ),
    );
    unchanged.manifest.prompt = { ...reference.manifest.prompt };
    const unchangedManifestCandidate = unchanged.manifest.candidates[0];
    if (unchangedManifestCandidate === undefined) {
      throw new Error("Missing unchanged manifest candidate");
    }
    unchangedManifestCandidate.promptVersion = reference.manifest.prompt.version;
    for (const entry of unchanged.cases) {
      entry.candidate.promptVersion = reference.manifest.prompt.version;
    }

    const repeatability = compareAIPlayerEvalRuns(reference, unchanged);
    expect(repeatability).toMatchObject({
      schemaVersion: 4,
      comparisonKind: "repeatability-check",
      verdict: "review",
    });
    expect(repeatability.verdictReasons).toContain(
      "The prompt fingerprint did not change; this is repeatability evidence, not a promotable prompt experiment",
    );

    const changedConfiguration = structuredClone(unchanged);
    changedConfiguration.manifest.prompt = {
      version: "prompt-v2",
      sha256: "candidate-sha",
    };
    const changedManifestCandidate = changedConfiguration.manifest.candidates[0];
    if (changedManifestCandidate === undefined) {
      throw new Error("Missing changed manifest candidate");
    }
    changedManifestCandidate.promptVersion = "prompt-v2";
    changedManifestCandidate.reasoningEffort = "high";
    for (const entry of changedConfiguration.cases) {
      entry.candidate.promptVersion = "prompt-v2";
      entry.candidate.reasoningEffort = "high";
    }
    expect(() =>
      compareAIPlayerEvalRuns(reference, changedConfiguration),
    ).toThrow("Selected model configuration differs");
  });

  it("refuses resolved provider configuration drift hidden behind the same candidate ID", () => {
    const reference = artifact(
      "reference",
      [1, 2, 3].map((repetition) =>
        result({
          runId: "reference",
          scenarioId: "a",
          repetition,
          qualityPercent: 50,
        }),
      ),
      { harnessVersion: "ai-player-eval-harness-v3" },
    );
    const candidate = artifact(
      "candidate",
      [1, 2, 3].map((repetition) =>
        result({
          runId: "candidate",
          scenarioId: "a",
          repetition,
          qualityPercent: 100,
        }),
      ),
      { harnessVersion: "ai-player-eval-harness-v3" },
    );
    const current = AI_PLAYER_EVAL_CANDIDATES["spark-medium"];
    const referenceIdentity = reference.manifest.candidates[0];
    const candidateIdentity = candidate.manifest.candidates[0];
    if (referenceIdentity === undefined || candidateIdentity === undefined) {
      throw new Error("Missing comparison fixture identity");
    }
    referenceIdentity.modelConfiguration = structuredClone(
      current.modelConfiguration,
    );
    referenceIdentity.modelConfigurationSha256 =
      current.modelConfigurationSha256;
    for (const entry of reference.cases) {
      entry.candidate.modelConfigurationSha256 =
        current.modelConfigurationSha256;
    }

    const driftedConfiguration = structuredClone(current.modelConfiguration);
    driftedConfiguration.resolvedModelId =
      "meta/muse-spark-1.3-contributor-revision-2";
    const driftedSha256 = fingerprintAIPlayerEvalModelConfiguration(
      driftedConfiguration,
    );
    candidateIdentity.modelConfiguration = driftedConfiguration;
    candidateIdentity.modelConfigurationSha256 = driftedSha256;
    for (const entry of candidate.cases) {
      entry.candidate.modelConfigurationSha256 = driftedSha256;
    }

    expect(() => compareAIPlayerEvalRuns(reference, candidate)).toThrow(
      "Selected model configuration differs",
    );
  });

  it("requires repeated evidence and a positive paired confidence bound", () => {
    const oneShotReference = artifact("reference", [
      result({ runId: "reference", scenarioId: "a", qualityPercent: 0 }),
    ]);
    const oneShotCandidate = artifact("candidate", [
      result({ runId: "candidate", scenarioId: "a", qualityPercent: 100 }),
    ]);
    const oneShot = compareAIPlayerEvalRuns(
      oneShotReference,
      oneShotCandidate,
    );
    expect(oneShot).toMatchObject({
      verdict: "review",
      minimumRepetitionsPerScenario: 1,
      qualityDeltaConfidence95: { lower: 100, upper: 100 },
    });
    expect(oneShot.verdictReasons).toContain(
      "At least 3 matched repetitions per scenario are required for promotion",
    );

    const noisyReference = artifact(
      "reference",
      ["a", "b", "c"].flatMap((scenarioId) =>
        [1, 2, 3].map((repetition) =>
          result({
            runId: "reference",
            scenarioId,
            repetition,
            qualityPercent: 0,
          }),
        ),
      ),
    );
    const noisyCandidate = artifact(
      "candidate",
      ["a", "b", "c"].flatMap((scenarioId) =>
        [1, 2, 3].map((repetition) =>
          result({
            runId: "candidate",
            scenarioId,
            repetition,
            qualityPercent: scenarioId === "a" ? 100 : 0,
          }),
        ),
      ),
    );
    const noisy = compareAIPlayerEvalRuns(noisyReference, noisyCandidate);
    expect(noisy).toMatchObject({
      verdict: "review",
      minimumRepetitionsPerScenario: 3,
      qualityDeltaPercentPoints: 100 / 3,
      qualityDeltaConfidence95: { lower: -100, upper: 100 },
    });
    expect(noisy.verdictReasons).toContain(
      "The scenario-clustered 95% quality interval does not exclude zero",
    );
  });

  it("treats distinct scenarios, not repeated permutations, as confidence units", () => {
    const reference = artifact(
      "reference",
      ["a", "b", "c"].flatMap((scenarioId) =>
        [1, 2, 3].map((repetition) =>
          result({
            runId: "reference",
            scenarioId,
            repetition,
            qualityPercent: 0,
          }),
        ),
      ),
    );
    const candidate = artifact(
      "candidate",
      ["a", "b", "c"].flatMap((scenarioId) =>
        [1, 2, 3].map((repetition) =>
          result({
            runId: "candidate",
            scenarioId,
            repetition,
            qualityPercent: scenarioId === "c" ? 0 : 100,
          }),
        ),
      ),
    );

    const comparison = compareAIPlayerEvalRuns(reference, candidate);

    expect(comparison.schemaVersion).toBe(4);
    expect(comparison.qualityConfidenceUnit).toBe("scenario-mean");
    expect(comparison.scenarioCount).toBe(3);
    expect(comparison.qualityDeltaPercentPoints).toBeCloseTo(100 * 2 / 3);
    expect(comparison.qualityDeltaConfidence95.lower).toBeCloseTo(
      -76.7666666667,
    );
    expect(comparison.qualityDeltaConfidence95.upper).toBe(100);
    expect(comparison.verdict).toBe("review");
    expect(comparison.verdictReasons).toContain(
      "The scenario-clustered 95% quality interval does not exclude zero",
    );
  });

  it("rejects a prompt with a new completion or legality failure", () => {
    const reference = artifact("reference", [
      result({
        runId: "reference",
        scenarioId: "safe-discard",
        qualityPercent: 100,
      }),
    ]);
    const candidate = artifact("candidate", [
      result({
        runId: "candidate",
        scenarioId: "safe-discard",
        qualityPercent: 100,
        completed: false,
        legal: false,
        failureMode: "illegal-action",
      }),
    ]);

    expect(compareAIPlayerEvalRuns(reference, candidate)).toMatchObject({
      verdict: "reject",
      qualityDeltaPercentPoints: -100,
      completionRateDeltaPercentPoints: -100,
      legalRateDeltaPercentPoints: -100,
      hardGateRegressionCaseKeys: ["safe-discard:1"],
      regressedCaseKeys: ["safe-discard:1"],
    });
  });

  it("marks net improvements with local regressions for review", () => {
    const reference = artifact("reference", [
      result({ runId: "reference", scenarioId: "a", qualityPercent: 0 }),
      result({ runId: "reference", scenarioId: "b", qualityPercent: 100 }),
      result({ runId: "reference", scenarioId: "c", qualityPercent: 0 }),
    ]);
    const candidate = artifact("candidate", [
      result({ runId: "candidate", scenarioId: "a", qualityPercent: 100 }),
      result({ runId: "candidate", scenarioId: "b", qualityPercent: 50 }),
      result({ runId: "candidate", scenarioId: "c", qualityPercent: 100 }),
    ]);

    expect(compareAIPlayerEvalRuns(reference, candidate)).toMatchObject({
      verdict: "review",
      wins: 2,
      losses: 1,
      regressedCaseKeys: ["b:1"],
    });
  });

  it("refuses comparisons across changed harnesses, suites, cases, or states", () => {
    const reference = artifact("reference", [
      result({ runId: "reference", scenarioId: "a", qualityPercent: 50 }),
    ]);
    const candidate = artifact("candidate", [
      result({ runId: "candidate", scenarioId: "a", qualityPercent: 100 }),
    ]);

    expect(() =>
      compareAIPlayerEvalRuns(
        reference,
        artifact("candidate", candidate.cases, { harnessVersion: "v3" }),
      ),
    ).toThrow("Harness versions differ");
    expect(() =>
      compareAIPlayerEvalRuns(
        reference,
        artifact("candidate", candidate.cases, { suiteVersion: "v2" }),
      ),
    ).toThrow("Suite versions differ");
    const changedSchedule = structuredClone(candidate);
    changedSchedule.manifest.executionScheduleVersion =
      "rotating-interleaved-v2";
    expect(() =>
      compareAIPlayerEvalRuns(reference, changedSchedule),
    ).toThrow("Execution schedule versions differ");
    expect(() =>
      compareAIPlayerEvalRuns(
        reference,
        artifact("candidate", [
          result({ runId: "candidate", scenarioId: "b", qualityPercent: 100 }),
        ]),
      ),
    ).toThrow("Case keys differ");

    const changedState = structuredClone(candidate.cases[0]);
    if (changedState === undefined) throw new Error("Missing fixture case");
    changedState.inputState = "different state";
    expect(() =>
      compareAIPlayerEvalRuns(reference, artifact("candidate", [changedState])),
    ).toThrow("Input state differs for a:1");
  });

  it("refuses to promote a cost-stopped partial run", () => {
    const cases = [1, 2, 3].map((repetition) =>
      result({
        runId: "candidate",
        scenarioId: "a",
        repetition,
        qualityPercent: 100,
      }),
    );
    const reference = artifact(
      "reference",
      cases.map((entry) => ({
        ...entry,
        runId: "reference",
        candidate: {
          ...entry.candidate,
          promptVersion: "prompt-v1",
        },
      })),
    );
    const candidate = artifact("candidate", cases);
    candidate.runStatus = {
      policyVersion: "matched-unit-observed-cost-v1",
      status: "cost-limit",
      maxCostUsd: 0.01,
      observedCostUsd: 0.012,
      overshootUsd: 0.002,
      unknownCostResultCount: 0,
      plannedUnitCount: 6,
      completedUnitCount: 3,
      plannedResultCount: 6,
      executedResultCount: 3,
    };

    expect(() => compareAIPlayerEvalRuns(reference, candidate)).toThrow(
      "candidate run candidate is not complete: cost-limit",
    );
  });

  it("loads immutable manifest and JSONL case artifacts from a run directory", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mayi-eval-comparison-"));
    const expected = artifact("reference", [
      result({ runId: "reference", scenarioId: "a", qualityPercent: 50 }),
    ]);
    try {
      await writeFile(
        join(directory, "manifest.json"),
        JSON.stringify(expected.manifest),
      );
      await writeFile(
        join(directory, "cases.jsonl"),
        `${JSON.stringify(expected.cases[0])}\n`,
      );

      await expect(loadAIPlayerEvalRunArtifact(directory)).resolves.toEqual(
        expected,
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("refuses a v3 artifact that omits its resolved model configuration", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mayi-eval-v3-config-"));
    const missingConfiguration = artifact(
      "reference",
      [result({ runId: "reference", scenarioId: "a", qualityPercent: 50 })],
      { harnessVersion: "ai-player-eval-harness-v3" },
    );
    try {
      await writeFile(
        join(directory, "manifest.json"),
        JSON.stringify(missingConfiguration.manifest),
      );
      await writeFile(
        join(directory, "cases.jsonl"),
        `${missingConfiguration.cases.map((entry) => JSON.stringify(entry)).join("\n")}\n`,
      );

      await expect(loadAIPlayerEvalRunArtifact(directory)).rejects.toThrow(
        "must include a valid model configuration snapshot",
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
