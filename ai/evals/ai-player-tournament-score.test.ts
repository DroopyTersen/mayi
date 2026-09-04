import { describe, expect, it } from "bun:test";
import {
  aggregateAIPlayerTournamentResults,
  compareAIPlayerTournamentDuplicateSets,
  createAIPlayerTournamentSeatRotations,
  type AIPlayerTournamentGameResult,
} from "./ai-player-tournament-score";

const DUPLICATE_COMPETITORS = ["spark-a", "spark-b", "anchor"] as const;
const DUPLICATE_ROTATIONS = createAIPlayerTournamentSeatRotations(
  DUPLICATE_COMPETITORS,
);

function duplicateGame(
  seed: string,
  rotationIndex: number,
  scoresByCompetitor: Readonly<Record<string, number>>,
  completed = true,
): AIPlayerTournamentGameResult {
  const seats = DUPLICATE_ROTATIONS[rotationIndex];
  if (seats === undefined) throw new Error("Missing duplicate rotation");
  const scores = seats.map((competitorId) => scoresByCompetitor[competitorId] ?? 0);
  return {
    schemaVersion: 3,
    runId: "duplicate-run",
    gameId: `${seed}-rotation-${rotationIndex + 1}`,
    seed,
    completed,
    roundsCompleted: completed ? 6 : 2,
    turns: 30,
    competitors: seats.map((competitorId, seatIndex) => {
      const finalScore = scores[seatIndex] ?? 0;
      return {
        competitorId,
        seatIndex,
        playerId: `player-${seatIndex}`,
        finalScore,
        placement: 1 + scores.filter((score) => score < finalScore).length,
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
}

describe("AI player tournament scoring", () => {
  it("rotates three competitors through every seat", () => {
    expect(createAIPlayerTournamentSeatRotations(["spark-a", "spark-b", "anchor"])).toEqual([
      ["spark-a", "spark-b", "anchor"],
      ["spark-b", "anchor", "spark-a"],
      ["anchor", "spark-a", "spark-b"],
    ]);
  });

  it("aggregates placement, score margin, reliability, latency, and cost separately", () => {
    const game = (
      gameId: string,
      scores: [number, number, number],
    ): AIPlayerTournamentGameResult => ({
      schemaVersion: 3,
      runId: "tournament-1",
      gameId,
      seed: "deal-a",
      completed: true,
      roundsCompleted: 6,
      turns: 30,
      competitors: ["spark-a", "spark-b", "anchor"].map((competitorId, index) => {
        const finalScore = scores[index] ?? 0;
        return {
          competitorId,
          seatIndex: index,
          playerId: `player-${index}`,
          finalScore,
          placement: 1 + scores.filter((score) => score < finalScore).length,
          roundWins: index === 0 ? 3 : index === 1 ? 2 : 1,
          turns: 10,
          completedTurns: 10,
          legalTurns: index === 1 ? 9 : 10,
          mayICallOpportunities: 4,
          mayICallCalls: index === 0 ? 2 : 1,
          mayICallPasses: index === 0 ? 2 : 3,
          mayICallIncomplete: 0,
          unknownCostDecisionCount: index === 1 ? 1 : 0,
          providerLatencyMs: [1_000 + index * 500, 2_000 + index * 500],
          totalCostUsd: 0.01 + index * 0.01,
        };
      }),
    });

    const summary = aggregateAIPlayerTournamentResults([
      game("game-1", [10, 20, 30]),
      game("game-2", [20, 10, 30]),
      game("game-3", [15, 25, 5]),
    ]);

    expect(summary.find((candidate) => candidate.competitorId === "spark-a")).toMatchObject({
      gameCount: 3,
      completedGameRate: 1,
      winRate: 1 / 3,
      meanPlacement: 5 / 3,
      meanFinalScore: 15,
      meanScoreMarginVsField: 5,
      turnCompletionRate: 1,
      legalTurnRate: 1,
      providerLatencyMs: { p50: 1_000, p95: 2_000 },
      totalCostUsd: 0.03,
      costPerTurnUsd: 0.001,
      mayICallOpportunityCount: 12,
      mayICallCallCount: 6,
      mayICallPassCount: 6,
      mayICallIncompleteCount: 0,
      unknownCostDecisionCount: 0,
    });
    expect(summary.find((candidate) => candidate.competitorId === "spark-b")).toMatchObject({
      legalTurnRate: 0.9,
      totalCostUsd: 0.06,
      unknownCostDecisionCount: 3,
      costPerTurnUsd: undefined,
    });
  });

  it("compares competitors only after both saw every seat on matched duplicate deals", () => {
    const completedGames = [
      ...DUPLICATE_ROTATIONS.map((_, rotationIndex) =>
        duplicateGame("deal-a", rotationIndex, {
          "spark-a": 20,
          "spark-b": 10,
          anchor: 30,
        }),
      ),
      ...DUPLICATE_ROTATIONS.map((_, rotationIndex) =>
        duplicateGame("deal-b", rotationIndex, {
          "spark-a": 30,
          "spark-b": 20,
          anchor: 10,
        }),
      ),
      ...DUPLICATE_ROTATIONS.map((_, rotationIndex) =>
        duplicateGame("deal-c", rotationIndex, {
          "spark-a": 40,
          "spark-b": 30,
          anchor: 20,
        }),
      ),
    ];

    expect(
      compareAIPlayerTournamentDuplicateSets(
        completedGames,
        "spark-a",
        "spark-b",
      ),
    ).toEqual({
      referenceCompetitorId: "spark-a",
      candidateCompetitorId: "spark-b",
      matchedSeedCount: 3,
      excludedSeedIds: [],
      finalScoreDelta: -10,
      finalScoreDeltaConfidence95: { lower: -10, upper: -10 },
      placementDelta: -1,
      placementDeltaConfidence95: { lower: -1, upper: -1 },
      scoreWins: 3,
      scoreTies: 0,
      scoreLosses: 0,
    });

    const incomplete = [
      duplicateGame("deal-d", 0, {
        "spark-a": 20,
        "spark-b": 10,
        anchor: 30,
      }),
      duplicateGame(
        "deal-d",
        1,
        { "spark-a": 20, "spark-b": 10, anchor: 30 },
        false,
      ),
      duplicateGame("deal-d", 2, {
        "spark-a": 20,
        "spark-b": 10,
        anchor: 30,
      }),
    ];
    expect(
      compareAIPlayerTournamentDuplicateSets(
        incomplete,
        "spark-a",
        "spark-b",
      ),
    ).toMatchObject({
      matchedSeedCount: 0,
      excludedSeedIds: ["deal-d"],
      finalScoreDelta: undefined,
    });

    const malformed = DUPLICATE_ROTATIONS.map((_, rotationIndex) =>
      duplicateGame("deal-e", rotationIndex, {
        "spark-a": 20,
        "spark-b": 10,
        anchor: 30,
      }),
    );
    const firstGame = malformed[0];
    const lastGame = malformed[2];
    if (firstGame === undefined || lastGame === undefined) {
      throw new Error("Missing malformed duplicate fixture games");
    }
    const firstCandidate = firstGame.competitors.find(
      (competitor) => competitor.competitorId === "spark-b",
    );
    const lastReference = lastGame.competitors.find(
      (competitor) => competitor.competitorId === "spark-a",
    );
    if (firstCandidate === undefined || lastReference === undefined) {
      throw new Error("Missing malformed duplicate fixture competitors");
    }
    firstCandidate.competitorId = "spark-a";
    lastReference.competitorId = "spark-b";
    expect(
      compareAIPlayerTournamentDuplicateSets(
        malformed,
        "spark-a",
        "spark-b",
      ),
    ).toMatchObject({
      matchedSeedCount: 0,
      excludedSeedIds: ["deal-e"],
    });
  });

  it("excludes incomplete games from skill while retaining their reliability and cost", () => {
    const completed = duplicateGame(
      "complete-deal",
      0,
      { "spark-a": 20, "spark-b": 10, anchor: 30 },
    );
    const incomplete = duplicateGame(
      "partial-deal",
      0,
      { "spark-a": 0, "spark-b": 1_000, anchor: 2_000 },
      false,
    );
    const aggregate = aggregateAIPlayerTournamentResults([
      completed,
      incomplete,
    ]).find((candidate) => candidate.competitorId === "spark-a");

    expect(aggregate?.gameCount).toBe(2);
    expect(aggregate?.completedGameRate).toBe(0.5);
    expect(aggregate?.winRate).toBe(0);
    expect(aggregate?.meanPlacement).toBe(2);
    expect(aggregate?.meanFinalScore).toBe(20);
    expect(aggregate?.meanScoreMarginVsField).toBe(0);
    expect(aggregate?.turnCompletionRate).toBe(1);
    expect(aggregate?.totalCostUsd).toBe(0.002);
  });
});
