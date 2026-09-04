import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  meanAIPlayerEvalMetric,
  pairedStudentTConfidence95,
} from "./ai-player-eval-statistics";
import type { AIPlayerEvalConfidenceInterval } from "./ai-player-eval-score";
import {
  AI_PLAYER_EVAL_CANDIDATES,
  type AIPlayerEvalCandidateDefinition,
  type AIPlayerEvalCandidateId,
} from "./ai-player-eval-candidates";
import {
  parseAIPlayerEvalCostBudgetSummary,
  type AIPlayerEvalCostBudgetSummary,
} from "./ai-player-eval-cost-budget";
import type { AIPlayerEvalPromptSelection } from "./ai-player-eval-prompt";
import {
  fingerprintAIPlayerEvalModelConfiguration,
  parseAIPlayerEvalModelConfiguration,
} from "./ai-player-model-configuration";
import type {
  AIPlayerTournamentCompetitorGameResult,
  AIPlayerTournamentGameResult,
} from "./ai-player-tournament-score";

export interface AIPlayerTournamentRunComparisonInput {
  runId: string;
  games: AIPlayerTournamentGameResult[];
}

export interface AIPlayerTournamentRunManifest {
  schemaVersion: 2;
  runId: string;
  harnessVersion: string;
  suiteVersion: string;
  startedAt?: string;
  candidates: AIPlayerEvalCandidateDefinition[];
  seeds: string[];
  startingRound: number;
  maxTurns: number;
  seatRotations: Array<[string, string, string]>;
  promptAssignments: Array<{
    candidateId: string;
    prompt: AIPlayerEvalPromptSelection;
  }>;
  costBudget?: {
    policyVersion: string;
    maxCostUsd: number;
    stopBoundary: string;
    costPreference: string;
  };
  pacingDelayMs?: number;
  mayICallScheduling?: {
    timing: string;
    order: string;
    incompleteDecision: string;
  };
  limitations?: string[];
}

export interface AIPlayerTournamentRunArtifact {
  manifest: AIPlayerTournamentRunManifest;
  games: AIPlayerTournamentGameResult[];
  runStatus: AIPlayerEvalCostBudgetSummary;
}

export interface AIPlayerTournamentSeedDifferenceInDifferences {
  seed: string;
  /** Target minus anchor in the baseline run; lower is better. */
  baselineFinalScoreMargin: number;
  /** Target minus anchor in the experiment run; lower is better. */
  experimentFinalScoreMargin: number;
  /** Experiment margin minus baseline margin; negative means improvement. */
  finalScoreDifferenceInDifferences: number;
  /** Target minus anchor in the baseline run; lower is better. */
  baselinePlacementMargin: number;
  /** Target minus anchor in the experiment run; lower is better. */
  experimentPlacementMargin: number;
  /** Experiment margin minus baseline margin; negative means improvement. */
  placementDifferenceInDifferences: number;
}

export interface AIPlayerTournamentAnchorRunComparison {
  anchorCompetitorId: string;
  seeds: AIPlayerTournamentSeedDifferenceInDifferences[];
  /** Mean seed-level difference in differences; negative means improvement. */
  finalScoreDifferenceInDifferences: number;
  finalScoreDifferenceInDifferencesConfidence95: AIPlayerEvalConfidenceInterval;
  /** Mean seed-level difference in differences; negative means improvement. */
  placementDifferenceInDifferences: number;
  placementDifferenceInDifferencesConfidence95: AIPlayerEvalConfidenceInterval;
  scoreImprovementWins: number;
  scoreTies: number;
  scoreRegressionLosses: number;
}

export interface AIPlayerTournamentRunComparison {
  schemaVersion: 1;
  baselineRunId: string;
  experimentRunId: string;
  targetCompetitorId: string;
  anchorCompetitorIds: readonly [string, string];
  confidenceUnit: "duplicate-seed-mean";
  matchedSeedCount: number;
  excludedSeedIds: string[];
  targetOperations: AIPlayerTournamentTargetOperationsComparison;
  anchors: [
    AIPlayerTournamentAnchorRunComparison,
    AIPlayerTournamentAnchorRunComparison,
  ];
}

export interface AIPlayerTournamentTargetOperationalSnapshot {
  scheduledGameCount: number;
  completedGameRate: number;
  decisionCount: number;
  turnCompletionRate: number;
  legalTurnRate: number;
  providerLatencyMs: {
    mean: number | undefined;
    p50: number | undefined;
    p95: number | undefined;
  };
  totalCostUsd: number;
  costPerDecisionUsd: number | undefined;
  unknownCostDecisionCount: number;
}

export interface AIPlayerTournamentTargetOperationsComparison {
  baseline: AIPlayerTournamentTargetOperationalSnapshot;
  experiment: AIPlayerTournamentTargetOperationalSnapshot;
  /** Experiment minus baseline. */
  deltas: {
    completedGameRatePercentagePoints: number;
    turnCompletionRatePercentagePoints: number;
    legalTurnRatePercentagePoints: number;
    decisionCount: number;
    providerLatencyMeanMs: number | undefined;
    providerLatencyP50Ms: number | undefined;
    providerLatencyP95Ms: number | undefined;
    totalCostUsd: number;
    costPerDecisionUsd: number | undefined;
    unknownCostDecisionCount: number;
  };
}

interface CompetitorSeedMeans {
  finalScore: number;
  placement: number;
}

