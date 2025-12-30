/**
 * Type definitions for the May I? CLI
 *
 * Used by both agent harness and interactive modes
 */

import type { RoundNumber } from "../../core/engine/engine.types";

/**
 * Decision phases - what the CLI is waiting for
 */
export type DecisionPhase =
  | "AWAITING_DRAW" // Current player needs to draw
  | "AWAITING_ACTION" // Current player has drawn, can lay down/layoff/swap or proceed to discard
  | "AWAITING_DISCARD" // Current player must discard
  | "RESOLVING_MAY_I" // May I resolution in progress, waiting for prompted player
  | "ROUND_END" // Round finished
  | "GAME_END"; // Game over

/**
 * Action log entry for the game log file
 */
export interface ActionLogEntry {
  timestamp: string;
  turnNumber: number;
  roundNumber: RoundNumber;
  playerId: string;
  playerName: string;
  action: string;
  details?: string;
}

/**
 * Result of executing a command
 */
export interface CommandResult {
  success: boolean;
  message: string;
  error?: string;
}

/**
 * Available commands based on current phase
 */
export interface AvailableCommands {
  phase: DecisionPhase;
  commands: string[];
  description: string;
  /**
   * Player IDs who can currently call May I (if any).
   * Only populated during AWAITING_DRAW and AWAITING_ACTION phases.
   */
  mayIEligiblePlayerIds?: string[];
}

/**
 * CLI save format for persisting a GameEngine-backed game
 *
 * This stores XState's persisted snapshot (engineSnapshot) plus metadata needed
 * to hydrate GameEngine with stable gameId and createdAt.
 */
export interface CliGameSave {
  version: "3.0";
  gameId: string;
  createdAt: string;
  updatedAt: string;
  engineSnapshot: unknown;
}
