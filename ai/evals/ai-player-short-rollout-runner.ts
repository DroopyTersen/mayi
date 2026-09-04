import { appendFile, writeFile } from "node:fs/promises";
import type { LanguageModel } from "ai";
import type { AITurnMetrics } from "../ai-turn-metrics";
import { AIToolRequestJournal, summarizeAIToolRequests, type AIToolRequest } from "../ai-tool-request-journal";
import { AIPlayerOrganizationTracker } from "./ai-player-organization-opportunity";
import { AIPlayerRolloutDecisionRecorder } from "./ai-player-rollout-decision-evidence";
import { createAIPlayerEvalModelConfigurationSnapshot } from "./ai-player-model-configuration";
import { runAIPlayerEvalBatches } from "./ai-player-eval-batches";
import { executeTurn } from "../mayIAgent";
import { AIHandConversation, AI_HAND_CONVERSATION_VERSION } from "../mayIAgent.conversation";
import type { AIPlayerDecisionContextTrace } from "../mayIAgent.decision-context";
import {
  executeMayICallDecision,
  getEligibleMayICallerIds,
} from "../mayIAgent.may-i-call";
import { buildSystemPrompt } from "../mayIAgent.prompt";
import { outputGameStateForLLM } from "../mayIAgent.prompt-renderer";
import { getAITacticalPresentationVersion, type AITacticalPresentation } from "../mayIAgent.contract-options";
import {
  AIHandScratchpad,
  AI_HAND_SCRATCHPAD_VERSION,
  appendAIStrategyNoteContext,
  type AIHandScratchpadTrace,
} from "../mayIAgent.scratchpad";
import type { GameSnapshot } from "../../core/engine/game-engine.types";
import {
  AI_PLAYER_EVAL_CANDIDATES,
  type AIPlayerEvalCandidateDefinition,
  type SparkHillClimbCandidateId,
} from "./ai-player-eval-candidates";
import {
  reconstructAIPlayerEvalCostUsd,
  type AIPlayerEvalCriterionResult,
  type AIPlayerEvalFailureMode,
  type AIPlayerEvalUsage,
} from "./ai-player-eval-score";
import {
  loadAIPlayerEvalPromptSelection,
  validateAIPlayerEvalPromptExperimentArguments,
  type AIPlayerEvalPromptExperimentArguments,
} from "./ai-player-eval-prompt";
import {
  createAIPlayerEvalModel,
  createAIPlayerEvalRunDirectory,
  parseAIPlayerEvalCandidateId,
} from "./ai-player-fixed-state-runner";
import {
  AI_PLAYER_FIXED_STATE_RUNTIME_VERSION,
  projectAIPlayerFixedStateSnapshot,
  type AIPlayerFixedStateAttempt,
} from "./ai-player-fixed-state-scenarios";
import {
  AI_PLAYER_SHORT_ROLLOUT_SCENARIOS,
  AI_PLAYER_SHORT_ROLLOUT_SUITE_VERSION,
  scoreAIPlayerShortRolloutCriteria,
} from "./ai-player-short-rollout-scenarios";
import {
  type AIPlayerShortRolloutDecisionKind,
  type AIPlayerShortRolloutDecisionRecord,
  type AIPlayerShortRolloutScenario,
  type AIPlayerRolloutAttempt,
} from "./ai-player-short-rollout-scenario";
import {
  AI_PLAYER_ROLLOUT_OBSERVATION_VERSION,
  createAIPlayerRolloutHistory,
} from "./ai-player-rollout-history";
import {
  AI_PLAYER_SHORT_ROLLOUT_HARNESS_VERSION,
  isAIPlayerRolloutComplete,
  isAIPlayerRolloutTerminal,
  resolveAIPlayerRolloutActions,
} from "./ai-player-rollout-policy";
import {
  AI_PLAYER_ROLLOUT_SCOPE_VERSION,
  buildAIPlayerRolloutSelection,
  getAIPlayerRolloutScope,
  summarizeAIPlayerRolloutScopeScores,
  type AIPlayerRolloutSelection,
  type AIPlayerRolloutSelectionScope,
  type AIPlayerRolloutScopeDefinition,
} from "./ai-player-rollout-scope";

const DEFAULT_REPETITIONS = 4;
const AI_REASONING_REPLAY_VERSION = "openrouter-encrypted-tool-replay-v1";
export type AIPlayerShortRolloutSplit = "development" | "holdout" | "all";

export type AIPlayerShortRolloutPromptScope =
  | "ordinary-turns"
  | "all-candidate-decisions";

export interface AIPlayerShortRolloutRunnerOptions {
  candidateId: SparkHillClimbCandidateId;
  repetitions: number;
  scenarioIds: string[] | undefined;
  runId: string | undefined;
  promptExperiment: AIPlayerEvalPromptExperimentArguments | undefined;
  promptExperimentScope: AIPlayerShortRolloutPromptScope;
  split: AIPlayerShortRolloutSplit;
  concurrency: number;
  scope: AIPlayerRolloutSelectionScope;
  describe: boolean;
  scratchpad?: "per-hand";
  tacticalPresentation?: AITacticalPresentation;
  reasoningReplay?: "within-turn";
  conversation?: "fresh" | "per-hand";
}

