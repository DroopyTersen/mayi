export interface AIPlayerTournamentCompetitorGameResult {
  competitorId: string;
  seatIndex: number;
  playerId: string;
  finalScore: number;
  placement: number;
  roundWins: number;
  turns: number;
  completedTurns: number;
  legalTurns: number;
  mayICallOpportunities: number;
  mayICallCalls: number;
  mayICallPasses: number;
  mayICallIncomplete: number;
  unknownCostDecisionCount: number;
  providerLatencyMs: number[];
  totalCostUsd: number;
}

export interface AIPlayerTournamentGameResult {
  schemaVersion: 3;
  runId: string;
  gameId: string;
  seed: string;
  completed: boolean;
  roundsCompleted: number;
  turns: number;
  failure?: string;
  competitors: AIPlayerTournamentCompetitorGameResult[];
}

export interface AIPlayerTournamentAggregate {
  competitorId: string;
  gameCount: number;
  completedGameRate: number;
  winRate: number;
  meanPlacement: number;
  meanFinalScore: number;
  meanScoreMarginVsField: number;
  roundWinRate: number;
  turnCompletionRate: number;
  legalTurnRate: number;
  mayICallOpportunityCount: number;
  mayICallCallCount: number;
  mayICallPassCount: number;
  mayICallIncompleteCount: number;
  unknownCostDecisionCount: number;
  providerLatencyMs: {
    p50: number | undefined;
    p95: number | undefined;
  };
  totalCostUsd: number;
  costPerTurnUsd: number | undefined;
}

export interface AIPlayerTournamentConfidenceInterval {
  lower: number;
  upper: number;
}

export interface AIPlayerTournamentDuplicateSetComparison {
  referenceCompetitorId: string;
  candidateCompetitorId: string;
  matchedSeedCount: number;
  excludedSeedIds: string[];
  /** Candidate minus reference; lower is better. */
  finalScoreDelta: number | undefined;
  finalScoreDeltaConfidence95:
    | AIPlayerTournamentConfidenceInterval
    | undefined;
  /** Candidate minus reference; lower is better. */
  placementDelta: number | undefined;
  placementDeltaConfidence95:
    | AIPlayerTournamentConfidenceInterval
    | undefined;
  scoreWins: number;
  scoreTies: number;
  scoreLosses: number;
}

