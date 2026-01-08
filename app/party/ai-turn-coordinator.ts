/**
 * AITurnCoordinator - Manages AI turn execution with abort support
 *
 * Coordinates:
 * - AbortController lifecycle for interrupting AI turns
 * - Immediate state persistence via onPersist callbacks
 * - Clean exit on abort (for May-I handling)
 *
 * Extracted from MayIRoom for testability without PartyKit.
 */

import {
  PartyGameAdapter,
  type StoredGameState,
  type PlayerMapping,
  mergeAIStatePreservingOtherPlayerHands,
} from "./party-game-adapter";
import {
  executeAITurn as realExecuteAITurn,
  isAIPlayerTurn as realIsAIPlayerTurn,
  type AITurnResult,
  type ExecuteAITurnOptions,
} from "./ai-turn-handler";
import type { AIEnv } from "./ai-model-factory";

const MAX_CHAINED_TURNS = 8; // Safety limit to prevent infinite loops
const DEFAULT_INTER_TURN_DELAY_MS = 300; // Delay between AI turns for UX
const DEFAULT_AI_THINKING_DELAY_MS = 500; // Initial delay to show thinking indicator
const DEFAULT_TOOL_DELAY_MS = 0; // Delay after each tool execution (set higher for testing May-I)

/**
 * AI player info extracted from game state
 */
export interface AIPlayerInfo {
  lobbyId: string;
  name: string;
  aiModelId?: string;
}

/**
 * Dependencies for AITurnCoordinator
 *
 * Injected for testability - allows unit testing without PartyKit.
 */
export interface AITurnCoordinatorDeps {
  /** Get current stored game state */
  getState: () => Promise<StoredGameState | null>;

  /** Persist game state to storage */
  setState: (state: StoredGameState) => Promise<void>;

  /** Broadcast game state to all clients */
  broadcast: () => Promise<void>;

  /** Execute a single AI turn (injectable for testing) */
  executeAITurn: (options: ExecuteAITurnOptions) => Promise<AITurnResult>;

  /** Check if it's an AI player's turn (injectable for testing) */
  isAIPlayerTurn?: (adapter: PartyGameAdapter) => PlayerMapping | null;

  /** Create adapter from stored state (injectable for testing) */
  createAdapter?: (state: StoredGameState) => PartyGameAdapter;

  /** Environment with API keys */
  env: AIEnv;

  /** Delay before AI starts (ms). Default: 500. Set to 0 for tests. */
  thinkingDelayMs?: number;

  /** Delay between chained AI turns (ms). Default: 300. Set to 0 for tests. */
  interTurnDelayMs?: number;

  /** Delay after each tool execution (ms). Default: 0. Set to 2000+ for testing May-I. */
  toolDelayMs?: number;

  /** Enable debug logging to see LLM vs fallback usage. Default: false. */
  debug?: boolean;
}

/**
 * Callbacks for AI turn events
 */
export interface AITurnEventCallbacks {
  /** Called when AI starts thinking */
  onAIThinking?: (playerId: string, playerName: string) => void;

  /** Called when AI finishes thinking */
  onAIDone?: (playerId: string) => void;

  /** Called to detect and broadcast game transitions */
  onTransitionCheck?: (
    adapter: PartyGameAdapter,
    phaseBefore: string,
    roundBefore: number
  ) => Promise<void>;
}

/**
 * Coordinates AI turn execution with abort support
 *
 * Usage:
 * ```typescript
 * const coordinator = new AITurnCoordinator(deps);
 *
 * // Start AI turns (non-blocking for external callers)
 * await coordinator.executeAITurnsIfNeeded();
 *
 * // Abort current AI turn (e.g., when May-I is called)
 * coordinator.abortCurrentTurn();
 * ```
 */
export class AITurnCoordinator {
  private abortController: AbortController | null = null;

  constructor(private deps: AITurnCoordinatorDeps) {}

