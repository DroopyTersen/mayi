import { appendFile, writeFile } from "node:fs/promises";
import type { LanguageModel } from "ai";
import { GameEngine } from "../../core/engine/game-engine";
import type { RoundNumber } from "../../core/engine/engine.types";
import { executeTurn, type ExecuteTurnResult } from "../mayIAgent";
import {
  executeMayICallDecision,
  getEligibleMayICallerIds,
  type ExecuteMayICallDecisionResult,
} from "../mayIAgent.may-i-call";
import { buildSystemPrompt } from "../mayIAgent.prompt";
import type { GameSnapshot } from "../../core/engine/game-engine.types";
import {
  AI_PLAYER_EVAL_CANDIDATES,
  type AIPlayerEvalCandidateDefinition,
  type AIPlayerEvalCandidateId,
} from "./ai-player-eval-candidates";
import {
  AI_PLAYER_EVAL_COST_BUDGET_POLICY_VERSION,
  DEFAULT_AI_PLAYER_EVAL_MAX_COST_USD,
  completeAIPlayerEvalCostBudgetUnit,
  createAIPlayerEvalCostBudget,
  parseAIPlayerEvalMaxCostUsd,
  recordAIPlayerEvalCost,
  shouldStartAIPlayerEvalCostBudgetUnit,
  summarizeAIPlayerEvalCostBudget,
  type AIPlayerEvalCostBudgetSummary,
} from "./ai-player-eval-cost-budget";
import {
  reconstructAIPlayerEvalCostUsd,
  type AIPlayerEvalTokenPricing,
  type AIPlayerEvalUsage,
} from "./ai-player-eval-score";
import {
  loadAIPlayerEvalPromptSelection,
  validateAIPlayerEvalPromptExperimentArguments,
  type AIPlayerEvalPromptExperimentArguments,
  type AIPlayerEvalPromptSelection,
} from "./ai-player-eval-prompt";
import {
  AI_PLAYER_EVAL_HARNESS_VERSION,
  createAIPlayerEvalModel,
  createAIPlayerEvalRunDirectory,
} from "./ai-player-fixed-state-runner";
import {
  AI_PLAYER_TOURNAMENT_OBSERVATION_VERSION,
  createAIPlayerTournamentHistory,
} from "./ai-player-tournament-history";
import { AI_PLAYER_GAME_ENGINE_RUNTIME_VERSION } from "./ai-player-game-engine-runtime";
import {
  aggregateAIPlayerTournamentResults,
  compareAIPlayerTournamentDuplicateSets,
  createAIPlayerTournamentSeatRotations,
  type AIPlayerTournamentAggregate,
  type AIPlayerTournamentDuplicateSetComparison,
  type AIPlayerTournamentCompetitorGameResult,
  type AIPlayerTournamentGameResult,
} from "./ai-player-tournament-score";
import type { AIPlayerTournamentRunManifest } from "./ai-player-tournament-run-comparison";

const DEFAULT_TOURNAMENT_CANDIDATES = [
  "spark-minimal",
  "spark-medium",
  "spark-xhigh",
] as const satisfies readonly AIPlayerEvalCandidateId[];
const DEFAULT_TOURNAMENT_SEED = "mayi-tournament-v1-seed-1";
export const AI_PLAYER_TOURNAMENT_SUITE_VERSION = "duplicate-tournament-v5";
export const AI_PLAYER_TOURNAMENT_MANIFEST_SCHEMA_VERSION = 2;
export const AI_PLAYER_TOURNAMENT_HARNESS_VERSION =
  `${AI_PLAYER_EVAL_HARNESS_VERSION}+${AI_PLAYER_TOURNAMENT_OBSERVATION_VERSION}+${AI_PLAYER_GAME_ENGINE_RUNTIME_VERSION}`;

export interface AIPlayerTournamentRunnerOptions {
  candidateIds: [
    AIPlayerEvalCandidateId,
    AIPlayerEvalCandidateId,
    AIPlayerEvalCandidateId,
  ];
  seeds: string[];
  startingRound: RoundNumber;
  maxTurns: number;
  runId: string | undefined;
  promptExperiment: AIPlayerEvalPromptExperimentArguments | undefined;
  promptExperimentCandidateId: AIPlayerEvalCandidateId | undefined;
  maxCostUsd: number;
}

