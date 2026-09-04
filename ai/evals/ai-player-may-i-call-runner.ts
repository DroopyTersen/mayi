import { appendFile, writeFile } from "node:fs/promises";
import type { LanguageModel } from "ai";
import {
  buildMayICallDecisionPrompt,
  executeMayICallDecision,
  MAY_I_CALL_DECISION_INSTRUCTIONS,
  MAY_I_CALL_DECISION_PROMPT_VERSION,
} from "../mayIAgent.may-i-call";
import { buildSystemPrompt } from "../mayIAgent.prompt";
import {
  AI_PLAYER_EVAL_CANDIDATES,
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
  loadAIPlayerEvalPromptSelection,
  validateAIPlayerEvalPromptExperimentArguments,
  type AIPlayerEvalPromptExperimentArguments,
} from "./ai-player-eval-prompt";
import {
  AI_PLAYER_EVAL_EXECUTION_SCHEDULE_VERSION,
  createAIPlayerEvalExecutionSchedule,
} from "./ai-player-eval-schedule";
import {
  reconstructAIPlayerEvalCostUsd,
  type AIPlayerEvalCaseResult,
} from "./ai-player-eval-score";
import {
  createAIPlayerEvalModel,
  AI_PLAYER_EVAL_HARNESS_VERSION,
  createAIPlayerEvalRunDirectory,
  formatAIPlayerEvalSummaryMarkdown,
  parseAIPlayerEvalCandidateId,
  summarizeAIPlayerEvalRun,
  type AIPlayerEvalRunnerSplit,
  type AIPlayerEvalRunSummary,
} from "./ai-player-fixed-state-runner";
import { createAIPlayerFixedStateRuntime } from "./ai-player-fixed-state-scenarios";
import {
  AI_PLAYER_MAY_I_CALL_SCENARIOS,
  AI_PLAYER_MAY_I_CALL_SUITE_VERSION,
} from "./ai-player-may-i-call-scenarios";

export interface AIPlayerMayICallRunnerOptions {
  candidateIds: AIPlayerEvalCandidateId[];
  repetitions: number;
  split: AIPlayerEvalRunnerSplit;
  runId: string | undefined;
  scenarioIds: string[] | undefined;
  promptExperiment: AIPlayerEvalPromptExperimentArguments | undefined;
  maxCostUsd: number;
}

