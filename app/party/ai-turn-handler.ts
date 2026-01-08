/**
 * AI Turn Handler for PartyServer
 *
 * Executes AI player turns using the mayIAgent.
 * Provides an adapter layer between PartyGameAdapter and the AI agent's
 * expected AIGameAdapter interface.
 */

import type { GameSnapshot, MeldSpec } from "../../core/engine/game-engine.types";
import type { AIGameAdapter } from "../../ai/ai-game-adapter.types";
import type { PartyGameAdapter, PlayerMapping } from "./party-game-adapter";
import { executeTurn, type ExecuteTurnResult } from "../../ai/mayIAgent";
import { createWorkerAIModelAsync, type AIEnv } from "./ai-model-factory";
import { isValidRun, isValidSet } from "../../core/meld/meld.validation";
import { renderCard } from "../../cli/shared/cli.renderer";

/**
 * Adapter that makes PartyGameAdapter look like AIGameAdapter for AI agent
 *
 * The AI agent uses position-based methods (hand positions, meld numbers).
 * This adapter wraps PartyGameAdapter and converts positions to IDs,
 * always executing commands for the specified AI player.
 */
class AIGameAdapterProxy implements AIGameAdapter {
  constructor(
    private adapter: PartyGameAdapter,
    private aiPlayerId: string
  ) {}

  getSnapshot(): GameSnapshot {
    return this.adapter.getSnapshot();
  }

  drawFromStock(): GameSnapshot {
    const before = this.adapter.getSnapshot();
    const result = this.adapter.drawFromStock(this.aiPlayerId);
    if (!result) {
      return this.adapter.getSnapshot();
    }
    // Log the draw action
    this.adapter.logDraw(this.aiPlayerId, before, result, "stock");
    return result;
  }

  drawFromDiscard(): GameSnapshot {
    const before = this.adapter.getSnapshot();
    const result = this.adapter.drawFromDiscard(this.aiPlayerId);
    if (!result) {
      return this.adapter.getSnapshot();
    }
    // Log the draw action
    this.adapter.logDraw(this.aiPlayerId, before, result, "discard");
    return result;
  }

  skip(): GameSnapshot {
    const result = this.adapter.skip(this.aiPlayerId);
    if (!result) {
      return this.adapter.getSnapshot();
    }
    // Skip is not logged (filtered as boring)
    return result;
  }

  /**
   * Lay down melds using hand positions.
   * Converts position arrays to MeldSpec[] with card IDs.
   */
  layDown(meldGroups: number[][]): GameSnapshot {
    const snapshot = this.adapter.getSnapshot();
    const mapping = this.adapter.getPlayerMapping(this.aiPlayerId);
    if (!mapping) {
      return snapshot;
    }

    const player = snapshot.players.find((p) => p.id === mapping.engineId);
    if (!player) {
      return snapshot;
    }

    const meldSpecs: MeldSpec[] = meldGroups.map((group) => {
      const cards = group.map((pos) => {
        const card = player.hand[pos - 1];
        if (!card) {
          throw new Error(`Card position out of range: ${pos}`);
        }
        return card;
      });

      const canBeSet = isValidSet(cards);
      const canBeRun = isValidRun(cards);

      // Infer type in a deterministic way (engine still validates the rules).
      const type: "set" | "run" =
        canBeSet && !canBeRun ? "set" : canBeRun && !canBeSet ? "run" : "set";

      return { type, cardIds: cards.map((c) => c.id) };
    });

    const before = this.adapter.getSnapshot();
    const result = this.adapter.layDown(this.aiPlayerId, meldSpecs);
    if (!result) {
      return this.adapter.getSnapshot();
    }
    // Log the lay down action
    this.adapter.logLayDown(this.aiPlayerId, before, result);
    return result;
  }

