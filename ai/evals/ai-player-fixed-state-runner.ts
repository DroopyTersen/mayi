import { mkdir, appendFile, writeFile } from "node:fs/promises";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
  defaultSettingsMiddleware,
  wrapLanguageModel,
  type LanguageModel,
} from "ai";
import { AI_MODEL_CATALOG } from "../ai-model-catalog";
import { executeTurn } from "../mayIAgent";
import { buildSystemPrompt } from "../mayIAgent.prompt";
import { outputGameStateForLLM } from "../mayIAgent.prompt-renderer";
import { modelRegistry } from "../modelRegistry";
import {
  createOpenRouterMuseChatSettings,
  type OpenRouterMuseReasoningEffort,
} from "../openrouter-muse-profile";
import {
  AI_PLAYER_EVAL_CANDIDATES,
  LUNA_BASELINE_CANDIDATE_ID,
  SPARK_HILL_CLIMB_CANDIDATE_IDS,
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
  aggregateAIPlayerEvalResults,
  reconstructAIPlayerEvalCostUsd,
  scoreAIPlayerEvalCase,
  type AIPlayerEvalAggregate,
  type AIPlayerEvalCaseResult,
} from "./ai-player-eval-score";
import {
  loadAIPlayerEvalPromptSelection,
  validateAIPlayerEvalPromptExperimentArguments,
  type AIPlayerEvalPromptExperimentArguments,
} from "./ai-player-eval-prompt";
import {
  AI_PLAYER_EVAL_EXECUTION_SCHEDULE_VERSION,
  createAIPlayerEvalExecutionSchedule,
} from "./ai-player-eval-schedule";
import {
  meanAIPlayerEvalMetricByGroup,
  pairedStudentTConfidence95,
} from "./ai-player-eval-statistics";
import {
  AI_PLAYER_FIXED_STATE_SUITE_VERSION,
  AI_PLAYER_FIXED_STATE_SCENARIOS,
  createAIPlayerFixedStateRuntime,
} from "./ai-player-fixed-state-scenarios";

export const AI_PLAYER_EVAL_HARNESS_VERSION = "ai-player-eval-harness-v3";

export type AIPlayerEvalRunnerSplit = "development" | "holdout" | "all";

export interface AIPlayerFixedStateRunnerOptions {
  candidateIds: AIPlayerEvalCandidateId[];
  repetitions: number;
  split: AIPlayerEvalRunnerSplit;
  runId: string | undefined;
  scenarioIds: string[] | undefined;
  promptExperiment: AIPlayerEvalPromptExperimentArguments | undefined;
  maxCostUsd: number;
}

export interface AIPlayerEvalCandidateSummary extends AIPlayerEvalAggregate {
  candidateId: AIPlayerEvalCandidateId;
  qualityConfidenceUnit: "scenario-mean";
  qualityConfidenceScenarioCount: number;
  categories: AIPlayerEvalCategorySummary[];
  scenarios: AIPlayerEvalScenarioSummary[];
}

export interface AIPlayerEvalCategorySummary {
  category: string;
  split: "development" | "holdout";
  scenarioCount: number;
  caseCount: number;
  qualityPercent: number;
  completionRate: number;
  legalRate: number;
}

export interface AIPlayerEvalScenarioSummary {
  scenarioId: string;
  split: "development" | "holdout";
  caseCount: number;
  qualityPercent: number;
  completionRate: number;
  legalRate: number;
}

export interface AIPlayerEvalRunSummary {
  schemaVersion: 2;
  runId: string;
  candidates: AIPlayerEvalCandidateSummary[];
  comparisons: AIPlayerEvalMatchedComparison[];
}

export interface AIPlayerEvalMatchedComparison {
  referenceCandidateId: AIPlayerEvalCandidateId;
  candidateId: AIPlayerEvalCandidateId;
  matchedCaseCount: number;
  qualityDeltaPercentPoints: number;
  providerLatencyDeltaMs: number | undefined;
  costDeltaUsd: number | undefined;
  wins: number;
  ties: number;
  losses: number;
}

export interface AIPlayerEvalPromptSnapshot {
  version: string;
  sha256: string;
  content: string;
}