export interface AIPlayerTournamentRunSummary {
  schemaVersion: 4;
  runId: string;
  gameCount: number;
  completedGameRate: number;
  competitors: AIPlayerTournamentAggregate[];
  duplicateSetComparisons: AIPlayerTournamentDuplicateSetComparison[];
}

interface TournamentCompetitorAccumulator {
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

function nextValue(
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

function parseCandidateId(value: string): AIPlayerEvalCandidateId {
  if (!(value in AI_PLAYER_EVAL_CANDIDATES)) {
    throw new Error(`Unknown AI player evaluation candidate: ${value}`);
  }
  return value as AIPlayerEvalCandidateId;
}

function parseCandidateTuple(
  value: string,
): AIPlayerTournamentRunnerOptions["candidateIds"] {
  const candidateIds = value.split(",").map(parseCandidateId);
  if (candidateIds.length !== 3 || new Set(candidateIds).size !== 3) {
    throw new Error("Tournament requires exactly three distinct candidates");
  }
  const first = candidateIds[0];
  const second = candidateIds[1];
  const third = candidateIds[2];
  if (first === undefined || second === undefined || third === undefined) {
    throw new Error("Tournament requires exactly three distinct candidates");
  }
  return [first, second, third];
}

function parseSeeds(value: string): string[] {
  const seeds = value.split(",");
  if (
    seeds.length === 0 ||
    seeds.some((seed) => seed.length === 0 || !/^[A-Za-z0-9._-]+$/.test(seed))
  ) {
    throw new Error(
      "Seeds may contain only letters, numbers, dots, dashes, and underscores",
    );
  }
  if (new Set(seeds).size !== seeds.length) {
    throw new Error("Tournament seeds must be distinct");
  }
  return seeds;
}

export function parseAIPlayerTournamentRunnerArguments(
  args: readonly string[],
): AIPlayerTournamentRunnerOptions {
  let candidateIds: AIPlayerTournamentRunnerOptions["candidateIds"] = [
    ...DEFAULT_TOURNAMENT_CANDIDATES,
  ];
  let seeds = [DEFAULT_TOURNAMENT_SEED];
  let startingRound: RoundNumber = 6;
  let maxTurns = 250;
  let runId: string | undefined;
  let promptExperimentId: string | undefined;
  let promptAddendumFile: string | undefined;
  let promptExperimentCandidateId: AIPlayerEvalCandidateId | undefined;
  let maxCostUsd = DEFAULT_AI_PLAYER_EVAL_MAX_COST_USD;

  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === "--candidate") {
      candidateIds = parseCandidateTuple(nextValue(args, index, argument));
      index++;
      continue;
    }
    if (argument === "--seed") {
      seeds = parseSeeds(nextValue(args, index, argument));
      index++;
      continue;
    }
    if (argument === "--starting-round") {
      const value = Number(nextValue(args, index, argument));
      if (!Number.isInteger(value) || value < 1 || value > 6) {
        throw new Error("Starting round must be an integer from 1 through 6");
      }
      startingRound = value as RoundNumber;
      index++;
      continue;
    }
    if (argument === "--max-turns") {
      const value = Number(nextValue(args, index, argument));
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error("Max turns must be a positive integer");
      }
      maxTurns = value;
      index++;
      continue;
    }
    if (argument === "--run-id") {
      const value = nextValue(args, index, argument);
      if (!/^[A-Za-z0-9._-]+$/.test(value)) {
        throw new Error(
          "Run ID may contain only letters, numbers, dots, dashes, and underscores",
        );
      }
      runId = value;
      index++;
      continue;
    }
    if (argument === "--prompt-experiment") {
      promptExperimentId = nextValue(args, index, argument);
      index++;
      continue;
    }
    if (argument === "--prompt-addendum-file") {
      promptAddendumFile = nextValue(args, index, argument);
      index++;
      continue;
    }
    if (argument === "--prompt-experiment-candidate") {
      promptExperimentCandidateId = parseCandidateId(
        nextValue(args, index, argument),
      );
      index++;
      continue;
    }
    if (argument === "--max-cost-usd") {
      maxCostUsd = parseAIPlayerEvalMaxCostUsd(
        nextValue(args, index, argument),
      );
      index++;
      continue;
    }
    throw new Error(`Unknown AI player tournament argument: ${argument}`);
  }

  const promptExperiment = validateAIPlayerEvalPromptExperimentArguments(
    promptExperimentId,
    promptAddendumFile,
  );
  if (
    promptExperiment !== undefined &&
    promptExperimentCandidateId === undefined
  ) {
    throw new Error(
      "--prompt-experiment-candidate is required for tournament prompt experiments",
    );
  }
  if (
    promptExperiment === undefined &&
    promptExperimentCandidateId !== undefined
  ) {
    throw new Error(
      "--prompt-experiment-candidate requires a prompt experiment",
    );
  }
  if (
    promptExperimentCandidateId !== undefined &&
    !candidateIds.includes(promptExperimentCandidateId)
  ) {
    throw new Error(
      "Prompt experiment candidate must be one of the tournament candidates",
    );
  }
  if (
    promptExperiment !== undefined &&
    candidateIds.some(
      (candidateId) =>
        AI_PLAYER_EVAL_CANDIDATES[candidateId].role !== "hill-climb",
    )
  ) {
    throw new Error(
      "Prompt experiments are Spark-only; Luna is a frozen baseline",
    );
  }
  return {
    candidateIds,
    seeds,
    startingRound,
    maxTurns,
    runId,
    promptExperiment,
    promptExperimentCandidateId,
    maxCostUsd,
  };
}