export function createAIPlayerTournamentSeatRotations(
  competitorIds: readonly [string, string, string],
): Array<[string, string, string]> {
  const [first, second, third] = competitorIds;
  return [
    [first, second, third],
    [second, third, first],
    [third, first, second],
  ];
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

const STUDENT_T_CRITICAL_95 = [
  12.706,
  4.303,
  3.182,
  2.776,
  2.571,
  2.447,
  2.365,
  2.306,
  2.262,
  2.228,
  2.201,
  2.179,
  2.16,
  2.145,
  2.131,
  2.12,
  2.11,
  2.101,
  2.093,
  2.086,
  2.08,
  2.074,
  2.069,
  2.064,
  2.06,
  2.056,
  2.052,
  2.048,
  2.045,
  2.042,
] as const;

function meanConfidence95(
  values: readonly number[],
  bounds?: { lower: number; upper: number },
): AIPlayerTournamentConfidenceInterval | undefined {
  if (values.length === 0) return undefined;
  const average = mean(values);
  if (values.length === 1) return { lower: average, upper: average };
  const sampleVariance =
    values.reduce(
      (total, value) => total + (value - average) ** 2,
      0,
    ) /
    (values.length - 1);
  const standardError = Math.sqrt(sampleVariance / values.length);
  const degreesOfFreedom = values.length - 1;
  const criticalValue =
    STUDENT_T_CRITICAL_95[degreesOfFreedom - 1] ?? 1.96;
  const margin = criticalValue * standardError;
  return {
    lower: Math.max(bounds?.lower ?? -Infinity, average - margin),
    upper: Math.min(bounds?.upper ?? Infinity, average + margin),
  };
}

function hasEveryTournamentSeat(
  appearances: readonly AIPlayerTournamentCompetitorGameResult[],
): boolean {
  const seats = appearances
    .map((appearance) => appearance.seatIndex)
    .sort((left, right) => left - right);
  return seats.length === 3 && seats[0] === 0 && seats[1] === 1 && seats[2] === 2;
}

export function compareAIPlayerTournamentDuplicateSets(
  games: readonly AIPlayerTournamentGameResult[],
  referenceCompetitorId: string,
  candidateCompetitorId: string,
): AIPlayerTournamentDuplicateSetComparison {
  if (referenceCompetitorId === candidateCompetitorId) {
    throw new Error("Duplicate-set comparison requires two competitors");
  }
  const seedIds = [...new Set(games.map((game) => game.seed))];
  const excludedSeedIds: string[] = [];
  const finalScoreDeltas: number[] = [];
  const placementDeltas: number[] = [];

  for (const seedId of seedIds) {
    const seedGames = games.filter((game) => game.seed === seedId);
    const referenceAppearances = seedGames.flatMap((game) =>
      game.competitors.filter(
        (competitor) => competitor.competitorId === referenceCompetitorId,
      ),
    );
    const candidateAppearances = seedGames.flatMap((game) =>
      game.competitors.filter(
        (competitor) => competitor.competitorId === candidateCompetitorId,
      ),
    );
    const completeDuplicateSet =
      seedGames.length === 3 &&
      seedGames.every((game) => game.completed) &&
      seedGames.every(
        (game) =>
          game.competitors.filter(
            (competitor) =>
              competitor.competitorId === referenceCompetitorId,
          ).length === 1 &&
          game.competitors.filter(
            (competitor) =>
              competitor.competitorId === candidateCompetitorId,
          ).length === 1,
      ) &&
      hasEveryTournamentSeat(referenceAppearances) &&
      hasEveryTournamentSeat(candidateAppearances);
    if (!completeDuplicateSet) {
      excludedSeedIds.push(seedId);
      continue;
    }

    finalScoreDeltas.push(
      mean(candidateAppearances.map((appearance) => appearance.finalScore)) -
        mean(referenceAppearances.map((appearance) => appearance.finalScore)),
    );
    placementDeltas.push(
      mean(candidateAppearances.map((appearance) => appearance.placement)) -
        mean(referenceAppearances.map((appearance) => appearance.placement)),
    );
  }

  return {
    referenceCompetitorId,
    candidateCompetitorId,
    matchedSeedCount: finalScoreDeltas.length,
    excludedSeedIds,
    finalScoreDelta:
      finalScoreDeltas.length === 0 ? undefined : mean(finalScoreDeltas),
    finalScoreDeltaConfidence95: meanConfidence95(finalScoreDeltas),
    placementDelta:
      placementDeltas.length === 0 ? undefined : mean(placementDeltas),
    placementDeltaConfidence95: meanConfidence95(placementDeltas, {
      lower: -2,
      upper: 2,
    }),
    scoreWins: finalScoreDeltas.filter((delta) => delta < 0).length,
    scoreTies: finalScoreDeltas.filter((delta) => delta === 0).length,
    scoreLosses: finalScoreDeltas.filter((delta) => delta > 0).length,
  };
}

function percentile(
  values: readonly number[],
  requestedPercentile: number,
): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((left, right) => left - right);
  const rank = Math.max(
    0,
    Math.min(
      sorted.length - 1,
      Math.ceil((requestedPercentile / 100) * sorted.length) - 1,
    ),
  );
  return sorted[rank];
}