export interface AIPlayerShortRolloutCaseResult {
  schemaVersion: 7;
  scopeVersion: string;
  eligibility: AIPlayerRolloutScopeDefinition;
  harnessVersion: string;
  observationVersion: string;
  attempts: AIPlayerRolloutAttempt[];
  decisions: AIPlayerShortRolloutDecisionRecord[];
  toolRequests: Array<AIToolRequest & {
    decisionIndex: number;
    kind: AIPlayerShortRolloutDecisionKind;
  }>;
  toolRequestHealth: ReturnType<typeof summarizeAIToolRequests>;
  finalSnapshot: GameSnapshot;
  runId: string;
  candidateId: SparkHillClimbCandidateId;
  scenarioId: string;
  repetition: number;
  qualityPercent: number;
  completed: boolean;
  /** Engine attempts only; SDK/tool rejections are reported in toolRequestHealth. */
  legal: boolean;
  criteria: AIPlayerEvalCriterionResult[];
  failureMode: AIPlayerEvalFailureMode;
  candidateTurns: number;
  modelDecisions: number;
  organization: {
    expectedTurns: number;
    correctlyOrganizedTurns: number;
    complianceRate: number | undefined;
  };
  providerLatencyMs: number;
  wallDurationMs: number;
  providerLatencyPerDecisionMs: number[];
  wallDurationPerDecisionMs: number[];
  usage: AIPlayerEvalUsage;
  totalCostUsd: number;
  inputStates: string[];
  actions: string[];
  warnings: string[];
  tacticalPresentation?: { mode: AITacticalPresentation; version: string };
  reasoningReplay?: { mode: "within-turn"; version: string };
  conversation?: {
    mode: "fresh" | "per-hand";
    version: string;
    decisions: Array<{
      decisionIndex: number;
      kind: AIPlayerShortRolloutDecisionKind;
      usageAvailable: boolean;
      trace?: AIPlayerDecisionContextTrace;
    }>;
  };
  scratchpad?: {
    version: string;
    decisions: Array<AIHandScratchpadTrace & {
      decisionIndex: number;
      kind: AIPlayerShortRolloutDecisionKind;
    }>;
  };
}

export interface AIPlayerShortRolloutAggregate {
  caseCount: number;
  qualityPercent: number;
  completionRate: number;
  legalRate: number;
  toolRequestHealth: ReturnType<typeof summarizeAIToolRequests>;
  organizationComplianceRate: number | undefined;
  providerLatencyPerDecisionMs: {
    p50: number | undefined;
    p95: number | undefined;
  };
  wallDurationPerDecisionMs: {
    p50: number | undefined;
    p95: number | undefined;
  };
  totalCostUsd: number;
  costPerCaseUsd: number | undefined;
}

export interface AIPlayerShortRolloutSummary extends Omit<
  AIPlayerShortRolloutAggregate,
  "qualityPercent"