function sortedSeatIndexes(
  appearances: readonly AIPlayerTournamentCompetitorGameResult[],
): number[] {
  return appearances
    .map((appearance) => appearance.seatIndex)
    .sort((left, right) => left - right);
}

function hasCompleteDuplicateSeed(options: {
  input: AIPlayerTournamentRunComparisonInput;
  seed: string;
  competitorIds: readonly [string, string, string];
}): boolean {
  const games = options.input.games.filter(
    (game) => game.seed === options.seed,
  );
  if (games.length !== 3 || games.some((game) => !game.completed)) return false;

  const expectedIds = [...options.competitorIds].sort();
  for (const game of games) {
    if (game.runId !== options.input.runId || game.competitors.length !== 3) {
      return false;
    }
    const actualIds = game.competitors
      .map((competitor) => competitor.competitorId)
      .sort();
    if (
      actualIds.some(
        (competitorId, index) => competitorId !== expectedIds[index],
      )
    ) {
      return false;
    }
  }

  return options.competitorIds.every((competitorId) => {
    const appearances = games.flatMap((game) =>
      game.competitors.filter(
        (competitor) => competitor.competitorId === competitorId,
      ),
    );
    const seats = sortedSeatIndexes(appearances);
    return (
      seats.length === 3 && seats[0] === 0 && seats[1] === 1 && seats[2] === 2
    );
  });
}

function competitorSeedMeans(options: {
  input: AIPlayerTournamentRunComparisonInput;
  seed: string;
  competitorId: string;
}): CompetitorSeedMeans {
  const appearances = options.input.games.flatMap((game) =>
    game.seed === options.seed
      ? game.competitors.filter(
          (competitor) => competitor.competitorId === options.competitorId,
        )
      : [],
  );
  if (appearances.length !== 3) {
    throw new Error(
      `Matched seed ${options.seed} is missing ${options.competitorId}`,
    );
  }
  return {
    finalScore: meanAIPlayerEvalMetric(
      appearances.map((appearance) => appearance.finalScore),
    ),
    placement: meanAIPlayerEvalMetric(
      appearances.map((appearance) => appearance.placement),
    ),
  };
}

function percentile(
  values: readonly number[],
  requestedPercentile: number,
): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(
    0,
    Math.min(
      sorted.length - 1,
      Math.ceil((requestedPercentile / 100) * sorted.length) - 1,
    ),
  );
  return sorted[index];
}

function summarizeTargetOperations(
  input: AIPlayerTournamentRunComparisonInput,
  targetCompetitorId: string,
): AIPlayerTournamentTargetOperationalSnapshot {
  const appearances = input.games.flatMap((game) => {
    const competitor = game.competitors.find(
      (entry) => entry.competitorId === targetCompetitorId,
    );
    return competitor === undefined ? [] : [{ game, competitor }];
  });
  if (appearances.length === 0) {
    throw new Error(
      `Tournament run ${input.runId} has no ${targetCompetitorId} games`,
    );
  }
  const decisionCount = appearances.reduce(
    (total, appearance) => total + appearance.competitor.turns,
    0,
  );
  const completedDecisionCount = appearances.reduce(
    (total, appearance) => total + appearance.competitor.completedTurns,
    0,
  );
  const legalDecisionCount = appearances.reduce(
    (total, appearance) => total + appearance.competitor.legalTurns,
    0,
  );
  const providerLatencies = appearances.flatMap(
    (appearance) => appearance.competitor.providerLatencyMs,
  );
  const totalCostUsd = appearances.reduce(
    (total, appearance) => total + appearance.competitor.totalCostUsd,
    0,
  );
  const unknownCostDecisionCount = appearances.reduce(
    (total, appearance) =>
      total + appearance.competitor.unknownCostDecisionCount,
    0,
  );
  return {
    scheduledGameCount: appearances.length,
    completedGameRate:
      appearances.filter((appearance) => appearance.game.completed).length /
      appearances.length,
    decisionCount,
    turnCompletionRate:
      decisionCount === 0 ? 0 : completedDecisionCount / decisionCount,
    legalTurnRate: decisionCount === 0 ? 0 : legalDecisionCount / decisionCount,
    providerLatencyMs: {
      mean:
        providerLatencies.length === 0
          ? undefined
          : meanAIPlayerEvalMetric(providerLatencies),
      p50: percentile(providerLatencies, 50),
      p95: percentile(providerLatencies, 95),
    },
    totalCostUsd,
    costPerDecisionUsd:
      decisionCount === 0 || unknownCostDecisionCount > 0
        ? undefined
        : totalCostUsd / decisionCount,
    unknownCostDecisionCount,
  };
}

function optionalDelta(
  baseline: number | undefined,
  experiment: number | undefined,
): number | undefined {
  return baseline === undefined || experiment === undefined
    ? undefined
    : experiment - baseline;
}