export function createAIPlayerEvalPromptSnapshot(
  version: string,
  content: string,
): AIPlayerEvalPromptSnapshot {
  const sha256 = new Bun.CryptoHasher("sha256").update(content).digest("hex");
  return { version, sha256, content };
}

function nextValue(args: readonly string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

export function parseAIPlayerEvalCandidateId(
  value: string,
): AIPlayerEvalCandidateId {
  if (!(value in AI_PLAYER_EVAL_CANDIDATES)) {
    throw new Error(`Unknown AI player evaluation candidate: ${value}`);
  }
  return value as AIPlayerEvalCandidateId;
}

function parseScenarioId(value: string): string {
  if (
    !AI_PLAYER_FIXED_STATE_SCENARIOS.some(
      (scenario) => scenario.identity.id === value,
    )
  ) {
    throw new Error(`Unknown AI player evaluation scenario: ${value}`);
  }
  return value;
}

export function parseAIPlayerFixedStateRunnerArguments(
  args: readonly string[],
): AIPlayerFixedStateRunnerOptions {
  let candidateIds: AIPlayerEvalCandidateId[] = ["spark-minimal"];
  let candidatesExplicit = false;
  let repetitions = 1;
  let split: AIPlayerEvalRunnerSplit = "development";
  let runId: string | undefined;
  let scenarioIds: string[] | undefined;
  let promptExperimentId: string | undefined;
  let promptAddendumFile: string | undefined;
  let maxCostUsd = DEFAULT_AI_PLAYER_EVAL_MAX_COST_USD;

  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === "--candidate") {
      if (candidatesExplicit) {
        throw new Error("Choose either --candidate or --all-spark once");
      }
      const value = nextValue(args, index, argument);
      candidateIds = value.split(",").map(parseAIPlayerEvalCandidateId);
      candidatesExplicit = true;
      index++;
      continue;
    }
    if (argument === "--all-spark") {
      if (candidatesExplicit) {
        throw new Error("Choose either --candidate or --all-spark once");
      }
      candidateIds = [...SPARK_HILL_CLIMB_CANDIDATE_IDS];
      candidatesExplicit = true;
      continue;
    }
    if (argument === "--repetitions") {
      const value = Number(nextValue(args, index, argument));
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error("Repetitions must be a positive integer");
      }
      repetitions = value;
      index++;
      continue;
    }
    if (argument === "--split") {
      const value = nextValue(args, index, argument);
      if (value !== "development" && value !== "holdout" && value !== "all") {
        throw new Error("Split must be development, holdout, or all");
      }
      split = value;
      index++;
      continue;
    }
    if (argument === "--run-id") {
      const value = nextValue(args, index, argument);
      if (!/^[A-Za-z0-9._-]+$/.test(value)) {
        throw new Error("Run ID may contain only letters, numbers, dots, dashes, and underscores");
      }
      runId = value;
      index++;
      continue;
    }
    if (argument === "--scenario") {
      const value = nextValue(args, index, argument);
      scenarioIds = value.split(",").map(parseScenarioId);
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
    if (argument === "--max-cost-usd") {
      maxCostUsd = parseAIPlayerEvalMaxCostUsd(
        nextValue(args, index, argument),
      );
      index++;
      continue;
    }
    throw new Error(`Unknown AI player evaluation argument: ${argument}`);
  }

  const promptExperiment = validateAIPlayerEvalPromptExperimentArguments(
    promptExperimentId,
    promptAddendumFile,
  );
  if (
    promptExperiment !== undefined &&
    candidateIds.some(
      (candidateId) => AI_PLAYER_EVAL_CANDIDATES[candidateId].role !== "hill-climb",
    )
  ) {
    throw new Error("Prompt experiments are Spark-only; Luna is a frozen baseline");
  }
  return {
    candidateIds,
    repetitions,
    split,
    runId,
    scenarioIds,
    promptExperiment,
    maxCostUsd,
  };
}

