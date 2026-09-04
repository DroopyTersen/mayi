/**
 * May I? AI Agent
 *
 * Executes turns for AI players using an LLM with tool-based actions.
 */

import { appendAIStrategyNoteContext, AIHandScratchpad, type AIHandScratchpadStore, type AIHandScratchpadTrace } from "./mayIAgent.scratchpad";
import { MAYI_PLAYER_PROFILE } from "./mayIAgent.player-profile";
import type { AITacticalPresentation } from "./mayIAgent.contract-options";
import type { AIToolRequestJournal } from "./ai-tool-request-journal";
import { beginAIPlayerDecisionContext, type AIPlayerDecisionContext, type AIPlayerDecisionContextOptions, type AIPlayerDecisionContextTrace } from "./mayIAgent.decision-context";
import {
  generateText,
  type LanguageModel,
  type StepResult,
  type Telemetry,
} from "ai";
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
import type { ToolExecutionResult } from "./mayIAgent.types";

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

  /** Stable configured model ID for telemetry and evaluation identity. */
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

  /** Enable telemetry or provide a per-call integration. Default: true */
  telemetry?: boolean | Telemetry;

  /** Optional action log entries for LLM context (only used in CLI mode) */
  actionLog?: ActionLogEntry[];

  /** AbortSignal to cancel the LLM call mid-turn (e.g., when May-I is called) */
  abortSignal?: AbortSignal;

  /** Maximum retries for failed AI SDK provider calls. Default: AI SDK default. */
  maxRetries?: number;

  /** Explicit experiment prompt; normal gameplay uses executePlayerTurn. */
  systemPrompt?: string;
  /** Opt-in process-local, private memory for this game and player. */
  scratchpad?: AIHandScratchpad;
  tacticalPresentation?: AITacticalPresentation;
  /** Optional observer for eval artifacts; not part of the player's context. */
  toolRequestJournal?: AIToolRequestJournal;
  /** Opt-in experiment: exact input tracing, with optional private hand history. */
  decisionContext?: AIPlayerDecisionContextOptions;
}

/**
 * Result of executing an AI turn
 */
export interface ExecuteTurnResult {
  /** Whether the turn completed successfully */
  success: boolean;

  /** Summary of actions taken */
  actions: string[];
  scratchpadTrace?: AIHandScratchpadTrace;
  decisionContextTrace?: AIPlayerDecisionContextTrace;

  /** Error message if failed */
  error?: string;

  /** True when execution stopped because an external event aborted it. */
  aborted?: boolean;

  /** Provider, tool, orchestration, and token accounting for the turn. */
  metrics?: AITurnMetrics;

}