  /**
   * Lay off a card using hand position and meld number.
   * Converts positions to IDs.
   */
  layOff(cardPosition: number, meldNumber: number): GameSnapshot {
    const snapshot = this.adapter.getSnapshot();
    const mapping = this.adapter.getPlayerMapping(this.aiPlayerId);
    if (!mapping) {
      return snapshot;
    }

    const player = snapshot.players.find((p) => p.id === mapping.engineId);
    if (!player) {
      return snapshot;
    }

    const card = player.hand[cardPosition - 1];
    if (!card) {
      return snapshot;
    }

    // Meld number is 1-indexed into the table array
    const meld = snapshot.table[meldNumber - 1];
    if (!meld) {
      return snapshot;
    }

    const before = this.adapter.getSnapshot();
    const result = this.adapter.layOff(this.aiPlayerId, card.id, meld.id);
    if (!result) {
      return this.adapter.getSnapshot();
    }
    // Log the lay off action
    this.adapter.logLayOff(this.aiPlayerId, card.id, before, result);
    return result;
  }

  /**
   * Swap a joker using meld number, joker position in meld, and card position in hand.
   * Converts positions to IDs.
   */
  swap(meldNumber: number, jokerPosition: number, cardPosition: number): GameSnapshot {
    const snapshot = this.adapter.getSnapshot();
    const mapping = this.adapter.getPlayerMapping(this.aiPlayerId);
    if (!mapping) {
      return snapshot;
    }

    const player = snapshot.players.find((p) => p.id === mapping.engineId);
    if (!player) {
      return snapshot;
    }

    const swapCard = player.hand[cardPosition - 1];
    if (!swapCard) {
      return snapshot;
    }

    // Meld number is 1-indexed into the table array
    const meld = snapshot.table[meldNumber - 1];
    if (!meld) {
      return snapshot;
    }

    const jokerCard = meld.cards[jokerPosition - 1];
    if (!jokerCard) {
      return snapshot;
    }

    const result = this.adapter.swapJoker(this.aiPlayerId, meld.id, jokerCard.id, swapCard.id);
    if (!result) {
      return this.adapter.getSnapshot();
    }
    return result;
  }

  /**
   * Discard a card using hand position.
   * Converts position to card ID.
   */
  discardCard(position: number): GameSnapshot {
    const snapshot = this.adapter.getSnapshot();
    const mapping = this.adapter.getPlayerMapping(this.aiPlayerId);
    if (!mapping) {
      return snapshot;
    }

    const player = snapshot.players.find((p) => p.id === mapping.engineId);
    if (!player) {
      return snapshot;
    }

    const card = player.hand[position - 1];
    if (!card) {
      return snapshot;
    }

    const before = this.adapter.getSnapshot();
    const result = this.adapter.discard(this.aiPlayerId, card.id);
    if (!result) {
      return this.adapter.getSnapshot();
    }
    // Log the discard action
    this.adapter.logDiscard(this.aiPlayerId, before, result, card.id);
    return result;
  }

  allowMayI(_playerId: string): GameSnapshot {
    const before = this.adapter.getSnapshot();
    const result = this.adapter.allowMayI(this.aiPlayerId);
    if (!result) {
      return this.adapter.getSnapshot();
    }
    // Log the allow action
    this.adapter.logMayIAllow(this.aiPlayerId);
    // If May-I just resolved (phase changed), log who got the card
    if (before.phase === "RESOLVING_MAY_I" && result.phase === "ROUND_ACTIVE") {
      const mayIContext = before.mayIContext;
      if (mayIContext) {
        const cardRendered = renderCard(mayIContext.cardBeingClaimed);
        const winnerEngineId = mayIContext.originalCaller;
        const winnerMapping = this.adapter.getAllPlayerMappings().find(
          (m) => m.engineId === winnerEngineId
        );
        if (winnerMapping) {
          this.adapter.logMayIResolved(winnerMapping.lobbyId, cardRendered, false);
        }
      }
    }
    return result;
  }

