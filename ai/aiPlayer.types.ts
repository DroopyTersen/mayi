/**
 * Types for AI player configuration
 */

import type { ModelId } from "./modelRegistry";

/**
 * Configuration for an AI player
 */
export interface AIPlayerConfig {
  /** The player's display name */
  name: string;

  /** Model ID from the registry (e.g., "default:openai", "default:claude") */
  modelId: ModelId;
}

/**
 * Game configuration with a mix of human and AI players
 */
export interface GamePlayerConfig {
  /** Human player name (always player-0) */
  humanName: string;

  /** AI players to add to the game */
  aiPlayers: AIPlayerConfig[];
}
