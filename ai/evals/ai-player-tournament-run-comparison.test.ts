import { describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  compareAIPlayerTournamentRunArtifacts,
  compareAIPlayerTournamentRuns,
  formatAIPlayerTournamentRunComparisonMarkdown,
  loadAIPlayerTournamentRunArtifact,
  parseAIPlayerTournamentRunComparisonArguments,
  type AIPlayerTournamentRunArtifact,
  type AIPlayerTournamentRunComparisonInput,
} from "./ai-player-tournament-run-comparison";
import { AI_PLAYER_EVAL_CANDIDATES } from "./ai-player-eval-candidates";
import {
  AI_PLAYER_EVAL_COST_BUDGET_POLICY_VERSION,
  type AIPlayerEvalCostBudgetSummary,
} from "./ai-player-eval-cost-budget";
import { createAIPlayerEvalPromptSelection } from "./ai-player-eval-prompt";
import { fingerprintAIPlayerEvalModelConfiguration } from "./ai-player-model-configuration";
import {
  createAIPlayerTournamentSeatRotations,
  type AIPlayerTournamentGameResult,
} from "./ai-player-tournament-score";

const COMPETITORS = ["spark-medium", "spark-minimal", "spark-xhigh"] as const;
const ROTATIONS = createAIPlayerTournamentSeatRotations(COMPETITORS);

function duplicateSeedGames(options: {
  runId: string;
  seed: string;
  scores: Readonly<Record<string, number>>;
  incompleteRotation?: number;
}): AIPlayerTournamentGameResult[] {
  return ROTATIONS.map((seats, rotationIndex) => {
    const seatScores = seats.map(
      (competitorId) => options.scores[competitorId] ?? 0,
    );
    const completed = options.incompleteRotation !== rotationIndex;
    return {
      schemaVersion: 3,
      runId: options.runId,
      gameId: `${options.runId}-${options.seed}-rotation-${rotationIndex + 1}`,
      seed: options.seed,
      completed,
      roundsCompleted: completed ? 6 : 2,
      turns: 30,
      competitors: seats.map((competitorId, seatIndex) => {
        const finalScore = seatScores[seatIndex] ?? 0;
        return {
          competitorId,
          seatIndex,
          playerId: `player-${seatIndex}`,
          finalScore,
          placement:
            1 + seatScores.filter((score) => score < finalScore).length,
          roundWins: 0,
          turns: 10,
          completedTurns: 10,
          legalTurns: 10,
          mayICallOpportunities: 0,
          mayICallCalls: 0,
          mayICallPasses: 0,
          mayICallIncomplete: 0,
          unknownCostDecisionCount: 0,
          providerLatencyMs: [1_000],
          totalCostUsd: 0.001,
        };
      }),
    };
  });
}

function matchedRunPair(): {
  baseline: AIPlayerTournamentRunComparisonInput;
  experiment: AIPlayerTournamentRunComparisonInput;
} {
  const baselineScores = [
    { target: 50, anchorA: 40, anchorB: 60 },
    { target: 60, anchorA: 50, anchorB: 70 },
    { target: 70, anchorA: 60, anchorB: 80 },
  ];
  const experimentScores = [
    { target: 32, anchorA: 40, anchorB: 60 },
    { target: 40, anchorA: 50, anchorB: 70 },
    { target: 48, anchorA: 60, anchorB: 80 },
  ];
  const seeds = ["deal-a", "deal-b", "deal-c"];
  return {
    baseline: {
      runId: "baseline-run",
      games: seeds.flatMap((seed, index) =>
        duplicateSeedGames({
          runId: "baseline-run",
          seed,
          scores: {
            "spark-medium": baselineScores[index]?.target ?? 0,
            "spark-minimal": baselineScores[index]?.anchorA ?? 0,
            "spark-xhigh": baselineScores[index]?.anchorB ?? 0,
          },
        }),
      ),
    },
    experiment: {
      runId: "experiment-run",
      games: seeds.flatMap((seed, index) =>
        duplicateSeedGames({
          runId: "experiment-run",
          seed,
          scores: {
            "spark-medium": experimentScores[index]?.target ?? 0,
            "spark-minimal": experimentScores[index]?.anchorA ?? 0,
            "spark-xhigh": experimentScores[index]?.anchorB ?? 0,
          },
        }),
      ),
    },
  };
}