function compareTargetOperations(options: {
  baseline: AIPlayerTournamentRunComparisonInput;
  experiment: AIPlayerTournamentRunComparisonInput;
  targetCompetitorId: string;
}): AIPlayerTournamentTargetOperationsComparison {
  const baseline = summarizeTargetOperations(
    options.baseline,
    options.targetCompetitorId,
  );
  const experiment = summarizeTargetOperations(
    options.experiment,
    options.targetCompetitorId,
  );
  return {
    baseline,
    experiment,
    deltas: {
      completedGameRatePercentagePoints:
        (experiment.completedGameRate - baseline.completedGameRate) * 100,
      turnCompletionRatePercentagePoints:
        (experiment.turnCompletionRate - baseline.turnCompletionRate) * 100,
      legalTurnRatePercentagePoints:
        (experiment.legalTurnRate - baseline.legalTurnRate) * 100,
      decisionCount: experiment.decisionCount - baseline.decisionCount,
      providerLatencyMeanMs: optionalDelta(
        baseline.providerLatencyMs.mean,
        experiment.providerLatencyMs.mean,
      ),
      providerLatencyP50Ms: optionalDelta(
        baseline.providerLatencyMs.p50,
        experiment.providerLatencyMs.p50,
      ),
      providerLatencyP95Ms: optionalDelta(
        baseline.providerLatencyMs.p95,
        experiment.providerLatencyMs.p95,
      ),
      totalCostUsd: experiment.totalCostUsd - baseline.totalCostUsd,
      costPerDecisionUsd: optionalDelta(
        baseline.costPerDecisionUsd,
        experiment.costPerDecisionUsd,
      ),
      unknownCostDecisionCount:
        experiment.unknownCostDecisionCount - baseline.unknownCostDecisionCount,
    },
  };
}

function compareAnchor(options: {
  baseline: AIPlayerTournamentRunComparisonInput;
  experiment: AIPlayerTournamentRunComparisonInput;
  matchedSeedIds: readonly string[];
  targetCompetitorId: string;
  anchorCompetitorId: string;
}): AIPlayerTournamentAnchorRunComparison {
  const seeds = options.matchedSeedIds.map((seed) => {
    const baselineTarget = competitorSeedMeans({
      input: options.baseline,
      seed,
      competitorId: options.targetCompetitorId,
    });
    const baselineAnchor = competitorSeedMeans({
      input: options.baseline,
      seed,
      competitorId: options.anchorCompetitorId,
    });
    const experimentTarget = competitorSeedMeans({
      input: options.experiment,
      seed,
      competitorId: options.targetCompetitorId,
    });
    const experimentAnchor = competitorSeedMeans({
      input: options.experiment,
      seed,
      competitorId: options.anchorCompetitorId,
    });
    const baselineFinalScoreMargin =
      baselineTarget.finalScore - baselineAnchor.finalScore;
    const experimentFinalScoreMargin =
      experimentTarget.finalScore - experimentAnchor.finalScore;
    const baselinePlacementMargin =
      baselineTarget.placement - baselineAnchor.placement;
    const experimentPlacementMargin =
      experimentTarget.placement - experimentAnchor.placement;
    return {
      seed,
      baselineFinalScoreMargin,
      experimentFinalScoreMargin,
      finalScoreDifferenceInDifferences:
        experimentFinalScoreMargin - baselineFinalScoreMargin,
      baselinePlacementMargin,
      experimentPlacementMargin,
      placementDifferenceInDifferences:
        experimentPlacementMargin - baselinePlacementMargin,
    };
  });
  const finalScoreDeltas = seeds.map(
    (seed) => seed.finalScoreDifferenceInDifferences,
  );
  const placementDeltas = seeds.map(
    (seed) => seed.placementDifferenceInDifferences,
  );
  return {
    anchorCompetitorId: options.anchorCompetitorId,
    seeds,
    finalScoreDifferenceInDifferences: meanAIPlayerEvalMetric(finalScoreDeltas),
    finalScoreDifferenceInDifferencesConfidence95:
      pairedStudentTConfidence95(finalScoreDeltas),
    placementDifferenceInDifferences: meanAIPlayerEvalMetric(placementDeltas),
    placementDifferenceInDifferencesConfidence95: pairedStudentTConfidence95(
      placementDeltas,
      { lower: -4, upper: 4 },
    ),
    scoreImprovementWins: finalScoreDeltas.filter((delta) => delta < 0).length,
    scoreTies: finalScoreDeltas.filter((delta) => delta === 0).length,
    scoreRegressionLosses: finalScoreDeltas.filter((delta) => delta > 0).length,
  };
}

export function compareAIPlayerTournamentRuns(options: {
  baseline: AIPlayerTournamentRunComparisonInput;
  experiment: AIPlayerTournamentRunComparisonInput;
  targetCompetitorId: string;
  anchorCompetitorIds: readonly [string, string];
}): AIPlayerTournamentRunComparison {
  const [firstAnchorId, secondAnchorId] = options.anchorCompetitorIds;
  if (firstAnchorId === secondAnchorId) {
    throw new Error("Tournament run comparison requires two distinct anchors");
  }
  if (
    options.targetCompetitorId === firstAnchorId ||
    options.targetCompetitorId === secondAnchorId
  ) {
    throw new Error("Tournament anchors must be distinct from the target");
  }
  const competitorIds: readonly [string, string, string] = [
    options.targetCompetitorId,
    firstAnchorId,
    secondAnchorId,
  ];
  const seedIds = [
    ...new Set([
      ...options.baseline.games.map((game) => game.seed),
      ...options.experiment.games.map((game) => game.seed),
    ]),
  ];
  const matchedSeedIds: string[] = [];
  const excludedSeedIds: string[] = [];
  for (const seed of seedIds) {
    const matched =
      hasCompleteDuplicateSeed({
        input: options.baseline,
        seed,
        competitorIds,
      }) &&
      hasCompleteDuplicateSeed({
        input: options.experiment,
        seed,
        competitorIds,
      });
    (matched ? matchedSeedIds : excludedSeedIds).push(seed);
  }
  if (matchedSeedIds.length === 0) {
    throw new Error(
      "Tournament run comparison has no complete matched duplicate seeds",
    );
  }

  return {
    schemaVersion: 1,
    baselineRunId: options.baseline.runId,
    experimentRunId: options.experiment.runId,
    targetCompetitorId: options.targetCompetitorId,
    anchorCompetitorIds: [firstAnchorId, secondAnchorId],
    confidenceUnit: "duplicate-seed-mean",
    matchedSeedCount: matchedSeedIds.length,
    excludedSeedIds,
    targetOperations: compareTargetOperations({
      baseline: options.baseline,
      experiment: options.experiment,
      targetCompetitorId: options.targetCompetitorId,
    }),
    anchors: [
      compareAnchor({
        baseline: options.baseline,
        experiment: options.experiment,
        matchedSeedIds,
        targetCompetitorId: options.targetCompetitorId,
        anchorCompetitorId: firstAnchorId,
      }),
      compareAnchor({
        baseline: options.baseline,
        experiment: options.experiment,
        matchedSeedIds,
        targetCompetitorId: options.targetCompetitorId,
        anchorCompetitorId: secondAnchorId,
      }),
    ],
  };
}