export async function loadAIPlayerTournamentPromptAssignments(options: {
  candidateIds: AIPlayerTournamentRunnerOptions["candidateIds"];
  baseContent: string;
  experiment: AIPlayerEvalPromptExperimentArguments | undefined;
  experimentCandidateId: AIPlayerEvalCandidateId | undefined;
}): Promise<Map<AIPlayerEvalCandidateId, AIPlayerEvalPromptSelection>> {
  const assignments = await Promise.all(
    options.candidateIds.map(async (candidateId) => {
      const selection = await loadAIPlayerEvalPromptSelection({
        baseVersion: AI_PLAYER_EVAL_CANDIDATES[candidateId].promptVersion,
        baseContent: options.baseContent,
        experiment:
          candidateId === options.experimentCandidateId
            ? options.experiment
            : undefined,
      });
      return [candidateId, selection] as const;
    }),
  );
  return new Map(assignments);
}

function createRunId(): string {
  return `tournament-${new Date().toISOString().replace(/[:.]/g, "-")}`;
}

type MeasuredTournamentDecisionResult =
  | ExecuteTurnResult
  | ExecuteMayICallDecisionResult;

function turnUsage(
  result: MeasuredTournamentDecisionResult,
): AIPlayerEvalUsage {
  return {
    inputTokens: result.metrics?.inputTokens,
    noCacheInputTokens: result.metrics?.noCacheInputTokens,
    cacheReadInputTokens: result.metrics?.cacheReadInputTokens,
    cacheWriteInputTokens: result.metrics?.cacheWriteInputTokens,
    outputTokens: result.metrics?.outputTokens,
    reasoningOutputTokens: result.metrics?.reasoningOutputTokens,
    totalTokens: result.metrics?.totalTokens,
  };
}

export function getAIPlayerTournamentDecisionCostUsd(
  result: MeasuredTournamentDecisionResult,
  pricing: AIPlayerEvalTokenPricing,
): number | undefined {
  return (
    result.metrics?.providerReportedCostUsd ??
    reconstructAIPlayerEvalCostUsd(turnUsage(result), pricing)
  );
}

export interface AIPlayerTournamentGameCostSummary {
  observedCostUsd: number;
  unknownCostDecisionCount: number;
}

export function summarizeAIPlayerTournamentGameCost(
  game: AIPlayerTournamentGameResult,
): AIPlayerTournamentGameCostSummary {
  return {
    observedCostUsd: game.competitors.reduce(
      (total, competitor) => total + competitor.totalCostUsd,
      0,
    ),
    unknownCostDecisionCount: game.competitors.reduce(
      (total, competitor) => total + competitor.unknownCostDecisionCount,
      0,
    ),
  };
}

export function getAIPlayerTournamentGameCostUsd(
  game: AIPlayerTournamentGameResult,
): number | undefined {
  const summary = summarizeAIPlayerTournamentGameCost(game);
  if (summary.unknownCostDecisionCount > 0) {
    return undefined;
  }
  return summary.observedCostUsd;
}

