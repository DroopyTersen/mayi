import { appendAIStrategyNoteContext, type AIHandScratchpad } from "./mayIAgent.scratchpad";
import type { AITacticalPresentation } from "./mayIAgent.contract-options";
import type { AIToolRequestJournal } from "./ai-tool-request-journal";
import { beginAIPlayerDecisionContext, type AIPlayerDecisionContext, type AIPlayerDecisionContextOptions, type AIPlayerDecisionContextTrace } from "./mayIAgent.decision-context";
import {
  generateText,
  tool,
  type LanguageModel,
  type StepResult,
  type Telemetry,
} from "ai";
import { z } from "zod/v4";
import { getActionAvailabilityDetails } from "../core/engine/game-engine.availability";
import type { GameSnapshot } from "../core/engine/game-engine.types";
import type { AIActionRuntime } from "./ai-action-runtime.types";
import {
  summarizeAITurnMetrics,
  type AITurnMetrics,
} from "./ai-turn-metrics";
import { buildSystemPrompt } from "./mayIAgent.prompt";
import {
  outputGameStateForLLM,
  type ActionLogEntry,
} from "./mayIAgent.prompt-renderer";
import type { ToolExecutionResult } from "./mayIAgent.types";

export function getEligibleMayICallerIds(snapshot: GameSnapshot): string[] {
  return snapshot.players
    .filter(
      (player) =>
        getActionAvailabilityDetails(snapshot, player.id).availableActions.canMayI,
    )
    .map((player) => player.id);
}

export function createMayICallDecisionTools(
  runtime: AIActionRuntime,
  playerId: string,
  tacticalPresentation?: AITacticalPresentation,
) {
  return {
    call_may_i: tool({
      description:
        "Call May I to try to take the exposed discard plus one unknown penalty card from stock.",
      inputSchema: z.object({}),
      execute: async (): Promise<ToolExecutionResult> => {
        const result = await runtime.executeAction({ type: "CALL_MAY_I" });
        return {
          success: result.ok,
          message: result.ok ? "May I called" : result.error,
          gameState: outputGameStateForLLM(result.snapshot, playerId, { tacticalPresentation }),
          turnComplete: result.ok,
        };
      },
    }),
    pass_may_i: tool({
      description:
        "Pass on this exposed discard. Choose this when the discard plus an unknown penalty card is not worth the risk.",
      inputSchema: z.object({}),
      execute: async (): Promise<ToolExecutionResult> => {
        const snapshot = await runtime.getSnapshot();
        return {
          success: true,
          message: "Passed on May I",
          gameState: outputGameStateForLLM(snapshot, playerId, { tacticalPresentation }),
          turnComplete: true,
        };
      },
    }),
  };
}

export type MayICallDecisionTools = ReturnType<
  typeof createMayICallDecisionTools
>;

export const MAY_I_CALL_DECISION_PROMPT_VERSION = "may-i-call-v1";

export const MAY_I_CALL_DECISION_INSTRUCTIONS = `<may_i_call_decision>
OUT-OF-TURN MAY I OPPORTUNITY

The exposed discard is available now. If you call May I and win, you receive
that discard plus one unknown penalty card from stock. Compare how directly the
discard advances your exact contract against the extra-card and endgame risk.

Choose exactly one tool: call_may_i or pass_may_i. Never answer with text only.
</may_i_call_decision>`;

export function buildMayICallDecisionPrompt(
  snapshot: GameSnapshot,
  playerId: string,
  actionLog?: ActionLogEntry[],
  scratchpad?: AIHandScratchpad,
  tacticalPresentation?: AITacticalPresentation,
): string {
  const prompt = `${outputGameStateForLLM(snapshot, playerId, { actionLog, tacticalPresentation })}\n\n${MAY_I_CALL_DECISION_INSTRUCTIONS}`;
  return scratchpad === undefined ? prompt : appendAIStrategyNoteContext(prompt, scratchpad.read({ ...snapshot, playerId }));
}

export function stopWhenMayICallDecisionComplete(options: {
  steps: StepResult<MayICallDecisionTools>[];
}): boolean {
  if (options.steps.length >= 3) return true;
  return options.steps.some((step) =>
    step.toolResults.some((result) => {
      const output = result.output as ToolExecutionResult | undefined;
      return output?.success === true && output.turnComplete;
    }),
  );
}

export interface ExecuteMayICallDecisionConfig {
  model: LanguageModel;
  modelId?: string;
  runtime: AIActionRuntime;
  playerId: string;
  playerName?: string;
  debug?: boolean;
  telemetry?: boolean | Telemetry;
  actionLog?: ActionLogEntry[];
  abortSignal?: AbortSignal;
  maxRetries?: number;
  systemPrompt?: string;
  scratchpad?: AIHandScratchpad;
  tacticalPresentation?: AITacticalPresentation;
  /** Optional observer only; never rendered or sent to the model. */
  toolRequestJournal?: AIToolRequestJournal;
  decisionContext?: AIPlayerDecisionContextOptions;
}

export interface ExecuteMayICallDecisionResult {
  success: boolean;
  decision: "call" | "pass" | "incomplete";
  actions: string[];
  error?: string;
  aborted?: boolean;
  metrics?: AITurnMetrics;
  decisionContextTrace?: AIPlayerDecisionContextTrace;
}

