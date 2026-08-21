/**
 * May I? AI Agent
 *
 * Executes turns for AI players using an LLM with tool-based actions.
 */

import { generateText, type LanguageModel, type StepResult } from "ai";
import type { AIActionRuntime } from "./ai-action-runtime.types";
import {
  summarizeAITurnMetrics,
  type AITurnMetrics,
} from "./ai-turn-metrics";
import {
  outputGameStateForLLM,
  type ActionLogEntry,
} from "./mayIAgent.prompt-renderer";
import { buildSystemPrompt } from "./mayIAgent.prompt";
import {
  createMayITools,
  type MayITools,
} from "./mayIAgent.tools";
import { getAvailableToolNames } from "./mayIAgent.tool-availability";
import type { AIPlayerRegistry } from "./aiPlayer.registry";
import type { ToolExecutionResult } from "./mayIAgent.types";
import {
  createOpenAILunaInstructions,
  createOpenAILunaProviderOptions,
  isOpenAILunaModel,
} from "./openai-luna-profile";
import {
  createOpenAIContinuationMessages,
  type OpenAIResponseContinuation,
} from "./openai-response-lineage";

/**
 * Stop condition: stop when turn is complete or max steps reached
 */
export function stopWhenTurnComplete(
  maxSteps: number
): (options: { steps: StepResult<MayITools>[] }) => boolean {
  return ({ steps }) => {
    // Stop if max steps reached
    if (steps.length >= maxSteps) {
      return true;
    }

    // Stop if any tool returned turnComplete: true
    for (const step of steps) {
      if (step.toolResults) {
        for (const result of step.toolResults) {
          const output = result.output as ToolExecutionResult | undefined;
          if (output?.turnComplete) {
            return true;
          }
        }
      }
    }

    return false;
  };
}

/**
 * Configuration for executing an AI turn
 */
export interface ExecuteTurnConfig {
  /** The language model to use for decisions */
  model: LanguageModel;

  /** Stable configured model ID, used for provider-specific behavior. */
  modelId?: string;

  /** Runtime that reads latest game state and executes queued game actions */
  runtime: AIActionRuntime;

  /** The player ID this AI is controlling */
  playerId: string;

  /** The player's display name (for telemetry/devtools). Default: playerId */
  playerName?: string;

  /** Maximum steps (tool calls) per turn. Default: 10 */
  maxSteps?: number;

  /** Enable debug logging. Default: false */
  debug?: boolean;

  /** Enable telemetry/devtools. Default: true */
  telemetry?: boolean;

  /** Optional action log entries for LLM context (only used in CLI mode) */
  actionLog?: ActionLogEntry[];

  /** AbortSignal to cancel the LLM call mid-turn (e.g., when May-I is called) */
  abortSignal?: AbortSignal;

  /** Maximum retries for failed AI SDK provider calls. Default: AI SDK default. */
  maxRetries?: number;

  /** Previously committed OpenAI response and its terminal tool result. */
  continuation?: OpenAIResponseContinuation;
}

/**
 * Result of executing an AI turn
 */
export interface ExecuteTurnResult {
  /** Whether the turn completed successfully */
  success: boolean;

  /** Summary of actions taken */
  actions: string[];

  /** Error message if failed */
  error?: string;

  /** OpenAI response state that can be committed after a completed turn. */
  continuation?: OpenAIResponseContinuation;

  /** True when execution stopped because an external event aborted it. */
  aborted?: boolean;

  /** Provider, tool, orchestration, and token accounting for the turn. */
  metrics?: AITurnMetrics;

}

function getOpenAIResponseId(
  providerMetadata: Record<string, Record<string, unknown>> | undefined,
): string | undefined {
  const responseId = providerMetadata?.openai?.responseId;
  return typeof responseId === "string" && responseId.length > 0
    ? responseId
    : undefined;
}