function equalOrderedValues(
  left: readonly unknown[],
  right: readonly unknown[],
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function validateCompleteArtifact(
  artifact: AIPlayerTournamentRunArtifact,
  role: "baseline" | "experiment",
): void {
  if (artifact.manifest.schemaVersion !== 2) {
    throw new Error(`${role} tournament manifest schema must be 2`);
  }
  if (artifact.runStatus.status !== "completed") {
    throw new Error(
      `${role} run is not complete: ${artifact.runStatus.status}`,
    );
  }
  if (artifact.runStatus.unknownCostResultCount !== 0) {
    throw new Error(`${role} run contains unknown cost results`);
  }
  if (
    artifact.runStatus.plannedUnitCount !== artifact.manifest.seeds.length ||
    artifact.runStatus.completedUnitCount !== artifact.manifest.seeds.length
  ) {
    throw new Error(`${role} run status does not cover every planned seed`);
  }
  const expectedGameCount = artifact.manifest.seeds.length * 3;
  if (
    artifact.runStatus.plannedResultCount !== expectedGameCount ||
    artifact.runStatus.executedResultCount !== expectedGameCount ||
    artifact.games.length !== expectedGameCount
  ) {
    throw new Error(`${role} run status does not cover every seat rotation`);
  }
  if (
    artifact.games.some(
      (game) =>
        game.schemaVersion !== 3 || game.runId !== artifact.manifest.runId,
    )
  ) {
    throw new Error(`${role} game rows do not match their manifest`);
  }

  const candidateIds = artifact.manifest.candidates.map(
    (candidate) => candidate.id,
  );
  if (
    candidateIds.length !== 3 ||
    new Set(candidateIds).size !== candidateIds.length ||
    candidateIds.some((candidateId) => !candidateId.startsWith("spark-"))
  ) {
    throw new Error(
      `${role} tournament must contain three distinct Spark candidates`,
    );
  }
  const assignmentIds = artifact.manifest.promptAssignments.map(
    (assignment) => assignment.candidateId,
  );
  if (!equalOrderedValues(candidateIds, assignmentIds)) {
    throw new Error(`${role} prompt assignments must match candidate order`);
  }
  for (const candidate of artifact.manifest.candidates) {
    if (
      candidate.modelConfigurationSha256 !==
      fingerprintAIPlayerEvalModelConfiguration(candidate.modelConfiguration)
    ) {
      throw new Error(
        `${role} candidate ${candidate.id} has an invalid model configuration fingerprint`,
      );
    }
    const assignment = artifact.manifest.promptAssignments.find(
      (entry) => entry.candidateId === candidate.id,
    );
    if (
      assignment === undefined ||
      candidate.promptVersion !== assignment.prompt.version
    ) {
      throw new Error(
        `${role} candidate ${candidate.id} does not match its prompt assignment`,
      );
    }
    const promptSha256 = new Bun.CryptoHasher("sha256")
      .update(assignment.prompt.content)
      .digest("hex");
    if (promptSha256 !== assignment.prompt.sha256) {
      throw new Error(
        `${role} candidate ${candidate.id} has an invalid prompt fingerprint`,
      );
    }
    if (assignment.prompt.experiment === null) {
      if (
        assignment.prompt.baseVersion !== assignment.prompt.version ||
        assignment.prompt.baseSha256 !== assignment.prompt.sha256
      ) {
        throw new Error(
          `${role} candidate ${candidate.id} has inconsistent base prompt metadata`,
        );
      }
    } else {
      const experimentSha256 = new Bun.CryptoHasher("sha256")
        .update(assignment.prompt.experiment.content)
        .digest("hex");
      if (experimentSha256 !== assignment.prompt.experiment.sha256) {
        throw new Error(
          `${role} candidate ${candidate.id} has an invalid prompt experiment fingerprint`,
        );
      }
    }
  }
}

function requireMatchedTournamentDesign(options: {
  baseline: AIPlayerTournamentRunArtifact;
  experiment: AIPlayerTournamentRunArtifact;
}): void {
  const baseline = options.baseline.manifest;
  const experiment = options.experiment.manifest;
  if (baseline.harnessVersion !== experiment.harnessVersion) {
    throw new Error("Tournament runs must use the same harness version");
  }
  if (baseline.suiteVersion !== experiment.suiteVersion) {
    throw new Error("Tournament runs must use the same suite version");
  }
  if (!equalOrderedValues(baseline.seeds, experiment.seeds)) {
    throw new Error("Tournament runs must use the same ordered seeds");
  }
  if (
    baseline.startingRound !== experiment.startingRound ||
    baseline.maxTurns !== experiment.maxTurns
  ) {
    throw new Error("Tournament runs must use the same round and turn limits");
  }
  if (!equalOrderedValues(baseline.seatRotations, experiment.seatRotations)) {
    throw new Error("Tournament runs must use the same seat rotations");
  }
  const baselineCandidateIds = baseline.candidates.map(
    (candidate) => candidate.id,
  );
  const experimentCandidateIds = experiment.candidates.map(
    (candidate) => candidate.id,
  );
  if (!equalOrderedValues(baselineCandidateIds, experimentCandidateIds)) {
    throw new Error("Tournament runs must use the same ordered candidates");
  }
  for (const baselineCandidate of baseline.candidates) {
    const experimentCandidate = experiment.candidates.find(
      (candidate) => candidate.id === baselineCandidate.id,
    );
    if (
      experimentCandidate === undefined ||
      experimentCandidate.role !== baselineCandidate.role ||
      experimentCandidate.modelId !== baselineCandidate.modelId ||
      experimentCandidate.provider !== baselineCandidate.provider ||
      experimentCandidate.reasoningEffort !==
        baselineCandidate.reasoningEffort ||
      JSON.stringify(experimentCandidate.pricing) !==
        JSON.stringify(baselineCandidate.pricing)
    ) {
      throw new Error(
        `Tournament candidate identity changed for ${baselineCandidate.id}`,
      );
    }
    if (
      experimentCandidate.modelConfigurationSha256 !==
      baselineCandidate.modelConfigurationSha256
    ) {
      throw new Error(
        `Tournament model configuration changed for ${baselineCandidate.id}`,
      );
    }
  }
}

function inferPromptExperimentTarget(options: {
  baseline: AIPlayerTournamentRunArtifact;
  experiment: AIPlayerTournamentRunArtifact;
}): string {
  const baselineAssignments = options.baseline.manifest.promptAssignments;
  const experimentAssignments = options.experiment.manifest.promptAssignments;
  if (
    baselineAssignments.some(
      (assignment) => assignment.prompt.experiment !== null,
    )
  ) {
    throw new Error("Baseline tournament must not contain a prompt experiment");
  }
  const changedIds = baselineAssignments.flatMap((baselineAssignment) => {
    const experimentAssignment = experimentAssignments.find(
      (assignment) => assignment.candidateId === baselineAssignment.candidateId,
    );
    if (experimentAssignment === undefined) return [];
    return experimentAssignment.prompt.sha256 ===
      baselineAssignment.prompt.sha256
      ? []
      : [baselineAssignment.candidateId];
  });
  if (changedIds.length !== 1) {
    throw new Error(
      "Experiment tournament must change exactly one prompt assignment",
    );
  }
  const targetId = changedIds[0];
  if (targetId === undefined) {
    throw new Error("Experiment tournament has no prompt target");
  }
  const baselinePrompt = baselineAssignments.find(
    (assignment) => assignment.candidateId === targetId,
  )?.prompt;
  const experimentPrompt = experimentAssignments.find(
    (assignment) => assignment.candidateId === targetId,
  )?.prompt;
  if (
    baselinePrompt === undefined ||
    experimentPrompt === undefined ||
    experimentPrompt.experiment === null ||
    experimentPrompt.baseVersion !== baselinePrompt.version ||
    experimentPrompt.baseSha256 !== baselinePrompt.sha256
  ) {
    throw new Error(
      "Experiment target must be one addendum over the exact baseline prompt",
    );
  }
  return targetId;
}

export function compareAIPlayerTournamentRunArtifacts(options: {
  baseline: AIPlayerTournamentRunArtifact;
  experiment: AIPlayerTournamentRunArtifact;
}): AIPlayerTournamentRunComparison {
  validateCompleteArtifact(options.baseline, "baseline");
  validateCompleteArtifact(options.experiment, "experiment");
  requireMatchedTournamentDesign(options);
  const targetCompetitorId = inferPromptExperimentTarget(options);
  const anchorIds = options.baseline.manifest.candidates
    .map((candidate) => candidate.id)
    .filter((candidateId) => candidateId !== targetCompetitorId);
  const firstAnchorId = anchorIds[0];
  const secondAnchorId = anchorIds[1];
  if (firstAnchorId === undefined || secondAnchorId === undefined) {
    throw new Error("Tournament comparison requires two unchanged anchors");
  }
  return compareAIPlayerTournamentRuns({
    baseline: {
      runId: options.baseline.manifest.runId,
      games: options.baseline.games,
    },
    experiment: {
      runId: options.experiment.manifest.runId,
      games: options.experiment.games,
    },
    targetCompetitorId,
    anchorCompetitorIds: [firstAnchorId, secondAnchorId],
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(
  value: Record<string, unknown>,
  key: string,
  context: string,
): string {
  const result = value[key];
  if (typeof result !== "string" || result.length === 0) {
    throw new Error(`${context}.${key} must be a non-empty string`);
  }
  return result;
}

function requireFiniteNumber(
  value: Record<string, unknown>,
  key: string,
  context: string,
): number {
  const result = value[key];
  if (typeof result !== "number" || !Number.isFinite(result)) {
    throw new Error(`${context}.${key} must be a finite number`);
  }
  return result;
}

function parsePromptSelection(
  value: unknown,
  context: string,
): AIPlayerEvalPromptSelection {
  if (!isRecord(value)) throw new Error(`${context} must be an object`);
  const experimentValue = value.experiment;
  let experiment: AIPlayerEvalPromptSelection["experiment"];
  if (experimentValue === null) {
    experiment = null;
  } else {
    if (!isRecord(experimentValue)) {
      throw new Error(`${context}.experiment must be an object or null`);
    }
    experiment = {
      id: requireString(experimentValue, "id", `${context}.experiment`),
      sourcePath: requireString(
        experimentValue,
        "sourcePath",
        `${context}.experiment`,
      ),
      sha256: requireString(experimentValue, "sha256", `${context}.experiment`),
      content: requireString(
        experimentValue,
        "content",
        `${context}.experiment`,
      ),
    };
  }
  return {
    version: requireString(value, "version", context),
    sha256: requireString(value, "sha256", context),
    content: requireString(value, "content", context),
    baseVersion: requireString(value, "baseVersion", context),
    baseSha256: requireString(value, "baseSha256", context),
    experiment,
  };
}

function parsePricing(
  value: unknown,
  context: string,
): AIPlayerEvalCandidateDefinition["pricing"] {
  if (!isRecord(value)) throw new Error(`${context} must be an object`);
  return {
    noCacheInputPerMillionUsd: requireFiniteNumber(
      value,
      "noCacheInputPerMillionUsd",
      context,
    ),
    cacheReadInputPerMillionUsd: requireFiniteNumber(
      value,
      "cacheReadInputPerMillionUsd",
      context,
    ),
    cacheWriteInputPerMillionUsd: requireFiniteNumber(
      value,
      "cacheWriteInputPerMillionUsd",
      context,
    ),
    outputPerMillionUsd: requireFiniteNumber(
      value,
      "outputPerMillionUsd",
      context,
    ),
  };
}

function parseCandidateDefinition(
  value: unknown,
  context: string,
): AIPlayerEvalCandidateDefinition {
  if (!isRecord(value)) throw new Error(`${context} must be an object`);
  const id = requireString(value, "id", context);
  if (!(id in AI_PLAYER_EVAL_CANDIDATES)) {
    throw new Error(`${context}.id is not a known evaluation candidate`);
  }
  if (value.role !== "baseline" && value.role !== "hill-climb") {
    throw new Error(`${context}.role is invalid`);
  }
  const modelConfiguration = parseAIPlayerEvalModelConfiguration(
    value.modelConfiguration,
    `${context}.modelConfiguration`,
  );
  return {
    id: id as AIPlayerEvalCandidateId,
    role: value.role,
    modelId: requireString(value, "modelId", context),
    provider: requireString(value, "provider", context),
    reasoningEffort: requireString(value, "reasoningEffort", context),
    promptVersion: requireString(value, "promptVersion", context),
    pricing: parsePricing(value.pricing, `${context}.pricing`),
    modelConfiguration,
    modelConfigurationSha256: requireString(
      value,
      "modelConfigurationSha256",
      context,
    ),
  };
}

function parseTournamentManifest(
  value: unknown,
): AIPlayerTournamentRunManifest {
  if (!isRecord(value) || value.schemaVersion !== 2) {
    throw new Error("manifest.schemaVersion must be 2");
  }
  if (!Array.isArray(value.candidates) || value.candidates.length !== 3) {
    throw new Error("manifest.candidates must contain three entries");
  }
  if (
    !Array.isArray(value.seeds) ||
    value.seeds.length === 0 ||
    value.seeds.some((seed) => typeof seed !== "string" || seed.length === 0)
  ) {
    throw new Error("manifest.seeds must be a non-empty string array");
  }
  if (!Array.isArray(value.seatRotations) || value.seatRotations.length !== 3) {
    throw new Error("manifest.seatRotations must contain three rotations");
  }
  const seatRotations = value.seatRotations.map((rotation, index) => {
    if (
      !Array.isArray(rotation) ||
      rotation.length !== 3 ||
      rotation.some((candidateId) => typeof candidateId !== "string")
    ) {
      throw new Error(`manifest.seatRotations[${index}] is invalid`);
    }
    const first = rotation[0];
    const second = rotation[1];
    const third = rotation[2];
    if (
      typeof first !== "string" ||
      typeof second !== "string" ||
      typeof third !== "string"
    ) {
      throw new Error(`manifest.seatRotations[${index}] is invalid`);
    }
    return [first, second, third] satisfies [string, string, string];
  });
  if (
    !Array.isArray(value.promptAssignments) ||
    value.promptAssignments.length !== 3
  ) {
    throw new Error("manifest.promptAssignments must contain three entries");
  }
  const startingRound = requireFiniteNumber(value, "startingRound", "manifest");
  const maxTurns = requireFiniteNumber(value, "maxTurns", "manifest");
  if (
    !Number.isInteger(startingRound) ||
    startingRound < 1 ||
    startingRound > 6
  ) {
    throw new Error(
      "manifest.startingRound must be an integer from 1 through 6",
    );
  }
  if (!Number.isInteger(maxTurns) || maxTurns <= 0) {
    throw new Error("manifest.maxTurns must be a positive integer");
  }
  return {
    schemaVersion: 2,
    runId: requireString(value, "runId", "manifest"),
    harnessVersion: requireString(value, "harnessVersion", "manifest"),
    suiteVersion: requireString(value, "suiteVersion", "manifest"),
    candidates: value.candidates.map((candidate, index) =>
      parseCandidateDefinition(candidate, `manifest.candidates[${index}]`),
    ),
    seeds: value.seeds as string[],
    startingRound,
    maxTurns,
    seatRotations,
    promptAssignments: value.promptAssignments.map((assignment, index) => {
      if (!isRecord(assignment)) {
        throw new Error(
          `manifest.promptAssignments[${index}] must be an object`,
        );
      }
      return {
        candidateId: requireString(
          assignment,
          "candidateId",
          `manifest.promptAssignments[${index}]`,
        ),
        prompt: parsePromptSelection(
          assignment.prompt,
          `manifest.promptAssignments[${index}].prompt`,
        ),
      };
    }),
  };
}

function isFiniteNumberArray(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.every((entry) => typeof entry === "number" && Number.isFinite(entry))
  );
}

function isTournamentCompetitorResult(
  value: unknown,
): value is AIPlayerTournamentCompetitorGameResult {
  if (!isRecord(value)) return false;
  const stringKeys = ["competitorId", "playerId"] as const;
  const numberKeys = [
    "seatIndex",
    "finalScore",
    "placement",
    "roundWins",
    "turns",
    "completedTurns",
    "legalTurns",
    "mayICallOpportunities",
    "mayICallCalls",
    "mayICallPasses",
    "mayICallIncomplete",
    "unknownCostDecisionCount",
    "totalCostUsd",
  ] as const;
  return (
    stringKeys.every((key) => typeof value[key] === "string") &&
    numberKeys.every(
      (key) => typeof value[key] === "number" && Number.isFinite(value[key]),
    ) &&
    isFiniteNumberArray(value.providerLatencyMs)
  );
}

function isTournamentGameResult(
  value: unknown,
): value is AIPlayerTournamentGameResult {
  return (
    isRecord(value) &&
    value.schemaVersion === 3 &&
    typeof value.runId === "string" &&
    typeof value.gameId === "string" &&
    typeof value.seed === "string" &&
    typeof value.completed === "boolean" &&
    typeof value.roundsCompleted === "number" &&
    Number.isFinite(value.roundsCompleted) &&
    typeof value.turns === "number" &&
    Number.isFinite(value.turns) &&
    (value.failure === undefined || typeof value.failure === "string") &&
    Array.isArray(value.competitors) &&
    value.competitors.every(isTournamentCompetitorResult)
  );
}

export function parseAIPlayerTournamentGameResults(
  gamesText: string,
): AIPlayerTournamentGameResult[] {
  return gamesText
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line, index) => {
      const value = JSON.parse(line) as unknown;
      if (!isTournamentGameResult(value)) {
        throw new Error(`games.jsonl line ${index + 1} is invalid`);
      }
      return value;
    });
}

export async function loadAIPlayerTournamentRunArtifact(
  directory: string,
): Promise<AIPlayerTournamentRunArtifact> {
  const [manifestText, gamesText, runStatusText] = await Promise.all([
    readFile(join(directory, "manifest.json"), "utf8"),
    readFile(join(directory, "games.jsonl"), "utf8"),
    readFile(join(directory, "run-status.json"), "utf8"),
  ]);
  return {
    manifest: parseTournamentManifest(JSON.parse(manifestText) as unknown),
    games: parseAIPlayerTournamentGameResults(gamesText),
    runStatus: parseAIPlayerEvalCostBudgetSummary(
      JSON.parse(runStatusText) as unknown,
    ),
  };
}

function signed(value: number, digits = 1): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
}