function completedDecision(
  steps: StepResult<MayICallDecisionTools>[],
): "call" | "pass" | undefined {
  for (let stepIndex = steps.length - 1; stepIndex >= 0; stepIndex--) {
    const step = steps[stepIndex];
    if (step === undefined) continue;
    for (
      let resultIndex = step.toolResults.length - 1;
      resultIndex >= 0;
      resultIndex--
    ) {
      const result = step.toolResults[resultIndex];
      if (result === undefined) continue;
      const output = result.output as ToolExecutionResult | undefined;
      if (output?.success !== true || !output.turnComplete) continue;
      if (result.toolName === "call_may_i") return "call";
      if (result.toolName === "pass_may_i") return "pass";
    }
  }
  return undefined;
}

export async function executeMayICallDecision(
  config: ExecuteMayICallDecisionConfig,
): Promise<ExecuteMayICallDecisionResult> {
  const {
    model,
    modelId,
    runtime,
    playerId,
    playerName,
    debug = false,
    telemetry = true,
    actionLog,
    abortSignal,
    maxRetries,
    systemPrompt: systemPromptOverride,
  } = config;
  const snapshot = await runtime.getSnapshot();
  if (!getEligibleMayICallerIds(snapshot).includes(playerId)) {
    return {
      success: false,
      decision: "incomplete",
      actions: [],
      error: "May I is not available to this player in the current state",
    };
  }

  const tools = createMayICallDecisionTools(runtime, playerId, config.tacticalPresentation);
  const actions: string[] = [];
  const systemPrompt = systemPromptOverride ?? buildSystemPrompt();

  let decisionContext: AIPlayerDecisionContext | undefined;
  try {
    const observation = buildMayICallDecisionPrompt(snapshot, playerId, actionLog, config.scratchpad, config.tacticalPresentation);
    if (config.decisionContext !== undefined) {
      decisionContext = await beginAIPlayerDecisionContext({
        options: config.decisionContext, snapshot, playerId, modelId,
        systemPrompt, observation, kind: "may-i-call",
      });
    }
    const historyMessages = decisionContext?.messages;
    const startedAt = Date.now();
    const result = await generateText({
      model,
      instructions: systemPrompt,
      ...(historyMessages === undefined ? { prompt: observation } : { messages: historyMessages }),
      tools,
      toolOrder: ["call_may_i", "pass_may_i"],
      abortSignal,
      maxRetries,
      stopWhen: stopWhenMayICallDecisionComplete,
      runtimeContext: {
        playerId,
        playerName: playerName ?? playerId,
        gameId: snapshot.gameId,
        round: snapshot.currentRound,
        phase: snapshot.phase,
        turnPhase: snapshot.turnPhase,
        turnNumber: snapshot.turnNumber,
        decisionKind: "may-i-call",
      },
      telemetry: telemetry
        ? {
            isEnabled: true,
            functionId: "may-i-call-decision",
            ...(typeof telemetry === "object"
              ? { integrations: [telemetry] }
              : {}),
            includeRuntimeContext: {
              playerId: true,
              playerName: true,
              gameId: true,
              round: true,
              phase: true,
              turnPhase: true,
              turnNumber: true,
              decisionKind: true,
            },
          }
        : undefined,
      onStepStart: (step) => { config.toolRequestJournal?.startStep(step.stepNumber); },
      onLanguageModelCallEnd: (event) => { config.toolRequestJournal?.recordModelResponse(event); },
      onToolExecutionEnd: (event) => { config.toolRequestJournal?.recordToolOutput(event.toolOutput); },
      onStepEnd: async (step) => {
        config.toolRequestJournal?.recordStep(step);
        for (const call of step.toolCalls) {
          actions.push(`${call.toolName}(${JSON.stringify(call.input)})`);
          if (debug) {
            console.log(`[AI May I] ${playerId}: ${actions.at(-1)}`);
          }
        }
      },
    });
    const metrics = summarizeAITurnMetrics({
      turnDurationMs: Date.now() - startedAt,
      stepPerformance: result.steps.map((step) => step.performance),
      usage: result.usage,
      stepProviderMetadata: result.steps.map((step) => step.providerMetadata),
    });
    const decision = completedDecision(result.steps);
    const contextResult = await decisionContext?.finish({
      latestSnapshot: await runtime.getSnapshot().catch(() => undefined),
      responseMessages: result.responseMessages, completed: decision !== undefined,
      mayICallDecision: decision, abortSignal,
    });
    const contextFields = contextResult === undefined ? {} : {
      decisionContextTrace: contextResult.trace,
      ...(contextResult.aborted ? { aborted: true } : {}),
    };
    return decision === undefined || contextResult?.completed === false
      ? {
          success: false,
          decision: "incomplete",
          actions,
          error: `AI provider stopped after ${result.steps.length} step(s) without a May I call-or-pass decision`,
          metrics,
          ...contextFields,
        }
      : { success: true, decision, actions, metrics, ...contextFields };
  } catch (error) {
    const aborted =
      abortSignal?.aborted ||
      (error instanceof Error && error.name === "AbortError");
    const contextResult = await decisionContext?.finish({
      latestSnapshot: await runtime.getSnapshot().catch(() => undefined),
      responseMessages: [], completed: false, abortSignal, aborted,
    });
    return {
      success: false,
      decision: "incomplete",
      actions,
      ...(contextResult === undefined ? {} : { decisionContextTrace: contextResult.trace }),
      error: error instanceof Error ? error.message : String(error),
      ...(aborted ? { aborted: true } : {}),
    };
  }
}
