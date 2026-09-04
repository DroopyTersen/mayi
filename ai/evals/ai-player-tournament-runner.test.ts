import { describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GameEngine } from "../../core/engine/game-engine";
import {
  AI_PLAYER_TOURNAMENT_MANIFEST_SCHEMA_VERSION,
  AI_PLAYER_TOURNAMENT_HARNESS_VERSION,
  AI_PLAYER_TOURNAMENT_SUITE_VERSION,
  formatAIPlayerTournamentSummaryMarkdown,
  getAIPlayerTournamentDecisionCostUsd,
  getAIPlayerTournamentGameCostUsd,
  getTournamentMayICallDecisionOrder,
  loadAIPlayerTournamentPromptAssignments,
  parseAIPlayerTournamentRunnerArguments,
  summarizeAIPlayerTournamentRun,
  summarizeAIPlayerTournamentGameCost,
} from "./ai-player-tournament-runner";
import type { AIPlayerTournamentGameResult } from "./ai-player-tournament-score";

function gameResult(
  gameId: string,
  competitors: readonly [string, string, string],
  scores: readonly [number, number, number],
): AIPlayerTournamentGameResult {
  return {
    schemaVersion: 3,
    runId: "tournament-run",
    gameId,
    seed: "seed-1",
    completed: true,
    roundsCompleted: 1,
    turns: 12,
    competitors: competitors.map((competitorId, seatIndex) => {
      const finalScore = scores[seatIndex] ?? 0;
      return {
        competitorId,
        seatIndex,
        playerId: `player-${seatIndex}`,
        finalScore,
        placement: 1 + scores.filter((score) => score < finalScore).length,
        roundWins: seatIndex === 0 ? 1 : 0,
        turns: 4,
        completedTurns: 4,
        legalTurns: 4,
        mayICallOpportunities: 2,
        mayICallCalls: seatIndex === 0 ? 1 : 0,
        mayICallPasses: seatIndex === 0 ? 1 : 2,
        mayICallIncomplete: 0,
        unknownCostDecisionCount: 0,
        providerLatencyMs: [1_000 + seatIndex * 100],
        totalCostUsd: 0.001 + seatIndex * 0.001,
      };
    }),
  };
}

