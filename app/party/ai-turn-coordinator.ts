/**
 * AITurnCoordinator - manages AI turn orchestration with abort support.
 *
 * The coordinator owns only runtime concerns:
 * - single-flight execution
 * - AbortController lifecycle
 * - thinking/done notifications
 * - chained AI turns
 *
 * Game mutations are executed exclusively by the injected GameAction runtime.
 */

import type {
  AIActionResult,
  AIActionRuntime,
  GameAction,
} from "../../ai/ai-action-runtime.types";
import {
  PartyGameAdapter,
  type PlayerMapping,
  type StoredGameState,
} from "./party-game-adapter";
import {
  executeAITurn as realExecuteAITurn,
  isAIPlayerTurn as realIsAIPlayerTurn,
  type AITurnResult,
  type ExecuteAITurnOptions,
} from "./ai-turn-handler";
import type { AIEnv } from "./ai-model-factory";

const MAX_CHAINED_TURNS = 8;
const DEFAULT_INTER_TURN_DELAY_MS = 300;
const DEFAULT_AI_THINKING_DELAY_MS = 500;
const DEFAULT_TOOL_DELAY_MS = 0;

/**
 * Dependencies for AITurnCoordinator.
 */
export interface AITurnCoordinatorDeps {
  /** Get current stored game state. */
  getState: () => Promise<StoredGameState | null>;

  /** Execute one AI action through the room's serialized action pipeline. */
  executeAIAction: (playerId: string, action: GameAction) => Promise<AIActionResult>;

  /** Execute a single AI turn. */
  executeAITurn: (options: ExecuteAITurnOptions) => Promise<AITurnResult>;

  /** Check if it's an AI player's turn. */
  isAIPlayerTurn?: (adapter: PartyGameAdapter) => PlayerMapping | null;

  /** Create adapter from stored state. */
  createAdapter?: (state: StoredGameState) => PartyGameAdapter;

  /** Environment with API keys. */
  env: AIEnv;

  /** Delay before AI starts (ms). Default: 500. Set to 0 for tests. */
  thinkingDelayMs?: number;

  /** Delay between chained AI turns (ms). Default: 300. Set to 0 for tests. */
  interTurnDelayMs?: number;

  /** Delay after each tool execution (ms). Default: 0. */
  toolDelayMs?: number;

  /** Enable debug logging. Default: false. */
  debug?: boolean;
}

/**
 * Callbacks for AI turn events.
 */
export interface AITurnEventCallbacks {
  /** Called when AI starts thinking. */
  onAIThinking?: (playerId: string, playerName: string) => void;

  /** Called when AI finishes thinking. */
  onAIDone?: (playerId: string) => void;
}

/**
 * Coordinates AI turn execution with abort support.
 */
export class AITurnCoordinator {
  private abortController: AbortController | null = null;
  private running = false;

  constructor(private deps: AITurnCoordinatorDeps) {}

  /**
   * Execute AI turns while the latest committed state is awaiting an AI player.
   */
  async executeAITurnsIfNeeded(callbacks?: AITurnEventCallbacks): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
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
        const aiPlayer = isAIPlayerTurn(adapter);
        if (!aiPlayer) return;

        callbacks?.onAIThinking?.(aiPlayer.lobbyId, aiPlayer.name);

        if (thinkingDelayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, thinkingDelayMs));
        }

        this.abortController = new AbortController();
        const runtime = this.createRuntime(aiPlayer.lobbyId, createAdapter, toolDelayMs, debug);
        const modelToUse = aiPlayer.aiModelId ?? "default:grok";

        try {
          if (debug) {
            console.log(
              `[AI] Starting turn for ${aiPlayer.name} (${aiPlayer.lobbyId}) with model ${modelToUse}`
            );
          }

          const result = await this.deps.executeAITurn({
            adapter,
            aiPlayerId: aiPlayer.lobbyId,
            modelId: modelToUse,
            env: this.deps.env,
            runtime,
            playerName: aiPlayer.name,
            maxSteps: 10,
            debug,
            abortSignal: this.abortController.signal,
          });

          if (debug) {
            console.log(
              `[AI] Turn result for ${aiPlayer.name}: success=${result.success}, actions=${result.actions.join(", ")}`
            );
          }

          callbacks?.onAIDone?.(aiPlayer.lobbyId);
          turnsExecuted++;

          if (result.aborted) {
            return;
          }

          if (!result.success) {
            console.error(`[AI] Turn failed for ${aiPlayer.name}: ${result.error}`);
            return;
          }

          const latestState = await this.deps.getState();
          if (!latestState) return;
          const phaseAfter = createAdapter(latestState).getSnapshot().phase;
          if (phaseAfter === "GAME_END") {
            return;
          }

          if (interTurnDelayMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, interTurnDelayMs));
          }
        } catch (err) {
          callbacks?.onAIDone?.(aiPlayer.lobbyId);

          if (err instanceof Error && err.name === "AbortError") {
            return;
          }

          throw err;
        } finally {
          this.abortController = null;
        }
      }

      if (turnsExecuted >= MAX_CHAINED_TURNS) {
        console.warn("[AI] Hit max chained turns limit");
      }
    } finally {
      this.abortController = null;
      this.running = false;
    }
  }

  /**
   * Abort the currently running AI turn.
   */
  abortCurrentTurn(): void {
    this.abortController?.abort();
  }

  /**
   * Check if an AI turn is currently running.
   */
  isRunning(): boolean {
    return this.running;
  }

  private createRuntime(
    aiLobbyId: string,
    createAdapter: (state: StoredGameState) => PartyGameAdapter,
    toolDelayMs: number,
    debug: boolean
  ): AIActionRuntime {
    return {
      getSnapshot: async () => {
        const latestState = await this.deps.getState();
        if (!latestState) {
          throw new Error("Cannot get AI snapshot without stored game state");
        }
        return createAdapter(latestState).getSnapshot();
      },
      executeAction: async (action) => {
        const result = await this.deps.executeAIAction(aiLobbyId, action);

        if (toolDelayMs > 0) {
          if (debug) {
            console.log(`[AI] Tool executed, waiting ${toolDelayMs}ms`);
          }
          await new Promise((resolve) => setTimeout(resolve, toolDelayMs));
        }

        return result;
      },
    };
  }
}