export function aggregateAIPlayerTournamentResults(
  games: readonly AIPlayerTournamentGameResult[],
): AIPlayerTournamentAggregate[] {
  const competitorIds = [
    ...new Set(
      games.flatMap((game) =>
        game.competitors.map((competitor) => competitor.competitorId),
      ),
    ),
  ];

  return competitorIds.map((competitorId) => {
    const appearances = games.flatMap((game) => {
      const competitor = game.competitors.find(
        (candidate) => candidate.competitorId === competitorId,
      );
      if (competitor === undefined) return [];
      const opponentScores = game.competitors
        .filter((candidate) => candidate.competitorId !== competitorId)
        .map((candidate) => candidate.finalScore);
      return [
        {
          game,
          competitor,
          scoreMarginVsField: mean(opponentScores) - competitor.finalScore,
        },
      ];
    });
    const completedAppearances = appearances.filter(
      (appearance) => appearance.game.completed,
    );
    const totalTurns = appearances.reduce(
      (total, appearance) => total + appearance.competitor.turns,
      0,
    );
    const totalCompletedTurns = appearances.reduce(
      (total, appearance) => total + appearance.competitor.completedTurns,
      0,
    );
    const totalLegalTurns = appearances.reduce(
      (total, appearance) => total + appearance.competitor.legalTurns,
      0,
    );
    const mayICallOpportunityCount = appearances.reduce(
      (total, appearance) =>
        total + appearance.competitor.mayICallOpportunities,
      0,
    );
    const mayICallCallCount = appearances.reduce(
      (total, appearance) => total + appearance.competitor.mayICallCalls,
      0,
    );
    const mayICallPassCount = appearances.reduce(
      (total, appearance) => total + appearance.competitor.mayICallPasses,
      0,
    );
    const mayICallIncompleteCount = appearances.reduce(
      (total, appearance) => total + appearance.competitor.mayICallIncomplete,
      0,
    );
    const unknownCostDecisionCount = appearances.reduce(
      (total, appearance) =>
        total + appearance.competitor.unknownCostDecisionCount,
      0,
    );
    const totalRounds = appearances.reduce(
      (total, appearance) => total + appearance.game.roundsCompleted,
      0,
    );
    const totalRoundWins = appearances.reduce(
      (total, appearance) => total + appearance.competitor.roundWins,
      0,
    );
    const totalCostUsd = appearances.reduce(
      (total, appearance) => total + appearance.competitor.totalCostUsd,
      0,
    );
    const latencies = appearances.flatMap(
      (appearance) => appearance.competitor.providerLatencyMs,
    );

    return {
      competitorId,
      gameCount: appearances.length,
      completedGameRate:
        appearances.length === 0
          ? 0
          : appearances.filter((appearance) => appearance.game.completed).length /
            appearances.length,
      winRate:
        completedAppearances.length === 0
          ? 0
          : completedAppearances.filter(
                (appearance) => appearance.competitor.placement === 1,
              ).length / completedAppearances.length,
      meanPlacement: mean(
        completedAppearances.map(
          (appearance) => appearance.competitor.placement,
        ),
      ),
      meanFinalScore: mean(
        completedAppearances.map(
          (appearance) => appearance.competitor.finalScore,
        ),
      ),
      meanScoreMarginVsField: mean(
        completedAppearances.map((appearance) => appearance.scoreMarginVsField),
      ),
      roundWinRate: totalRounds === 0 ? 0 : totalRoundWins / totalRounds,
      turnCompletionRate:
        totalTurns === 0 ? 0 : totalCompletedTurns / totalTurns,
      legalTurnRate: totalTurns === 0 ? 0 : totalLegalTurns / totalTurns,
      mayICallOpportunityCount,
      mayICallCallCount,
      mayICallPassCount,
      mayICallIncompleteCount,
      unknownCostDecisionCount,
      providerLatencyMs: {
        p50: percentile(latencies, 50),
        p95: percentile(latencies, 95),
      },
      totalCostUsd,
      costPerTurnUsd:
        totalTurns === 0 || unknownCostDecisionCount > 0
          ? undefined
          : totalCostUsd / totalTurns,
    };
  });
}
