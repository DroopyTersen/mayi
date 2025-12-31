/**
 * May I? AI Agent
 *
 * Executes turns for AI players using an LLM with tool-based actions.
 */

import { generateText, type LanguageModel, type StepResult } from "ai";
import type { CliGameAdapter } from "../cli/shared/cli-game-adapter";
import { outputGameStateForLLM, type ActionLogEntry } from "../cli/shared/cli.llm-output";
import { buildSystemPrompt } from "./mayIAgent.prompt";
import {
  createMayITools,
  getAvailableToolNames,
  type MayITools,
} from "./mayIAgent.tools";
import type { AIPlayerRegistry } from "./aiPlayer.registry";
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

  /** The CLI adapter managing the game state */
  game: CliGameAdapter;

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
    game,
    playerId,
    playerName,
    maxSteps = 10,
    debug = false,
    telemetry = true,
    actionLog,
  } = config;

  const tools = createMayITools(game, playerId, { actionLog });
  const systemPrompt = buildSystemPrompt();
  const actions: string[] = [];

  // Check if it's this player's turn
  let currentState = game.getSnapshot();
  if (currentState.awaitingPlayerId !== playerId) {
    return {
      success: false,
      actions: [],
      error: `Not this player's turn. Awaiting: ${currentState.awaitingPlayerId}`,
    };
  }

  const currentPlayer = currentState.players.find((p) => p.id === playerId);
  const isDown = currentPlayer?.isDown ?? false;

  if (debug) {
    console.log(`\n[AI] Starting turn for ${playerId}`);
    console.log(`[AI] Phase: ${currentState.phase} / ${currentState.turnPhase}`);
  }

  // Auto-draw for down players (they can only draw from stock)
  if (
    isDown &&
    currentState.phase === "ROUND_ACTIVE" &&
    currentState.turnPhase === "AWAITING_DRAW"
  ) {
    const drawResult = game.drawFromStock();
    actions.push("draw_from_stock({})");

    if (debug) {
      console.log(`[AI] Auto-draw (down player): ${drawResult.lastError ?? "OK"}`);
    }

    // Refresh state after auto-draw
    currentState = game.getSnapshot();

    // If the engine is no longer awaiting us (interrupted), return
    if (currentState.awaitingPlayerId !== playerId) {
      return {
        success: true,
        actions,
        error: undefined,
      };
    }
  }

  // Get game state for the AI (after potential auto-draw)
  const initialGameState = outputGameStateForLLM(currentState, playerId, { actionLog });

  try {
    // Get display name for telemetry
    const displayName = playerName ?? currentPlayer?.name ?? playerId;

    // Execute the agent loop with dynamic tool selection via prepareStep
    const result = await generateText({
      model,
      system: systemPrompt,
      prompt: initialGameState,
      tools,
      stopWhen: stopWhenTurnComplete(maxSteps),
      prepareStep: async () => {
        // Get current game state (may have changed since last step)
        const currentState = game.getSnapshot();
        const currentPlayer = currentState.players.find((p) => p.id === playerId);

        // Get tools available for current snapshot
        const activeToolNames = getAvailableToolNames(currentState, playerId) as (keyof MayITools)[];

        if (debug) {
          console.log(
            `[AI] Phase: ${currentState.phase} / ${currentState.turnPhase}, Available tools: ${activeToolNames.join(", ")}`
          );
        }

        return {
          activeTools: activeToolNames,
        };
      },
      experimental_telemetry: telemetry
        ? {
            isEnabled: true,
            functionId: "may-i-agent",
            metadata: {
              playerId,
              playerName: displayName,
              gameId: currentState.gameId,
              round: currentState.currentRound,
              phase: currentState.phase,
              turnPhase: currentState.turnPhase,
              turnNumber: currentState.turnNumber,
            },
          }
        : undefined,
      onStepFinish: (step) => {
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

    if (debug) {
      console.log(`[AI] Total steps: ${result.steps.length}`);
      console.log(`[AI] Finish reason: ${result.finishReason}`);
    }

    return {
      success: true,
      actions,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      actions,
      error: errorMessage,
    };
  }
}

/**
 * Execute a single action for the AI player (for testing/debugging)
 *
 * Unlike executeTurn, this only makes one LLM call and executes one action.
 */
export async function executeOneAction(
  config: Omit<ExecuteTurnConfig, "maxSteps">
): Promise<ExecuteTurnResult> {
  return executeTurn({ ...config, maxSteps: 1 });
}

/**
 * Configuration for executing an AI turn using the registry
 */
export interface ExecuteAITurnConfig {
  /** The CLI adapter managing the game state */
  game: CliGameAdapter;

  /** The player ID to execute turn for */
  playerId: string;

  /** The AI player registry */
  registry: AIPlayerRegistry;

  /** Maximum steps (tool calls) per turn. Default: 10 */
  maxSteps?: number;

  /** Enable debug logging. Default: false */
  debug?: boolean;
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
  const { game, playerId, registry, maxSteps, debug } = config;

  const model = registry.getModel(playerId);
  if (!model) {
    return {
      success: false,
      actions: [],
      error: `Player ${playerId} is not registered as an AI player`,
    };
  }

  const playerName = registry.getName(playerId);

  return executeTurn({
    model,
    game,
    playerId,
    playerName,
    maxSteps,
    debug,
  });
}