function nextValue(args: readonly string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function parseScenarioId(value: string): string {
  if (
    !AI_PLAYER_MAY_I_CALL_SCENARIOS.some(
      (scenario) => scenario.identity.id === value,
    )
  ) {
    throw new Error(`Unknown AI player May I call scenario: ${value}`);
  }
  return value;
}

export function parseAIPlayerMayICallRunnerArguments(
  args: readonly string[],
): AIPlayerMayICallRunnerOptions {
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
      candidateIds = nextValue(args, index, argument)
        .split(",")
        .map(parseAIPlayerEvalCandidateId);
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
        throw new Error(
          "Run ID may contain only letters, numbers, dots, dashes, and underscores",
        );
      }
      runId = value;
      index++;
      continue;
    }
    if (argument === "--scenario") {
      scenarioIds = nextValue(args, index, argument)
        .split(",")
        .map(parseScenarioId);
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
    throw new Error(`Unknown AI player May I call argument: ${argument}`);
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

function selectedScenarios(options: AIPlayerMayICallRunnerOptions) {
  return AI_PLAYER_MAY_I_CALL_SCENARIOS.filter(
    (scenario) =>
      (options.split === "all" || scenario.identity.split === options.split) &&
      (options.scenarioIds === undefined ||
        options.scenarioIds.includes(scenario.identity.id)),
  );
}

function failureMode(options: {
  completed: boolean;
  legal: boolean;
  qualityPassed: boolean;
  error: string | undefined;
}): AIPlayerEvalCaseResult["failureMode"] {
  if (!options.legal) return "illegal-action";
  if (!options.completed) {
    return options.error?.startsWith("AI provider stopped")
      ? "turn-incomplete"
      : "provider";
  }
  return options.qualityPassed ? "none" : "strategy";
}

async function evaluateMayICallCase(options: {
  runId: string;
  candidate: AIPlayerEvalCandidateDefinition;
  model: LanguageModel;
  repetition: number;
  scenario: (typeof AI_PLAYER_MAY_I_CALL_SCENARIOS)[number];
  systemPrompt: string;
}): Promise<AIPlayerEvalCaseResult> {
  const { runId, candidate, model, repetition, scenario, systemPrompt } =
    options;
  const state = createAIPlayerFixedStateRuntime(
    scenario,
    repetition,
    scenario.evaluatedPlayerId,
  );

  try {
    const before = await state.runtime.getSnapshot();
    const inputState = buildMayICallDecisionPrompt(
      before,
      scenario.evaluatedPlayerId,
    );
    const result = await executeMayICallDecision({
      model,
      modelId: candidate.modelId,
      runtime: state.runtime,
      playerId: scenario.evaluatedPlayerId,
      playerName: "Evaluated Player",
      maxRetries: 1,
      debug: false,
      telemetry: false,
      systemPrompt,
    });
    const after = await state.runtime.getSnapshot();
    const criteria = scenario.grade(result.decision, after, state.attempts);
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
      (player) => player.id === scenario.evaluatedPlayerId,
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
      failureMode: failureMode({
        completed,
        legal,
        qualityPassed,
        error: result.error,
      }),
      retries: Math.max(0, result.actions.length - (result.success ? 1 : 0)),
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

export function formatAIPlayerMayICallSummaryMarkdown(
  summary: AIPlayerEvalRunSummary,
): string {
  return formatAIPlayerEvalSummaryMarkdown(summary).replace(
    "# AI Player Fixed-State Evaluation",
    "# AI Player May I Initiation Evaluation",
  );
}

function createRunId(): string {
  return `may-i-call-${new Date().toISOString().replace(/[:.]/g, "-")}`;
}

export async function runAIPlayerMayICallEvaluation(
  options: AIPlayerMayICallRunnerOptions,
): Promise<{
  directory: string;
  summary: AIPlayerEvalRunSummary;
  costBudget: AIPlayerEvalCostBudgetSummary;
}> {
  const scenarios = selectedScenarios(options);
  if (scenarios.length === 0) {
    throw new Error(`No May I call scenarios found for split ${options.split}`);
  }
  const runId = options.runId ?? createRunId();
  const baseSystemPrompt = buildSystemPrompt();
  const firstCandidateId = options.candidateIds[0];
  if (firstCandidateId === undefined) {
    throw new Error("At least one evaluation candidate is required");
  }
  const prompt = await loadAIPlayerEvalPromptSelection({
    baseVersion: AI_PLAYER_EVAL_CANDIDATES[firstCandidateId].promptVersion,
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
    models.set(
      candidateId,
      createAIPlayerEvalModel(candidate),
    );
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
        suiteVersion: AI_PLAYER_MAY_I_CALL_SUITE_VERSION,
        decisionPromptVersion: MAY_I_CALL_DECISION_PROMPT_VERSION,
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
        decisionInstructions: MAY_I_CALL_DECISION_INSTRUCTIONS,
        scenarios: scenarios.map((scenario) => ({
          ...scenario.identity,
          expectedDecision: scenario.expectedDecision,
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
      throw new Error(
        "May I evaluation schedule ended with an incomplete matched unit",
      );
    }
    for (const entry of unit) {
      const model = models.get(entry.candidateId);
      const candidate = candidates.get(entry.candidateId);
      const scenario = scenarioById.get(entry.scenarioId);
      if (
        model === undefined ||
        candidate === undefined ||
        scenario === undefined
      ) {
        throw new Error(
          `Incomplete May I evaluation schedule entry for ${entry.candidateId}/${entry.scenarioId}`,
        );
      }
      console.log(
        `[may-i-call] ${entry.candidateId} ${scenario.identity.id} repetition ${entry.repetition}/${options.repetitions}`,
      );
      const result = await evaluateMayICallCase({
        runId,
        candidate,
        model,
        repetition: entry.repetition,
        scenario,
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
    formatAIPlayerMayICallSummaryMarkdown(summary),
  );
  await writeFile(
    `${directory}/run-status.json`,
    JSON.stringify(costBudgetSummary, null, 2),
  );
  return { directory, summary, costBudget: costBudgetSummary };
}

if (import.meta.main) {
  try {
    const options = parseAIPlayerMayICallRunnerArguments(Bun.argv.slice(2));
    const { directory, summary, costBudget } =
      await runAIPlayerMayICallEvaluation(options);
    console.log(formatAIPlayerMayICallSummaryMarkdown(summary));
    console.log(
      `Run status: ${costBudget.status}; observed cost $${costBudget.observedCostUsd.toFixed(6)} / $${costBudget.maxCostUsd.toFixed(6)} stop threshold`,
    );
    console.log(`Artifacts: ${directory}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