export function summarizeAIPlayerEvalRun(
  runId: string,
  results: readonly AIPlayerEvalCaseResult[],
): AIPlayerEvalRunSummary {
  const candidateIds = [
    ...new Set(results.map((result) => result.candidate.id)),
  ].map(parseAIPlayerEvalCandidateId);
  const candidates = candidateIds.map((candidateId) => {
    const definition = parseAIPlayerEvalCandidateId(candidateId);
    const candidateResults = results.filter(
      (result) => result.candidate.id === candidateId,
    );
    const scenarioIds = [
      ...new Set(candidateResults.map((result) => result.scenario.id)),
    ];
    const scenarioQualityMeans = meanAIPlayerEvalMetricByGroup(
      candidateResults.map((result) => ({
        groupId: result.scenario.id,
        value: scoreAIPlayerEvalCase(result).qualityPercent,
      })),
    );
    const categoryKeys = [
      ...new Set(
        candidateResults.map(
          (result) => `${result.scenario.split}\u0000${result.scenario.category}`,
        ),
      ),
    ];
    const categories: AIPlayerEvalCategorySummary[] = categoryKeys.map(
      (categoryKey) => {
        const [split, category] = categoryKey.split("\u0000");
        if (
          (split !== "development" && split !== "holdout") ||
          category === undefined
        ) {
          throw new Error(`Invalid category key ${categoryKey}`);
        }
        const categoryResults = candidateResults.filter(
          (result) =>
            result.scenario.split === split &&
            result.scenario.category === category,
        );
        const aggregate = aggregateAIPlayerEvalResults(categoryResults);
        return {
          category,
          split,
          scenarioCount: new Set(
            categoryResults.map((result) => result.scenario.id),
          ).size,
          caseCount: aggregate.caseCount,
          qualityPercent: aggregate.qualityPercent,
          completionRate: aggregate.completionRate,
          legalRate: aggregate.legalRate,
        };
      },
    );
    const scenarios = scenarioIds.map((scenarioId) => {
      const scenarioResults = candidateResults.filter(
        (result) => result.scenario.id === scenarioId,
      );
      const aggregate = aggregateAIPlayerEvalResults(scenarioResults);
      const first = scenarioResults[0];
      if (first === undefined) {
        throw new Error(`Missing results for scenario ${scenarioId}`);
      }
      return {
        scenarioId,
        split: first.scenario.split,
        caseCount: aggregate.caseCount,
        qualityPercent: aggregate.qualityPercent,
        completionRate: aggregate.completionRate,
        legalRate: aggregate.legalRate,
      };
    });
    return {
      candidateId: definition,
      ...aggregateAIPlayerEvalResults(candidateResults),
      qualityConfidence95: pairedStudentTConfidence95(
        scenarioQualityMeans,
        { lower: 0, upper: 100 },
      ),
      qualityConfidenceUnit: "scenario-mean" as const,
      qualityConfidenceScenarioCount: scenarioQualityMeans.length,
      categories,
      scenarios,
    };
  });

  const referenceCandidateId = candidateIds[0];
  const comparisons: AIPlayerEvalMatchedComparison[] = [];
  if (referenceCandidateId !== undefined) {
    const referenceResults = results.filter(
      (result) => result.candidate.id === referenceCandidateId,
    );
    const referenceByCase = new Map(
      referenceResults.map((result) => [
        `${result.scenario.id}:${result.repetition}`,
        result,
      ]),
    );

    for (const candidateId of candidateIds.slice(1)) {
      const pairs = results
        .filter((result) => result.candidate.id === candidateId)
        .flatMap((candidateResult) => {
          const referenceResult = referenceByCase.get(
            `${candidateResult.scenario.id}:${candidateResult.repetition}`,
          );
          return referenceResult === undefined
            ? []
            : [{ referenceResult, candidateResult }];
        });
      const qualityDeltas = pairs.map(
        ({ referenceResult, candidateResult }) =>
          scoreAIPlayerEvalCase(candidateResult).qualityPercent -
          scoreAIPlayerEvalCase(referenceResult).qualityPercent,
      );
      const providerLatencyDeltas = pairs.flatMap(
        ({ referenceResult, candidateResult }) => {
          const referenceLatency = referenceResult.timing.providerDurationMs;
          const candidateLatency = candidateResult.timing.providerDurationMs;
          return referenceLatency === undefined || candidateLatency === undefined
            ? []
            : [candidateLatency - referenceLatency];
        },
      );
      const costDeltas = pairs.flatMap(({ referenceResult, candidateResult }) => {
        const referenceCost =
          referenceResult.providerReportedCostUsd ??
          referenceResult.reconstructedCostUsd;
        const candidateCost =
          candidateResult.providerReportedCostUsd ??
          candidateResult.reconstructedCostUsd;
        return referenceCost === undefined || candidateCost === undefined
          ? []
          : [candidateCost - referenceCost];
      });
      const average = (values: readonly number[]): number | undefined =>
        values.length === 0
          ? undefined
          : values.reduce((total, value) => total + value, 0) / values.length;

      comparisons.push({
        referenceCandidateId,
        candidateId,
        matchedCaseCount: pairs.length,
        qualityDeltaPercentPoints: average(qualityDeltas) ?? 0,
        providerLatencyDeltaMs: average(providerLatencyDeltas),
        costDeltaUsd: average(costDeltas),
        wins: qualityDeltas.filter((delta) => delta > 0).length,
        ties: qualityDeltas.filter((delta) => delta === 0).length,
        losses: qualityDeltas.filter((delta) => delta < 0).length,
      });
    }
  }

  return { schemaVersion: 2, runId, candidates, comparisons };
}

