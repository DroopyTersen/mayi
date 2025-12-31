/**
 * AI Turn Handler for PartyServer
 *
 * Executes AI player turns using the mayIAgent.
 * Provides an adapter layer between PartyGameAdapter and the AI agent's
 * expected CliGameAdapter interface.
 */

import type { GameSnapshot, MeldSpec } from "../../core/engine/game-engine.types";
import type { PartyGameAdapter, PlayerMapping } from "./party-game-adapter";
import { executeTurn, type ExecuteTurnResult } from "../../ai/mayIAgent";
import { createWorkerAIModel, type WebAIModelId } from "./ai-model-factory";

/**
 * Adapter that makes PartyGameAdapter look like CliGameAdapter for AI agent
 *
 * The AI agent expects a CliGameAdapter interface where methods operate
 * on the "current player". This adapter wraps PartyGameAdapter and
 * always executes commands for the specified AI player.
 */
class AIGameAdapterProxy {
  constructor(
    private adapter: PartyGameAdapter,
    private aiPlayerId: string
  ) {}

  getSnapshot(): GameSnapshot {
    return this.adapter.getSnapshot();
  }

  drawFromStock(): GameSnapshot {
    const result = this.adapter.drawFromStock(this.aiPlayerId);
    if (!result) {
      return this.adapter.getSnapshot();
    }
    return result;
  }

  drawFromDiscard(): GameSnapshot {
    const result = this.adapter.drawFromDiscard(this.aiPlayerId);
    if (!result) {
      return this.adapter.getSnapshot();
    }
    return result;
  }

  skip(): GameSnapshot {
    const result = this.adapter.skip(this.aiPlayerId);
    if (!result) {
      return this.adapter.getSnapshot();
    }
    return result;
  }

  layDown(meldSpecs: MeldSpec[]): GameSnapshot {
    const result = this.adapter.layDown(this.aiPlayerId, meldSpecs);
    if (!result) {
      return this.adapter.getSnapshot();
    }
    return result;
  }

  layOff(cardId: string, meldId: string): GameSnapshot {
    const result = this.adapter.layOff(this.aiPlayerId, cardId, meldId);
    if (!result) {
      return this.adapter.getSnapshot();
    }
    return result;
  }

  swapJoker(meldId: string, jokerCardId: string, swapCardId: string): GameSnapshot {
    const result = this.adapter.swapJoker(this.aiPlayerId, meldId, jokerCardId, swapCardId);
    if (!result) {
      return this.adapter.getSnapshot();
    }
    return result;
  }

  discard(cardId: string): GameSnapshot {
    const result = this.adapter.discard(this.aiPlayerId, cardId);
    if (!result) {
      return this.adapter.getSnapshot();
    }
    return result;
  }

  callMayI(): GameSnapshot {
    const result = this.adapter.callMayI(this.aiPlayerId);
    if (!result) {
      return this.adapter.getSnapshot();
    }
    return result;
  }

  allowMayI(): GameSnapshot {
    const result = this.adapter.allowMayI(this.aiPlayerId);
    if (!result) {
      return this.adapter.getSnapshot();
    }
    return result;
  }

  claimMayI(): GameSnapshot {
    const result = this.adapter.claimMayI(this.aiPlayerId);
    if (!result) {
      return this.adapter.getSnapshot();
    }
    return result;
  }
}

/**
 * Result of executing an AI turn
 */
export interface AITurnResult {
  /** Whether the turn completed successfully */
  success: boolean;
  /** Summary of actions taken */
  actions: string[];
  /** Error message if failed */
  error?: string;
  /** Whether fallback was used */
  usedFallback: boolean;
}

/**
 * Execute a fallback turn (draw, skip, discard first card)
 *
 * Used when AI agent fails or for disconnected players.
 */