function interval(value: AIPlayerEvalConfidenceInterval, digits = 1): string {
  return `${signed(value.lower, digits)} to ${signed(value.upper, digits)}`;
}

function optionalMetric(value: number | undefined, digits = 1): string {
  return value === undefined ? "n/a" : value.toFixed(digits);
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatAIPlayerTournamentRunComparisonMarkdown(
  comparison: AIPlayerTournamentRunComparison,
): string {
  const rows = comparison.anchors.map((anchor) =>
    [
      anchor.anchorCompetitorId,
      signed(anchor.finalScoreDifferenceInDifferences),
      interval(anchor.finalScoreDifferenceInDifferencesConfidence95),
      signed(anchor.placementDifferenceInDifferences, 2),
      interval(anchor.placementDifferenceInDifferencesConfidence95, 2),
      `${anchor.scoreImprovementWins}-${anchor.scoreTies}-${anchor.scoreRegressionLosses}`,
    ].join(" | "),
  );
  const operations = comparison.targetOperations;
  const operationRows = [
    [
      "Baseline",
      percent(operations.baseline.completedGameRate),
      operations.baseline.decisionCount,
      percent(operations.baseline.turnCompletionRate),
      percent(operations.baseline.legalTurnRate),
      optionalMetric(operations.baseline.providerLatencyMs.mean, 0),
      optionalMetric(operations.baseline.providerLatencyMs.p50, 0),
      optionalMetric(operations.baseline.providerLatencyMs.p95, 0),
      `$${operations.baseline.totalCostUsd.toFixed(6)}`,
      operations.baseline.costPerDecisionUsd === undefined
        ? "n/a"
        : `$${operations.baseline.costPerDecisionUsd.toFixed(6)}`,
      operations.baseline.unknownCostDecisionCount,
    ],
    [
      "Experiment",
      percent(operations.experiment.completedGameRate),
      operations.experiment.decisionCount,
      percent(operations.experiment.turnCompletionRate),
      percent(operations.experiment.legalTurnRate),
      optionalMetric(operations.experiment.providerLatencyMs.mean, 0),
      optionalMetric(operations.experiment.providerLatencyMs.p50, 0),
      optionalMetric(operations.experiment.providerLatencyMs.p95, 0),
      `$${operations.experiment.totalCostUsd.toFixed(6)}`,
      operations.experiment.costPerDecisionUsd === undefined
        ? "n/a"
        : `$${operations.experiment.costPerDecisionUsd.toFixed(6)}`,
      operations.experiment.unknownCostDecisionCount,
    ],
    [
      "Delta",
      `${signed(operations.deltas.completedGameRatePercentagePoints)} pp`,
      signed(operations.deltas.decisionCount, 0),
      `${signed(operations.deltas.turnCompletionRatePercentagePoints)} pp`,
      `${signed(operations.deltas.legalTurnRatePercentagePoints)} pp`,
      optionalMetric(operations.deltas.providerLatencyMeanMs, 0),
      optionalMetric(operations.deltas.providerLatencyP50Ms, 0),
      optionalMetric(operations.deltas.providerLatencyP95Ms, 0),
      `$${signed(operations.deltas.totalCostUsd, 6)}`,
      operations.deltas.costPerDecisionUsd === undefined
        ? "n/a"
        : `$${signed(operations.deltas.costPerDecisionUsd, 6)}`,
      signed(operations.deltas.unknownCostDecisionCount, 0),
    ],
  ].map((row) => row.join(" | "));
  return [
    "# AI Player Tournament Prompt Comparison",
    "",
    `Baseline run: \`${comparison.baselineRunId}\``,
    `Experiment run: \`${comparison.experimentRunId}\``,
    `Target: \`${comparison.targetCompetitorId}\``,
    `Matched duplicate seeds: ${comparison.matchedSeedCount}`,
    `Excluded seeds: ${comparison.excludedSeedIds.length === 0 ? "none" : comparison.excludedSeedIds.join(", ")}`,
    "",
    "Anchor | Score difference in differences | Score 95% CI | Placement difference in differences | Placement 95% CI | Improvement-Tie-Regression",
    "--- | ---: | ---: | ---: | ---: | ---:",
    ...rows,
    "",
    "Difference in differences is (experimental target minus anchor) minus (baseline target minus anchor), averaged within each deal across all three seats. Negative values mean the experimental prompt improved relative to the unchanged anchor.",
    "",
    "This is a descriptive checkpoint for whole-game behavior. The repeated fixed-state suite remains the promotion gate; time and cost must be reviewed separately and cannot rescue weaker gameplay.",
    "",
    "## Target reliability, provider time, and cost",
    "",
    "Run | Games complete | Decisions | Turn complete | Legal | Provider mean ms | Provider p50 ms | Provider p95 ms | Observed cost | Cost/decision | Unknown cost decisions",
    "--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---:",
    ...operationRows,
    "",
  ].join("\n");
}

interface AIPlayerTournamentRunComparisonCliOptions {
  baselineDirectory: string;
  experimentDirectory: string;
}

function nextArgument(
  args: readonly string[],
  index: number,
  flag: string,
): string {
  const value = args[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

export function parseAIPlayerTournamentRunComparisonArguments(
  args: readonly string[],
): AIPlayerTournamentRunComparisonCliOptions {
  let baselineDirectory: string | undefined;
  let experimentDirectory: string | undefined;
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === "--baseline") {
      baselineDirectory = nextArgument(args, index, argument);
      index++;
      continue;
    }
    if (argument === "--experiment") {
      experimentDirectory = nextArgument(args, index, argument);
      index++;
      continue;
    }
    throw new Error(`Unknown tournament comparison argument: ${argument}`);
  }
  if (baselineDirectory === undefined || experimentDirectory === undefined) {
    throw new Error("--baseline and --experiment are required");
  }
  return { baselineDirectory, experimentDirectory };
}

if (import.meta.main) {
  try {
    const options = parseAIPlayerTournamentRunComparisonArguments(
      Bun.argv.slice(2),
    );
    const [baseline, experiment] = await Promise.all([
      loadAIPlayerTournamentRunArtifact(options.baselineDirectory),
      loadAIPlayerTournamentRunArtifact(options.experimentDirectory),
    ]);
    const comparison = compareAIPlayerTournamentRunArtifacts({
      baseline,
      experiment,
    });
    const markdown = formatAIPlayerTournamentRunComparisonMarkdown(comparison);
    await Promise.all([
      writeFile(
        join(options.experimentDirectory, "tournament-run-comparison.json"),
        JSON.stringify(comparison, null, 2),
      ),
      writeFile(
        join(options.experimentDirectory, "tournament-run-comparison.md"),
        markdown,
      ),
    ]);
    console.log(markdown);
    console.log(`Artifacts: ${options.experimentDirectory}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