function hasCompletedTurn(
  steps: StepResult<MayITools>[],
): boolean {
  return steps.some(step => step.toolResults.some(result => {
    const output = result.output as ToolExecutionResult | undefined;
    return output?.success === true && output.turnComplete;
  }));
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
    systemPrompt: systemPromptOverride,
  } = config;

  const systemPrompt = systemPromptOverride ?? buildSystemPrompt();
  const actions: string[] = [];

  // Check if it's this player's turn
  const currentState = await runtime.getSnapshot();
  if (currentState.awaitingPlayerId !== playerId) {
    return {
      success: false,
      actions: [],
      error: `Not this player's turn. Awaiting: ${currentState.awaitingPlayerId}`,
    };
  }

  const currentPlayer = currentState.players.find((p) => p.id === playerId);
  const scratchpad = config.scratchpad;
  const memoryContext = { ...currentState, playerId };
  const priorNote = scratchpad?.read(memoryContext);
  const scratchpadTurn = scratchpad !== undefined && currentState.phase === "ROUND_ACTIVE"
    ? scratchpad.begin(memoryContext)
    : undefined;
  const tools = createMayITools(runtime, playerId, { actionLog, scratchpadTurn, tacticalPresentation: config.tacticalPresentation });
  function finishScratchpad(snapshot: typeof currentState, completed: boolean): AIHandScratchpadTrace | undefined {
    if (scratchpad === undefined) return undefined;
    return scratchpadTurn?.finish({ ...snapshot, playerId }, completed) ?? {
      before: priorNote, proposed: undefined,
      after: scratchpad.read({ ...snapshot, playerId }), outcome: "unchanged",
    };
  }

  if (debug) {
    console.log(`\n[AI] Starting turn for ${playerId}`);
    console.log(`[AI] Phase: ${currentState.phase} / ${currentState.turnPhase}`);
  }

  const publicState = outputGameStateForLLM(currentState, playerId, { actionLog, tacticalPresentation: config.tacticalPresentation });
  const initialGameState = scratchpad === undefined ? publicState : appendAIStrategyNoteContext(publicState, priorNote);
  const defaultPromptInput = { prompt: initialGameState };

  let decisionContext: AIPlayerDecisionContext | undefined;
  try {
    if (config.decisionContext !== undefined) {
      decisionContext = await beginAIPlayerDecisionContext({
        options: config.decisionContext, snapshot: currentState, playerId, modelId,
        systemPrompt, observation: initialGameState, kind: "turn",
      });
    }
    const historyMessages = decisionContext?.messages;
    const promptInput = historyMessages === undefined ? defaultPromptInput : { messages: historyMessages };
    // Get display name for telemetry
    const displayName = playerName ?? currentPlayer?.name ?? playerId;

    // Execute the agent loop with dynamic tool selection via prepareStep
    const turnStartedAt = Date.now();
    const result = await generateText({
      model,
      instructions: systemPrompt,
      ...promptInput,
      tools,
      toolOrder: Object.keys(tools) as (keyof MayITools)[],
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
            },
          }
        : undefined,
      onStepStart: (step) => { config.toolRequestJournal?.startStep(step.stepNumber); },
      onLanguageModelCallEnd: (event) => { config.toolRequestJournal?.recordModelResponse(event); },
      onToolExecutionEnd: (event) => { config.toolRequestJournal?.recordToolOutput(event.toolOutput); },
      onStepEnd: async (step) => {
        config.toolRequestJournal?.recordStep(step);
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
      stepProviderMetadata: result.steps.map((step) => step.providerMetadata),
    });
    const turnCompleted = hasCompletedTurn(result.steps);
    const contextResult = await decisionContext?.finish({
      latestSnapshot: await runtime.getSnapshot().catch(() => undefined),
      responseMessages: result.responseMessages,
      completed: turnCompleted, abortSignal,
    });
    const completed = contextResult?.completed ?? turnCompleted;
    const scratchpadTrace = scratchpad === undefined ? undefined : finishScratchpad(
      await runtime.getSnapshot(), completed && !abortSignal?.aborted,
    );
    return {
      success: completed,
      actions,
      ...(contextResult === undefined ? {} : { decisionContextTrace: contextResult.trace }),
      ...(contextResult?.aborted ? { aborted: true } : {}),
      ...(scratchpadTrace === undefined ? {} : { scratchpadTrace }),
      ...(completed
        ? {}
        : {
            error: `AI provider stopped after ${result.steps.length} step(s) without completing the game turn`,
          }),
      metrics,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const aborted =
      abortSignal?.aborted ||
      (error instanceof Error && error.name === "AbortError");
    // The board may have advanced while the request failed. Expire ended-hand
    // intent, but never replace the original provider error with a read error.
    const failureSnapshot = scratchpad === undefined ? currentState :
      await runtime.getSnapshot().catch(() => currentState);
    const contextResult = await decisionContext?.finish({
      latestSnapshot: await runtime.getSnapshot().catch(() => undefined),
      responseMessages: [], completed: false, abortSignal, aborted,
    });
    return {
      success: false,
      actions,
      error: errorMessage,
      ...(contextResult === undefined ? {} : { decisionContextTrace: contextResult.trace }),
      ...(scratchpad === undefined ? {} : { scratchpadTrace: finishScratchpad(failureSnapshot, false) }),
      ...(aborted ? { aborted: true } : {}),
    };
  }
}

/** Normal gameplay configuration. Explicit evals still call executeTurn directly. */
export async function executePlayerTurn(
  config: Omit<ExecuteTurnConfig, "systemPrompt" | "scratchpad"> & { notebookStore: AIHandScratchpadStore },
): Promise<ExecuteTurnResult> {
  const { notebookStore, ...turnConfig } = config;
  const initial = await config.runtime.getSnapshot();
  const context = { ...initial, playerId: config.playerId };
  const scratchpad = AIHandScratchpad.restore(context, await notebookStore.get(config.playerId));
  const result = await executeTurn({ ...turnConfig, scratchpad, systemPrompt: MAYI_PLAYER_PROFILE.systemPrompt });
  // Failed/aborted turns cannot commit a proposal. A fresh read also expires
  // notes if another action ended the hand while the provider was running.
  const latest = await config.runtime.getSnapshot();
  await notebookStore.set(config.playerId, scratchpad.exportState({ ...latest, playerId: config.playerId }));
  return result;
}