export function executeFallbackTurn(adapter: PartyGameAdapter, playerId: string): AITurnResult {
  const actions: string[] = [];
  let snapshot = adapter.getSnapshot();

  // If not this player's turn, return error
  if (adapter.getAwaitingLobbyPlayerId() !== playerId) {
    return {
      success: false,
      actions: [],
      error: "Not this player's turn",
      usedFallback: true,
    };
  }

  // Draw phase - draw from stock
  if (snapshot.turnPhase === "AWAITING_DRAW") {
    const result = adapter.drawFromStock(playerId);
    if (!result || result.lastError) {
      return {
        success: false,
        actions,
        error: result?.lastError ?? "Failed to draw from stock",
        usedFallback: true,
      };
    }
    actions.push("draw_from_stock");
    snapshot = result;
  }

  // Action phase - skip (don't try to lay down)
  if (snapshot.turnPhase === "AWAITING_ACTION") {
    const result = adapter.skip(playerId);
    if (!result || result.lastError) {
      return {
        success: false,
        actions,
        error: result?.lastError ?? "Failed to skip",
        usedFallback: true,
      };
    }
    actions.push("skip");
    snapshot = result;
  }

  // Discard phase - discard first card
  if (snapshot.turnPhase === "AWAITING_DISCARD") {
    // Find the current player's hand
    const mapping = adapter.getPlayerMapping(playerId);
    if (!mapping) {
      return {
        success: false,
        actions,
        error: "Player not found",
        usedFallback: true,
      };
    }

    const player = snapshot.players.find((p) => p.id === mapping.engineId);
    if (!player || player.hand.length === 0) {
      return {
        success: false,
        actions,
        error: "No cards to discard",
        usedFallback: true,
      };
    }

    const cardToDiscard = player.hand[0];
    if (!cardToDiscard) {
      return {
        success: false,
        actions,
        error: "No cards to discard",
        usedFallback: true,
      };
    }

    const result = adapter.discard(playerId, cardToDiscard.id);
    if (!result || result.lastError) {
      return {
        success: false,
        actions,
        error: result?.lastError ?? "Failed to discard",
        usedFallback: true,
      };
    }
    actions.push(`discard(${cardToDiscard.id})`);
  }

  return {
    success: true,
    actions,
    usedFallback: true,
  };
}

/**
 * Configuration for AI turn execution
 */
export interface ExecuteAITurnOptions {
  /** The game adapter */
  adapter: PartyGameAdapter;
  /** The AI player's lobby ID */
  aiPlayerId: string;
  /** The AI model ID to use */
  modelId: string;
  /** Player name for logging/telemetry */
  playerName?: string;
  /** Maximum steps per turn (default: 10) */
  maxSteps?: number;
  /** Enable debug logging */
  debug?: boolean;
  /** Use fallback on AI failure (default: true) */
  useFallbackOnError?: boolean;
}

/**
 * Execute an AI player's turn
 *
 * Uses the mayIAgent to make decisions, with fallback to simple
 * draw-skip-discard if the AI fails.
 */
export async function executeAITurn(options: ExecuteAITurnOptions): Promise<AITurnResult> {
  const {
    adapter,
    aiPlayerId,
    modelId,
    playerName,
    maxSteps = 10,
    debug = false,
    useFallbackOnError = true,
  } = options;

  // Check if it's this player's turn
  const awaitingId = adapter.getAwaitingLobbyPlayerId();
  if (awaitingId !== aiPlayerId) {
    return {
      success: false,
      actions: [],
      error: `Not this player's turn. Awaiting: ${awaitingId}`,
      usedFallback: false,
    };
  }

  // Get the engine player ID for the AI agent
  const mapping = adapter.getPlayerMapping(aiPlayerId);
  if (!mapping) {
    return {
      success: false,
      actions: [],
      error: "AI player not found in game",
      usedFallback: false,
    };
  }

  try {
    // Get the model using worker-compatible factory
    const model = createWorkerAIModel(modelId as WebAIModelId);

    // Create the proxy adapter for the AI agent
    const proxy = new AIGameAdapterProxy(adapter, aiPlayerId);

    // Execute the turn using the AI agent
    // Note: The mayIAgent expects the engine player ID, not the lobby ID
    const result = await executeTurn({
      model,
      game: proxy as unknown as Parameters<typeof executeTurn>[0]["game"],
      playerId: mapping.engineId,
      playerName: playerName ?? mapping.name,
      maxSteps,
      debug,
      telemetry: false, // Disable telemetry for server-side execution
    });

    if (result.success) {
      return {
        success: true,
        actions: result.actions,
        usedFallback: false,
      };
    }

    // AI failed - try fallback if enabled
    if (useFallbackOnError) {
      if (debug) {
        console.log(`[AI] Agent failed: ${result.error}. Using fallback.`);
      }
      return executeFallbackTurn(adapter, aiPlayerId);
    }

    return {
      success: false,
      actions: result.actions,
      error: result.error,
      usedFallback: false,
    };
  } catch (error) {
    // Unexpected error - try fallback if enabled
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (useFallbackOnError) {
      if (debug) {
        console.log(`[AI] Agent error: ${errorMessage}. Using fallback.`);
      }
      return executeFallbackTurn(adapter, aiPlayerId);
    }

    return {
      success: false,
      actions: [],
      error: errorMessage,
      usedFallback: false,
    };
  }
}

/**
 * Check if the current turn belongs to an AI player
 */
export function isAIPlayerTurn(adapter: PartyGameAdapter): PlayerMapping | null {
  const awaitingId = adapter.getAwaitingLobbyPlayerId();
  if (!awaitingId) return null;

  const mapping = adapter.getPlayerMapping(awaitingId);
  if (!mapping?.isAI) return null;

  return mapping;
}

/**
 * Get all AI players whose turn it could be (for chained AI turns)
 */
export function getNextAIPlayer(adapter: PartyGameAdapter): PlayerMapping | null {
  return isAIPlayerTurn(adapter);
}