function createAccumulator(): TournamentCompetitorAccumulator {
  return {
    turns: 0,
    completedTurns: 0,
    legalTurns: 0,
    mayICallOpportunities: 0,
    mayICallCalls: 0,
    mayICallPasses: 0,
    mayICallIncomplete: 0,
    unknownCostDecisionCount: 0,
    providerLatencyMs: [],
    totalCostUsd: 0,
  };
}

export function getTournamentMayICallDecisionOrder(
  snapshot: GameSnapshot,
): string[] {
  if (
    snapshot.phase !== "ROUND_ACTIVE" ||
    snapshot.turnPhase !== "AWAITING_DRAW"
  ) {
    return [];
  }
  const eligible = new Set(getEligibleMayICallerIds(snapshot));
  const ordered: string[] = [];
  for (let offset = 1; offset < snapshot.players.length; offset++) {
    const index =
      (snapshot.currentPlayerIndex + offset) % snapshot.players.length;
    const playerId = snapshot.players[index]?.id;
    if (playerId !== undefined && eligible.has(playerId)) {
      ordered.push(playerId);
    }
  }
  return ordered;
}

function recordMeasuredDecision(options: {
  result: MeasuredTournamentDecisionResult;
  candidate: AIPlayerEvalCandidateDefinition;
  accumulator: TournamentCompetitorAccumulator;
  legal: boolean;
}): void {
  const { result, candidate, accumulator, legal } = options;
  accumulator.turns++;
  if (result.success) accumulator.completedTurns++;
  if (legal) accumulator.legalTurns++;
  if (result.metrics !== undefined) {
    accumulator.providerLatencyMs.push(result.metrics.providerDurationMs);
  }
  const costUsd = getAIPlayerTournamentDecisionCostUsd(
    result,
    candidate.pricing,
  );
  if (costUsd === undefined) {
    accumulator.unknownCostDecisionCount++;
  } else {
    accumulator.totalCostUsd += costUsd;
  }
}

function competitorResult(options: {
  competitorId: AIPlayerEvalCandidateId;
  seatIndex: number;
  playerId: string;
  finalScore: number;
  allFinalScores: readonly number[];
  roundWinnerIds: readonly string[];
  accumulator: TournamentCompetitorAccumulator;
}): AIPlayerTournamentCompetitorGameResult {
  const {
    competitorId,
    seatIndex,
    playerId,
    finalScore,
    allFinalScores,
    roundWinnerIds,
    accumulator,
  } = options;
  return {
    competitorId,
    seatIndex,
    playerId,
    finalScore,
    placement: 1 + allFinalScores.filter((score) => score < finalScore).length,
    roundWins: roundWinnerIds.filter((winnerId) => winnerId === playerId)
      .length,
    ...accumulator,
  };
}