  claimMayI(_playerId: string): GameSnapshot {
    const before = this.adapter.getSnapshot();
    const result = this.adapter.claimMayI(this.aiPlayerId);
    if (!result) {
      return this.adapter.getSnapshot();
    }
    // Log the claim action and resolution
    const mayIContext = before.mayIContext;
    if (mayIContext) {
      const cardRendered = renderCard(mayIContext.cardBeingClaimed);
      this.adapter.logMayIClaim(this.aiPlayerId, cardRendered);
      this.adapter.logMayIResolved(this.aiPlayerId, cardRendered, true);
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
 * Options for fallback turn execution
 */
export interface FallbackTurnOptions {
  /** AbortSignal to cancel mid-turn (e.g., when May-I is called) */
  abortSignal?: AbortSignal;
  /** Callback invoked after each action to persist state immediately */
  onPersist?: () => Promise<void>;
  /** Delay between phases in ms (default: 300, allows May-I window) */
  phaseDelayMs?: number;
}

/**
 * Helper to wait with abort support
 */
async function delayWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timeout);
      reject(new DOMException("Aborted", "AbortError"));
    }, { once: true });
  });
}

/**
 * Execute a fallback turn (draw, skip, discard first card)
 *
 * Used when AI agent fails or for disconnected players.
 * Now async with abort support and delays between phases.
 */