function percent(value: number | undefined): string {
  return value === undefined ? "n/a" : `${value.toFixed(1)}%`;
}

function milliseconds(value: number | undefined): string {
  return value === undefined ? "n/a" : `${Math.round(value)}`;
}

function signed(value: number | undefined, digits: number): string {
  if (value === undefined) return "n/a";
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
}

export function formatAIPlayerEvalSummaryMarkdown(
  summary: AIPlayerEvalRunSummary,
): string {
  const rows = summary.candidates.map((candidate) =>
    [
      candidate.candidateId,
      String(candidate.caseCount),
      percent(candidate.qualityPercent),
      `${percent(candidate.qualityConfidence95.lower)}–${percent(candidate.qualityConfidence95.upper)}`,
      String(candidate.qualityConfidenceScenarioCount),
      percent(candidate.developmentQualityPercent),
      percent(candidate.holdoutQualityPercent),
      percent(candidate.completionRate * 100),
      percent(candidate.legalRate * 100),
      milliseconds(candidate.providerLatencyMs.p50),
      milliseconds(candidate.providerLatencyMs.p95),
      `$${candidate.totalCostUsd.toFixed(6)}`,
    ].join(" | "),
  );

  const scenarioSections = summary.candidates.flatMap((candidate) => [
    `## ${candidate.candidateId} scenario results`,
    "",
    "Scenario | Split | Quality | Completed | Legal",
    "--- | --- | ---: | ---: | ---:",
    ...candidate.scenarios.map((scenario) =>
      [
        scenario.scenarioId,
        scenario.split,
        percent(scenario.qualityPercent),
        percent(scenario.completionRate * 100),
        percent(scenario.legalRate * 100),
      ].join(" | "),
    ),
    "",
  ]);
  const categorySections = summary.candidates.flatMap((candidate) => [
    `## ${candidate.candidateId} category results`,
    "",
    "Category | Split | Scenarios | Cases | Quality | Completed | Legal",
    "--- | --- | ---: | ---: | ---: | ---: | ---:",
    ...candidate.categories.map((category) =>
      [
        category.category,
        category.split,
        category.scenarioCount,
        category.caseCount,
        percent(category.qualityPercent),
        percent(category.completionRate * 100),
        percent(category.legalRate * 100),
      ].join(" | "),
    ),
    "",
  ]);
  const comparisonSection =
    summary.comparisons.length === 0
      ? []
      : [
          "## Matched candidate deltas",
          "",
          "Candidate | Reference | Matched cases | Quality pp | Provider ms | Cost/case USD | W-T-L",
          "--- | --- | ---: | ---: | ---: | ---: | ---:",
          ...summary.comparisons.map((comparison) =>
            [
              comparison.candidateId,
              comparison.referenceCandidateId,
              comparison.matchedCaseCount,
              signed(comparison.qualityDeltaPercentPoints, 1),
              signed(comparison.providerLatencyDeltaMs, 0),
              signed(comparison.costDeltaUsd, 6),
              `${comparison.wins}-${comparison.ties}-${comparison.losses}`,
            ].join(" | "),
          ),
          "",
        ];

  return [
    "# AI Player Fixed-State Evaluation",
    "",
    `Run: \`${summary.runId}\``,
    "",
    "Skill, reliability, raw provider latency, and cost are reported separately. Presentation pacing is excluded from provider latency.",
    "",
    "Candidate | Cases | Quality | Scenario-mean quality 95% CI | Confidence scenarios | Development | Holdout | Completed | Legal | Provider p50 ms | Provider p95 ms | Cost",
    "--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---:",
    ...rows,
    "",
    ...comparisonSection,
    ...categorySections,
    ...scenarioSections,
  ].join("\n");
}