async function runTournamentGame(options: {
  runId: string;
  gameId: string;
  seed: string;
  seats: [
    AIPlayerEvalCandidateId,
    AIPlayerEvalCandidateId,
    AIPlayerEvalCandidateId,
  ];
  models: ReadonlyMap<AIPlayerEvalCandidateId, LanguageModel>;
  systemPrompts: ReadonlyMap<AIPlayerEvalCandidateId, string>;
  startingRound: RoundNumber;
  maxTurns: number;
}): Promise<AIPlayerTournamentGameResult> {
  const {
    runId,
    gameId,
    seed,
    seats,
    models,
    systemPrompts,
    startingRound,
    maxTurns,
  } = options;
  const engine = GameEngine.createGame({
    gameId,
    playerNames: [...seats],
    startingRound,
    seed,
  });
  const playerIds = seats.map((_, seatIndex) => `player-${seatIndex}`);
  const candidateByPlayerId = new Map(
    playerIds.map((playerId, seatIndex) => [playerId, seats[seatIndex]]),
  );
  const accumulators = new Map(
    seats.map((candidateId) => [candidateId, createAccumulator()]),
  );
  const history = createAIPlayerTournamentHistory(engine);
  let failure: string | undefined;
  let turns = 0;

  try {
    while (engine.getSnapshot().phase !== "GAME_END" && turns < maxTurns) {
      let before = engine.getSnapshot();

      if (
        before.phase === "ROUND_ACTIVE" &&
        before.turnPhase === "AWAITING_DRAW"
      ) {
        const callerIds = getTournamentMayICallDecisionOrder(before);
        for (const callerId of callerIds) {
          if (turns >= maxTurns) {
            failure = `Tournament exceeded ${maxTurns} model decisions`;
            break;
          }
          const decisionSnapshot = engine.getSnapshot();
          if (!getEligibleMayICallerIds(decisionSnapshot).includes(callerId)) {
            continue;
          }
          const callerCandidateId = candidateByPlayerId.get(callerId);
          if (callerCandidateId === undefined) {
            failure = `No tournament candidate controls ${callerId}`;
            break;
          }
          const callerCandidate = AI_PLAYER_EVAL_CANDIDATES[callerCandidateId];
          const callerModel = models.get(callerCandidateId);
          const callerSystemPrompt = systemPrompts.get(callerCandidateId);
          const callerAccumulator = accumulators.get(callerCandidateId);
          const caller = decisionSnapshot.players.find(
            (entry) => entry.id === callerId,
          );
          if (
            callerModel === undefined ||
            callerSystemPrompt === undefined ||
            callerAccumulator === undefined ||
            caller === undefined
          ) {
            failure = `Incomplete tournament assignment for ${callerCandidateId}`;
            break;
          }

          const callState = history.createRuntime(callerId);
          const callResult = await executeMayICallDecision({
            model: callerModel,
            modelId: callerCandidate.modelId,
            runtime: callState.runtime,
            playerId: callerId,
            playerName: caller.name,
            maxRetries: 1,
            debug: false,
            telemetry: false,
            actionLog: history.getActionLog(),
            systemPrompt: callerSystemPrompt,
          });
          turns++;
          callerAccumulator.mayICallOpportunities++;
          if (callResult.decision === "call") {
            callerAccumulator.mayICallCalls++;
          } else if (callResult.decision === "pass") {
            callerAccumulator.mayICallPasses++;
          } else {
            callerAccumulator.mayICallIncomplete++;
          }
          recordMeasuredDecision({
            result: callResult,
            candidate: callerCandidate,
            accumulator: callerAccumulator,
            legal: callState.attempts.every((attempt) => attempt.ok),
          });
          if (callResult.decision === "call") break;
        }
        if (failure !== undefined) break;
        before = engine.getSnapshot();
        if (before.phase === "GAME_END") continue;
        if (turns >= maxTurns) {
          failure = `Tournament exceeded ${maxTurns} model decisions`;
          break;
        }
      }

      const playerId = before.awaitingPlayerId;
      const candidateId = candidateByPlayerId.get(playerId);
      if (candidateId === undefined) {
        failure = `No tournament candidate controls ${playerId}`;
        break;
      }
      const candidate = AI_PLAYER_EVAL_CANDIDATES[candidateId];
      const model = models.get(candidateId);
      const systemPrompt = systemPrompts.get(candidateId);
      const accumulator = accumulators.get(candidateId);
      const player = before.players.find((entry) => entry.id === playerId);
      if (
        model === undefined ||
        systemPrompt === undefined ||
        accumulator === undefined ||
        player === undefined
      ) {
        failure = `Incomplete tournament assignment for ${candidateId}`;
        break;
      }

      const state = history.createRuntime(playerId);
      const result = await executeTurn({
        model,
        modelId: candidate.modelId,
        runtime: state.runtime,
        playerId,
        playerName: player.name,
        maxSteps: 10,
        maxRetries: 1,
        debug: false,
        telemetry: false,
        actionLog: history.getActionLog(),
        systemPrompt,
      });
      turns++;
      recordMeasuredDecision({
        result,
        candidate,
        accumulator,
        legal: state.attempts.every((attempt) => attempt.ok),
      });

      let after = engine.getSnapshot();
      if (
        !result.success &&
        after.phase === "RESOLVING_MAY_I" &&
        after.awaitingPlayerId === playerId
      ) {
        const fallback = await state.runtime.executeAction({
          type: "ALLOW_MAY_I",
        });
        after = fallback.snapshot;
      }
      const decisionResolved =
        after.phase === "GAME_END" ||
        after.awaitingPlayerId !== playerId ||
        (before.phase === "RESOLVING_MAY_I" &&
          after.phase !== "RESOLVING_MAY_I");
      if (!decisionResolved) {
        failure =
          result.error ??
          `${candidateId} did not complete turn ${before.turnNumber}`;
        break;
      }
    }

    const finalSnapshot = engine.getSnapshot();
    if (finalSnapshot.phase !== "GAME_END" && failure === undefined) {
      failure = `Tournament exceeded ${maxTurns} model decisions`;
    }
    const completed = finalSnapshot.phase === "GAME_END";
    const finalScores = finalSnapshot.players.map(
      (player) => player.totalScore,
    );
    const roundWinnerIds = finalSnapshot.roundHistory.map(
      (round) => round.winnerId,
    );
    const competitors = seats.map((competitorId, seatIndex) => {
      const playerId = playerIds[seatIndex];
      const player = finalSnapshot.players[seatIndex];
      const accumulator = accumulators.get(competitorId);
      if (
        playerId === undefined ||
        player === undefined ||
        accumulator === undefined
      ) {
        throw new Error(
          `Missing final tournament result for seat ${seatIndex}`,
        );
      }
      return competitorResult({
        competitorId,
        seatIndex,
        playerId,
        finalScore: player.totalScore,
        allFinalScores: finalScores,
        roundWinnerIds,
        accumulator,
      });
    });

    return {
      schemaVersion: 3,
      runId,
      gameId,
      seed,
      completed,
      roundsCompleted: finalSnapshot.roundHistory.length,
      turns,
      ...(failure === undefined ? {} : { failure }),
      competitors,
    };
  } finally {
    engine.stop();
  }
}