  /**
   * Execute AI turns if it's an AI player's turn
   *
   * Handles chained AI turns (multiple AIs in a row).
   * Supports mid-turn abort via abortCurrentTurn().
   */
  async executeAITurnsIfNeeded(callbacks?: AITurnEventCallbacks): Promise<void> {
    // Use injected or default implementations
    const createAdapter = this.deps.createAdapter ?? PartyGameAdapter.fromStoredState;
    const isAIPlayerTurn = this.deps.isAIPlayerTurn ?? realIsAIPlayerTurn;
    const thinkingDelayMs = this.deps.thinkingDelayMs ?? DEFAULT_AI_THINKING_DELAY_MS;
    const interTurnDelayMs = this.deps.interTurnDelayMs ?? DEFAULT_INTER_TURN_DELAY_MS;
    const toolDelayMs = this.deps.toolDelayMs ?? DEFAULT_TOOL_DELAY_MS;
    const debug = this.deps.debug ?? false;

    let turnsExecuted = 0;

    while (turnsExecuted < MAX_CHAINED_TURNS) {
      const gameState = await this.deps.getState();
      if (!gameState) return;

      const adapter = createAdapter(gameState);

      // Check if it's an AI player's turn
      const aiPlayer = isAIPlayerTurn(adapter);
      if (!aiPlayer) return;

      // Track state before AI turn for transition detection
      const snapshotBefore = adapter.getSnapshot();
      const phaseBefore = snapshotBefore.phase;
      const roundBefore = snapshotBefore.currentRound;

      // Notify that AI is thinking
      callbacks?.onAIThinking?.(aiPlayer.lobbyId, aiPlayer.name);

      // Small delay to let clients see the thinking indicator
      if (thinkingDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, thinkingDelayMs));
      }

      // Create abort controller for this AI turn
      this.abortController = new AbortController();

      const modelToUse = aiPlayer.aiModelId ?? "default:grok";

      try {
        if (debug) {
          console.log(`[AI] Starting turn for ${aiPlayer.name} (${aiPlayer.lobbyId}) with model ${modelToUse}`);
        }

        const result = await this.deps.executeAITurn({
          adapter,
          aiPlayerId: aiPlayer.lobbyId,
          modelId: modelToUse,
          env: this.deps.env,
          playerName: aiPlayer.name,
          maxSteps: 10,
          debug,
          useFallbackOnError: true,
          abortSignal: this.abortController.signal,
          onPersist: async () => {
            // Persist after each tool call
            // Use merge to preserve other players' hands (fixes race condition with reorders)
            const freshState = await this.deps.getState();
            const mergedState = mergeAIStatePreservingOtherPlayerHands(
              freshState,
              adapter.getStoredState(),
              aiPlayer.engineId
            );
            await this.deps.setState(mergedState);
            await this.deps.broadcast();

            // Add delay after tool execution to give time for May-I clicks
            // This is critical for testing - LLM calls already take seconds,
            // but fallback is instant, so this delay helps either way
            if (toolDelayMs > 0) {
              if (debug) {
                console.log(`[AI] Tool executed, waiting ${toolDelayMs}ms for May-I window...`);
              }
              await new Promise((resolve) => setTimeout(resolve, toolDelayMs));
            }
          },
        });

        if (debug) {
          console.log(`[AI] Turn result for ${aiPlayer.name}: success=${result.success}, usedFallback=${result.usedFallback}, actions=${result.actions.join(", ")}`);
        }

        // Notify that AI is done thinking
        callbacks?.onAIDone?.(aiPlayer.lobbyId);

        // Normal completion - save final state
        // Use merge to preserve other players' hands (fixes race condition with reorders)
        const freshStateAtEnd = await this.deps.getState();
        const mergedStateAtEnd = mergeAIStatePreservingOtherPlayerHands(
          freshStateAtEnd,
          adapter.getStoredState(),
          aiPlayer.engineId
        );
        await this.deps.setState(mergedStateAtEnd);

        // Check for round/game end transitions
        if (callbacks?.onTransitionCheck) {
          await callbacks.onTransitionCheck(adapter, phaseBefore, roundBefore);
        }

        // Broadcast updated game state
        await this.deps.broadcast();

        turnsExecuted++;

        if (!result.success) {
          console.error(`[AI] Turn failed for ${aiPlayer.name}: ${result.error}`);
          // Continue to next iteration to check if it's still an AI's turn
          // (fallback should have completed the turn)
        }

        // Exit if game ended
        const phaseAfter = adapter.getSnapshot().phase;
        if (phaseAfter === "GAME_END") {
          return;
        }

        // Small delay between AI turns for better UX
        if (interTurnDelayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, interTurnDelayMs));
        }
      } catch (err) {
        // Clean up
        this.abortController = null;

        // Handle abort gracefully
        if (err instanceof Error && err.name === "AbortError") {
          // May-I was called - state already persisted via onPersist
          // Exit loop and let May-I resolution take over
          callbacks?.onAIDone?.(aiPlayer.lobbyId);
          return;
        }

        // Re-throw unexpected errors
        throw err;
      } finally {
        this.abortController = null;
      }
    }

    if (turnsExecuted >= MAX_CHAINED_TURNS) {
      console.warn("[AI] Hit max chained turns limit");
    }
  }

  /**
   * Abort the currently running AI turn
   *
   * Safe to call even if no turn is running.
   * State will already be persisted up to the last completed tool call.
   */
  abortCurrentTurn(): void {
    this.abortController?.abort();
  }

  /**
   * Check if an AI turn is currently running
   */
  isRunning(): boolean {
    return this.abortController !== null;
  }
}