function createRunId(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export async function createAIPlayerEvalRunDirectory(
  rootDirectory: string,
  runId: string,
): Promise<string> {
  await mkdir(rootDirectory, { recursive: true });
  const directory = `${rootDirectory}/${runId}`;
  try {
    await mkdir(directory);
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? error.code
        : undefined;
    if (code === "EEXIST") {
      throw new Error(`AI evaluation run already exists: ${runId}`);
    }
    throw error;
  }
  return directory;
}

function requireCredential(name: "OPENAI_API_KEY" | "OPENROUTER_API_KEY"): string {
  const value = process.env[name];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${name} is required for the selected evaluation candidate`);
  }
  return value;
}

export function createAIPlayerEvalModel(
  candidate: AIPlayerEvalCandidateDefinition,
  options: { retainReasoning?: boolean } = {},
): LanguageModel {
  if (candidate.id === LUNA_BASELINE_CANDIDATE_ID) {
    requireCredential("OPENAI_API_KEY");
    return modelRegistry.languageModel("default:openai");
  }

  const apiKey = requireCredential("OPENROUTER_API_KEY");
  const definition = AI_MODEL_CATALOG["default:meta"];
  const rawModel = createOpenRouter({ apiKey }).chat(
    definition.model,
    createOpenRouterMuseChatSettings(
      candidate.reasoningEffort as OpenRouterMuseReasoningEffort,
      options,
    ),
  );
  return wrapLanguageModel({
    model: rawModel,
    middleware: defaultSettingsMiddleware({ settings: definition.settings }),
  });
}

function selectedScenarios(
  split: AIPlayerEvalRunnerSplit,
  scenarioIds: readonly string[] | undefined,
) {
  return AI_PLAYER_FIXED_STATE_SCENARIOS.filter(
    (scenario) =>
      (split === "all" || scenario.identity.split === split) &&
      (scenarioIds === undefined || scenarioIds.includes(scenario.identity.id)),
  );
}

function countToolRetries(
  toolCalls: readonly string[],
  successfulActions: number,
): number {
  return Math.max(0, toolCalls.length - successfulActions);
}

function classifyFailure(
  completed: boolean,
  legal: boolean,
  qualityPassed: boolean,
  error: string | undefined,
): AIPlayerEvalCaseResult["failureMode"] {
  if (!legal) return "illegal-action";
  if (!completed) {
    return error?.startsWith("AI provider stopped")
      ? "turn-incomplete"
      : "provider";
  }
  if (!qualityPassed) return "strategy";
  return "none";
}

async function evaluateCase(options: {
  runId: string;
  candidate: AIPlayerEvalCandidateDefinition;
  model: LanguageModel;
  scenario: (typeof AI_PLAYER_FIXED_STATE_SCENARIOS)[number];
  repetition: number;
  systemPrompt: string;
}): Promise<AIPlayerEvalCaseResult> {
  const { runId, candidate, model, scenario, repetition, systemPrompt } = options;
  const state = createAIPlayerFixedStateRuntime(scenario, repetition);

  try {
    const before = await state.runtime.getSnapshot();
    const inputState = outputGameStateForLLM(before, "eval-player-0", {
      actionLog: scenario.actionLog,
    });
    const result = await executeTurn({
      model,
      modelId: candidate.modelId,
      runtime: state.runtime,
      playerId: "eval-player-0",
      playerName: "Evaluated Player",
      maxSteps: scenario.maxSteps,
      maxRetries: 1,
      debug: false,
      telemetry: false,
      actionLog: scenario.actionLog,
      systemPrompt,
    });
    const after = await state.runtime.getSnapshot();
    const criteria = scenario.grade(after, state.attempts);
    const completed = result.success;
    const legal = state.attempts.every((attempt) => attempt.ok);
    const qualityPassed = criteria.every((criterion) => criterion.passed);
    const metrics = result.metrics;
    const usage = {
      inputTokens: metrics?.inputTokens,
      noCacheInputTokens: metrics?.noCacheInputTokens,
      cacheReadInputTokens: metrics?.cacheReadInputTokens,
      cacheWriteInputTokens: metrics?.cacheWriteInputTokens,
      outputTokens: metrics?.outputTokens,
      reasoningOutputTokens: metrics?.reasoningOutputTokens,
      totalTokens: metrics?.totalTokens,
    };
    const evaluatedPlayer = after.players.find(
      (player) => player.id === "eval-player-0",
    );

    return {
      schemaVersion: 1,
      runId,
      candidate: {
        id: candidate.id,
        modelId: candidate.modelId,
        provider: candidate.provider,
        reasoningEffort: candidate.reasoningEffort,
        promptVersion: candidate.promptVersion,
        modelConfigurationSha256: candidate.modelConfigurationSha256,
      },
      scenario: scenario.identity,
      repetition,
      completed,
      legal,
      criteria,
      failureMode: classifyFailure(
        completed,
        legal,
        qualityPassed,
        result.error,
      ),
      retries: countToolRetries(
        result.actions,
        state.attempts.filter((attempt) => attempt.ok).length,
      ),
      timing: {
        turnDurationMs: metrics?.turnDurationMs,
        providerDurationMs: metrics?.providerDurationMs,
        toolExecutionDurationMs: metrics?.toolExecutionDurationMs,
        orchestrationDurationMs: metrics?.orchestrationDurationMs,
        pacingDelayMs: 0,
      },
      usage,
      providerReportedCostUsd: metrics?.providerReportedCostUsd,
      reconstructedCostUsd: reconstructAIPlayerEvalCostUsd(
        usage,
        candidate.pricing,
      ),
      inputState,
      outcome: {
        phase: after.phase,
        turnPhase: after.turnPhase,
        awaitingPlayerId: after.awaitingPlayerId,
        evaluatedPlayerHandCardIds:
          evaluatedPlayer?.hand.map((card) => card.id) ?? [],
        tableMeldCount: after.table.length,
        topDiscardCardId: after.discard[0]?.id ?? null,
        lastError: after.lastError,
      },
      actions: result.actions,
      warnings: result.error === undefined ? [] : [result.error],
    };
  } finally {
    state.actor.stop();
  }
}

export async function runAIPlayerFixedStateEvaluation(
  options: AIPlayerFixedStateRunnerOptions,
): Promise<{
  directory: string;
  summary: AIPlayerEvalRunSummary;
  costBudget: AIPlayerEvalCostBudgetSummary;
}> {
  const runId = options.runId ?? createRunId();
  const scenarios = selectedScenarios(options.split, options.scenarioIds);
  if (scenarios.length === 0) {
    throw new Error(`No scenarios found for split ${options.split}`);
  }
  const baseSystemPrompt = buildSystemPrompt();
  const promptVersions = new Set(
    options.candidateIds.map(
      (candidateId) => AI_PLAYER_EVAL_CANDIDATES[candidateId].promptVersion,
    ),
  );
  if (promptVersions.size !== 1) {
    throw new Error("All candidates in one run must use the same prompt version");
  }
  const promptVersion = promptVersions.values().next().value;
  if (promptVersion === undefined) {
    throw new Error("At least one evaluation candidate is required");
  }
  const prompt = await loadAIPlayerEvalPromptSelection({
    baseVersion: promptVersion,
    baseContent: baseSystemPrompt,
    experiment: options.promptExperiment,
  });
  const candidates = new Map(
    options.candidateIds.map((candidateId) => {
      const candidate = AI_PLAYER_EVAL_CANDIDATES[candidateId];
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
  const casesPath = `${directory}/cases.jsonl`;

  await writeFile(
    `${directory}/manifest.json`,
    JSON.stringify(
      {
        schemaVersion: 1,
        runId,
        harnessVersion: AI_PLAYER_EVAL_HARNESS_VERSION,
        executionScheduleVersion:
          AI_PLAYER_EVAL_EXECUTION_SCHEDULE_VERSION,
        suiteVersion: AI_PLAYER_FIXED_STATE_SUITE_VERSION,
        startedAt: new Date().toISOString(),
        candidates: options.candidateIds.map((candidateId) => {
          const candidate = candidates.get(candidateId);
          if (candidate === undefined) {
            throw new Error(`Missing evaluation candidate ${candidateId}`);
          }
          return candidate;
        }),
        repetitions: options.repetitions,
        split: options.split,
        costBudget: {
          policyVersion: AI_PLAYER_EVAL_COST_BUDGET_POLICY_VERSION,
          maxCostUsd: options.maxCostUsd,
          stopBoundary:
            "between complete scenario/repetition blocks across all candidates",
          costPreference: "provider-reported then reconstructed",
        },
        prompt,
        scenarios: scenarios.map((scenario) => ({
          ...scenario.identity,
          rubric: scenario.rubric,
        })),
      },
      null,
      2,
    ),
  );

  const results: AIPlayerEvalCaseResult[] = [];
  const scenarioById = new Map(
    scenarios.map((scenario) => [scenario.identity.id, scenario]),
  );
  const schedule = createAIPlayerEvalExecutionSchedule(
    options.candidateIds,
    scenarios.map((scenario) => scenario.identity.id),
    options.repetitions,
  );
  const costBudget = createAIPlayerEvalCostBudget(options.maxCostUsd);
  const matchedUnitSize = options.candidateIds.length;
  for (
    let unitStart = 0;
    unitStart < schedule.length;
    unitStart += matchedUnitSize
  ) {
    if (!shouldStartAIPlayerEvalCostBudgetUnit(costBudget)) break;
    const unit = schedule.slice(unitStart, unitStart + matchedUnitSize);
    if (unit.length !== matchedUnitSize) {
      throw new Error("Evaluation schedule ended with an incomplete matched unit");
    }
    for (const entry of unit) {
      const candidate = candidates.get(entry.candidateId);
      const model = models.get(entry.candidateId);
      const scenario = scenarioById.get(entry.scenarioId);
      if (
        candidate === undefined ||
        model === undefined ||
        scenario === undefined
      ) {
        throw new Error(
          `Incomplete evaluation schedule entry for ${entry.candidateId}/${entry.scenarioId}`,
        );
      }
      console.log(
        `[eval] ${candidate.id} ${scenario.identity.id} repetition ${entry.repetition}/${options.repetitions}`,
      );
      const result = await evaluateCase({
        runId,
        candidate,
        model,
        scenario,
        repetition: entry.repetition,
        systemPrompt: prompt.content,
      });
      results.push(result);
      recordAIPlayerEvalCost(
        costBudget,
        result.providerReportedCostUsd ?? result.reconstructedCostUsd,
      );
      await appendFile(casesPath, `${JSON.stringify(result)}\n`);
    }
    completeAIPlayerEvalCostBudgetUnit(costBudget);
  }

  const summary = summarizeAIPlayerEvalRun(runId, results);
  const costBudgetSummary = summarizeAIPlayerEvalCostBudget(costBudget, {
    plannedUnitCount: scenarios.length * options.repetitions,
    plannedResultCount: schedule.length,
    executedResultCount: results.length,
  });
  await writeFile(
    `${directory}/summary.json`,
    JSON.stringify(summary, null, 2),
  );
  await writeFile(
    `${directory}/summary.md`,
    formatAIPlayerEvalSummaryMarkdown(summary),
  );
  await writeFile(
    `${directory}/run-status.json`,
    JSON.stringify(costBudgetSummary, null, 2),
  );
  return { directory, summary, costBudget: costBudgetSummary };
}

if (import.meta.main) {
  try {
    const options = parseAIPlayerFixedStateRunnerArguments(Bun.argv.slice(2));
    const { directory, summary, costBudget } =
      await runAIPlayerFixedStateEvaluation(options);
    console.log(formatAIPlayerEvalSummaryMarkdown(summary));
    console.log(
      `Run status: ${costBudget.status}; observed cost $${costBudget.observedCostUsd.toFixed(6)} / $${costBudget.maxCostUsd.toFixed(6)} stop threshold`,
    );
    console.log(`Artifacts: ${directory}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