> {
  diagnosticQualityPercent: number;
  schemaVersion: 7;
  selection: AIPlayerRolloutSelection;
  scopeScores: ReturnType<typeof summarizeAIPlayerRolloutScopeScores>;
  harnessVersion: string;
  observationVersion: string;
  runId: string;
  candidateId: SparkHillClimbCandidateId;
  suiteVersion: string;
  split: AIPlayerShortRolloutSplit;
  concurrency: number;
  repetitions: number;
  scenarios: Array<
    AIPlayerShortRolloutAggregate & {
      scenarioId: string;
      assessment: AIPlayerShortRolloutScenario["assessment"];
    }
  >;
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

function parseSparkCandidateId(value: string): SparkHillClimbCandidateId {
  const candidateId = parseAIPlayerEvalCandidateId(value);
  if (AI_PLAYER_EVAL_CANDIDATES[candidateId].role !== "hill-climb") {
    throw new Error("Short rollout hill climbing is Spark-only");
  }
  return candidateId as SparkHillClimbCandidateId;
}

function parseRepetitions(value: string): number {
  const repetitions = Number(value);
  if (!Number.isInteger(repetitions) || repetitions <= 0) {
    throw new Error("Repetitions must be a positive integer");
  }
  return repetitions;
}

function parseScenarioIds(value: string): string[] {
  return value.split(",").map((scenarioId) => {
    if (
      !AI_PLAYER_SHORT_ROLLOUT_SCENARIOS.some(
        (scenario) => scenario.identity.id === scenarioId,
      )
    ) {
      throw new Error(
        `Unknown AI player short rollout scenario: ${scenarioId}`,
      );
    }
    return scenarioId;
  });
}

export function parseAIPlayerShortRolloutRunnerArguments(
  args: readonly string[],
): AIPlayerShortRolloutRunnerOptions {
  let candidateId: SparkHillClimbCandidateId = "spark-low";
  let repetitions = DEFAULT_REPETITIONS;
  let scenarioIds: string[] | undefined;
  let runId: string | undefined;
  let promptExperimentId: string | undefined;
  let promptAddendumFile: string | undefined;
  let promptExperimentScope: AIPlayerShortRolloutPromptScope = "ordinary-turns";
  let split: AIPlayerShortRolloutSplit = "development";
  let concurrency = 4;
  let scope: AIPlayerRolloutSelectionScope = "all-eligible";
  let describe = false;
  let scratchpad: "per-hand" | undefined;
  let tacticalPresentation: AITacticalPresentation | undefined;
  let reasoningReplay: "within-turn" | undefined;
  let conversation: "fresh" | "per-hand" | undefined;

  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === "--conversation") {
      const value = nextValue(args, index, argument);
      if (value !== "fresh" && value !== "per-hand") throw new Error("Conversation must be fresh or per-hand");
      conversation = value;
      index++;
      continue;
    }
    if (argument === "--reasoning-replay") {
      const value = nextValue(args, index, argument);
      if (value !== "within-turn") throw new Error("Reasoning replay must be within-turn");
      reasoningReplay = value;
      index++;
      continue;
    }
    if (argument === "--tactical-presentation") {
      const value = nextValue(args, index, argument);
      if (value !== "contract-options" && value !== "contract-options-reversed" && value !== "neutral-contract-hint") {
        throw new Error("Tactical presentation must be contract-options, contract-options-reversed or neutral-contract-hint");
      }
      tacticalPresentation = value;
      index++;
      continue;
    }
    if (argument === "--scratchpad") {
      const value = nextValue(args, index, argument);
      if (value !== "per-hand") throw new Error("Scratchpad must be per-hand");
      scratchpad = value;
      index++;
      continue;
    }
    if (argument === "--describe") {
      describe = true;
      continue;
    }
    if (argument === "--scope") {
      const value = nextValue(args, index, argument);
      if (
        value !== "strategy" &&
        value !== "robustness" &&
        value !== "all-eligible"
      ) {
        throw new Error("Scope must be strategy, robustness, or all-eligible");
      }
      scope = value;
      index++;
      continue;
    }
    if (argument === "--candidate") {
      candidateId = parseSparkCandidateId(nextValue(args, index, argument));
      index++;
      continue;
    }
    if (argument === "--repetitions") {
      repetitions = parseRepetitions(nextValue(args, index, argument));
      index++;
      continue;
    }
    if (argument === "--scenario") {
      scenarioIds = [
        ...(scenarioIds ?? []),
        ...parseScenarioIds(nextValue(args, index, argument)),
      ];
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
    if (argument === "--concurrency") {
      concurrency = Number(nextValue(args, index, argument));
      if (!Number.isInteger(concurrency) || concurrency < 1) {
        throw new Error("Concurrency must be a positive integer");
      }
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
    if (argument === "--prompt-scope") {
      const value = nextValue(args, index, argument);
      if (value !== "ordinary-turns" && value !== "all-candidate-decisions") {
        throw new Error(
          "Prompt scope must be ordinary-turns or all-candidate-decisions",
        );
      }
      promptExperimentScope = value;
      index++;
      continue;
    }
    throw new Error(`Unknown AI player short rollout argument: ${argument}`);
  }

  const promptExperiment = validateAIPlayerEvalPromptExperimentArguments(promptExperimentId, promptAddendumFile);
  validateConversationExperiment({ conversation, reasoningReplay, scratchpad, tacticalPresentation, promptExperiment });
  if (scratchpad !== undefined) {
    if (promptExperiment === undefined) throw new Error("Scratchpad requires an explicit prompt experiment");
    if (promptExperimentScope !== "all-candidate-decisions") throw new Error("Scratchpad requires all-candidate-decisions prompt scope");
  }
  return {
    candidateId,
    repetitions,
    scenarioIds,
    runId,
    promptExperiment,
    promptExperimentScope,
    split,
    concurrency,
    scope,
    describe,
    ...(scratchpad === undefined ? {} : { scratchpad }),
    ...(tacticalPresentation === undefined ? {} : { tacticalPresentation }),
    ...(reasoningReplay === undefined ? {} : { reasoningReplay }),
    ...(conversation === undefined ? {} : { conversation }),
  };
}

function validateConversationExperiment(options: Pick<AIPlayerShortRolloutRunnerOptions,
  "conversation" | "reasoningReplay" | "scratchpad" | "tacticalPresentation"> & {
    promptExperiment?: AIPlayerEvalPromptExperimentArguments;
  }): void {
  if (options.conversation === undefined) return;
  if (options.reasoningReplay !== "within-turn") throw new Error("Conversation comparison requires within-turn reasoning retention in both arms");
  if (options.scratchpad !== undefined || options.tacticalPresentation !== undefined || options.promptExperiment !== undefined) {
    throw new Error("Conversation comparison must be isolated from scratchpad, presentation and prompt experiments");
  }
}

export function selectAIPlayerShortRolloutScenarios(
  scenarioIds: readonly string[] | undefined,
  split: AIPlayerShortRolloutSplit,
  scope: AIPlayerRolloutSelectionScope = "all-eligible",
): AIPlayerShortRolloutScenario[] {
  const selection = buildAIPlayerRolloutSelection(
    AI_PLAYER_SHORT_ROLLOUT_SCENARIOS,
    { scenarioIds, split, scope },
  );
  const selectedIds = new Set(
    selection.selected.map((entry) => entry.scenarioId),
  );
  return AI_PLAYER_SHORT_ROLLOUT_SCENARIOS.filter((scenario) =>
    selectedIds.has(scenario.identity.id),
  );
}

function metricSum(
  metrics: readonly AITurnMetrics[],
  select: (metric: AITurnMetrics) => number | undefined,
): number | undefined {
  const values = metrics
    .map(select)
    .filter((value): value is number => value !== undefined);
  return values.length === 0
    ? undefined
    : values.reduce((total, value) => total + value, 0);
}

function usageFromMetrics(
  metrics: readonly AITurnMetrics[],
): AIPlayerEvalUsage {
  return {
    inputTokens: metricSum(metrics, (metric) => metric.inputTokens),
    noCacheInputTokens: metricSum(
      metrics,
      (metric) => metric.noCacheInputTokens,
    ),
    cacheReadInputTokens: metricSum(
      metrics,
      (metric) => metric.cacheReadInputTokens,
    ),
    cacheWriteInputTokens: metricSum(
      metrics,
      (metric) => metric.cacheWriteInputTokens,
    ),
    outputTokens: metricSum(metrics, (metric) => metric.outputTokens),
    reasoningOutputTokens: metricSum(
      metrics,
      (metric) => metric.reasoningOutputTokens,
    ),
    totalTokens: metricSum(metrics, (metric) => metric.totalTokens),
  };
}

function decisionCostUsd(
  metric: AITurnMetrics,
  candidate: AIPlayerEvalCandidateDefinition,
): number {
  return (
    metric.providerReportedCostUsd ??
    reconstructAIPlayerEvalCostUsd(
      {
        inputTokens: metric.inputTokens,
        noCacheInputTokens: metric.noCacheInputTokens,
        cacheReadInputTokens: metric.cacheReadInputTokens,
        cacheWriteInputTokens: metric.cacheWriteInputTokens,
        outputTokens: metric.outputTokens,
        reasoningOutputTokens: metric.reasoningOutputTokens,
        totalTokens: metric.totalTokens,
      },
      candidate.pricing,
    ) ??
    0
  );
}

/** Timing metrics alone do not establish complete input/output usage coverage. */
export function hasAIPlayerDecisionUsage(metric: AITurnMetrics | undefined): boolean {
  return metric !== undefined && [metric.inputTokens, metric.outputTokens].every(
    value => typeof value === "number" && Number.isFinite(value) && value >= 0,
  );
}

export function classifyAIPlayerShortRolloutFailure(options: {
  completed: boolean;
  legal: boolean;
  qualityPercent: number;
  warnings: readonly string[];
}): AIPlayerEvalFailureMode {
  if (
    options.warnings.some((warning) => warning.startsWith("Opponent script "))
  )
    return "harness-artifact";
  if (!options.legal) return "illegal-action";
  if (!options.completed) {
    return options.warnings.some((warning) =>
      warning.startsWith("AI provider stopped"),
    )
      ? "turn-incomplete"
      : "provider";
  }
  return options.qualityPercent === 100 ? "none" : "strategy";
}

function createRunId(): string {
  return `short-rollout-${new Date().toISOString().replace(/[:.]/g, "-")}`;
}

export function selectAIPlayerShortRolloutSystemPrompt(
  decisionKind: AIPlayerShortRolloutDecisionKind,
  baseSystemPrompt: string,
  ordinaryTurnSystemPrompt: string,
  promptExperimentScope: AIPlayerShortRolloutPromptScope = "ordinary-turns",
): string {
  return promptExperimentScope === "all-candidate-decisions" ||
    decisionKind === "candidate-turn"
    ? ordinaryTurnSystemPrompt
    : baseSystemPrompt;
}

export async function evaluateCase(options: {
  runId: string;
  candidate: AIPlayerEvalCandidateDefinition;
  model: LanguageModel;
  scenario: AIPlayerShortRolloutScenario;
  repetition: number;
  baseSystemPrompt: string;
  ordinaryTurnSystemPrompt: string;
  promptExperimentScope: AIPlayerShortRolloutPromptScope;
  scratchpad?: "per-hand";
  tacticalPresentation?: AITacticalPresentation;
  reasoningReplay?: "within-turn";
  conversation?: "fresh" | "per-hand";
}): Promise<AIPlayerShortRolloutCaseResult> {
  validateConversationExperiment(options);
  if (options.conversation !== undefined && options.baseSystemPrompt !== options.ordinaryTurnSystemPrompt) {
    throw new Error("Conversation comparison must use identical unchanged system prompts");
  }
  const {
    runId,
    candidate,
    model,
    scenario,
    repetition,
    baseSystemPrompt,
    ordinaryTurnSystemPrompt,
    promptExperimentScope,
  } = options;
  const history = await createAIPlayerRolloutHistory(scenario, repetition);
  const { actor } = history;
  const lineageId = JSON.stringify([runId, scenario.identity.id, repetition]);
  const conversation = options.conversation === "per-hand" ? new AIHandConversation({
    gameId: projectAIPlayerFixedStateSnapshot(actor).gameId,
    playerId: scenario.evaluatedPlayerId, lineageId,
  }) : undefined;
  const decisionContext = options.conversation === undefined ? undefined : {
    lineageId, modelConfigurationSha256: candidate.modelConfigurationSha256, conversation,
  };
  const conversationDecisions: NonNullable<AIPlayerShortRolloutCaseResult["conversation"]>["decisions"] = [];
  // A new instance per trial: no note seeds or cross-case/repetition memory.
  const scratchpad = options.scratchpad === undefined ? undefined : new AIHandScratchpad(
    projectAIPlayerFixedStateSnapshot(actor).gameId, scenario.evaluatedPlayerId,
  );
  const scratchpadDecisions: NonNullable<AIPlayerShortRolloutCaseResult["scratchpad"]>["decisions"] = [];
  const candidateAttempts: AIPlayerFixedStateAttempt[] = [];
  const attempts: AIPlayerRolloutAttempt[] = [];
  const toolRequests: AIPlayerShortRolloutCaseResult["toolRequests"] = [];
  let opponentActionsLegal = true;
  const decisions: AIPlayerShortRolloutDecisionRecord[] = [];
  const actions: string[] = [];
  const warnings: string[] = [];
  const metrics: AITurnMetrics[] = [];
  const inputStates: string[] = [];
  const providerLatencyPerDecisionMs: number[] = [];
  const wallDurationPerDecisionMs: number[] = [];
  let candidateTurns = 0;
  let organizationExpectedTurns = 0;
  let correctlyOrganizedTurns = 0;
  const caseStartedAt = performance.now();

  try {
    for (const decision of scenario.referenceSequence) {
      const snapshot = projectAIPlayerFixedStateSnapshot(actor);
      if (isAIPlayerRolloutTerminal(snapshot)) break;
      if (decision.kind === "opponent-script") {
        const plannedActions = resolveAIPlayerRolloutActions(
          decision,
          snapshot,
        );
        const onlyAllowsMayI = plannedActions.every(
          (action) => action.type === "ALLOW_MAY_I",
        );
        if (onlyAllowsMayI && snapshot.phase !== "RESOLVING_MAY_I") continue;

        const state = history.createRuntime(decision.playerId);
        for (const action of plannedActions) {
          if (isAIPlayerRolloutTerminal(await state.runtime.getSnapshot()))
            break;
          const result = await state.runtime.executeAction(action);
          if (!result.ok) {
            opponentActionsLegal = false;
            warnings.push(
              `Opponent script ${decision.playerId}/${action.type}: ${result.error}`,
            );
            break;
          }
        }
        attempts.push(
          ...state.attempts.map((attempt) => ({
            ...attempt,
            playerId: decision.playerId,
            kind: decision.kind,
          })),
        );
        if (!opponentActionsLegal) break;
        continue;
      }

      const state = history.createRuntime(scenario.evaluatedPlayerId);
      const before = await state.runtime.getSnapshot();
      const toolRequestJournal = new AIToolRequestJournal();
      const organization = decision.kind === "candidate-turn"
        ? new AIPlayerOrganizationTracker(before, scenario.evaluatedPlayerId, scenario.organizationOrder)
        : undefined;
      const recorder = new AIPlayerRolloutDecisionRecorder(scenario.evaluatedPlayerId);
      const runtime = recorder.wrap(organization?.wrap(state.runtime) ?? state.runtime);
      const actionLog = history.getActionLog();
      const priorNote = scratchpad?.read({ ...before, playerId: scenario.evaluatedPlayerId });
      const publicInput = outputGameStateForLLM(before, scenario.evaluatedPlayerId, { actionLog, tacticalPresentation: options.tacticalPresentation });
      inputStates.push(scratchpad === undefined ? publicInput : appendAIStrategyNoteContext(publicInput, priorNote));

      let success = false;
      let observedMayIDecision: "call" | "pass" | "incomplete" | undefined;
      let decisionMetric: AITurnMetrics | undefined;
      let decisionActions: string[] = [];
      let decisionError: string | undefined;
      let scratchpadTrace: AIHandScratchpadTrace | undefined;
      let decisionContextTrace: AIPlayerDecisionContextTrace | undefined;
      const decisionStartedAt = performance.now();
      const systemPrompt = selectAIPlayerShortRolloutSystemPrompt(
        decision.kind,
        baseSystemPrompt,
        ordinaryTurnSystemPrompt,
        promptExperimentScope,
      );

      if (decision.kind === "candidate-may-i") {
        if (
          getEligibleMayICallerIds(before).includes(scenario.evaluatedPlayerId)
        ) {
          const result = await executeMayICallDecision({
            model,
            modelId: candidate.modelId,
            runtime,
            toolRequestJournal,
            decisionContext,
            playerId: scenario.evaluatedPlayerId,
            playerName: "Evaluated Player",
            maxRetries: 1,
            debug: false,
            telemetry: false,
            actionLog,
            systemPrompt,
            scratchpad,
            tacticalPresentation: options.tacticalPresentation,
          });
          success = result.success;
          observedMayIDecision = result.decision;
          decisionMetric = result.metrics;
          decisionActions = result.actions;
          decisionError = result.error;
          decisionContextTrace = result.decisionContextTrace;
        } else {
          observedMayIDecision = "incomplete";
          decisionError = "Expected May I opportunity was not available";
        }
      } else if (before.awaitingPlayerId === scenario.evaluatedPlayerId) {
        const result = await executeTurn({
          model,
          modelId: candidate.modelId,
          runtime,
          toolRequestJournal,
          decisionContext,
          playerId: scenario.evaluatedPlayerId,
          playerName: "Evaluated Player",
          maxSteps: 10,
          maxRetries: 1,
          debug: false,
          telemetry: false,
          actionLog,
          systemPrompt,
          scratchpad,
          tacticalPresentation: options.tacticalPresentation,
        });
        success = result.success;
        decisionMetric = result.metrics;
        decisionActions = result.actions;
        decisionError = result.error;
        scratchpadTrace = result.scratchpadTrace;
        decisionContextTrace = result.decisionContextTrace;
      } else {
        decisionError = `Expected ${scenario.evaluatedPlayerId}, awaiting ${before.awaitingPlayerId ?? "nobody"}`;
      }

      if (options.conversation !== undefined) {
        conversationDecisions.push({
          decisionIndex: decisions.length, kind: decision.kind,
          usageAvailable: hasAIPlayerDecisionUsage(decisionMetric),
          ...(decisionContextTrace === undefined ? {} : { trace: decisionContextTrace }),
        });
      }
      if (scratchpad !== undefined) {
        scratchpadDecisions.push({
          decisionIndex: decisions.length,
          kind: decision.kind,
          ...(scratchpadTrace ?? {
            before: priorNote,
            proposed: undefined,
            after: scratchpad.read({ ...await state.runtime.getSnapshot(), playerId: scenario.evaluatedPlayerId }),
            outcome: success ? "unchanged" : "discarded",
          }),
        });
      }

      wallDurationPerDecisionMs.push(
        Math.round(performance.now() - decisionStartedAt),
      );
      if (decisionMetric !== undefined) {
        metrics.push(decisionMetric);
        providerLatencyPerDecisionMs.push(
          Math.round(decisionMetric.providerDurationMs),
        );
      }
      actions.push(...decisionActions);
      const requests = toolRequestJournal.requests;
      toolRequests.push(...requests.map(request => ({
        ...request, decisionIndex: decisions.length, kind: decision.kind,
      })));
      for (const request of requests) {
        if (request.status !== "succeeded") warnings.push(
          `Tool request ${decisions.length}/${request.stepNumber}/${request.toolCallId} ${request.toolName}: ${request.status}${request.error === undefined ? "" : ` — ${request.error}`}`,
        );
      }
      if (decisionError !== undefined) warnings.push(decisionError);
      candidateAttempts.push(...state.attempts);
      attempts.push(
        ...state.attempts.map((attempt) => ({
          ...attempt,
          playerId: scenario.evaluatedPlayerId,
          kind: decision.kind,
        })),
      );
      decisions.push({
        playerId: scenario.evaluatedPlayerId,
        kind: decision.kind,
        success,
        actionEvidence: recorder.evidence,
        ...(observedMayIDecision === undefined
          ? {}
          : { mayIDecision: observedMayIDecision }),
      });

      if (decision.kind === "candidate-turn") {
        candidateTurns++;
        organizationExpectedTurns += organization?.summary.expectedTurns ?? 0;
        correctlyOrganizedTurns += organization?.summary.correctTurns ?? 0;
      }
      // Preserve the failed invocation; later scripted steps presume it finished.
      if (!success) break;
    }

    const finalSnapshot = projectAIPlayerFixedStateSnapshot(actor);
    const completed = isAIPlayerRolloutComplete({
      snapshot: finalSnapshot,
      decisions,
      maxModelDecisions: scenario.maxModelDecisions,
      opponentActionsLegal,
    });
    const legal = candidateAttempts.every((attempt) => attempt.ok);
    const criteria = scenario.grade({
      snapshot: finalSnapshot,
      candidateAttempts,
      decisions,
    });
    const ungatedQualityPercent = scoreAIPlayerShortRolloutCriteria(criteria);
    const qualityPercent = completed && legal ? ungatedQualityPercent : 0;
    const usage = usageFromMetrics(metrics);
    const totalCostUsd = metrics.reduce(
      (total, metric) => total + decisionCostUsd(metric, candidate),
      0,
    );
    const organizationComplianceRate =
      organizationExpectedTurns === 0
        ? undefined
        : correctlyOrganizedTurns / organizationExpectedTurns;

    return {
      schemaVersion: 7,
      scopeVersion: AI_PLAYER_ROLLOUT_SCOPE_VERSION,
      eligibility: getAIPlayerRolloutScope(scenario.identity.id),
      harnessVersion: AI_PLAYER_SHORT_ROLLOUT_HARNESS_VERSION,
      observationVersion: AI_PLAYER_ROLLOUT_OBSERVATION_VERSION,
      attempts,
      decisions,
      toolRequests,
      toolRequestHealth: summarizeAIToolRequests(toolRequests),
      finalSnapshot,
      runId,
      candidateId: candidate.id as SparkHillClimbCandidateId,
      scenarioId: scenario.identity.id,
      repetition,
      qualityPercent,
      completed,
      legal,
      criteria,
      failureMode: classifyAIPlayerShortRolloutFailure({
        completed,
        legal,
        qualityPercent,
        warnings,
      }),
      candidateTurns,
      modelDecisions: decisions.length,
      organization: {
        expectedTurns: organizationExpectedTurns,
        correctlyOrganizedTurns,
        complianceRate: organizationComplianceRate,
      },
      providerLatencyMs: Math.round(
        metrics.reduce((total, metric) => total + metric.providerDurationMs, 0),
      ),
      wallDurationMs: Math.round(performance.now() - caseStartedAt),
      providerLatencyPerDecisionMs,
      wallDurationPerDecisionMs,
      usage,
      totalCostUsd,
      inputStates,
      ...(options.conversation === undefined ? {} : {
        conversation: { mode: options.conversation, version: AI_HAND_CONVERSATION_VERSION, decisions: conversationDecisions },
      }),
      ...(options.tacticalPresentation === undefined ? {} : {
        tacticalPresentation: { mode: options.tacticalPresentation, version: getAITacticalPresentationVersion(options.tacticalPresentation) },
      }),
      ...(options.reasoningReplay === undefined ? {} : {
        reasoningReplay: { mode: options.reasoningReplay, version: AI_REASONING_REPLAY_VERSION },
      }),
      ...(scratchpad === undefined ? {} : {
        scratchpad: { version: AI_HAND_SCRATCHPAD_VERSION, decisions: scratchpadDecisions },
      }),
      actions,
      warnings,
    };
  } finally {
    actor.stop();
  }
}

function percentile(
  values: readonly number[],
  requestedPercentile: number,
): number | undefined {
  if (values.length === 0) return undefined;
  const ordered = [...values].sort((left, right) => left - right);
  const index = Math.max(
    0,
    Math.min(
      ordered.length - 1,
      Math.ceil((requestedPercentile / 100) * ordered.length) - 1,
    ),
  );
  return ordered[index];
}

function aggregate(
  results: readonly AIPlayerShortRolloutCaseResult[],
): AIPlayerShortRolloutAggregate {
  const caseCount = results.length;
  const organizationExpectedTurns = results.reduce(
    (total, result) => total + result.organization.expectedTurns,
    0,
  );
  const correctlyOrganizedTurns = results.reduce(
    (total, result) => total + result.organization.correctlyOrganizedTurns,
    0,
  );
  const providerValues = results.flatMap(
    (result) => result.providerLatencyPerDecisionMs,
  );
  const wallValues = results.flatMap(
    (result) => result.wallDurationPerDecisionMs,
  );
  const totalCostUsd = results.reduce(
    (total, result) => total + result.totalCostUsd,
    0,
  );
  return {
    caseCount,
    qualityPercent:
      caseCount === 0
        ? 0
        : results.reduce((total, result) => total + result.qualityPercent, 0) /
          caseCount,
    completionRate:
      caseCount === 0
        ? 0
        : results.filter((result) => result.completed).length / caseCount,
    legalRate:
      caseCount === 0
        ? 0
        : results.filter((result) => result.legal).length / caseCount,
    toolRequestHealth: summarizeAIToolRequests(results.flatMap(result => result.toolRequests)),
    organizationComplianceRate:
      organizationExpectedTurns === 0
        ? undefined
        : correctlyOrganizedTurns / organizationExpectedTurns,
    providerLatencyPerDecisionMs: {
      p50: percentile(providerValues, 50),
      p95: percentile(providerValues, 95),
    },
    wallDurationPerDecisionMs: {
      p50: percentile(wallValues, 50),
      p95: percentile(wallValues, 95),
    },
    totalCostUsd,
    costPerCaseUsd: caseCount === 0 ? undefined : totalCostUsd / caseCount,
  };
}

export function summarizeAIPlayerShortRollout(
  runId: string,
  candidateId: SparkHillClimbCandidateId,
  repetitions: number,
  results: readonly AIPlayerShortRolloutCaseResult[],
  split: AIPlayerShortRolloutSplit,
  concurrency: number,
  selection: AIPlayerRolloutSelection,
): AIPlayerShortRolloutSummary {
  const scenarioIds = [...new Set(results.map((result) => result.scenarioId))];
  const { qualityPercent: diagnosticQualityPercent, ...metrics } =
    aggregate(results);
  return {
    schemaVersion: 7,
    selection,
    scopeScores: summarizeAIPlayerRolloutScopeScores(results),
    harnessVersion: AI_PLAYER_SHORT_ROLLOUT_HARNESS_VERSION,
    observationVersion: AI_PLAYER_ROLLOUT_OBSERVATION_VERSION,
    runId,
    candidateId,
    suiteVersion: AI_PLAYER_SHORT_ROLLOUT_SUITE_VERSION,
    split,
    concurrency,
    repetitions,
    ...metrics,
    diagnosticQualityPercent,
    scenarios: scenarioIds.map((scenarioId) => ({
      scenarioId,
      assessment:
        AI_PLAYER_SHORT_ROLLOUT_SCENARIOS.find(
          (scenario) => scenario.identity.id === scenarioId,
        )?.assessment ?? "strategic-preference",
      ...aggregate(
        results.filter((result) => result.scenarioId === scenarioId),
      ),
    })),
  };
}

function percent(value: number | undefined): string {
  return value === undefined ? "n/a" : `${(value * 100).toFixed(1)}%`;
}

function milliseconds(value: number | undefined): string {
  return value === undefined ? "n/a" : Math.round(value).toString();
}

function formatSummary(summary: AIPlayerShortRolloutSummary): string {
  return [
    "# AI Player Short Rollout Evaluation",
    "",
    `Run: \`${summary.runId}\``,
    `Candidate: \`${summary.candidateId}\``,
    `Suite: \`${summary.suiteVersion}\``,
    `Harness: \`${summary.harnessVersion}\``,
    `Observation: \`${summary.observationVersion}\``,
    `Split: \`${summary.split}\``,
    `Eligibility: \`${summary.selection.scopeVersion}\`; requested scope: \`${summary.selection.requestedScope}\``,
    `Complete eligible split: ${summary.selection.fullEligibleSplit ? "yes" : "no — selected diagnostic only"}`,
    `Strategic coverage: ${summary.selection.coverage.strategyDevelopmentCases} development cases / ${summary.selection.coverage.strategyDevelopmentFamilies.length} families; ${summary.selection.coverage.strategyHoldoutCases} holdout cases`,
    `Concurrent trials: ${summary.concurrency}`,
    `Repetitions per scenario: ${summary.repetitions}`,
    "",
    "Gameplay quality excludes hand-organization compliance. Provider timing excludes presentation pacing.",
    "Quality is a frozen-rubric score, not a game win rate. Strategic preferences are not proofs about hidden cards; scripted outcomes are conditional on the fixed opponent continuation.",
    "",
    `Strategy quality: ${summary.scopeScores.strategy.qualityPercent === null ? "not evaluated" : `${summary.scopeScores.strategy.qualityPercent.toFixed(1)}%`}`,
    `Robustness/mechanics quality: ${summary.scopeScores.robustness.qualityPercent === null ? "not evaluated" : `${summary.scopeScores.robustness.qualityPercent.toFixed(1)}%`}`,
    `Diagnostic mean across all selected cases (not a strategy ranking): ${summary.diagnosticQualityPercent.toFixed(1)}%`,
    ...(summary.selection.coverage.strategyHoldoutCases === 0
      ? [
          "Benchmark setup remains incomplete: no representative strategic holdout exists. Do not promote a player from these scores.",
        ]
      : []),
    `Completed: ${percent(summary.completionRate)}`,
    `Engine-legal cases: ${percent(summary.legalRate)} (excludes pre-engine tool rejections)`,
    `Tool requests: ${summary.toolRequestHealth.succeeded}/${summary.toolRequestHealth.total} succeeded; ${summary.toolRequestHealth.rejected} rejected, ${summary.toolRequestHealth.errors} errors, ${summary.toolRequestHealth.unresolved} unresolved`,
    `Correct hand organization: ${percent(summary.organizationComplianceRate)}`,
    `Provider time per model decision: p50 ${milliseconds(summary.providerLatencyPerDecisionMs.p50)} ms, p95 ${milliseconds(summary.providerLatencyPerDecisionMs.p95)} ms`,
    `Wall time per model decision: p50 ${milliseconds(summary.wallDurationPerDecisionMs.p50)} ms, p95 ${milliseconds(summary.wallDurationPerDecisionMs.p95)} ms`,
    `Total cost: $${summary.totalCostUsd.toFixed(6)}`,
    `Cost per case: $${(summary.costPerCaseUsd ?? 0).toFixed(6)}`,
    "",
    "Scenario | Assessment | Cases | Quality | Completed | Legal | Organized | Provider p50 ms | Cost",
    "--- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---:",
    ...summary.scenarios.map((scenario) =>
      [
        scenario.scenarioId,
        scenario.assessment,
        scenario.caseCount,
        `${scenario.qualityPercent.toFixed(1)}%`,
        percent(scenario.completionRate),
        percent(scenario.legalRate),
        percent(scenario.organizationComplianceRate),
        milliseconds(scenario.providerLatencyPerDecisionMs.p50),
        `$${scenario.totalCostUsd.toFixed(6)}`,
      ].join(" | "),
    ),
    "",
  ].join("\n");
}

export async function runAIPlayerShortRollout(
  options: AIPlayerShortRolloutRunnerOptions,
): Promise<{
  directory: string;
  results: AIPlayerShortRolloutCaseResult[];
  summary: AIPlayerShortRolloutSummary;
}> {
  validateConversationExperiment(options);
  if (options.describe)
    throw new Error(
      "Description-only requests must not execute provider trials",
    );
  const runId = options.runId ?? createRunId();
  const baselineCandidate = AI_PLAYER_EVAL_CANDIDATES[options.candidateId];
  const modelSnapshot = createAIPlayerEvalModelConfigurationSnapshot(
    "default:meta", baselineCandidate.reasoningEffort,
    { retainReasoning: options.reasoningReplay === "within-turn" },
  );
  const candidate = {
    ...baselineCandidate,
    modelConfiguration: modelSnapshot.configuration,
    modelConfigurationSha256: modelSnapshot.sha256,
  };
  const scenarios = selectAIPlayerShortRolloutScenarios(
    options.scenarioIds,
    options.split,
    options.scope,
  );
  const selection = buildAIPlayerRolloutSelection(
    AI_PLAYER_SHORT_ROLLOUT_SCENARIOS,
    {
      scenarioIds: options.scenarioIds,
      split: options.split,
      scope: options.scope,
    },
  );
  const prompt = await loadAIPlayerEvalPromptSelection({
    baseVersion: candidate.promptVersion,
    baseContent: buildSystemPrompt(),
    experiment: options.promptExperiment,
  });
  const model = createAIPlayerEvalModel({
    ...candidate,
    promptVersion: prompt.version,
  }, { retainReasoning: options.reasoningReplay === "within-turn" });
  const directory = await createAIPlayerEvalRunDirectory(
    ".data/ai-evals",
    runId,
  );

  await writeFile(
    `${directory}/manifest.json`,
    JSON.stringify(
      {
        schemaVersion: 7,
        selection,
        harnessVersion: AI_PLAYER_SHORT_ROLLOUT_HARNESS_VERSION,
        runId,
        suiteVersion: AI_PLAYER_SHORT_ROLLOUT_SUITE_VERSION,
        runtimeVersion: AI_PLAYER_FIXED_STATE_RUNTIME_VERSION,
        observationVersion: AI_PLAYER_ROLLOUT_OBSERVATION_VERSION,
        split: options.split,
        concurrency: options.concurrency,
        candidate,
        prompt,
        promptExperimentScope: options.promptExperimentScope,
        conversation: options.conversation === undefined ? null : {
          mode: options.conversation, version: AI_HAND_CONVERSATION_VERSION,
          lifetime: "private to one game/player/hand; empty per case/repetition; serialized runtime",
          trace: "exact execution-API observation and message hashes; no raw encrypted reasoning",
          costCoverage: "Known recorded cost only; decisions without usage are explicitly flagged",
        },
        reasoningReplay: options.reasoningReplay === undefined ? null : {
          mode: options.reasoningReplay, version: AI_REASONING_REPLAY_VERSION,
          scope: "AI SDK tool-call reasoning retention; cross-decision history is configured separately by conversation",
        },
        tacticalPresentation: options.tacticalPresentation === undefined ? null : {
          mode: options.tacticalPresentation, version: getAITacticalPresentationVersion(options.tacticalPresentation),
        },
        scratchpad: options.scratchpad === undefined ? null : {
          mode: options.scratchpad, version: AI_HAND_SCRATCHPAD_VERSION,
          writer: "discard.strategy_note", maxCharacters: 400, maxLines: 2,
          lifetime: "one game/player/hand; empty per trial",
        },
        repetitions: options.repetitions,
        pacingDelayMs: 0,
        costCapUsd: null,
        scenarios: scenarios.map((scenario) => ({
          ...scenario.identity,
          eligibility: getAIPlayerRolloutScope(scenario.identity.id),
          assessment: scenario.assessment,
          initialHistorySource:
            scenario.historyPrelude !== undefined
              ? "replayed-public-actions"
              : scenario.actionLog?.length
                ? "constructed-fixture-history"
                : "no-recorded-prelude",
          objective: scenario.objective,
          organizationOrder: scenario.organizationOrder,
          maxCandidateTurns: scenario.maxCandidateTurns,
          maxModelDecisions: scenario.maxModelDecisions,
          rubric: scenario.rubric,
          opponentPolicyIds: [
            ...new Set(
              scenario.referenceSequence.flatMap((decision) =>
                decision.opponentPolicy ? [decision.opponentPolicy.id] : [],
              ),
            ),
          ],
        })),
      },
      null,
      2,
    ),
  );

  const trials = scenarios.flatMap((scenario) =>
    Array.from({ length: options.repetitions }, (_, index) => ({
      scenario,
      repetition: index + 1,
    })),
  );
  let completedTrials = 0;
  let artifactWrites = Promise.resolve();
  const results = await runAIPlayerEvalBatches(
    trials,
    options.concurrency,
    async ({ scenario, repetition }) => {
      const result = await evaluateCase({
        runId,
        candidate,
        model,
        scenario,
        repetition,
        baseSystemPrompt: buildSystemPrompt(),
        ordinaryTurnSystemPrompt: prompt.content,
        promptExperimentScope: options.promptExperimentScope,
        scratchpad: options.scratchpad,
        tacticalPresentation: options.tacticalPresentation,
        reasoningReplay: options.reasoningReplay,
        conversation: options.conversation,
      });
      // Serialize incremental file writes even though independent actors run in parallel.
      artifactWrites = artifactWrites.then(() =>
        appendFile(`${directory}/cases.jsonl`, `${JSON.stringify(result)}\n`),
      );
      await artifactWrites;
      completedTrials++;
      console.log(
        `[${completedTrials}/${trials.length}] ${scenario.identity.id} #${repetition}: ${result.qualityPercent.toFixed(0)}%, ${result.providerLatencyMs} ms, $${result.totalCostUsd.toFixed(6)}`,
      );
      return result;
    },
  );

  const summary = summarizeAIPlayerShortRollout(
    runId,
    options.candidateId,
    options.repetitions,
    results,
    options.split,
    options.concurrency,
    selection,
  );
  await writeFile(`${directory}/result.json`, JSON.stringify(summary, null, 2));
  await writeFile(`${directory}/summary.md`, formatSummary(summary));
  return { directory, results, summary };
}

if (import.meta.main) {
  try {
    const options = parseAIPlayerShortRolloutRunnerArguments(Bun.argv.slice(2));
    if (options.describe) {
      console.log(
        JSON.stringify(
          buildAIPlayerRolloutSelection(AI_PLAYER_SHORT_ROLLOUT_SCENARIOS, {
            scenarioIds: options.scenarioIds,
            split: options.split,
            scope: options.scope,
          }),
          null,
          2,
        ),
      );
    } else {
      const { directory, summary } = await runAIPlayerShortRollout(options);
      console.log(formatSummary(summary));
      console.log(`Artifacts: ${directory}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