describe("AI player tournament run comparison", () => {
  it("measures prompt lift as a seed-clustered difference in differences against both frozen anchors", () => {
    const runs = matchedRunPair();
    const comparison = compareAIPlayerTournamentRuns({
      baseline: runs.baseline,
      experiment: runs.experiment,
      targetCompetitorId: "spark-medium",
      anchorCompetitorIds: ["spark-minimal", "spark-xhigh"],
    });

    expect(comparison.schemaVersion).toBe(1);
    expect(comparison.matchedSeedCount).toBe(3);
    expect(comparison.excludedSeedIds).toEqual([]);
    expect(comparison.baselineRunId).toBe("baseline-run");
    expect(comparison.experimentRunId).toBe("experiment-run");

    const anchorA = comparison.anchors[0];
    const anchorB = comparison.anchors[1];
    if (anchorA === undefined || anchorB === undefined) {
      throw new Error("Missing tournament comparison anchors");
    }
    expect(anchorA.anchorCompetitorId).toBe("spark-minimal");
    expect(
      anchorA.seeds.map((seed) => seed.finalScoreDifferenceInDifferences),
    ).toEqual([-18, -20, -22]);
    expect(anchorA.finalScoreDifferenceInDifferences).toBe(-20);
    expect(
      anchorA.finalScoreDifferenceInDifferencesConfidence95.lower,
    ).toBeLessThan(-20);
    expect(
      anchorA.finalScoreDifferenceInDifferencesConfidence95.upper,
    ).toBeLessThan(0);
    expect(anchorA.scoreImprovementWins).toBe(3);
    expect(anchorA.scoreTies).toBe(0);
    expect(anchorA.scoreRegressionLosses).toBe(0);

    expect(anchorB.anchorCompetitorId).toBe("spark-xhigh");
    expect(anchorB.finalScoreDifferenceInDifferences).toBe(-20);
    expect(anchorB.scoreImprovementWins).toBe(3);
    expect(comparison.targetOperations.baseline.decisionCount).toBe(90);
    expect(comparison.targetOperations.baseline.providerLatencyMs).toEqual({
      mean: 1_000,
      p50: 1_000,
      p95: 1_000,
    });
    expect(comparison.targetOperations.baseline.totalCostUsd).toBeCloseTo(
      0.009,
    );
    expect(comparison.targetOperations.baseline.costPerDecisionUsd).toBeCloseTo(
      0.0001,
    );
    expect(comparison.targetOperations.deltas.providerLatencyMeanMs).toBe(0);
    expect(comparison.targetOperations.deltas.costPerDecisionUsd).toBe(0);

    const markdown = formatAIPlayerTournamentRunComparisonMarkdown(comparison);
    expect(markdown).toContain("# AI Player Tournament Prompt Comparison");
    expect(markdown).toContain("Difference in differences");
    expect(markdown).toContain("spark-minimal");
    expect(markdown).toContain("descriptive checkpoint");
    expect(markdown).toContain("Provider mean ms");
    expect(markdown).toContain("Cost/decision");
  });

  it("excludes a seed when either run lacks a complete three-seat duplicate set", () => {
    const runs = matchedRunPair();
    runs.experiment.games = runs.experiment.games.map((game) =>
      game.seed === "deal-b" && game.gameId.endsWith("rotation-2")
        ? { ...game, completed: false }
        : game,
    );

    const comparison = compareAIPlayerTournamentRuns({
      baseline: runs.baseline,
      experiment: runs.experiment,
      targetCompetitorId: "spark-medium",
      anchorCompetitorIds: ["spark-minimal", "spark-xhigh"],
    });

    expect(comparison.matchedSeedCount).toBe(2);
    expect(comparison.excludedSeedIds).toEqual(["deal-b"]);
    expect(comparison.anchors[0]?.seeds.map((seed) => seed.seed)).toEqual([
      "deal-a",
      "deal-c",
    ]);
  });

  it("rejects ambiguous target and anchor identities", () => {
    const runs = matchedRunPair();
    expect(() =>
      compareAIPlayerTournamentRuns({
        baseline: runs.baseline,
        experiment: runs.experiment,
        targetCompetitorId: "spark-medium",
        anchorCompetitorIds: ["spark-minimal", "spark-minimal"],
      }),
    ).toThrow("two distinct anchors");
    expect(() =>
      compareAIPlayerTournamentRuns({
        baseline: runs.baseline,
        experiment: runs.experiment,
        targetCompetitorId: "spark-medium",
        anchorCompetitorIds: ["spark-medium", "spark-xhigh"],
      }),
    ).toThrow("distinct from the target");
  });

  it("infers the one changed Spark prompt and rejects anchor or model drift", async () => {
    const runs = matchedRunPair();
    const basePrompt = createAIPlayerEvalPromptSelection({
      baseVersion: "house-rules-v3",
      baseContent: "base prompt",
    });
    const experimentPrompt = createAIPlayerEvalPromptSelection({
      baseVersion: "house-rules-v3",
      baseContent: "base prompt",
      experiment: {
        id: "discard-check-v1",
        sourcePath: "ai/evals/prompts/discard-check-v1.md",
        addendum: "Recheck whether the discard lets an opponent go out.",
      },
    });
    const runStatus: AIPlayerEvalCostBudgetSummary = {
      policyVersion: AI_PLAYER_EVAL_COST_BUDGET_POLICY_VERSION,
      status: "completed",
      maxCostUsd: 0.25,
      observedCostUsd: 0.02,
      overshootUsd: 0,
      unknownCostResultCount: 0,
      plannedUnitCount: 3,
      completedUnitCount: 3,
      plannedResultCount: 9,
      executedResultCount: 9,
    };
    const artifact = (
      kind: "baseline" | "experiment",
    ): AIPlayerTournamentRunArtifact => {
      const run = kind === "baseline" ? runs.baseline : runs.experiment;
      const targetPrompt = kind === "baseline" ? basePrompt : experimentPrompt;
      return {
        manifest: {
          schemaVersion: 2,
          runId: run.runId,
          harnessVersion: "ai-player-eval-harness-v3",
          suiteVersion: "duplicate-tournament-v4",
          candidates: COMPETITORS.map((candidateId) => ({
            ...AI_PLAYER_EVAL_CANDIDATES[candidateId],
            promptVersion:
              candidateId === "spark-medium"
                ? targetPrompt.version
                : basePrompt.version,
          })),
          seeds: ["deal-a", "deal-b", "deal-c"],
          startingRound: 6,
          maxTurns: 250,
          seatRotations: ROTATIONS,
          promptAssignments: COMPETITORS.map((candidateId) => ({
            candidateId,
            prompt: structuredClone(
              candidateId === "spark-medium" ? targetPrompt : basePrompt,
            ),
          })),
        },
        games: run.games,
        runStatus: { ...runStatus },
      };
    };
    const baseline = artifact("baseline");
    const experiment = artifact("experiment");

    const comparison = compareAIPlayerTournamentRunArtifacts({
      baseline,
      experiment,
    });
    expect(comparison.targetCompetitorId).toBe("spark-medium");
    expect(comparison.anchorCompetitorIds).toEqual([
      "spark-minimal",
      "spark-xhigh",
    ]);

    const corruptedExperimentMetadata = artifact("experiment");
    const targetAssignment =
      corruptedExperimentMetadata.manifest.promptAssignments.find(
        (assignment) => assignment.candidateId === "spark-medium",
      );
    if (
      targetAssignment?.prompt.experiment === null ||
      targetAssignment === undefined
    ) {
      throw new Error("Missing target experiment metadata");
    }
    targetAssignment.prompt.experiment.sha256 = "b".repeat(64);
    expect(() =>
      compareAIPlayerTournamentRunArtifacts({
        baseline,
        experiment: corruptedExperimentMetadata,
      }),
    ).toThrow("invalid prompt experiment fingerprint");

    const changedAnchor = artifact("experiment");
    const anchorAssignment = changedAnchor.manifest.promptAssignments.find(
      (assignment) => assignment.candidateId === "spark-minimal",
    );
    if (anchorAssignment === undefined)
      throw new Error("Missing anchor prompt");
    anchorAssignment.prompt = experimentPrompt;
    const changedAnchorCandidate = changedAnchor.manifest.candidates.find(
      (candidate) => candidate.id === "spark-minimal",
    );
    if (changedAnchorCandidate === undefined) {
      throw new Error("Missing anchor candidate");
    }
    changedAnchorCandidate.promptVersion = experimentPrompt.version;
    expect(() =>
      compareAIPlayerTournamentRunArtifacts({
        baseline,
        experiment: changedAnchor,
      }),
    ).toThrow("exactly one prompt assignment");

    const changedModel = artifact("experiment");
    const targetCandidate = changedModel.manifest.candidates.find(
      (candidate) => candidate.id === "spark-medium",
    );
    if (targetCandidate === undefined)
      throw new Error("Missing target candidate");
    targetCandidate.modelConfiguration = {
      ...targetCandidate.modelConfiguration,
      profile: "changed-profile",
    };
    targetCandidate.modelConfigurationSha256 =
      fingerprintAIPlayerEvalModelConfiguration(
        targetCandidate.modelConfiguration,
      );
    expect(() =>
      compareAIPlayerTournamentRunArtifacts({
        baseline,
        experiment: changedModel,
      }),
    ).toThrow("model configuration changed");

    const changedIdentity = artifact("experiment");
    const mislabeledTarget = changedIdentity.manifest.candidates.find(
      (candidate) => candidate.id === "spark-medium",
    );
    if (mislabeledTarget === undefined) {
      throw new Error("Missing mislabeled target candidate");
    }
    mislabeledTarget.reasoningEffort = "low";
    expect(() =>
      compareAIPlayerTournamentRunArtifacts({
        baseline,
        experiment: changedIdentity,
      }),
    ).toThrow("candidate identity changed");

    const directory = await mkdtemp(join(tmpdir(), "mayi-tournament-compare-"));
    try {
      await writeFile(
        join(directory, "manifest.json"),
        JSON.stringify(baseline.manifest),
      );
      await writeFile(
        join(directory, "games.jsonl"),
        `${baseline.games.map((game) => JSON.stringify(game)).join("\n")}\n`,
      );
      await writeFile(
        join(directory, "run-status.json"),
        JSON.stringify(baseline.runStatus),
      );
      await expect(
        loadAIPlayerTournamentRunArtifact(directory),
      ).resolves.toEqual(baseline);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects cost-limited or non-matched tournament artifacts", () => {
    const runs = matchedRunPair();
    const prompt = createAIPlayerEvalPromptSelection({
      baseVersion: "house-rules-v4",
      baseContent: "base prompt",
    });
    const manifest = (
      runId: string,
    ): AIPlayerTournamentRunArtifact["manifest"] => ({
      schemaVersion: 2,
      runId,
      harnessVersion: "ai-player-eval-harness-v3",
      suiteVersion: "duplicate-tournament-v4",
      candidates: COMPETITORS.map((candidateId) => ({
        ...AI_PLAYER_EVAL_CANDIDATES[candidateId],
        promptVersion: prompt.version,
      })),
      seeds: ["deal-a", "deal-b", "deal-c"],
      startingRound: 6,
      maxTurns: 250,
      seatRotations: ROTATIONS,
      promptAssignments: COMPETITORS.map((candidateId) => ({
        candidateId,
        prompt,
      })),
    });
    const status: AIPlayerEvalCostBudgetSummary = {
      policyVersion: AI_PLAYER_EVAL_COST_BUDGET_POLICY_VERSION,
      status: "completed",
      maxCostUsd: 0.25,
      observedCostUsd: 0.02,
      overshootUsd: 0,
      unknownCostResultCount: 0,
      plannedUnitCount: 3,
      completedUnitCount: 3,
      plannedResultCount: 9,
      executedResultCount: 9,
    };
    const baseline: AIPlayerTournamentRunArtifact = {
      manifest: manifest("baseline-run"),
      games: runs.baseline.games,
      runStatus: { ...status },
    };
    const experiment: AIPlayerTournamentRunArtifact = {
      manifest: manifest("experiment-run"),
      games: runs.experiment.games,
      runStatus: { ...status, status: "cost-limit", completedUnitCount: 2 },
    };
    expect(() =>
      compareAIPlayerTournamentRunArtifacts({ baseline, experiment }),
    ).toThrow("experiment run is not complete");

    experiment.runStatus = { ...status };
    experiment.manifest.seeds = ["deal-a", "deal-c", "deal-b"];
    expect(() =>
      compareAIPlayerTournamentRunArtifacts({ baseline, experiment }),
    ).toThrow("same ordered seeds");

    experiment.manifest.seeds = [...baseline.manifest.seeds];
    experiment.manifest.harnessVersion = `${baseline.manifest.harnessVersion}+public-action-history-v1`;
    expect(() =>
      compareAIPlayerTournamentRunArtifacts({ baseline, experiment }),
    ).toThrow("same harness version");

    experiment.manifest.harnessVersion = baseline.manifest.harnessVersion;
    experiment.manifest.suiteVersion = "duplicate-tournament-v5";
    expect(() =>
      compareAIPlayerTournamentRunArtifacts({ baseline, experiment }),
    ).toThrow("same suite version");
  });

  it("requires explicit baseline and experiment artifact directories", () => {
    expect(
      parseAIPlayerTournamentRunComparisonArguments([
        "--baseline",
        ".data/ai-evals/baseline",
        "--experiment",
        ".data/ai-evals/experiment",
      ]),
    ).toEqual({
      baselineDirectory: ".data/ai-evals/baseline",
      experimentDirectory: ".data/ai-evals/experiment",
    });
    expect(() =>
      parseAIPlayerTournamentRunComparisonArguments(["--baseline", "run-a"]),
    ).toThrow("--baseline and --experiment are required");
  });
});