export async function executeFallbackTurn(
  adapter: PartyGameAdapter,
  playerId: string,
  options: FallbackTurnOptions = {}
): Promise<AITurnResult> {
  const { abortSignal, onPersist, phaseDelayMs = 300 } = options;
  const actions: string[] = [];
  let snapshot = adapter.getSnapshot();

  // Handle May-I response phase - when player is prompted to allow/claim
  if (snapshot.phase === "RESOLVING_MAY_I") {
    const mayIContext = snapshot.mayIContext;
    if (!mayIContext) {
      return {
        success: false,
        actions: [],
        error: "No May-I context in RESOLVING_MAY_I phase",
        usedFallback: true,
      };
    }

    // Check if this player is the one being prompted
    const mapping = adapter.getPlayerMapping(playerId);
    if (!mapping || mayIContext.playerBeingPrompted !== mapping.engineId) {
      return {
        success: false,
        actions: [],
        error: "Not the player being prompted for May-I response",
        usedFallback: true,
      };
    }

    // Auto-allow May-I as fallback behavior
    const before = snapshot;
    const result = adapter.allowMayI(playerId);
    if (!result || result.lastError) {
      return {
        success: false,
        actions: [],
        error: result?.lastError ?? "Failed to allow May-I",
        usedFallback: true,
      };
    }

    // Log the allow action
    adapter.logMayIAllow(playerId);
    // If May-I just resolved (phase changed), log who got the card
    if (before.phase === "RESOLVING_MAY_I" && result.phase === "ROUND_ACTIVE") {
      if (mayIContext) {
        const cardRendered = renderCard(mayIContext.cardBeingClaimed);
        const winnerEngineId = mayIContext.originalCaller;
        const winnerMapping = adapter.getAllPlayerMappings().find(
          (m) => m.engineId === winnerEngineId
        );
        if (winnerMapping) {
          adapter.logMayIResolved(winnerMapping.lobbyId, cardRendered, false);
        }
      }
    }

    actions.push("allow_may_i");

    // Persist immediately after allowing
    if (onPersist) {
      await onPersist();
    }

    return {
      success: true,
      actions,
      usedFallback: true,
    };
  }

  // If not this player's turn, return error
  if (adapter.getAwaitingLobbyPlayerId() !== playerId) {
    return {
      success: false,
      actions: [],
      error: "Not this player's turn",
      usedFallback: true,
    };
  }

  try {
    // Draw phase - draw from stock
    if (snapshot.turnPhase === "AWAITING_DRAW") {
      const before = snapshot;
      const result = adapter.drawFromStock(playerId);
      if (!result || result.lastError) {
        return {
          success: false,
          actions,
          error: result?.lastError ?? "Failed to draw from stock",
          usedFallback: true,
        };
      }
      // Log the draw
      adapter.logDraw(playerId, before, result, "stock");
      actions.push("draw_from_stock");
      snapshot = result;

      // Persist immediately after draw
      if (onPersist) {
        await onPersist();
      }

      // Delay for May-I window
      await delayWithAbort(phaseDelayMs, abortSignal);
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
      // Skip is not logged (filtered as boring)
      actions.push("skip");
      snapshot = result;

      // Persist immediately after skip
      if (onPersist) {
        await onPersist();
      }

      // Delay for May-I window
      await delayWithAbort(phaseDelayMs, abortSignal);
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

      const before = snapshot;
      const result = adapter.discard(playerId, cardToDiscard.id);
      if (!result || result.lastError) {
        return {
          success: false,
          actions,
          error: result?.lastError ?? "Failed to discard",
          usedFallback: true,
        };
      }
      // Log the discard
      adapter.logDiscard(playerId, before, result, cardToDiscard.id);
      actions.push(`discard(${cardToDiscard.id})`);

      // Persist immediately after discard
      if (onPersist) {
        await onPersist();
      }
    }

    return {
      success: true,
      actions,
      usedFallback: true,
    };
  } catch (error) {
    // Check if this was an intentional abort (e.g., May-I was called)
    if (error instanceof Error && error.name === "AbortError") {
      return {
        success: true, // Abort is a clean exit, not a failure
        actions,
        error: undefined,
        usedFallback: true,
      };
    }
    throw error; // Re-throw unexpected errors
  }
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
  /** Environment with API keys */
  env: AIEnv;
  /** Player name for logging/telemetry */
  playerName?: string;
  /** Maximum steps per turn (default: 10) */
  maxSteps?: number;
  /** Enable debug logging */
  debug?: boolean;
  /** Use fallback on AI failure (default: true) */
  useFallbackOnError?: boolean;
  /** AbortSignal to cancel the LLM call mid-turn (e.g., when May-I is called) */
  abortSignal?: AbortSignal;
  /** Callback invoked after each tool execution to persist state immediately */
  onPersist?: () => Promise<void>;
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
    env,
    playerName,
    maxSteps = 10,
    debug = false,
    useFallbackOnError = true,
    abortSignal,
    onPersist,
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
    // Get the model using worker-compatible factory (with DevTools in local dev)
    const model = await createWorkerAIModelAsync(modelId, env);

    // Create the proxy adapter for the AI agent
    const proxy = new AIGameAdapterProxy(adapter, aiPlayerId);

    // Execute the turn using the AI agent
    // Note: The mayIAgent expects the engine player ID, not the lobby ID
    const result = await executeTurn({
      model,
      game: proxy,
      playerId: mapping.engineId,
      playerName: playerName ?? mapping.name,
      maxSteps,
      debug,
      telemetry: false, // Disable telemetry for server-side execution
      abortSignal,
      onPersist,
    });

    if (result.success) {
      return {
        success: true,
        actions: result.actions,
        usedFallback: false,
      };
    }

    // Check if the AI was aborted (e.g., May-I was called)
    // Abort is a clean exit, not a failure - don't run fallback
    const isAbortError = result.error?.toLowerCase().includes('abort');
    if (isAbortError) {
      if (debug) {
        console.log(`[AI] Turn aborted (May-I or similar interrupt)`);
      }
      return {
        success: true,
        actions: result.actions,
        error: undefined,
        usedFallback: false,
      };
    }

    // AI failed - try fallback if enabled
    if (useFallbackOnError) {
      if (debug) {
        console.log(`[AI] Agent failed: ${result.error}. Using fallback.`);
      }
      return await executeFallbackTurn(adapter, aiPlayerId, { abortSignal, onPersist });
    }

    return {
      success: false,
      actions: result.actions,
      error: result.error,
      usedFallback: false,
    };
  } catch (error) {
    // Check if this was an intentional abort (e.g., May-I was called)
    // AbortError means we should exit cleanly without fallback
    if (error instanceof Error && error.name === "AbortError") {
      if (debug) {
        console.log(`[AI] Turn aborted (May-I or similar interrupt)`);
      }
      return {
        success: true, // Abort is a clean exit, not a failure
        actions: [],
        error: undefined,
        usedFallback: false,
      };
    }

    // Unexpected error - try fallback if enabled
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (useFallbackOnError) {
      if (debug) {
        console.log(`[AI] Agent error: ${errorMessage}. Using fallback.`);
      }
      return await executeFallbackTurn(adapter, aiPlayerId, { abortSignal, onPersist });
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