export function summarizeAIPlayerTournamentRun(
  runId: string,
  games: readonly AIPlayerTournamentGameResult[],
): AIPlayerTournamentRunSummary {
  const competitorIds =
    games[0]?.competitors.map((competitor) => competitor.competitorId) ?? [];
  const referenceCompetitorId = competitorIds[0];
  const duplicateSetComparisons =
    referenceCompetitorId === undefined
      ? []
      : competitorIds
          .slice(1)
          .map((candidateCompetitorId) =>
            compareAIPlayerTournamentDuplicateSets(
              games,
              referenceCompetitorId,
              candidateCompetitorId,
            ),
          );
  return {
    schemaVersion: 4,
    runId,
    gameCount: games.length,
    completedGameRate:
      games.length === 0
        ? 0
        : games.filter((game) => game.completed).length / games.length,
    competitors: aggregateAIPlayerTournamentResults(games),
    duplicateSetComparisons,
  };
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function metric(value: number | undefined, digits = 1): string {
  return value === undefined ? "n/a" : value.toFixed(digits);
}

function signedMetric(value: number | undefined, digits = 1): string {
  if (value === undefined) return "n/a";
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
}

function interval(
  value: AIPlayerTournamentDuplicateSetComparison["finalScoreDeltaConfidence95"],
  digits = 1,
): string {
  return value === undefined
    ? "n/a"
    : `${signedMetric(value.lower, digits)} to ${signedMetric(value.upper, digits)}`;
}

export function formatAIPlayerTournamentSummaryMarkdown(
  summary: AIPlayerTournamentRunSummary,
): string {
  const comparisonRows = summary.duplicateSetComparisons.map((comparison) =>
    [
      comparison.candidateCompetitorId,
      comparison.referenceCompetitorId,
      comparison.matchedSeedCount,
      comparison.excludedSeedIds.length === 0
        ? "none"
        : comparison.excludedSeedIds.join(", "),
      signedMetric(comparison.finalScoreDelta),
      interval(comparison.finalScoreDeltaConfidence95),
      signedMetric(comparison.placementDelta, 2),
      interval(comparison.placementDeltaConfidence95, 2),
      `${comparison.scoreWins}-${comparison.scoreTies}-${comparison.scoreLosses}`,
    ].join(" | "),
  );
  return [
    "# AI Player Duplicate Tournament",
    "",
    `Run: \`${summary.runId}\``,
    "",
    `Games completed: ${percent(summary.completedGameRate)} (${summary.gameCount} scheduled)`,
    "",
    "Skill, reliability, raw provider latency, and cost are reported separately. Presentation pacing is excluded.",
    "",
    "Competitor | Games | Win | Mean place | Mean score | Margin vs field | Round win | Turn complete | Legal | May I calls/opps | May I incomplete | Unknown cost decisions | Provider p50 ms | Provider p95 ms | Observed cost | Cost/turn",
    "--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---:",
    ...summary.competitors.map((competitor) =>
      [
        competitor.competitorId,
        competitor.gameCount,
        percent(competitor.winRate),
        metric(competitor.meanPlacement, 2),
        metric(competitor.meanFinalScore),
        metric(competitor.meanScoreMarginVsField),
        percent(competitor.roundWinRate),
        percent(competitor.turnCompletionRate),
        percent(competitor.legalTurnRate),
        `${competitor.mayICallCallCount}/${competitor.mayICallOpportunityCount}`,
        competitor.mayICallIncompleteCount,
        competitor.unknownCostDecisionCount,
        metric(competitor.providerLatencyMs.p50, 0),
        metric(competitor.providerLatencyMs.p95, 0),
        `$${competitor.totalCostUsd.toFixed(6)}`,
        competitor.costPerTurnUsd === undefined
          ? "n/a"
          : `$${competitor.costPerTurnUsd.toFixed(6)}`,
      ].join(" | "),
    ),
    "",
    "## Seat-controlled duplicate-set comparisons",
    "",
    "Candidate | Reference | Matched seeds | Excluded seeds | Score delta | Score 95% CI | Placement delta | Placement 95% CI | Score W-T-L",
    "--- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---:",
    ...comparisonRows,
    "",
    "Lower score and placement deltas are better. Each matched sample requires both competitors to finish the same seed in every seat; incomplete duplicate sets are excluded and listed. Use at least three seeds before interpreting the confidence interval.",
    "",
  ].join("\n");
}

export async function runAIPlayerTournament(
  options: AIPlayerTournamentRunnerOptions,
): Promise<{
  directory: string;
  summary: AIPlayerTournamentRunSummary;
  costBudget: AIPlayerEvalCostBudgetSummary;
}> {
  const runId = options.runId ?? createRunId();
  const baseSystemPrompt = buildSystemPrompt();
  const promptAssignments = await loadAIPlayerTournamentPromptAssignments({
    candidateIds: options.candidateIds,
    baseContent: baseSystemPrompt,
    experiment: options.promptExperiment,
    experimentCandidateId: options.promptExperimentCandidateId,
  });
  const candidates = new Map(
    options.candidateIds.map((candidateId) => {
      const candidate = AI_PLAYER_EVAL_CANDIDATES[candidateId];
      const prompt = promptAssignments.get(candidateId);
      if (prompt === undefined) {
        throw new Error(`Missing prompt assignment for ${candidateId}`);
      }
      return [
        candidateId,
        { ...candidate, promptVersion: prompt.version },
      ] as const;
    }),
  );
  const models = new Map<AIPlayerEvalCandidateId, LanguageModel>();
  for (const candidateId of options.candidateIds) {
    const candidate = candidates.get(candidateId);
    if (candidate === undefined) {
      throw new Error(`Missing evaluation candidate ${candidateId}`);
    }
    models.set(candidateId, createAIPlayerEvalModel(candidate));
  }
  const directory = await createAIPlayerEvalRunDirectory(
    ".data/ai-evals",
    runId,
  );
  const gamesPath = `${directory}/games.jsonl`;
  const rotations = createAIPlayerTournamentSeatRotations(options.candidateIds);

  const manifest = {
    schemaVersion: AI_PLAYER_TOURNAMENT_MANIFEST_SCHEMA_VERSION,
    runId,
    harnessVersion: AI_PLAYER_TOURNAMENT_HARNESS_VERSION,
    suiteVersion: AI_PLAYER_TOURNAMENT_SUITE_VERSION,
    startedAt: new Date().toISOString(),
    candidates: options.candidateIds.map((candidateId) => {
      const candidate = candidates.get(candidateId);
      if (candidate === undefined) {
        throw new Error(`Missing evaluation candidate ${candidateId}`);
      }
      return candidate;
    }),
    seeds: options.seeds,
    startingRound: options.startingRound,
    maxTurns: options.maxTurns,
    seatRotations: rotations,
    costBudget: {
      policyVersion: AI_PLAYER_EVAL_COST_BUDGET_POLICY_VERSION,
      maxCostUsd: options.maxCostUsd,
      stopBoundary:
        "between complete duplicate seeds after every seat rotation",
      costPreference: "provider-reported then reconstructed",
    },
    promptAssignments: options.candidateIds.map((candidateId) => {
      const prompt = promptAssignments.get(candidateId);
      if (prompt === undefined) {
        throw new Error(`Missing prompt assignment for ${candidateId}`);
      }
      return { candidateId, prompt };
    }),
    pacingDelayMs: 0,
    mayICallScheduling: {
      timing: "once before the current player draws",
      order: "eligible callers in turn-priority order",
      incompleteDecision: "record as incomplete and continue as a pass",
    },
    limitations: [
      "The tournament measures the product reaction window before each draw; it does not resample May I intent after the current player draws from stock or takes another action.",
    ],
  } satisfies AIPlayerTournamentRunManifest;
  await writeFile(
    `${directory}/manifest.json`,
    JSON.stringify(manifest, null, 2),
  );

  const games: AIPlayerTournamentGameResult[] = [];
  const costBudget = createAIPlayerEvalCostBudget(options.maxCostUsd);
  for (let seedIndex = 0; seedIndex < options.seeds.length; seedIndex++) {
    if (!shouldStartAIPlayerEvalCostBudgetUnit(costBudget)) break;
    const seed = options.seeds[seedIndex];
    if (seed === undefined) continue;
    for (
      let rotationIndex = 0;
      rotationIndex < rotations.length;
      rotationIndex++
    ) {
      const seats = rotations[rotationIndex];
      if (seats === undefined) continue;
      const gameId = `${runId}-seed-${seedIndex + 1}-rotation-${rotationIndex + 1}`;
      console.log(
        `[tournament] ${gameId}: ${seats.join(" vs ")} (seed ${seed})`,
      );
      const game = await runTournamentGame({
        runId,
        gameId,
        seed,
        seats: seats.map(parseCandidateId) as [
          AIPlayerEvalCandidateId,
          AIPlayerEvalCandidateId,
          AIPlayerEvalCandidateId,
        ],
        models,
        systemPrompts: new Map(
          [...promptAssignments].map(([candidateId, prompt]) => [
            candidateId,
            prompt.content,
          ]),
        ),
        startingRound: options.startingRound,
        maxTurns: options.maxTurns,
      });
      games.push(game);
      const gameCost = summarizeAIPlayerTournamentGameCost(game);
      recordAIPlayerEvalCost(costBudget, gameCost.observedCostUsd);
      for (
        let unknownIndex = 0;
        unknownIndex < gameCost.unknownCostDecisionCount;
        unknownIndex++
      ) {
        recordAIPlayerEvalCost(costBudget, undefined);
      }
      await appendFile(gamesPath, `${JSON.stringify(game)}\n`);
    }
    completeAIPlayerEvalCostBudgetUnit(costBudget);
  }

  const summary = summarizeAIPlayerTournamentRun(runId, games);
  const costBudgetSummary = summarizeAIPlayerEvalCostBudget(costBudget, {
    plannedUnitCount: options.seeds.length,
    plannedResultCount: options.seeds.length * rotations.length,
    executedResultCount: games.length,
  });
  await writeFile(
    `${directory}/summary.json`,
    JSON.stringify(summary, null, 2),
  );
  await writeFile(
    `${directory}/summary.md`,
    formatAIPlayerTournamentSummaryMarkdown(summary),
  );
  await writeFile(
    `${directory}/run-status.json`,
    JSON.stringify(costBudgetSummary, null, 2),
  );
  return { directory, summary, costBudget: costBudgetSummary };
}

if (import.meta.main) {
  try {
    const options = parseAIPlayerTournamentRunnerArguments(Bun.argv.slice(2));
    const { directory, summary, costBudget } =
      await runAIPlayerTournament(options);
    console.log(formatAIPlayerTournamentSummaryMarkdown(summary));
    console.log(
      `Run status: ${costBudget.status}; observed cost $${costBudget.observedCostUsd.toFixed(6)} / $${costBudget.maxCostUsd.toFixed(6)} stop threshold`,
    );
    console.log(`Artifacts: ${directory}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
