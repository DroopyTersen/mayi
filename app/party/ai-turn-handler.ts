/**
 * AI turn execution for PartyServer.
 *
 * This layer resolves the worker model, validates that the requested AI player
 * is currently awaited, and runs the shared AI agent against an action runtime.
 * All mutations happen inside that runtime through normal GameAction handling.
 */

import type { AIActionRuntime } from "../../ai/ai-action-runtime.types";
import { executeTurn } from "../../ai/mayIAgent";
import type { AIEnv } from "./ai-model-factory";
import { createWorkerAIModelAsync } from "./ai-model-factory";
import type { PartyGameAdapter, PlayerMapping } from "./party-game-adapter";

/**
 * Result of executing an AI turn.
 */
export interface AITurnResult {
  /** Whether the turn completed successfully. */
  success: boolean;
  /** Summary of actions taken. */
  actions: string[];
  /** Error message if failed. */
  error?: string;
  /** True when execution stopped because an external event aborted the loop. */
  aborted?: boolean;
}

/**
 * Configuration for AI turn execution.
 */
export interface ExecuteAITurnOptions {
  /** Adapter used only for lobby/engine player ID mapping. */
  adapter: PartyGameAdapter;
  /** The AI player's lobby ID. */
  aiPlayerId: string;
  /** The AI model ID to use. */
  modelId: string;
  /** Environment with API keys. */
  env: AIEnv;
  /** Runtime that reads latest game state and executes queued actions. */
  runtime: AIActionRuntime;
  /** Player name for logging/telemetry. */
  playerName?: string;
  /** Maximum steps per turn. Default: 10. */
  maxSteps?: number;
  /** Enable debug logging. */
  debug?: boolean;
  /** AbortSignal to cancel the LLM call mid-turn. */
  abortSignal?: AbortSignal;
  /** Maximum retries for failed AI SDK provider calls. Default: AI SDK default. */
  maxRetries?: number;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/**
 * Execute an AI player's turn.
 */
export async function executeAITurn(options: ExecuteAITurnOptions): Promise<AITurnResult> {
  const {
    adapter,
    aiPlayerId,
    modelId,
    env,
    runtime,
    playerName,
    maxSteps = 10,
    debug = false,
    abortSignal,
    maxRetries,
  } = options;

  const mapping = adapter.getPlayerMapping(aiPlayerId);
  if (!mapping) {
    return {
      success: false,
      actions: [],
      error: "AI player not found in game",
    };
  }

  const latestSnapshot = await runtime.getSnapshot();
  if (latestSnapshot.awaitingPlayerId !== mapping.engineId) {
    return {
      success: false,
      actions: [],
      error: `Not this player's turn. Awaiting: ${latestSnapshot.awaitingPlayerId}`,
    };
  }

  try {
    const model = await createWorkerAIModelAsync(modelId, env);
    const result = await executeTurn({
      model,
      runtime,
      playerId: mapping.engineId,
      playerName: playerName ?? mapping.name,
      maxSteps,
      debug,
      telemetry: false,
      abortSignal,
      maxRetries,
    });

    if (result.success) {
      return {
        success: true,
        actions: result.actions,
      };
    }

    if (result.error?.toLowerCase().includes("abort")) {
      if (debug) {
        console.log("[AI] Turn aborted");
      }
      return {
        success: true,
        actions: result.actions,
        aborted: true,
      };
    }

    return {
      success: false,
      actions: result.actions,
      error: result.error,
    };
  } catch (error) {
    if (isAbortError(error)) {
      if (debug) {
        console.log("[AI] Turn aborted");
      }
      return {
        success: true,
        actions: [],
        aborted: true,
      };
    }

    return {
      success: false,
      actions: [],
      error: errorMessage(error),
    };
  }
}

/**
 * Check if the current turn belongs to an AI player.
 */
export function isAIPlayerTurn(adapter: PartyGameAdapter): PlayerMapping | null {
  const awaitingId = adapter.getAwaitingLobbyPlayerId();
  if (!awaitingId) return null;

  const mapping = adapter.getPlayerMapping(awaitingId);
  if (!mapping?.isAI) return null;

  return mapping;
}

/**
 * Get the next AI player to act.
 */
export function getNextAIPlayer(adapter: PartyGameAdapter): PlayerMapping | null {
  return isAIPlayerTurn(adapter);
}