describe("AI player tournament runner", () => {
  it("versions the full current-hand public-history tournament separately from legacy observations", () => {
    expect(AI_PLAYER_TOURNAMENT_MANIFEST_SCHEMA_VERSION).toBe(2);
    expect(AI_PLAYER_TOURNAMENT_SUITE_VERSION).toBe("duplicate-tournament-v5");
    expect(AI_PLAYER_TOURNAMENT_HARNESS_VERSION).toContain("public-action-history-v1");
    expect(AI_PLAYER_TOURNAMENT_HARNESS_VERSION).toContain("game-engine-runtime-v2");
  });

  it("offers deterministic May I decisions in priority order before a draw", () => {
    const engine = GameEngine.createGame({
      gameId: "may-i-order",
      playerNames: ["A", "B", "C"],
      startingRound: 1,
      seed: "may-i-order-seed",
    });
    try {
      expect(engine.getSnapshot().awaitingPlayerId).toBe("player-1");
      expect(getTournamentMayICallDecisionOrder(engine.getSnapshot())).toEqual([
        "player-2",
        "player-0",
      ]);

      engine.drawFromStock("player-1");
      engine.skip("player-1");
      const card = engine
        .getSnapshot()
        .players.find((player) => player.id === "player-1")?.hand[0];
      if (card === undefined) throw new Error("Missing discard fixture card");
      engine.discard("player-1", card.id);

      expect(getTournamentMayICallDecisionOrder(engine.getSnapshot())).toEqual([
        "player-0",
      ]);
    } finally {
      engine.stop();
    }
  });

  it("defaults to a cheap Spark-only one-hand duplicate tournament", () => {
    expect(parseAIPlayerTournamentRunnerArguments([])).toEqual({
      candidateIds: ["spark-minimal", "spark-medium", "spark-xhigh"],
      seeds: ["mayi-tournament-v1-seed-1"],
      startingRound: 6,
      maxTurns: 250,
      runId: undefined,
      promptExperiment: undefined,
      promptExperimentCandidateId: undefined,
      maxCostUsd: 0.25,
    });
  });

  it("allows Luna only through an explicit three-candidate baseline", () => {
    expect(
      parseAIPlayerTournamentRunnerArguments([
        "--candidate",
        "luna-xhigh-baseline,spark-minimal,spark-high",
        "--seed",
        "deal-a,deal-b",
        "--starting-round",
        "1",
        "--max-turns",
        "1200",
        "--run-id",
        "luna-baseline-tournament-v1",
      ]),
    ).toEqual({
      candidateIds: ["luna-xhigh-baseline", "spark-minimal", "spark-high"],
      seeds: ["deal-a", "deal-b"],
      startingRound: 1,
      maxTurns: 1200,
      runId: "luna-baseline-tournament-v1",
      promptExperiment: undefined,
      promptExperimentCandidateId: undefined,
      maxCostUsd: 0.25,
    });
  });

  it("accepts a frozen Spark prompt experiment for checkpoint tournaments", () => {
    expect(
      parseAIPlayerTournamentRunnerArguments([
        "--prompt-experiment",
        "phase-checklist-v1",
        "--prompt-addendum-file",
        "ai/evals/prompts/phase-checklist-v1.md",
        "--prompt-experiment-candidate",
        "spark-medium",
      ]).promptExperiment,
    ).toEqual({
      id: "phase-checklist-v1",
      addendumFile: "ai/evals/prompts/phase-checklist-v1.md",
    });
    expect(
      parseAIPlayerTournamentRunnerArguments([
        "--prompt-experiment",
        "phase-checklist-v1",
        "--prompt-addendum-file",
        "ai/evals/prompts/phase-checklist-v1.md",
        "--prompt-experiment-candidate",
        "spark-medium",
      ]).promptExperimentCandidateId,
    ).toBe("spark-medium");
    expect(() =>
      parseAIPlayerTournamentRunnerArguments([
        "--prompt-experiment",
        "phase-checklist-v1",
        "--prompt-addendum-file",
        "ai/evals/prompts/phase-checklist-v1.md",
      ]),
    ).toThrow("--prompt-experiment-candidate is required");
    expect(() =>
      parseAIPlayerTournamentRunnerArguments([
        "--candidate",
        "luna-xhigh-baseline,spark-minimal,spark-high",
        "--prompt-experiment",
        "phase-checklist-v1",
        "--prompt-addendum-file",
        "ai/evals/prompts/phase-checklist-v1.md",
        "--prompt-experiment-candidate",
        "spark-minimal",
      ]),
    ).toThrow("Prompt experiments are Spark-only");
  });

  it("applies a prompt experiment to one Spark competitor and leaves both anchors frozen", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mayi-tournament-prompt-"));
    const addendumFile = join(directory, "strategy.md");
    try {
      await writeFile(
        addendumFile,
        "Check immediate go-out before discarding.",
      );
      const assignments = await loadAIPlayerTournamentPromptAssignments({
        candidateIds: ["spark-minimal", "spark-medium", "spark-xhigh"],
        baseContent: "base house rules",
        experiment: { id: "go-out-check-v1", addendumFile },
        experimentCandidateId: "spark-medium",
      });

      expect(assignments.get("spark-minimal")?.version).toBe("house-rules-v1+player-guidance-v1+tool-protocol-v1");
      expect(assignments.get("spark-minimal")?.content).toBe(
        "base house rules",
      );
      expect(assignments.get("spark-medium")?.version).toBe(
        "house-rules-v1+player-guidance-v1+tool-protocol-v1+go-out-check-v1",
      );
      expect(assignments.get("spark-medium")?.content).toContain(
        "Check immediate go-out before discarding.",
      );
      expect(assignments.get("spark-xhigh")?.version).toBe("house-rules-v1+player-guidance-v1+tool-protocol-v1");
      expect(assignments.get("spark-xhigh")?.content).toBe("base house rules");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("requires exactly three distinct candidates and valid bounds", () => {
    expect(() =>
      parseAIPlayerTournamentRunnerArguments([
        "--candidate",
        "spark-minimal,spark-high",
      ]),
    ).toThrow("Tournament requires exactly three distinct candidates");
    expect(() =>
      parseAIPlayerTournamentRunnerArguments([
        "--candidate",
        "spark-minimal,spark-minimal,spark-high",
      ]),
    ).toThrow("Tournament requires exactly three distinct candidates");
    expect(() =>
      parseAIPlayerTournamentRunnerArguments(["--starting-round", "7"]),
    ).toThrow("Starting round must be an integer from 1 through 6");
    expect(() =>
      parseAIPlayerTournamentRunnerArguments(["--max-turns", "0"]),
    ).toThrow("Max turns must be a positive integer");
    expect(() =>
      parseAIPlayerTournamentRunnerArguments(["--max-cost-usd", "-1"]),
    ).toThrow("Maximum cost must be a positive finite number");
    expect(() =>
      parseAIPlayerTournamentRunnerArguments([
        "--seed",
        "duplicate-deal,duplicate-deal",
      ]),
    ).toThrow("Tournament seeds must be distinct");
  });

  it("accepts a duplicate-set observed-cost stop threshold", () => {
    expect(
      parseAIPlayerTournamentRunnerArguments(["--max-cost-usd", "0.50"])
        .maxCostUsd,
    ).toBe(0.5);
  });

  it("never treats missing decision or game cost as zero", () => {
    expect(
      getAIPlayerTournamentDecisionCostUsd(
        { success: true, actions: [] },
        {
          noCacheInputPerMillionUsd: 0.1,
          cacheReadInputPerMillionUsd: 0.002,
          cacheWriteInputPerMillionUsd: 0.1,
          outputPerMillionUsd: 0.2,
        },
      ),
    ).toBeUndefined();

    const completeCost = gameResult(
      "known-cost",
      ["spark-minimal", "spark-medium", "spark-xhigh"],
      [10, 20, 30],
    );
    expect(getAIPlayerTournamentGameCostUsd(completeCost)).toBeCloseTo(0.006);
    expect(summarizeAIPlayerTournamentGameCost(completeCost)).toEqual({
      observedCostUsd: 0.006,
      unknownCostDecisionCount: 0,
    });

    const missingCost = gameResult(
      "missing-cost",
      ["spark-minimal", "spark-medium", "spark-xhigh"],
      [10, 20, 30],
    );
    const firstCompetitor = missingCost.competitors[0];
    if (firstCompetitor === undefined) {
      throw new Error("Missing tournament cost fixture competitor");
    }
    firstCompetitor.unknownCostDecisionCount = 1;
    expect(getAIPlayerTournamentGameCostUsd(missingCost)).toBeUndefined();
    expect(summarizeAIPlayerTournamentGameCost(missingCost)).toEqual({
      observedCostUsd: 0.006,
      unknownCostDecisionCount: 1,
    });
  });

  it("summarizes seat-rotated games without combining skill, latency, and cost", () => {
    const candidates = [
      "spark-minimal",
      "spark-medium",
      "spark-xhigh",
    ] as const;
    const summary = summarizeAIPlayerTournamentRun("tournament-run", [
      gameResult("game-1", candidates, [10, 20, 30]),
      gameResult(
        "game-2",
        [candidates[1], candidates[2], candidates[0]],
        [15, 25, 5],
      ),
      gameResult(
        "game-3",
        [candidates[2], candidates[0], candidates[1]],
        [30, 20, 10],
      ),
    ]);

    const mediumComparison = summary.duplicateSetComparisons[0];
    if (
      mediumComparison?.candidateCompetitorId !== "spark-medium" ||
      mediumComparison?.finalScoreDelta === undefined ||
      mediumComparison.finalScoreDeltaConfidence95 === undefined
    ) {
      throw new Error("Missing Spark medium duplicate-set comparison");
    }
    expect(mediumComparison.finalScoreDelta).toBeCloseTo(10 / 3);
    expect(mediumComparison.finalScoreDeltaConfidence95.lower).toBeCloseTo(
      10 / 3,
    );
    expect(summary).toMatchObject({
      schemaVersion: 4,
      runId: "tournament-run",
      gameCount: 3,
    });
    expect(summary.duplicateSetComparisons).toHaveLength(2);
    expect(mediumComparison).toMatchObject({
      referenceCompetitorId: "spark-minimal",
      candidateCompetitorId: "spark-medium",
      matchedSeedCount: 1,
      excludedSeedIds: [],
      scoreWins: 0,
      scoreTies: 0,
      scoreLosses: 1,
    });
    expect(summary.duplicateSetComparisons[1]).toMatchObject({
      referenceCompetitorId: "spark-minimal",
      candidateCompetitorId: "spark-xhigh",
      matchedSeedCount: 1,
    });
    expect(summary.competitors).toHaveLength(3);
    expect(
      summary.competitors.find(
        (competitor) => competitor.competitorId === "spark-minimal",
      ),
    ).toMatchObject({
      gameCount: 3,
      completedGameRate: 1,
      winRate: 2 / 3,
      meanPlacement: 4 / 3,
      mayICallOpportunityCount: 6,
      mayICallCallCount: 1,
      mayICallPassCount: 5,
      mayICallIncompleteCount: 0,
    });

    const markdown = formatAIPlayerTournamentSummaryMarkdown(summary);
    expect(markdown).toContain("# AI Player Duplicate Tournament");
    expect(markdown).toContain("spark-minimal");
    expect(markdown).toContain("Provider p50 ms");
    expect(markdown).toContain("Cost/turn");
    expect(markdown).toContain("Unknown cost decisions");
    expect(markdown).toContain("May I calls/opps");
    expect(markdown).toContain("## Seat-controlled duplicate-set comparisons");
    expect(markdown).toContain("spark-medium | spark-minimal | 1");
    expect(markdown).toContain("Lower score and placement deltas are better");
  });
});
