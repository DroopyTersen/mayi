/**
 * AI Player Registry
 *
 * Manages the association between player IDs and their AI models.
 * This is separate from the Orchestrator to keep the core game engine
 * transport-agnostic and free from AI SDK dependencies.
 */

import type { LanguageModel } from "ai";
import { modelRegistry, withDevTools, type ModelId } from "./modelRegistry";
import type { AIPlayerConfig, GamePlayerConfig } from "./aiPlayer.types";

/**
 * Registry entry linking a player ID to their model configuration
 */
interface AIPlayerEntry {
  playerId: string;
  name: string;
  modelId: ModelId;
}

/**
 * AI Player Registry class
 *
 * Stores AI player configurations and provides model lookup by player ID.
 * One registry per game - create a new instance for each game.
 */
export class AIPlayerRegistry {
  private entries: Map<string, AIPlayerEntry> = new Map();
  private _useDevTools: boolean = false;

  /**
   * Enable devtools middleware for all models from this registry.
   * Call this before registering players to capture AI runs in devtools.
   */
  enableDevTools(): this {
    this._useDevTools = true;
    return this;
  }

  /**
   * Register an AI player with their model
   */
  register(playerId: string, config: AIPlayerConfig): void {
    this.entries.set(playerId, {
      playerId,
      name: config.name,
      modelId: config.modelId,
    });
  }

  /**
   * Check if a player is controlled by AI
   */
  isAI(playerId: string): boolean {
    return this.entries.has(playerId);
  }

  /**
   * Get the model for an AI player
   * Returns undefined if player is not AI
   */
  getModel(playerId: string): LanguageModel | undefined {
    const entry = this.entries.get(playerId);
    if (!entry) return undefined;
    const model = modelRegistry.languageModel(entry.modelId);
    return this._useDevTools ? withDevTools(model) : model;
  }

  /**
   * Get the model ID for an AI player
   */
  getModelId(playerId: string): ModelId | undefined {
    return this.entries.get(playerId)?.modelId;
  }

  /**
   * Get the player name for an AI player
   */
  getName(playerId: string): string | undefined {
    return this.entries.get(playerId)?.name;
  }

  /**
   * Get all AI player IDs
   */
  getAIPlayerIds(): string[] {
    return Array.from(this.entries.keys());
  }

  /**
   * Get all AI player entries
   */
  getAll(): AIPlayerEntry[] {
    return Array.from(this.entries.values());
  }

  /**
   * Clear all registrations (for starting a new game)
   */
  clear(): void {
    this.entries.clear();
  }
}

/**
 * Create player names array for Orchestrator.newGame()
 * and register AI players in the registry.
 *
 * Returns the player names array in order:
 * - player-0: human player
 * - player-1, player-2, ...: AI players
 */
export function setupGameWithAI(
  config: GamePlayerConfig,
  registry: AIPlayerRegistry
): string[] {
  registry.clear();

  const playerNames: string[] = [config.humanName];

  for (let i = 0; i < config.aiPlayers.length; i++) {
    const aiConfig = config.aiPlayers[i]!;
    const playerId = `player-${i + 1}`;
    playerNames.push(aiConfig.name);
    registry.register(playerId, aiConfig);
  }

  return playerNames;
}

/**
 * Create a registry for an all-AI game (no human player)
 * Used for testing AI vs AI matches.
 *
 * Returns the player names array where all players are AI.
 */
export function setupAllAIGame(
  aiPlayers: AIPlayerConfig[],
  registry: AIPlayerRegistry
): string[] {
  if (aiPlayers.length < 3) {
    throw new Error("May I requires at least 3 players");
  }

  registry.clear();

  const playerNames: string[] = [];

  for (let i = 0; i < aiPlayers.length; i++) {
    const aiConfig = aiPlayers[i]!;
    const playerId = `player-${i}`;
    playerNames.push(aiConfig.name);
    registry.register(playerId, aiConfig);
  }

  return playerNames;
}