function getTerminalToolResult(
  steps: StepResult<MayITools>[],
): OpenAIResponseContinuation["pendingToolResult"] | undefined {
  for (let stepIndex = steps.length - 1; stepIndex >= 0; stepIndex--) {
    const step = steps[stepIndex];
    if (!step) continue;

    for (
      let resultIndex = step.toolResults.length - 1;
      resultIndex >= 0;
      resultIndex--
    ) {
      const result = step.toolResults[resultIndex];
      if (!result) continue;
      const output = result.output as ToolExecutionResult | undefined;
      if (!output?.success || !output.turnComplete) continue;

      return {
        toolCallId: result.toolCallId,
        toolName: result.toolName,
        output: JSON.stringify(output),
      };
    }
  }

  return undefined;
}

/**
 * Execute a turn for the AI player
 *
 * Loops until it's no longer this player's turn (or max steps reached).
 * Uses generateText with tools filtered by the current game phase.
 */
export async function executeTurn(
  config: ExecuteTurnConfig
): Promise<ExecuteTurnResult> {
  const {
    model,
    modelId,
    runtime,
    playerId,
    playerName,
    maxSteps = 10,
    debug = false,
    telemetry = true,
    actionLog,
    abortSignal,
    maxRetries,
    continuation,
  } = config;

  const tools = createMayITools(runtime, playerId, { actionLog });
  const systemPrompt = buildSystemPrompt();
  const actions: string[] = [];
  const isLuna = isOpenAILunaModel(modelId);

  // Check if it's this player's turn
  let currentState = await runtime.getSnapshot();
  if (currentState.awaitingPlayerId !== playerId) {
    return {
      success: false,
      actions: [],
      error: `Not this player's turn. Awaiting: ${currentState.awaitingPlayerId}`,
    };
  }

  const currentPlayer = currentState.players.find((p) => p.id === playerId);

  if (debug) {
    console.log(`\n[AI] Starting turn for ${playerId}`);
    console.log(`[AI] Phase: ${currentState.phase} / ${currentState.turnPhase}`);
  }

  const initialGameState = outputGameStateForLLM(currentState, playerId, { actionLog });
  const promptInput =
    isLuna && continuation !== undefined
      ? {
          messages: createOpenAIContinuationMessages(
            continuation.pendingToolResult,
            initialGameState,
          ),
        }
      : { prompt: initialGameState };

  try {
    // Get display name for telemetry
    const displayName = playerName ?? currentPlayer?.name ?? playerId;

    // Execute the agent loop with dynamic tool selection via prepareStep
    const turnStartedAt = Date.now();
    const result = await generateText({
      model,
      instructions: isLuna
        ? createOpenAILunaInstructions(systemPrompt)
        : systemPrompt,
      ...promptInput,
      tools,
      toolOrder: Object.keys(tools) as (keyof MayITools)[],
      providerOptions: isLuna
        ? {
            openai: createOpenAILunaProviderOptions({
              previousResponseId: continuation?.responseId,
            }),
          }
        : undefined,
      abortSignal,
      maxRetries,
      stopWhen: stopWhenTurnComplete(maxSteps),
      prepareStep: async () => {
        // Get current game state (may have changed since last step)
        const currentState = await runtime.getSnapshot();

        // Get tools available for current snapshot
        const activeToolNames = getAvailableToolNames(currentState, playerId) as (keyof MayITools)[];

        if (debug) {
          console.log(
            `[AI] Phase: ${currentState.phase} / ${currentState.turnPhase}, Available tools: ${activeToolNames.join(", ")}`
          );
        }

        if (isLuna && activeToolNames.length > 0) {
          return {
            providerOptions: {
              openai: createOpenAILunaProviderOptions({
                allowedToolNames: activeToolNames,
              }),
            },
          };
        }

        return { activeTools: activeToolNames };
      },
      runtimeContext: {
        playerId,
        playerName: displayName,
        gameId: currentState.gameId,
        round: currentState.currentRound,
        phase: currentState.phase,
        turnPhase: currentState.turnPhase,
        turnNumber: currentState.turnNumber,
      },
      telemetry: telemetry
        ? {
            isEnabled: true,
            functionId: "may-i-agent",
            recordInputs: false,
            recordOutputs: false,
            includeRuntimeContext: {
              playerId: true,
              playerName: true,
              gameId: true,
              round: true,
              phase: true,
              turnPhase: true,
              turnNumber: true,
            },
          }
        : undefined,
      onStepEnd: async (step) => {
        if (step.toolCalls && step.toolCalls.length > 0) {
          for (const call of step.toolCalls) {
            const actionName = call.toolName;
            const inputStr = JSON.stringify(call.input);
            actions.push(`${actionName}(${inputStr})`);

            if (debug) {
              console.log(`[AI] Action: ${actionName}(${inputStr})`);
            }
          }
        }

        if (step.toolResults && step.toolResults.length > 0) {
          for (const toolResult of step.toolResults) {
            if (debug && typeof toolResult.output === "object" && toolResult.output !== null) {
              const r = toolResult.output as { success?: boolean; message?: string; turnComplete?: boolean };
              console.log(`[AI] Result: ${r.message}`);
              if (r.turnComplete) {
                console.log(`[AI] Turn complete`);
              }
            }
          }
        }
      },
    });
    const turnDurationMs = Date.now() - turnStartedAt;

    if (debug) {
      console.log(`[AI] Total steps: ${result.steps.length}`);
      console.log(`[AI] Finish reason: ${result.finishReason}`);
    }

    const metrics = summarizeAITurnMetrics({
      turnDurationMs,
      stepPerformance: result.steps.map((step) => step.performance),
      usage: result.usage,
    });
    const pendingToolResult = getTerminalToolResult(result.steps);
    const responseId =
      pendingToolResult === undefined
        ? undefined
        : getOpenAIResponseId(result.finalStep.providerMetadata);
    const completed = pendingToolResult !== undefined;
    return {
      success: completed,
      actions,
      ...(completed
        ? {}
        : {
            error: `AI provider stopped after ${result.steps.length} step(s) without completing the game turn`,
          }),
      ...(responseId === undefined || pendingToolResult === undefined
        ? {}
        : {
            continuation: {
              responseId,
              pendingToolResult,
            },
      }),
      metrics,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const aborted =
      abortSignal?.aborted ||
      (error instanceof Error && error.name === "AbortError");
    return {
      success: false,
      actions,
      error: errorMessage,
      ...(aborted ? { aborted: true } : {}),
    };
  }
}

/**
 * Configuration for executing an AI turn using the registry
 */
export interface ExecuteAITurnConfig {
  /** Runtime that reads latest game state and executes queued game actions */
  runtime: AIActionRuntime;

  /** The player ID to execute turn for */
  playerId: string;

  /** The AI player registry */
  registry: AIPlayerRegistry;

  /** Maximum steps (tool calls) per turn. Default: 10 */
  maxSteps?: number;

  /** Enable debug logging. Default: false */
  debug?: boolean;

  /** Maximum retries for failed AI SDK provider calls. Default: AI SDK default. */
  maxRetries?: number;

  /** Public current-round action history for opponent tracking. */
  actionLog?: ActionLogEntry[];

  /** Previously committed OpenAI response and its terminal tool result. */
  continuation?: OpenAIResponseContinuation;
}

/**
 * Execute a turn for an AI player using the registry for model lookup
 *
 * This is a convenience wrapper that:
 * 1. Looks up the model from the registry by player ID
 * 2. Calls executeTurn with the resolved model
 *
 * Returns an error if the player is not registered as AI.
 */
export async function executeAITurn(
  config: ExecuteAITurnConfig
): Promise<ExecuteTurnResult> {
  const {
    runtime,
    playerId,
    registry,
    maxSteps,
    debug,
    maxRetries,
    actionLog,
    continuation,
  } = config;

  const model = registry.getModel(playerId);
  if (!model) {
    return {
      success: false,
      actions: [],
      error: `Player ${playerId} is not registered as an AI player`,
    };
  }

  const playerName = registry.getName(playerId);
  const modelId = registry.getModelId(playerId);

  return executeTurn({
    model,
    modelId,
    runtime,
    playerId,
    playerName,
    maxSteps,
    debug,
    maxRetries,
    actionLog,
    continuation,
  });
}
